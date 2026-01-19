import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, CheckCircle, XCircle, MessageSquare, Calendar, Eye, Trash2, RotateCcw, Trash } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface VisitaActionsProps {
  visitaId: string;
  status: string;
  leadId: string;
  onEdit: () => void;
  onView: () => void;
  isCorretor?: boolean;
  deletedAt?: string | null;
}

export function VisitaActions({
  visitaId,
  status,
  leadId,
  onEdit,
  onView,
  isCorretor = false,
  deletedAt = null
}: VisitaActionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [leadComments, setLeadComments] = useState("");
  const [hasInterest, setHasInterest] = useState(false);

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ newStatus, data }: { newStatus: string; data?: any }) => {
      const updateData: any = { status: newStatus };

      if (data) {
        Object.assign(updateData, data);
      }

      const { error } = await supabase
        .from('visitas')
        .update(updateData)
        .eq('id', visitaId);

      if (error) throw error;

      // Update lead status based on visit status
      let leadStatus = null;
      switch (newStatus) {
        case 'confirmada':
          leadStatus = 'visita_confirmada';
          break;
        case 'realizada':
          leadStatus = 'visita_realizada';
          break;
        case 'cancelada':
          leadStatus = 'cancelado';
          break;
      }

      if (leadStatus) {
        await supabase
          .from('leads')
          .update({ status: leadStatus })
          .eq('id', leadId);
      }

      // If interested, trigger CRM integration
      if (data?.interesse) {
        try {
          const { error: fnError } = await supabase.functions.invoke('send-lead-to-crm', {
            body: { visitaId }
          });

          if (fnError) {
            console.error('Error sending to CRM:', fnError);
            toast({
              title: "Atenção",
              description: "Status salvo, mas houve erro ao enviar para o CRM.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "CRM Integrado",
              description: "Lead enviado para o CRM com sucesso!",
            });
          }
        } catch (err) {
          console.error('Failed to invoke CRM function:', err);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitas'] });
      queryClient.invalidateQueries({ queryKey: ['my-visitas'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });

      toast({
        title: "Sucesso",
        description: "Status da visita atualizado com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar status",
        variant: "destructive",
      });
    }
  });

  const handleConfirm = () => {
    updateStatusMutation.mutate({ newStatus: 'confirmada' });
  };

  const handleCancel = () => {
    updateStatusMutation.mutate({ newStatus: 'cancelada' });
  };

  const handleMarkCompleted = () => {
    updateStatusMutation.mutate({
      newStatus: 'realizada',
      data: {
        avaliacao_lead: rating > 0 ? rating : null,
        feedback_corretor: feedback.trim() || null,
        comentarios_lead: leadComments.trim() || null,
        interesse: hasInterest
      }
    });
  };

  // Soft delete mutation
  const softDeleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('soft_delete_visita', {
        visita_id: visitaId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitas'] });
      queryClient.invalidateQueries({ queryKey: ['my-visitas'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: "Visita movida para lixeira",
        description: "A visita foi movida para a lixeira com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('restore_visita', {
        visita_id: visitaId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitas'] });
      queryClient.invalidateQueries({ queryKey: ['my-visitas'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: "Visita restaurada",
        description: "A visita foi restaurada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao restaurar",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Hard delete mutation
  const hardDeleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('hard_delete_visita', {
        visita_id: visitaId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitas'] });
      queryClient.invalidateQueries({ queryKey: ['my-visitas'] });
      toast({
        title: "Visita excluída permanentemente",
        description: "A visita foi excluída permanentemente do sistema.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir permanentemente",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const renderStars = () => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={cn(
          "w-5 h-5 cursor-pointer transition-colors",
          i < rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground hover:text-yellow-400"
        )}
        onClick={() => setRating(i + 1)}
      />
    ));
  };

  // If deleted, show different actions
  if (deletedAt) {
    return (
      <div className="flex items-center gap-2">
        {/* Restore */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-green-600 border-green-600 hover:bg-green-50"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Restaurar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restaurar Visita</AlertDialogTitle>
              <AlertDialogDescription>
                Deseja restaurar esta visita? Ela voltará para a lista de visitas ativas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => restoreMutation.mutate()}
                disabled={restoreMutation.isPending}
              >
                {restoreMutation.isPending ? "Restaurando..." : "Restaurar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Hard Delete */}
        {!isCorretor && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-600 hover:bg-red-50"
              >
                <Trash className="w-3 h-3 mr-1" />
                Excluir Permanentemente
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir Permanentemente</AlertDialogTitle>
                <AlertDialogDescription className="text-red-600 font-medium">
                  ⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL! A visita será excluída permanentemente do sistema e não poderá ser recuperada.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => hardDeleteMutation.mutate()}
                  disabled={hardDeleteMutation.isPending}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {hardDeleteMutation.isPending ? "Excluindo..." : "Sim, Excluir Permanentemente"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* View Details */}
        <Button
          variant="outline"
          size="sm"
          onClick={onView}
        >
          <Eye className="w-3 h-3 mr-1" />
          Detalhes
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Confirm Visit */}
      {(status === 'agendada' || status === 'reagendada') && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-green-600 border-green-600 hover:bg-green-50"
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Confirmar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Visita</AlertDialogTitle>
              <AlertDialogDescription>
                Deseja confirmar esta visita? O lead será notificado sobre a confirmação.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirm}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? "Confirmando..." : "Confirmar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Mark as Completed */}
      {(status === 'confirmada' || ((status === 'agendada' || status === 'reagendada') && isCorretor)) && (
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-blue-600 border-blue-600 hover:bg-blue-50"
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Marcar Realizada
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Marcar Visita como Realizada</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Avaliação da Visita</Label>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {renderStars()}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {rating > 0 && `${rating}/5`}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="leadComments">Comentários do Lead</Label>
                <Textarea
                  id="leadComments"
                  value={leadComments}
                  onChange={(e) => setLeadComments(e.target.value)}
                  placeholder="Comentários ou feedback do lead sobre a visita..."
                  className="min-h-[60px]"
                />
              </div>

              <div className="flex items-center space-x-2 py-2">
                <Switch
                  id="interest-mode"
                  checked={hasInterest}
                  onCheckedChange={setHasInterest}
                />
                <Label htmlFor="interest-mode" className="font-medium text-primary">
                  Cliente tem interesse na compra?
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback">Seu Feedback</Label>
                <Textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Adicione seu feedback sobre esta visita..."
                  className="min-h-[60px]"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setRating(0);
                    setFeedback("");
                    setLeadComments("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleMarkCompleted}
                  disabled={updateStatusMutation.isPending}
                >
                  {updateStatusMutation.isPending ? "Salvando..." : "Marcar Realizada"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Cancel Visit */}
      {(status === 'agendada' || status === 'confirmada' || status === 'reagendada') && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-600 hover:bg-red-50"
            >
              <XCircle className="w-3 h-3 mr-1" />
              Cancelar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar Visita</AlertDialogTitle>
              <AlertDialogDescription>
                Deseja cancelar esta visita? Esta ação irá alterar o status do lead.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Não</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancel}
                disabled={updateStatusMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {updateStatusMutation.isPending ? "Cancelando..." : "Sim, Cancelar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Reschedule */}
      {status === 'cancelada' && (
        <Button
          variant="outline"
          size="sm"
          className="text-orange-600 border-orange-600 hover:bg-orange-50"
          onClick={onEdit}
        >
          <Calendar className="w-3 h-3 mr-1" />
          Reagendar
        </Button>
      )}

      {/* Send Reminder */}
      {status === 'confirmada' && isCorretor && (
        <Button
          variant="outline"
          size="sm"
          className="text-purple-600 border-purple-600 hover:bg-purple-50"
        >
          <MessageSquare className="w-3 h-3 mr-1" />
          Lembrete
        </Button>
      )}

      {/* View Details */}
      <Button
        variant="outline"
        size="sm"
        onClick={onView}
      >
        <Eye className="w-3 h-3 mr-1" />
        Detalhes
      </Button>

      {/* Edit */}
      {!isCorretor && (
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
        >
          Editar
        </Button>
      )}

      {/* Soft Delete */}
      {!isCorretor && (status === 'agendada' || status === 'cancelada' || status === 'reagendada') && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Excluir
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Visita</AlertDialogTitle>
              <AlertDialogDescription>
                Deseja mover esta visita para a lixeira? Você poderá restaurá-la posteriormente se necessário.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => softDeleteMutation.mutate()}
                disabled={softDeleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {softDeleteMutation.isPending ? "Excluindo..." : "Sim, Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}