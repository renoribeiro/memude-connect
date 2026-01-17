import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { CheckCircle, XCircle, Ban, Loader2, Trash2, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CorretorActionsProps {
  corretor: {
    id: string;
    status: string;
    deleted_at?: string | null;
    profiles: {
      first_name: string;
      last_name: string;
    };
  };
}

export default function CorretorActions({ corretor }: CorretorActionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, data_avaliacao }: { status: string; data_avaliacao?: string }) => {
      const updateData: any = { status };
      if (data_avaliacao) {
        updateData.data_avaliacao = data_avaliacao;
      }

      const { error } = await supabase
        .from('corretores')
        .update(updateData)
        .eq('id', corretor.id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['corretores'] });
      
      const statusMessages = {
        'ativo': 'Corretor aprovado com sucesso!',
        'inativo': 'Corretor rejeitado.',
        'bloqueado': 'Corretor suspenso.'
      };
      
      toast({
        title: "Status atualizado",
        description: statusMessages[variables.status as keyof typeof statusMessages],
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do corretor.",
        variant: "destructive",
      });
    }
  });

  const handleApprove = () => {
    updateStatusMutation.mutate({ 
      status: 'ativo', 
      data_avaliacao: new Date().toISOString().split('T')[0] 
    });
    setShowApproveDialog(false);
  };

  const handleReject = () => {
    updateStatusMutation.mutate({ status: 'inativo' });
    setShowRejectDialog(false);
  };

  const handleSuspend = () => {
    updateStatusMutation.mutate({ status: 'bloqueado' });
    setShowSuspendDialog(false);
  };

  const handleReactivate = () => {
    updateStatusMutation.mutate({ status: 'ativo' });
  };

  // Mutation para soft delete
  const softDeleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('corretores')
        .update({ 
          deleted_at: new Date().toISOString(),
          status: 'inativo'
        })
        .eq('id', corretor.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corretores'] });
      toast({
        title: "Corretor excluído",
        description: "O corretor foi movido para a lixeira.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o corretor.",
        variant: "destructive",
      });
    }
  });

  // Mutation para restaurar
  const restoreMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('corretores')
        .update({ 
          deleted_at: null,
          status: 'em_avaliacao'
        })
        .eq('id', corretor.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corretores'] });
      toast({
        title: "Corretor restaurado",
        description: "O corretor foi restaurado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível restaurar o corretor.",
        variant: "destructive",
      });
    }
  });

  const handleDelete = () => {
    softDeleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  const handleRestore = () => {
    restoreMutation.mutate();
  };

  // Se está na lixeira, mostrar apenas botão de restaurar
  if (corretor.deleted_at) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="text-blue-600 border-blue-600 hover:bg-blue-50"
        onClick={handleRestore}
        disabled={restoreMutation.isPending}
      >
        {restoreMutation.isPending ? (
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        ) : (
          <RotateCcw className="w-3 h-3 mr-1" />
        )}
        Restaurar
      </Button>
    );
  }

  if (corretor.status === 'em_avaliacao') {
    return (
      <>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-green-600 border-green-600 hover:bg-green-50"
            onClick={() => setShowApproveDialog(true)}
            disabled={updateStatusMutation.isPending}
          >
            {updateStatusMutation.isPending ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <CheckCircle className="w-3 h-3 mr-1" />
            )}
            Aprovar
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-600 hover:bg-red-50"
            onClick={() => setShowRejectDialog(true)}
            disabled={updateStatusMutation.isPending}
          >
            <XCircle className="w-3 h-3 mr-1" />
            Rejeitar
          </Button>
        </div>

        {/* Dialog de Aprovação */}
        <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Aprovar Corretor</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja aprovar {corretor.profiles.first_name} {corretor.profiles.last_name}?
                O corretor será ativado e poderá começar a receber leads.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleApprove}>
                Aprovar Corretor
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog de Rejeição */}
        <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rejeitar Corretor</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja rejeitar {corretor.profiles.first_name} {corretor.profiles.last_name}?
                O corretor será marcado como inativo e não poderá receber leads.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleReject} className="bg-red-600 hover:bg-red-700">
                Rejeitar Corretor
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  if (corretor.status === 'ativo') {
    return (
      <>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-orange-600 border-orange-600 hover:bg-orange-50"
            onClick={() => setShowSuspendDialog(true)}
            disabled={updateStatusMutation.isPending}
          >
            {updateStatusMutation.isPending ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Ban className="w-3 h-3 mr-1" />
            )}
            Suspender
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-600 hover:bg-red-50"
            onClick={() => setShowDeleteDialog(true)}
            disabled={softDeleteMutation.isPending}
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Excluir
          </Button>
        </div>

        {/* Dialog de Suspensão */}
        <AlertDialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Suspender Corretor</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja suspender {corretor.profiles.first_name} {corretor.profiles.last_name}?
                O corretor será temporariamente bloqueado e não poderá receber novos leads.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleSuspend} className="bg-orange-600 hover:bg-orange-700">
                Suspender Corretor
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog de Exclusão */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Corretor</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir {corretor.profiles.first_name} {corretor.profiles.last_name}?
                O corretor será movido para a lixeira e poderá ser restaurado posteriormente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                Excluir Corretor
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  if (corretor.status === 'bloqueado' || corretor.status === 'inativo') {
    return (
      <Button
        variant="outline"
        size="sm"
        className="text-blue-600 border-blue-600 hover:bg-blue-50"
        onClick={handleReactivate}
        disabled={updateStatusMutation.isPending}
      >
        {updateStatusMutation.isPending ? (
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        ) : (
          <CheckCircle className="w-3 h-3 mr-1" />
        )}
        Reativar
      </Button>
    );
  }

  return (
    <Badge variant="secondary">
      {corretor.status}
    </Badge>
  );
}