import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get request body
    const { visitaId } = await req.json();

    if (!visitaId) {
      throw new Error('visitaId is required');
    }

    console.log(`Processing CRM sync for visit: ${visitaId}`);

    // Fetch Visit details with related entities
    const { data: visita, error: visitaError } = await supabase
      .from('visitas')
      .select(`
        *,
        lead:leads!inner(*),
        corretor:corretores(
          *,
          profiles(*)
        ),
        empreendimento:empreendimentos(*)
      `)
      .eq('id', visitaId)
      .single();

    if (visitaError || !visita) {
      console.error('Error fetching visit:', visitaError);
      throw new Error('Visit not found');
    }

    // Krayin Configuration
    // Users should set these secrets in Supabase Dashboard
    const KRAYIN_URL = Deno.env.get('KRAYIN_API_URL'); // e.g., "https://crm.memudecore.com.br/api"
    const KRAYIN_TOKEN = Deno.env.get('KRAYIN_API_TOKEN');

    if (!KRAYIN_URL || !KRAYIN_TOKEN) {
      console.warn('Krayin credentials missing. Skipping CRM sync.');
      // Return success but with warning message to frontend
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Krayin CRM credentials (KRAYIN_API_URL, KRAYIN_API_TOKEN) not configured in Edge Function.' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Prepare Payload for Krayin CRM
    // Based on standard Krayin structure. 
    // We create a Lead which typically creates/links a Person.
    
    const personName = visita.lead.nome;
    const personPhone = visita.lead.telefone; // Should be formatted
    const personEmail = visita.lead.email || '';
    
    // Format description with rich details
    const description = `
[Origem: MeMude Connect]
Empreendimento: ${visita.empreendimento?.nome || 'N/A'}
Endereço: ${visita.empreendimento?.endereco || 'N/A'}
Valor Ref: ${visita.empreendimento?.valor_min ? 'R$ ' + visita.empreendimento.valor_min : 'N/A'}

[Detalhes da Visita]
Data: ${visita.data_visita}
Horário: ${visita.horario_visita}
Corretor: ${visita.corretor?.profiles?.first_name} ${visita.corretor?.profiles?.last_name || ''}
WhatsApp Corretor: ${visita.corretor?.whatsapp}

[Feedback]
Feedback Corretor: ${visita.feedback_corretor || 'N/A'}
Comentários Lead: ${visita.comentarios_lead || 'N/A'}
Avaliação Lead: ${visita.avaliacao_lead ? visita.avaliacao_lead + '/5' : 'N/A'}
    `.trim();

    const leadPayload = {
      title: `${personName} - Interesse em ${visita.empreendimento?.nome || 'Imóvel'}`,
      description: description,
      lead_value: visita.empreendimento?.valor_min || 0,
      status: 1, // 1 = New/Draft typically. Adjust based on Krayin setup.
      lead_source_id: 1, // Default source.
      lead_type_id: 1, // Default type.
      
      // Person details (Krayin often accepts this nested to create/link person)
      person: {
        name: personName,
        emails: personEmail ? [{ value: personEmail, label: 'work' }] : [],
        contact_numbers: [{ value: personPhone, label: 'mobile' }],
      }
    };

    console.log('Sending payload to Krayin:', JSON.stringify(leadPayload));

    // Send to Krayin API
    const response = await fetch(`${KRAYIN_URL}/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KRAYIN_TOKEN}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(leadPayload)
    });

    let result;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      result = await response.json();
    } else {
      result = await response.text();
    }

    if (!response.ok) {
      console.error('Krayin API Error Response:', result);
      throw new Error(`Krayin API failed with status ${response.status}: ${JSON.stringify(result)}`);
    }

    console.log('Successfully synced to Krayin:', result);

    // Update 'visitas' to record sync success (optional, or log in a specific table)
    // For now, we rely on logs.

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in send-lead-to-crm:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
