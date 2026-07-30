import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const DEFAULT_ORIGINS = [
  'https://core.memudecore.com.br',
  'https://memude-connect.vercel.app',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

export type AccessMode =
  | 'authenticated'
  | 'authenticated-or-internal'
  | 'admin'
  | 'internal'
  | 'admin-or-internal';

export interface AuthorizedRequest {
  supabase: SupabaseClient;
  userId: string | null;
  isInternal: boolean;
}

function configuredOrigins(): Set<string> {
  const configured = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ORIGINS, ...configured]);
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  const allowedOrigins = configuredOrigins();
  const allowedOrigin = origin && allowedOrigins.has(origin)
    ? origin
    : 'https://core.memudecore.com.br';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-cron-secret, x-internal-secret, x-webhook-secret, x-webhook-hmac',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

export function handleOptions(req: Request): Response | null {
  return req.method === 'OPTIONS'
    ? new Response(null, { status: 204, headers: corsHeaders(req) })
    : null;
}

function timingSafeEqual(left: string | null, right: string | null): boolean {
  if (!left || !right) return false;
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ b[index];
  }
  return difference === 0;
}

function bearerToken(req: Request): string | null {
  const authorization = req.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  return authorization.slice(7).trim() || null;
}

export function verifyBearerSecret(
  req: Request,
  expectedSecret: string | null | undefined,
): boolean {
  return timingSafeEqual(bearerToken(req), expectedSecret ?? null);
}

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    throw new Error('Supabase server configuration is incomplete');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function isInternalRequest(
  req: Request,
  supabase: SupabaseClient,
): Promise<boolean> {
  const token = bearerToken(req);
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
  const cronSecret = Deno.env.get('CRON_SECRET');

  if (
    timingSafeEqual(token, serviceKey)
    || timingSafeEqual(req.headers.get('x-internal-secret'), internalSecret)
    || timingSafeEqual(req.headers.get('x-cron-secret'), cronSecret)
  ) {
    return true;
  }

  // pg_cron keeps its generated credential in Vault. This fallback lets Edge
  // Functions validate that credential without duplicating it in function
  // secrets or application tables.
  const suppliedSecret = req.headers.get('x-internal-secret')
    ?? req.headers.get('x-cron-secret');
  if (!suppliedSecret || suppliedSecret.length > 256) return false;

  const { data, error } = await supabase.rpc('verify_internal_function_secret', {
    _candidate: suppliedSecret,
  });
  if (error) {
    console.error('Internal credential verification failed:', error.message);
    return false;
  }
  return data === true;
}

export async function authorize(
  req: Request,
  mode: AccessMode,
): Promise<AuthorizedRequest | Response> {
  const supabase = serviceClient();
  const internal = await isInternalRequest(req, supabase);

  if (
    (mode === 'internal'
      || mode === 'admin-or-internal'
      || mode === 'authenticated-or-internal')
    && internal
  ) {
    return { supabase, userId: null, isInternal: true };
  }

  if (mode === 'internal') {
    return jsonResponse(req, { error: 'Não autorizado' }, 401);
  }

  const token = bearerToken(req);
  if (!token) {
    return jsonResponse(req, { error: 'Autenticação obrigatória' }, 401);
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return jsonResponse(req, { error: 'Sessão inválida ou expirada' }, 401);
  }

  if (mode === 'admin' || mode === 'admin-or-internal') {
    const { data: roleRecord, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    if (roleError || roleRecord?.role !== 'admin') {
      return jsonResponse(req, { error: 'Acesso restrito a administradores' }, 403);
    }
  }

  return { supabase, userId: user.id, isInternal: false };
}

export async function readJson<T>(
  req: Request,
  maxBytes = 64 * 1024,
): Promise<T> {
  const declaredLength = Number(req.headers.get('content-length') ?? '0');
  if (declaredLength > maxBytes) {
    throw new Error('Corpo da requisição excede o limite permitido');
  }

  const text = await req.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new Error('Corpo da requisição excede o limite permitido');
  }
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export async function verifyWebhook(
  req: Request,
  rawBody: string,
  expectedSecret?: string | null,
): Promise<boolean> {
  const secret = expectedSecret?.trim() || Deno.env.get('WEBHOOK_SECRET')?.trim();
  if (!secret) {
    console.error('WEBHOOK_SECRET is not configured');
    return false;
  }

  const urlSecret = new URL(req.url).searchParams.get('secret');
  const headerSecret = req.headers.get('x-webhook-secret');
  const apiKeySecret = req.headers.get('x-api-key');
  if (
    timingSafeEqual(urlSecret, secret)
    || timingSafeEqual(headerSecret, secret)
    || timingSafeEqual(apiKeySecret, secret)
  ) {
    return true;
  }

  const suppliedHmac = (req.headers.get('x-webhook-hmac') ?? '')
    .replace(/^sha256=/i, '')
    .toLowerCase();
  if (!suppliedHmac) return false;

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
    new TextEncoder().encode(rawBody),
  );
  const expected = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return timingSafeEqual(suppliedHmac, expected);
}

export function safeError(error: unknown): string {
  if (error instanceof SyntaxError) return 'JSON inválido';
  return error instanceof Error ? error.message : 'Erro interno';
}

export function validateExternalHttpUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:') {
    throw new Error('A URL externa deve usar HTTPS');
  }

  const hostname = url.hostname.toLowerCase();
  const blockedNames = new Set(['localhost', 'metadata.google.internal']);
  const blockedIpv4 = /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
  const blockedIpv6 = /^(::1|\[?fc|\[?fd|\[?fe80)/i;
  if (blockedNames.has(hostname) || blockedIpv4.test(hostname) || blockedIpv6.test(hostname)) {
    throw new Error('A URL aponta para uma rede interna não permitida');
  }
  if (url.username || url.password) {
    throw new Error('A URL não pode conter credenciais');
  }
  return url;
}
