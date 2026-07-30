import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { getEvolutionWebhookSecret } from '../_shared/evolution-webhook.ts';
import {
  buildEvolutionWebhookPayload,
  EVOLUTION_WEBHOOK_EVENTS,
} from '../_shared/evolution-webhook-payload.ts';
import {
  authorize,
  handleOptions,
  jsonResponse,
  readJson,
  safeError,
  validateExternalHttpUrl,
} from '../_shared/security.ts';

interface ConfigureRequest {
  action?: 'configure' | 'prepare_manual';
  instance_id?: string;
}

interface EvolutionConfig {
  id: string | null;
  displayName: string;
  instanceName: string;
  apiUrl: string;
  apiKey: string;
}

interface UpstreamResult {
  instance: string;
  verified: boolean;
  status: number;
}

class ConfigurationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

function redact(value: string, secrets: string[]): string {
  return secrets.reduce(
    (sanitized, secret) => secret
      ? sanitized.replaceAll(secret, '[REDACTED]')
      : sanitized,
    value,
  ).slice(0, 600);
}

async function loadEvolutionConfigs(
  supabase: SupabaseClient,
  instanceId?: string,
): Promise<EvolutionConfig[]> {
  let query = supabase
    .from('evolution_instances')
    .select('id, name, instance_name, api_url, api_token, is_active')
    .order('updated_at', { ascending: false });

  query = instanceId
    ? query.eq('id', instanceId)
    : query.eq('is_active', true);

  const { data: instances, error: instancesError } = await query;
  if (instancesError) {
    throw new ConfigurationError(
      `Não foi possível carregar as instâncias Evolution: ${instancesError.message}`,
      500,
    );
  }

  const configs = (instances ?? [])
    .filter((instance) =>
      Boolean(instance.api_url?.trim())
      && Boolean(instance.api_token?.trim())
      && Boolean(instance.instance_name?.trim())
    )
    .map((instance) => ({
      id: instance.id,
      displayName: instance.name,
      instanceName: instance.instance_name.trim(),
      apiUrl: instance.api_url.trim().replace(/\/+$/, ''),
      apiKey: instance.api_token.trim(),
    }));

  if (configs.length > 0) return configs;

  if (instanceId) {
    throw new ConfigurationError(
      'A instância selecionada não existe ou está sem URL, chave ou nome de instância.',
    );
  }

  const { data: settings, error: settingsError } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [
      'evolution_api_url',
      'evolution_api_key',
      'evolution_instance_name',
    ]);

  if (settingsError) {
    throw new ConfigurationError(
      `Não foi possível carregar a configuração legada: ${settingsError.message}`,
      500,
    );
  }

  const settingsMap = new Map(
    (settings ?? []).map((setting) => [setting.key, setting.value?.trim() ?? '']),
  );
  const apiUrl = settingsMap.get('evolution_api_url')?.replace(/\/+$/, '');
  const apiKey = settingsMap.get('evolution_api_key');
  const instanceName = settingsMap.get('evolution_instance_name');

  if (!apiUrl || !apiKey || !instanceName) {
    throw new ConfigurationError(
      'Nenhuma instância Evolution ativa e completa foi encontrada.',
    );
  }

  return [{
    id: null,
    displayName: 'Evolution (configuração legada)',
    instanceName,
    apiUrl,
    apiKey,
  }];
}

async function callEvolution(
  config: EvolutionConfig,
  webhookUrl: string,
  webhookSecret: string,
): Promise<UpstreamResult> {
  validateExternalHttpUrl(config.apiUrl);

  const instancePath = encodeURIComponent(config.instanceName);
  const setUrl = `${config.apiUrl}/webhook/set/${instancePath}`;
  const webhookPayload = buildEvolutionWebhookPayload(
    webhookUrl,
    webhookSecret,
  );

  const response = await fetch(setUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.apiKey,
    },
    body: JSON.stringify(webhookPayload),
    signal: AbortSignal.timeout(20_000),
  });
  const responseText = await response.text();

  console.log('Evolution webhook set completed', {
    instance: config.instanceName,
    status: response.status,
  });

  if (!response.ok) {
    const detail = redact(responseText, [config.apiKey, webhookSecret]);
    throw new ConfigurationError(
      `A Evolution recusou a configuração da instância ${config.instanceName} `
        + `(HTTP ${response.status})${detail ? `: ${detail}` : ''}`,
      502,
    );
  }

  const verifyResponse = await fetch(
    `${config.apiUrl}/webhook/find/${instancePath}`,
    {
      method: 'GET',
      headers: { apikey: config.apiKey },
      signal: AbortSignal.timeout(15_000),
    },
  );
  const verifyText = await verifyResponse.text();
  if (!verifyResponse.ok) {
    const detail = redact(verifyText, [config.apiKey, webhookSecret]);
    throw new ConfigurationError(
      `A Evolution aceitou, mas não foi possível confirmar o webhook da instância `
        + `${config.instanceName} (HTTP ${verifyResponse.status})`
        + `${detail ? `: ${detail}` : ''}`,
      502,
    );
  }

  let verifiedConfig: Record<string, unknown>;
  try {
    verifiedConfig = JSON.parse(verifyText) as Record<string, unknown>;
  } catch {
    throw new ConfigurationError(
      `A Evolution retornou uma confirmação inválida para ${config.instanceName}.`,
      502,
    );
  }

  const returnedWebhook = (
    verifiedConfig.webhook && typeof verifiedConfig.webhook === 'object'
      ? verifiedConfig.webhook
      : verifiedConfig
  ) as Record<string, unknown>;
  const enabled = returnedWebhook.enabled !== false;
  const returnedUrl = String(returnedWebhook.url ?? '');
  if (!enabled || returnedUrl !== webhookUrl) {
    throw new ConfigurationError(
      `A Evolution não persistiu corretamente o webhook da instância ${config.instanceName}.`,
      502,
    );
  }

  return {
    instance: config.instanceName,
    verified: true,
    status: response.status,
  };
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const access = await authorize(req, 'admin');
    if (access instanceof Response) return access;

    const payload = await readJson<ConfigureRequest>(req, 16 * 1024);
    const webhookSecret = await getEvolutionWebhookSecret(
      access.supabase,
      { createIfMissing: true },
    );
    if (!webhookSecret) {
      throw new ConfigurationError(
        'Não foi possível provisionar a credencial do webhook.',
        500,
      );
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
    if (!supabaseUrl) {
      throw new ConfigurationError('SUPABASE_URL não configurada', 500);
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook-handler`;
    if (payload.action === 'prepare_manual') {
      return jsonResponse(req, {
        success: true,
        webhook_url: `${webhookUrl}?secret=${encodeURIComponent(webhookSecret)}`,
        message: 'URL manual segura gerada com sucesso.',
      });
    }

    const configs = await loadEvolutionConfigs(
      access.supabase,
      payload.instance_id,
    );
    const results: UpstreamResult[] = [];
    for (const config of configs) {
      results.push(
        await callEvolution(config, webhookUrl, webhookSecret),
      );
    }

    const { error: settingsError } = await access.supabase
      .from('system_settings')
      .upsert([
        {
          key: 'evolution_webhook_url',
          value: webhookUrl,
          description: 'URL do webhook configurado na Evolution API',
          updated_at: new Date().toISOString(),
        },
        {
          key: 'evolution_webhook_enabled',
          value: 'true',
          description: 'Indica se o webhook está ativo e verificado',
          updated_at: new Date().toISOString(),
        },
      ], { onConflict: 'key' });

    if (settingsError) {
      throw new ConfigurationError(
        `Webhook configurado, mas o status local não pôde ser salvo: ${settingsError.message}`,
        500,
      );
    }

    return jsonResponse(req, {
      success: true,
      webhook_url: webhookUrl,
      instance: results[0]?.instance,
      instances: results,
      events: EVOLUTION_WEBHOOK_EVENTS,
      message: results.length === 1
        ? `Webhook configurado e verificado na instância ${results[0].instance}.`
        : `Webhook configurado e verificado em ${results.length} instâncias.`,
    });
  } catch (error) {
    const status = error instanceof ConfigurationError ? error.status : 500;
    console.error('Evolution webhook configuration failed', {
      status,
      error: safeError(error),
    });
    return jsonResponse(req, {
      success: false,
      error: safeError(error),
    }, status);
  }
});
