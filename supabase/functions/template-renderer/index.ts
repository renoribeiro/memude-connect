
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TemplateRenderRequest {
  templateId?: string;
  category?: string;
  type?: string;
  variables: Record<string, any>;
  previewMode?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: TemplateRenderRequest;
    try {
      body = await req.json();
    } catch (e) {
      throw new Error('Invalid JSON payload');
    }

    const {
      templateId,
      category,
      type,
      variables,
      previewMode = false
    } = body;

    let template;

    // Buscar template por ID ou por categoria/tipo
    if (templateId) {
      const { data } = await supabase
        .from('message_templates')
        .select('*')
        .eq('id', templateId)
        .eq('is_active', true)
        .single();
      template = data;
    } else if (category && type) {
      const { data } = await supabase
        .from('message_templates')
        .select('*')
        .eq('category', category)
        .eq('type', type)
        .eq('is_active', true)
        .eq('is_system', true)
        .order('created_at', { ascending: true })
        .limit(1);
      template = data?.[0];
    }

    if (!template) {
      return new Response(JSON.stringify({
        error: 'Template não encontrado',
        rendered_content: null
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Renderizar template com variáveis
    let renderedContent = template.content;

    // Adicionar variáveis do sistema
    const systemVariables = {
      data_atual: new Date().toLocaleDateString('pt-BR'),
      hora_atual: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      empresa: 'Memude Imóveis'
    };

    const allVariables = { ...systemVariables, ...variables };

    // Substituir variáveis no template
    for (const [key, value] of Object.entries(allVariables)) {
      const variablePattern = new RegExp(`{${key}}`, 'g');
      renderedContent = renderedContent.replace(variablePattern, String(value || ''));
    }

    // Verificar variáveis não substituídas (opcional para debug)
    const unresolvedVariables = renderedContent.match(/{[^}]+}/g) || [];

    console.log('Template renderizado:', {
      templateId: template.id,
      templateName: template.name,
      category: template.category,
      type: template.type,
      variablesUsed: Object.keys(allVariables),
      unresolvedVariables,
      previewMode
    });

    return new Response(JSON.stringify({
      template_id: template.id,
      template_name: template.name,
      category: template.category,
      type: template.type,
      subject: template.subject,
      rendered_content: renderedContent,
      original_content: template.content,
      variables_used: Object.keys(allVariables),
      unresolved_variables: unresolvedVariables,
      preview_mode: previewMode
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Erro no template-renderer:', error);
    return new Response(JSON.stringify({
      error: error.message,
      rendered_content: null
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});