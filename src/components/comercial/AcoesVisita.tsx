import { useEffect, useState } from 'react';
import {
  AlarmClock, ArrowRight, CalendarClock, Check, CheckCircle2, Flag, Loader2, PhoneOff, RefreshCw, Star, ThumbsDown, ThumbsUp,
  UserRoundCheck, UserRoundX, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAcaoVisita, useConfigComercial } from '@/hooks/comercial/dados';
import { MOTIVOS_CANCELAMENTO, ROTULO_TAREFA } from '@/lib/comercial/constantes';
import { formatarData, formatarDataHora, hojeISO, inicioVisita, relativo } from '@/lib/comercial/datas';
import { SeletorCorretor, type CorretorEscolhido } from './SeletorCorretor';

type Visita = {
  id: string; status: string; data_visita: string; horario_visita: string; empreendimento_id: string | null;
  corretor_id: string | null; avaliacao_lead: number | null; comentarios_lead: string | null; feedback_corretor: string | null;
  proximo_passo: string | null; data_venda: string | null; tentativas_remarcar: number; ultima_tentativa_remarcar: string | null;
  no_show_em: string | null; escalada_em: string | null; motivo_cancelamento: string | null; updated_at: string | null;
};
type Convite = { id: string; corretor_id: string; enviado_em: string; resposta: string | null; corretores?: { profiles?: { first_name?: string | null; last_name?: string | null } | null } | null };
type Tarefa = {
  id: string; tipo: string; status: string; vence_em: string; disponivel_em: string; concluida_em: string | null;
  observacao: string | null; titulo?: string | null;
};

// Atividades mais comuns depois da visita (um clique preenche o próximo passo)
const ATIVIDADES_SUGERIDAS = ['Ligar para o cliente', 'Enviar simulação', 'Enviar proposta', 'Mandar mensagem no WhatsApp', 'Agendar nova visita', 'Cobrar documentação'];

const nome = (c?: Convite | null) => [c?.corretores?.profiles?.first_name, c?.corretores?.profiles?.last_name].filter(Boolean).join(' ') || 'corretor';

function Cartao({ tom = 'neutro', icone: Icone, titulo, children }: {
  tom?: 'neutro' | 'alerta' | 'sucesso' | 'perigo'; icone: typeof Check; titulo: string; children?: React.ReactNode;
}) {
  const tons = {
    neutro: 'border-border bg-card',
    alerta: 'border-amber-300 bg-amber-50/70',
    sucesso: 'border-emerald-200 bg-emerald-50/60',
    perigo: 'border-rose-300 bg-rose-50/70',
  };
  return (
    <section className={cn('rounded-xl border p-4', tons[tom])}>
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Icone className="h-4 w-4" />{titulo}</h3>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function AcoesVisita({ visita, convites, tarefas, onMensagens }: {
  visita: Visita; convites: Convite[]; tarefas: Tarefa[]; onMensagens: () => void;
}) {
  const acao = useAcaoVisita();
  const { data: cfg } = useConfigComercial();
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 30_000); return () => clearInterval(t); }, []);

  const executar = (rpc: string, args: Record<string, unknown>, sucesso: string, abrirMensagens = false) =>
    acao.mutate({ rpc, args: { p_visita_id: visita.id, ...args }, sucesso }, { onSuccess: () => abrirMensagens && onMensagens() });

  const inicio = inicioVisita(visita.data_visita, visita.horario_visita);
  const pendente = convites.find((c) => !c.resposta) ?? null;
  const ocupado = acao.isPending;

  if (visita.status === 'aguardando_corretor') {
    if (pendente) {
      const minutos = Math.floor((agora - new Date(pendente.enviado_em).getTime()) / 60000);
      const atrasado = minutos >= (cfg?.prazo_aceite_min ?? 15);
      return (
        <Cartao tom={atrasado ? 'perigo' : 'alerta'} icone={AlarmClock} titulo="Corretor aceitou?">
          <p className="text-sm">
            Convite para <strong>{nome(pendente)}</strong> enviado {relativo(pendente.enviado_em, new Date(agora))}.
            {atrasado && <span className="mt-1 block font-semibold text-rose-700">Sem resposta há {minutos} min: troque de corretor.</span>}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={ocupado} onClick={() => executar('visita_resposta_corretor', { p_aceitou: true }, 'Corretor confirmado · visita agendada', true)}>
              <ThumbsUp /> SIM, aceitou
            </Button>
            <Button variant="outline" disabled={ocupado} className="border-rose-300 text-rose-700 hover:bg-rose-50"
              onClick={() => executar('visita_resposta_corretor', { p_aceitou: false }, 'Recusa registrada · escolha o próximo corretor')}>
              <ThumbsDown /> NÃO, recusou
            </Button>
          </div>
          <TrocarCorretor visita={visita} titulo={atrasado ? 'Escolher outro corretor' : 'Trocar de corretor'} />
        </Cartao>
      );
    }
    return (
      <Cartao tom="alerta" icone={UserRoundX} titulo="Escolha o próximo corretor">
        <p className="text-sm text-muted-foreground">Os próximos do rating, sem os que já foram convidados.</p>
        <EscolherEConvidar visita={visita} />
      </Cartao>
    );
  }

  if (visita.status === 'agendada' || visita.status === 'confirmada') {
    const confirmacoes = tarefas.filter((t) => t.tipo.startsWith('confirmacao_'));
    const podeResultado = agora >= inicio.getTime() - 30 * 60000;
    return (
      <div className="space-y-3">
        <Cartao icone={UserRoundCheck} titulo="Confirmações com o cliente">
          {!confirmacoes.length && <p className="text-sm text-muted-foreground">Sem confirmações para esta visita.</p>}
          <ul className="space-y-2">
            {confirmacoes.map((t) => {
              const etapa = t.tipo.replace('confirmacao_', '');
              const liberada = new Date(t.disponivel_em).getTime() <= agora;
              const vencida = t.status === 'pendente' && new Date(t.vence_em).getTime() < agora;
              return (
                <li key={t.id} className={cn('flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2', vencida && 'border-rose-300 bg-rose-50')}>
                  <span className="text-sm font-medium">{ROTULO_TAREFA[t.tipo]}</span>
                  <span className={cn('text-xs', vencida ? 'font-semibold text-rose-700' : 'text-muted-foreground')}>
                    {t.status === 'pendente' ? (liberada ? `até ${formatarDataHora(t.vence_em)}` : `a partir de ${formatarData(t.disponivel_em.slice(0, 10))}`) : t.observacao ?? 'Concluída'}
                  </span>
                  <span className="ml-auto flex gap-1.5">
                    {t.status === 'pendente' ? (
                      <>
                        <Button size="sm" disabled={ocupado || !liberada}
                          onClick={() => executar('visita_confirmar', { p_etapa: etapa, p_confirmou: true }, `Cliente confirmou (${etapa.toUpperCase()})`)}>
                          <Check /> Confirmou
                        </Button>
                        <Button size="sm" variant="outline" disabled={ocupado || !liberada}
                          onClick={() => executar('visita_confirmar', { p_etapa: etapa, p_confirmou: false }, 'Registrado: cliente não confirmou')}>
                          Sem resposta
                        </Button>
                      </>
                    ) : <CheckCircle2 className="h-4 w-4 text-primary" aria-label="Concluída" />}
                  </span>
                </li>
              );
            })}
          </ul>
        </Cartao>
        <Cartao icone={Flag} titulo="A visita aconteceu?">
          {podeResultado ? (
            <div className="grid grid-cols-2 gap-2">
              <Button disabled={ocupado} onClick={() => executar('visita_registrar_resultado', { p_resultado: 'realizada' }, 'Visita realizada · mensagens liberadas', true)}>
                <CheckCircle2 /> Realizada
              </Button>
              <Button variant="outline" disabled={ocupado} className="border-rose-300 text-rose-700 hover:bg-rose-50"
                onClick={() => executar('visita_registrar_resultado', { p_resultado: 'no_show' }, 'No-show registrado · remarque em até 24h', true)}>
                <PhoneOff /> No-show
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Disponível a partir de {formatarDataHora(new Date(inicio.getTime() - 30 * 60000).toISOString())}.</p>
          )}
        </Cartao>
      </div>
    );
  }

  if (visita.status === 'realizada') return <RetornoPosVisita visita={visita} tarefas={tarefas} />;

  if (visita.status === 'no_show') {
    const pode = !visita.escalada_em && (
      visita.tentativas_remarcar >= (cfg?.escalar_tentativas ?? 2)
      || agora >= new Date(visita.no_show_em ?? visita.updated_at ?? agora).getTime() + (cfg?.escalar_horas ?? 72) * 3600000);
    return <NoShow visita={visita} podeEscalar={pode} />;
  }

  if (visita.status === 'cancelada') {
    return <Cartao tom="neutro" icone={XCircle} titulo="Visita cancelada"><p className="text-sm">Motivo: {visita.motivo_cancelamento ?? '—'}</p></Cartao>;
  }
  return null;
}

function TrocarCorretor({ visita, titulo }: { visita: Visita; titulo: string }) {
  const [aberto, setAberto] = useState(false);
  if (!aberto) return <Button variant="ghost" size="sm" className="w-full" onClick={() => setAberto(true)}><RefreshCw /> {titulo}</Button>;
  return <EscolherEConvidar visita={visita} onFeito={() => setAberto(false)} />;
}

function EscolherEConvidar({ visita, onFeito }: { visita: Visita; onFeito?: () => void }) {
  const acao = useAcaoVisita();
  const [escolhido, setEscolhido] = useState<CorretorEscolhido | null>(null);
  return (
    <div className="space-y-2">
      <SeletorCorretor empreendimentoId={visita.empreendimento_id} data={visita.data_visita} hora={visita.horario_visita.slice(0, 5)}
        visitaId={visita.id} valor={escolhido?.id ?? null} onChange={setEscolhido} />
      <Button className="w-full" disabled={!escolhido || acao.isPending}
        onClick={() => acao.mutate({
          rpc: 'visita_convidar_corretor',
          args: { p_visita_id: visita.id, p_corretor_id: escolhido!.id, p_score: escolhido!.score, p_motivo: escolhido!.motivo },
          sucesso: `Convite registrado para ${escolhido!.nome} · envie a MSG 2A`,
        }, { onSuccess: onFeito })}>
        {acao.isPending ? <Loader2 className="animate-spin" /> : <ArrowRight />} Convidar {escolhido?.nome.split(' ')[0] ?? 'corretor'}
      </Button>
    </div>
  );
}

function Estrelas({ valor, onChange }: { valor: number | null; onChange: (n: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Nota do cliente" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={valor === n} aria-label={`${n} de 5`} onClick={() => onChange(n)}
          className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Star className={cn('h-6 w-6', valor !== null && n <= valor ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/70')} />
        </button>
      ))}
    </div>
  );
}

function RetornoPosVisita({ visita, tarefas }: { visita: Visita; tarefas: Tarefa[] }) {
  const acao = useAcaoVisita();
  const [nota, setNota] = useState<number | null>(visita.avaliacao_lead);
  const [impressao, setImpressao] = useState(visita.comentarios_lead ?? '');
  const [feedback, setFeedback] = useState(visita.feedback_corretor ?? '');
  const [atividade, setAtividade] = useState('');
  const [dataPasso, setDataPasso] = useState('');
  const [horaPasso, setHoraPasso] = useState('');
  const pendRetorno = tarefas.find((t) => t.tipo === 'retorno' && t.status === 'pendente');
  const pendProximo = tarefas.find((t) => t.tipo === 'proximo_passo' && t.status === 'pendente');
  const atividades = tarefas.filter((t) => t.tipo === 'atividade' && t.status !== 'cancelada')
    .sort((a, b) => b.disponivel_em.localeCompare(a.disponivel_em));
  const temAtividade = atividades.length > 0;

  // Próximo passo = atividade com data e horário (vai para a Agenda). Obrigatório se ainda não houver uma.
  const preencheuPasso = !!(atividade.trim() || dataPasso || horaPasso);
  const quando = dataPasso && horaPasso ? new Date(`${dataPasso}T${horaPasso}:00-03:00`) : null;
  const passoValido = !!(atividade.trim().length >= 3 && quando && quando.getTime() > Date.now() - 5 * 60000);
  const precisaPasso = !temAtividade || preencheuPasso;
  const mudouRetorno = nota !== visita.avaliacao_lead || impressao !== (visita.comentarios_lead ?? '') || feedback !== (visita.feedback_corretor ?? '');
  const podeSalvar = (precisaPasso ? passoValido : mudouRetorno) && !acao.isPending;
  const aviso = precisaPasso && !passoValido
    ? (!atividade.trim() ? 'Descreva a atividade do próximo passo.' : !dataPasso || !horaPasso ? 'Escolha a data e o horário da atividade.' : 'Escolha uma data e horário no futuro.')
    : null;

  return (
    <Cartao tom={pendRetorno || pendProximo ? 'alerta' : 'sucesso'} icone={CheckCircle2} titulo="Retorno pós-visita">
      <div className="flex flex-wrap gap-2 text-xs">
        <Pendencia ok={!pendRetorno} rotulo="Retorno do corretor e do cliente" prazo={pendRetorno?.vence_em} />
        <Pendencia ok={!pendProximo} rotulo="Próximo passo" prazo={pendProximo?.vence_em} />
      </div>
      <div className="grid gap-1.5"><Label>Nota do cliente</Label><Estrelas valor={nota} onChange={setNota} /></div>
      <div className="grid gap-1.5"><Label htmlFor="rv-imp">Impressão do cliente</Label>
        <Textarea id="rv-imp" rows={2} maxLength={4000} value={impressao} onChange={(e) => setImpressao(e.target.value)} placeholder="O que o cliente achou do empreendimento e do atendimento" /></div>
      <div className="grid gap-1.5"><Label htmlFor="rv-fb">Retorno do corretor</Label>
        <Textarea id="rv-fb" rows={2} maxLength={4000} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Interesse, objeções, condições" /></div>

      <fieldset className="space-y-2.5 rounded-lg border border-primary/25 bg-primary/[0.03] p-3">
        <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold">
          <CalendarClock className="h-4 w-4 text-primary" /> Próximo passo {!temAtividade && <span className="text-xs font-normal text-rose-600">(obrigatório)</span>}
        </legend>
        {temAtividade && (
          <ul className="space-y-1.5">
            {atividades.map((t) => (
              <li key={t.id} className="flex items-center gap-2 rounded-md bg-card px-2.5 py-1.5 text-sm ring-1 ring-border">
                {t.status === 'concluida' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlarmClock className="h-4 w-4 shrink-0 text-primary" />}
                <span className={cn('min-w-0 flex-1 truncate font-medium', t.status === 'concluida' && 'text-muted-foreground line-through')}>{t.titulo ?? 'Atividade'}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatarDataHora(t.disponivel_em)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          {temAtividade ? 'Para agendar outra atividade, preencha abaixo.' : 'Toda visita realizada termina com uma atividade agendada. Ela entra na Agenda e na tela Hoje.'}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ATIVIDADES_SUGERIDAS.map((a) => (
            <button key={a} type="button" onClick={() => setAtividade(a)}
              className={cn('rounded-full border px-2.5 py-1 text-xs', atividade === a ? 'border-primary bg-primary/10 font-medium text-primary' : 'bg-card hover:bg-muted')}>{a}</button>
          ))}
        </div>
        <div className="grid gap-1.5"><Label htmlFor="rv-px">Atividade</Label>
          <Input id="rv-px" maxLength={200} value={atividade} onChange={(e) => setAtividade(e.target.value)} placeholder="Ex.: Ligar para o cliente" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5"><Label htmlFor="rv-pd">Data</Label>
            <Input id="rv-pd" type="date" min={hojeISO()} value={dataPasso} onChange={(e) => setDataPasso(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor="rv-ph">Horário</Label>
            <Input id="rv-ph" type="time" step={900} value={horaPasso} onChange={(e) => setHoraPasso(e.target.value)} /></div>
        </div>
        {aviso && preencheuPasso && <p className="text-xs font-medium text-rose-600">{aviso}</p>}
      </fieldset>

      <Button disabled={!podeSalvar} title={aviso ?? undefined} onClick={() => acao.mutate({
        rpc: 'visita_registrar_retorno',
        args: {
          p_visita_id: visita.id,
          p_dados: {
            nota, impressao, feedback_corretor: feedback,
            ...(passoValido && quando ? { proximo_passo: atividade.trim(), proximo_passo_em: quando.toISOString() } : {}),
          },
        },
        sucesso: passoValido ? 'Retorno salvo · próximo passo na agenda' : 'Retorno salvo',
      }, { onSuccess: () => { setAtividade(''); setDataPasso(''); setHoraPasso(''); } })}>
        {acao.isPending && <Loader2 className="animate-spin" />} Salvar retorno
      </Button>
      {!temAtividade && !preencheuPasso && <p className="-mt-1 text-center text-xs text-muted-foreground">Agende o próximo passo para salvar.</p>}
    </Cartao>
  );
}

function Pendencia({ ok, rotulo, prazo }: { ok: boolean; rotulo: string; prazo?: string }) {
  const vencida = !ok && prazo && new Date(prazo).getTime() < Date.now();
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ring-1 ring-inset',
      ok ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : vencida ? 'bg-rose-50 text-rose-700 ring-rose-600/20' : 'bg-amber-50 text-amber-800 ring-amber-600/20')}>
      {ok ? <Check className="h-3 w-3" /> : <AlarmClock className="h-3 w-3" />}
      {rotulo}{!ok && prazo ? ` · até ${formatarDataHora(prazo)}` : ''}
    </span>
  );
}

function NoShow({ visita, podeEscalar }: { visita: Visita; podeEscalar: boolean }) {
  const acao = useAcaoVisita();
  const [obs, setObs] = useState('');
  return (
    <Cartao tom="perigo" icone={PhoneOff} titulo="No-show: remarcar com o cliente e o corretor">
      <p className="text-sm">
        {visita.tentativas_remarcar} {visita.tentativas_remarcar === 1 ? 'tentativa' : 'tentativas'} de remarcar
        {visita.ultima_tentativa_remarcar && ` · última ${relativo(visita.ultima_tentativa_remarcar)}`}
      </p>
      {visita.escalada_em ? (
        <p className="rounded-md bg-card/70 px-3 py-2 text-sm font-medium text-rose-800">Escalada para o Ramon {relativo(visita.escalada_em)}.</p>
      ) : (
        <>
          <div className="flex gap-2">
            <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Como foi a tentativa? (opcional)" maxLength={1000} />
            <Button variant="outline" disabled={acao.isPending} onClick={() => acao.mutate({
              rpc: 'visita_tentativa_remarcar', args: { p_visita_id: visita.id, p_observacao: obs || null }, sucesso: 'Tentativa registrada',
            }, { onSuccess: () => setObs('') })}>Registrar tentativa</Button>
          </div>
          <Button variant="destructive" className="w-full" disabled={!podeEscalar || acao.isPending}
            title={podeEscalar ? undefined : 'Liberado após 2 tentativas ou 72h do no-show'}
            onClick={() => acao.mutate({ rpc: 'visita_escalar', args: { p_visita_id: visita.id, p_observacao: obs || null }, sucesso: 'Escalada para o Ramon' })}>
            <Flag /> Escalar para Ramon
          </Button>
          {!podeEscalar && <p className="text-center text-xs text-muted-foreground">Liberado após 2 tentativas ou 72h do no-show.</p>}
        </>
      )}
    </Cartao>
  );
}

// ===== Reagendar =====
export function ReagendarDialog({ aberto, onOpenChange, visita, onReagendada, dataInicial, horaInicial }: {
  aberto: boolean; onOpenChange: (v: boolean) => void; visita: Visita; onReagendada?: (novaId: string) => void;
  dataInicial?: string; horaInicial?: string;
}) {
  const acao = useAcaoVisita();
  const [data, setData] = useState(dataInicial ?? '');
  const [hora, setHora] = useState(horaInicial ?? visita.horario_visita.slice(0, 5));
  const [manter, setManter] = useState(!!visita.corretor_id);
  const [outro, setOutro] = useState<CorretorEscolhido | null>(null);
  useEffect(() => {
    if (aberto) { setData(dataInicial ?? ''); setHora(horaInicial ?? visita.horario_visita.slice(0, 5)); setManter(!!visita.corretor_id); setOutro(null); }
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps
  const futuro = data && hora && inicioVisita(data, hora).getTime() > Date.now();
  const pronto = futuro && (manter || outro);

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" /> Reagendar visita</DialogTitle>
          <DialogDescription>Cria uma nova visita ligada a esta, que fica como <strong>Reagendada</strong>. O corretor precisa aceitar de novo.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label htmlFor="rg-data">Nova data</Label>
              <Input id="rg-data" type="date" min={hojeISO()} value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="rg-hora">Horário</Label>
              <Input id="rg-hora" type="time" step={900} value={hora} onChange={(e) => setHora(e.target.value)} /></div>
          </div>
          {data && hora && !futuro && <p className="-mt-2 text-xs text-destructive">Escolha um horário no futuro.</p>}
          {visita.corretor_id && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={manter} onCheckedChange={(v) => setManter(!!v)} /> Manter o mesmo corretor
            </label>
          )}
          {!manter && (
            <SeletorCorretor empreendimentoId={visita.empreendimento_id} data={data || null} hora={hora || null}
              visitaId={visita.id} valor={outro?.id ?? null} onChange={setOutro} />
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button disabled={!pronto || acao.isPending} onClick={() => acao.mutate({
            rpc: 'visita_reagendar',
            args: { p_visita_id: visita.id, p_data: data, p_hora: hora, p_corretor_id: manter ? visita.corretor_id : outro?.id ?? null },
            sucesso: 'Visita reagendada · aguardando aceite do corretor',
          }, { onSuccess: (r) => { onOpenChange(false); if (r?.visita_id) onReagendada?.(String(r.visita_id)); } })}>
            {acao.isPending && <Loader2 className="animate-spin" />} Reagendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Cancelar =====
export function CancelarDialog({ aberto, onOpenChange, visitaId }: { aberto: boolean; onOpenChange: (v: boolean) => void; visitaId: string }) {
  const acao = useAcaoVisita();
  const [motivo, setMotivo] = useState('');
  useEffect(() => { if (aberto) setMotivo(''); }, [aberto]);
  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar visita</DialogTitle>
          <DialogDescription>O motivo é obrigatório e fica no histórico. Tarefas pendentes são encerradas.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {MOTIVOS_CANCELAMENTO.map((m) => (
            <button key={m} type="button" onClick={() => setMotivo(m)}
              className={cn('rounded-full border px-2.5 py-1 text-xs', motivo === m ? 'border-primary bg-primary/10 text-primary-dark' : 'hover:bg-muted')}>{m}</button>
          ))}
        </div>
        <Textarea rows={3} maxLength={1000} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Descreva o motivo" aria-label="Motivo do cancelamento" />
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button variant="destructive" disabled={motivo.trim().length < 3 || acao.isPending}
            onClick={() => acao.mutate({ rpc: 'visita_cancelar', args: { p_visita_id: visitaId, p_motivo: motivo }, sucesso: 'Visita cancelada' },
              { onSuccess: () => onOpenChange(false) })}>
            {acao.isPending && <Loader2 className="animate-spin" />} Cancelar visita
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
