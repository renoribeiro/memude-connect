import { useMemo, useState } from 'react';
import { Check, ChevronDown, Clock, Copy, MessageCircle, Send, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatarDataHora } from '@/lib/comercial/datas';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { registrarUsoMensagem, useTemplates } from '@/hooks/comercial/dados';
import {
  type DadosMensagem, type Destino, linkMensagem, MOMENTOS, type Momento, momentoAtual, renderizar,
} from '@/lib/comercial/mensagens';

const ROTULO_DESTINO: Record<Destino, string> = { cliente: 'Cliente', corretor: 'Corretor', grupo: 'Grupo' };

interface Auto { template: string; status: string; enviar_em: string; enviada_em: string | null; erro: string | null }

/** Envio automático ao cliente (pelo número da MeMude): o que já saiu e o que está programado. */
function useAutomaticas(visitaId: string) {
  return useQuery({
    queryKey: ['comercial', 'mensagens-auto', visitaId],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('visita_mensagens_auto')
        .select('template, status, enviar_em, enviada_em, erro').eq('visita_id', visitaId).order('enviar_em', { ascending: false });
      if (error) return new Map<string, Auto>();
      const m = new Map<string, Auto>();
      (data ?? []).forEach((a) => { if (!m.has(a.template)) m.set(a.template, a as Auto); });
      return m;
    },
  });
}

function SeloAuto({ a }: { a?: Auto }) {
  if (!a) return null;
  if (a.status === 'enviada') return <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary"><Send className="h-3 w-3" />Enviada sozinha {formatarDataHora(a.enviada_em)}</span>;
  if (a.status === 'agendada' || a.status === 'enviando') return <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground"><Clock className="h-3 w-3" />Sai sozinha {formatarDataHora(a.enviar_em)}</span>;
  if (a.status === 'erro') return <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-semibold text-destructive">Envio automático falhou: envie à mão</span>;
  if (a.erro === 'Envio automático desligado') return <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Envio automático desligado</span>;
  return null;
}

export function MensagensVisita({ visitaId, liberados, dados, telefones, usadas }: {
  visitaId: string;
  liberados: Momento[];
  dados: DadosMensagem;
  telefones: { cliente?: string | null; corretor?: string | null };
  usadas: Set<string>;
}) {
  const { data: templates = [], isLoading } = useTemplates();
  const { data: automaticas } = useAutomaticas(visitaId);
  const atual = momentoAtual(liberados);
  const [abertos, setAbertos] = useState<Set<Momento>>(() => new Set(atual ? [atual] : []));

  const porMomento = useMemo(() => {
    const m = new Map<Momento, typeof templates>();
    for (const t of templates) m.set(t.momento, [...(m.get(t.momento) ?? []), t]);
    return m;
  }, [templates]);

  if (isLoading) return <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>;
  if (!liberados.length) return <p className="text-sm text-muted-foreground">Nenhuma mensagem para esta visita.</p>;

  return (
    <div className="space-y-2">
      {MOMENTOS.filter((m) => liberados.includes(m.chave)).reverse().map((m) => {
        const lista = porMomento.get(m.chave) ?? [];
        const enviadas = lista.filter((t) => usadas.has(t.chave)).length;
        const aberto = abertos.has(m.chave);
        return (
          <Collapsible key={m.chave} open={aberto}
            onOpenChange={(v) => setAbertos((s) => { const n = new Set(s); if (v) n.add(m.chave); else n.delete(m.chave); return n; })}
            className={cn('rounded-lg border', m.chave === atual && 'border-primary/40 bg-primary/[0.03]')}>
            <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
              <span className="text-sm font-semibold">{m.titulo}</span>
              {m.chave === atual && <span className="rounded bg-primary px-1.5 text-[10px] font-semibold uppercase text-primary-foreground">Agora</span>}
              <span className="text-xs text-muted-foreground">· envia {m.quem}</span>
              <span className={cn('ml-auto text-xs tabular-nums', enviadas === lista.length && lista.length ? 'text-primary' : 'text-muted-foreground')}>
                {enviadas}/{lista.length} usadas
              </span>
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', aberto && 'rotate-180')} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 px-3 pb-3">
              {lista.map((t) => (
                <CartaoMensagem key={t.id} visitaId={visitaId} chave={t.chave} nome={t.nome.replace(/^Visita · /, '')}
                  destino={t.destino} texto={renderizar(t.conteudo, dados)} telefones={telefones} usada={usadas.has(t.chave)}
                  auto={t.destino === 'cliente' ? automaticas?.get(t.chave) : undefined} />
              ))}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

function CartaoMensagem({ visitaId, chave, nome, destino, texto, telefones, usada, auto }: {
  visitaId: string; chave: string; nome: string; destino: Destino; texto: string;
  telefones: { cliente?: string | null; corretor?: string | null }; usada: boolean; auto?: Auto;
}) {
  const [copiado, setCopiado] = useState(false);
  const link = linkMensagem(destino, texto, telefones);
  const semTelefone = destino !== 'grupo' && !link;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
      toast.success('Mensagem copiada');
      registrarUsoMensagem(visitaId, chave, destino, 'copiar').catch(() => undefined);
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto manualmente.');
    }
  };

  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        {destino === 'grupo' ? <Users className="h-3.5 w-3.5 text-muted-foreground" /> : <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="text-xs font-medium">{nome}</span>
        <span className="rounded bg-muted px-1.5 text-[10px] font-semibold uppercase text-muted-foreground">{ROTULO_DESTINO[destino]}</span>
        <span className="ml-auto flex items-center gap-2">
          <SeloAuto a={auto} />
          {usada && <span className="inline-flex items-center gap-1 text-[11px] text-primary"><Check className="h-3 w-3" />usada</span>}
        </span>
      </div>
      <pre className="whitespace-pre-wrap break-words px-3 py-2 font-sans text-[13px] leading-relaxed text-foreground">{texto}</pre>
      <div className="flex flex-wrap items-center gap-2 border-t bg-muted/40 px-3 py-2">
        <Button type="button" size="sm" variant="outline" onClick={copiar}>
          {copiado ? <Check /> : <Copy />} {copiado ? 'Copiado' : 'Copiar'}
        </Button>
        {destino !== 'grupo' && (
          link ? (
            <Button type="button" size="sm" asChild className="bg-[#25D366] text-white hover:bg-[#1ebe5b]">
              <a href={link} target="_blank" rel="noreferrer noopener"
                onClick={() => registrarUsoMensagem(visitaId, chave, destino, 'whatsapp').catch(() => undefined)}>
                <MessageCircle /> Abrir no WhatsApp
              </a>
            </Button>
          ) : (
            <span className="text-xs text-destructive">{semTelefone ? `Sem telefone do ${destino} cadastrado` : ''}</span>
          )
        )}
        {destino === 'grupo' && <span className="text-xs text-muted-foreground">Grupo: copie e cole no WhatsApp</span>}
      </div>
    </div>
  );
}
