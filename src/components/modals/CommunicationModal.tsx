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
      const lead = data.recipient_type === 'lead'
        ? leads.find((item) => item.id === data.recipient_id)
        : undefined;
      const corretor = data.recipient_type === 'corretor'
        ? corretores.find((item) => item.id === data.recipient_id)
        : undefined;
      const recipientName = lead?.nome
        || (corretor ? `${corretor.profiles.first_name} ${corretor.profiles.last_name}`.trim() : '');
      const phoneNumber = data.recipient_type === 'broadcast'
        ? data.phone_number
        : lead?.telefone || corretor?.whatsapp;

      if (!phoneNumber) throw new Error('O destinatário não possui telefone configurado.');

      const content = data.content.replace(/\{nome\}/g, recipientName || 'cliente');
      const { data: result, error } = await supabase.functions.invoke('evolution-send-whatsapp-v2', {
        body: {
          phone_number: phoneNumber,
          message: content,
          lead_id: data.recipient_type === 'lead' ? data.recipient_id : undefined,
          corretor_id: data.recipient_type === 'corretor' ? data.recipient_id : undefined,
          metadata: { source: 'communications-ui', recipient_type: data.recipient_type },
        },
      });

      if (error) {
        let message = error.message;
        try {
          const payload = await error.context?.json();
          message = payload?.error || payload?.message || message;
        } catch {
          // Mantém a mensagem original quando a resposta não for JSON.
        }
        throw new Error(message || 'Falha ao enviar a mensagem pelo WhatsApp.');
      }
      if (!result?.success) throw new Error(result?.error || 'O provedor não confirmou o envio.');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] });
      
      toast({
        title: "Sucesso",
        description: "Mensagem confirmada pelo provedor WhatsApp.",
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
