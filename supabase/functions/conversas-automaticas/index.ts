// MeMude Conversas — mensagens automáticas da visita para o CLIENTE (agendamento, corretor definido, lembretes D-2/D-1/D0,
// visita realizada e não comparecimento). Programadas no banco (visita_mensagens_auto) a cada mudança da visita;
// o pg_cron chama esta função só quando há mensagem vencida. Uma por vez, com ritmo humano, pelo número da MeMude.
// Liga/desliga: fase1_config.mensagens_auto (desligado, nada sai).
import { autorizar, json, preflight, responderErro } from '../_shared/fase1-http.ts';
import { evo, evolution } from '../_shared/conversas.ts';

interface Item { id: string; mensagem_id: string; instancia: string; telefone: string; texto: string }

const atraso = (texto: string) => Math.min(3500, Math.max(900, 500 + texto.length * 25));

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const { servico: db } = await autorizar(req, 'interno');
    const { data, error } = await db.rpc('vma_reivindicar', { p_limite: 10 });
    if (error) throw error;
    const itens = (data ?? []) as Item[];
    if (!itens.length) return json(req, { ok: true, enviadas: 0 });
    const e = await evolution(db);
    let enviadas = 0;
    const falhas: string[] = [];
    for (const it of itens) {
      try {
        const r = await evo<{ key?: { id?: string } }>(e, `/message/sendText/${it.instancia}`, {
          body: { number: it.telefone.replace(/\D/g, ''), text: it.texto, delay: atraso(it.texto), linkPreview: true },
        });
        const waId = r?.key?.id;
        if (!waId) throw new Error('O WhatsApp não confirmou o envio');
        const { error: e2 } = await db.rpc('vma_resultado', { p_id: it.id, p_wa_id: waId, p_erro: null });
        if (e2) throw e2;
        enviadas += 1;
      } catch (err) {
        const msg = (err as Error).message ?? 'falha no envio';
        falhas.push(msg);
        await db.rpc('vma_resultado', { p_id: it.id, p_wa_id: null, p_erro: msg.slice(0, 300) });
      }
    }
    return json(req, { ok: true, enviadas, falhas: falhas.length });
  } catch (err) {
    return responderErro(req, err);
  }
});
