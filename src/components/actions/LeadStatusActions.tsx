import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronDown, 
  Phone, 
  Calendar, 
  CheckCircle, 
  XCircle,
  MessageSquare,
  Clock,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LeadStatusActionsProps {
  lead: {
    id: string;
    status: string;
    nome: string;
  };
}

const statusConfig = {
  'novo': {
    label: 'Novo',
    variant: 'default' as const,
    icon: Clock,
    color: 'text-gray-600'
  },
  'buscando_corretor': {
    label: 'Em Contato',
    variant: 'secondary' as const,
    icon: Phone,
    color: 'text-blue-600'
  },
  'visita_agendada': {
    label: 'Agendado',
    variant: 'outline' as const,
    icon: Calendar,
    color: 'text-orange-600'
  },
  'visita_realizada': {
    label: 'Visitou',
    variant: 'success' as const,
    icon: CheckCircle,
    color: 'text-green-600'
  },
  'cancelado': {
    label: 'Perdido',
    variant: 'destructive' as const,
    icon: XCircle,
    color: 'text-red-600'
  },
  'follow_up': {
    label: 'Follow-up',
    variant: 'outline' as const,
    icon: MessageSquare,
    color: 'text-purple-600'
  }
};

export default function LeadStatusActions({ lead }: LeadStatusActionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus as any })
        .eq('id', lead.id);
      
      if (error) throw error;
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['my-leads'] });
      
      const statusLabel = statusConfig[newStatus as keyof typeof statusConfig]?.label || newStatus;
      toast({
        title: "Status atualizado",
        description: `Lead ${lead.nome} marcado como: ${statusLabel}`,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do lead.",
        variant: "destructive",
      });
    }
  });

  const currentStatus = statusConfig[lead.status as keyof typeof statusConfig];
  const CurrentIcon = currentStatus?.icon || Clock;

  const getNextStatuses = (currentStatus: string) => {
    const statusFlow = {
      'novo': ['buscando_corretor', 'cancelado'],
      'buscando_corretor': ['visita_agendada', 'follow_up', 'cancelado'],
      'visita_agendada': ['visita_realizada', 'cancelado'],
      'visita_realizada': ['follow_up'],
      'cancelado': ['buscando_corretor', 'follow_up'],
      'follow_up': ['visita_agendada', 'visita_realizada', 'cancelado']
    };

    return statusFlow[currentStatus as keyof typeof statusFlow] || [];
  };

  const nextStatuses = getNextStatuses(lead.status);

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant={currentStatus?.variant || 'default'}
        className="flex items-center gap-1"
      >
        <CurrentIcon className="w-3 h-3" />
        {currentStatus?.label || lead.status}
      </Badge>

      {nextStatuses.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  Alterar Status
                  <ChevronDown className="w-3 h-3 ml-1" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {nextStatuses.map((status) => {
              const config = statusConfig[status as keyof typeof statusConfig];
              const Icon = config?.icon || Clock;
              
              return (
                <DropdownMenuItem
                  key={status}
                  onClick={() => updateStatusMutation.mutate(status)}
                  className="cursor-pointer"
                >
                  <Icon className={`w-4 h-4 mr-2 ${config?.color || 'text-gray-600'}`} />
                  {config?.label || status}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}