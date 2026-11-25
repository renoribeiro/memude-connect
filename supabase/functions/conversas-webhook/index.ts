// MeMude Conversas — recebe eventos da Evolution API (só instâncias "conversas-*").
// Autenticação: cabeçalho x-webhook-secret (segredo próprio guardado no Vault).
// Eventos: messages.upsert (mensagens novas, do cliente ou do celular do número),
//          messages.update (entregue/lida) e connection.update (número caiu/voltou).
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { clienteServico } from '../_shared/fase1-http.ts';
import {
  base64ParaBytes, BUCKET, evo, evolution, extensao, igualSeguro, instanciaValida, MAX_MIDIA, segredo,
} from '../_shared/conversas.ts';

type Obj = Record<string, unknown>;
const ok = (corpo: Obj = { ok: true }, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

let segredoCache: { valor: string | null; em: number } | null = null;
async function segredoWebhook(db: SupabaseClient) {
  if (segredoCache?.valor && Date.now() - segredoCache.em < 300_000) return segredoCache.valor;
  const valor = await segredo(db, 'conversas_webhook_secret');
  segredoCache = { valor, em: Date.now() };
  return valor;
}

const STATUS_WA: Record<string, string> = {
  SERVER_ACK: 'enviada', DELIVERY_ACK: 'entregue', READ: 'lida', PLAYED: 'lida', ERROR: 'erro',
  '1': 'enviada', '2': 'enviada', '3': 'entregue', '4': 'lida', '5': 'lida', '0': 'erro',
};

/** Desembrulha mensagens temporárias / visualização única / editadas. */
function desembrulhar(m: Obj | undefined): Obj | undefined {
  let atual = m;
  for (let i = 0; i < 4 && atual; i += 1) {
    const dentro = (atual.ephemeralMessage ?? atual.viewOnceMessage ?? atual.viewOnceMessageV2 ?? atual.viewOnceMessageV2Extension
      ?? atual.documentWithCaptionMessage ?? atual.editedMessage) as { message?: Obj } | undefined;
    if (!dentro?.message) break;
    atual = dentro.message;
  }
  return atual;
}

interface Conteudo {
  tipo: string; texto: string | null; midia?: boolean; mime?: string | null; nome?: string | null; bytes?: number | null; duracao?: number | null;
}

function conteudo(m: Obj | undefined): Conteudo | null {
  const msg = desembrulhar(m);
  if (!msg) return null;
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
  const n = (v: unknown) => (v == null ? null : Number(typeof v === 'object' ? (v as { low?: number }).low ?? 0 : v) || null);
  if (msg.conversation) return { tipo: 'texto', texto: s(msg.conversation) };
  const ext = msg.extendedTextMessage as Obj | undefined;
  if (ext) return { tipo: 'texto', texto: s(ext.text) };
  const img = msg.imageMessage as Obj | undefined;
  if (img) return { tipo: 'imagem', texto: s(img.caption), midia: true, mime: s(img.mimetype), bytes: n(img.fileLength) };
  const vid = msg.videoMessage as Obj | undefined;
  if (vid) return { tipo: 'video', texto: s(vid.caption), midia: true, mime: s(vid.mimetype), bytes: n(vid.fileLength), duracao: n(vid.seconds) };
  const aud = msg.audioMessage as Obj | undefined;
  if (aud) return { tipo: 'audio', texto: null, midia: true, mime: s(aud.mimetype), bytes: n(aud.fileLength), duracao: n(aud.seconds) };
  const doc = msg.documentMessage as Obj | undefined;
  if (doc) return { tipo: 'documento', texto: s(doc.caption), midia: true, mime: s(doc.mimetype), nome: s(doc.fileName) ?? s(doc.title), bytes: n(doc.fileLength) };
  const fig = msg.stickerMessage as Obj | undefined;
  if (fig) return { tipo: 'figurinha', texto: null, midia: true, mime: s(fig.mimetype) ?? 'image/webp', bytes: n(fig.fileLength) };
  const loc = (msg.locationMessage ?? msg.liveLocationMessage) as Obj | undefined;
  if (loc) {
    const lat = Number(loc.degreesLatitude), lng = Number(loc.degreesLongitude);
    const rotulo = [s(loc.name), s(loc.address)].filter(Boolean).join(' — ');
    return { tipo: 'localizacao', texto: `${rotulo ? `${rotulo}\n` : ''}https://maps.google.com/?q=${lat},${lng}` };
  }
  const ctt = msg.contactMessage as Obj | undefined;
  if (ctt) {
    const tel = String(ctt.vcard ?? '').match(/waid=(\d+)|TEL[^:]*:([+\d\s-]+)/);
    return { tipo: 'contato', texto: [s(ctt.displayName), tel?.[1] ?? tel?.[2]?.trim()].filter(Boolean).join(' · ') || 'Contato' };
  }
  const ctts = msg.contactsArrayMessage as { contacts?: Obj[] } | undefined;
  if (ctts) return { tipo: 'contato', texto: (ctts.contacts ?? []).map((c) => s(c.displayName)).filter(Boolean).join(', ') || 'Contatos' };
  const reac = msg.reactionMessage as Obj | undefined;
  if (reac) return s(reac.text) ? { tipo: 'reacao', texto: s(reac.text) } : null;
  const btn = (msg.buttonsResponseMessage ?? msg.templateButtonReplyMessage) as Obj | undefined;
  if (btn) return { tipo: 'texto', texto: s(btn.selectedDisplayText) ?? s(btn.selectedId) };
  const lista = msg.listResponseMessage as Obj | undefined;
  if (lista) return { tipo: 'texto', texto: s(lista.title) ?? s((lista.singleSelectReply as Obj | undefined)?.selectedRowId) };
  return null; // protocolMessage (apagou/editou), enquetes, chamadas etc.
}

const ehTelefoneJid = (j: unknown): j is string => typeof j === 'string' && /^\d{10,15}@s\.whatsapp\.net$/.test(j);
const ehLid = (j: unknown): j is string => typeof j === 'string' && /^\d{8,20}@lid$/.test(j);

/** Telefone real do contato (resolve LID pelo mapa e aprende novas associações). */
async function telefoneDoContato(db: SupabaseClient, instancia: string, key: Obj, dados: Obj): Promise<{ jid: string; telefone: string } | null> {
  const candidatos = [key.remoteJid, key.remoteJidAlt, key.senderPn, key.participantAlt, dados.remoteJidAlt, dados.senderPn];
  const real = candidatos.find(ehTelefoneJid);
  const lid = candidatos.find(ehLid);
  if (real) {
    if (lid) {
      await db.from('lid_phone_map').upsert({ lid: lid.split('@')[0], phone: real.split('@')[0], instance_name: instancia, updated_at: new Date().toISOString() },
        { onConflict: 'lid' });
    }
    return { jid: real, telefone: real.split('@')[0] };
  }
  if (lid) {
    const { data } = await db.from('lid_phone_map').select('phone').eq('lid', lid.split('@')[0]).maybeSingle();
    if (data?.phone) return { jid: `${String(data.phone).replace(/\D/g, '')}@s.whatsapp.net`, telefone: String(data.phone) };
  }
  return null;
}

async function baixarMidia(db: SupabaseClient, instancia: string, waId: string, conversaId: string, mensagemId: string, c: Conteudo) {
  try {
    if (c.bytes && c.bytes > MAX_MIDIA) {
      await db.from('mensagens').update({ erro: 'Arquivo maior que 25 MB: abra no celular do número' }).eq('id', mensagemId);
      return;
    }
    const e = await evolution(db);
    const r = await evo<{ base64?: string; mimetype?: string; fileName?: string }>(e, `/chat/getBase64FromMediaMessage/${instancia}`, {
      body: { message: { key: { id: waId } }, convertToMp4: c.tipo === 'video' }, timeoutMs: 60_000,
    });
    if (!r?.base64) throw new Error('mídia indisponível');
    const bytes = base64ParaBytes(r.base64);
    if (bytes.length > MAX_MIDIA) throw new Error('arquivo grande demais');
    const mime = (r.mimetype ?? c.mime ?? 'application/octet-stream').split(';')[0];
    const caminho = `${conversaId}/${mensagemId}.${extensao(mime, c.nome ?? r.fileName)}`;
    const up = await db.storage.from(BUCKET).upload(caminho, bytes, { contentType: mime, upsert: true });
    if (up.error) throw up.error;
    await db.from('mensagens').update({ midia_path: caminho, midia_mime: mime, midia_bytes: bytes.length, midia_nome: c.nome ?? r.fileName ?? null })
      .eq('id', mensagemId);
  } catch (err) {
    console.error('mídia não baixada', waId, (err as Error).message);
    await db.from('mensagens').update({ erro: 'Não foi possível baixar a mídia' }).eq('id', mensagemId);
  }
}

async function mensagemNova(db: SupabaseClient, instancia: string, dados: Obj, tarefas: Promise<unknown>[]) {
  const key = (dados.key ?? {}) as Obj;
  const remoto = String(key.remoteJid ?? '');
  if (!remoto || remoto.endsWith('@g.us') || remoto.endsWith('@broadcast') || remoto.endsWith('@newsletter')) return { ignorado: 'grupo/status' };
  const c = conteudo(dados.message as Obj | undefined);
  if (!c) return { ignorado: 'tipo sem conteúdo' };
  const contato = await telefoneDoContato(db, instancia, key, dados);
  if (!contato) {
    console.warn('contato sem telefone (LID não mapeado)', instancia);
    return { ignorado: 'lid sem telefone' };
  }
  const fromMe = key.fromMe === true;
  const ts = Number(dados.messageTimestamp ?? 0);
  const { data, error } = await db.rpc('conv_registrar_mensagem', {
    p: {
      instancia, telefone: contato.telefone, jid: contato.jid, direcao: fromMe ? 'saida' : 'entrada',
      tipo: c.tipo, texto: c.texto, wa_id: key.id, nome_contato: fromMe ? null : dados.pushName,
      midia_mime: c.mime ?? null, midia_nome: c.nome ?? null, midia_bytes: c.bytes ?? null, duracao_s: c.duracao ?? null,
      quando: ts > 1_000_000_000 ? new Date(ts * 1000).toISOString() : null,
    },
  });
  if (error) throw error;
  const r = data as { conversa_id?: string; mensagem_id?: string; duplicada?: boolean; vinculada?: boolean };
  if (c.midia && r?.mensagem_id && !r.duplicada && !r.vinculada) {
    tarefas.push(baixarMidia(db, instancia, String(key.id), r.conversa_id!, r.mensagem_id, c));
  }
  return r;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return ok({ erro: 'Método não permitido' }, 405);
  const db = clienteServico();
  const esperado = await segredoWebhook(db).catch(() => null);
  if (!esperado || !igualSeguro(req.headers.get('x-webhook-secret'), esperado)) return ok({ erro: 'Não autorizado' }, 401);

  let corpo: Obj;
  try {
    const texto = await req.text();
    if (texto.length > 2_000_000) return ok({ erro: 'Muito grande' }, 413);
    corpo = JSON.parse(texto);
  } catch {
    return ok({ erro: 'JSON inválido' }, 400);
  }

  const instancia = corpo.instance as string;
  if (!instanciaValida(instancia)) return ok({ ignorado: 'instância de outro sistema' });
  const evento = String(corpo.event ?? '').toLowerCase().replace(/_/g, '.');
  const lista = (Array.isArray(corpo.data) ? corpo.data : [corpo.data]).filter(Boolean) as Obj[];
  const tarefas: Promise<unknown>[] = [];

  try {
    if (evento === 'messages.upsert') {
      const res = [];
      for (const d of lista) res.push(await mensagemNova(db, instancia, d, tarefas));
      if (tarefas.length) {
        const todas = Promise.allSettled(tarefas);
        // Responde já; a mídia termina de baixar em segundo plano
        const rt = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
        if (rt) rt.waitUntil(todas);
        else await todas;
      }
      return ok({ ok: true, res });
    }
    if (evento === 'messages.update') {
      for (const d of lista) {
        const waId = (d.keyId ?? (d.key as Obj | undefined)?.id ?? d.messageId) as string | undefined;
        const status = STATUS_WA[String(d.status ?? (d.update as Obj | undefined)?.status ?? '')];
        const fromMe = d.fromMe ?? (d.key as Obj | undefined)?.fromMe;
        if (waId && status && fromMe !== false) {
          const { error } = await db.rpc('conv_atualizar_status', { p_instancia: instancia, p_wa_id: waId, p_status: status });
          if (error) throw error;
        }
      }
      return ok();
    }
    if (evento === 'connection.update') {
      const d = lista[0] ?? {};
      const estado = String(d.state ?? d.status ?? '');
      const wuid = typeof d.wuid === 'string' ? d.wuid.split('@')[0].split(':')[0] : null;
      if (estado) {
        const { error } = await db.rpc('conv_numero_status', { p_instancia: instancia, p_status: estado, p_telefone: wuid });
        if (error) throw error;
      }
      return ok();
    }
    return ok({ ignorado: evento });
  } catch (err) {
    console.error('webhook conversas', evento, (err as Error).message);
    // 500 faz a Evolution tentar de novo; a gravação é idempotente (wa_id único por conversa)
    return ok({ erro: 'falha ao registrar' }, 500);
  }
});
