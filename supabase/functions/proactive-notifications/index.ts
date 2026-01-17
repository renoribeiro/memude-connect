import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== PROACTIVE NOTIFICATIONS ===');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const notifications = [];

    // 1. Verificar visitas sem corretor após todas tentativas
    const { data: failedVisitas } = await supabase
      .from('visit_distribution_queue')
      .select(`
        *,
        visita:visita_id (
          id,
          lead:lead_id (nome, telefone),
          empreendimento:empreendimento_id (nome)
        )
      `)
      .eq('status', 'failed')
      .is('assigned_corretor_id', null)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (failedVisitas && failedVisitas.length > 0) {
      console.log(`Found ${failedVisitas.length} failed visits without broker`);

      // Notificar admin
      const { data: adminSettings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'admin_whatsapp')
        .single();

      if (adminSettings?.value) {
        for (const visita of failedVisitas) {
          const message = `🚨 *VISITA SEM CORRETOR*

*Visita ID:* ${visita.visita?.id}
*Lead:* ${visita.visita?.lead?.nome}
*Telefone:* ${visita.visita?.lead?.telefone}
*Empreendimento:* ${visita.visita?.empreendimento?.nome}

Todas as tentativas de distribuição falharam. Por favor, atribua manualmente.`;

          await supabase.functions.invoke('evolution-send-whatsapp-v2', {
            body: {
              phone: adminSettings.value,
              text: message,
              metadata: {
                type: 'admin_notification_failed_visit',
                visita_id: visita.visita_id
              }
            }
          });

          notifications.push({
            type: 'failed_distribution',
            visita_id: visita.visita_id
          });
        }
      }
    }

    // 2. Verificar taxa de sucesso baixa (< 70%)
    const { data: recentMetrics } = await supabase
      .from('distribution_metrics')
      .select('*')
      .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(7);

    if (recentMetrics && recentMetrics.length > 0) {
      const totalDists = recentMetrics.reduce((sum, m) => sum + m.total_distributions, 0);
      const successDists = recentMetrics.reduce((sum, m) => sum + m.successful_distributions, 0);
      const successRate = totalDists > 0 ? (successDists / totalDists) * 100 : 0;

      if (successRate < 70) {
        console.log(`Low success rate detected: ${successRate.toFixed(1)}%`);

        // Criar notificação in-app para admin
        const { data: adminProfile } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('role', 'admin')
          .single();

        if (adminProfile) {
          await supabase.rpc('create_notification', {
            p_user_id: adminProfile.user_id,
            p_type: 'system_alert',
            p_title: 'Taxa de Sucesso Baixa',
            p_message: `A taxa de sucesso de distribuição está em ${successRate.toFixed(1)}% (últimos 7 dias). Meta: 70%+`,
            p_metadata: { success_rate: successRate, days: 7 }
          });

          notifications.push({
            type: 'low_success_rate',
            rate: successRate
          });
        }
      }
    }

    // 3. Verificar corretores com muitas recusas consecutivas (3+)
    const { data: recentAttempts } = await supabase
      .from('visit_distribution_attempts')
      .select('corretor_id, response_type, created_at')
      .eq('response_type', 'reject')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (recentAttempts) {
      const corretorRejects = new Map<string, number>();

      recentAttempts.forEach(attempt => {
        const count = corretorRejects.get(attempt.corretor_id) || 0;
        corretorRejects.set(attempt.corretor_id, count + 1);
      });

      for (const [corretorId, rejectCount] of corretorRejects.entries()) {
        if (rejectCount >= 3) {
          console.log(`Corretor ${corretorId} has ${rejectCount} consecutive rejects`);

          // Criar notificação in-app para admin
          const { data: corretor } = await supabase
            .from('corretores')
            .select(`
              id,
              profiles:profile_id (
                first_name,
                last_name,
                user_id
              )
            `)
            .eq('id', corretorId)
            .single();

          if (corretor) {
            const { data: adminProfile } = await supabase
              .from('profiles')
              .select('user_id')
              .eq('role', 'admin')
              .single();

            if (adminProfile) {
              await supabase.rpc('create_notification', {
                p_user_id: adminProfile.user_id,
                p_type: 'system_alert',
                p_title: 'Corretor com Muitas Recusas',
                p_message: `${corretor.profiles?.first_name} ${corretor.profiles?.last_name} recusou ${rejectCount} visitas consecutivas nas últimas 24h.`,
                p_metadata: { corretor_id: corretorId, reject_count: rejectCount },
                p_related_corretor_id: corretorId
              });

              notifications.push({
                type: 'high_reject_rate',
                corretor_id: corretorId,
                reject_count: rejectCount
              });
            }
          }
        }
      }
    }

    // 4. Lembretes para corretores 5 min antes do timeout
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    const { data: expiringAttempts } = await supabase
      .from('visit_distribution_attempts')
      .select(`
        *,
        corretor:corretor_id (
          whatsapp,
          telefone,
          profiles:profile_id (first_name)
        ),
        visita:visita_id (
          lead:lead_id (nome)
        )
      `)
      .eq('status', 'pending')
      .lte('timeout_at', fiveMinutesFromNow.toISOString())
      .gte('timeout_at', new Date().toISOString());

    if (expiringAttempts && expiringAttempts.length > 0) {
      console.log(`Found ${expiringAttempts.length} attempts expiring soon`);

      for (const attempt of expiringAttempts) {
        const phoneNumber = attempt.corretor?.whatsapp || attempt.corretor?.telefone;
        if (phoneNumber) {
          const message = `⏰ *LEMBRETE: VISITA PENDENTE*

Olá ${attempt.corretor?.profiles?.first_name}!

Você tem *5 minutos* para responder sobre a visita do lead *${attempt.visita?.lead?.nome}*.

Responda *SIM* para aceitar ou *NÃO* para recusar.`;

          await supabase.functions.invoke('evolution-send-whatsapp-v2', {
            body: {
              phone: phoneNumber,
              text: message,
              metadata: {
                type: 'timeout_reminder',
                attempt_id: attempt.id,
                visita_id: attempt.visita_id
              }
            }
          });

          notifications.push({
            type: 'timeout_reminder',
            attempt_id: attempt.id
          });
        }
      }
    }

    console.log(`✓ Sent ${notifications.length} notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        notifications_sent: notifications.length,
        notifications
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro em notificações proativas:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
