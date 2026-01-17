import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, RotateCcw, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface LeadActionsProps {
  lead: {
    id: string;
    deleted_at?: string | null;
    nome: string;
  };
}

export default function LeadActions({ lead }: LeadActionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPermanentDeleteDialog, setShowPermanentDeleteDialog] = useState(false);

  // Soft Delete Mutation
  const softDeleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('leads')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', lead.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: "Lead movido para lixeira",
        description: "O lead foi arquivado com sucesso.",
      });
      setShowDeleteDialog(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível mover o lead para a lixeira.",
        variant: "destructive",
      });
    }
  });

  // Restore Mutation
  const restoreMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('leads')
        .update({ deleted_at: null })
        .eq('id', lead.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: "Lead restaurado",
        description: "O lead foi restaurado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível restaurar o lead.",
        variant: "destructive",
      });
    }
  });

  // Permanent Delete Mutation
  const permanentDeleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', lead.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: "Lead excluído permanentemente",
        description: "Esta ação não pode ser desfeita.",
      });
      setShowPermanentDeleteDialog(false);
    },
    onError: (error) => {
      console.error(error);
      toast({
        title: "Erro na exclusão",
        description: "Pode haver registros vinculados (visitas, logs). Exclua-os primeiro ou contate o suporte.",
        variant: "destructive",
      });
    }
  });

  if (lead.deleted_at) {
    return (
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-blue-600 border-blue-600 hover:bg-blue-50"
                onClick={() => restoreMutation.mutate()}
                disabled={restoreMutation.isPending}
              >
                <RotateCcw className="w-4 h-4" />
                <span className="sr-only">Restaurar</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Restaurar Lead</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowPermanentDeleteDialog(true)}
              >
                <Ban className="w-4 h-4" />
                <span className="sr-only">Excluir Permanentemente</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Excluir Permanentemente</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <AlertDialog open={showPermanentDeleteDialog} onOpenChange={setShowPermanentDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Permanentemente?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação apagará <strong>{lead.nome}</strong> do banco de dados para sempre e não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => permanentDeleteMutation.mutate()} className="bg-red-600 hover:bg-red-700">
                Excluir Definitivamente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-4 h-4" />
              <span className="sr-only">Mover para Lixeira</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Mover para Lixeira</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mover para Lixeira?</AlertDialogTitle>
            <AlertDialogDescription>
              O lead <strong>{lead.nome}</strong> será arquivado na lixeira. Você poderá restaurá-lo depois se necessário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => softDeleteMutation.mutate()} className="bg-orange-600 hover:bg-orange-700">
              Mover para Lixeira
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}