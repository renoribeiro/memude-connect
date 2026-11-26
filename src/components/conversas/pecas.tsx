import { AlertTriangle, Check, CheckCheck, Clock, Flame, Snowflake, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haQuanto, minutosEsperando, nivelEspera } from '@/lib/conversas/formato';
import { AvatarIlustrado } from './AvatarIlustrado';
import { ETAPA, type Etapa } from '@/lib/conversas/tipos';

export function AvatarContato({ nome, chave, tamanho = 'md', className }: {
  nome: string | null | undefined; chave?: string | null; tamanho?: 'sm' | 'md' | 'lg' | 'xl'; className?: string;
}) {
  const t = { sm: 'h-8 w-8', md: 'h-11 w-11', lg: 'h-12 w-12', xl: 'h-20 w-20' }[tamanho];
  // Sempre um bonequinho ilustrado (nunca a letra): mais humano e lúdico
  return (
    <span aria-hidden className={cn('inline-flex shrink-0 select-none overflow-hidden rounded-full', t, className)}>
      <AvatarIlustrado nome={nome} chave={chave ?? nome} className="h-full w-full" />
    </span>
  );
}

export function EtapaBadge({ etapa, className }: { etapa: string; className?: string }) {
  const e = ETAPA[etapa as Etapa] ?? ETAPA.novo;
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-extrabold', e.cor, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', e.ponto)} aria-hidden />
      {e.rotulo}
    </span>
  );
}

export function Temperatura({ valor, comRotulo = false }: { valor: string | null | undefined; comRotulo?: boolean }) {
  if (!valor) return null;
  const Icone = valor === 'quente' ? Flame : valor === 'morno' ? Sun : Snowflake;
  const cor = valor === 'quente' ? 'text-mm-rosa-texto' : valor === 'morno' ? 'text-mm-alerta' : 'text-primary';
  const rotulo = valor === 'quente' ? 'Quente' : valor === 'morno' ? 'Morno' : 'Frio';
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-bold', cor)} title={`Cliente ${rotulo.toLowerCase()} (IA)`}>
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
    ok: 'bg-mm-sucesso-fundo text-mm-sucesso',
    atencao: 'bg-mm-alerta-fundo text-mm-alerta',
    atrasado: 'bg-mm-acao text-white',
  }[nivel];
  const Icone = nivel === 'atrasado' ? AlertTriangle : Clock;
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums', cor)}
      title={`Cliente aguardando resposta ${haQuanto(desde, agora)}`}>
      <Icone className="h-3 w-3" aria-hidden />
      {compacto ? `${min! < 60 ? `${min} min` : `${Math.floor(min! / 60)} h`}` : `Aguardando ${haQuanto(desde, agora).replace('há ', '')}`}
    </span>
  );
}

/** Tiques de entrega estilo WhatsApp. */
export function Tiques({ status, className }: { status: string; className?: string }) {
  if (status === 'pendente') return <Clock className={cn('h-3.5 w-3.5 opacity-70', className)} aria-label="Enviando" />;
  if (status === 'erro') return <AlertTriangle className={cn('h-3.5 w-3.5 text-mm-rosa', className)} aria-label="Não enviada" />;
  if (status === 'enviada') return <Check className={cn('h-3.5 w-3.5 opacity-70', className)} aria-label="Enviada" />;
  if (status === 'entregue') return <CheckCheck className={cn('h-3.5 w-3.5 opacity-70', className)} aria-label="Entregue" />;
  if (status === 'lida') return <CheckCheck className={cn('h-3.5 w-3.5 text-sky-500', className)} aria-label="Lida" />;
  return null;
}

export function ContadorNaoLidas({ n, className }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-mm-acao px-1.5 text-[11px] font-extrabold text-white tabular-nums', className)}
      aria-label={`${n} mensagens não lidas`}>
      {n > 99 ? '99+' : n}
    </span>
  );
}
