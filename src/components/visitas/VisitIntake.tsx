import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { visitLifecycle } from '@/lib/visitLifecycle';
import { Card,CardHeader,CardTitle,CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog,DialogContent,DialogHeader,DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const labels:Record<string,string>={queued:'Aguardando processamento',processing:'Analisando',needs_input:'Aguardando informações',needs_closer:'Decisão do Closer',created:'Visita cadastrada',duplicate:'Visita já existente',cancelled:'Solicitação cancelada',failed:'Revisão necessária'};
function Resolve({request,onClose}:{request:any;onClose:()=>void}){
 const [text,setText]=useState('');const [busy,setBusy]=useState(false);const qc=useQueryClient();
 async function action(resolution:string){setBusy(true);try{await visitLifecycle('intake_resolve',{id:request.id,revision:request.revision,resolution,text});await qc.invalidateQueries({queryKey:['visit-intake']});toast.success('Solicitação atualizada');onClose();}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}}
 return <div className="space-y-3"><p className="whitespace-pre-wrap">{request.resolution_note}</p><p className="text-sm">Cliente: {request.fields.client_name||'A informar'} · Empreendimento: {request.fields.property_name||'A informar'}</p><p className="text-sm">Local de encontro: {request.fields.address||'A informar'}</p><Label htmlFor="intake-correction">Campos para corrigir</Label><Textarea id="intake-correction" value={text} onChange={e=>setText(e.target.value)} placeholder={'Data: 20/09/2026\nHorário: 16:00\nCorretor: opção 1'}/><Button disabled={busy||!text.trim()} onClick={()=>action('correct')}>Corrigir e processar</Button>{request.status==='needs_closer'&&request.conflict_ids?.length>0&&<div className="border border-amber-400 p-3 rounded"><p>Há {request.conflict_ids.length} visita(s) conflitantes. A liberação mantém os compromissos existentes e agenda esta visita no mesmo período.</p><Button disabled={busy} onClick={()=>action('approve')}>Liberar conflito e cadastrar</Button></div>}<Button variant="outline" disabled={busy} onClick={()=>action('cancel')}>Cancelar solicitação</Button></div>;
}
export function VisitIntake(){
 const [offset,setOffset]=useState(0);const [selected,setSelected]=useState<any>(null);const qc=useQueryClient();
 const query=useQuery({queryKey:['visit-intake',offset],queryFn:()=>visitLifecycle('intake_list',{offset}),refetchInterval:30000,retry:false});
 return <Card className="mb-6"><CardHeader><CardTitle>Agendamentos pelo WhatsApp</CardTitle></CardHeader><CardContent className="space-y-3">
 {query.error?<p role="alert">Não foi possível consultar solicitações. <Button variant="outline" onClick={()=>query.refetch()}>Tentar novamente</Button></p>:query.isLoading?<p>Carregando solicitações…</p>:<>
 {!query.data?.enabled&&<p className="text-sm text-muted-foreground">Agendamento pelo grupo desativado. Ative em Configurações → Automação de visitas.</p>}
 {query.data?.requests?.length===0&&<p>Nenhuma solicitação recebida pelo grupo.</p>}
 {query.data?.requests?.map((r:any)=><div key={r.id} className="border rounded p-3 flex flex-wrap gap-3 items-center justify-between"><div><strong>AG-{r.protocol}</strong> · {labels[r.status]}<p>{r.fields.client_name||'Cliente a identificar'} · {r.fields.property_name||'Empreendimento a identificar'}</p><p className="text-sm">{r.fields.date} {r.fields.time} · {r.fields.address}</p></div>{['queued','processing','needs_input','needs_closer','failed'].includes(r.status)&&<Button onClick={()=>setSelected(r)}>Resolver</Button>}</div>)}
 {query.data?.failures?.map((f:any)=><div role="alert" key={f.id} className="text-sm">Falha no aviso: {f.last_error}. Confira o WhatsApp antes de reenviar uma entrega incerta. <Button variant="outline" onClick={async()=>{try{await visitLifecycle('intake_retry_delivery',{id:f.intake_id});await qc.invalidateQueries({queryKey:['visit-intake']});}catch(e){toast.error((e as Error).message);}}}>Reenviar aviso</Button></div>)}
 <div className="flex items-center gap-2"><Button variant="outline" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-20))}>Anterior</Button><span className="text-sm">{query.data?.count||0} solicitações</span><Button variant="outline" disabled={offset+20>=(query.data?.count||0)} onClick={()=>setOffset(offset+20)}>Próxima</Button></div>
 </>}
 <Dialog open={!!selected} onOpenChange={open=>{if(!open)setSelected(null);}}><DialogContent><DialogHeader><DialogTitle>Resolver AG-{selected?.protocol}</DialogTitle></DialogHeader>{selected&&<Resolve key={selected.id+':'+selected.revision} request={selected} onClose={()=>setSelected(null)}/>}</DialogContent></Dialog>
 </CardContent></Card>;
}
