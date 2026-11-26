import { useNavigate } from 'react-router-dom';
import { ChevronRight, Loader2, MapPin, MessageSquarePlus } from 'lucide-react';
import { StatusVisitaBadge } from '@/components/comercial/ui';
import { useIniciarConversa } from '@/hooks/conversas/dados';
import { useConvites } from '@/hooks/conversas/useConvites';
import { useConversaDoLead, type MinhaVisita } from '@/hooks/conversas/app';
import { diaCurto, diaRotulo, hojeISO } from '@/lib/conversas/agenda';

const nomeLead = (v: MinhaVisita) => (v.leads as { nome?: string } | null)?.nome ?? 'Cliente';

/** Visitas do corretor; agrupa por dia quando pedido. Tocar abre a conversa (ou o convite, se ainda não aceitou). */
export function ListaVisitas({ visitas, porDia }: { visitas: MinhaVisita[]; porDia?: boolean }) {
  const navigate = useNavigate();
  const iniciar = useIniciarConversa();
  const { data: convites = [] } = useConvites(false); // mesmos dados do app (cache), sem outro canal
  const { data: conversaDoLead = {} } = useConversaDoLead(visitas.map((v) => v.lead_id));

  const cartao = (v: MinhaVisita) => {
    const conv = v.lead_id ? conversaDoLead[v.lead_id] : undefined;
    // Convite ainda sem resposta: abre a tela Cliente novo (mesmo com prazo esgotado) em vez da conversa
    const convite = v.status === 'aguardando_corretor' ? convites.find((x) => x.visita_id === v.id) : undefined;
    const pendente = !!convite || (v.status === 'aguardando_corretor' && !conv);
    const nome = nomeLead(v);
    const abrir = () => {
      if (pendente) { if (convite) navigate({ search: `?convite=${convite.convite_id}` }); return; }
      if (conv) { navigate(`/app/c/${conv}`); return; }
      if (v.lead_id) iniciar.mutate({ lead: v.lead_id }, { onSuccess: (id) => navigate(`/app/c/${String(id)}`) });
    };
    const iniciando = iniciar.isPending && iniciar.variables?.lead === v.lead_id;
    return (
      <button key={v.id} type="button" disabled={(pendente && !convite) || !v.lead_id || iniciar.isPending} onClick={abrir}
        aria-label={pendente ? `Responder convite de ${nome}` : conv ? `Abrir conversa com ${nome}` : `Iniciar conversa com ${nome}`}
        className="flex w-full items-center gap-3 rounded-2xl border border-mm-borda-suave bg-card p-3 text-left transition enabled:active:scale-[0.99] disabled:opacity-70">
        <span className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-mm-lilas py-2 text-primary">
          <span className="text-base font-extrabold leading-none tabular-nums">{String(v.horario_visita).slice(0, 5)}</span>
          {!porDia && v.data_visita !== hojeISO() && <span className="mt-1 text-[10px] font-bold uppercase">{diaCurto(v.data_visita)}</span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold">{nome}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {(v.empreendimentos as { nome?: string } | null)?.nome ?? 'Empreendimento'}
            {(v.local_nome || v.meeting_neighborhood) && <><MapPin className="mx-1 inline h-3 w-3" aria-hidden />{v.local_nome ?? v.meeting_neighborhood}</>}
          </span>
          <StatusVisitaBadge status={v.status} className="mt-1" />
        </span>
        {pendente ? <span className="shrink-0 rounded-full bg-mm-acao px-2.5 py-1 text-[11px] font-extrabold text-white">{convite ? 'Responder' : 'Aceite pendente'}</span>
          : conv ? <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            : iniciando ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
              : <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-mm-acao"><MessageSquarePlus className="h-4 w-4" aria-hidden /> Conversar</span>}
      </button>
    );
  };

  if (!porDia) return <div className="space-y-2">{visitas.map(cartao)}</div>;
  const dias = [...new Set(visitas.map((v) => v.data_visita))];
  return (
    <div className="space-y-4">
      {dias.map((d) => (
        <div key={d} className="space-y-2">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">{diaRotulo(d)}</p>
          {visitas.filter((v) => v.data_visita === d).map(cartao)}
        </div>
      ))}
    </div>
  );
}
