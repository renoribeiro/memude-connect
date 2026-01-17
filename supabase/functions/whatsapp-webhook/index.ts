import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppWebhookPayload {
  messageId?: string;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp?: string;
  error?: {
    code: number;
    message: string;
  };
  phone?: string;
  metadata?: any;
}

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

    const payload: WhatsAppWebhookPayload = await req.json();
    console.log('WhatsApp webhook received:', payload);

    const { messageId, status, timestamp, error, phone, metadata } = payload;

    if (!messageId) {
      console.error('MessageId não fornecido no webhook');
      return new Response(
        JSON.stringify({ error: 'MessageId is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Atualizar status na tabela communication_log
    const { error: updateError } = await supabase
      .from('communication_log')
      .update({
        status: status || 'failed',
        metadata: {
          ...(metadata || {}),
          webhook_timestamp: timestamp || new Date().toISOString(),
          error_details: error,
          phone_number: phone
        }
      })
      .eq('message_id', messageId);

    if (updateError) {
      console.error('Erro ao atualizar communication_log:', updateError);
      throw updateError;
    }

    // Se o status é 'failed', atualizar também distribution_attempts
    if (status === 'failed') {
      const { error: attemptUpdateError } = await supabase
        .from('distribution_attempts')
        .update({
          status: 'timeout',
          response_message: `WhatsApp delivery failed: ${error?.message || 'Unknown error'}`
        })
        .eq('whatsapp_message_id', messageId);

      if (attemptUpdateError) {
        console.error('Erro ao atualizar distribution_attempts:', attemptUpdateError);
      }

      // Buscar o lead associado e tentar redistribuir
      const { data: attempt } = await supabase
        .from('distribution_attempts')
        .select(`
          lead_id,
          corretor_id,
          attempt_order
        `)
        .eq('whatsapp_message_id', messageId)
        .single();

      if (attempt) {
        console.log('Tentando redistribuir lead devido a falha no WhatsApp:', attempt.lead_id);
        
        // Chamar distribution-timeout-checker para processar essa falha
        try {
          await supabase.functions.invoke('distribution-timeout-checker', {
            body: { 
              force_process_lead: attempt.lead_id,
              reason: 'whatsapp_delivery_failed'
            }
          });
        } catch (redistributeError) {
          console.error('Erro ao redistribuir lead:', redistributeError);
        }
      }
    }

    // Se o status é 'delivered' ou 'read', marcar como enviado com sucesso
    if (status === 'delivered' || status === 'read') {
      const { error: successUpdateError } = await supabase
        .from('distribution_attempts')
        .update({
          status: 'pending' // Mantém pending até resposta do corretor
        })
        .eq('whatsapp_message_id', messageId);

      if (successUpdateError) {
        console.error('Erro ao atualizar status de entrega:', successUpdateError);
      }
    }

    // Log da atividade para auditoria
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'whatsapp_webhook',
        action: 'webhook_received',
        new_values: {
          message_id: messageId,
          status: status,
          timestamp: timestamp,
          error: error,
          phone: phone
        },
        ip_address: req.headers.get('x-forwarded-for') || 'unknown'
      });

    if (auditError) {
      console.error('Erro ao registrar auditoria:', auditError);
    }

    console.log(`WhatsApp webhook processado com sucesso - MessageId: ${messageId}, Status: ${status}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Webhook processed successfully',
        messageId: messageId,
        status: status
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in whatsapp-webhook function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});