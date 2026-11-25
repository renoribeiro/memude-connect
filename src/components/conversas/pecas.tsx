import { AlertTriangle, Check, CheckCheck, Clock, Flame, Snowflake, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { corAvatar, haQuanto, iniciais, minutosEsperando, nivelEspera } from '@/lib/conversas/formato';
import { ETAPA, type Etapa } from '@/lib/conversas/tipos';

export function AvatarContato({ nome, chave, tamanho = 'md', className }: {
  nome: string | null | undefined; chave?: string | null; tamanho?: 'sm' | 'md' | 'lg' | 'xl'; className?: string;
}) {
  const t = { sm: 'h-8 w-8 text-[11px]', md: 'h-11 w-11 text-sm', lg: 'h-12 w-12 text-base', xl: 'h-20 w-20 text-2xl' }[tamanho];
  return (
    <span aria-hidden className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold', t, corAvatar(chave ?? nome), className)}>
      {iniciais(nome)}
    </span>
  );
}

export function EtapaBadge({ etapa, className }: { etapa: string; className?: string }) {
  const e = ETAPA[etapa as Etapa] ?? ETAPA.novo;
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', e.cor, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', e.ponto)} aria-hidden />
      {e.rotulo}
    </span>
  );
}

export function Temperatura({ valor, comRotulo = false }: { valor: string | null | undefined; comRotulo?: boolean }) {
  if (!valor) return null;
  const Icone = valor === 'quente' ? Flame : valor === 'morno' ? Sun : Snowflake;
  const cor = valor === 'quente' ? 'text-rose-500' : valor === 'morno' ? 'text-amber-500' : 'text-sky-500';
  const rotulo = valor === 'quente' ? 'Quente' : valor === 'morno' ? 'Morno' : 'Frio';
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', cor)} title={`Cliente ${rotulo.toLowerCase()} (IA)`}>
      <Icone className="h-3.5 w-3.5" aria-hidden />
      {comRotulo ? rotulo : <span className="sr-only">{rotulo}</span>}
    </span>
  );
}

/** Há quanto tempo o cliente espera resposta, com semáforo (5 / 15 min). */
export function Espera({ desde, agora, compacto = false }: { desde: string | null | undefined; agora: number; compacto?: boolean }) {
  const min = minutosEsperando(desde, agora);
  const nivel = nivelEspera(min);
  if (nivel == null) return null;
  const cor = {
    ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900',
    atencao: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900',
    atrasado: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-900',
  }[nivel];
  const Icone = nivel === 'atrasado' ? AlertTriangle : Clock;
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset tabular-nums', cor)}
      title={`Cliente aguardando resposta ${haQuanto(desde, agora)}`}>
      <Icone className="h-3 w-3" aria-hidden />
      {compacto ? `${min! < 60 ? `${min} min` : `${Math.floor(min! / 60)} h`}` : `Aguardando ${haQuanto(desde, agora).replace('há ', '')}`}
    </span>
  );
}

/** Tiques de entrega estilo WhatsApp. */
export function Tiques({ status, className }: { status: string; className?: string }) {
  if (status === 'pendente') return <Clock className={cn('h-3.5 w-3.5 opacity-70', className)} aria-label="Enviando" />;
  if (status === 'erro') return <AlertTriangle className={cn('h-3.5 w-3.5 text-rose-500', className)} aria-label="Não enviada" />;
  if (status === 'enviada') return <Check className={cn('h-3.5 w-3.5 opacity-70', className)} aria-label="Enviada" />;
  if (status === 'entregue') return <CheckCheck className={cn('h-3.5 w-3.5 opacity-70', className)} aria-label="Entregue" />;
  if (status === 'lida') return <CheckCheck className={cn('h-3.5 w-3.5 text-sky-500', className)} aria-label="Lida" />;
  return null;
}

export function ContadorNaoLidas({ n, className }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-[11px] font-bold text-secondary-foreground tabular-nums', className)}
      aria-label={`${n} mensagens não lidas`}>
      {n > 99 ? '99+' : n}
    </span>
  );
}
