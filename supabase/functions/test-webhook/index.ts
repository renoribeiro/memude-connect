import { getEvolutionWebhookSecret } from '../_shared/evolution-webhook.ts';
import {
  authorize,
  handleOptions,
  jsonResponse,
  safeError,
} from '../_shared/security.ts';

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const access = await authorize(req, 'admin');
    if (access instanceof Response) return access;

    const webhookSecret = await getEvolutionWebhookSecret(
      access.supabase,
      { createIfMissing: true },
    );
    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
    if (!webhookSecret || !supabaseUrl) {
      throw new Error('Configuração interna do webhook incompleta');
    }

    const testPayload = {
      event: 'TEST_CONNECTION',
      instance: 'memude-diagnostic',
      data: {
        test: true,
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };

    const response = await fetch(
      `${supabaseUrl}/functions/v1/evolution-webhook-handler`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': webhookSecret,
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(15_000),
      },
    );

    let details: unknown = null;
    try {
      details = await response.json();
    } catch {
      details = { status: response.status };
    }

    console.log('Evolution webhook diagnostic completed', {
      status: response.status,
      success: response.ok,
    });

    return jsonResponse(req, {
      success: response.ok,
      status: response.status,
      message: response.ok
        ? 'Webhook autenticado e processado corretamente.'
        : 'O receptor do webhook retornou erro.',
      details,
    }, response.ok ? 200 : 502);
  } catch (error) {
    console.error('Evolution webhook diagnostic failed', {
      error: safeError(error),
    });
    return jsonResponse(req, {
      success: false,
      error: safeError(error),
      message: 'Erro ao testar webhook',
    }, 500);
  }
});
