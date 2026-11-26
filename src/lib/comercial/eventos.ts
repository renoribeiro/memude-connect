import { ROTULO_STATUS_VISITA, ROTULO_TAREFA } from '@/lib/comercial/constantes';
import { formatarData, formatarDataHora } from '@/lib/comercial/datas';

/** Texto dos eventos de visita (painel da visita e histórico do card no CRM). */
const ROTULOS_BOT: Record<string, string> = {
  scheduled: 'Visita registrada (robô)', changed: 'Agendamento alterado (robô)', match_accepted: 'Corretor aceitou (robô)',
  cancelled: 'Cancelada (robô)', held: 'Realizada (robô)', not_held: 'Não realizada (robô)', prompt_sent: 'Mensagem automática enviada (robô)',
  match_consulting: 'Consulta a corretor (robô)', match_timeout: 'Consulta ao corretor sem resposta (robô)',
  match_exhausted: 'Nenhum corretor disponível (robô)', match_manual: 'Corretor indicado pelo closer', match_declined: 'Corretor recusou (robô)',
  attendance_overdue: 'Resultado da visita atrasado', confirmation_overdue: 'Confirmação atrasada',
};

export function descreverEvento(e: { kind: string; payload: unknown }): { titulo: string; detalhe?: string } {
  const p = (e.payload ?? {}) as Record<string, string | number | boolean | null>;
  switch (e.kind) {
    case 'f1_criada': return { titulo: p.reagendamento_de ? 'Nova visita (reagendamento)' : 'Visita criada', detalhe: `${formatarData(String(p.data))} às ${String(p.hora ?? '').slice(0, 5)}` };
    case 'f1_convite': return { titulo: `${p.automatico ? 'Chamado automático' : 'Convite enviado'} a ${p.corretor ?? 'corretor'}` };
    case 'f1_resposta_corretor': return { titulo: `${p.corretor ?? 'Corretor'} ${p.resposta === 'recusou' ? 'recusou' : p.via === 'prazo' ? 'não respondeu no prazo' : 'não respondeu (trocado)'}` };
    case 'f1_chamado_esgotado': return { titulo: 'Chamado automático encerrado', detalhe: `${p.convites ?? 0} convite(s) sem aceite · escolha o corretor manualmente` };
    case 'f1_status': return {
      titulo: `${ROTULO_STATUS_VISITA[String(p.de)] ?? p.de ?? '—'} → ${ROTULO_STATUS_VISITA[String(p.para)] ?? p.para}`,
      detalhe: [p.corretor && `Corretor: ${p.corretor}`, p.etapa && `Etapa ${p.etapa}`, p.observacao].filter(Boolean).join(' · ') || undefined,
    };
    case 'f1_confirmacao': return { titulo: `Confirmação ${p.etapa}: ${p.confirmou ? 'cliente confirmou' : 'sem confirmação'}`, detalhe: p.observacao ? String(p.observacao) : undefined };
    case 'f1_retorno': return {
      titulo: 'Retorno pós-visita registrado',
      detalhe: [p.nota && `Nota ${p.nota}/5`, p.impressao && `Cliente: ${p.impressao}`, p.feedback_corretor && `Corretor: ${p.feedback_corretor}`,
        p.proximo_passo && `Próximo passo: ${p.proximo_passo}${p.proximo_passo_em ? ` em ${formatarDataHora(String(p.proximo_passo_em))}` : ''}`]
        .filter(Boolean).join(' · ') || undefined,
    };
    case 'f1_tentativa_remarcar': return { titulo: `Tentativa de remarcar nº ${p.tentativa}`, detalhe: p.observacao ? String(p.observacao) : undefined };
    case 'f1_escalada': return { titulo: `Escalada para ${p.para_nome ?? 'o agendador'}`, detalhe: p.observacao ? String(p.observacao) : undefined };
    case 'f1_local_alterado': return { titulo: 'Local alterado', detalhe: [p.local, p.endereco, p.bairro].filter(Boolean).join(' · ') + (p.confirmacao_desfeita ? ' · confirmação desfeita' : '') };
    case 'f1_mensagem': return { titulo: `Mensagem ${String(p.template).toUpperCase()} ${p.acao === 'whatsapp' ? 'aberta no WhatsApp' : 'copiada'}`, detalhe: `Para: ${p.destino}` };
    case 'f1_tarefa_concluida': return { titulo: `Tarefa concluída: ${ROTULO_TAREFA[String(p.tipo)] ?? p.tipo}` };
    case 'f1_importada': return { titulo: `Importada da planilha (linha ${p.linha})`, detalhe: p.status_planilha ? `Status na planilha: ${p.status_planilha}` : undefined };
    default: return { titulo: ROTULOS_BOT[e.kind] ?? e.kind };
  }
}
