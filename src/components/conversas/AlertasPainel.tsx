import { AlertTriangle, BellRing, CheckCircle2, Flame, PhoneOff, Snowflake, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EstadoVazio } from '@/components/comercial/ui';
import { haQuanto } from '@/lib/conversas/formato';
import { TIPO_ALERTA } from '@/lib/conversas/tipos';
import { useAlertas, useResolverAlerta } from '@/hooks/conversas/dados';
import { useAgora } from '@/hooks/conversas/useAgora';

const ICONE: Record<string, typeof AlertTriangle> = {
  sem_resposta: AlertTriangle, pos_visita_esquecido: Snowflake, sinal_compra: Flame, contato_pessoal: UserX, numero_caiu: PhoneOff,
};
const ORDEM = ['numero_caiu', 'contato_pessoal', 'sem_resposta', 'sinal_compra', 'pos_visita_esquecido'];

/** Central de alertas do closer: quem está sem resposta, clientes esfriando, sinais de compra. */
export function AlertasPainel({ aoAbrirConversa }: { aoAbrirConversa: (id: string) => void }) {
  const { data: alertas = [], isLoading } = useAlertas();
  const resolver = useResolverAlerta();
  const agora = useAgora(30_000);
  const ordenados = [...alertas].sort((a, b) => ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo) || b.criado_em.localeCompare(a.criado_em));

  if (isLoading) return <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>;
  if (!ordenados.length) {
    return (
      <div className="p-6">
        <EstadoVazio icone={CheckCircle2} titulo="Tudo em dia" descricao="Nenhum cliente sem resposta, nenhum esfriando. Os alertas aparecem aqui assim que algo precisar da sua atenção." />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl space-y-2 p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <BellRing className="h-4 w-4" /> Sem resposta conta só das 8h às 20h. Os alertas somem sozinhos quando o problema é resolvido.
      </p>
      {ordenados.map((a) => {
        const Icone = ICONE[a.tipo] ?? AlertTriangle;
        const tom = TIPO_ALERTA[a.tipo]?.tom ?? 'aviso';
        return (
          <div key={a.id} className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card p-3 shadow-sm',
            tom === 'perigo' && 'border-l-4 border-l-rose-500', tom === 'aviso' && 'border-l-4 border-l-amber-500', tom === 'sucesso' && 'border-l-4 border-l-emerald-500')}>
            <span className={cn('rounded-full p-2', tom === 'perigo' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950' : tom === 'aviso' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950')}>
              <Icone className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 basis-48">
              <p className="truncate text-sm font-semibold">{a.titulo}</p>
              <p className="truncate text-xs text-muted-foreground">{TIPO_ALERTA[a.tipo]?.rotulo} · {a.detalhe} · {haQuanto(a.criado_em, agora)}</p>
            </div>
            <div className="ml-auto flex shrink-0 gap-1.5">
              {a.conversa_id && <Button size="sm" variant="outline" onClick={() => aoAbrirConversa(a.conversa_id!)}>Abrir conversa</Button>}
              <Button size="sm" variant="ghost" onClick={() => resolver.mutate(a.id)} disabled={resolver.isPending}>Resolvido</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
