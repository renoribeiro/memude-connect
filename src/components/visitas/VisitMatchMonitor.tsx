import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { visitLifecycle } from '@/lib/visitLifecycle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Attempt {
  id:string; round:number; status:string; created_at:string;
  ranking:{specialty?:number;region?:number;rating?:number;visits?:number};
  broker:{profiles:{first_name:string;last_name:string}};
  visit:{lead:{nome:string}};
  prompt:{sent_at:string|null;expires_at:string};
}
const states:Record<string,string>={pending:'Aguardando resposta',accepted:'Aceitou',declined:'Recusou',timeout:'Prazo encerrado',failed:'Falha ou indisponibilidade',obsolete:'Consulta substituída'};

export function VisitMatchMonitor(){
  const [offset,setOffset]=useState(0);
  const query=useQuery({queryKey:['visit-match',offset],queryFn:()=>visitLifecycle<{attempts:Attempt[];count:number}>('match_list',{offset}),refetchInterval:15000});
  return <Card><CardHeader><CardTitle>Consultas do Match de visitas</CardTitle></CardHeader><CardContent className="space-y-3">
    <p className="text-sm">O prazo de 15 minutos começa no aceite do envio pelo WhatsApp. Pendências de atribuição são resolvidas no acompanhamento do Closer.</p>
    {query.isLoading&&<p>Carregando consultas…</p>}
    {query.error&&<div role="alert"><p>{query.error.message}</p><Button onClick={()=>query.refetch()}>Tentar novamente</Button></div>}
    {query.data?.attempts?.map(a=><article key={a.id} className="border rounded p-3 text-sm space-y-1">
      <p className="font-semibold">{a.visit?.lead?.nome||'Cliente'} — {[a.broker?.profiles?.first_name,a.broker?.profiles?.last_name].filter(Boolean).join(' ')}</p>
      <p>{states[a.status]||a.status} · Rodada {a.round}</p>
      {a.status==='pending'&&<p>{a.prompt?.sent_at?`Responder até ${new Date(a.prompt.expires_at).toLocaleString('pt-BR')}`:'Aguardando envio ao WhatsApp'}</p>}
      <p>Especialidade: {a.ranking.specialty??0}/2 · Região: {a.ranking.region===2?'Bairro':a.ranking.region===1?'Cidade':'Sem correspondência'} · Nota: {Number(a.ranking.rating??0).toFixed(1)}/10 · Visitas realizadas: {a.ranking.visits??0}</p>
    </article>)}
    {query.data?.count===0&&<p>Nenhuma consulta de Match registrada.</p>}
    <div className="flex gap-2"><Button variant="outline" disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-20))}>Anterior</Button><Button variant="outline" disabled={!query.data||offset+20>=query.data.count} onClick={()=>setOffset(offset+20)}>Próxima</Button></div>
  </CardContent></Card>;
}
