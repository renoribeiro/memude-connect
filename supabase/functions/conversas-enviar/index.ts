// MeMude Conversas — envio de mensagens pelo Connect / app do corretor.
// Autenticação: JWT do usuário. Quem pode responder é decidido no banco (conversa_preparar_envio):
// equipe comercial em qualquer conversa; corretor só nas conversas dele.
//
//   POST { acao: 'enviar', conversa_id, tipo, texto?, midia_path?, midia_nome?, midia_mime?, midia_bytes?, duracao_s?, responde_a? }
//   POST { acao: 'reenviar', mensagem_id }          tenta de novo uma mensagem com erro
//   POST { acao: 'lida', conversa_id }              marca como lidas no WhatsApp do cliente (✓✓ azul)
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { clienteServico, ErroHttp, json, lerJson, preflight, responderErro } from '../_shared/fase1-http.ts';
import { BUCKET, evo, evolution, extensao, MAX_MIDIA } from '../_shared/conversas.ts';

const TIPOS = ['texto', 'imagem', 'video', 'audio', 'documento'];
const uuidOk = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

interface Preparo { instancia: string; jid: string; telefone: string; autor_id: string; autor_nome: string | null; assinatura: string | null }
interface Pedido {
  acao?: string; conversa_id?: string; mensagem_id?: string; tipo?: string; texto?: string; midia_path?: string; midia_nome?: string;
  midia_mime?: string; midia_bytes?: number; duracao_s?: number; responde_a?: string;
}

async function usuario(req: Request, servico: SupabaseClient) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new ErroHttp(401, 'Faça login');
  const { data: { user }, error } = await servico.auth.getUser(token);
  if (error || !user) throw new ErroHttp(401, 'Sessão expirada. Entre de novo.');
  const cliente = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return { id: user.id, cliente };
}

/** Ritmo humano: "digitando…" proporcional ao tamanho, sem atrasar demais. */
const atraso = (tipo: string, texto: string | null) =>
  tipo === 'texto' ? Math.min(3500, Math.max(900, 500 + (texto?.length ?? 0) * 25)) : tipo === 'audio' ? 1800 : 1200;

async function despachar(servico: SupabaseClient, p: Preparo, m: {
  id: string; tipo: string; texto: string | null; midia_path: string | null; midia_nome: string | null; midia_mime: string | null;
  quotedWa?: string | null; quotedTexto?: string | null;
}, assinatura: string | null) {
  const e = await evolution(servico);
  const numero = p.telefone.replace(/\D/g, '');
  const legenda = m.texto ? (assinatura ? `${assinatura}\n${m.texto}` : m.texto) : (assinatura ?? undefined);
  const quoted = m.quotedWa ? { key: { id: m.quotedWa }, message: { conversation: m.quotedTexto ?? '' } } : undefined;
  const delay = atraso(m.tipo, m.texto);
  let r: { key?: { id?: string } };
  if (m.tipo === 'texto') {
    r = await evo(e, `/message/sendText/${p.instancia}`, { body: { number: numero, text: legenda, delay, linkPreview: true, quoted } });
  } else {
    const assinada = await servico.storage.from(BUCKET).createSignedUrl(m.midia_path!, 900);
    if (assinada.error || !assinada.data?.signedUrl) throw new ErroHttp(500, 'Arquivo não encontrado para envio');
    const url = assinada.data.signedUrl;
    if (m.tipo === 'audio') {
      r = await evo(e, `/message/sendWhatsAppAudio/${p.instancia}`, { body: { number: numero, audio: url, delay, encoding: true, quoted }, timeoutMs: 60_000 });
    } else {
      r = await evo(e, `/message/sendMedia/${p.instancia}`, {
        body: {
          number: numero, mediatype: m.tipo === 'imagem' ? 'image' : m.tipo === 'video' ? 'video' : 'document',
          mimetype: m.midia_mime ?? undefined, caption: legenda, media: url, fileName: m.midia_nome ?? undefined, delay, quoted,
        },
        timeoutMs: 60_000,
      });
    }
  }
  const waId = r?.key?.id;
  if (!waId) throw new ErroHttp(502, 'O WhatsApp não confirmou o envio');
  const { error } = await servico.rpc('conv_mensagem_resultado', { p_id: m.id, p_wa_id: waId, p_erro: null });
  if (error) throw error;
  return waId;
}

async function falhou(servico: SupabaseClient, id: string, err: unknown) {
  const msg = err instanceof ErroHttp ? err.message : 'Falha ao enviar';
  await servico.rpc('conv_mensagem_resultado', { p_id: id, p_wa_id: null, p_erro: msg });
}

async function citada(servico: SupabaseClient, conversaId: string, id?: string) {
  if (!uuidOk(id)) return { quotedWa: null, quotedTexto: null, id: null };
  const { data } = await servico.from('mensagens').select('id, wa_id, texto').eq('id', id).eq('conversa_id', conversaId).maybeSingle();
  return { quotedWa: data?.wa_id ?? null, quotedTexto: data?.texto ?? null, id: data?.id ?? null };
}

async function enviar(servico: SupabaseClient, u: { id: string; cliente: SupabaseClient }, b: Pedido) {
  if (!uuidOk(b.conversa_id)) throw new ErroHttp(400, 'Conversa inválida');
  const tipo = b.tipo ?? 'texto';
  if (!TIPOS.includes(tipo)) throw new ErroHttp(400, 'Tipo de mensagem inválido');
  const texto = typeof b.texto === 'string' ? b.texto.trim().slice(0, 4000) : '';
  if (tipo === 'texto' && !texto) throw new ErroHttp(400, 'Escreva a mensagem');

  const { data: prep, error } = await u.cliente.rpc('conversa_preparar_envio', { p_conversa: b.conversa_id });
  if (error) throw error;
  const p = prep as Preparo;

  let midia: string | null = null;
  if (tipo !== 'texto') {
    const origem = String(b.midia_path ?? '');
    if (!origem.startsWith(`saida/${u.id}/`) || origem.includes('..')) throw new ErroHttp(400, 'Arquivo inválido');
    if (Number(b.midia_bytes ?? 0) > MAX_MIDIA) throw new ErroHttp(413, 'Arquivo maior que 25 MB');
    midia = `${b.conversa_id}/${crypto.randomUUID()}.${extensao(b.midia_mime, b.midia_nome)}`;
    const mv = await servico.storage.from(BUCKET).move(origem, midia);
    if (mv.error) throw new ErroHttp(400, 'Arquivo não encontrado. Anexe de novo.');
  }

  const q = await citada(servico, b.conversa_id, b.responde_a);
  const { data: id, error: e2 } = await servico.rpc('conv_mensagem_saida', {
    p: {
      conversa_id: b.conversa_id, autor_id: u.id, autor_nome: p.autor_nome, tipo, texto: texto || null, midia_path: midia,
      midia_mime: b.midia_mime ?? null, midia_nome: b.midia_nome ?? null, midia_bytes: b.midia_bytes ?? null,
      duracao_s: b.duracao_s ?? null, responde_a: q.id,
    },
  });
  if (e2) throw e2;
  try {
    const waId = await despachar(servico, p, {
      id: id as string, tipo, texto: texto || null, midia_path: midia, midia_nome: b.midia_nome ?? null, midia_mime: b.midia_mime ?? null,
      quotedWa: q.quotedWa, quotedTexto: q.quotedTexto,
    }, tipo === 'audio' ? null : p.assinatura);
    return { mensagem_id: id, wa_id: waId, status: 'enviada' };
  } catch (err) {
    await falhou(servico, id as string, err);
    throw err;
  }
}

async function reenviar(servico: SupabaseClient, u: { id: string; cliente: SupabaseClient }, b: Pedido) {
  if (!uuidOk(b.mensagem_id)) throw new ErroHttp(400, 'Mensagem inválida');
  const { data: m } = await servico.from('mensagens').select('id, conversa_id, tipo, texto, midia_path, midia_nome, midia_mime, status, direcao, responde_a')
    .eq('id', b.mensagem_id).maybeSingle();
  if (!m || m.direcao !== 'saida' || m.status !== 'erro') throw new ErroHttp(400, 'Esta mensagem não precisa ser reenviada');
  const { data: prep, error } = await u.cliente.rpc('conversa_preparar_envio', { p_conversa: m.conversa_id });
  if (error) throw error;
  await servico.from('mensagens').update({ status: 'pendente', erro: null }).eq('id', m.id);
  const q = await citada(servico, m.conversa_id, m.responde_a ?? undefined);
  try {
    const waId = await despachar(servico, prep as Preparo, { ...m, quotedWa: q.quotedWa, quotedTexto: q.quotedTexto },
      m.tipo === 'audio' ? null : (prep as Preparo).assinatura);
    return { mensagem_id: m.id, wa_id: waId, status: 'enviada' };
  } catch (err) {
    await falhou(servico, m.id, err);
    throw err;
  }
}

async function marcarLida(servico: SupabaseClient, u: { id: string; cliente: SupabaseClient }, b: Pedido) {
  if (!uuidOk(b.conversa_id)) throw new ErroHttp(400, 'Conversa inválida');
  const { data: prep, error } = await u.cliente.rpc('conversa_preparar_envio', { p_conversa: b.conversa_id });
  if (error) return { ok: false }; // sem permissão de responder ou número fora do ar: não marca
  const p = prep as Preparo;
  const { data: msgs } = await servico.from('mensagens').select('wa_id').eq('conversa_id', b.conversa_id).eq('direcao', 'entrada')
    .not('wa_id', 'is', null).gte('criado_em', new Date(Date.now() - 3 * 86_400_000).toISOString())
    .order('criado_em', { ascending: false }).limit(15);
  if (!msgs?.length) return { ok: true };
  const e = await evolution(servico);
  await evo(e, `/chat/markMessageAsRead/${p.instancia}`, {
    body: { readMessages: msgs.map((x) => ({ remoteJid: p.jid, fromMe: false, id: x.wa_id })) }, timeoutMs: 10_000,
  }).catch(() => null);
  return { ok: true };
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    if (req.method !== 'POST') throw new ErroHttp(405, 'Método não permitido');
    const servico = clienteServico();
    const u = await usuario(req, servico);
    const b = await lerJson<Pedido>(req, 16 * 1024);
    const acao = b.acao ?? 'enviar';
    if (acao === 'enviar') return json(req, await enviar(servico, u, b));
    if (acao === 'reenviar') return json(req, await reenviar(servico, u, b));
    if (acao === 'lida') return json(req, await marcarLida(servico, u, b));
    throw new ErroHttp(400, 'Ação inválida');
  } catch (err) {
    return responderErro(req, err);
  }
});
