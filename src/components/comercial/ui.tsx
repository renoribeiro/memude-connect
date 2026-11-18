import { useState, type ReactNode } from 'react';
import { Check, ChevronsUpDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  COR_STATUS_ATENDIMENTO, COR_STATUS_VISITA, ROTULO_STATUS_VISITA,
} from '@/lib/comercial/constantes';

const pilula = 'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap';

export function StatusAtendimentoBadge({ status, className }: { status: string; className?: string }) {
  return <span className={cn(pilula, COR_STATUS_ATENDIMENTO[status] ?? COR_STATUS_ATENDIMENTO.NOVO, className)}>{status}</span>;
}

export function StatusVisitaBadge({ status, className }: { status: string; className?: string }) {
  const cor = COR_STATUS_VISITA[status] ?? COR_STATUS_VISITA.cancelada;
  return (
    <span className={cn(pilula, cor.badge, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cor.ponto)} aria-hidden />
      {ROTULO_STATUS_VISITA[status] ?? status}
    </span>
  );
}

export function Iniciais({ nome, className }: { nome?: string | null; className?: string }) {
  const ini = (nome ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  return (
    <span className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary-dark', className)}>
      {ini || '?'}
    </span>
  );
}

export function EstadoVazio({ icone: Icone, titulo, descricao, acao }: {
  icone: LucideIcon; titulo: string; descricao?: string; acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/60 px-6 py-10 text-center">
      <div className="mb-3 rounded-full bg-primary/10 p-3"><Icone className="h-5 w-5 text-primary" aria-hidden /></div>
      <p className="text-sm font-semibold text-foreground">{titulo}</p>
      {descricao && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

export interface OpcaoBusca {
  valor: string;
  rotulo: string;
  detalhe?: string | null;
}

/** Seleção com busca (listas longas como empreendimentos). */
export function ComboboxBusca({
  opcoes, valor, onChange, placeholder = 'Selecione…', vazio = 'Nada encontrado', id, invalido, className, permitirLimpar,
}: {
  opcoes: OpcaoBusca[];
  valor: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  vazio?: string;
  id?: string;
  invalido?: boolean;
  className?: string;
  permitirLimpar?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const atual = opcoes.find((o) => o.valor === valor);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          aria-invalid={invalido || undefined}
          className={cn('w-full justify-between font-normal', !atual && 'text-muted-foreground', invalido && 'border-destructive', className)}
        >
          <span className="truncate">{atual?.rotulo ?? placeholder}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar…" />
          <CommandList>
            <CommandEmpty>{vazio}</CommandEmpty>
            <CommandGroup>
              {permitirLimpar && valor && (
                <CommandItem value="__limpar__" onSelect={() => { onChange(null); setAberto(false); }} className="text-muted-foreground">
                  Limpar seleção
                </CommandItem>
              )}
              {opcoes.map((o) => (
                <CommandItem
                  key={o.valor}
                  value={`${o.rotulo} ${o.detalhe ?? ''} ${o.valor}`}
                  onSelect={() => { onChange(o.valor); setAberto(false); }}
                >
                  <Check className={cn('h-4 w-4', o.valor === valor ? 'opacity-100' : 'opacity-0')} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{o.rotulo}</span>
                    {o.detalhe && <span className="truncate text-xs text-muted-foreground">{o.detalhe}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
