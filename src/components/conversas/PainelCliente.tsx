import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlarmClock, Archive, ArchiveRestore, ArrowRightLeft, Building2, CalendarPlus, Check, ClipboardList, Copy, ExternalLink, Hand, History,
  Loader2, MoveRight, Sparkles, UserRoundPlus, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AgendarVisitaDialog } from '@/components/comercial/AgendarVisitaDialog';
import { haQuanto, telefoneLegivel } from '@/lib/conversas/formato';
import { ETAPAS, PAPEL_DONO, TIPO_ALERTA, type Sugestao } from '@/lib/conversas/tipos';
import {
  useAlertas, useArquivar, useAssumir, useConversa, useDecidirSugestao, useHistoricoDono, useMoverEtapa, useResolverAlerta, useSugestoes,
} from '@/hooks/conversas/dados';
import { useAuth } from '@/hooks/useAuth';
import { AvatarContato, Temperatura } from './pecas';
import { TransferirDialog } from './TransferirDialog';
import { VincularLead } from './VincularLead';

const ICONE: Record<string, typeof Sparkles> = { crm: ClipboardList, etapa: MoveRight, lembrete: AlarmClock, empreendimento: Building2, resposta: Sparkles };
const ROTULO_CAMPO: Record<string, string> = {
  renda: 'Renda', entrada_fgts: 'Entrada/FGTS', prazo: 'Prazo', finalidade: 'Finalidade', regiao: 'Região', status_atendimento: 'Status',
};
const moeda = (v: number | null | undefined) => (v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : null);

function CartaoSugestao({ s }: { s: Sugestao }) {
  const decidir = useDecidirSugestao();
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const Icone = ICONE[s.tipo] ?? Sparkles;
  const c = (s.conteudo ?? {}) as Record<string, unknown>;
  const ocupado = decidir.isPending;
  const campos = s.tipo === 'crm'
    ? [...(c.status_atendimento ? [['status_atendimento', String(c.status_atendimento)]] : []),
      ...Object.entries((c.qualificacao ?? {}) as Record<string, string>)]
    : [];
  const itens = s.tipo === 'empreendimento' ? (c.itens as { id: string; nome: string; valor_min: number | null; afinidade: number }[] ?? []) : [];

  return (
    <div className="rounded-2xl border border-mm-borda-suave bg-card p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 rounded-lg bg-mm-lilas p-1 text-primary"><Icone className="h-3.5 w-3.5" aria-hidden /></span>
        <p className="flex-1 text-sm font-bold leading-snug">{s.titulo}</p>
      </div>
      {campos.length > 0 && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-muted p-2.5 text-xs">
          {campos.map(([k, v]) => (
            <div key={k} className="contents"><dt className="text-muted-foreground">{ROTULO_CAMPO[k] ?? k}</dt><dd className="font-bold">{v}</dd></div>
          ))}
        </dl>
      )}
      {s.tipo === 'lembrete' && Boolean(c.quando) && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(String(c.quando)))}
          {' · vai para a sua agenda'}
        </p>
      )}
      {itens.length > 0 && (
        <div className="mt-2 space-y-1" role="radiogroup" aria-label="Imóveis sugeridos">
          {itens.map((i) => (
            <button key={i.id} type="button" role="radio" aria-checked={escolhido === i.id} onClick={() => setEscolhido(i.id)}
              className={cn('flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs transition',
                escolhido === i.id ? 'border-primary bg-mm-lilas' : 'border-mm-borda-suave hover:bg-muted')}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{i.nome}</span>
                {moeda(i.valor_min) && <span className="text-muted-foreground">a partir de <span className="preco text-primary">{moeda(i.valor_min)}</span></span>}
              </span>
              <span className="shrink-0 rounded-full bg-mm-sucesso-fundo px-1.5 py-0.5 text-[11px] font-extrabold text-mm-sucesso tabular-nums">{i.afinidade}%</span>
            </button>
          ))}
        </div>
      )}
      <div className="mt-2.5 flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" className="h-8" disabled={ocupado} onClick={() => decidir.mutate({ id: s.id, aceitar: false })}>
          <X className="h-3.5 w-3.5" /> Descartar
        </Button>
        <Button size="sm" variant="acao" className="h-8" disabled={ocupado || (s.tipo === 'empreendimento' && !escolhido)}
          onClick={() => decidir.mutate({ id: s.id, aceitar: true, valor: s.tipo === 'empreendimento' ? { ...c, escolhido } : undefined })}>
          {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {s.tipo === 'empreendimento' ? 'Definir interesse' : s.tipo === 'lembrete' ? 'Criar lembrete' : 'Aplicar'}
        </Button>
      </div>
    </div>
  );
}

function Secao({ titulo, icone: Icone, children, extra }: { titulo: string; icone: typeof Sparkles; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-[15px] text-foreground">
        <Icone className="h-4 w-4 text-primary" aria-hidden /> {titulo} {extra && <span className="ml-auto font-normal tracking-normal">{extra}</span>}
      </h3>
      {children}
    </section>
  );
}

/** Ficha da conversa: cliente, IA, alertas e ações (direita no computador, gaveta no celular). */
export function PainelCliente({ conversaId, equipe }: { conversaId: string; equipe: boolean }) {
  const { user } = useAuth();
  const { data: conv, isLoading } = useConversa(conversaId);
  const { data: sugestoes = [] } = useSugestoes(conversaId);
  const { data: alertas = [] } = useAlertas();
  const { data: historico = [] } = useHistoricoDono(conversaId);
  const assumir = useAssumir();
  const arquivar = useArquivar();
  const mover = useMoverEtapa();
  const resolver = useResolverAlerta();
  const [transferindo, setTransferindo] = useState(false);
  const [agendando, setAgendando] = useState(false);

  if (isLoading || !conv) {
    return <div className="space-y-3 p-4"><Skeleton className="mx-auto h-20 w-20 rounded-full" /><Skeleton className="h-5 w-2/3 mx-auto" /><Skeleton className="h-24 w-full" /></div>;
  }
  const lead = conv.leads as unknown as { id: string; nome: string; status_atendimento: string | null; empreendimento_id: string | null; fonte: string | null; observacoes: string | null; empreendimentos: { nome: string } | null } | null;
  const numero = conv.conv_numeros as unknown as { nome: string; status: string } | null;
  const nome = lead?.nome || conv.nome_contato || telefoneLegivel(conv.telefone);
  const minha = conv.dono_id === user?.id;
  const meusAlertas = alertas.filter((a) => a.conversa_id === conversaId);
  const outras = sugestoes.filter((s) => s.tipo !== 'resposta');

  const copiar = () => navigator.clipboard.writeText(telefoneLegivel(conv.telefone)).then(() => toast.success('Telefone copiado'));

  return (
    <div className="space-y-5 p-4">
      <div className="text-center">
        <AvatarContato nome={nome} chave={conversaId} tamanho="xl" className="mx-auto" />
        <h2 className="mt-2 text-xl leading-tight">{nome}</h2>
        <button type="button" onClick={copiar} className="mt-0.5 inline-flex items-center gap-1 rounded-md px-1 text-sm text-muted-foreground hover:text-primary">
          {telefoneLegivel(conv.telefone)} <Copy className="h-3 w-3" aria-label="Copiar telefone" />
        </button>
        <div className="mt-2 flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <Temperatura valor={conv.temperatura} comRotulo />
          {numero && <span>via {numero.nome}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {equipe && !minha && (
          <Button variant="contorno" size="sm" className="h-10" onClick={() => assumir.mutate(conversaId)} disabled={assumir.isPending}>
            <Hand className="h-4 w-4" /> Assumir
          </Button>
        )}
        {equipe && (
          <Button variant="outline" size="sm" className="h-10" onClick={() => setTransferindo(true)}>
            <ArrowRightLeft className="h-4 w-4" /> Transferir
          </Button>
        )}
        {lead && equipe && (
          <Button variant="outline" size="sm" className="h-10" onClick={() => setAgendando(true)}>
            <CalendarPlus className="h-4 w-4" /> Agendar visita
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-10" disabled={arquivar.isPending}
          onClick={() => arquivar.mutate({ id: conversaId, arquivar: !conv.arquivada })}>
          {conv.arquivada ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />} {conv.arquivada ? 'Desarquivar' : 'Arquivar'}
        </Button>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="etapa-conversa" className="text-[13px] font-semibold">Etapa</label>
        <Select value={conv.etapa} onValueChange={(v) => mover.mutate({ id: conversaId, etapa: v })}>
          <SelectTrigger id="etapa-conversa" className="h-12 font-semibold"><SelectValue /></SelectTrigger>
          <SelectContent className="tema-memude rounded-2xl">
            {ETAPAS.map((e) => (
              <SelectItem key={e.valor} value={e.valor}>
                <span className="flex items-center gap-2"><span className={cn('h-2 w-2 rounded-full', e.ponto)} />{e.rotulo}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          Com {PAPEL_DONO[conv.dono_papel] ?? conv.dono_papel}{minha ? ' (você)' : ''}. Visita agendada e Visita realizada mudam sozinhas.
        </p>
      </div>

      {meusAlertas.length > 0 && (
        <Secao titulo="Alertas" icone={AlarmClock}>
          {meusAlertas.map((a) => (
            <div key={a.id} className={cn('flex items-start gap-2 rounded-[14px] border p-2.5 text-sm',
              TIPO_ALERTA[a.tipo]?.tom === 'sucesso' ? 'border-mm-sucesso/20 bg-mm-sucesso-fundo' : 'border-mm-borda-rosa bg-mm-rosa-palido')}>
              <div className="min-w-0 flex-1">
                <p className={cn('font-bold', TIPO_ALERTA[a.tipo]?.tom === 'sucesso' ? 'text-mm-sucesso' : 'text-mm-rosa-texto')}>{TIPO_ALERTA[a.tipo]?.rotulo ?? a.tipo}</p>
                <p className="text-xs text-muted-foreground">{a.detalhe ?? a.titulo} · {haQuanto(a.criado_em)}</p>
              </div>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => resolver.mutate(a.id)}>Resolvido</Button>
            </div>
          ))}
        </Secao>
      )}

      {conv.resumo_ia && (
        <Secao titulo="Resumo da IA" icone={Sparkles}>
          <p className="rounded-[14px] bg-mm-lilas p-3 text-sm leading-relaxed text-foreground">{conv.resumo_ia}</p>
        </Secao>
      )}

      {outras.length > 0 && (
        <Secao titulo="Sugestões da IA" icone={Sparkles} extra={<span className="text-[11px] text-muted-foreground">a ficha se atualiza sozinha; estas dependem de você</span>}>
          <div className="space-y-2">{outras.map((s) => <CartaoSugestao key={s.id} s={s} />)}</div>
        </Secao>
      )}

      <Secao titulo="Lead no CRM" icone={ClipboardList}>
        {lead ? (
          <div className="rounded-2xl border border-mm-borda-suave p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">{lead.nome}</span>
              {lead.status_atendimento && <span className="rounded-full bg-mm-lilas px-2 py-0.5 text-[11px] font-extrabold text-primary">{lead.status_atendimento}</span>}
            </div>
            {lead.empreendimentos?.nome && <p className="mt-1 text-xs text-muted-foreground">Interesse: {lead.empreendimentos.nome}</p>}
            {equipe && (
              <Button asChild variant="link" size="sm" className="mt-1 h-auto p-0 text-xs text-mm-acao">
                <Link to={`/leads/${lead.id}`}>Abrir ficha completa <ExternalLink className="h-3 w-3" /></Link>
              </Button>
            )}
          </div>
        ) : equipe ? <VincularLead conversaId={conversaId} /> : <p className="text-sm text-muted-foreground">Sem lead vinculado.</p>}
      </Secao>

      {historico.length > 0 && (
        <Secao titulo="Quem atendeu" icone={History}>
          <ol className="space-y-1.5 border-l-2 border-mm-divisor pl-3 text-xs">
            {historico.map((h) => (
              <li key={h.id}>
                <span className="font-semibold">{h.motivo}</span>
                <span className="text-muted-foreground"> · {PAPEL_DONO[h.dono_papel] ?? h.dono_papel} · {haQuanto(h.criado_em)}</span>
              </li>
            ))}
          </ol>
        </Secao>
      )}

      {!lead && !equipe && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><UserRoundPlus className="h-3.5 w-3.5" /> A equipe vincula o cliente ao CRM.</p>
      )}

      {equipe && <TransferirDialog key={conversaId} aberto={transferindo} aoFechar={() => setTransferindo(false)} conversaId={conversaId} donoAtual={conv.dono_id} />}
      {lead && agendando && (
        <AgendarVisitaDialog aberto={agendando} onOpenChange={setAgendando}
          lead={{ id: lead.id, nome: lead.nome, empreendimento_id: lead.empreendimento_id, fonte: lead.fonte, observacoes: lead.observacoes }}
          onAgendada={() => toast.success('Visita agendada. O corretor recebe o convite no app.')} />
      )}
    </div>
  );
}
