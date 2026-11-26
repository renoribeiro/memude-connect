import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { useCriarLembrete } from '@/hooks/conversas/app';
import { hojeISO } from '@/lib/conversas/agenda';

const SUGESTOES = ['Ligar para o cliente', 'Enviar simulação', 'Mandar outras opções de imóvel', 'Cobrar documentação', 'Confirmar visita'];

const instante = (diaISO: string, hhmm: string) => new Date(`${diaISO}T${hhmm}:00-03:00`);
const somarDias = (iso: string, n: number) => {
  const [a, m, d] = iso.split('-').map(Number);
  const x = new Date(Date.UTC(a, m - 1, d + n));
  return x.toISOString().slice(0, 10);
};

/** Lembrete do corretor (vira tarefa na Agenda e toca no celular na hora). */
export function NovoLembrete({ aberto, aoFechar, conversaId, nomeCliente }: {
  aberto: boolean; aoFechar: () => void; conversaId?: string | null; nomeCliente?: string | null;
}) {
  const criar = useCriarLembrete();
  const [titulo, setTitulo] = useState('');
  const [dia, setDia] = useState('');
  const [hora, setHora] = useState('');
  useEffect(() => { if (aberto) { setTitulo(''); setDia(''); setHora(''); } }, [aberto]);

  const hoje = hojeISO();
  const atalhos = useMemo(() => {
    const lista = [
      { rotulo: 'Hoje 18h', dia: hoje, hora: '18:00' },
      { rotulo: 'Amanhã 9h', dia: somarDias(hoje, 1), hora: '09:00' },
      { rotulo: 'Amanhã 14h', dia: somarDias(hoje, 1), hora: '14:00' },
      { rotulo: 'Em 3 dias', dia: somarDias(hoje, 3), hora: '10:00' },
      { rotulo: 'Em 1 semana', dia: somarDias(hoje, 7), hora: '10:00' },
    ];
    return lista.filter((a) => instante(a.dia, a.hora).getTime() > Date.now() + 5 * 60_000);
  }, [hoje]);

  const quando = dia && hora ? instante(dia, hora) : null;
  const valido = titulo.trim().length >= 3 && !!quando && quando.getTime() > Date.now();
  const salvar = () => {
    if (!valido || !quando) return;
    criar.mutate({ titulo, quando, conversa: conversaId }, { onSuccess: aoFechar });
  };

  return (
    <Drawer open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DrawerContent className="tema-memude max-h-[92dvh] bg-card">
        <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
          <DrawerTitle className="text-xl font-extrabold tracking-[-0.01em]">Novo lembrete</DrawerTitle>
          <DrawerDescription className="mt-0.5 text-sm">
            {nomeCliente ? `Para ${nomeCliente}. ` : ''}Vai para a sua Agenda e o celular avisa na hora.
          </DrawerDescription>

          <label htmlFor="lembrete-titulo" className="mt-4 block text-sm font-bold">O que você precisa fazer?</label>
          <Input id="lembrete-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200}
            placeholder="Ex.: ligar para saber o que achou da simulação" className="mt-1.5 h-12 text-base" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGESTOES.map((s) => (
              <button key={s} type="button" onClick={() => setTitulo(s)}
                className={cn('rounded-full border px-3 py-1 text-[13px] font-semibold', titulo === s ? 'border-primary bg-mm-lilas text-primary' : 'border-mm-borda-suave')}>
                {s}
              </button>
            ))}
          </div>

          <p className="mt-4 text-sm font-bold">Quando?</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {atalhos.map((a) => (
              <button key={a.rotulo} type="button" onClick={() => { setDia(a.dia); setHora(a.hora); }}
                className={cn('rounded-full border px-3 py-1.5 text-[13px] font-semibold',
                  dia === a.dia && hora === a.hora ? 'border-primary bg-primary text-white' : 'border-mm-borda-suave')}>
                {a.rotulo}
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Input type="date" min={hoje} value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Dia" className="h-12 text-base" />
            <Input type="time" step={900} value={hora} onChange={(e) => setHora(e.target.value)} aria-label="Horário" className="h-12 text-base" />
          </div>
          {quando && quando.getTime() <= Date.now() && <p className="mt-1.5 text-xs text-destructive">Escolha um horário no futuro.</p>}

          <Button variant="acao" size="lg" className="mt-5 h-14 w-full rounded-full text-lg font-extrabold" disabled={!valido || criar.isPending} onClick={salvar}>
            {criar.isPending && <Loader2 className="h-5 w-5 animate-spin" />} Criar lembrete
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
