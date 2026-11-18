// Relatórios automáticos (substitui os fluxos "Daily Report" e "Report Semanal" do n8n).
// Ações: enviar (cron/admin, idempotente por dia e canal) · previa · teste · diagnostico.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { autorizar, ErroHttp, json, lerJson, preflight, responderErro } from '../_shared/fase1-http.ts';
import { dadosDaPlanilha, dadosDoCore, diaISO } from './dados.ts';
import { boletimDiario, relatorioSemanal } from './modelos.ts';

type Acao = 'enviar' | 'previa' | 'teste' | 'diagnostico';
interface Corpo { relatorio?: string; acao?: Acao; canal?: 'email' | 'whatsapp' }
interface Config {
  id: 'diario' | 'semanal'; ativo: boolean; dias_semana: number[]; destinatarios: string[];
  enviar_email: boolean; enviar_whatsapp: boolean; whatsapp_destino: string | null; evolution_instance_id: string | null;
  meta_visitas_dia: number; fonte_dados: 'planilha' | 'core'; remetente: string;
}
type Relatorio = ReturnType<typeof boletimDiario> | ReturnType<typeof relatorioSemanal>;

const FUSO = 'America/Fortaleza';
const curto = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 500);

function diaDaSemana(): number {
  const nome = new Intl.DateTimeFormat('en-US', { timeZone: FUSO, weekday: 'short' }).format(new Date());
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(nome);
}

async function montar(db: SupabaseClient, cfg: Config): Promise<Relatorio & { fonte: string }> {
  let dados;
  if (cfg.fonte_dados === 'core') {
    dados = await dadosDoCore(db, diaISO(cfg.id === 'semanal' ? -6 : -1), diaISO(cfg.id === 'semanal' ? 0 : 7));
  } else {
    const { data, error } = await db.from('visit_automation_config').select('spreadsheet_id').eq('id', true).single();
    if (error || !data?.spreadsheet_id) throw new ErroHttp(400, 'Planilha não configurada');
    dados = await dadosDaPlanilha(data.spreadsheet_id);
  }
  const r = cfg.id === 'diario' ? boletimDiario(dados.leads, dados.visitas, cfg.meta_visitas_dia) : relatorioSemanal(dados.leads, dados.visitas);
  return { ...r, fonte: cfg.fonte_dados };
}

async function enviarEmail(cfg: Config, para: string[], assunto: string, html: string, chaveIdempotencia?: string) {
  const chave = Deno.env.get('RESEND_API_KEY');
  if (!chave) throw new Error('RESEND_API_KEY não configurada');
  const headers: Record<string, string> = { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' };
  if (chaveIdempotencia) headers['Idempotency-Key'] = chaveIdempotencia;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers, signal: AbortSignal.timeout(20000),
    body: JSON.stringify({ from: cfg.remetente, to: para, subject: assunto, html }),
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Resend ${r.status}: ${corpo?.message ?? 'falha no envio'}`);
  return corpo?.id as string | undefined;
}

async function instancia(db: SupabaseClient, id: string | null) {
  if (!id) throw new Error('Nenhuma instância da Evolution selecionada');
  const { data, error } = await db.from('evolution_instances').select('api_url, api_token, instance_name, is_active').eq('id', id).maybeSingle();
  if (error || !data) throw new Error('Instância da Evolution não encontrada');
  if (!data.is_active) throw new Error('Instância da Evolution desativada');
  return data as { api_url: string; api_token: string; instance_name: string };
}

async function enviarWhatsapp(db: SupabaseClient, cfg: Config, texto: string) {
  if (!cfg.whatsapp_destino) throw new Error('Destino do WhatsApp não configurado');
  const ev = await instancia(db, cfg.evolution_instance_id);
  const r = await fetch(`${ev.api_url.replace(/\/$/, '')}/message/sendText/${encodeURIComponent(ev.instance_name)}`, {
    method: 'POST', signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json', apikey: ev.api_token },
    body: JSON.stringify({ number: cfg.whatsapp_destino, text: texto }),
  });
  if (!r.ok) throw new Error(`Evolution ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

/** Reserva o envio (índice único) antes de disparar: evita duplicidade se o cron e o botão rodarem juntos. */
async function reservar(db: SupabaseClient, cfg: Config, ref: string, canal: string, destinatarios: string[], assunto: string, userId: string | null) {
  const { data, error } = await db.from('relatorios_envios').insert({
    relatorio: cfg.id, referencia: ref, canal, status: 'enviado', teste: false, destinatarios, assunto, criado_por: userId,
  }).select('id').single();
  if (error?.code === '23505') return null;
  if (error) throw error;
  return data.id as number;
}

async function registrar(db: SupabaseClient, linha: Record<string, unknown>) {
  const { error } = await db.from('relatorios_envios').insert(linha);
  if (error) console.error('Falha ao registrar envio:', error.message);
}

async function enviar(db: SupabaseClient, cfg: Config, userId: string | null) {
  const rel = await montar(db, cfg);
  const resultado: Record<string, string> = {};
  const canais: Array<['email' | 'whatsapp', boolean]> = [['email', cfg.enviar_email], ['whatsapp', cfg.enviar_whatsapp && !!rel.whatsapp]];
  for (const [canal, ligado] of canais) {
    if (!ligado) continue;
    const destinos = canal === 'email' ? cfg.destinatarios : [cfg.whatsapp_destino ?? ''];
    if (canal === 'email' && !destinos.length) { resultado[canal] = 'sem destinatários'; continue; }
    const id = await reservar(db, cfg, rel.referencia, canal, destinos, rel.assunto, userId);
    if (id === null) { resultado[canal] = 'já enviado hoje'; continue; }
    try {
      if (canal === 'email') await enviarEmail(cfg, destinos, rel.assunto, rel.html, `relatorio-${cfg.id}-${rel.referencia}-${id}`);
      else await enviarWhatsapp(db, cfg, rel.whatsapp!);
      resultado[canal] = 'enviado';
    } catch (e) {
      await db.from('relatorios_envios').update({ status: 'erro', erro: curto(e) }).eq('id', id);
      resultado[canal] = `erro: ${curto(e)}`;
    }
  }
  return { referencia: rel.referencia, resumo: rel.resumo, canais: resultado };
}

async function diagnostico(db: SupabaseClient) {
  const chave = Deno.env.get('RESEND_API_KEY');
  const out: Record<string, unknown> = { resend_configurado: !!chave };
  if (chave) {
    const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${chave}` }, signal: AbortSignal.timeout(10000) });
    const corpo = await r.json().catch(() => ({}));
    out.resend_dominios = r.ok
      ? (corpo?.data ?? []).map((d: { name: string; status: string }) => ({ dominio: d.name, status: d.status }))
      : { erro: corpo?.message ?? `HTTP ${r.status}`, observacao: 'Chave com permissão só de envio não lista domínios' };
  }
  const { data: cfgs } = await db.from('relatorios_automaticos').select('id, remetente, evolution_instance_id');
  out.remetentes = (cfgs ?? []).map((c) => ({ relatorio: c.id, remetente: c.remetente }));
  const evId = (cfgs ?? []).find((c) => c.evolution_instance_id)?.evolution_instance_id ?? null;
  try {
    const ev = await instancia(db, evId);
    const r = await fetch(`${ev.api_url.replace(/\/$/, '')}/instance/connectionState/${encodeURIComponent(ev.instance_name)}`, {
      headers: { apikey: ev.api_token }, signal: AbortSignal.timeout(10000),
    });
    const corpo = await r.json().catch(() => ({}));
    out.whatsapp = { instancia: ev.instance_name, estado: corpo?.instance?.state ?? corpo?.state ?? `HTTP ${r.status}` };
  } catch (e) {
    out.whatsapp = { estado: 'indisponivel', erro: curto(e) };
  }
  return out;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    if (req.method !== 'POST') throw new ErroHttp(405, 'Método não permitido');
    const corpo = await lerJson<Corpo>(req);
    const acao: Acao = corpo.acao ?? 'previa';
    if (!['enviar', 'previa', 'teste', 'diagnostico'].includes(acao)) throw new ErroHttp(400, 'Ação inválida');
    const acesso = await autorizar(req, acao === 'enviar' ? 'admin-ou-interno' : 'admin');
    const db = acesso.servico;

    if (acao === 'diagnostico') return json(req, await diagnostico(db));

    if (corpo.relatorio !== 'diario' && corpo.relatorio !== 'semanal') throw new ErroHttp(400, 'Relatório inválido');
    const { data: cfg, error } = await db.from('relatorios_automaticos').select('*').eq('id', corpo.relatorio).single();
    if (error || !cfg) throw new ErroHttp(404, 'Relatório não encontrado');
    const config = cfg as Config;

    if (acao === 'previa') {
      const rel = await montar(db, config);
      return json(req, { assunto: rel.assunto, html: rel.html, whatsapp: rel.whatsapp, resumo: rel.resumo, referencia: rel.referencia, fonte: rel.fonte });
    }

    if (acao === 'teste') {
      const rel = await montar(db, config);
      const canal = corpo.canal === 'whatsapp' ? 'whatsapp' : 'email';
      let destinos: string[] = [];
      try {
        if (canal === 'email') {
          const { data } = await db.auth.admin.getUserById(acesso.userId!);
          if (!data?.user?.email) throw new Error('Seu usuário não tem e-mail');
          destinos = [data.user.email];
          await enviarEmail(config, destinos, `[TESTE] ${rel.assunto}`, rel.html);
        } else {
          if (!rel.whatsapp) throw new Error('Este relatório não tem versão para WhatsApp');
          destinos = [config.whatsapp_destino ?? ''];
          await enviarWhatsapp(db, config, `🧪 *TESTE*\n\n${rel.whatsapp}`);
        }
        await registrar(db, { relatorio: config.id, referencia: rel.referencia, canal, status: 'enviado', teste: true, destinatarios: destinos, assunto: rel.assunto, criado_por: acesso.userId });
        return json(req, { ok: true, canal, destinatarios: destinos });
      } catch (e) {
        await registrar(db, { relatorio: config.id, referencia: rel.referencia, canal, status: 'erro', teste: true, destinatarios: destinos, assunto: rel.assunto, erro: curto(e), criado_por: acesso.userId });
        throw new ErroHttp(502, curto(e));
      }
    }

    // enviar: o cron só dispara nos dias configurados; a checagem abaixo protege contra cron desatualizado.
    if (acesso.interno) {
      if (!config.ativo) return json(req, { ignorado: 'relatório desativado' });
      if (!config.dias_semana.includes(diaDaSemana())) return json(req, { ignorado: 'fora dos dias configurados' });
    }
    return json(req, await enviar(db, config, acesso.userId));
  } catch (e) {
    return responderErro(req, e);
  }
});
