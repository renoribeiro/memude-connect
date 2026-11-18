// API da extensão do WhatsApp Web: consulta por telefone e cadastro de lead no core.
// Autenticação: JWT do usuário do core (Authorization: Bearer <access_token>).
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { autorizar, ErroHttp, json, lerJson, preflight, responderErro } from '../_shared/fase1-http.ts';
import { telefoneCanonico } from '../_shared/fase1-phone.ts';

const APP_URL = (Deno.env.get('CORE_APP_URL') ?? 'https://core.memudecore.com.br').replace(/\/$/, '');
const FONTES = ['Google', 'Meta', 'Cadastro', 'Follow', 'Outros'];
const STATUS = ['NOVO', 'EM CONVERSA', 'INTERESSADO', 'VISITA AGENDADA', 'INVESTIDOR', 'CORRETOR', 'SEM RENDA', 'NÃO INTERESSADO'];

interface Lead { id: string; url?: string; [k: string]: unknown }

const comLink = (lead: Lead | null) => (lead ? { ...lead, url: `${APP_URL}/leads/${lead.id}` } : null);

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

Deno.serve(async (req) => {
  const opcoes = preflight(req);
  if (opcoes) return opcoes;
  try {
    const acesso = await autorizar(req, 'comercial');
    const db = acesso.usuario!;
    const url = new URL(req.url);

    if (req.method === 'GET' && url.searchParams.get('recurso') === 'opcoes') {
      const [emps, equipe, perfil] = await Promise.all([
        db.from('empreendimentos').select('id, nome').eq('ativo', true).order('nome').limit(1000),
        db.rpc('equipe_comercial'),
        db.from('profiles').select('first_name, last_name').eq('user_id', acesso.userId!).maybeSingle(),
      ]);
      if (emps.error) throw emps.error;
      if (equipe.error) throw equipe.error;
      return json(req, {
        usuario: { id: acesso.userId, nome: [perfil.data?.first_name, perfil.data?.last_name].filter(Boolean).join(' ') },
        empreendimentos: emps.data,
        fontes: FONTES,
        status: STATUS,
        responsaveis: (equipe.data ?? [])
          .filter((u: { responsavel: boolean }) => u.responsavel)
          .map((u: { user_id: string; nome: string }) => ({ id: u.user_id, nome: u.nome })),
      });
    }

    if (req.method === 'GET') {
      const bruto = url.searchParams.get('telefone') ?? '';
      if (!bruto.trim()) throw new ErroHttp(400, 'Informe o telefone');
      const telefone = await resolverTelefone(acesso.servico, bruto);
      const { data, error } = await db.rpc('lead_buscar_por_telefone', { p_telefone: telefone });
      if (error) throw error;
      return json(req, { ...data, lead: comLink(data.lead), telefone_canonico: telefoneCanonico(telefone) });
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
