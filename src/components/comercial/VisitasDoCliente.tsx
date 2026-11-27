import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ClipboardList, Hourglass, MessageSquareQuote, UserRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusVisitaBadge } from '@/components/comercial/ui';
import { useEquipe } from '@/hooks/comercial/dados';
import { formatarData, formatarHora } from '@/lib/comercial/datas';
import { nomeCorretor } from '@/lib/comercial/nomes';
import { cn } from '@/lib/utils';

/** O que o corretor contou no app depois da visita (é a versão que vale: não há retorno do cliente a conferir). */
export const RESULTADO_VISITA: Record<string, { rotulo: string; tom: 'bom' | 'neutro' | 'ruim' }> = {
  vai_comprar: { rotulo: 'Gostou e quer comprar', tom: 'bom' },
  pensando: { rotulo: 'Gostou e está pensando', tom: 'neutro' },
  nao_gostou: { rotulo: 'Não gostou do imóvel', tom: 'ruim' },
  quer_outros: { rotulo: 'Quer ver outros imóveis', tom: 'neutro' },
};

type VisitaHistorico = {
  id: string; data_visita: string; horario_visita: string; status: string; customer_profile: string | null;
  resultado_cliente: string | null; feedback_corretor: string | null; proximo_passo: string | null; criado_por: string | null;
  empreendimentos: { nome: string } | null;
  corretores: { profiles: { first_name: string | null; last_name: string | null } | null } | null;
};

export function useVisitasDoCliente(leadId: string | null | undefined) {
  return useQuery({
    queryKey: ['comercial', 'visitas-do-cliente', leadId ?? ''],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase.from('visitas')
        .select('id, data_visita, horario_visita, status, customer_profile, resultado_cliente, feedback_corretor, proximo_passo, criado_por, empreendimentos(nome), corretores(profiles(first_name, last_name))')
        .eq('lead_id', leadId!).is('deleted_at', null)
        .order('data_visita', { ascending: false }).order('horario_visita', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as VisitaHistorico[];
    },
  });
}

/**
 * Histórico de visitas do cliente, igual em Leads, CRM e Agenda: o perfil que a SDR passou ao corretor,
 * como foi a visita (na palavra do corretor), o retorno dele e o próximo passo.
 */
export function VisitasDoCliente({ leadId, aoAbrir, destacar, className }: {
  leadId: string | null | undefined; aoAbrir?: (visitaId: string) => void; destacar?: string | null; className?: string;
}) {
  const { data: visitas = [], isLoading } = useVisitasDoCliente(leadId);
  const { data: equipe = [] } = useEquipe();
  const nomes = useMemo(() => new Map(equipe.map((u) => [u.user_id, u.nome])), [equipe]);
  if (!leadId) return null;

  return (
    <section className={cn('rounded-xl border bg-card p-4', className)} aria-label="Visitas do cliente">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <CalendarDays className="h-4 w-4 text-primary" aria-hidden /> Visitas do cliente
        {visitas.length > 0 && <span className="rounded-full bg-muted px-2 text-xs tabular-nums">{visitas.length}</span>}
      </h3>
      {isLoading ? <Skeleton className="h-24 w-full" /> : !visitas.length ? (
        <p className="text-sm text-muted-foreground">Nenhuma visita ainda.</p>
      ) : (
        <ol className="space-y-3">
          {visitas.map((v) => {
            const resultado = v.resultado_cliente ? RESULTADO_VISITA[v.resultado_cliente] : null;
            const passou = ['realizada', 'no_show'].includes(v.status);
            const semRetorno = (v.status === 'realizada' && !v.feedback_corretor) || (['agendada', 'confirmada'].includes(v.status)
              && new Date(`${v.data_visita}T${String(v.horario_visita).slice(0, 5)}:00-03:00`).getTime() + 60 * 60_000 < Date.now());
            const sdr = v.criado_por ? nomes.get(v.criado_por) : null;
            return (
              <li key={v.id} className={cn('rounded-lg border p-3', destacar === v.id && 'border-primary/50 bg-primary/[0.03]')}>
                <button type="button" disabled={!aoAbrir} onClick={() => aoAbrir?.(v.id)}
                  className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-left enabled:hover:text-primary">
                  <span className="text-sm font-semibold tabular-nums">{formatarData(v.data_visita)} {formatarHora(v.horario_visita)}</span>
                  <span className="min-w-0 truncate text-sm">· {v.empreendimentos?.nome ?? 'Empreendimento'}</span>
                  <span className="min-w-0 truncate text-xs text-muted-foreground">· {nomeCorretor(v.corretores) || 'sem corretor'}</span>
                  <StatusVisitaBadge status={v.status} className="ml-auto" />
                </button>

                {v.customer_profile && (
                  <div className="mt-2.5">
                    <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <UserRound className="h-3 w-3" aria-hidden /> Perfil passado ao corretor{sdr ? ` · ${sdr}` : ''}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm">{v.customer_profile}</p>
                  </div>
                )}

                {(resultado || v.status === 'no_show' || v.feedback_corretor) && (
                  <div className="mt-2.5">
                    <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <MessageSquareQuote className="h-3 w-3" aria-hidden /> Como foi, segundo o corretor
                    </p>
                    {(resultado || v.status === 'no_show') && (
                      <span className={cn('mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold',
                        v.status === 'no_show' || resultado?.tom === 'ruim' ? 'bg-rose-100 text-rose-700'
                          : resultado?.tom === 'bom' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800')}>
                        {v.status === 'no_show' ? 'Cliente não compareceu' : resultado?.rotulo}
                      </span>
                    )}
                    {v.feedback_corretor && <p className="mt-1 whitespace-pre-wrap text-sm">{v.feedback_corretor}</p>}
                  </div>
                )}

                {semRetorno && !v.feedback_corretor && (
                  <p className="mt-2.5 flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-800">
                    <Hourglass className="h-3.5 w-3.5" aria-hidden /> Aguardando o corretor contar como foi (o app dele pede o retorno).
                  </p>
                )}

                {v.proximo_passo && passou && (
                  <p className="mt-2.5 flex items-start gap-1.5 text-sm">
                    <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    <span><strong>Próximo passo:</strong> {v.proximo_passo}</span>
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
