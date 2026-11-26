import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Peças do app do corretor, no mesmo padrão do app MeMude Corretor. */

/** Abas em trilho lilás (Hoje | Funil | Lista…). */
export function Segmentado<T extends string>({ opcoes, valor, aoMudar, rotulo, className }: {
  opcoes: { valor: T; rotulo: string; contador?: number }[]; valor: T; aoMudar: (v: T) => void; rotulo: string; className?: string;
}) {
  return (
    <div role="tablist" aria-label={rotulo} className={cn('flex rounded-2xl bg-mm-lilas p-1', className)}>
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button key={o.valor} type="button" role="tab" aria-selected={ativo} onClick={() => aoMudar(o.valor)}
            className={cn('flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm transition',
              ativo ? 'sombra-flutuante bg-card font-extrabold text-primary' : 'font-semibold text-muted-foreground hover:text-primary')}>
            {o.rotulo}
            {!!o.contador && (
              <span className={cn('rounded-full px-1.5 text-[11px] font-extrabold tabular-nums', ativo ? 'bg-mm-acao text-white' : 'bg-card text-primary')}>
                {o.contador}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Número em destaque com legenda ("3 · para fazer hoje"). Em alerta fica rosa. */
export function CartaoNumero({ valor, rotulo, alerta, aoTocar }: { valor: ReactNode; rotulo: string; alerta?: boolean; aoTocar?: () => void }) {
  const Comp = aoTocar ? 'button' : 'div';
  return (
    <Comp type={aoTocar ? 'button' : undefined} onClick={aoTocar}
      className={cn('min-w-0 rounded-2xl border p-3 text-left transition', aoTocar && 'active:scale-[0.98]',
        alerta ? 'border-mm-borda-rosa bg-mm-rosa-palido' : 'border-mm-borda-suave bg-card')}>
      <span className={cn('preco block text-[22px] leading-none', alerta ? 'text-mm-rosa-texto' : 'text-primary')}>{valor}</span>
      <span className="mt-1.5 block text-xs leading-tight text-muted-foreground">{rotulo}</span>
    </Comp>
  );
}

/** Cartão branco com título (e algo à direita, como "por urgência" ou "Editar"). */
export function Bloco({ titulo, extra, children, className, semPadding }: {
  titulo?: ReactNode; extra?: ReactNode; children: ReactNode; className?: string; semPadding?: boolean;
}) {
  return (
    <section className={cn('rounded-2xl border border-mm-borda-suave bg-card', !semPadding && 'p-4', className)}>
      {titulo && (
        <div className={cn('mb-2 flex items-center justify-between gap-3', semPadding && 'px-4 pt-4')}>
          <h2 className="text-[15px] leading-tight">{titulo}</h2>
          {extra && <span className="shrink-0 text-xs text-muted-foreground">{extra}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Título de seção com link rosa à direita ("Ver todos >"). */
export function TituloSecao({ titulo, acao, para }: { titulo: string; acao?: string; para?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg leading-tight">{titulo}</h2>
      {acao && para && (
        <Link to={para} className="inline-flex shrink-0 items-center gap-0.5 text-sm font-bold text-mm-acao">
          {acao} <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

/** Atalho em quadrado colorido (rosa-claro ou lilás), como no Início do app de referência. */
export function Atalho({ icone: Icone, rotulo, tom, para, aoTocar, contador }: {
  icone: LucideIcon; rotulo: string; tom: 'rosa' | 'lilas'; para?: string; aoTocar?: () => void; contador?: number;
}) {
  const conteudo = (
    <>
      <span className={cn('relative flex h-14 w-14 items-center justify-center rounded-2xl',
        tom === 'rosa' ? 'bg-mm-rosa-claro text-mm-acao' : 'bg-mm-lilas text-primary')}>
        <Icone className="h-6 w-6" strokeWidth={1.8} aria-hidden />
        {!!contador && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-mm-acao px-1 text-[11px] font-extrabold text-white">
            {contador > 99 ? '99+' : contador}
          </span>
        )}
      </span>
      <span className="text-[13px] font-semibold text-foreground">{rotulo}</span>
    </>
  );
  const classe = 'flex flex-col items-center gap-2 rounded-2xl py-1 transition active:scale-95';
  return para ? <Link to={para} className={classe}>{conteudo}</Link>
    : <button type="button" onClick={aoTocar} className={classe}>{conteudo}</button>;
}

/** Topo de tela interna: voltar + título (Imóveis, Respostas…). */
export function TopoVoltar({ titulo, subtitulo, voltarPara, direita }: { titulo: string; subtitulo?: ReactNode; voltarPara?: string; direita?: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  // Volta de verdade (o botão voltar do celular continua coerente); sem tela anterior, vai para o destino padrão
  const voltar = () => (location.key === 'default' ? navigate(voltarPara ?? '/app', { replace: true }) : navigate(-1));
  return (
    <header className="flex items-center gap-2 bg-background px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <button type="button" onClick={voltar} aria-label="Voltar"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition active:scale-95">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl leading-tight">{titulo}</h1>
        {subtitulo && <p className="truncate text-xs text-muted-foreground">{subtitulo}</p>}
      </div>
      {direita}
    </header>
  );
}

/** Faixa de erro com "Tentar de novo". */
export function FalhaCarregar({ aoTentar, texto = 'Não foi possível carregar. Confira a internet.' }: { aoTentar: () => void; texto?: string }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-[14px] border border-mm-borda-rosa bg-mm-rosa-palido p-3 text-sm font-semibold text-mm-rosa-texto">
      <span className="flex-1">{texto}</span>
      <button type="button" onClick={aoTentar} className="h-9 shrink-0 rounded-full bg-mm-acao px-3.5 font-bold text-white">Tentar de novo</button>
    </div>
  );
}

/** Estado vazio com ícone em círculo lilás. */
export function Vazio({ icone: Icone, titulo, texto, acao }: { icone: LucideIcon; titulo: string; texto?: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 py-12 text-center">
      <span className="mb-3 rounded-full bg-mm-lilas p-4"><Icone className="h-7 w-7 text-primary" aria-hidden /></span>
      <p className="text-lg font-extrabold tracking-[-0.02em]">{titulo}</p>
      {texto && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{texto}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}
