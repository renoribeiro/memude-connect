import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authorize, handleOptions, readJson } from '../_shared/security.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || 'https://core.memudecore.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TemplateRequest {
  action: 'create' | 'update' | 'delete' | 'list' | 'duplicate';
  templateId?: string;
  templateData?: {
    name: string;
    category: string;
    type: string;
    subject?: string;
    content: string;
    variables?: string[];
    is_active?: boolean;
  };
  filters?: {
    category?: string;
    type?: string;
    is_system?: boolean;
    search?: string;
  };
}

function writableTemplateFields(data: NonNullable<TemplateRequest['templateData']>) {
  return {
    name: data.name,
    category: data.category,
    type: data.type,
    subject: data.subject,
    content: data.content,
    variables: data.variables || [],
    is_active: data.is_active ?? true,
  };
}

const handler = async (req: Request): Promise<Response> => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const access = await authorize(req, 'authenticated');
    if (access instanceof Response) return access;
    const { supabase, userId } = access;

    // Buscar perfil do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Perfil não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: roleRecord, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    if (roleError) throw roleError;
    const isAdmin = roleRecord?.role === 'admin';

    const { action, templateId, templateData, filters } =
      await readJson<TemplateRequest>(req, 32 * 1024);

    switch (action) {
      case 'list': {
        let query = supabase
          .from('message_templates')
          .select(`
            id,
            name,
            category,
            type,
            subject,
            content,
            variables,
            is_active,
            is_system,
            created_at,
            updated_at,
            created_by,
            profiles:created_by(first_name, last_name)
          `)
          .order('created_at', { ascending: false });

        if (filters?.category) {
          query = query.eq('category', filters.category);
        }
        if (filters?.type) {
          query = query.eq('type', filters.type);
        }
        if (filters?.is_system !== undefined) {
          query = query.eq('is_system', filters.is_system);
        }
        if (filters?.search) {
          query = query.or(`name.ilike.%${filters.search}%,content.ilike.%${filters.search}%`);
        }

        const { data: templates, error } = await query;

        if (error) throw error;

        return new Response(JSON.stringify({ templates }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'create': {
        if (!templateData) {
          return new Response(JSON.stringify({ error: 'Dados do template obrigatórios' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: newTemplate, error } = await supabase
          .from('message_templates')
          .insert({
            ...writableTemplateFields(templateData),
            created_by: profile.id,
            is_system: false,
          })
          .select()
          .single();

        if (error) throw error;

        console.log('Template criado:', newTemplate);

        return new Response(JSON.stringify({ template: newTemplate }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'update': {
        if (!templateId || !templateData) {
          return new Response(JSON.stringify({ error: 'ID e dados do template obrigatórios' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Verificar se o usuário pode editar este template
        const { data: existingTemplate } = await supabase
          .from('message_templates')
          .select('created_by, is_system')
          .eq('id', templateId)
          .single();

        if (!existingTemplate) {
          return new Response(JSON.stringify({ error: 'Template não encontrado' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (existingTemplate.is_system && !isAdmin) {
          return new Response(JSON.stringify({ error: 'Apenas administradores podem editar templates do sistema' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        if (!existingTemplate.is_system && !isAdmin && existingTemplate.created_by !== profile.id) {
          return new Response(JSON.stringify({ error: 'Você só pode editar seus próprios templates' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: updatedTemplate, error } = await supabase
          .from('message_templates')
          .update(writableTemplateFields(templateData))
          .eq('id', templateId)
          .select()
          .single();

        if (error) throw error;

        console.log('Template atualizado:', updatedTemplate);

        return new Response(JSON.stringify({ template: updatedTemplate }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'duplicate': {
        if (!templateId) {
          return new Response(JSON.stringify({ error: 'ID do template obrigatório' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: originalTemplate } = await supabase
          .from('message_templates')
          .select('*')
          .eq('id', templateId)
          .single();

        if (!originalTemplate) {
          return new Response(JSON.stringify({ error: 'Template não encontrado' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: duplicatedTemplate, error } = await supabase
          .from('message_templates')
          .insert({
            name: `${originalTemplate.name} (Cópia)`,
            category: originalTemplate.category,
            type: originalTemplate.type,
            subject: originalTemplate.subject,
            content: originalTemplate.content,
            variables: originalTemplate.variables,
            is_active: true,
            is_system: false,
            created_by: profile.id
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ template: duplicatedTemplate }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'delete': {
        if (!templateId) {
          return new Response(JSON.stringify({ error: 'ID do template obrigatório' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Verificar se é um template do sistema
        const { data: existingTemplate } = await supabase
          .from('message_templates')
          .select('created_by, is_system')
          .eq('id', templateId)
          .single();

        if (!existingTemplate) {
          return new Response(JSON.stringify({ error: 'Template não encontrado' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (existingTemplate.is_system) {
          return new Response(JSON.stringify({ error: 'Templates do sistema não podem ser excluídos' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        if (!isAdmin && existingTemplate.created_by !== profile.id) {
          return new Response(JSON.stringify({ error: 'Você só pode excluir seus próprios templates' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { error } = await supabase
          .from('message_templates')
          .delete()
          .eq('id', templateId);

        if (error) throw error;

        console.log('Template excluído:', templateId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Ação não suportada' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error: any) {
    console.error('Erro no template-manager:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

serve(handler);
