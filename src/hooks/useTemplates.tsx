import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MessageTemplate {
  id: string;
  name: string;
  category: 'lead_distribution' | 'visit_distribution' | 'visit_confirmation' | 'visit_reminder' | 'follow_up' | 'welcome' | 'admin_notification' | 'payment_reminder' | 'feedback_request' | 'custom';
  type: 'whatsapp' | 'sms' | 'email' | 'sistema';
  subject?: string;
  content: string;
  variables: string[];
  is_active: boolean;
  is_system: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Fase 5: Novos campos para mensagens interativas
  button_config?: Array<{ id: string; text: string }>;
  media_config?: {
    type: 'image' | 'video' | 'document' | 'audio';
    url: string;
    caption?: string;
    filename?: string;
  };
  list_config?: {
    title: string;
    description?: string;
    buttonText: string;
    sections: Array<{
      title: string;
      rows: Array<{
        id: string;
        title: string;
        description?: string;
      }>;
    }>;
  };
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

export interface TemplateVariable {
  id: string;
  name: string;
  description: string;
  category: string;
  data_type: 'text' | 'date' | 'time' | 'number' | 'boolean';
  default_value?: string;
}

interface TemplateFilters {
  category?: string;
  type?: string;
  is_system?: boolean;
  search?: string;
}

export const useTemplates = (filters?: TemplateFilters) => {
  return useQuery({
    queryKey: ['templates', filters],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('template-manager', {
        body: {
          action: 'list',
          filters
        }
      });

      if (error) throw error;
      return data.templates as MessageTemplate[];
    }
  });
};

export const useTemplateVariables = () => {
  return useQuery({
    queryKey: ['template-variables'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('template_variables')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;
      return data as TemplateVariable[];
    }
  });
};

export const useCreateTemplate = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateData: Omit<MessageTemplate, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'profiles'>) => {
      const { data, error } = await supabase.functions.invoke('template-manager', {
        body: {
          action: 'create',
          templateData
        }
      });

      if (error) throw error;
      return data.template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast({
        title: "Template criado",
        description: "Template criado com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar template",
        description: error.message,
        variant: "destructive",
      });
    }
  });
};

export const useUpdateTemplate = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...templateData }: Partial<MessageTemplate> & { id: string }) => {
      const { data, error } = await supabase.functions.invoke('template-manager', {
        body: {
          action: 'update',
          templateId: id,
          templateData
        }
      });

      if (error) throw error;
      return data.template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast({
        title: "Template atualizado",
        description: "Template atualizado com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar template",
        description: error.message,
        variant: "destructive",
      });
    }
  });
};

export const useDuplicateTemplate = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data, error } = await supabase.functions.invoke('template-manager', {
        body: {
          action: 'duplicate',
          templateId
        }
      });

      if (error) throw error;
      return data.template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast({
        title: "Template duplicado",
        description: "Template duplicado com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao duplicar template",
        description: error.message,
        variant: "destructive",
      });
    }
  });
};

export const useDeleteTemplate = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data, error } = await supabase.functions.invoke('template-manager', {
        body: {
          action: 'delete',
          templateId
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast({
        title: "Template excluído",
        description: "Template excluído com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir template",
        description: error.message,
        variant: "destructive",
      });
    }
  });
};