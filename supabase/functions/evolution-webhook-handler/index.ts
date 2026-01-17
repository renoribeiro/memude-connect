import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processIncomingMessage } from '../_shared/distribution-logic.ts';

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

    const webhookData = await req.json();
    const { event, data } = webhookData;

    if (event === 'MESSAGES_UPSERT') {
        const message = data.message || data;
        const phone = message.key?.remoteJid?.replace('@s.whatsapp.net', '');
        
        // Extrair texto (suporte V2)
        let text = message.message?.conversation || 
                   message.message?.extendedTextMessage?.text || 
                   message.message?.buttonsResponseMessage?.selectedButtonId || '';

        if (!text && message.message?.listResponseMessage) {
            text = message.message.listResponseMessage.singleSelectReply.selectedRowId;
        }

        if (phone && text && !message.key.fromMe) {
            console.log(`Webhook Evolution: Recebido de ${phone}: ${text}`);
            const result = await processIncomingMessage(supabase, phone, text);
            console.log('Resultado processamento:', result);
        }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});