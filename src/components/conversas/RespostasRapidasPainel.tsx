import { useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { EstadoVazio } from '@/components/comercial/ui';
import type { RespostaRapida } from '@/lib/conversas/tipos';
import { useExcluirResposta, useRespostasRapidas, useSalvarResposta } from '@/hooks/conversas/dados';
import { useAuth } from '@/hooks/useAuth';

/** Respostas rápidas: atalhos "/" no chat. As da equipe valem para todos; as pessoais só para quem criou. */
export function RespostasRapidasPainel() {
  const { user, isComercial } = useAuth();
  const { data: respostas = [] } = useRespostasRapidas();
  const salvar = useSalvarResposta();
  const excluir = useExcluirResposta();
  const [editando, setEditando] = useState<Partial<RespostaRapida> & { equipe?: boolean } | null>(null);

  const podeEditar = (r: RespostaRapida) => r.dono_id === user?.id || (r.dono_id == null && isComercial);
  const gravar = () => {
    if (!editando) return;
    salvar.mutate({
      id: editando.id ?? null, atalho: (editando.atalho ?? '').toLowerCase().replace(/[^a-z0-9-]/g, ''),
      titulo: editando.titulo ?? '', texto: editando.texto ?? '', equipe: Boolean(editando.equipe),
    }, { onSuccess: () => setEditando(null) });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Respostas rápidas</h2>
          <p className="text-sm text-muted-foreground">No chat, digite <kbd className="rounded border bg-muted px-1 font-mono text-xs">/</kbd> e o atalho para usar.</p>
        </div>
        <Button onClick={() => setEditando({ equipe: isComercial })}><Plus className="h-4 w-4" /> Nova resposta</Button>
      </div>
      {!respostas.length ? <EstadoVazio icone={Zap} titulo="Nenhuma resposta rápida" descricao="Crie atalhos para as mensagens que você manda todo dia." /> : (
        <div className="divide-y rounded-xl border bg-card">
          {respostas.map((r) => (
            <div key={r.id} className="flex items-start gap-3 p-3">
              <span className="mt-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">/{r.atalho}</span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium">{r.titulo}{r.dono_id == null && <Users className="h-3.5 w-3.5 text-muted-foreground" aria-label="Da equipe" />}</p>
                <p className="line-clamp-2 text-sm text-muted-foreground">{r.texto}</p>
              </div>
              {podeEditar(r) && (
                <div className="flex shrink-0">
                  <Button variant="ghost" size="icon" aria-label={`Editar /${r.atalho}`} onClick={() => setEditando({ ...r, equipe: r.dono_id == null })}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Excluir /${r.atalho}`} onClick={() => excluir.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editando} onOpenChange={(v) => !v && setEditando(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando?.id ? 'Editar resposta rápida' : 'Nova resposta rápida'}</DialogTitle>
            <DialogDescription>Use *negrito* e _itálico_ como no WhatsApp.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-[8rem_1fr] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rr-atalho">Atalho</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">/</span>
                  <Input id="rr-atalho" className="pl-6 font-mono" value={editando?.atalho ?? ''} maxLength={30} placeholder="tabela"
                    onChange={(e) => setEditando((v) => ({ ...v, atalho: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rr-titulo">Título</Label>
                <Input id="rr-titulo" value={editando?.titulo ?? ''} maxLength={60} placeholder="Envio da tabela"
                  onChange={(e) => setEditando((v) => ({ ...v, titulo: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rr-texto">Mensagem</Label>
              <Textarea id="rr-texto" rows={5} maxLength={2000} value={editando?.texto ?? ''} onChange={(e) => setEditando((v) => ({ ...v, texto: e.target.value }))} />
            </div>
            {isComercial && (
              <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <span><span className="font-medium">Disponível para toda a equipe</span><span className="block text-xs text-muted-foreground">Corretores também veem e usam</span></span>
                <Switch checked={Boolean(editando?.equipe)} onCheckedChange={(c) => setEditando((v) => ({ ...v, equipe: c }))} />
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={gravar} disabled={salvar.isPending || (editando?.atalho ?? '').length < 2 || (editando?.titulo ?? '').trim().length < 2 || (editando?.texto ?? '').trim().length < 2}>
              {salvar.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
