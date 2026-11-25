import { useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useEquipe } from '@/hooks/comercial/dados';
import { useCorretoresComApp, useTransferir } from '@/hooks/conversas/dados';
import { AvatarContato } from './pecas';

const chave = (d: Destino | null) => (d ? `${d.papel}-${d.id ?? 'fila'}` : '');

interface Destino { id: string | null; nome: string; papel: 'sdr' | 'closer' | 'corretor'; detalhe: string; inativo?: boolean }

export function TransferirDialog({ aberto, aoFechar, conversaId, donoAtual }: {
  aberto: boolean; aoFechar: () => void; conversaId: string; donoAtual: string | null;
}) {
  const { data: equipe = [] } = useEquipe();
  const { data: corretores = [], isLoading } = useCorretoresComApp();
  const transferir = useTransferir();
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState<Destino | null>(null);
  const [motivo, setMotivo] = useState('');

  const destinos = useMemo<Destino[]>(() => {
    const lista: Destino[] = [
      { id: null, nome: 'Fila da SDR', papel: 'sdr', detalhe: 'Qualquer pessoa do atendimento pode assumir' },
      ...equipe.filter((u) => u.papel !== 'corretor').map((u) => ({
        id: u.user_id, nome: u.nome, papel: (u.closer ? 'closer' : 'sdr') as Destino['papel'], detalhe: u.closer ? 'Closer' : 'Atendimento',
      })),
      ...corretores.map((c) => ({ id: c.userId, nome: c.nome, papel: 'corretor' as const, detalhe: c.ativo ? 'Corretor · vê só as conversas dele' : 'Corretor inativo', inativo: !c.ativo })),
    ];
    const t = busca.trim().toLowerCase();
    return lista.filter((d) => d.id !== donoAtual && (!t || d.nome.toLowerCase().includes(t)));
  }, [equipe, corretores, busca, donoAtual]);

  // Só vale a escolha que está visível na lista agora (busca e dono atual mudam a lista)
  const sel = destinos.find((d) => chave(d) === chave(escolhido)) ?? null;
  const fechar = () => { setEscolhido(null); setMotivo(''); setBusca(''); aoFechar(); };

  const confirmar = () => {
    const escolhido = sel;
    if (!escolhido) return;
    transferir.mutate({ id: conversaId, para: escolhido.id, papel: escolhido.papel, motivo: motivo.trim() || undefined, nome: escolhido.id ? escolhido.nome : undefined }, {
      onSuccess: fechar,
    });
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && fechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir conversa</DialogTitle>
          <DialogDescription>O cliente continua falando com o mesmo número da MeMude. Só muda quem atende.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoa" className="pl-9" autoFocus aria-label="Buscar pessoa" />
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto pr-1" role="radiogroup" aria-label="Para quem">
          {isLoading && <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-muted-foreground" />}
          {destinos.map((d) => (
            <button key={chave(d)} type="button" role="radio" aria-checked={chave(escolhido) === chave(d)} disabled={d.inativo}
              onClick={() => setEscolhido(d)}
              className={cn('flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition disabled:opacity-50',
                chave(escolhido) === chave(d) ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-transparent hover:bg-muted')}>
              <AvatarContato nome={d.nome} tamanho="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{d.nome}</span>
                <span className="block truncate text-xs text-muted-foreground">{d.detalhe}</span>
              </span>
            </button>
          ))}
          {!isLoading && destinos.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Ninguém encontrado.</p>}
        </div>
        <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional) — fica no histórico" rows={2} maxLength={200} className="text-base sm:text-sm" />
        <DialogFooter>
          <Button variant="ghost" onClick={fechar}>Cancelar</Button>
          <Button onClick={confirmar} disabled={!sel || transferir.isPending}>
            {transferir.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
