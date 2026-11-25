// MeMude Conversas — números de WhatsApp (instâncias "conversas-*" na Evolution). Só administradores.
// Nunca mexe em instâncias de outros sistemas (avisosmemude, memude-visitas…): toda ação parte de uma linha de conv_numeros.
//
//   POST { acao: 'criar', nome, papel }   cria a instância já com o webhook e devolve o QR code
//   POST { acao: 'qr', id }               novo QR code (ou "conectado")
//   POST { acao: 'estado', id }           consulta a conexão e o telefone
//   POST { acao: 'desconectar', id }      desconecta o aparelho (logout)
//   POST { acao: 'editar', id, nome?, papel?, ativo? }
//   POST { acao: 'webhook', id }          reaplica o webhook (caso alguém tenha alterado)
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { autorizar, ErroHttp, json, lerJson, preflight, responderErro } from '../_shared/fase1-http.ts';
import { aleatorioHex, configWebhook, evo, evolution, instanciaValida, segredo } from '../_shared/conversas.ts';

interface Pedido { acao?: string; id?: string; nome?: string; papel?: string; ativo?: boolean }
interface Numero { id: string; nome: string; instancia: string; status: string; papel: string; ativo: boolean; telefone: string | null }

const slug = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '').slice(0, 24) || 'numero';

async function numero(db: SupabaseClient, id?: string): Promise<Numero> {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new ErroHttp(400, 'Número inválido');
  const { data } = await db.from('conv_numeros').select('*').eq('id', id).maybeSingle();
  if (!data || !instanciaValida(data.instancia)) throw new ErroHttp(404, 'Número não encontrado');
  return data as Numero;
}

const segredoWebhook = (db: SupabaseClient) => segredo(db, 'conversas_webhook_secret', () => aleatorioHex(32)) as Promise<string>;

function qrDe(r: Record<string, unknown> | null) {
  const q = (r?.qrcode ?? r) as { base64?: string; pairingCode?: string; code?: string } | null;
  return q?.base64 ? { qr: q.base64, codigo_pareamento: q.pairingCode ?? null } : null;
}

async function estado(db: SupabaseClient, n: Numero) {
  const e = await evolution(db);
  const r = await evo<{ instance?: { state?: string } }>(e, `/instance/connectionState/${n.instancia}`).catch(() => null);
  const st = r?.instance?.state ?? 'close';
  let tel: string | null = null;
  if (st === 'open') {
    const lista = await evo<Array<{ ownerJid?: string; name?: string }>>(e, `/instance/fetchInstances?instanceName=${n.instancia}`).catch(() => []);
    tel = (Array.isArray(lista) ? lista[0]?.ownerJid : null)?.split('@')[0]?.split(':')[0] ?? null;
  }
  const { error } = await db.rpc('conv_numero_status', { p_instancia: n.instancia, p_status: st, p_telefone: tel });
  if (error) throw error;
  const { data } = await db.from('conv_numeros').select('*').eq('id', n.id).single();
  return { numero: data };
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    if (req.method !== 'POST') throw new ErroHttp(405, 'Método não permitido');
    const { servico: db, userId } = await autorizar(req, 'admin');
    const b = await lerJson<Pedido>(req, 8 * 1024);

    if (b.acao === 'criar') {
      const nome = String(b.nome ?? '').trim();
      if (nome.length < 2 || nome.length > 60) throw new ErroHttp(400, 'Dê um nome ao número (ex.: Atendimento principal)');
      const papel = b.papel === 'backup' ? 'backup' : 'principal';
      const instancia = `conversas-${slug(nome)}-${aleatorioHex(2)}`;
      const e = await evolution(db);
      const r = await evo<Record<string, unknown>>(e, '/instance/create', {
        body: {
          instanceName: instancia, integration: 'WHATSAPP-BAILEYS', qrcode: true,
          groupsIgnore: true, alwaysOnline: false, readMessages: false, readStatus: false, syncFullHistory: false, rejectCall: false,
          webhook: configWebhook(await segredoWebhook(db)),
        },
        timeoutMs: 40_000,
      });
      const { data, error } = await db.from('conv_numeros')
        .insert({ nome, instancia, papel, status: 'conectando', criado_por: userId }).select('*').single();
      if (error) throw error;
      return json(req, { numero: data, ...(qrDe(r) ?? {}) });
    }

    const n = await numero(db, b.id);

    if (b.acao === 'qr') {
      const e = await evolution(db);
      const r = await evo<Record<string, unknown>>(e, `/instance/connect/${n.instancia}`, { timeoutMs: 30_000 });
      const qr = qrDe(r);
      if (!qr) return json(req, await estado(db, n));
      await db.rpc('conv_numero_status', { p_instancia: n.instancia, p_status: 'connecting', p_telefone: null });
      return json(req, qr);
    }
    if (b.acao === 'estado') return json(req, await estado(db, n));
    if (b.acao === 'desconectar') {
      const e = await evolution(db);
      await evo(e, `/instance/logout/${n.instancia}`, { method: 'DELETE' }).catch(() => null);
      return json(req, await estado(db, n));
    }
    if (b.acao === 'webhook') {
      const e = await evolution(db);
      await evo(e, `/webhook/set/${n.instancia}`, { body: { webhook: configWebhook(await segredoWebhook(db)) } });
      return json(req, { ok: true });
    }
    if (b.acao === 'editar') {
      const campos: Record<string, unknown> = {};
      if (typeof b.nome === 'string') {
        const nome = b.nome.trim();
        if (nome.length < 2 || nome.length > 60) throw new ErroHttp(400, 'Nome entre 2 e 60 letras');
        campos.nome = nome;
      }
      if (b.papel === 'principal' || b.papel === 'backup') campos.papel = b.papel;
      if (typeof b.ativo === 'boolean') campos.ativo = b.ativo;
      const { data, error } = await db.from('conv_numeros').update(campos).eq('id', n.id).select('*').single();
      if (error) throw error;
      return json(req, { numero: data });
    }
    throw new ErroHttp(400, 'Ação inválida');
  } catch (err) {
    return responderErro(req, err);
  }
});
