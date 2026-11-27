import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ChevronDown, CircleDashed, Clock, FileCheck2, Info, Wallet, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { FalhaCarregar, TopoVoltar, Vazio } from '@/components/app/ui';
import { FotoEmpreendimento } from '@/components/app/Chamado';

type Comissao = {
  venda_id: string; cliente: string | null; empreendimento: string | null; imagem: string | null; data_venda: string | null;
  valor_imovel: number | null; comissao_percentual: number | null; imposto_percentual: number | null;
  valor_comissao_bruta: number | null; valor_imposto: number | null; valor_corretor: number | null;
  status: string; data_pagamento: string | null; observacoes: string | null; tem_comprovante: boolean; atualizado_em: string | null;
  percentual_corretor: number | null;
};
type Filtro = 'todas' | 'analise' | 'receber' | 'recebidas' | 'canceladas';

// Status vem exatamente do que o closer marcou na venda
const STATUS: Record<string, { rotulo: string; texto: string; cor: string; icone: typeof Clock; filtro: Filtro }> = {
  pendente: { rotulo: 'Em análise', texto: 'Venda registrada; a MeMude está conferindo com a construtora.', cor: 'bg-mm-alerta-fundo text-mm-alerta', icone: Clock, filtro: 'analise' },
  aprovada: { rotulo: 'A receber', texto: 'Aprovada. Falta o pagamento da comissão.', cor: 'bg-mm-lilas text-primary', icone: CircleDashed, filtro: 'receber' },
  paga: { rotulo: 'Recebida', texto: 'Comissão paga.', cor: 'bg-mm-sucesso-fundo text-mm-sucesso', icone: CheckCircle2, filtro: 'recebidas' },
  cancelada: { rotulo: 'Cancelada', texto: 'Venda cancelada; não gera comissão.', cor: 'bg-muted text-muted-foreground', icone: XCircle, filtro: 'canceladas' },
};
const ETAPAS = ['pendente', 'aprovada', 'paga'];

const real = (v: number | null | undefined) => v == null ? null : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number | null | undefined) => v == null ? null : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
const data = (iso: string | null | undefined) => { if (!iso) return null; const [a, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${a}`; };

function useMinhasComissoes() {
  return useQuery({
    queryKey: ['conversas', 'minhas-comissoes'],
    queryFn: async () => {
      const { data: linhas, error } = await supabase.rpc('corretor_minhas_comissoes');
      if (error) throw error;
      return (linhas ?? []) as Comissao[];
    },
  });
}

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: string | null; destaque?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-[13px] text-muted-foreground">{rotulo}</dt>
      <dd className={cn('text-right tabular-nums', destaque ? 'text-[15px] font-extrabold' : 'text-[14px] font-semibold', !valor && 'font-normal text-muted-foreground')}>
        {valor ?? 'Não informado pelo closer'}
      </dd>
    </div>
  );
}

function CartaoVenda({ c }: { c: Comissao }) {
  const [aberto, setAberto] = useState(false);
  const s = STATUS[c.status] ?? STATUS.pendente;
  const passo = ETAPAS.indexOf(c.status);
  return (
    <li className="overflow-hidden rounded-2xl border border-mm-borda-suave bg-card">
      <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}
        className="flex w-full items-center gap-3 p-3.5 text-left">
        <FotoEmpreendimento url={c.imagem} nome={c.empreendimento} className="h-14 w-14 shrink-0 rounded-xl" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold">{c.empreendimento ?? 'Empreendimento'}</span>
          <span className="block truncate text-[13px] text-muted-foreground">{c.cliente ?? 'Cliente'}{c.data_venda ? ` · venda em ${data(c.data_venda)}` : ''}</span>
          <span className={cn('mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold', s.cor)}>
            <s.icone className="h-3 w-3" aria-hidden /> {s.rotulo}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[11px] text-muted-foreground">Sua comissão</span>
          <span className={cn('block text-[16px] font-extrabold tabular-nums', c.status === 'cancelada' && 'line-through opacity-60')}>
            {real(c.valor_corretor) ?? 'A definir'}
          </span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition', aberto && 'rotate-180')} aria-hidden />
      </button>
      {aberto && (
        <div className="border-t border-mm-borda-suave px-4 pb-4 pt-3">
          {c.status !== 'cancelada' && (
            <ol className="mb-3 flex items-center gap-1.5" aria-label="Andamento da comissão">
              {ETAPAS.map((e, i) => (
                <li key={e} className="flex flex-1 flex-col gap-1">
                  <span className={cn('h-1.5 rounded-full', i <= passo ? 'bg-primary' : 'bg-mm-borda-suave')} />
                  <span className={cn('text-[11px] font-semibold', i <= passo ? 'text-primary' : 'text-muted-foreground')}>
                    {e === 'pendente' ? 'Registrada' : e === 'aprovada' ? 'Aprovada' : 'Paga'}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="mb-2 text-[13px] text-muted-foreground">{s.texto}</p>
          <dl className="divide-y divide-mm-borda-suave">
            <Linha rotulo="Valor do imóvel" valor={real(c.valor_imovel)} />
            <Linha rotulo={`Comissão da venda${c.comissao_percentual != null ? ` (${pct(c.comissao_percentual)})` : ''}`} valor={real(c.valor_comissao_bruta)} />
            <Linha rotulo={`Impostos${c.imposto_percentual != null ? ` (${pct(c.imposto_percentual)})` : ''}`} valor={c.valor_imposto != null ? `– ${real(c.valor_imposto)}` : null} />
            <Linha rotulo={`Sua parte${c.percentual_corretor != null ? ` (${pct(c.percentual_corretor)} após impostos)` : ""}`} valor={real(c.valor_corretor)} destaque />
            <Linha rotulo="Pagamento" valor={c.status === 'paga' ? (data(c.data_pagamento) ? `Pago em ${data(c.data_pagamento)}` : 'Pago') : c.data_pagamento ? `Previsto para ${data(c.data_pagamento)}` : null} />
          </dl>
          {c.tem_comprovante && (
            <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-mm-sucesso"><FileCheck2 className="h-4 w-4" aria-hidden /> Comprovante anexado pelo closer</p>
          )}
          {c.observacoes && <p className="mt-2 rounded-xl bg-muted p-3 text-[13px]"><strong>Anotação do closer:</strong> {c.observacoes}</p>}
          {c.atualizado_em && <p className="mt-2 text-[11px] text-muted-foreground">Última atualização do closer: {new Date(c.atualizado_em).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'short' })}</p>}
        </div>
      )}
    </li>
  );
}

/** Comissões do corretor: só o que o closer lançou na venda (nada calculado aqui para não criar expectativa errada). */
export default function AppComissoes() {
  const { data: lista = [], isLoading, isError, refetch } = useMinhasComissoes();
  const [filtro, setFiltro] = useState<Filtro>('todas');

  const soma = (status: string) => lista.filter((c) => c.status === status && c.valor_corretor != null)
    .reduce((t, c) => t + Number(c.valor_corretor), 0);
  const semValor = lista.filter((c) => c.status !== 'cancelada' && c.valor_corretor == null).length;
  const visiveis = useMemo(() => lista.filter((c) => filtro === 'todas' || (STATUS[c.status] ?? STATUS.pendente).filtro === filtro), [lista, filtro]);
  const contagem = (f: Filtro) => lista.filter((c) => (STATUS[c.status] ?? STATUS.pendente).filtro === f).length;

  return (
    <>
      <TopoVoltar titulo="Minhas comissões" subtitulo="Conforme lançado pelo closer da MeMude" voltarPara="/app/perfil" />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-6 pt-1">
        {isLoading ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
          : isError ? <FalhaCarregar aoTentar={() => refetch()} />
            : !lista.length ? (
              <Vazio icone={Wallet} titulo="Nenhuma venda ainda" texto="Quando o closer registrar uma venda sua, a comissão aparece aqui com o andamento do pagamento." />
            ) : (
              <>
                <section className="grid grid-cols-3 gap-2" aria-label="Resumo">
                  {[
                    { rotulo: 'Recebido', valor: soma('paga'), cor: 'text-mm-sucesso' },
                    { rotulo: 'A receber', valor: soma('aprovada'), cor: 'text-primary' },
                    { rotulo: 'Em análise', valor: soma('pendente'), cor: 'text-mm-alerta' },
                  ].map((r) => (
                    <div key={r.rotulo} className="rounded-2xl border border-mm-borda-suave bg-card p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{r.rotulo}</p>
                      <p className={cn('mt-1 text-[15px] font-extrabold tabular-nums leading-tight', r.cor)}>{real(r.valor)}</p>
                    </div>
                  ))}
                </section>

                <p className="flex items-start gap-2 rounded-2xl bg-mm-lilas p-3 text-[13px] text-primary">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>Os valores são os que o closer lançou na venda. <strong>Em análise</strong> ainda pode mudar; conte com o dinheiro quando estiver <strong>A receber</strong>.{semValor ? ` ${semValor} venda(s) ainda sem o valor da sua comissão.` : ''} Dúvida? Fale com o closer.</span>
                </p>

                <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label="Filtrar">
                  {([['todas', 'Todas', lista.length], ['analise', 'Em análise', contagem('analise')], ['receber', 'A receber', contagem('receber')],
                    ['recebidas', 'Recebidas', contagem('recebidas')], ['canceladas', 'Canceladas', contagem('canceladas')]] as [Filtro, string, number][])
                    .filter(([f, , n]) => f === 'todas' || n > 0).map(([f, rotulo, n]) => (
                      <button key={f} type="button" role="tab" aria-selected={filtro === f} onClick={() => setFiltro(f)}
                        className={cn('shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-bold', filtro === f ? 'border-primary bg-primary text-white' : 'border-mm-borda-suave bg-card')}>
                        {rotulo} <span className="opacity-70">{n}</span>
                      </button>
                    ))}
                </div>

                <ul className="space-y-2">{visiveis.map((c) => <CartaoVenda key={c.venda_id} c={c} />)}</ul>
              </>
            )}
      </div>
    </>
  );
}
