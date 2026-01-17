import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WhatsAppInvitationRequest {
  phone_number: string;
  name: string;
  creci: string;
  email: string;
  resetUrl: string;
  corretor_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number, name, creci, email, resetUrl, corretor_id }: WhatsAppInvitationRequest = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Sending WhatsApp invitation to:", phone_number);

    // Get Evolution API settings
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['evolution_api_url', 'evolution_api_key', 'evolution_instance_name']);

    if (settingsError) {
      throw new Error(`Settings error: ${settingsError.message}`);
    }

    const settingsMap = settings.reduce((acc: any, setting: any) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    const { evolution_api_url, evolution_api_key, evolution_instance_name } = settingsMap;

    if (!evolution_api_url || !evolution_api_key || !evolution_instance_name) {
      throw new Error('Evolution API não configurada. Configure as credenciais em Configurações.');
    }

    // Format message
    const message = `🎉 *Bem-vindo ao MeMude Connect!*

Olá *${name}*!

Sua conta foi criada com sucesso no nosso sistema de gestão imobiliária. Você agora faz parte da nossa equipe de corretores!

📋 *Seus dados de acesso:*
• Email: ${email}
• CRECI: ${creci}

🔐 *Para começar a usar o sistema:*
1. Acesse: ${window.location?.origin || 'https://memude.com'}
2. Clique no link que enviamos por email para definir sua senha
3. Ou use este link direto: ${resetUrl}

📧 *Importante:* Verifique sua caixa de entrada (e span) para o email de boas-vindas com instruções completas.

💼 *O que você pode fazer no sistema:*
• Gerenciar seus leads
• Agendar e acompanhar visitas
• Receber notificações de novos clientes
• Acompanhar sua performance

❓ *Dúvidas?* Entre em contato conosco através deste WhatsApp.

Seja muito bem-vindo(a) à equipe MeMude Connect! 🏠✨`;

    // Send WhatsApp message via Evolution API V2
    const apiUrl = evolution_api_url.replace(/\/$/, '');
    const evolutionResponse = await fetch(`${apiUrl}/message/sendText/${evolution_instance_name}`, {
      method: 'POST',
      headers: {
        'apikey': evolution_api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: phone_number.replace(/\D/g, ''),
        textMessage: {
          text: message
        }
      }),
    });

    const evolutionData = await evolutionResponse.json();

    if (!evolutionResponse.ok) {
      throw new Error(`Evolution API error: ${evolutionData.message || 'Unknown error'}`);
    }

    // Log the communication
    await supabase
      .from('communication_log')
      .insert({
        phone_number: phone_number,
        message_id: evolutionData.key?.id || null,
        content: message,
        direction: 'enviado',
        type: 'whatsapp',
        status: 'sent',
        corretor_id: corretor_id || null,
        metadata: evolutionData
      });

    console.log("WhatsApp invitation sent successfully:", evolutionData);

    return new Response(JSON.stringify({ 
      success: true, 
      message_id: evolutionData.key?.id,
      evolutionData 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending WhatsApp invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);