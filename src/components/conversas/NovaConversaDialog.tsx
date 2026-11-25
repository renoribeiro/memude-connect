import { useEffect, useState } from 'react';
import { Loader2, MessageSquarePlus, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { telefoneLegivel } from '@/lib/conversas/formato';
import { useIniciarConversa } from '@/hooks/conversas/dados';
import { AvatarContato } from './pecas';

/** Começa (ou reabre) a conversa com um lead do CRM pelo número da MeMude. */
export function NovaConversaDialog({ aberto, aoFechar, aoAbrir }: { aberto: boolean; aoFechar: () => void; aoAbrir: (id: string) => void }) {
  const [busca, setBusca] = useState('');
  const [leads, setLeads] = useState<{ id: string; nome: string; telefone: string | null; status_atendimento: string | null }[]>([]);
  const [buscando, setBuscando] = useState(false);
  const iniciar = useIniciarConversa();

  useEffect(() => {
    if (!aberto) { setBusca(''); setLeads([]); return; }
    const t = busca.trim();
    const timer = setTimeout(async () => {
      setBuscando(true);
      const digitos = t.replace(/\D/g, '');
      let q = supabase.from('leads').select('id, nome, telefone, status_atendimento').is('deleted_at', null).not('telefone', 'is', null)
        .order('created_at', { ascending: false }).limit(12);
      if (digitos.length >= 4) q = q.ilike('telefone', `%${digitos}%`);
      else if (t.length >= 2) q = q.ilike('nome', `%${t.replace(/[%_]/g, '')}%`);
      const { data } = await q;
      setLeads(data ?? []);
      setBuscando(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [busca, aberto]);

  const abrir = (leadId: string) => iniciar.mutate({ lead: leadId }, {
    onSuccess: (id) => { aoFechar(); aoAbrir(String(id)); },
  });

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
          <DialogDescription>Escolha o lead. Se ele já conversa com a MeMude, a conversa existente abre.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou telefone do lead" className="pl-9" aria-label="Buscar lead" />
          {buscando && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
        <div className="max-h-80 space-y-0.5 overflow-y-auto">
          {leads.map((l) => (
            <button key={l.id} type="button" disabled={iniciar.isPending} onClick={() => abrir(l.id)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-muted disabled:opacity-60">
              <AvatarContato nome={l.nome} chave={l.id} tamanho="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{l.nome}</span>
                <span className="block text-xs text-muted-foreground">{telefoneLegivel(l.telefone)}{l.status_atendimento ? ` · ${l.status_atendimento}` : ''}</span>
              </span>
              {iniciar.isPending && iniciar.variables?.lead === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4 text-primary" />}
            </button>
          ))}
          {!buscando && !leads.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum lead encontrado.</p>}
        </div>
        <p className="text-xs text-muted-foreground">Para proteger o número, cada número inicia no máximo 40 conversas novas por dia.</p>
      </DialogContent>
    </Dialog>
  );
}
