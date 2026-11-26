import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, MessagesSquare, Sparkles, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Temperatura } from '@/components/conversas/pecas';
import { useDesfazerMudancaIA } from '@/hooks/comercial/dados';
import { formatarDataHora } from '@/lib/comercial/datas';
import { cn } from '@/lib/utils';

const ROTULO_CAMPO: Record<string, string> = {
  status_atendimento: 'Status', renda: 'Renda', entrada_fgts: 'Entrada/FGTS', prazo: 'Prazo', finalidade: 'Finalidade', regiao: 'Região',
};
const ORDEM_QUALIFICACAO = ['renda', 'entrada_fgts', 'prazo', 'finalidade', 'regiao'];
const ROTULO_ETAPA: Record<string, string> = {
  novo: 'Novo', em_atendimento: 'Em atendimento', visita_marcada: 'Visita agendada', visitou: 'Visita realizada', proposta: 'Proposta',
  documentacao: 'Documentação', vendido: 'Vendido', perdido: 'Perdido',
};

export interface ConversaIA {
  id: string; resumo_ia: string | null; ia_falta: string | null; temperatura: string | null; etapa: string;
  ia_analisada_em: string | null; ultima_mensagem_em: string | null;
}
export interface MudancaIA {
  id: string; campo: string; de: string | null; para: string; evidencia: string | null; criado_em: string;
  desfeita_em: string | null; desfeita_por: string | null; conversa_id: string | null;
}

/** "O que está acontecendo" com o cliente, montado pela IA a partir da conversa, e o que ela mudou na ficha. */
export function AcompanhamentoIA({ leadId, conversa, qualificacao, mudancas, nomes }: {
  leadId: string; conversa: ConversaIA | null; qualificacao: Record<string, unknown> | null; mudancas: MudancaIA[];
  nomes: Map<string, string>;
}) {
  const desfazer = useDesfazerMudancaIA();
  const campos = ORDEM_QUALIFICACAO.map((k) => [k, qualificacao?.[k]] as const).filter(([, v]) => typeof v === 'string' && v);
  // Só a mudança mais recente de cada campo pode ser desfeita (as anteriores já foram substituídas)
  const ultimaPorCampo = new Map<string, string>();
  mudancas.forEach((m) => { if (!m.desfeita_em && !ultimaPorCampo.has(m.campo)) ultimaPorCampo.set(m.campo, m.id); });

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm" aria-labelledby="acomp-ia">
      <div className="mb-3 flex items-center gap-2">
        <h2 id="acomp-ia" className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" aria-hidden /> O que está acontecendo</h2>
        {conversa?.temperatura && <Temperatura valor={conversa.temperatura} comRotulo />}
        {conversa && (
          <Link to={`/conversas?c=${conversa.id}`} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <MessagesSquare className="h-3.5 w-3.5" aria-hidden /> Abrir conversa
          </Link>
        )}
      </div>

      {!conversa ? (
        <p className="text-sm text-muted-foreground">Ainda não há conversa deste cliente no número da MeMude. Quando houver, a IA resume aqui o que aconteceu e mantém a ficha em dia.</p>
      ) : !conversa.resumo_ia ? (
        <p className="text-sm text-muted-foreground">A IA ainda não leu esta conversa. O resumo aparece 1 minuto depois da última mensagem.</p>
      ) : (
        <div className="space-y-3">
          <p className="rounded-[14px] bg-mm-lilas p-3 text-sm leading-relaxed text-foreground">{conversa.resumo_ia}</p>
          {conversa.ia_falta && (
            <p className="flex items-start gap-2 text-sm"><ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-mm-acao" aria-hidden />
              <span><strong>Próximo passo:</strong> {conversa.ia_falta}</span></p>
          )}
          <p className="text-xs text-muted-foreground">
            Etapa: {ROTULO_ETAPA[conversa.etapa] ?? conversa.etapa}
            {conversa.ia_analisada_em && ` · lido pela IA em ${formatarDataHora(conversa.ia_analisada_em)}`}
          </p>
        </div>
      )}

      {campos.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {campos.map(([k, v]) => (
            <div key={k} className="rounded-lg border border-mm-borda-suave px-2.5 py-1.5">
              <dt className="text-[11px] text-muted-foreground">{ROTULO_CAMPO[k]}</dt>
              <dd className="truncate text-sm font-semibold">{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}

      {mudancas.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">O que a IA atualizou na ficha</h3>
          <ol className="space-y-2">
            {mudancas.map((m) => {
              const podeDesfazer = ultimaPorCampo.get(m.campo) === m.id;
              const ocupado = desfazer.isPending && desfazer.variables?.id === m.id;
              return (
                <li key={m.id} className={cn('rounded-lg border px-3 py-2', m.desfeita_em && 'opacity-60')}>
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 text-sm">
                      <strong>{ROTULO_CAMPO[m.campo] ?? m.campo}</strong>: {m.de ?? 'vazio'} → <span className={cn(m.desfeita_em && 'line-through')}>{m.para}</span>
                    </p>
                    {podeDesfazer && (
                      <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" disabled={desfazer.isPending}
                        onClick={() => desfazer.mutate({ id: m.id, leadId })} aria-label={`Desfazer ${ROTULO_CAMPO[m.campo] ?? m.campo}`}>
                        {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Undo2 className="h-3.5 w-3.5" aria-hidden />} Desfazer
                      </Button>
                    )}
                  </div>
                  {m.evidencia && <p className="mt-0.5 text-xs italic text-muted-foreground">“{m.evidencia}”</p>}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatarDataHora(m.criado_em)}
                    {m.desfeita_em && ` · desfeito${m.desfeita_por ? ` por ${nomes.get(m.desfeita_por) ?? 'equipe'}` : ''} em ${formatarDataHora(m.desfeita_em)}`}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
