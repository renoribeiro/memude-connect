import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, Eye, Loader2, Mail, MessageCircle, Save, Send, X, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatarData, formatarDataHora, hojeISO, somarDias } from '@/lib/comercial/datas';

type Relatorio = Tables<'relatorios_automaticos'>;
type Envio = Tables<'relatorios_envios'>;
interface Previa { assunto: string; html: string; whatsapp: string | null; referencia: string; fonte: string }
interface Diagnostico { resend_configurado: boolean; whatsapp?: { estado: string; instancia?: string; erro?: string } }

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function chamar<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('relatorios-automaticos', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const corpo = ctx ? await ctx.json().catch(() => null) : null;
    throw new Error(corpo?.erro ?? error.message);
  }
  return data as T;
}

/** Próximo disparo no horário de Fortaleza, considerando os dias marcados. */
function proximoEnvio(dias: number[], hora: string, agora = new Date()): string | null {
  if (!dias.length) return null;
  const hoje = hojeISO(agora);
  const agoraHM = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(agora);
  for (let i = 0; i < 8; i += 1) {
    const dia = somarDias(hoje, i);
    const semana = new Date(`${dia}T12:00:00Z`).getUTCDay();
    if (dias.includes(semana) && (i > 0 || hora.slice(0, 5) > agoraHM)) {
      const quando = i === 0 ? 'hoje' : i === 1 ? 'amanhã' : `${DIAS[semana].toLowerCase()} ${formatarData(dia).slice(0, 5)}`;
      return `${quando} às ${hora.slice(0, 5)}`;
    }
  }
  return null;
}

export function RelatoriosAutomaticos() {
  const { data: relatorios, isLoading } = useQuery({
    queryKey: ['relatorios-automaticos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('relatorios_automaticos').select('*').order('id');
      if (error) throw error;
      return data;
    },
  });
  const { data: envios = [] } = useQuery({
    queryKey: ['relatorios-envios'],
    queryFn: async () => {
      const { data, error } = await supabase.from('relatorios_envios').select('*').order('criado_em', { ascending: false }).limit(40);
      if (error) throw error;
      return data;
    },
  });
  const { data: diag } = useQuery({
    queryKey: ['relatorios-diagnostico'],
    queryFn: () => chamar<Diagnostico>({ acao: 'diagnostico' }),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const ultimoEmail = envios.find((e) => e.canal === 'email');
  const dominioPendente = ultimoEmail?.status === 'erro' && /not verified|domain/i.test(ultimoEmail.erro ?? '');

  if (isLoading) return <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Canais:</span>
        <StatusCanal icone={Mail} rotulo="E-mail (Resend)" ok={!!diag?.resend_configurado && !dominioPendente}
          texto={!diag ? 'verificando…' : !diag.resend_configurado ? 'sem chave' : dominioPendente ? 'domínio pendente' : 'pronto'} />
        <StatusCanal icone={MessageCircle} rotulo={`WhatsApp${diag?.whatsapp?.instancia ? ` (${diag.whatsapp.instancia})` : ''}`}
          ok={diag?.whatsapp?.estado === 'open'} texto={!diag ? 'verificando…' : diag.whatsapp?.estado === 'open' ? 'conectado' : 'desconectado'} />
      </div>

      {dominioPendente && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4 !text-amber-600" />
          <AlertTitle>E-mail aguardando a verificação do domínio</AlertTitle>
          <AlertDescription className="space-y-1 text-sm">
            <p>O Resend recusou o remetente: {ultimoEmail?.erro?.replace(/^Resend \d+: /, '')}</p>
            <p>
              No painel do Resend, abra <strong>Domains → Add domain</strong>, cadastre <strong>memude.com.br</strong> e copie os registros DNS
              (SPF e DKIM) para o provedor do domínio. Depois que ficar <em>Verified</em>, use "Enviar teste para mim". Até lá, mantenha os
              fluxos do n8n ligados para ninguém ficar sem o relatório.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {(relatorios ?? []).map((r) => (
          <CartaoRelatorio key={r.id} relatorio={r} envios={envios.filter((e) => e.relatorio === r.id)} whatsappConectado={diag?.whatsapp?.estado === 'open'} />
        ))}
      </div>
    </div>
  );
}

function StatusCanal({ icone: Icone, rotulo, ok, texto }: { icone: typeof Mail; rotulo: string; ok: boolean; texto: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
      ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800')}>
      <Icone className="h-3.5 w-3.5" />{rotulo}: {texto}
    </span>
  );
}

function CartaoRelatorio({ relatorio, envios, whatsappConectado }: { relatorio: Relatorio; envios: Envio[]; whatsappConectado: boolean }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(relatorio);
  const [novoEmail, setNovoEmail] = useState('');
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [confirmarWhats, setConfirmarWhats] = useState(false);
  useEffect(() => setForm(relatorio), [relatorio]);

  const diario = relatorio.id === 'diario';
  const sujo = useMemo(() => JSON.stringify(form) !== JSON.stringify(relatorio), [form, relatorio]);
  const proximo = form.ativo ? proximoEnvio(form.dias_semana, form.hora) : null;
  const set = <K extends keyof Relatorio>(k: K, v: Relatorio[K]) => setForm((f) => ({ ...f, [k]: v }));

  const salvar = useMutation({
    mutationFn: async (dados: Partial<Relatorio>) => {
      const { error } = await supabase.rpc('relatorio_salvar', { p_id: relatorio.id, p_dados: dados as never });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['relatorios-automaticos'] }); toast.success('Relatório salvo'); },
    onError: (e: Error) => toast.error(e.message),
  });
  const verPrevia = useMutation({
    mutationFn: () => chamar<Previa>({ acao: 'previa', relatorio: relatorio.id }),
    onSuccess: setPrevia,
    onError: (e: Error) => toast.error(e.message),
  });
  const teste = useMutation({
    mutationFn: (canal: 'email' | 'whatsapp') => chamar<{ destinatarios: string[] }>({ acao: 'teste', relatorio: relatorio.id, canal }),
    onSuccess: (r, canal) => toast.success(canal === 'email' ? `Teste enviado para ${r.destinatarios.join(', ')}` : 'Teste enviado no WhatsApp'),
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => qc.invalidateQueries({ queryKey: ['relatorios-envios'] }),
  });

  const adicionarEmail = () => {
    const novos = novoEmail.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
    const invalidos = novos.filter((e) => !EMAIL.test(e));
    if (invalidos.length) { toast.error(`E-mail inválido: ${invalidos.join(', ')}`); return; }
    set('destinatarios', Array.from(new Set([...form.destinatarios, ...novos])));
    setNovoEmail('');
  };
  const teclaEmail = (e: KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', ';'].includes(e.key)) { e.preventDefault(); adicionarEmail(); }
  };

  const salvarTudo = () => {
    if (!form.dias_semana.length) { toast.error('Escolha pelo menos um dia'); return; }
    const { dias_semana, hora, destinatarios, enviar_email, enviar_whatsapp, whatsapp_destino, meta_visitas_dia, fonte_dados, remetente } = form;
    salvar.mutate({ dias_semana, hora, destinatarios, enviar_email, enviar_whatsapp, whatsapp_destino, meta_visitas_dia, fonte_dados, remetente });
  };

  return (
    <Card className={cn('flex flex-col', !form.ativo && 'opacity-80')}>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">{relatorio.nome}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{relatorio.descricao}</p>
          <p className="text-xs font-medium text-primary">{proximo ? `Próximo envio: ${proximo}` : 'Pausado — nenhum envio programado'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`ativo-${relatorio.id}`} className="text-xs text-muted-foreground">{form.ativo ? 'Ativo' : 'Pausado'}</Label>
          <Switch id={`ativo-${relatorio.id}`} checked={form.ativo} disabled={salvar.isPending}
            onCheckedChange={(v) => { set('ativo', v); salvar.mutate({ ativo: v }); }} aria-label="Ativar envio automático" />
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <Label>Dias de envio</Label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dias da semana">
              {DIAS.map((d, i) => {
                const marcado = form.dias_semana.includes(i);
                return (
                  <button key={d} type="button" aria-pressed={marcado}
                    onClick={() => set('dias_semana', marcado ? form.dias_semana.filter((x) => x !== i) : [...form.dias_semana, i].sort())}
                    className={cn('h-8 w-11 rounded-md border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      marcado ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted')}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`hora-${relatorio.id}`}>Horário</Label>
            <Input id={`hora-${relatorio.id}`} type="time" className="w-28" value={form.hora.slice(0, 5)} onChange={(e) => set('hora', e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`email-${relatorio.id}`}>Destinatários ({form.destinatarios.length})</Label>
          <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-card p-1.5 focus-within:ring-2 focus-within:ring-ring">
            {form.destinatarios.map((e) => (
              <Badge key={e} variant="outline" className="gap-1 bg-muted pr-1 font-normal">
                {e}
                <button type="button" className="rounded-sm p-0.5 hover:bg-muted-foreground/20" aria-label={`Remover ${e}`}
                  onClick={() => set('destinatarios', form.destinatarios.filter((x) => x !== e))}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <input id={`email-${relatorio.id}`} value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} onKeyDown={teclaEmail}
              onBlur={() => novoEmail && adicionarEmail()} placeholder="Adicionar e-mail e Enter"
              className="min-w-[180px] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Canais</Label>
          <div className="divide-y rounded-md border">
            <div className="flex items-center justify-between gap-3 p-3">
              <span className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" />E-mail</span>
              <Switch checked={form.enviar_email} onCheckedChange={(v) => set('enviar_email', v)} aria-label="Enviar por e-mail" />
            </div>
            {diario ? (
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />WhatsApp (grupo)
                    {!whatsappConectado && <Badge variant="outline" className="text-[10px]">Evolution desconectada</Badge>}
                  </span>
                  <Switch checked={form.enviar_whatsapp} onCheckedChange={(v) => set('enviar_whatsapp', v)} aria-label="Enviar no WhatsApp" />
                </div>
                {form.enviar_whatsapp && (
                  <Input value={form.whatsapp_destino ?? ''} onChange={(e) => set('whatsapp_destino', e.target.value)}
                    placeholder="ID do grupo (…@g.us) ou número com DDI" aria-label="Destino no WhatsApp" />
                )}
              </div>
            ) : (
              <p className="p-3 text-xs text-muted-foreground">O semanal tem gráficos e vai só por e-mail.</p>
            )}
          </div>
        </div>

        <Collapsible>
          <CollapsibleTrigger className="group flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />Mais opções
          </CollapsibleTrigger>
          <CollapsibleContent className="grid gap-4 pt-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Fonte dos números</Label>
              <Select value={form.fonte_dados} onValueChange={(v) => set('fonte_dados', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planilha">Planilha CRM MeMude 2025</SelectItem>
                  <SelectItem value="core">Sistema (core)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Use "Planilha" enquanto a extensão ainda grava só nela.</p>
            </div>
            {diario && (
              <div className="space-y-1.5">
                <Label htmlFor={`meta-${relatorio.id}`}>Meta de visitas por dia</Label>
                <Input id={`meta-${relatorio.id}`} type="number" min={0} max={100} className="w-24" value={form.meta_visitas_dia}
                  onChange={(e) => set('meta_visitas_dia', Math.max(0, Number(e.target.value) || 0))} />
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`rem-${relatorio.id}`}>Remetente</Label>
              <Input id={`rem-${relatorio.id}`} value={form.remetente} onChange={(e) => set('remetente', e.target.value)} />
              <p className="text-xs text-muted-foreground">Precisa ser de um domínio verificado no Resend.</p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Historico envios={envios} />
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => verPrevia.mutate()} disabled={verPrevia.isPending}>
            {verPrevia.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Eye className="mr-1.5 h-4 w-4" />}Pré-visualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => teste.mutate('email')} disabled={teste.isPending}>
            {teste.isPending && teste.variables === 'email' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
            Enviar teste para mim
          </Button>
          {diario && whatsappConectado && relatorio.whatsapp_destino && (
            <Button variant="ghost" size="sm" onClick={() => setConfirmarWhats(true)} disabled={teste.isPending}>
              <MessageCircle className="mr-1.5 h-4 w-4" />Teste no grupo
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {sujo && <span className="text-xs text-amber-700">Alterações não salvas</span>}
          {sujo && <Button variant="ghost" size="sm" onClick={() => setForm(relatorio)}>Descartar</Button>}
          <Button size="sm" onClick={salvarTudo} disabled={!sujo || salvar.isPending}>
            {salvar.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}Salvar
          </Button>
        </div>
      </CardFooter>

      <Dialog open={!!previa} onOpenChange={(o) => !o && setPrevia(null)}>
        <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col">
          <DialogHeader>
            <DialogTitle>{previa?.assunto}</DialogTitle>
            <DialogDescription>Prévia com os dados de agora · fonte: {previa?.fonte === 'core' ? 'sistema' : 'planilha'}</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="email" className="flex min-h-0 flex-1 flex-col">
            {previa?.whatsapp && (
              <TabsList className="self-start"><TabsTrigger value="email">E-mail</TabsTrigger><TabsTrigger value="whatsapp">WhatsApp</TabsTrigger></TabsList>
            )}
            <TabsContent value="email" className="min-h-0 flex-1">
              <iframe title="Prévia do e-mail" sandbox="" srcDoc={previa?.html} className="h-[70vh] w-full rounded-md border bg-[#f7f7f7]" />
            </TabsContent>
            <TabsContent value="whatsapp" className="min-h-0 flex-1 overflow-y-auto">
              <div className="rounded-md bg-[#e5ddd5] p-4">
                <pre className="max-w-md whitespace-pre-wrap rounded-lg bg-card p-3 font-sans text-sm shadow-sm">{previa?.whatsapp}</pre>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarWhats} onOpenChange={setConfirmarWhats}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar teste no grupo do WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>A mensagem de teste vai para {relatorio.whatsapp_destino} e todos do grupo verão.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => teste.mutate('whatsapp')}>Enviar teste</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function Historico({ envios }: { envios: Envio[] }) {
  if (!envios.length) return <p className="text-xs text-muted-foreground">Nenhum envio registrado ainda.</p>;
  return (
    <div className="space-y-1.5">
      <Label>Últimos envios</Label>
      <ul className="max-h-40 space-y-1 overflow-y-auto pr-1 text-xs">
        {envios.slice(0, 8).map((e) => (
          <li key={e.id} className="flex items-start gap-2 rounded px-1 py-0.5">
            {e.status === 'enviado' ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />}
            <span className="shrink-0 tabular-nums text-muted-foreground">{formatarDataHora(e.criado_em)}</span>
            <span className="shrink-0">{e.canal === 'email' ? 'E-mail' : 'WhatsApp'}{e.teste ? ' · teste' : ''}</span>
            {e.erro && <span className="min-w-0 truncate text-destructive" title={e.erro}>{e.erro}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
