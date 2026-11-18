import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlarmClock, CalendarClock, CalendarDays, CheckCircle2, ChevronRight, ClipboardCheck, Flag, Handshake, MessageSquareReply, PhoneOff,
  ThumbsDown, ThumbsUp, UserPlus, Users,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useAcaoVisita, useEquipe, useTarefasPendentes, useVisitasDoDia } from '@/hooks/comercial/dados';
import { formatarDataHora, formatarHora, hojeISO, formatarDiaSemana, relativo } from '@/lib/comercial/datas';
import { VisitaPainel } from '@/components/comercial/VisitaPainel';
import { useAbrirVisita } from '@/hooks/comercial/useAbrirVisita';
import { EstadoVazio, StatusVisitaBadge } from '@/components/comercial/ui';
import { nomeCorretor } from '@/lib/comercial/nomes';

type Tarefa = NonNullable<ReturnType<typeof useTarefasPendentes>['data']>[number];

const BLOCOS: { chave: string; titulo: string; tipos: string[]; icone: typeof AlarmClock; ajuda: string }[] = [
  { chave: 'atividades', titulo: 'Atividades agendadas', tipos: ['atividade', 'manual'], icone: CalendarClock, ajuda: 'Próximos passos pós-visita e lembretes de retomada' },
  { chave: 'aceite', titulo: 'Aguardando aceite do corretor', tipos: ['aceite_corretor'], icone: Handshake, ajuda: 'Sem resposta em 15 min: troque de corretor' },
  { chave: 'conf', titulo: 'Confirmações D-2 e D-1 do dia', tipos: ['confirmacao_d2', 'confirmacao_d1'], icone: ClipboardCheck, ajuda: 'Envie o lembrete e registre a resposta' },
  { chave: 'd0', titulo: 'Confirmações D0 do dia', tipos: ['confirmacao_d0'], icone: ClipboardCheck, ajuda: 'Até 3h antes do horário' },
  { chave: 'resultado', titulo: 'Visitas sem resultado registrado', tipos: ['registrar_resultado'], icone: Flag, ajuda: 'Até 2h depois do horário' },
  { chave: 'retorno', titulo: 'Retornos pendentes', tipos: ['retorno', 'proximo_passo'], icone: MessageSquareReply, ajuda: 'Retorno em 24h e próximo passo em 48h' },
  { chave: 'noshow', titulo: 'No-shows a remarcar', tipos: ['remarcar_no_show'], icone: PhoneOff, ajuda: 'Remarque em até 24h' },
  { chave: 'escalada', titulo: 'Escaladas pelo closer', tipos: ['escalada'], icone: Flag, ajuda: 'No-shows que o closer não conseguiu remarcar' },
];

const vencida = (t: Tarefa) => new Date(t.vence_em).getTime() < Date.now();

function saudacao() {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export default function HojePage() {
  const { user, profile, isAdmin } = useAuth();
  const { data: tarefas = [], isLoading } = useTarefasPendentes();
  const { data: visitasHoje = [], isLoading: carregandoVisitas } = useVisitasDoDia();
  const { data: equipe = [] } = useEquipe();
  const abrir = useAbrirVisita();
  const nomes = useMemo(() => new Map(equipe.map((u) => [u.user_id, u.nome])), [equipe]);

  const minhas = tarefas.filter((t) => t.dono_id === user?.id);
  const daEquipeAtrasadas = isAdmin ? tarefas.filter((t) => t.dono_id !== user?.id && vencida(t)) : [];
  const totalVencidas = minhas.filter(vencida).length;
  const ordenar = (lista: Tarefa[]) => [...lista].sort((a, b) => Number(vencida(b)) - Number(vencida(a)) || a.vence_em.localeCompare(b.vence_em));

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground first-letter:uppercase">{formatarDiaSemana(hojeISO())}</p>
            <h1 className="text-2xl font-bold tracking-tight">{saudacao()}, {profile?.first_name}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              <Resumo valor={totalVencidas} rotulo={totalVencidas === 1 ? 'vencida' : 'vencidas'} tom={totalVencidas ? 'perigo' : 'neutro'} />
              <Resumo valor={minhas.length - totalVencidas} rotulo="para hoje" />
              <Resumo valor={visitasHoje.filter((v) => v.status !== 'cancelada' && v.status !== 'reagendada').length} rotulo="visitas hoje" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link to="/agenda"><CalendarDays /> Agenda</Link></Button>
            <Button asChild><Link to="/leads?novo=1"><UserPlus /> Lead</Link></Button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-4">
            {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
            {!isLoading && !minhas.length && !daEquipeAtrasadas.length && (
              <EstadoVazio icone={CheckCircle2} titulo="Tudo em dia" descricao="Nenhuma tarefa sua para hoje. As novas aparecem aqui automaticamente." />
            )}
            {!isLoading && BLOCOS.map((b) => {
              const lista = ordenar(minhas.filter((t) => b.tipos.includes(t.tipo)));
              if (!lista.length) return null;
              const atrasadas = lista.filter(vencida).length;
              return (
                <section key={b.chave} className={cn('overflow-hidden rounded-xl border bg-card shadow-sm', atrasadas && 'border-rose-200')}>
                  <header className="flex items-center gap-2 border-b px-4 py-3">
                    <b.icone className="h-4 w-4 text-primary" aria-hidden />
                    <h2 className="truncate text-sm font-semibold">{b.titulo}</h2>
                    <span className="shrink-0 rounded-full bg-muted px-2 text-xs font-semibold tabular-nums">{lista.length}</span>
                    {atrasadas > 0 && <span className="shrink-0 whitespace-nowrap rounded-full bg-rose-100 px-2 text-xs font-semibold text-rose-700">{atrasadas} vencida{atrasadas > 1 ? 's' : ''}</span>}
                    <span className="ml-auto hidden min-w-0 truncate text-xs text-muted-foreground md:inline">{b.ajuda}</span>
                  </header>
                  <ul className="divide-y">{lista.map((t) => <ItemTarefa key={t.id} t={t} onAbrir={abrir} />)}</ul>
                </section>
              );
            })}

            {isAdmin && daEquipeAtrasadas.length > 0 && (
              <section className="overflow-hidden rounded-xl border border-rose-200 bg-card shadow-sm">
                <header className="flex items-center gap-2 border-b bg-rose-50/60 px-4 py-3">
                  <Users className="h-4 w-4 text-rose-600" />
                  <h2 className="text-sm font-semibold">Atrasados da equipe</h2>
                  <span className="rounded-full bg-rose-100 px-2 text-xs font-semibold text-rose-700">{daEquipeAtrasadas.length}</span>
                </header>
                <ul className="divide-y">
                  {ordenar(daEquipeAtrasadas).map((t) => <ItemTarefa key={t.id} t={t} onAbrir={abrir} dono={nomes.get(t.dono_id ?? '') ?? 'Sem dono'} />)}
                </ul>
              </section>
            )}
          </div>

          <aside className="min-w-0 space-y-3">
            <section className="rounded-xl border bg-card shadow-sm">
              <header className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-sm font-semibold">Agenda de hoje</h2>
                <Link to="/agenda" className="text-xs font-medium text-primary hover:underline">Ver agenda</Link>
              </header>
              {carregandoVisitas ? <div className="space-y-2 p-4"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
                : !visitasHoje.length ? <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma visita hoje.</p>
                  : (
                    <ol className="divide-y">
                      {visitasHoje.map((v) => (
                        <li key={v.id}>
                          <button type="button" onClick={() => abrir(v.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/60">
                            <span className="w-11 shrink-0 pt-0.5 text-sm font-semibold tabular-nums">{formatarHora(v.horario_visita)}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{(v.leads as { nome: string } | null)?.nome}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {(v.empreendimentos as { nome: string } | null)?.nome} · {nomeCorretor(v.corretores as never) || 'sem corretor'}
                              </span>
                              <StatusVisitaBadge status={v.status} className="mt-1" />
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
            </section>
          </aside>
        </div>
      </div>
      <VisitaPainel />
    </DashboardLayout>
  );
}

function Resumo({ valor, rotulo, tom = 'neutro' }: { valor: number; rotulo: string; tom?: 'neutro' | 'perigo' }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ring-1 ring-inset',
      tom === 'perigo' ? 'bg-rose-50 text-rose-700 ring-rose-600/20' : 'bg-card text-foreground ring-slate-200')}>
      <span className="tabular-nums font-bold">{valor}</span> {rotulo}
    </span>
  );
}

function ItemTarefa({ t, onAbrir, dono }: { t: Tarefa; onAbrir: (id: string) => void; dono?: string }) {
  const acao = useAcaoVisita();
  const v = t.visitas as {
    id: string; data_visita: string; horario_visita: string; status: string; tentativas_remarcar: number;
    leads: { nome: string } | null; empreendimentos: { nome: string } | null;
    corretores: { profiles: { first_name: string | null; last_name: string | null } | null } | null;
  } | null;
  const atrasada = vencida(t);
  const executar = (rpc: string, args: Record<string, unknown>, sucesso: string) =>
    v && acao.mutate({ rpc, args: { p_visita_id: v.id, ...args }, sucesso });
  const etapa = t.tipo.startsWith('confirmacao_') ? t.tipo.replace('confirmacao_', '') : null;
  const navegar = useNavigate();
  const ehAtividade = t.tipo === 'atividade' || t.tipo === 'manual';
  const leadId = (t.leads as { id?: string } | null)?.id ?? t.lead_id;
  const abrirItem = () => { if (v) onAbrir(v.id); else if (leadId) navegar(`/leads/${leadId}`); };

  return (
    <li className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3', atrasada && 'bg-rose-50/70')}>
      <button type="button" onClick={abrirItem} className="flex min-w-[16rem] flex-1 items-start gap-3 text-left">
        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', atrasada ? 'bg-rose-500' : 'bg-amber-400')} aria-hidden />
        <span className="min-w-0">
          <span className="block truncate font-medium">{ehAtividade ? t.titulo : v?.leads?.nome ?? (t.leads as { nome: string } | null)?.nome ?? t.titulo}</span>
          <span className="block truncate text-sm text-muted-foreground">
            {ehAtividade && `${(t.leads as { nome: string } | null)?.nome ?? v?.leads?.nome ?? 'Cliente'} · ${formatarDataHora(t.disponivel_em)}`}
            {!ehAtividade && v && `${formatarDiaSemana(v.data_visita, 'short')} ${formatarHora(v.horario_visita)} · ${v.empreendimentos?.nome ?? '—'} · ${nomeCorretor(v.corretores) || 'sem corretor'}`}
            {t.tipo === 'remarcar_no_show' && v ? ` · ${v.tentativas_remarcar} tentativa(s)` : ''}
            {dono && ` · ${dono}`}
          </span>
          <span className={cn('mt-0.5 inline-flex items-center gap-1 text-xs', atrasada ? 'font-semibold text-rose-700' : 'text-muted-foreground')}>
            <AlarmClock className="h-3 w-3" /> {atrasada ? `Venceu ${relativo(t.vence_em)}` : `Vence ${relativo(t.vence_em)}`}
          </span>
        </span>
      </button>
      <div className="ml-auto flex shrink-0 flex-wrap gap-2">
        {t.tipo === 'aceite_corretor' && v?.status === 'aguardando_corretor' && (
          <>
            <Button size="sm" disabled={acao.isPending} onClick={() => executar('visita_resposta_corretor', { p_aceitou: true }, 'Corretor confirmado')}><ThumbsUp /> Sim</Button>
            <Button size="sm" variant="outline" disabled={acao.isPending} onClick={() => { executar('visita_resposta_corretor', { p_aceitou: false }, 'Recusa registrada'); if (v) onAbrir(v.id); }}><ThumbsDown /> Não</Button>
          </>
        )}
        {etapa && (
          <Button size="sm" disabled={acao.isPending} onClick={() => executar('visita_confirmar', { p_etapa: etapa, p_confirmou: true }, `Cliente confirmou (${etapa.toUpperCase()})`)}>
            <CheckCircle2 /> Confirmou
          </Button>
        )}
        {t.tipo === 'registrar_resultado' && (
          <>
            <Button size="sm" disabled={acao.isPending} onClick={() => executar('visita_registrar_resultado', { p_resultado: 'realizada' }, 'Visita realizada')}>Realizada</Button>
            <Button size="sm" variant="outline" disabled={acao.isPending} onClick={() => executar('visita_registrar_resultado', { p_resultado: 'no_show' }, 'No-show registrado')}>No-show</Button>
          </>
        )}
        {ehAtividade && (
          <Button size="sm" disabled={acao.isPending} onClick={() => acao.mutate({ rpc: 'tarefa_concluir', args: { p_tarefa_id: t.id, p_observacao: null }, sucesso: 'Atividade concluída' })}>
            <CheckCircle2 /> Feito
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={abrirItem} aria-label={v ? 'Abrir visita' : 'Abrir lead'}><ChevronRight /></Button>
      </div>
    </li>
  );
}
