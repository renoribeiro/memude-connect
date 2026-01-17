import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    console.log('Testing webhook connection...');

    // Criar payload de teste simulando um webhook da Evolution API
    const testPayload = {
      event: 'TEST_CONNECTION',
      instance: 'test-instance',
      data: {
        test: true,
        timestamp: new Date().toISOString(),
        message: 'Webhook test initiated from admin panel'
      }
    };

    console.log('Sending test payload:', testPayload);

    // Enviar requisição para o webhook handler
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/evolution-webhook-handler`;
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      },
      body: JSON.stringify(testPayload)
    });

    const responseData = await response.json();

    console.log('Webhook response:', {
      status: response.status,
      ok: response.ok,
      data: responseData
    });

    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        message: response.ok 
          ? 'Webhook está funcionando corretamente!' 
          : 'Webhook retornou erro',
        details: responseData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error testing webhook:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Erro ao testar webhook'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});
