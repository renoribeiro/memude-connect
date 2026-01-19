import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VisitaForm, VisitaFormData } from "@/components/forms/VisitaForm";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizeTime } from '@/utils/dateHelpers';
import LeadModal from "./LeadModal";

interface VisitaModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitaId?: string;
  leadId?: string;
  corretorId?: string;
}

export function VisitaModal({ isOpen, onClose, visitaId, leadId, corretorId }: VisitaModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [newlyCreatedLeadId, setNewlyCreatedLeadId] = useState<string | null>(null);

  const handleLeadCreated = (leadId: string) => {
    setNewlyCreatedLeadId(leadId);
    setIsLeadModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ['leads'] });
  };

  // Fetch visita data if editing
  const { data: visita, isLoading: isLoadingVisita } = useQuery({
    queryKey: ['visita', visitaId],
    queryFn: async () => {
      if (!visitaId) return null;

      const { data, error } = await supabase
        .from('visitas')
        .select('*')
        .eq('id', visitaId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!visitaId
  });

  // Debug log for data flow
  useEffect(() => {
    console.log('🔍 [VisitaModal] Estado atual:', {
      visitaId,
      visitaData: visita,
      isLoadingVisita,
      isOpen
    });
  }, [visitaId, visita, isLoadingVisita, isOpen]);

  // Fetch leads for dropdown
  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, nome, telefone')
        .order('nome');

      if (error) throw error;
      return data;
    }
  });

  // Check for existing active visits for the selected lead (pre-submission validation)
  const selectedLeadId = newlyCreatedLeadId || leadId;
  const { data: existingVisitas = [] } = useQuery({
    queryKey: ['visitas-by-lead', selectedLeadId],
    queryFn: async () => {
      if (!selectedLeadId || visitaId) return [];

      const { data, error } = await supabase
        .from('visitas')
        .select('id, status, data_visita, horario_visita')
        .eq('lead_id', selectedLeadId)
        .in('status', ['agendada', 'confirmada']);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedLeadId && !visitaId
  });

  // Fetch corretores for dropdown
  const { data: corretores = [] } = useQuery({
    queryKey: ['corretores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('corretores')
        .select(`
          id,
          profiles(first_name, last_name)
        `)
        .eq('status', 'ativo')
        .order('profiles(first_name)');

      if (error) throw error;
      return data;
    }
  });

  // Fetch empreendimentos for dropdown
  const { data: empreendimentos = [] } = useQuery({
    queryKey: ['empreendimentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empreendimentos')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      return data;
    }
  });

  // Create/Update mutation
  const mutation = useMutation({
    mutationFn: async (data: VisitaFormData) => {
      const visitaData = {
        lead_id: data.lead_id,
        corretor_id: data.auto_assign_corretor ? null : (data.corretor_id || null),
        empreendimento_id: data.empreendimento_id || null,
        data_visita: data.data_visita.toISOString().split('T')[0],
        horario_visita: data.horario_visita,
        status: data.status,
        avaliacao_lead: data.avaliacao_lead || null,
        comentarios_lead: data.comentarios_lead || null,
        feedback_corretor: data.feedback_corretor || null,
      };

      if (visitaId) {
        // Update existing visita
        const { data: result, error } = await supabase
          .from('visitas')
          .update(visitaData)
          .eq('id', visitaId)
          .select()
          .single();

        if (error) throw error;
        return { visita: result, autoAssign: data.auto_assign_corretor || false };
      } else {
        // Create new visita
        const { data: result, error } = await supabase
          .from('visitas')
          .insert(visitaData)
          .select()
          .single();

        if (error) throw error;
        return { visita: result, autoAssign: data.auto_assign_corretor || false };
      }
    },
    onSuccess: async (responseData) => {
      const { visita, autoAssign } = responseData;

      queryClient.invalidateQueries({ queryKey: ['visitas'] });
      queryClient.invalidateQueries({ queryKey: ['my-visitas'] });

      // Update lead status if visit was scheduled
      if (visita.status === 'agendada') {
        supabase
          .from('leads')
          .update({ status: 'visita_agendada' })
          .eq('id', visita.lead_id)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
          });
      }

      // If auto-assign is enabled, trigger distribution
      // Works for both new visits and rescheduled visits (edits with auto_assign)
      const shouldDistribute = autoAssign && visita.id &&
        (visita.status === 'agendada' || visita.status === 'reagendada');

      if (shouldDistribute) {
        console.log('Iniciando distribuição automática para visita:', visita.id);

        toast({
          title: visitaId ? "Visita reagendada!" : "Visita criada!",
          description: "Buscando corretor disponível automaticamente...",
        });

        try {
          const { data: distributionResult, error: distributionError } = await supabase.functions.invoke(
            'distribute-visit',
            {
              body: { visita_id: visita.id }
            }
          );

          if (distributionError) {
            console.error('Erro na distribuição automática:', distributionError);

            // Mensagens de erro específicas e acionáveis
            let errorMessage = "Visita salva, mas houve erro na distribuição automática.";

            if (distributionError.message?.includes('cleanPhone') ||
              distributionError.message?.includes('not defined')) {
              errorMessage = "Erro técnico no sistema de distribuição. Nossa equipe foi notificada.";
            } else if (distributionError.message?.includes('telefone') ||
              distributionError.message?.includes('phone')) {
              errorMessage = "Corretor sem telefone válido cadastrado. Atribua manualmente.";
            } else if (distributionError.message?.includes('WhatsApp')) {
              errorMessage = "Erro ao enviar mensagem WhatsApp. Verifique as configurações da Evolution API.";
            }

            toast({
              title: "Aviso",
              description: errorMessage,
              variant: "destructive",
            });
          } else {
            console.log('Distribuição iniciada com sucesso:', distributionResult);
            toast({
              title: "Distribuição iniciada!",
              description: `Consultando ${distributionResult.total_eligible || 'vários'} corretores disponíveis...`,
            });
          }
        } catch (error) {
          console.error('Erro ao invocar distribute-visit:', error);
          toast({
            title: "Aviso",
            description: "Visita salva, mas erro ao iniciar distribuição. Atribua manualmente.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Sucesso",
          description: visitaId ? "Visita atualizada com sucesso!" : "Visita agendada com sucesso!",
        });
      }

      onClose();
    },
    onError: (error: any) => {
      console.error('Erro ao salvar visita:', error);

      let errorMessage = "Erro ao salvar visita";
      let errorTitle = "Erro ao salvar visita";
      let actionLink = null;

      // FASE 2: Mensagens de erro específicas e acionáveis
      if (error.message?.includes('webhook') || error.message?.includes('Webhook não configurado')) {
        errorTitle = "⚙️ Webhook não configurado";
        errorMessage = "O webhook da Evolution API não está configurado. Configure para receber respostas dos corretores.";
        actionLink = { text: "Ir para Configurações", url: "/configuracoes" };
      } else if (error.message?.includes('WhatsApp') || error.message?.includes('whatsapp')) {
        errorTitle = "📱 Erro ao enviar WhatsApp";
        errorMessage = "Não foi possível enviar mensagem WhatsApp. Verifique se a API Evolution está configurada corretamente.";
        actionLink = { text: "Testar Conexão", url: "/configuracoes" };
      } else if (error.message?.includes('telefone') || error.message?.includes('phone')) {
        errorTitle = "📞 Corretor sem contato válido";
        errorMessage = "O corretor selecionado não possui WhatsApp ou telefone cadastrado. Atualize os dados do corretor.";
        actionLink = { text: "Ver Corretores", url: "/corretores" };
      } else if (error.message?.includes('pending') || error.message?.includes('aguardando')) {
        errorTitle = "✅ Mensagem enviada";
        errorMessage = "A mensagem foi enviada ao corretor. Aguardando resposta...";
        errorTitle = "Sucesso"; // Change to success
      } else if (error.message?.includes('duplicate key') || error.message?.includes('visitas_lead_id_key')) {
        errorMessage = "Já existe uma visita registrada com estes dados. Verifique os campos e tente novamente.";
      } else if (error.message?.includes('validation') || error.message?.includes('required')) {
        errorMessage = "Dados inválidos. Verifique todos os campos obrigatórios.";
      } else if (error.message?.includes('foreign key') || error.message?.includes('não existe')) {
        errorMessage = "Erro de referência. Verifique se o lead e corretor selecionados existem.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: errorTitle,
        description: actionLink
          ? `${errorMessage}\n\n👉 ${actionLink.text}`
          : errorMessage,
        variant: errorTitle === "Sucesso" ? "default" : "destructive",
      });
    }
  });

  const handleSubmit = (data: VisitaFormData) => {
    mutation.mutate(data);
  };

  const initialData = visitaId && visita ? {
    lead_id: visita.lead_id,
    corretor_id: visita.corretor_id || undefined,
    empreendimento_id: visita.empreendimento_id || undefined,
    data_visita: new Date(visita.data_visita),
    horario_visita: normalizeTime(visita.horario_visita),
    status: visita.status as 'agendada' | 'confirmada' | 'realizada' | 'cancelada' | 'reagendada',
    avaliacao_lead: visita.avaliacao_lead || undefined,
    comentarios_lead: visita.comentarios_lead || '',
    feedback_corretor: visita.feedback_corretor || '',
    auto_assign_corretor: false,
  } : {
    lead_id: newlyCreatedLeadId || leadId,
    corretor_id: corretorId,
    status: 'agendada' as const,
    auto_assign_corretor: false,
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          key={visitaId || 'new'}
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>
              {visitaId ? 'Editar Visita' : 'Nova Visita'}
            </DialogTitle>
          </DialogHeader>

          {visitaId && isLoadingVisita ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-32 w-full" />
              <div className="flex gap-4 justify-end">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
          ) : (
            <>
              {existingVisitas.length > 0 && !visitaId && (
                <div className="mb-4 p-4 bg-warning/10 border border-warning rounded-lg">
                  <p className="text-sm text-warning-foreground font-medium">
                    ⚠️ Atenção: Este lead já possui {existingVisitas.length} visita(s) ativa(s):
                  </p>
                  <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                    {existingVisitas.map((v) => (
                      <li key={v.id}>
                        • {v.status} - {new Date(v.data_visita).toLocaleDateString('pt-BR')} às {v.horario_visita}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <VisitaForm
                initialData={initialData}
                onSubmit={handleSubmit}
                isLoading={mutation.isPending}
                leads={leads}
                corretores={corretores}
                empreendimentos={empreendimentos}
                onAddNewLead={() => setIsLeadModalOpen(true)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <LeadModal
        open={isLeadModalOpen}
        onOpenChange={setIsLeadModalOpen}
        title="Novo Lead"
        initialData={null}
        onLeadCreated={handleLeadCreated}
      />
    </>
  );
}