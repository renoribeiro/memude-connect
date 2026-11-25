// MeMude Conversas — utilidades compartilhadas (Evolution API, segredos, qualificação).
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { ErroHttp } from './fase1-http.ts';

export const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');
export const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/conversas-webhook`;
export const EVENTOS_WEBHOOK = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'];
export const PREFIXO_INSTANCIA = 'conversas-';
export const BUCKET = 'conversas';
export const MAX_MIDIA = 25 * 1024 * 1024;

// Mesmas opções da extensão (qualificação no CRM)
export const RENDAS = ['Até R$ 3 mil', 'R$ 3 a 5 mil', 'R$ 5 a 8 mil', 'R$ 8 a 12 mil', 'Acima de R$ 12 mil'];
export const ENTRADAS = ['Tem entrada', 'Entrada + FGTS', 'Só FGTS', 'Ainda não tem'];
export const PRAZOS = ['Imediato', 'Até 3 meses', '3 a 6 meses', 'Mais de 6 meses'];
export const FINALIDADES = ['Moradia', 'Investimento'];
export const STATUS_CRM = ['NOVO', 'EM CONVERSA', 'INTERESSADO', 'VISITA AGENDADA', 'INVESTIDOR', 'CORRETOR', 'SEM RENDA', 'NÃO INTERESSADO'];
export const ETAPAS = ['novo', 'em_atendimento', 'visita_marcada', 'visitou', 'proposta', 'documentacao', 'vendido', 'perdido'];

export interface Evo { url: string; chave: string }

/** Servidor e chave global da Evolution já usados pelo Connect (somente leitura). */
export async function evolution(db: SupabaseClient): Promise<Evo> {
  const envUrl = Deno.env.get('EVOLUTION_API_URL');
  const envChave = Deno.env.get('EVOLUTION_API_KEY');
  if (envUrl && envChave) return { url: envUrl.replace(/\/$/, ''), chave: envChave };
  const { data } = await db.from('evolution_instances').select('api_url, api_token')
    .eq('is_active', true).not('api_token', 'is', null).limit(1).maybeSingle();
  if (data?.api_url && data?.api_token) return { url: String(data.api_url).replace(/\/$/, ''), chave: String(data.api_token) };
  const { data: cfg } = await db.from('system_settings').select('key, value').in('key', ['evolution_api_url', 'evolution_api_key']);
  const mapa = Object.fromEntries((cfg ?? []).map((r) => [r.key, r.value]));
  if (mapa.evolution_api_url && mapa.evolution_api_key) {
    return { url: String(mapa.evolution_api_url).replace(/\/$/, ''), chave: String(mapa.evolution_api_key) };
  }
  throw new ErroHttp(500, 'Evolution API não configurada');
}

export async function evo<T = Record<string, unknown>>(
  e: Evo, caminho: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${e.url}${caminho}`, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: { apikey: e.chave, 'Content-Type': 'application/json' },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(init.timeoutMs ?? 25_000),
    });
  } catch (err) {
    throw new ErroHttp(502, `Servidor do WhatsApp não respondeu (${(err as Error).name === 'TimeoutError' ? 'tempo esgotado' : 'rede'})`);
  }
  const texto = await r.text();
  let corpo: unknown = null;
  try { corpo = texto ? JSON.parse(texto) : null; } catch { corpo = { texto: texto.slice(0, 300) }; }
  if (!r.ok) {
    const c = corpo as { response?: { message?: unknown }; message?: unknown; error?: unknown } | null;
    const msg = c?.response?.message ?? c?.message ?? c?.error ?? `HTTP ${r.status}`;
    throw new ErroHttp(502, `WhatsApp: ${Array.isArray(msg) ? msg.flat().join('; ') : String(msg)}`.slice(0, 300));
  }
  return corpo as T;
}

export function instanciaValida(nome: unknown): nome is string {
  return typeof nome === 'string' && /^conversas-[a-z0-9-]{2,40}$/.test(nome);
}

/** Segredo guardado no Vault; criado uma única vez (nunca sai do servidor). */
export async function segredo(db: SupabaseClient, nome: 'conversas_webhook_secret' | 'conversas_vapid', gerar?: () => Promise<string> | string) {
  const { data, error } = await db.rpc('conv_segredo', { p_nome: nome });
  if (error) throw error;
  if (data) return String(data);
  if (!gerar) return null;
  const { data: salvo, error: e2 } = await db.rpc('conv_segredo_salvar', { p_nome: nome, p_valor: await gerar() });
  if (e2) throw e2;
  return String(salvo);
}

export function aleatorioHex(bytes = 32): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function igualSeguro(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i += 1) d |= x[i] ^ y[i];
  return d === 0;
}

export function configWebhook(segredoWebhook: string) {
  return {
    enabled: true,
    url: WEBHOOK_URL,
    headers: { 'x-webhook-secret': segredoWebhook },
    byEvents: false,
    base64: false,
    events: EVENTOS_WEBHOOK,
  };
}

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic',
  'video/mp4': 'mp4', 'video/3gpp': '3gp', 'video/quicktime': 'mov', 'video/webm': 'webm',
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/webm': 'webm', 'audio/wav': 'wav',
  'application/pdf': 'pdf', 'text/plain': 'txt',
  'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/zip': 'zip',
};

export function extensao(mime: string | null | undefined, nome?: string | null): string {
  const base = (mime ?? '').split(';')[0].trim().toLowerCase();
  if (EXT[base]) return EXT[base];
  const porNome = nome?.match(/\.([a-z0-9]{1,5})$/i)?.[1];
  return porNome ? porNome.toLowerCase() : 'bin';
}

export function base64ParaBytes(b64: string): Uint8Array {
  const limpo = b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64;
  const bin = atob(limpo);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}
