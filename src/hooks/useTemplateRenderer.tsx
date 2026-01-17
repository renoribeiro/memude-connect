import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface RenderTemplateParams {
  templateId?: string;
  category?: string;
  type?: string;
  variables: Record<string, any>;
  previewMode?: boolean;
}

interface RenderedTemplate {
  template_id: string;
  template_name: string;
  category: string;
  type: string;
  subject?: string;
  rendered_content: string;
  original_content: string;
  variables_used: string[];
  unresolved_variables: string[];
  preview_mode: boolean;
}

export const useTemplateRenderer = () => {
  return useMutation({
    mutationFn: async (params: RenderTemplateParams): Promise<RenderedTemplate> => {
      const { data, error } = await supabase.functions.invoke('template-renderer', {
        body: params
      });

      if (error) throw error;
      return data as RenderedTemplate;
    }
  });
};

// Hook específico para renderizar templates por categoria/tipo
export const useRenderTemplateByCategory = () => {
  const renderTemplate = useTemplateRenderer();

  return {
    renderDistributionMessage: (variables: Record<string, any>, matchType: 'bairro' | 'construtora' = 'bairro') => {
      const category = matchType === 'bairro' ? 'lead_distribution' : 'lead_distribution';
      return renderTemplate.mutateAsync({
        category,
        type: 'whatsapp',
        variables,
        previewMode: false
      });
    },
    
    renderVisitConfirmation: (variables: Record<string, any>) => {
      return renderTemplate.mutateAsync({
        category: 'visit_confirmation',
        type: 'whatsapp',
        variables,
        previewMode: false
      });
    },
    
    renderVisitReminder: (variables: Record<string, any>) => {
      return renderTemplate.mutateAsync({
        category: 'visit_reminder',
        type: 'whatsapp',
        variables,
        previewMode: false
      });
    },
    
    renderWelcomeMessage: (variables: Record<string, any>) => {
      return renderTemplate.mutateAsync({
        category: 'welcome',
        type: 'whatsapp',
        variables,
        previewMode: false
      });
    },
    
    renderAdminNotification: (variables: Record<string, any>) => {
      return renderTemplate.mutateAsync({
        category: 'admin_notification',
        type: 'whatsapp',
        variables,
        previewMode: false
      });
    },
    
    ...renderTemplate
  };
};