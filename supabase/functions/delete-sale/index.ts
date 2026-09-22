import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {
  authorize,
  handleOptions,
  jsonResponse,
  readJson,
  safeError,
  validateExternalHttpUrl,
} from '../_shared/security.ts';

interface DeleteSaleBody {
  vendaId?: string;
  deleteFromFinance?: boolean;
}

interface DeletionRequest {
  id: string;
  venda_id: string;
  venda_snapshot: Record<string, unknown>;
  attempts: number;
}

interface FinanceConfig {
  url: string;
  secret: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function signPayload(secret: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  return toHex(signature);
}

async function deliverToFinance(
  db: any,
  request: DeletionRequest,
  config: FinanceConfig,
): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    event_id: request.id,
    event_type: 'vendas.delete.requested.v1',
    schema_version: 1,
    source: 'memude_core',
    entity_type: 'vendas',
    entity_id: request.venda_id,
    occurred_at: new Date().toISOString(),
    record: null,
    old_record: request.venda_snapshot,
    delete_from_finance: true,
    deletion_request_id: request.id,
  });
  const signature = await signPayload(config.secret, timestamp, body);
  const url = validateExternalHttpUrl(config.url);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-memude-timestamp': timestamp,
      'x-memude-signature': `sha256=${signature}`,
    },
    body,
    signal: AbortSignal.timeout(20_000),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Financeiro respondeu HTTP ${response.status}: ${responseText.slice(0, 300)}`);
  }

  const { error } = await db.rpc('finish_sale_deletion_request', {
    _request_id: request.id,
    _success: true,
    _error: null,
  });
  if (error) throw new Error(`Falha ao concluir a entrega: ${error.message}`);
}

async function processRequests(db: any, requestId: string | null): Promise<{
  processed: number;
  failed: number;
}> {
  const { data: claimed, error: claimError } = await db.rpc('claim_sale_deletion_requests', {
    _request_id: requestId,
    _limit: requestId ? 1 : 20,
  });
  if (claimError) throw new Error(`Falha ao reservar exclusoes: ${claimError.message}`);
  const requests = (claimed ?? []) as DeletionRequest[];
  if (!requests.length) return { processed: 0, failed: 0 };

  const { data: rawConfig, error: configError } = await db.rpc('get_finance_webhook_config');
  if (configError) throw new Error(`Falha ao carregar a integracao: ${configError.message}`);
  const config = rawConfig as FinanceConfig;

  let processed = 0;
  let failed = 0;
  for (const request of requests) {
    try {
      await deliverToFinance(db, request, config);
      processed += 1;
    } catch (error) {
      failed += 1;
      const message = safeError(error);
      console.error('Sale deletion delivery failed', {
        requestId: request.id,
        vendaId: request.venda_id,
        attempt: request.attempts,
        error: message,
      });
      await db.rpc('finish_sale_deletion_request', {
        _request_id: request.id,
        _success: false,
        _error: message,
      });
    }
  }
  return { processed, failed };
}

Deno.serve(async (req: Request) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Metodo nao permitido' }, 405);

  const access = await authorize(req, 'admin-or-internal');
  if (access instanceof Response) return access;
  const db = access.supabase as any;

  try {
    if (access.isInternal) {
      const result = await processRequests(db, null);
      return jsonResponse(req, result);
    }

    const body = await readJson<DeleteSaleBody>(req, 8 * 1024);
    if (!body.vendaId || !UUID_PATTERN.test(body.vendaId)) {
      return jsonResponse(req, { error: 'Venda invalida' }, 400);
    }

    const { data, error } = await db.rpc('request_sale_deletion', {
      _venda_id: body.vendaId,
      _delete_from_finance: body.deleteFromFinance === true,
    });
    if (error) {
      const status = error.code === 'P0002' ? 404 : error.code === '42501' ? 403 : 400;
      return jsonResponse(req, { error: error.message }, status);
    }

    const requestId = String(data.request_id);
    if (!body.deleteFromFinance) {
      return jsonResponse(req, { deleted: true, finance: 'not_requested', requestId });
    }

    const delivery = await processRequests(db, requestId);
    const pending = delivery.failed > 0 || delivery.processed === 0;
    return jsonResponse(
      req,
      {
        deleted: true,
        finance: pending ? 'pending' : 'deleted',
        requestId,
      },
      pending ? 202 : 200,
    );
  } catch (error) {
    console.error('delete-sale failed', safeError(error));
    return jsonResponse(req, { error: safeError(error) }, 500);
  }
});
