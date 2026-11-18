import { CalendarRange, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { descreverMeses, listaMeses, mesAtual } from '@/lib/comercial/periodo';

/** Escolha de um ou vários meses (atalhos: este mês, últimos 3, últimos 6). */
export function SeletorMeses({ valor, onChange, multiplo = true, className }: {
  valor: string[];
  onChange: (meses: string[]) => void;
  multiplo?: boolean;
  className?: string;
}) {
  const meses = listaMeses(12, 1);
  const atual = mesAtual();
  const ultimos = (n: number) => meses.filter((m) => m.chave <= atual).slice(0, n).map((m) => m.chave);
  const alternar = (chave: string) => {
    if (!multiplo) return onChange([chave]);
    const novo = valor.includes(chave) ? valor.filter((c) => c !== chave) : [...valor, chave];
    onChange(novo.length ? novo.sort() : [chave]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('justify-between gap-2', className)}>
          <span className="flex items-center gap-2"><CalendarRange className="h-4 w-4 text-primary" />{descreverMeses(valor)}</span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        {multiplo && (
          <div className="mb-2 flex flex-wrap gap-1 border-b pb-2">
            {[['Este mês', [atual]], ['Últimos 3', ultimos(3)], ['Últimos 6', ultimos(6)]].map(([rotulo, chaves]) => (
              <Button key={rotulo as string} size="sm" variant="secondary" className="h-7 px-2 text-xs"
                onClick={() => onChange([...(chaves as string[])].sort())}>{rotulo as string}</Button>
            ))}
          </div>
        )}
        <ul className="max-h-72 overflow-y-auto" role="listbox" aria-multiselectable={multiplo} aria-label="Meses">
          {meses.map((m) => {
            const marcado = valor.includes(m.chave);
            return (
              <li key={m.chave}>
                <button type="button" role="option" aria-selected={marcado} onClick={() => alternar(m.chave)}
                  className={cn('flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted',
                    marcado && 'font-medium text-primary')}>
                  <span>{m.rotuloLongo}{m.chave === atual && <span className="ml-1 text-xs text-muted-foreground">(atual)</span>}</span>
                  {marcado && <Check className="h-4 w-4" />}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
