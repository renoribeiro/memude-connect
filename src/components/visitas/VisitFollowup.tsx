import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { visitLifecycle, type VisitCycle, type VisitDashboardData } from '@/lib/visitLifecycle';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const confirmation = (v: boolean | null) => v === null ? 'Pendente' : v ? 'Confirmou' : 'Não pode ir';
const outcomes: Record<string,string> = { pending: 'Agendada', held: 'Realizada', not_held: 'Não realizada', cancelled: 'Cancelada', rescheduled: 'Reagendada', withdrawn: 'Desistência' };
const eventNames: Record<string,string> = { match_consulting:'Consulta a corretor',match_accepted:'Corretor aceitou a visita',match_exhausted:'Atribuição pelo Closer pendente',match_declined:'Consulta recusada',match_timeout:'Consulta encerrada por prazo ou falha',match_manual:'Closer indicou corretor',match_unavailable:'Corretor indisponível',post_visit_summary:'Resumo completo enviado', scheduled: 'Visita agendada', changed: 'Agendamento alterado', missing_broker: 'Corretor não designado', client_confirmed: 'Cliente confirmou', broker_confirmed: 'Corretor confirmou', broker_declined: 'Corretor indisponível', confirmation_overdue: 'Confirmação pendente', attendance_overdue: 'Prazo de resposta excedido', held: 'Visita realizada', not_held: 'Visita não realizada', cancelled: 'Visita cancelada', reason: 'Motivo recebido', rating: 'Avaliação recebida', feedback: 'Feedback registrado', withdrawn: 'Desistência registrada', rescheduled: 'Visita reagendada', prompt_sent: 'Pergunta ou lembrete enviado' };
const deliveryNames: Record<string,string> = { client: 'Cliente', broker: 'Corretor', closer: 'Closer', group: 'Grupo', sheets: 'Planilha', pending: 'Aguardando envio', processing: 'Processando', sent: 'Aceito pelo destino', failed: 'Falhou', obsolete: 'Substituído ou cancelado' };

export function VisitPendingBanner() {
  const { isAdmin } = useAuth();
  const query = useQuery({ queryKey: ['visit-followup', 'banner'], queryFn: () => visitLifecycle<VisitDashboardData>('dashboard'), enabled: isAdmin, refetchInterval: 30000, retry: false });
  if (!isAdmin) return null;
  if (query.error) return <div role="status" className="border border-amber-300 rounded p-3 mb-4 text-sm">Acompanhamento de visitas indisponível. <Link to="/visitas" className="underline">Verificar pendências</Link></div>;
  const unhealthy=query.data?.enabled && query.data?.health?.some(h=>!h.last_completed||Date.now()-Date.parse(h.last_completed)>5*60000);
  if (!query.data?.count && !query.data?.failures && !query.data?.intake_pending && !query.data?.intake_failures && !query.data?.intake_stalled && !unhealthy) return null;
  return <div role="alert" className="border-2 border-red-600 bg-red-50 text-red-950 p-4 rounded-lg mb-4 font-medium">
    Atenção, Closer: {query.data.count} visita(s) precisam de acompanhamento. {query.data.failures ? `${query.data.failures} envio(s) falharam.` : ''}
    {query.data.intake_pending ? ` ${query.data.intake_pending} solicitação(ões) do WhatsApp aguardam resolução.` : ''}
    {!!query.data.intake_failures && ` ${query.data.intake_failures} aviso(s) do grupo falharam.`}
    {!!query.data.intake_stalled && ` ${query.data.intake_stalled} pedido(s) estão atrasados.`}
    {unhealthy && ' Processamento sem atualização recente. Verifique as integrações.'}
    <Link to="/visitas#acompanhamento" className="ml-2 underline font-bold">Resolver pendências</Link>
    <p className="text-sm mt-1">Ler este aviso não encerra as pendências de recuperação.</p>
  </div>;
}

function CycleActions({ cycle, onClose }: { cycle: VisitCycle; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [interest, setInterest] = useState(cycle.feedback?.interest ?? true);
  const [objections, setObjections] = useState(cycle.feedback?.objections || '');
  const [nextStep, setNextStep] = useState(cycle.feedback?.next_step || '');
  const [returnAt, setReturnAt] = useState(cycle.feedback?.return_at || '');
  const [brokerId, setBrokerId] = useState('');
  const canReplace = cycle.outcome === 'pending' && cycle.match_status === 'exhausted';
  const brokers = useQuery({ queryKey: ['visit-active-brokers'], queryFn: () => visitLifecycle('brokers'), enabled: canReplace });
  const history = useQuery({ queryKey: ['visit-history', cycle.visita_id], queryFn: () => visitLifecycle('history', { visita_id: cycle.visita_id }) });
  async function act(action: string, data: Record<string,unknown> = {}) {
    setBusy(true);
    try { await visitLifecycle(action, { visita_id: cycle.visita_id, data }); await Promise.all([queryClient.invalidateQueries({ queryKey: ['visit-followup'] }), queryClient.invalidateQueries({ queryKey: ['visitas'] }), queryClient.invalidateQueries({ queryKey: ['visit-history'] })]); toast.success('Acompanhamento atualizado'); onClose(); }
    catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  }
  return <div className="space-y-4">
    <p>Corretor: {cycle.match_status==='accepted'?'aceitou a visita':cycle.match_status==='exhausted'?'atribuição pelo Closer pendente':'consulta em andamento'}</p>
    {cycle.feedback?.text && <p>Feedback recebido do corretor: {cycle.feedback.text}</p>}
    <p>Cliente: {confirmation(cycle.client_confirmed)} · Corretor: {confirmation(cycle.broker_confirmed)}</p>
    {cycle.reason && <p>Motivo: {cycle.reason}</p>}
    {cycle.rating !== null && <p>Nota do cliente para o corretor: <strong>{cycle.rating}/10</strong></p>}
    {canReplace && <fieldset disabled={busy} className="border rounded p-3 space-y-2"><legend>Providenciar cobertura</legend><Label htmlFor="replacement-broker">Novo corretor</Label><select id="replacement-broker" className="w-full border rounded p-2" value={brokerId} onChange={e => setBrokerId(e.target.value)}><option value="">Selecione outro corretor</option>{brokers.data?.brokers.map((b: any) => <option key={b.id} value={b.id}>{b.profiles?.first_name} {b.profiles?.last_name}</option>)}</select>{brokers.error && <p role="alert">{brokers.error.message}</p>}<Button disabled={!brokerId} onClick={() => act('match_manual', { broker_id: brokerId })}>Consultar corretor indicado pelo Closer</Button></fieldset>}
    {cycle.recovery_open && <fieldset disabled={busy} className="space-y-3 border rounded p-3"><legend>Recuperar visita</legend>
      <p className="text-sm">O reagendamento cria uma nova visita vinculada à anterior. O corretor atual será mantido e poderá ser alterado no novo cadastro.</p>
      <Label htmlFor="followup-date">Nova data</Label><Input id="followup-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
      <Label htmlFor="followup-time">Novo horário</Label><Input id="followup-time" type="time" value={time} onChange={e => setTime(e.target.value)} />
      <Button disabled={!date || !time} onClick={() => act('reschedule', { date, time })}>Cadastrar nova visita e reiniciar ciclo</Button>
      <Label htmlFor="followup-reason">Motivo da desistência explícita do cliente</Label><Textarea id="followup-reason" value={reason} onChange={e => setReason(e.target.value)} />
      <Button variant="destructive" disabled={reason.trim().length < 3} onClick={() => act('withdraw', { reason })}>Registrar desistência e encerrar pendência</Button>
    </fieldset>}
    {cycle.outcome === 'held' && <fieldset disabled={busy} className="space-y-3 border rounded p-3"><legend>Feedback do Closer</legend>
      <Label htmlFor="followup-interest">Cliente demonstrou interesse?</Label><select id="followup-interest" className="border rounded p-2 block" value={String(interest)} onChange={e => setInterest(e.target.value === 'true')}><option value="true">Sim</option><option value="false">Não</option></select>
      <Label htmlFor="followup-objections">Objeções</Label><Textarea id="followup-objections" value={objections} onChange={e => setObjections(e.target.value)} />
      <Label htmlFor="followup-next">Próximo passo</Label><Textarea id="followup-next" value={nextStep} onChange={e => setNextStep(e.target.value)} />
      <Label htmlFor="followup-return">Prazo de retorno</Label><Input id="followup-return" type="date" value={returnAt} onChange={e => setReturnAt(e.target.value)} />
      <Button disabled={nextStep.trim().length < 3 || !returnAt} onClick={() => act('feedback', { interest, objections, next_step: nextStep, return_at: returnAt })}>Salvar feedback</Button>
    </fieldset>}
    {cycle.attendance_overdue && <p className="font-medium text-red-700">Corretor ainda não respondeu à pergunta de realização. A ausência de resposta não significa no-show.</p>}
    {cycle.outcome==='pending' && Date.parse(cycle.scheduled_at)<=Date.now() && <fieldset disabled={busy} className="border rounded p-3 space-y-2"><legend>Resultado apurado pelo Closer</legend><Label htmlFor="attendance-reason">Como o resultado foi confirmado?</Label><Textarea id="attendance-reason" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Ex.: confirmei por telefone com o corretor"/><div className="flex gap-2"><Button disabled={reason.trim().length<3} onClick={()=>act('attendance',{held:true,reason})}>Visita realizada</Button><Button variant="outline" disabled={reason.trim().length<3} onClick={()=>act('attendance',{held:false,reason})}>Não realizada</Button></div></fieldset>}
    <h3 className="font-semibold">Últimos eventos e envios</h3>
    {history.error && <p role="alert">{history.error.message}</p>}
    <div className="max-h-52 overflow-auto text-sm space-y-2">
      {history.data?.events.map((e: any) => <p key={e.id}>{new Date(e.created_at).toLocaleString('pt-BR')} — {eventNames[e.kind] || 'Atualização da visita'}</p>)}
      {history.data?.deliveries.map((d: any) => <p key={d.id}>{deliveryNames[d.destination]}: {({accepted:'Aceito pelo provedor',delivered:'Entregue',read:'Lido',unknown:'Entrega incerta',failed:'Falha'} as Record<string,string>)[d.delivery_state]||deliveryNames[d.status]} {d.last_error ? `— ${d.last_error}` : ''}</p>)}
    </div>
    <p className="text-sm">Antes de reenviar uma entrega incerta, confira o WhatsApp para evitar duplicidade.</p><Button variant="outline" disabled={busy} onClick={() => act('retry')}>Conferi os envios: reprocessar falhas</Button>
  </div>;
}

export function VisitFollowup() {
  const { isAdmin } = useAuth();
  const [all, setAll] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<VisitCycle | null>(null);
  const query = useQuery({ queryKey: ['visit-followup', all, offset], queryFn: () => visitLifecycle<VisitDashboardData>('dashboard', { pending_only: !all, offset }), enabled: isAdmin, refetchInterval: 30000, retry: false });
  if (!isAdmin) return null;
  return <Card id="acompanhamento" className="mb-6"><CardHeader><CardTitle>Acompanhamento do Closer</CardTitle></CardHeader><CardContent className="space-y-3">
    <Button variant="outline" onClick={() => { setAll(!all); setOffset(0); }}>{all ? 'Mostrar somente pendências' : 'Ver todas as visitas acompanhadas'}</Button>
    {query.isLoading && <p>Carregando…</p>}
    {query.error && <div role="alert"><p>{query.error.message}</p><Button onClick={() => query.refetch()}>Tentar novamente</Button></div>}
    {query.data && !query.data.enabled && <p className="text-amber-700">Automação pausada. Configure e ative em Configurações → Automação de visitas.</p>}
    {query.data?.failures ? <p className="text-destructive">{query.data.failures} envio(s) falharam. Abra o histórico da visita para verificar.</p> : null}
    {query.data?.failed_visits?.map((f,i)=><div className="border rounded p-2" key={f.visita_id+':'+i}><p>{f.destination}: {f.last_error}</p><Button variant="outline" onClick={async()=>{try{const result=await visitLifecycle('cycle',{visita_id:f.visita_id});setSelected(result.cycle);}catch(error){toast.error((error as Error).message);}}}>Abrir visita com falha</Button></div>)}
    {query.data?.cycles.map(c => <div key={c.visita_id} className={`rounded border p-3 flex flex-wrap items-center justify-between gap-3 ${c.recovery_open || c.attendance_overdue ? 'border-red-400 bg-red-50' : ''}`}>
      <div><p className="font-semibold">{c.visita?.lead?.nome || 'Cliente'} — {outcomes[c.outcome]}</p><p className="text-sm">{new Date(c.scheduled_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p><p className="text-sm">{c.match_status==='exhausted' ? 'Nenhum corretor aceitou: indicar outro corretor' : c.match_status==='searching' ? 'Match consultando corretores' : c.recovery_open ? 'Reagendamento ou desistência pendente' : c.attendance_overdue ? 'Resultado da visita não informado' : c.confirmation_overdue ? 'Confirmar presença com as partes' : c.outcome === 'held' && !c.broker_feedback_at ? 'Feedback do corretor pendente' : c.outcome==='held' && c.rating===null ? 'Nota do cliente pendente' : 'Acompanhamento registrado'}</p></div>
      <Button onClick={() => setSelected(c)}>Acompanhar</Button>
    </div>)}
    {query.data?.count === 0 && <p>Nenhuma visita nesta lista.</p>}
    <div className="flex gap-2"><Button variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>Anterior</Button><Button variant="outline" disabled={!query.data || offset + 20 >= query.data.count} onClick={() => setOffset(offset + 20)}>Próxima</Button></div>
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Acompanhamento da visita</DialogTitle></DialogHeader>{selected && <CycleActions key={selected.visita_id} cycle={selected} onClose={() => setSelected(null)} />}</DialogContent></Dialog>
  </CardContent></Card>;
}
