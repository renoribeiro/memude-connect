import { useEffect, useState } from 'react';
import { Link2, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { telefoneLegivel } from '@/lib/conversas/formato';
import { useVincularLead } from '@/hooks/conversas/dados';

/** Busca um lead existente pelo nome ou telefone e liga à conversa. */
export function VincularLead({ conversaId }: { conversaId: string }) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<{ id: string; nome: string; telefone: string | null }[]>([]);
  const [buscando, setBuscando] = useState(false);
  const vincular = useVincularLead();

  useEffect(() => {
    const t = busca.trim();
    if (t.length < 3) { setResultados([]); return; }
    const timer = setTimeout(async () => {
      setBuscando(true);
      const digitos = t.replace(/\D/g, '');
      let q = supabase.from('leads').select('id, nome, telefone').is('deleted_at', null).limit(6);
      q = digitos.length >= 4 ? q.ilike('telefone', `%${digitos}%`) : q.ilike('nome', `%${t.replace(/[%_]/g, '')}%`);
      const { data } = await q;
      setResultados(data ?? []);
      setBuscando(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  return (
    <div className="space-y-2 rounded-2xl border border-dashed border-mm-campo p-3">
      <p className="text-xs font-semibold text-muted-foreground">Sem lead vinculado. Procure o cliente no CRM:</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou telefone" className="h-10 pl-8 text-sm" aria-label="Buscar lead" />
        {buscando && <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {resultados.map((l) => (
        <button key={l.id} type="button" disabled={vincular.isPending} onClick={() => vincular.mutate({ id: conversaId, lead: l.id })}
          className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm font-semibold hover:bg-mm-lilas">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate">{l.nome}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{telefoneLegivel(l.telefone)}</span>
        </button>
      ))}
    </div>
  );
}
