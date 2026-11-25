import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlarmClock, CalendarDays, Check, ChevronRight, Clock, Loader2, MapPin, MessageCircle, MessageSquarePlus, PartyPopper } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Topo } from '@/components/app/Topo';
import { supabase } from '@/integrations/supabase/client';
import { cc, useIniciarConversa } from '@/hooks/conversas/dados';
import { useConvites } from '@/hooks/conversas/useConvites';
import { useAuth } from '@/hooks/useAuth';
import { mensagemErro } from '@/lib/conversas/servidor';
import { StatusVisitaBadge } from '@/components/comercial/ui';

const FUSO = 'America/Fortaleza';
const hojeISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date());
const diaRotulo = (iso: string) => {
  if (iso === hojeISO()) return 'Hoje';
  const amanha = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date(Date.now() + 86_400_000));
  if (iso === amanha) return 'Amanhã';
  const s = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }).format(new Date(`${iso}T12:00:00`));
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const horaDe = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

function saudacao(nome?: string) {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  return `${h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'}${nome ? `, ${nome}` : ''}`;
}

function FalhaCarregar({ aoTentar }: { aoTentar: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">
      <span className="flex-1">Não foi possível carregar. Confira a internet.</span>
      <button type="button" onClick={aoTentar} className="rounded-full bg-rose-600 px-3 py-1.5 font-medium text-white">Tentar de novo</button>
    </div>
  );
}

export default function AppHoje() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: atividades = [], isLoading: carregandoAtiv, isError: erroAtiv, refetch: recarregarAtiv } = useQuery({
    queryKey: cc.atividades,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('minhas_atividades');
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: visitas = [], isLoading: carregandoVis, isError: erroVis, refetch: recarregarVis } = useQuery({
    queryKey: ['conversas', 'minhas-visitas'],
    queryFn: async () => {
      const ate = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date(Date.now() + 7 * 86_400_000));
      const { data, error } = await supabase.from('visitas')
        .select('id, data_visita, horario_visita, status, local_nome, meeting_neighborhood, lead_id, leads(nome), empreendimentos(nome)')
        .is('deleted_at', null).gte('data_visita', hojeISO()).lte('data_visita', ate)
        .in('status', ['agendada', 'confirmada', 'aguardando_corretor']).order('data_visita').order('horario_visita');
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: conversaDoLead = {} } = useQuery({
    queryKey: ['conversas', 'por-lead', visitas.map((v) => v.lead_id).join(',')],
    enabled: visitas.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('conversas').select('id, lead_id').in('lead_id', visitas.map((v) => v.lead_id).filter(Boolean) as string[]);
      return Object.fromEntries((data ?? []).map((c) => [c.lead_id, c.id])) as Record<string, string>;
    },
  });

  const iniciar = useIniciarConversa();
  const { data: convites = [] } = useConvites(false); // mesmos dados do app (cache), sem outro canal
  const abrirOuIniciar = (leadId: string | null, conv: string | undefined) => {
    if (conv) { navigate(`/app/c/${conv}`); return; }
    if (!leadId) return;
    iniciar.mutate({ lead: leadId }, { onSuccess: (id) => navigate(`/app/c/${String(id)}`) });
  };
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

  const concluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('minha_atividade_concluir', { p_tarefa: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Atividade concluída'); qc.invalidateQueries({ queryKey: cc.atividades }); },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  const agora = Date.now();
  const atrasadas = atividades.filter((a) => new Date(a.vence_em).getTime() < agora).length;
  const dias = [...new Set(visitas.map((v) => v.data_visita))];

  return (
    <>
      <Topo titulo={saudacao(profile?.first_name)} subtitulo={`${plural(visitas.filter((v) => v.data_visita === hojeISO()).length, 'visita', 'visitas')} hoje · ${plural(atividades.length, 'atividade', 'atividades')}`} />
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-4">
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><AlarmClock className="h-4 w-4 text-primary" /> Atividades
            {atrasadas > 0 && <span className="rounded-full bg-rose-100 px-2 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-300">{plural(atrasadas, 'atrasada', 'atrasadas')}</span>}
          </h2>
          {carregandoAtiv ? <Skeleton className="h-16 w-full rounded-xl" /> : erroAtiv && !atividades.length ? (
            <FalhaCarregar aoTentar={() => recarregarAtiv()} />
          ) : !atividades.length ? (
            <p className="flex items-center gap-2 rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground"><PartyPopper className="h-4 w-4" /> Nada pendente. Bom trabalho!</p>
          ) : atividades.map((a) => {
            const atrasada = new Date(a.vence_em).getTime() < agora;
            return (
              <div key={a.id} className={cn('flex items-center gap-3 rounded-xl border bg-card p-3', atrasada && 'border-rose-200 dark:border-rose-900')}>
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-full" aria-label={`Concluir ${a.titulo}`}
                  disabled={concluir.isPending} onClick={() => concluir.mutate(a.id)}>
                  <Check className="h-4 w-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.titulo}</p>
                  <p className={cn('text-xs', atrasada ? 'font-medium text-rose-600' : 'text-muted-foreground')}>
                    {a.lead_nome && `${a.lead_nome} · `}{atrasada ? 'Atrasada · ' : ''}{diaRotulo(new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date(a.disponivel_em)))} {horaDe(a.disponivel_em)}
                  </p>
                </div>
                {a.conversa_id && (
                  <Button variant="ghost" size="icon" className="shrink-0" aria-label="Abrir conversa" onClick={() => navigate(`/app/c/${a.conversa_id}`)}>
                    <MessageCircle className="h-5 w-5 text-primary" />
                  </Button>
                )}
              </div>
            );
          })}
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-primary" /> Próximas visitas</h2>
          {carregandoVis ? <Skeleton className="h-20 w-full rounded-xl" /> : erroVis && !visitas.length ? (
            <FalhaCarregar aoTentar={() => recarregarVis()} />
          ) : !visitas.length ? (
            <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">Nenhuma visita nos próximos 7 dias.</p>
          ) : dias.map((d) => (
            <div key={d} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{diaRotulo(d)}</p>
              {visitas.filter((v) => v.data_visita === d).map((v) => {
                const conv = v.lead_id ? conversaDoLead[v.lead_id] : undefined;
                // Convite ainda sem resposta: a conversa só abre depois de aceitar (tela Cliente novo)
                // Convite ainda sem resposta e sem conversa: abre o convite (mesmo com prazo esgotado) em vez da conversa
                const pendente = v.status === 'aguardando_corretor' && !conv;
                const convite = pendente ? convites.find((x) => x.visita_id === v.id) : undefined;
                return (
                  <button key={v.id} type="button" disabled={(pendente && !convite) || !v.lead_id || iniciar.isPending}
                    onClick={() => (pendente ? convite && navigate(`/app?convite=${convite.convite_id}`) : abrirOuIniciar(v.lead_id, conv))}
                    aria-label={pendente ? `Responder convite de ${(v.leads as { nome?: string } | null)?.nome ?? 'cliente'}` : conv ? `Abrir conversa com ${(v.leads as { nome?: string } | null)?.nome ?? 'o cliente'}` : `Iniciar conversa com ${(v.leads as { nome?: string } | null)?.nome ?? 'o cliente'}`}
                    className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition enabled:active:scale-[0.99]">
                    <span className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-primary/10 py-1.5 text-primary">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="text-sm font-bold tabular-nums">{String(v.horario_visita).slice(0, 5)}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{(v.leads as { nome?: string } | null)?.nome ?? 'Cliente'}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {(v.empreendimentos as { nome?: string } | null)?.nome ?? 'Empreendimento'}
                        {(v.local_nome || v.meeting_neighborhood) && <><MapPin className="mx-1 inline h-3 w-3" />{v.local_nome ?? v.meeting_neighborhood}</>}
                      </span>
                      <StatusVisitaBadge status={v.status} className="mt-1" />
                    </span>
                    {pendente ? <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">{convite ? 'Responder convite' : 'Aceite pendente'}</span>
                      : conv ? <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                      : iniciar.isPending && iniciar.variables?.lead === v.lead_id ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                        : <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary"><MessageSquarePlus className="h-4 w-4" /> Conversar</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
