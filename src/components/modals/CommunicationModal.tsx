import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CommunicationForm, CommunicationFormData } from "@/components/forms/CommunicationForm";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CommunicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId?: string;
  corretorId?: string;
}

export function CommunicationModal({ isOpen, onClose, leadId, corretorId }: CommunicationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch leads for dropdown
  const { data: leads = [] } = useQuery({
    queryKey: ['leads-for-communication'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, nome, telefone, email')
        .order('nome');
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch corretores for dropdown
  const { data: corretores = [] } = useQuery({
    queryKey: ['corretores-for-communication'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corretores')
        .select(`
          id,
          whatsapp,
          profiles(first_name, last_name)
        `)
        .eq('status', 'ativo')
        .order('profiles(first_name)');
      
      if (error) throw error;
      return data;
    }
  });

  // Send communication mutation
  const mutation = useMutation({
    mutationFn: async (data: CommunicationFormData) => {
      // First, create the communication log entry
      const communicationData = {
        type: data.type,
        direction: 'enviado' as const,
        status: data.scheduled_at ? 'scheduled' : 'pending',
        phone_number: data.phone_number || null,
        content: data.content,
        lead_id: data.recipient_type === 'lead' ? data.recipient_id : null,
        corretor_id: data.recipient_type === 'corretor' ? data.recipient_id : null,
        metadata: {
          recipient_type: data.recipient_type,
          subject: data.subject,
          email: data.email,
          scheduled_at: data.scheduled_at,
        }
      };

      const { data: communication, error } = await supabase
        .from('communication_log')
        .insert(communicationData)
        .select()
        .single();

      if (error) throw error;

      // Here you would typically call an edge function to actually send the message
      // For now, we'll just simulate the sending process
      
      // Update status to sent (simulated)
      setTimeout(async () => {
        await supabase
          .from('communication_log')
          .update({ status: 'sent' })
          .eq('id', communication.id);
        
        queryClient.invalidateQueries({ queryKey: ['communications'] });
      }, 2000);

      return communication;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] });
      
      toast({
        title: "Sucesso",
        description: "Comunicação enviada com sucesso!",
      });
      
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar comunicação",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (data: CommunicationFormData) => {
    // Pre-fill recipient if specified
    if (leadId && data.recipient_type === 'lead') {
      data.recipient_id = leadId;
    }
    if (corretorId && data.recipient_type === 'corretor') {
      data.recipient_id = corretorId;
    }

    mutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Comunicação</DialogTitle>
        </DialogHeader>
        
        <CommunicationForm
          onSubmit={handleSubmit}
          isLoading={mutation.isPending}
          leads={leads}
          corretores={corretores}
        />
      </DialogContent>
    </Dialog>
  );
}