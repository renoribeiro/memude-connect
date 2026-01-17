import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processIncomingMessage } from '../_shared/distribution-logic.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, X-Api-Key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    console.log('Webhook WAHA Recebido:', JSON.stringify(payload));

    // WAHA Payload structure for message.any
    // { event: "message.any", payload: { from: "...", body: "...", ... } }
    const event = payload.event;
    const data = payload.payload;

    if (event === 'message.any' || event === 'message.upsert') {
        // Ignorar mensagens enviadas por mim
        if (data.fromMe) {
            return new Response(JSON.stringify({ status: 'ignored_fromMe' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const phone = data.from?.replace('@c.us', '');
        
        // Extrair texto (WAHA simplifica isso geralmente em 'body')
        let text = data.body;
        
        // Se for resposta de botão, WAHA pode mandar diferente dependendo da versão
        if (data._data?.quotedMsg?.type === 'buttons_response') {
             text = data._data.quotedMsg.selectedButtonId || data.body; 
        }

        if (phone && text) {
            console.log(`Webhook WAHA: Recebido de ${phone}: ${text}`);
            const result = await processIncomingMessage(supabase, phone, text);
            console.log('Resultado processamento:', result);
        }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
