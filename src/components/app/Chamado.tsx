import { useState } from 'react';
import { Building2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AvatarContato } from '@/components/conversas/pecas';
import type { Convite } from '@/lib/conversas/tipos';
import { Simbolo } from './Marca';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** "Sáb, 28/11 às 10h" (ou 10h30) */
export function quandoCurto(data: string, hora: string) {
  const [a, m, d] = data.slice(0, 10).split('-').map(Number);
  const dia = DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
  const [hh, mm] = hora.slice(0, 5).split(':');
  return `${dia}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} às ${Number(hh)}h${mm === '00' ? '' : mm}`;
}

/** Tempo que falta para aceitar: fração (0–1) e texto "12:04". */
export function prazoDoChamado(c: Pick<Convite, 'enviado_em' | 'prazo_em'>, agora: number) {
  const total = Math.max(1, new Date(c.prazo_em).getTime() - new Date(c.enviado_em).getTime());
  const resta = Math.max(0, new Date(c.prazo_em).getTime() - agora);
  return {
    resta, fracao: resta / total, esgotado: resta === 0,
    texto: `${Math.floor(resta / 60_000)}:${String(Math.floor((resta % 60_000) / 1000)).padStart(2, '0')}`,
  };
}

/** Foto do empreendimento (do site da MeMude); sem foto, um degradê com o ícone. */
export function FotoEmpreendimento({ url, nome, className }: { url?: string | null; nome?: string | null; className?: string }) {
  const [falhou, setFalhou] = useState(false);
  if (url && !falhou) {
    return <img src={url} alt={nome ? `Foto do ${nome}` : ''} loading="lazy" decoding="async" onError={() => setFalhou(true)}
      className={cn('object-cover', className)} />;
  }
  return (
    <span aria-hidden className={cn('flex items-center justify-center bg-gradient-to-br from-[#5B43B5] to-[#D41F58] text-white/90', className)}>
      <Building2 className="h-1/3 w-1/3 max-h-10 max-w-10" />
    </span>
  );
}

/** Barra de prazo no estilo "atividade ao vivo": enche até o fim, com o sinal de pronto na ponta. */
export function BarraPrazo({ fracao, claro = false }: { fracao: number; claro?: boolean }) {
  const pct = Math.round((1 - fracao) * 100);
  return (
    <div className="flex items-center gap-2" aria-hidden>
      <div className={cn('relative h-1.5 flex-1 overflow-hidden rounded-full', claro ? 'bg-[#1E1640]/10' : 'bg-white/20')}>
        <div className={cn('absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-linear', fracao < 0.25 ? 'bg-[#E92662]' : claro ? 'bg-primary' : 'bg-white')}
          style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
      <CheckCircle2 className={cn('h-4 w-4 shrink-0', claro ? 'text-primary' : 'text-white')} />
    </div>
  );
}

/**
 * Cartão do chamado no formato de notificação "ao vivo" (como o aviso de corrida chegando):
 * marca, quem quer visitar o quê, quando e onde, foto do empreendimento com o rosto do cliente e o prazo correndo.
 */
export function CartaoChamado({ convite, agora, aoAbrir, quantos = 1 }: {
  convite: Convite; agora: number; aoAbrir: () => void; quantos?: number;
}) {
  const p = prazoDoChamado(convite, agora);
  const primeiro = convite.lead_nome?.split(' ')[0] ?? 'Cliente';
  return (
    <button type="button" onClick={aoAbrir}
      aria-label={`Chamado: ${primeiro} quer visitar ${convite.empreendimento ?? 'um imóvel'}. ${p.esgotado ? 'Prazo esgotado' : `${p.texto} para aceitar`}. Toque para ver.`}
      className="block w-full rounded-[26px] bg-[#1E1640] p-4 text-left text-white shadow-[0_18px_40px_-18px_rgba(30,22,64,0.75)] transition active:scale-[0.99]">
      <div className="flex items-center gap-2 text-[12px] font-bold text-white/70">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white" aria-hidden><Simbolo className="h-3.5" /></span>
        MeMude
        <span className="ml-auto tabular-nums">{p.esgotado ? 'prazo esgotado' : `${p.texto} para aceitar`}</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-extrabold leading-snug tracking-[-0.01em]">
            {primeiro} quer visitar {quantos > 1 && <span className="font-semibold text-white/70">(+{quantos - 1})</span>}
          </p>
          <p className="truncate text-[15px] font-semibold text-white/90">{convite.empreendimento ?? 'um imóvel'}</p>
          <p className="mt-0.5 truncate text-[13px] text-white/65">
            {quandoCurto(convite.data_visita, convite.horario_visita)}{convite.bairro ? ` · ${convite.bairro}` : ''}
          </p>
        </div>
        {/* Foto do imóvel com o rosto do cliente sobreposto */}
        <div className="relative h-16 w-[86px] shrink-0">
          <FotoEmpreendimento url={convite.imagem} nome={convite.empreendimento} className="absolute right-0 top-0 h-16 w-16 rounded-2xl" />
          <AvatarContato nome={convite.lead_nome} tamanho="lg" className="absolute bottom-[-4px] left-0 ring-[3px] ring-[#1E1640]" />
        </div>
      </div>
      <div className="mt-3.5"><BarraPrazo fracao={p.fracao} /></div>
    </button>
  );
}
