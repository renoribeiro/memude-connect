import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlarmClockPlus, Check, MessageCircle, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { BotaoTopo, Topo } from '@/components/app/Topo';
import { NovoLembrete } from '@/components/app/NovoLembrete';
import { Bloco, FalhaCarregar, Segmentado } from '@/components/app/ui';
import { ListaVisitas } from '@/components/app/ListaVisitas';
import { useAtividades, useConcluirAtividade, useMinhasVisitas } from '@/hooks/conversas/app';
import { diaRotulo, hojeISO, horaDe, isoDoInstante, plural } from '@/lib/conversas/agenda';

type Aba = 'hoje' | 'proximos';

/** Agenda do corretor: atividades e visitas de hoje, e as visitas dos próximos 7 dias. */
export default function AppAgenda() {
  const [lembrete, setLembrete] = useState(false);
  const navigate = useNavigate();
  const [aba, setAba] = useState<Aba>('hoje');
  const { data: atividades = [], isLoading: carregandoAtiv, isError: erroAtiv, refetch: recarregarAtiv } = useAtividades();
  const { data: visitas = [], isLoading: carregandoVis, isError: erroVis, refetch: recarregarVis } = useMinhasVisitas();
  const concluir = useConcluirAtividade();

  const agora = Date.now();
  const hoje = hojeISO();
  const visitasHoje = visitas.filter((v) => v.data_visita === hoje);
  const proximas = visitas.filter((v) => v.data_visita > hoje);
  // Aba Hoje: só o que já está liberado (as de dias seguintes aparecem quando chegar o dia)
  const deHoje = atividades.filter((a) => isoDoInstante(a.disponivel_em) <= hoje);
  const atrasadas = deHoje.filter((a) => new Date(a.vence_em).getTime() < agora).length;
  // Lembretes dos próximos dias (aparecem na aba Hoje quando chegar o dia)
  const lembretesFuturos = atividades.filter((a) => isoDoInstante(a.disponivel_em) > hoje);

  return (
    <>
      <NovoLembrete aberto={lembrete} aoFechar={() => setLembrete(false)} />
      <Topo titulo="Agenda" subtitulo={`${plural(visitasHoje.length, 'visita', 'visitas')} hoje · ${plural(deHoje.length, 'atividade', 'atividades')}`}
        direita={<BotaoTopo rotulo="Novo lembrete" aoTocar={() => setLembrete(true)} cheio><AlarmClockPlus className="h-5 w-5" /></BotaoTopo>}
        abaixo={(
          <Segmentado<Aba> rotulo="Período" valor={aba} aoMudar={setAba} opcoes={[
            { valor: 'hoje', rotulo: 'Hoje', contador: atrasadas },
            { valor: 'proximos', rotulo: 'Próximos dias', contador: proximas.length + lembretesFuturos.length },
          ]} />
        )} />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 pb-6 pt-2">
        {aba === 'hoje' ? (
          <>
            <Bloco titulo="Atividades" extra={atrasadas ? <span className="font-bold text-mm-rosa-texto">{plural(atrasadas, 'atrasada', 'atrasadas')}</span> : undefined} semPadding>
              {carregandoAtiv ? <div className="px-4 pb-4"><Skeleton className="h-14 w-full rounded-xl" /></div>
                : erroAtiv && !atividades.length ? <div className="px-4 pb-4"><FalhaCarregar aoTentar={() => recarregarAtiv()} /></div>
                  : !atividades.length ? (
                    <p className="flex items-center gap-2 px-4 pb-4 text-sm font-semibold text-mm-sucesso"><PartyPopper className="h-4 w-4" aria-hidden /> Nada pendente.</p>
                  ) : (
                    <ul className="divide-y divide-mm-borda-suave">
                      {deHoje.map((a) => {
                        const atrasada = new Date(a.vence_em).getTime() < agora;
                        const dia = isoDoInstante(a.disponivel_em);
                        return (
                          <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                            <button type="button" onClick={() => concluir.mutate(a.id)} disabled={concluir.isPending} aria-label={`Concluir ${a.titulo}`}
                              className="group flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-mm-campo transition hover:border-primary">
                              <Check className="h-3.5 w-3.5 text-primary opacity-0 transition group-hover:opacity-100" aria-hidden />
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-extrabold uppercase tracking-wide text-primary">
                                Atividade <span className={cn('normal-case tracking-normal', atrasada ? 'text-mm-rosa-texto' : 'font-semibold text-muted-foreground')}>
                                  {atrasada ? 'atrasada' : `${dia === hoje ? 'hoje' : diaRotulo(dia).toLowerCase()} ${horaDe(a.disponivel_em)}`}
                                </span>
                              </p>
                              <p className="truncate text-[15px] font-bold">{a.titulo}</p>
                              {a.lead_nome && <p className="truncate text-[13px] text-muted-foreground">{a.lead_nome}</p>}
                            </div>
                            {a.conversa_id && (
                              <button type="button" onClick={() => navigate(`/app/c/${a.conversa_id}`)} aria-label={`Abrir conversa de ${a.lead_nome ?? a.titulo}`}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-primary transition active:scale-95">
                                <MessageCircle className="h-5 w-5" aria-hidden />
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
            </Bloco>

            <section className="space-y-2">
              <h2 className="text-lg leading-tight">Visitas de hoje</h2>
              {carregandoVis ? <Skeleton className="h-20 w-full rounded-2xl" /> : erroVis && !visitas.length ? <FalhaCarregar aoTentar={() => recarregarVis()} />
                : !visitasHoje.length ? <p className="rounded-2xl bg-mm-lilas p-4 text-sm font-semibold text-primary">Nenhuma visita hoje.</p>
                  : <ListaVisitas visitas={visitasHoje} porDia={false} />}
            </section>
          </>
        ) : (
          <>
            {lembretesFuturos.length > 0 && (
              <Bloco titulo="Lembretes" extra={plural(lembretesFuturos.length, 'lembrete', 'lembretes')} semPadding>
                <ul className="divide-y divide-mm-borda-suave">
                  {lembretesFuturos.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-20 shrink-0 text-[12px] font-extrabold uppercase text-primary">{diaRotulo(isoDoInstante(a.disponivel_em))} {horaDe(a.disponivel_em)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold">{a.titulo}</span>
                        {a.lead_nome && <span className="block truncate text-[13px] text-muted-foreground">{a.lead_nome}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </Bloco>
            )}
            <section className="space-y-2">
              <h2 className="text-lg leading-tight">Visitas</h2>
              {carregandoVis ? <Skeleton className="h-40 w-full rounded-2xl" /> : erroVis && !visitas.length ? <FalhaCarregar aoTentar={() => recarregarVis()} />
                : !proximas.length ? <p className="rounded-2xl bg-mm-lilas p-4 text-sm font-semibold text-primary">Nenhuma visita nos próximos 7 dias.</p>
                  : <ListaVisitas visitas={proximas} porDia />}
            </section>
          </>
        )}
      </div>
    </>
  );
}
