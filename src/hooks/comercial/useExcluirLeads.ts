import { toast } from 'sonner';
import { useLeadsEmMassa } from '@/hooks/comercial/dados';

/** Exclui (vai para a lixeira) e oferece "Desfazer" no aviso. */
export function useExcluirLeads() {
  const { excluir, restaurar } = useLeadsEmMassa();
  const executar = (ids: string[], aoConcluir?: () => void) =>
    excluir.mutate(ids, {
      onSuccess: (r) => {
        aoConcluir?.();
        const n = r?.excluidos ?? ids.length;
        toast.success(`${n} ${n === 1 ? 'lead excluído' : 'leads excluídos'}`, {
          description: 'Saíram da lista e do quadro do CRM.',
          duration: 10_000,
          action: {
            label: 'Desfazer',
            onClick: () => restaurar.mutate(r?.ids?.length ? r.ids : ids, {
              onSuccess: (x) => toast.success(`${x?.restaurados ?? 0} restaurado(s)`),
            }),
          },
        });
      },
    });
  return { executar, pendente: excluir.isPending };
}
