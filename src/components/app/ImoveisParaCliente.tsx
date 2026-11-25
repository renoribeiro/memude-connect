import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Copy, ExternalLink, Loader2, Search, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useEnviarMensagem } from '@/hooks/conversas/dados';

export interface Imovel { id: string; nome: string; bairro: string | null; valor_min: number | null; wp_post_id: number | null; afinidade?: number }

const moeda = (v: number | null) => (v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : null);
const link = (i: Imovel) => (i.wp_post_id ? `https://memude.com.br/?p=${i.wp_post_id}` : null);
const texto = (i: Imovel) => [`*${i.nome}*`, i.bairro, moeda(i.valor_min) && `a partir de ${moeda(i.valor_min)}`].filter(Boolean).join(' · ') + (link(i) ? `\n${link(i)}` : '');

function useImoveis() {
  return useQuery({
    queryKey: ['conversas', 'imoveis'],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Imovel[]> => {
      const { data, error } = await supabase.from('empreendimentos').select('id, nome, valor_min, wp_post_id, bairros(nome)').eq('ativo', true).order('nome').limit(1000);
      if (error) throw error;
      return (data ?? []).map((e) => ({ id: e.id, nome: e.nome, valor_min: e.valor_min, wp_post_id: e.wp_post_id, bairro: (e.bairros as { nome?: string } | null)?.nome ?? null }));
    },
  });
}

export function CartaoImovel({ i, aoEnviar, enviando }: { i: Imovel; aoEnviar?: (i: Imovel) => void; enviando?: boolean }) {
  const url = link(i);
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{i.nome}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[i.bairro, moeda(i.valor_min) && `a partir de ${moeda(i.valor_min)}`].filter(Boolean).join(' · ') || 'Sem preço cadastrado'}
        </p>
      </div>
      {i.afinidade != null && <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{i.afinidade}%</span>}
      {url && (
        <Button asChild variant="ghost" size="icon" className="shrink-0" aria-label={`Abrir ${i.nome} no site`}>
          <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
        </Button>
      )}
      {aoEnviar ? (
        <Button size="icon" className="shrink-0 rounded-full" onClick={() => aoEnviar(i)} disabled={enviando} aria-label={`Enviar ${i.nome} para o cliente`}>
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      ) : (
        <Button variant="outline" size="icon" className="shrink-0" aria-label={`Copiar ${i.nome}`}
          onClick={() => navigator.clipboard.writeText(texto(i)).then(() => toast.success('Copiado. Cole na conversa.'))}>
          <Copy className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

/** Gaveta do chat: imóveis que a IA ligou ao cliente + busca no catálogo, com envio do link em um toque. */
export function ImoveisParaCliente({ conversaId, aoEnviar }: { conversaId?: string; aoEnviar?: () => void }) {
  const { data: imoveis = [], isLoading } = useImoveis();
  const [busca, setBusca] = useState('');
  const enviar = useEnviarMensagem();
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const { data: sugeridos = [] } = useQuery({
    queryKey: ['conversas', 'imoveis-ia', conversaId],
    enabled: !!conversaId,
    queryFn: async () => {
      const { data } = await supabase.from('ia_sugestoes').select('conteudo').eq('conversa_id', conversaId!).eq('tipo', 'empreendimento')
        .order('criada_em', { ascending: false }).limit(1);
      return ((data?.[0]?.conteudo as { itens?: { id: string; afinidade: number }[] } | undefined)?.itens ?? []);
    },
  });
  const porId = useMemo(() => new Map(imoveis.map((i) => [i.id, i])), [imoveis]);
  const daIA = sugeridos.map((s) => porId.get(s.id) && { ...porId.get(s.id)!, afinidade: s.afinidade }).filter(Boolean) as Imovel[];
  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return t ? imoveis.filter((i) => i.nome.toLowerCase().includes(t) || i.bairro?.toLowerCase().includes(t)).slice(0, 40) : imoveis.slice(0, 40);
  }, [imoveis, busca]);

  const mandar = conversaId ? (i: Imovel) => {
    setEnviandoId(i.id);
    enviar.mutate({ conversaId, texto: texto(i) }, {
      onSuccess: () => { toast.success(`${i.nome} enviado`); aoEnviar?.(); },
      onSettled: () => setEnviandoId(null),
    });
  } : undefined;

  return (
    <div className="space-y-4 p-4">
      {daIA.length > 0 && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary"><Sparkles className="h-3.5 w-3.5" /> Combinam com o cliente</h3>
          {daIA.map((i) => <CartaoImovel key={i.id} i={i} aoEnviar={mandar} enviando={enviandoId === i.id} />)}
        </section>
      )}
      <section className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar imóvel ou bairro" className="h-11 rounded-full pl-9 text-base" aria-label="Buscar imóvel" />
        </div>
        {isLoading ? <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-muted-foreground" />
          : filtrados.map((i) => <CartaoImovel key={i.id} i={i} aoEnviar={mandar} enviando={enviandoId === i.id} />)}
        {!isLoading && !busca.trim() && imoveis.length > filtrados.length && (
          <p className="py-2 text-center text-xs text-muted-foreground">Mostrando {filtrados.length} de {imoveis.length}. Busque pelo nome ou bairro para ver os outros.</p>
        )}
        {!isLoading && !filtrados.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum imóvel encontrado.</p>}
      </section>
    </div>
  );
}
