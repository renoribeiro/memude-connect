import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const ORIGENS_PADRAO = [
  'https://core.memudecore.com.br',
  'https://memude-connect.vercel.app',
  'https://web.whatsapp.com',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

// Extensões do Chrome têm id de 32 letras a-p; a autenticação continua sendo o JWT do usuário.
const ORIGEM_EXTENSAO = /^chrome-extension:\/\/[a-p]{32}$/;

function origemPermitida(origin: string | null): string {
  if (!origin) return ORIGENS_PADRAO[0];
  const extras = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  if (ORIGENS_PADRAO.includes(origin) || extras.includes(origin) || ORIGEM_EXTENSAO.test(origin)) return origin;
  return ORIGENS_PADRAO[0];
}

export function cors(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origemPermitida(req.headers.get('origin')),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret, x-cron-secret',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(req),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function preflight(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response(null, { status: 204, headers: cors(req) }) : null;
}

export async function lerJson<T>(req: Request, maxBytes = 64 * 1024): Promise<T> {
  if (Number(req.headers.get('content-length') ?? '0') > maxBytes) throw new ErroHttp(413, 'Requisição muito grande');
  const texto = await req.text();
  if (new TextEncoder().encode(texto).length > maxBytes) throw new ErroHttp(413, 'Requisição muito grande');
  if (!texto) return {} as T;
  try {
    return JSON.parse(texto) as T;
  } catch {
    throw new ErroHttp(400, 'JSON inválido');
  }
}

export class ErroHttp extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function igualSeguro(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x[i] ^ y[i];
  return diff === 0;
}

function bearer(req: Request): string | null {
  const h = req.headers.get('authorization');
  return h?.startsWith('Bearer ') ? h.slice(7).trim() || null : null;
}

export function clienteServico(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !chave) throw new Error('Configuração do servidor incompleta');
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}

function clienteUsuario(token: string): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function requisicaoInterna(req: Request, servico: SupabaseClient): Promise<boolean> {
  const fornecido = req.headers.get('x-internal-secret') ?? req.headers.get('x-cron-secret');
  if (!fornecido || fornecido.length > 256) return false;
  if (
    igualSeguro(fornecido, Deno.env.get('INTERNAL_FUNCTION_SECRET'))
    || igualSeguro(fornecido, Deno.env.get('CRON_SECRET'))
  ) return true;
  // O pg_cron guarda o segredo no Vault; a validação é feita no banco, sem duplicá-lo.
  const { data, error } = await servico.rpc('verify_internal_function_secret', { _candidate: fornecido });
  return !error && data === true;
}

export type Modo = 'comercial' | 'admin' | 'interno' | 'admin-ou-interno';

export interface Acesso {
  servico: SupabaseClient;
  usuario: SupabaseClient | null;
  userId: string | null;
  email?: string | null;
  papel: string | null;
  interno: boolean;
}

export async function autorizar(req: Request, modo: Modo): Promise<Acesso> {
  const servico = clienteServico();
  if ((modo === 'interno' || modo === 'admin-ou-interno') && await requisicaoInterna(req, servico)) {
    return { servico, usuario: null, userId: null, papel: null, interno: true };
  }
  if (modo === 'interno') throw new ErroHttp(401, 'Não autorizado');

  const token = bearer(req);
  if (!token) throw new ErroHttp(401, 'Faça login no core.memude');
  const { data: { user }, error } = await servico.auth.getUser(token);
  if (error || !user) throw new ErroHttp(401, 'Sessão inválida ou expirada. Faça login novamente.');

  const { data: papelRow } = await servico.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
  const papel = (papelRow?.role as string | undefined) ?? null;
  const comercial = papel === 'admin' || papel === 'sdr' || papel === 'closer';
  if (!comercial || ((modo === 'admin' || modo === 'admin-ou-interno') && papel !== 'admin')) {
    throw new ErroHttp(403, modo === 'comercial' ? 'Acesso restrito à equipe comercial' : 'Acesso restrito a administradores');
  }
  return { servico, usuario: clienteUsuario(token), userId: user.id, email: user.email ?? null, papel, interno: false };
}

export function responderErro(req: Request, erro: unknown): Response {
  if (erro instanceof ErroHttp) return json(req, { erro: erro.message }, erro.status);
  const pg = erro as { code?: string; message?: string };
  // Erros de regra de negócio do banco já vêm em português e são seguros para o usuário.
  if (pg?.code && ['22023', '23505', '23P01', 'P0002', '42501'].includes(pg.code)) {
    const status = pg.code === '42501' ? 403 : pg.code === 'P0002' ? 404 : pg.code === '23505' || pg.code === '23P01' ? 409 : 400;
    return json(req, { erro: pg.message }, status);
  }
  console.error('Erro interno:', pg?.message ?? erro);
  return json(req, { erro: 'Erro interno. Tente novamente.' }, 500);
}
