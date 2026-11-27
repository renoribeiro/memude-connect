import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, CalendarPlus, ChevronDown, History, Kanban, Loader2, MessageCircle, Save, CalendarDays, FileSpreadsheet,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAtualizarLead, useEmpreendimentos, useEquipe, useLead } from '@/hooks/comercial/dados';
import { FONTES, STATUS_ATENDIMENTO } from '@/lib/comercial/constantes';
import { formatarData, formatarDataHora, formatarHora } from '@/lib/comercial/datas';
import { telefoneCanonico } from '@/lib/comercial/telefone';
import { AgendarVisitaDialog } from '@/components/comercial/AgendarVisitaDialog';
import { VisitasDoCliente } from '@/components/comercial/VisitasDoCliente';
import { AcompanhamentoIA, type ConversaIA, type MudancaIA } from '@/components/comercial/AcompanhamentoIA';
import { VisitaPainel } from '@/components/comercial/VisitaPainel';
import { useAbrirVisita } from '@/hooks/comercial/useAbrirVisita';
import { ComboboxBusca, EstadoVazio, StatusAtendimentoBadge, StatusVisitaBadge } from '@/components/comercial/ui';
import { nomeCorretor } from '@/lib/comercial/nomes';

export default function LeadPerfilPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useLead(id);
  const { data: equipe = [] } = useEquipe();
  const { data: empreendimentos = [] } = useEmpreendimentos();
  const atualizar = useAtualizarLead();
  const abrirVisita = useAbrirVisita();
  const [agendar, setAgendar] = useState(false);
  const [form, setForm] = useState<Record<string, string | null>>({});

  const lead = data?.lead;
  useEffect(() => {
    if (lead) setForm({
      nome: lead.nome, telefone: lead.telefone_exibicao ?? lead.telefone, email: lead.email ?? '', fonte: lead.fonte,
      status_atendimento: lead.status_atendimento, responsavel_id: lead.responsavel_id, empreendimento_id: lead.empreendimento_id,
      observacoes: lead.observacoes ?? '',
    });
  }, [lead?.id, lead?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const nomes = useMemo(() => new Map(equipe.map((u) => [u.user_id, u.nome])), [equipe]);
  const responsaveis = equipe.filter((u) => u.responsavel);

  if (isLoading) return <DashboardLayout><div className="mx-auto max-w-6xl space-y-4"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-64 w-full" /></div></DashboardLayout>;
  if (isError || !lead) return <DashboardLayout><EstadoVazio icone={AlertTriangle} titulo="Lead não encontrado" acao={<Button asChild variant="outline"><Link to="/leads">Voltar para Leads</Link></Button>} /></DashboardLayout>;

  const original: Record<string, string | null> = {
    nome: lead.nome, telefone: lead.telefone_exibicao ?? lead.telefone, email: lead.email ?? '', fonte: lead.fonte,
    status_atendimento: lead.status_atendimento, responsavel_id: lead.responsavel_id, empreendimento_id: lead.empreendimento_id,
    observacoes: lead.observacoes ?? '',
  };
  const alterados = Object.fromEntries(Object.entries(form).filter(([k, v]) => (v ?? '') !== (original[k] ?? '')));
  const extra = (lead.planilha_extra ?? null) as Record<string, unknown> | null;
  const wa = telefoneCanonico(lead.telefone);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-5">
        <Link to="/leads" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Leads</Link>

        <header className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold tracking-tight">{lead.nome}</h1>
              <StatusAtendimentoBadge status={lead.status_atendimento} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="tabular-nums">{lead.telefone_exibicao}</span>
              {lead.fonte && ` · ${lead.fonte}`} · entrada {formatarData(lead.data_entrada)}
              {lead.responsavel_id && ` · ${nomes.get(lead.responsavel_id) ?? ''}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {wa && <Button variant="outline" asChild><a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer noopener"><MessageCircle /> WhatsApp</a></Button>}
            <Button onClick={() => setAgendar(true)}><CalendarPlus /> Agendar visita</Button>
          </div>
        </header>

        {lead.telefone_chave_conflito && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
            <p><strong>Telefone duplicado.</strong> Outro lead ativo usa este número. Nada foi mesclado automaticamente — decida em <Link to="/comercial/ajustes?aba=duplicados" className="font-medium underline">Ajustes › Duplicados</Link>.</p>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Dados do lead</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Nome" id="lp-nome"><Input id="lp-nome" value={form.nome ?? ''} maxLength={120} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Campo>
              <Campo rotulo="Telefone" id="lp-tel"><Input id="lp-tel" inputMode="tel" value={form.telefone ?? ''} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Campo>
              <Campo rotulo="E-mail" id="lp-email"><Input id="lp-email" type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Campo>
              <Campo rotulo="Fonte">
                <Select value={form.fonte ?? undefined} onValueChange={(v) => setForm({ ...form, fonte: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{FONTES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </Campo>
              <Campo rotulo="Status">
                <Select value={form.status_atendimento ?? 'NOVO'} onValueChange={(v) => setForm({ ...form, status_atendimento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_ATENDIMENTO.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Campo>
              <Campo rotulo="Responsável">
                <Select value={form.responsavel_id ?? 'nenhum'} onValueChange={(v) => setForm({ ...form, responsavel_id: v === 'nenhum' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Sem responsável</SelectItem>
                    {responsaveis.map((r) => <SelectItem key={r.user_id} value={r.user_id}>{r.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Campo>
              <Campo rotulo="Empreendimento" className="sm:col-span-2">
                <ComboboxBusca opcoes={empreendimentos.map((e) => ({ valor: e.id, rotulo: e.nome, detalhe: e.bairro }))} permitirLimpar
                  valor={form.empreendimento_id ?? null} onChange={(v) => setForm({ ...form, empreendimento_id: v })} />
              </Campo>
              <Campo rotulo="Observações" id="lp-obs" className="sm:col-span-2">
                <Textarea id="lp-obs" rows={4} maxLength={4000} value={form.observacoes ?? ''} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </Campo>
            </div>
            <div className="flex items-center justify-end gap-2">
              {Object.keys(alterados).length > 0 && <Button variant="ghost" onClick={() => setForm(original)}>Descartar</Button>}
              <Button disabled={!Object.keys(alterados).length || atualizar.isPending}
                onClick={() => atualizar.mutate({ id: lead.id, campos: alterados })}>
                {atualizar.isPending ? <Loader2 className="animate-spin" /> : <Save />} Salvar alterações
              </Button>
            </div>

            {extra && Object.keys(extra).length > 0 && (
              <Collapsible className="rounded-lg border bg-muted/40">
                <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" /> Dados herdados da planilha
                  <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 pb-3">
                  <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                    {Object.entries((extra.original as Record<string, unknown>) ?? extra).flatMap(([k, v]) =>
                      v && typeof v === 'object' ? Object.entries(v as Record<string, string>) : [[k, v]])
                      .filter(([, v]) => v !== '' && v !== null && v !== undefined)
                      .map(([k, v]) => (
                        <div key={String(k)} className="flex gap-2"><dt className="shrink-0 capitalize text-muted-foreground">{String(k)}:</dt><dd className="truncate">{String(v)}</dd></div>
                      ))}
                  </dl>
                </CollapsibleContent>
              </Collapsible>
            )}
          </section>

          <div className="space-y-5">
            <AcompanhamentoIA leadId={lead.id} conversa={(data.conversa || lead.perfil_ia) ? {
                ...((data.conversa ?? { id: '', etapa: 'em_atendimento', ia_analisada_em: null, ultima_mensagem_em: null }) as ConversaIA),
                // Perfil único do cliente (o mesmo do CRM, da visita e do app)
                resumo_ia: lead.perfil_ia ?? data.conversa?.resumo_ia ?? null,
                ia_falta: lead.perfil_falta ?? data.conversa?.ia_falta ?? null,
                temperatura: lead.perfil_temperatura ?? data.conversa?.temperatura ?? null,
                ia_analisada_em: lead.perfil_ia_em ?? data.conversa?.ia_analisada_em ?? null,
              } : null}
              qualificacao={(lead.qualificacao ?? null) as Record<string, unknown> | null} mudancas={data.mudancasIa as MudancaIA[]} nomes={nomes} />

            {/* Histórico de visitas unificado (o mesmo do CRM e da Agenda): perfil da SDR, como foi segundo o corretor e próximo passo */}
            <div className="space-y-2">
              <VisitasDoCliente leadId={lead.id} aoAbrir={abrirVisita} className="p-5 shadow-sm" />
              <button type="button" onClick={() => setAgendar(true)} className="text-sm font-medium text-primary hover:underline">+ Agendar visita</button>
            </div>

            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Kanban className="h-4 w-4 text-primary" /> Oportunidades no funil</h2>
              {!data.oportunidades.length ? <p className="text-sm text-muted-foreground">Nenhuma oportunidade.</p> : (
                <ul className="space-y-2">
                  {data.oportunidades.map((o) => {
                    const etapa = o.crm_stages as { nome: string; cor: string | null } | null;
                    return (
                      <li key={o.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: etapa?.cor ?? '#94a3b8' }} />
                        <span className="min-w-0 flex-1 truncate">{(o.empreendimentos as { nome: string } | null)?.nome ?? 'Sem empreendimento'}
                          <span className="block text-xs text-muted-foreground">{(o.crm_pipelines as { nome: string } | null)?.nome}</span></span>
                        <span className="font-medium">{etapa?.nome}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-2 text-xs text-muted-foreground">A etapa do funil não muda por causa de uma visita: mova o card no CRM.</p>
            </section>

            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4 text-primary" /> Histórico</h2>
              {!data.eventos.length ? <p className="text-sm text-muted-foreground">Sem alterações registradas.</p> : (
                <ol className="relative space-y-3 border-l pl-4">
                  {data.eventos.map((e) => (
                    <li key={e.id} className="relative">
                      <span className={cn('absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white', e.tipo === 'status' ? 'bg-primary' : 'bg-slate-400')} />
                      <p className="text-sm">
                        {e.tipo === 'nota' ? <><strong>Nota</strong>: {e.observacao}</>
                          : e.campo ? <><strong>{e.campo}</strong>: {e.de ?? '—'} → {e.para ?? '—'}</> : e.observacao}
                      </p>
                      {e.campo && e.tipo !== 'nota' && e.observacao && <p className="text-xs text-muted-foreground">{e.observacao}</p>}
                      <p className="text-xs text-muted-foreground">{formatarDataHora(e.criado_em)}{e.ator_id && ` · ${nomes.get(e.ator_id) ?? 'equipe'}`}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </div>
      </div>

      {agendar && (
        <AgendarVisitaDialog aberto onOpenChange={setAgendar}
          lead={{ id: lead.id, nome: lead.nome, empreendimento_id: lead.empreendimento_id, fonte: lead.fonte, observacoes: lead.observacoes }}
          onAgendada={(vid) => abrirVisita(vid)} />
      )}
      <VisitaPainel />
    </DashboardLayout>
  );
}

function Campo({ rotulo, id, className, children }: { rotulo: string; id?: string; className?: string; children: React.ReactNode }) {
  return <div className={cn('grid gap-1.5', className)}><Label htmlFor={id}>{rotulo}</Label>{children}</div>;
}
