import { Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLeadsEmMassa } from '@/hooks/comercial/dados';
import { FONTES, STATUS_ATENDIMENTO } from '@/lib/comercial/constantes';
import { StatusAtendimentoBadge } from './ui';

export function ConfirmarExclusao({ aberto, onOpenChange, quantidade, nome, onConfirmar, pendente }: {
  aberto: boolean; onOpenChange: (v: boolean) => void; quantidade: number; nome?: string; onConfirmar: () => void; pendente?: boolean;
}) {
  const alvo = quantidade === 1 ? (nome ? `o lead ${nome}` : 'este lead') : `${quantidade} leads`;
  return (
    <AlertDialog open={aberto} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {alvo}?</AlertDialogTitle>
          <AlertDialogDescription>
            {quantidade === 1 ? 'O lead sai' : 'Os leads saem'} da lista e do quadro do CRM e fica{quantidade === 1 ? '' : 'm'} como
            "ARQUIVADO" na planilha. O histórico e as visitas são mantidos, e dá para desfazer logo depois pelo aviso.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={pendente}
            onClick={(e) => { e.preventDefault(); onConfirmar(); }}>
            {pendente && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Barra que aparece com leads selecionados: status, responsável e fonte em massa, ou excluir. */
export function BarraSelecaoLeads({ ids, responsaveis, onLimpar, onExcluir }: {
  ids: string[]; responsaveis: { user_id: string; nome: string }[]; onLimpar: () => void; onExcluir: () => void;
}) {
  const { alterar } = useLeadsEmMassa();
  const aplicar = (campos: Record<string, unknown>, rotulo: string) =>
    alterar.mutate({ ids, campos }, {
      onSuccess: (r) => { toast.success(`${rotulo} · ${r?.alterados ?? ids.length} lead(s)`); onLimpar(); },
    });
  return (
    <div role="toolbar" aria-label="Ações para os leads selecionados"
      className="sticky top-0 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 shadow-sm">
      <span className="mr-1 text-sm font-semibold text-primary-dark">
        {ids.length} {ids.length === 1 ? 'selecionado' : 'selecionados'}
      </span>
      <Select value="" onValueChange={(v) => aplicar({ status_atendimento: v }, `Status: ${v}`)} disabled={alterar.isPending}>
        <SelectTrigger className="h-8 w-[150px] bg-card" aria-label="Mudar status dos selecionados"><SelectValue placeholder="Mudar status" /></SelectTrigger>
        <SelectContent>{STATUS_ATENDIMENTO.map((s) => <SelectItem key={s} value={s}><StatusAtendimentoBadge status={s} /></SelectItem>)}</SelectContent>
      </Select>
      <Select value="" onValueChange={(v) => aplicar({ responsavel_id: v === 'nenhum' ? null : v }, 'Responsável alterado')} disabled={alterar.isPending}>
        <SelectTrigger className="h-8 w-[170px] bg-card" aria-label="Mudar responsável dos selecionados"><SelectValue placeholder="Mudar responsável" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="nenhum">Sem responsável</SelectItem>
          {responsaveis.map((r) => <SelectItem key={r.user_id} value={r.user_id}>{r.nome}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value="" onValueChange={(v) => aplicar({ fonte: v }, `Fonte: ${v}`)} disabled={alterar.isPending}>
        <SelectTrigger className="h-8 w-[130px] bg-card" aria-label="Mudar fonte dos selecionados"><SelectValue placeholder="Mudar fonte" /></SelectTrigger>
        <SelectContent>{FONTES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
      </Select>
      {alterar.isPending && <Loader2 className="h-4 w-4 animate-spin text-primary" aria-label="Aplicando" />}
      <div className="ml-auto flex gap-2">
        <Button size="sm" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50" onClick={onExcluir}>
          <Trash2 /> Excluir
        </Button>
        <Button size="sm" variant="ghost" onClick={onLimpar}><X /> Limpar seleção</Button>
      </div>
    </div>
  );
}
