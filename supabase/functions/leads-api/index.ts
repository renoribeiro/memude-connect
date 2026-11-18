// API da extensão do WhatsApp Web (MeMude Connect).
// Autenticação: JWT do usuário do core (Authorization: Bearer <access_token>), só equipe comercial.
//
//   GET    ?recurso=opcoes                         empreendimentos, fontes, status, responsáveis, mensagens
//   GET    ?recurso=resumo                         números do dia do usuário
//   GET    ?telefone=...                           ficha do lead (com próxima e última visita)
//   GET    ?recurso=corretores&empreendimento_id&data&hora   corretores sugeridos
//   POST                                           cadastra lead
//   PATCH                                          atualiza status, qualificação, empreendimento ou anota
//   POST   ?recurso=visita                         agenda visita (o card do CRM anda sozinho)
//   POST   ?recurso=lembrete                       lembrete de retomada na tela Hoje
//   POST   ?recurso=sessao                         sessão própria da extensão a partir do login do site
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { autorizar, ErroHttp, json, lerJson, preflight, responderErro } from '../_shared/fase1-http.ts';
import { telefoneCanonico } from '../_shared/fase1-phone.ts';

const APP_URL = (Deno.env.get('CORE_APP_URL') ?? 'https://core.memudecore.com.br').replace(/\/$/, '');
const SITE_URL = 'https://memude.com.br';
const FONTES = ['Google', 'Meta', 'Cadastro', 'Follow', 'Outros'];
const STATUS = ['NOVO', 'EM CONVERSA', 'INTERESSADO', 'VISITA AGENDADA', 'INVESTIDOR', 'CORRETOR', 'SEM RENDA', 'NÃO INTERESSADO'];
const TIPOS_LOCAL = ['Stand de vendas', 'Decorado', 'Plantão no empreendimento', 'Escritório da construtora'];
const FUSO = 'America/Fortaleza';

interface Lead { id: string; url?: string; [k: string]: unknown }

const comLink = (lead: Lead | null) => (lead ? { ...lead, url: `${APP_URL}/leads/${lead.id}` } : null);
const hojeISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const inicioDoDia = (iso: string) => new Date(`${iso}T00:00:00-03:00`).toISOString();
const uuidOk = (v: unknown) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

// Números que chegam como LID do WhatsApp (ou JID) são resolvidos pelo mapa lid_phone_map.
async function resolverTelefone(servico: SupabaseClient, bruto: string): Promise<string> {
  const texto = String(bruto ?? '').trim();
  const semSufixo = texto.replace(/@(c\.us|s\.whatsapp\.net)$/i, '');
  const lid = texto.match(/^(\d{8,20})@lid$/i)?.[1] ?? (/^\d{14,20}$/.test(semSufixo) ? semSufixo : null);
  if (lid) {
    const { data } = await servico.from('lid_phone_map').select('phone').eq('lid', lid).maybeSingle();
    if (data?.phone) return String(data.phone);
    if (texto.endsWith('@lid')) throw new ErroHttp(422, 'Não foi possível identificar o telefone deste contato (LID). Informe o número manualmente.');
  }
  return semSufixo;
}

async function opcoes(db: SupabaseClient, userId: string) {
  const [emps, equipe, perfil, modelo] = await Promise.all([
    db.from('empreendimentos')
      .select('id, nome, endereco, valor_min, renda_sugerida, entrada_sugerida, wp_post_id, bairros(nome)')
      .eq('ativo', true).order('nome').limit(1000),
    db.rpc('equipe_comercial'),
    db.from('profiles').select('first_name, last_name').eq('user_id', userId).maybeSingle(),
    db.from('message_templates').select('content').eq('name', 'Visita · MSG 1 — cliente').eq('is_active', true).maybeSingle(),
  ]);
  if (emps.error) throw emps.error;
  if (equipe.error) throw equipe.error;
  return {
    usuario: { id: userId, nome: [perfil.data?.first_name, perfil.data?.last_name].filter(Boolean).join(' ') },
    empreendimentos: (emps.data ?? []).map((e) => ({
      id: e.id, nome: e.nome, endereco: e.endereco, bairro: (e.bairros as { nome?: string } | null)?.nome ?? null,
      valor_min: e.valor_min, renda_sugerida: e.renda_sugerida, entrada_sugerida: e.entrada_sugerida,
      link: e.wp_post_id ? `${SITE_URL}/?p=${e.wp_post_id}` : null,
    })),
    fontes: FONTES,
    status: STATUS,
    tipos_local: TIPOS_LOCAL,
    responsaveis: (equipe.data ?? [])
      .filter((u: { responsavel: boolean }) => u.responsavel)
      .map((u: { user_id: string; nome: string }) => ({ id: u.user_id, nome: u.nome })),
    mensagem_visita: modelo.data?.content ?? null,
  };
}

async function resumo(db: SupabaseClient, userId: string) {
  const hoje = hojeISO();
  const desde = inicioDoDia(hoje);
  const ate = new Date(new Date(desde).getTime() + 86_400_000).toISOString();
  // leads.created_by guarda o id do perfil (profiles.id), não o do usuário
  const { data: perfil } = await db.from('profiles').select('id').eq('user_id', userId).maybeSingle();
  const [leads, visitas, lembretes] = await Promise.all([
    db.from('leads').select('id', { count: 'exact', head: true }).is('deleted_at', null)
      .gte('created_at', desde).eq('created_by', perfil?.id ?? '00000000-0000-0000-0000-000000000000'),
    db.from('visitas').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('criado_por', userId).gte('created_at', desde),
    db.from('tarefas').select('id', { count: 'exact', head: true }).eq('dono_id', userId).eq('status', 'pendente').lt('disponivel_em', ate),
  ]);
  return { data: hoje, leads_hoje: leads.count ?? 0, visitas_agendadas_hoje: visitas.count ?? 0, tarefas_pendentes: lembretes.count ?? 0 };
}

async function contextoDoLead(db: SupabaseClient, leadId: string) {
  const { data } = await db.from('visitas')
    .select('id, data_visita, horario_visita, status, empreendimentos(nome), corretores(profiles(first_name, last_name))')
    .eq('lead_id', leadId).is('deleted_at', null).order('data_visita', { ascending: false }).order('horario_visita', { ascending: false }).limit(20);
  const visitas = (data ?? []).map((v) => {
    const c = v.corretores as { profiles?: { first_name?: string; last_name?: string } } | null;
    return {
      id: v.id, data: v.data_visita, hora: String(v.horario_visita ?? '').slice(0, 5), status: v.status,
      empreendimento: (v.empreendimentos as { nome?: string } | null)?.nome ?? null,
      corretor: [c?.profiles?.first_name, c?.profiles?.last_name].filter(Boolean).join(' ') || null,
    };
  });
  const hoje = hojeISO();
  const ativas = ['aguardando_corretor', 'agendada', 'confirmada'];
  return {
    total_visitas: visitas.length,
    proxima_visita: [...visitas].reverse().find((v) => v.data >= hoje && ativas.includes(v.status)) ?? null,
    ultima_visita: visitas.find((v) => v.data < hoje || !ativas.includes(v.status)) ?? null,
  };
}

Deno.serve(async (req) => {
  const opcoesReq = preflight(req);
  if (opcoesReq) return opcoesReq;
  try {
    const acesso = await autorizar(req, 'comercial');
    const db = acesso.usuario!;
    const userId = acesso.userId!;
    const url = new URL(req.url);
    const recurso = url.searchParams.get('recurso');

    if (req.method === 'GET') {
      if (recurso === 'opcoes') return json(req, await opcoes(db, userId));
      if (recurso === 'resumo') return json(req, await resumo(db, userId));
      if (recurso === 'corretores') {
        const emp = url.searchParams.get('empreendimento_id');
        const data = url.searchParams.get('data');
        const hora = url.searchParams.get('hora');
        if (!uuidOk(emp) || !/^\d{4}-\d{2}-\d{2}$/.test(data ?? '') || !/^\d{2}:\d{2}$/.test(hora ?? '')) {
          throw new ErroHttp(400, 'Informe empreendimento, data e horário');
        }
        const { data: lista, error } = await db.rpc('corretores_sugeridos', {
          p_empreendimento_id: emp, p_data: data, p_hora: hora, p_visita_id: null, p_excluir: [], p_limite: 8,
        });
        if (error) throw error;
        return json(req, { corretores: lista ?? [] });
      }
      const bruto = url.searchParams.get('telefone') ?? '';
      if (!bruto.trim()) throw new ErroHttp(400, 'Informe o telefone');
      const telefone = await resolverTelefone(acesso.servico, bruto);
      const { data, error } = await db.rpc('lead_buscar_por_telefone', { p_telefone: telefone });
      if (error) throw error;
      const contexto = data.lead ? await contextoDoLead(db, data.lead.id) : null;
      return json(req, { ...data, lead: comLink(data.lead), contexto, telefone_canonico: telefoneCanonico(telefone) });
    }

    // Login da extensão a partir do Connect já aberto no navegador: quem já está logado no site
    // recebe uma sessão própria para a extensão (sem senha). Só para o próprio usuário do token.
    if (req.method === 'POST' && recurso === 'sessao') {
      if (!acesso.email) throw new ErroHttp(422, 'Usuário sem e-mail');
      const { data, error } = await acesso.servico.auth.admin.generateLink({ type: 'magiclink', email: acesso.email });
      if (error || !data?.properties?.hashed_token) throw new ErroHttp(500, 'Não foi possível abrir a sessão da extensão');
      return json(req, { token_hash: data.properties.hashed_token, email: acesso.email });
    }

    if (req.method === 'POST' && recurso === 'visita') {
      const corpo = await lerJson<Record<string, unknown>>(req, 16 * 1024);
      if (!uuidOk(corpo.lead_id)) throw new ErroHttp(400, 'Lead inválido');
      const { data, error } = await db.rpc('visita_agendar', {
        p_dados: {
          lead_id: corpo.lead_id, data: corpo.data, hora: corpo.hora, empreendimento_id: corpo.empreendimento_id,
          local_nome: corpo.local_nome, endereco: corpo.endereco, bairro: corpo.bairro, corretor_id: corpo.corretor_id,
          perfil: corpo.perfil ?? null,
        },
      });
      if (error) throw error;
      return json(req, { visita: data }, 201);
    }

    if (req.method === 'POST' && recurso === 'lembrete') {
      const corpo = await lerJson<Record<string, unknown>>(req, 4 * 1024);
      if (!uuidOk(corpo.lead_id)) throw new ErroHttp(400, 'Lead inválido');
      const { data, error } = await db.rpc('lead_lembrete', {
        p_lead_id: corpo.lead_id, p_dias: Number(corpo.dias), p_observacao: (corpo.observacao as string) ?? null,
      });
      if (error) throw error;
      return json(req, { lembrete: data }, 201);
    }

    if (req.method === 'PATCH') {
      const corpo = await lerJson<Record<string, unknown>>(req, 16 * 1024);
      if (!uuidOk(corpo.lead_id)) throw new ErroHttp(400, 'Lead inválido');
      const campos: Record<string, unknown> = {};
      if (typeof corpo.status === 'string') {
        if (!STATUS.includes(corpo.status)) throw new ErroHttp(400, 'Status inválido');
        campos.status_atendimento = corpo.status;
      }
      if (corpo.empreendimento_id !== undefined) campos.empreendimento_id = corpo.empreendimento_id || null;
      if (corpo.qualificacao && typeof corpo.qualificacao === 'object') campos.qualificacao = corpo.qualificacao;
      if (typeof corpo.anotacao === 'string' && corpo.anotacao.trim()) {
        // Anotação nova entra no topo das observações, com data e autor
        const [{ data: lead }, { data: perfil }] = await Promise.all([
          db.from('leads').select('observacoes').eq('id', corpo.lead_id).maybeSingle(),
          db.from('profiles').select('first_name').eq('user_id', userId).maybeSingle(),
        ]);
        const quando = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date());
        const linha = `${quando} · ${perfil?.first_name ?? 'SDR'}: ${corpo.anotacao.trim().slice(0, 1000)}`;
        campos.observacoes = [linha, lead?.observacoes].filter(Boolean).join('\n').slice(0, 4000);
      }
      if (!Object.keys(campos).length) throw new ErroHttp(400, 'Nada para atualizar');
      const { data, error } = await db.rpc('lead_atualizar', { p_lead_id: corpo.lead_id, p_campos: campos });
      if (error) throw error;
      return json(req, { lead: comLink(data) });
    }

    if (req.method === 'POST') {
      const corpo = await lerJson<Record<string, unknown>>(req, 16 * 1024);
      const telefone = await resolverTelefone(acesso.servico, String(corpo.telefone ?? ''));
      let empreendimentoId = (corpo.empreendimento_id as string | undefined) || null;
      if (!empreendimentoId && typeof corpo.empreendimento === 'string' && corpo.empreendimento.trim()) {
        const { data } = await db.from('empreendimentos').select('id').ilike('nome', corpo.empreendimento.trim()).limit(2);
        if (data?.length === 1) empreendimentoId = data[0].id;
      }
      const { data, error } = await db.rpc('lead_criar', {
        p_dados: {
          nome: corpo.nome,
          telefone,
          empreendimento_id: empreendimentoId,
          fonte: corpo.fonte,
          status_atendimento: corpo.status ?? corpo.status_atendimento,
          responsavel_id: corpo.responsavel_id,
          observacoes: corpo.observacao ?? corpo.observacoes,
          origem: 'extensao_whatsapp',
        },
      });
      if (error) throw error;
      const resposta = { ...data, lead: comLink(data.lead) };
      return json(req, data.duplicado ? { ...resposta, aviso: 'Lead já cadastrado' } : resposta, data.duplicado ? 409 : 201);
    }

    throw new ErroHttp(405, 'Método não permitido');
  } catch (erro) {
    return responderErro(req, erro);
  }
});
