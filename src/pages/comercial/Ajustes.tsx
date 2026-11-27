import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bot, Copy, Loader2, RefreshCw, Save, ShieldCheck, Sheet as SheetIcon, Users } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useConfigComercial, useEquipe, useTemplates } from '@/hooks/comercial/dados';
import { formatarDataHora, relativo } from '@/lib/comercial/datas';
import { EstadoVazio } from '@/components/comercial/ui';

export default function AjustesPage() {
  const [params, setParams] = useSearchParams();
  const aba = params.get('aba') ?? 'prazos';
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-5">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Ajustes do comercial</h1>
          <p className="text-sm text-muted-foreground">Prazos, rating, espelho da planilha e qualidade dos dados de Leads e Visitas.</p>
        </header>
        <Tabs value={aba} onValueChange={(v) => setParams({ aba: v })}>
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="prazos">Prazos e rating</TabsTrigger>
            <TabsTrigger value="planilha">Planilha</TabsTrigger>
            <TabsTrigger value="duplicados">Duplicados</TabsTrigger>
            <TabsTrigger value="importacao">Importação</TabsTrigger>
            <TabsTrigger value="robo">Automação antiga</TabsTrigger>
          </TabsList>
          <TabsContent value="prazos"><PrazosRating /></TabsContent>
          <TabsContent value="planilha"><Planilha /></TabsContent>
          <TabsContent value="duplicados"><Duplicados /></TabsContent>
          <TabsContent value="importacao"><Importacao /></TabsContent>
          <TabsContent value="robo"><Robo /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

const PESOS = [
  { chave: 'conversao', rotulo: 'Conversão', ajuda: 'vendas ÷ visitas realizadas' },
  { chave: 'aderencia', rotulo: 'Aderência ao perfil', ajuda: 'empreendimento, construtora, bairro ou faixa' },
  { chave: 'aceite', rotulo: 'Aceite', ajuda: 'aceites ÷ convites respondidos' },
  { chave: 'nota', rotulo: 'Nota do cliente', ajuda: 'média 1–5 do pós-visita' },
] as const;

const PRAZOS = [
  { chave: 'prazo_aceite_min', rotulo: 'Aceite do corretor', unidade: 'min' },
  { chave: 'prazo_d0_horas_antes', rotulo: 'Confirmação D0 (antes da visita)', unidade: 'h' },
  { chave: 'prazo_resultado_horas', rotulo: 'Registrar resultado (depois)', unidade: 'h' },
  { chave: 'prazo_retorno_horas', rotulo: 'Retorno pós-visita', unidade: 'h' },
  { chave: 'prazo_proximo_passo_horas', rotulo: 'Próximo passo', unidade: 'h' },
  { chave: 'prazo_remarcar_horas', rotulo: 'Remarcar no-show', unidade: 'h' },
  { chave: 'escalar_tentativas', rotulo: 'Escalar após tentativas', unidade: 'x' },
  { chave: 'escalar_horas', rotulo: 'ou após', unidade: 'h' },
  { chave: 'min_visitas_historico', rotulo: 'Visitas mínimas p/ histórico próprio', unidade: 'visitas' },
] as const;

function PrazosRating() {
  const qc = useQueryClient();
  const { data: cfg, isLoading } = useConfigComercial();
  const { data: equipe = [] } = useEquipe();
  const [f, setF] = useState<Record<string, unknown> | null>(null);
  useEffect(() => { if (cfg) setF({ ...cfg, pesos: { ...(cfg.pesos as Record<string, number>) } }); }, [cfg]);
  const salvar = useMutation({
    mutationFn: async () => {
      const { id: _id, updated_at: _u, ...campos } = f as Record<string, unknown>;
      const { error } = await supabase.from('fase1_config').update({ ...campos, updated_at: new Date().toISOString() } as never).eq('id', true);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comercial'] }); toast.success('Ajustes salvos'); },
    onError: (e) => toast.error((e as Error).message),
  });
  if (isLoading || !f) return <Skeleton className="h-96 w-full" />;
  const pesos = f.pesos as Record<string, number>;
  const soma = PESOS.reduce((s, p) => s + Number(pesos[p.chave] ?? 0), 0);
  const responsaveis = (f.responsaveis as string[]) ?? [];

  return (
    <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold">Pesos do rating do corretor</h2>
        <p className="mb-4 text-xs text-muted-foreground">A soma precisa ser 100. Critérios sem dados têm o peso redistribuído automaticamente.</p>
        <div className="space-y-3">
          {PESOS.map((p) => (
            <div key={p.chave} className="flex items-center gap-3">
              <div className="flex-1"><Label htmlFor={`peso-${p.chave}`}>{p.rotulo}</Label><p className="text-xs text-muted-foreground">{p.ajuda}</p></div>
              <div className="relative w-24">
                <Input id={`peso-${p.chave}`} type="number" min={0} max={100} value={pesos[p.chave] ?? 0} className="pr-7 text-right tabular-nums"
                  onChange={(e) => setF({ ...f, pesos: { ...pesos, [p.chave]: Number(e.target.value) } })} />
                <span className="absolute right-2.5 top-2.5 text-sm text-muted-foreground">%</span>
              </div>
            </div>
          ))}
        </div>
        <p className={cn('mt-3 text-sm font-medium tabular-nums', soma === 100 ? 'text-primary' : 'text-destructive')}>Soma: {soma}%</p>
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold">Prazos das tarefas</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {PRAZOS.map((p) => (
            <div key={p.chave} className="grid gap-1">
              <Label htmlFor={p.chave} className="text-xs">{p.rotulo}</Label>
              <div className="relative">
                <Input id={p.chave} type="number" min={0} value={Number(f[p.chave] ?? 0)} className="pr-14 tabular-nums"
                  onChange={(e) => setF({ ...f, [p.chave]: Number(e.target.value) })} />
                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">{p.unidade}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
        <h2 className="text-sm font-semibold">Chamados do corretor</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Como o corretor é chamado para uma visita. O prazo de aceite é o "Aceite do corretor" acima.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <label htmlFor="chamado_automatico" className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 sm:col-span-3">
            <Switch id="chamado_automatico" checked={!!f.chamado_automatico} onCheckedChange={(c) => setF({ ...f, chamado_automatico: c })} className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">Chamar automaticamente por padrão</span>
              <span className="block text-xs text-muted-foreground">
                Ao agendar, a chave já vem ligada (a SDR pode desligar na visita). Quem recusa ou não aceita no prazo é trocado pelo próximo do rating.
              </span>
            </span>
          </label>
          <div className="grid gap-1">
            <Label htmlFor="chamado_tentativas" className="text-xs">Corretores chamados antes de avisar a SDR</Label>
            <div className="relative">
              <Input id="chamado_tentativas" type="number" min={1} max={10} value={Number(f.chamado_tentativas ?? 3)} className="pr-14 tabular-nums"
                onChange={(e) => setF({ ...f, chamado_tentativas: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })} />
              <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">x</span>
            </div>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="chamado_reaviso_min" className="text-xs">Reavisar o corretor a cada</Label>
            <div className="relative">
              <Input id="chamado_reaviso_min" type="number" min={1} max={30} value={Number(f.chamado_reaviso_min ?? 5)} className="pr-14 tabular-nums"
                onChange={(e) => setF({ ...f, chamado_reaviso_min: Math.min(30, Math.max(1, Number(e.target.value) || 1)) })} />
              <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">min</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Até 2 reavisos enquanto ele não responder.</p>
          </div>
        </div>
      </section>

      <MensagensAutomaticas f={f} setF={setF} />

      <section className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
        <h2 className="text-sm font-semibold">Equipe</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <fieldset>
            <legend className="text-sm font-medium">Responsáveis (SDR)</legend>
            <p className="mb-2 text-xs text-muted-foreground">Aparecem na coluna Responsável e recebem as tarefas de agendamento.</p>
            <div className="space-y-1">
              {equipe.map((u) => (
                <label key={u.user_id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                  <Checkbox checked={responsaveis.includes(u.user_id)}
                    onCheckedChange={(c) => setF({ ...f, responsaveis: c ? [...responsaveis, u.user_id] : responsaveis.filter((x) => x !== u.user_id) })} />
                  {u.nome} <span className="text-xs text-muted-foreground">({u.papel})</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid content-start gap-1.5">
            <Label>Closer</Label>
            <p className="text-xs text-muted-foreground">Recebe D0, resultado, retornos e no-shows.</p>
            <Select value={(f.closer_user_id as string) ?? ''} onValueChange={(v) => setF({ ...f, closer_user_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{equipe.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <div className="flex justify-end lg:col-span-2">
        <Button disabled={soma !== 100 || salvar.isPending} onClick={() => salvar.mutate()}>
          {salvar.isPending ? <Loader2 className="animate-spin" /> : <Save />} Salvar ajustes
        </Button>
      </div>
    </div>
  );
}

// Mensagens que o sistema sabe mandar sozinho ao cliente (na ordem em que acontecem)
const MENSAGENS_AUTO: { chave: string; quando: string }[] = [
  { chave: 'msg1', quando: 'Ao agendar · confirma os dados da visita' },
  { chave: 'msg2', quando: 'Ao agendar · "visita agendada com sucesso"' },
  { chave: 'msg3', quando: 'Corretor aceitou · apresenta o corretor' },
  { chave: 'msg3b', quando: 'Corretor aceitou · o corretor segue a conversa' },
  { chave: 'd2_cliente', quando: '2 dias antes · lembrete' },
  { chave: 'd1_cliente', quando: '1 dia antes · lembrete' },
  { chave: 'd0_cliente', quando: 'No dia · lembrete' },
  { chave: 'realizada_cliente', quando: 'Depois da visita · agradecimento' },
  { chave: 'noshow_cliente', quando: 'Cliente faltou · remarcar' },
];

function MensagensAutomaticas({ f, setF }: { f: Record<string, unknown>; setF: (v: Record<string, unknown>) => void }) {
  const { data: templates = [] } = useTemplates();
  const { data: numero } = useQuery({
    queryKey: ['comercial', 'numero-conversas'],
    queryFn: async () => {
      const { data } = await supabase.from('conv_numeros').select('nome, status').eq('ativo', true).limit(1).maybeSingle();
      return data;
    },
  });
  const ligado = !!f.mensagens_auto;
  const escolhidas = (f.mensagens_auto_modelos as string[] | null) ?? ['msg1', 'msg3'];
  const teste = /teste/i.test(numero?.nome ?? '');
  const alternar = (chave: string, c: boolean) =>
    setF({ ...f, mensagens_auto_modelos: c ? [...new Set([...escolhidas, chave])] : escolhidas.filter((x) => x !== chave) });

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
      <h2 className="text-sm font-semibold">Mensagens automáticas ao cliente</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Saem pelo número das Conversas, em nome de quem agendou, das 8h às 20h. O texto é o modelo de Mensagens com os dados da visita.
      </p>
      <label htmlFor="mensagens_auto" className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
        <Switch id="mensagens_auto" checked={ligado} onCheckedChange={(c) => setF({ ...f, mensagens_auto: c })} className="mt-0.5" />
        <span>
          <span className="block text-sm font-medium">Enviar sozinho ao cliente</span>
          <span className="block text-xs text-muted-foreground">
            {ligado ? 'Ligado: as mensagens marcadas abaixo saem sem ninguém precisar copiar e colar.' : 'Desligado: nada sai sozinho; a SDR envia pelo painel da visita.'}
            {numero && <> Número: <strong>{numero.nome}</strong>{numero.status !== 'aberto' && ' (desconectado)'}.</>}
          </span>
        </span>
      </label>
      {ligado && teste && (
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> O número conectado é de teste. Os clientes vão receber por ele.
        </p>
      )}
      <ul className={cn('mt-4 grid gap-2 sm:grid-cols-2', !ligado && 'opacity-60')}>
        {MENSAGENS_AUTO.map((m) => {
          const t = templates.find((x) => x.chave === m.chave);
          return (
            <li key={m.chave}>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 hover:bg-muted/50">
                <Checkbox checked={escolhidas.includes(m.chave)} onCheckedChange={(c) => alternar(m.chave, !!c)} className="mt-0.5" disabled={!t} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{m.quando}</span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{t ? t.conteudo.replace(/\*/g, '') : 'Modelo desativado em Mensagens'}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Planilha() {
  const qc = useQueryClient();
  const [confirmar, setConfirmar] = useState<null | { modo: string; aba?: string; titulo: string; texto: string }>(null);
  const painel = useQuery({
    queryKey: ['comercial', 'planilha'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('sheet_sync_painel');
      if (error) throw error;
      return data as {
        fila: number; erros: number; ultimo_envio: string | null; robo_ativo: boolean;
        execucoes: { id: number; modo: string; iniciado_em: string; concluido_em: string | null; enviados: number; erros: number; mensagem: string | null; detalhes: Record<string, unknown> | null }[];
        itens_com_erro: { id: number; aba: string; tentativas: number; erro: string; proxima_tentativa: string }[];
      };
    },
  });
  const executar = useMutation({
    mutationFn: async ({ modo, aba }: { modo: string; aba?: string }) => {
      if (modo === 'reenviar') {
        const { error } = await supabase.rpc('sheet_sync_reenviar');
        if (error) throw error;
        modo = 'enviar';
      }
      const { data, error } = await supabase.functions.invoke('sheets-espelho', { body: { modo, aba } });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        const corpo = ctx ? await ctx.json().catch(() => null) : null;
        throw new Error(corpo?.erro ?? error.message);
      }
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comercial', 'planilha'] }); toast.success('Concluído'); },
    onError: (e) => toast.error((e as Error).message),
  });

  const d = painel.data;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Indicador rotulo="Última sincronização" valor={d?.ultimo_envio ? relativo(d.ultimo_envio) : '—'} detalhe={d?.ultimo_envio ? formatarDataHora(d.ultimo_envio) : undefined} />
        <Indicador rotulo="Itens na fila" valor={String(d?.fila ?? '—')} detalhe="enviados todo dia às 17h30" />
        <Indicador rotulo="Com erro" valor={String(d?.erros ?? '—')} tom={d?.erros ? 'perigo' : undefined} detalhe="retry automático com espera crescente" />
      </div>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><SheetIcon className="h-4 w-4 text-primary" /> Ações</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          A planilha é atualizada uma vez por dia, às 17h30 (com nova tentativa às 17h45 se sobrar algo). A conferência automática noturna está pausada
          enquanto a equipe ainda edita a planilha pela extensão.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" disabled={executar.isPending} onClick={() => executar.mutate({ modo: 'reenviar' })}><RefreshCw /> Enviar fila agora</Button>
          <Button variant="outline" disabled={executar.isPending} onClick={() => executar.mutate({ modo: 'conferencia' })}>Conferir banco × planilha</Button>
          <Button variant="outline" disabled={executar.isPending}
            onClick={() => setConfirmar({ modo: 'reconstruir', aba: 'VISITAS', titulo: 'Reconstruir aba VISITAS?', texto: 'Uma cópia da aba é criada antes. Todas as visitas são regravadas a partir do banco; colunas J e L e colunas sem correspondência não são tocadas.' })}>
            Reconstruir VISITAS
          </Button>
          <Button variant="outline" disabled={executar.isPending}
            onClick={() => setConfirmar({ modo: 'reconstruir', aba: 'LEADS', titulo: 'Reconstruir aba LEADS?', texto: 'Uma cópia da aba é criada antes. Todos os leads são regravados a partir do banco; colunas sem correspondência não são tocadas.' })}>
            Reconstruir LEADS
          </Button>
          <Button variant="outline" disabled={executar.isPending}
            onClick={() => setConfirmar({ modo: 'proteger', titulo: 'Proteger as abas LEADS e VISITAS?', texto: 'Somente a conta de serviço do core (e o dono da planilha) poderão editar. A equipe continua vendo tudo.' })}>
            <ShieldCheck /> Proteger abas
          </Button>
          {executar.isPending && <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Executando…</span>}
        </div>
      </section>

      {!!d?.itens_com_erro.length && (
        <section className="rounded-xl border border-rose-200 bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-rose-700">Itens com erro</h2>
          <ul className="mt-2 divide-y text-sm">
            {d.itens_com_erro.map((i) => <li key={i.id} className="py-2"><strong>{i.aba}</strong> · {i.tentativas} tentativas · {i.erro}<span className="block text-xs text-muted-foreground">próxima tentativa {relativo(i.proxima_tentativa)}</span></li>)}
          </ul>
        </section>
      )}

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold">Execuções recentes</h2>
        {painel.isLoading ? <Skeleton className="mt-3 h-32" /> : (
          <ul className="mt-2 divide-y text-sm">
            {d?.execucoes.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 py-2">
                <span className={cn('h-2 w-2 rounded-full', e.erros ? 'bg-rose-500' : 'bg-primary')} />
                <span className="font-medium">{e.modo}</span>
                <span className="text-muted-foreground">{formatarDataHora(e.iniciado_em)}</span>
                <span className="tabular-nums text-muted-foreground">{e.enviados} enviados · {e.erros} erros</span>
                {e.mensagem && <span className="w-full truncate text-xs text-muted-foreground">{e.mensagem}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <AlertDialog open={!!confirmar} onOpenChange={(v) => !v && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{confirmar?.titulo}</AlertDialogTitle><AlertDialogDescription>{confirmar?.texto}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmar) executar.mutate({ modo: confirmar.modo, aba: confirmar.aba }); setConfirmar(null); }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Indicador({ rotulo, valor, detalhe, tom }: { rotulo: string; valor: string; detalhe?: string; tom?: 'perigo' }) {
  return (
    <div className={cn('rounded-xl border bg-card p-4 shadow-sm', tom === 'perigo' && 'border-rose-200 bg-rose-50/60')}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', tom === 'perigo' && 'text-rose-700')}>{valor}</p>
      {detalhe && <p className="text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

function Duplicados() {
  const { data, isLoading } = useQuery({
    queryKey: ['comercial', 'duplicados'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads_duplicados').select('*').order('quantidade', { ascending: false }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!data?.length) return <EstadoVazio icone={Users} titulo="Nenhum telefone duplicado" />;
  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <p className="border-b px-5 py-3 text-sm text-muted-foreground">
        {data.length} grupos com o mesmo telefone. Nada foi mesclado: abra cada lead, mantenha o correto e arquive os demais.
      </p>
      <ul className="divide-y">
        {data.map((g) => (
          <li key={g.telefone_chave} className="px-5 py-3">
            <p className="text-sm font-semibold tabular-nums">{g.telefone_chave} <span className="font-normal text-muted-foreground">· {g.quantidade} leads</span></p>
            <div className="mt-1 flex flex-wrap gap-2">
              {(g.lead_ids ?? []).map((id: string, i: number) => (
                <Link key={id} to={`/leads/${id}`} className="rounded-full border px-2.5 py-0.5 text-sm hover:border-primary hover:text-primary">
                  {(g.nomes ?? [])[i]}{i === 0 && <span className="ml-1 text-xs text-muted-foreground">(mais antigo)</span>}
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Importacao() {
  const qc = useQueryClient();
  const { data: equipe = [] } = useEquipe();
  const [vincular, setVincular] = useState<Record<string, string>>({});
  const conflitos = useQuery({
    queryKey: ['comercial', 'conflitos'],
    queryFn: async () => {
      const { data, error, count } = await supabase.from('import_conflitos')
        .select('id, aba, linha, campo, valor_core, valor_planilha, lead_id, criado_em', { count: 'exact' })
        .eq('resolvido', false).order('aba').order('linha').limit(300);
      if (error) throw error;
      return { linhas: data ?? [], total: count ?? 0 };
    },
  });
  const pendentes = useQuery({
    queryKey: ['comercial', 'resp-pendentes'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('leads_responsaveis_pendentes');
      if (error) throw error;
      return data ?? [];
    },
  });
  const resolver = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.rpc('import_conflito_resolver', { p_id: id }); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comercial', 'conflitos'] }),
    onError: (e) => toast.error((e as Error).message),
  });
  const vincularResp = useMutation({
    mutationFn: async ({ nome, user }: { nome: string; user: string }) => {
      const { data, error } = await supabase.rpc('leads_vincular_responsavel_importado', { p_nome_planilha: nome, p_user: user });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => { toast.success(`${n} leads vinculados`); qc.invalidateQueries({ queryKey: ['comercial'] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-5">
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold">Responsáveis da planilha sem conta no core</h2>
        <p className="mb-3 text-xs text-muted-foreground">Os nomes ficaram guardados. Quando a pessoa tiver conta, vincule os leads dela aqui.</p>
        {!pendentes.data?.length ? <p className="text-sm text-muted-foreground">Nenhum pendente.</p> : (
          <ul className="space-y-2">
            {pendentes.data.map((p) => (
              <li key={p.nome} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-40 font-medium">{p.nome}</span><span className="w-24 tabular-nums text-muted-foreground">{p.quantidade} leads</span>
                <Select value={vincular[p.nome] ?? ''} onValueChange={(v) => setVincular({ ...vincular, [p.nome]: v })}>
                  <SelectTrigger className="h-9 w-56"><SelectValue placeholder="Vincular a…" /></SelectTrigger>
                  <SelectContent>{equipe.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.nome}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" disabled={!vincular[p.nome] || vincularResp.isPending} onClick={() => vincularResp.mutate({ nome: p.nome, user: vincular[p.nome] })}>Vincular</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card shadow-sm">
        <header className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-sm font-semibold">Conflitos da importação ({conflitos.data?.total ?? 0})</h2>
          <span className="text-xs text-muted-foreground">O core nunca foi sobrescrito: compare e ajuste o lead se a planilha estiver certa.</span>
        </header>
        {conflitos.isLoading ? <Skeleton className="m-5 h-40" /> : !conflitos.data?.linhas.length ? (
          <div className="p-5"><EstadoVazio icone={Copy} titulo="Nenhum conflito pendente" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-2">Aba · linha</th><th className="px-4 py-2">Campo</th><th className="px-4 py-2">No core</th><th className="px-4 py-2">Na planilha</th><th className="px-4 py-2" /></tr>
              </thead>
              <tbody className="divide-y">
                {conflitos.data.linhas.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums">{c.aba} · {c.linha}</td>
                    <td className="px-4 py-2">{c.campo}</td>
                    <td className="max-w-[220px] truncate px-4 py-2">{c.valor_core ?? '—'}</td>
                    <td className="max-w-[220px] truncate px-4 py-2">{c.valor_planilha ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      {c.lead_id && <Button size="sm" variant="ghost" asChild><Link to={`/leads/${c.lead_id}`}>Abrir lead</Link></Button>}
                      <Button size="sm" variant="outline" disabled={resolver.isPending} onClick={() => resolver.mutate(c.id)}>Resolvido</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Robo() {
  const qc = useQueryClient();
  const [confirmar, setConfirmar] = useState<boolean | null>(null);
  const { data } = useQuery({
    queryKey: ['comercial', 'planilha'],
    queryFn: async () => { const { data, error } = await supabase.rpc('sheet_sync_painel'); if (error) throw error; return data as { robo_ativo: boolean }; },
  });
  const definir = useMutation({
    mutationFn: async (ativo: boolean) => { const { error } = await supabase.rpc('fase1_robo_definir', { p_ativo: ativo }); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comercial', 'planilha'] }); toast.success('Automação atualizada'); },
    onError: (e) => toast.error((e as Error).message),
  });
  const ativo = !!data?.robo_ativo;
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <Bot className="mt-1 h-6 w-6 text-muted-foreground" />
        <div className="flex-1">
          <h2 className="font-semibold">Robô de visitas pelo WhatsApp (automação antiga)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Lembretes automáticos, consulta automática de corretores e coleta de nota por resposta. Na Fase 1 ele fica em <strong>stand-by</strong>:
            todas as mensagens são enviadas manualmente pela equipe. O código, os crons e o histórico foram preservados.
          </p>
          {ativo && (
            <p className="mt-3 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4" /> O robô está ligado: ele pode enviar mensagens automáticas para clientes e corretores.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{ativo ? 'Ligado' : 'Stand-by'}</span>
          <Switch checked={ativo} onCheckedChange={(v) => setConfirmar(v)} aria-label="Ligar ou desligar o robô de visitas" />
        </div>
      </div>
      <AlertDialog open={confirmar !== null} onOpenChange={(v) => !v && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmar ? 'Religar o robô de visitas?' : 'Colocar o robô em stand-by?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar ? 'Ele voltará a enviar lembretes e consultas automáticas pelo WhatsApp para visitas agendadas pelo fluxo antigo. As visitas criadas na Fase 1 continuam manuais.'
                : 'Nenhuma mensagem automática será enviada. A equipe segue pelo fluxo manual.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmar !== null) definir.mutate(confirmar); setConfirmar(null); }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
