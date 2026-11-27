import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Building2, CalendarClock, ExternalLink, History, Loader2, MapPin, MessageCircle, MoreHorizontal, Pencil, User, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAcaoVisita, useConfigComercial, useEquipe, useVisita } from '@/hooks/comercial/dados';
import { useAbrirVisita } from '@/hooks/comercial/useAbrirVisita';
import { nomeCorretor } from '@/lib/comercial/nomes';
import { ROTULO_STATUS_VISITA, ROTULO_TAREFA, STATUS_VISITA_ATIVOS } from '@/lib/comercial/constantes';
import { formatarData, formatarDataHora, formatarDiaSemana, formatarHora } from '@/lib/comercial/datas';
import { linkEmpreendimento, momentosLiberados } from '@/lib/comercial/mensagens';
import { telefoneCanonico } from '@/lib/comercial/telefone';
import { AcoesVisita, CancelarDialog, ReagendarDialog } from './AcoesVisita';
import { MensagensVisita } from './MensagensVisita';
import { PerfilCliente } from './PerfilCliente';
import { StatusVisitaBadge } from './ui';
import { descreverEvento } from '@/lib/comercial/eventos';

export function VisitaPainel() {
  const [params, setParams] = useSearchParams();
  const id = params.get('visita');
  const fechar = () => {
    const p = new URLSearchParams(params);
    p.delete('visita');
    setParams(p);
  };
  return (
    <Sheet open={!!id} onOpenChange={(v) => !v && fechar()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        {id && <ConteudoVisita id={id} />}
      </SheetContent>
    </Sheet>
  );
}

function ConteudoVisita({ id }: { id: string }) {
  const { data, isLoading, isError } = useVisita(id);
  const { data: cfg } = useConfigComercial();
  const { data: equipe = [] } = useEquipe();
  const abrir = useAbrirVisita();
  const [aba, setAba] = useState('andamento');
  const [reagendar, setReagendar] = useState(false);
  const [cancelar, setCancelar] = useState(false);
  const [editarLocal, setEditarLocal] = useState(false);

  const nomes = useMemo(() => new Map(equipe.map((u) => [u.user_id, u.nome])), [equipe]);

  if (isLoading) {
    return <div className="space-y-4 p-6"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>;
  }
  if (isError || !data) {
    return <div className="p-6"><SheetTitle>Visita não encontrada</SheetTitle><SheetDescription>Ela pode ter sido removida.</SheetDescription></div>;
  }

  const { visita: v, ciclo, convites, tarefas, eventos, anterior, proxima } = data;
  const lead = v.leads as { id: string; nome: string; telefone: string; telefone_exibicao: string | null; fonte: string | null } | null;
  const emp = v.empreendimentos as { id: string; nome: string; wp_post_id: number | null } | null;
  const corretor = v.corretores as { whatsapp: string | null; telefone: string | null; profiles: { first_name: string; last_name: string } | null } | null;
  const corretorNome = nomeCorretor(corretor);
  const telCorretor = corretor?.whatsapp || corretor?.telefone || null;
  const ativa = STATUS_VISITA_ATIVOS.includes(v.status) || v.status === 'no_show';
  const usadas = new Set(eventos.filter((e) => e.kind === 'f1_mensagem').map((e) => String((e.payload as { template?: string })?.template)));
  const liberados = momentosLiberados({
    status: v.status,
    corretorAceitou: ciclo?.match_status === 'accepted',
    tarefas: tarefas.map((t) => t.tipo),
    temVisitaAnterior: !!anterior,
  });
  const dadosMsg = {
    data: v.data_visita, hora: v.horario_visita, localNome: v.local_nome, endereco: v.meeting_address, bairro: v.meeting_neighborhood,
    empreendimento: emp?.nome, wpPostId: emp?.wp_post_id, siteUrl: cfg?.site_url, cliente: lead?.nome, perfil: v.customer_profile,
    corretor: corretorNome, origem: lead?.fonte,
  };
  const link = linkEmpreendimento(emp?.wp_post_id, cfg?.site_url);

  return (
    <>
      <SheetHeader className="space-y-3 border-b bg-card px-5 pb-4 pt-5 text-left">
        <div className="flex items-start gap-3 pr-8">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <SheetTitle className="truncate text-lg">{lead?.nome ?? 'Visita'}</SheetTitle>
              <StatusVisitaBadge status={v.status} />
            </div>
            <SheetDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                {formatarDiaSemana(v.data_visita)} · {formatarHora(v.horario_visita)}
              </span>
              {v.visit_code && <span className="tabular-nums">#{v.visit_code}</span>}
              {typeof (v.planilha_extra as { status_label?: string } | null)?.status_label === 'string' && (
                <span className="text-xs">Planilha: {(v.planilha_extra as { status_label: string }).status_label}</span>
              )}
            </SheetDescription>
          </div>
          {ativa && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Mais ações"><MoreHorizontal /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setReagendar(true)}><CalendarClock /> Reagendar</DropdownMenuItem>
                {v.status !== 'no_show' && <DropdownMenuItem onSelect={() => setEditarLocal(true)}><Pencil /> Corrigir local / perfil</DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setCancelar(true)}><XCircle /> Cancelar visita</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Info icone={Building2} rotulo="Empreendimento">
            {emp?.nome ?? '—'}
            {link && <a href={link} target="_blank" rel="noreferrer noopener" className="ml-1 inline-flex text-primary" aria-label="Abrir página do empreendimento"><ExternalLink className="h-3.5 w-3.5" /></a>}
          </Info>
          <Info icone={User} rotulo="Corretor">{corretorNome || <span className="text-muted-foreground">a definir</span>}</Info>
          <Info icone={MapPin} rotulo="Local" className="sm:col-span-2">
            {[v.local_nome, v.meeting_address, v.meeting_neighborhood].filter(Boolean).join(' · ') || '—'}
          </Info>
        </dl>

        <div className="flex flex-wrap gap-2">
          {lead && <Button size="sm" variant="outline" asChild><Link to={`/leads/${lead.id}`}><User /> Ficha do lead</Link></Button>}
          {telefoneCanonico(lead?.telefone) && (
            <Button size="sm" variant="outline" asChild>
              <a href={`https://wa.me/${telefoneCanonico(lead?.telefone)}`} target="_blank" rel="noreferrer noopener"><MessageCircle /> Cliente</a>
            </Button>
          )}
          {telefoneCanonico(telCorretor) && (
            <Button size="sm" variant="outline" asChild>
              <a href={`https://wa.me/${telefoneCanonico(telCorretor)}`} target="_blank" rel="noreferrer noopener"><MessageCircle /> Corretor</a>
            </Button>
          )}
          {anterior && <Button size="sm" variant="ghost" onClick={() => abrir(anterior.id)}>← Visita original ({formatarData(anterior.data_visita)})</Button>}
          {proxima && <Button size="sm" variant="ghost" onClick={() => abrir(proxima.id)}>Nova visita ({formatarData(proxima.data_visita)}) →</Button>}
        </div>
      </SheetHeader>

      <Tabs value={aba} onValueChange={setAba} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-5 mt-3 grid grid-cols-3">
          <TabsTrigger value="andamento">Andamento</TabsTrigger>
          <TabsTrigger value="mensagens">Mensagens{liberados.length ? ` (${liberados.length})` : ''}</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-4">
          <TabsContent value="andamento" className="mt-0 space-y-4">
            <AcoesVisita visita={v as never} convites={convites as never} tarefas={tarefas as never} onMensagens={() => setAba('mensagens')} />
            <PerfilCliente leadId={v.lead_id} aoAbrirVisita={abrir} visitaAtual={v.id} />
            <section className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-semibold">Tarefas e prazos</h3>
              {!tarefas.length && <p className="mt-2 text-sm text-muted-foreground">Nenhuma tarefa.</p>}
              <ul className="mt-2 divide-y">
                {tarefas.map((t) => {
                  const vencida = t.status === 'pendente' && new Date(t.vence_em).getTime() < Date.now();
                  return (
                    <li key={t.id} className="flex items-center gap-2 py-2 text-sm">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', t.status === 'concluida' ? 'bg-primary' : t.status === 'cancelada' ? 'bg-slate-300' : vencida ? 'bg-rose-500' : 'bg-amber-400')} />
                      <span className={cn(t.status !== 'pendente' && 'text-muted-foreground line-through decoration-slate-300')}>{ROTULO_TAREFA[t.tipo] ?? t.tipo}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{nomes.get(t.dono_id ?? '') ?? ''}</span>
                      <span className={cn('w-36 text-right text-xs tabular-nums', vencida ? 'font-semibold text-rose-700' : 'text-muted-foreground')}>
                        {t.status === 'pendente' ? `até ${formatarDataHora(t.vence_em)}` : t.status === 'concluida' ? `feita ${formatarDataHora(t.concluida_em)}` : 'cancelada'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </TabsContent>

          <TabsContent value="mensagens" className="mt-0">
            <MensagensVisita visitaId={v.id} liberados={liberados} dados={dadosMsg} usadas={usadas}
              telefones={{ cliente: lead?.telefone, corretor: telCorretor }} />
          </TabsContent>

          <TabsContent value="historico" className="mt-0">
            <Historico eventos={eventos} nomes={nomes} />
          </TabsContent>
        </div>
      </Tabs>

      <ReagendarDialog aberto={reagendar} onOpenChange={setReagendar} visita={v as never} onReagendada={(novo) => abrir(novo)} />
      <CancelarDialog aberto={cancelar} onOpenChange={setCancelar} visitaId={v.id} />
      <EditarLocalDialog aberto={editarLocal} onOpenChange={setEditarLocal} visita={v} />
    </>
  );
}

function Info({ icone: Icone, rotulo, children, className }: { icone: typeof User; rotulo: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 items-start gap-2', className)}>
      <Icone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
        <dd className="truncate">{children}</dd>
      </div>
    </div>
  );
}


function Historico({ eventos, nomes }: { eventos: { id: string; kind: string; payload: unknown; created_at: string; ator_id: string | null }[]; nomes: Map<string, string> }) {
  if (!eventos.length) return <p className="text-sm text-muted-foreground">Sem eventos.</p>;
  return (
    <ol className="relative space-y-4 border-l pl-5">
      {eventos.map((e) => {
        const d = descreverEvento(e);
        return (
          <li key={e.id} className="relative">
            <span className="absolute -left-[25px] top-1 flex h-3 w-3 items-center justify-center rounded-full border-2 border-white bg-primary ring-1 ring-primary/30" />
            <p className="text-sm font-medium">{d.titulo}</p>
            {d.detalhe && <p className="text-sm text-muted-foreground">{d.detalhe}</p>}
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <History className="h-3 w-3" />{formatarDataHora(e.created_at)}{e.ator_id && ` · ${nomes.get(e.ator_id) ?? 'equipe'}`}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function EditarLocalDialog({ aberto, onOpenChange, visita }: {
  aberto: boolean; onOpenChange: (v: boolean) => void;
  visita: { id: string; status: string; local_nome: string | null; meeting_address: string | null; meeting_neighborhood: string | null; customer_profile: string | null };
}) {
  const acao = useAcaoVisita();
  const [f, setF] = useState({ local_nome: '', endereco: '', bairro: '', perfil: '' });
  const reset = () => setF({ local_nome: visita.local_nome ?? '', endereco: visita.meeting_address ?? '', bairro: visita.meeting_neighborhood ?? '', perfil: visita.customer_profile ?? '' });
  const valido = f.local_nome.trim().length >= 2 && f.endereco.trim().length >= 5 && f.bairro.trim().length >= 2;
  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Corrigir local e perfil</DialogTitle></DialogHeader>
        {visita.status === 'confirmada' && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">Alterar o local desfaz a confirmação do cliente: reenvie a mensagem com o novo endereço.</p>
        )}
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label htmlFor="el-local">Local</Label><Input id="el-local" value={f.local_nome} maxLength={120} onChange={(e) => setF({ ...f, local_nome: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label htmlFor="el-end">Endereço</Label><Input id="el-end" value={f.endereco} maxLength={300} onChange={(e) => setF({ ...f, endereco: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label htmlFor="el-bairro">Bairro</Label><Input id="el-bairro" value={f.bairro} maxLength={120} onChange={(e) => setF({ ...f, bairro: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label htmlFor="el-perfil">Perfil do cliente</Label><Textarea id="el-perfil" rows={3} maxLength={2000} value={f.perfil} onChange={(e) => setF({ ...f, perfil: e.target.value })} /></div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button disabled={!valido || acao.isPending} onClick={() => acao.mutate({
            rpc: 'visita_atualizar_local', args: { p_visita_id: visita.id, p_dados: f }, sucesso: 'Local atualizado',
          }, { onSuccess: () => onOpenChange(false) })}>
            {acao.isPending && <Loader2 className="animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
