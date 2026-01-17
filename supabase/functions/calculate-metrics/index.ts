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
    console.log('=== CALCULATING DISTRIBUTION METRICS ===');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Calcular métricas do dia anterior
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = yesterday.toISOString().split('T')[0];

    console.log('Calculating metrics for:', targetDate);

    // Buscar todas as tentativas de distribuição do dia
    const { data: attempts, error: attemptsError } = await supabase
      .from('visit_distribution_attempts')
      .select(`
        *,
        visita:visita_id (
          id,
          created_at,
          corretor_id
        )
      `)
      .gte('created_at', `${targetDate}T00:00:00`)
      .lt('created_at', `${targetDate}T23:59:59`);

    if (attemptsError) {
      throw attemptsError;
    }

    console.log(`Found ${attempts?.length || 0} attempts for ${targetDate}`);

    // Calcular métricas
    const totalAttempts = attempts?.length || 0;
    const totalAccepts = attempts?.filter(a => a.response_type === 'accept').length || 0;
    const totalRejects = attempts?.filter(a => a.response_type === 'reject').length || 0;
    const totalTimeouts = attempts?.filter(a => a.status === 'expired').length || 0;

    // Calcular visitas únicas (distribuições)
    const uniqueVisitas = new Set(attempts?.map(a => a.visita_id)).size;
    
    // Distribuições bem sucedidas (visitas que foram atribuídas)
    const successfulDistributions = attempts?.filter(a => 
      a.response_type === 'accept' && a.visita?.corretor_id
    ).length || 0;

    // Calcular tempo médio de resposta (apenas para accepts)
    const acceptedAttempts = attempts?.filter(a => 
      a.response_type === 'accept' && a.response_received_at
    ) || [];

    let avgResponseTime = null;
    if (acceptedAttempts.length > 0) {
      const totalMinutes = acceptedAttempts.reduce((sum, attempt) => {
        const sentAt = new Date(attempt.message_sent_at).getTime();
        const receivedAt = new Date(attempt.response_received_at!).getTime();
        const minutes = (receivedAt - sentAt) / (1000 * 60);
        return sum + minutes;
      }, 0);
      avgResponseTime = totalMinutes / acceptedAttempts.length;
    }

    // Salvar métricas
    const { error: metricsError } = await supabase
      .from('distribution_metrics')
      .upsert({
        date: targetDate,
        total_distributions: uniqueVisitas,
        successful_distributions: successfulDistributions,
        failed_distributions: uniqueVisitas - successfulDistributions,
        avg_response_time_minutes: avgResponseTime,
        total_attempts: totalAttempts,
        total_timeouts: totalTimeouts,
        total_accepts: totalAccepts,
        total_rejects: totalRejects
      }, { onConflict: 'date' });

    if (metricsError) {
      throw metricsError;
    }

    console.log('✓ Metrics calculated successfully');

    // Atualizar métricas individuais dos corretores
    const corretorStats = new Map<string, {
      accepts: number,
      rejects: number,
      responseTimes: number[]
    }>();

    attempts?.forEach(attempt => {
      if (!attempt.corretor_id) return;

      if (!corretorStats.has(attempt.corretor_id)) {
        corretorStats.set(attempt.corretor_id, {
          accepts: 0,
          rejects: 0,
          responseTimes: []
        });
      }

      const stats = corretorStats.get(attempt.corretor_id)!;

      if (attempt.response_type === 'accept') {
        stats.accepts++;
        
        if (attempt.response_received_at) {
          const sentAt = new Date(attempt.message_sent_at).getTime();
          const receivedAt = new Date(attempt.response_received_at).getTime();
          const minutes = (receivedAt - sentAt) / (1000 * 60);
          stats.responseTimes.push(minutes);
        }
      } else if (attempt.response_type === 'reject') {
        stats.rejects++;
      }
    });

    // Atualizar cada corretor
    for (const [corretorId, stats] of corretorStats.entries()) {
      const avgResponseTime = stats.responseTimes.length > 0
        ? stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length
        : null;

      await supabase
        .from('corretores')
        .update({
          total_accepts: supabase.raw(`total_accepts + ${stats.accepts}`),
          total_rejects: supabase.raw(`total_rejects + ${stats.rejects}`),
          avg_response_time_minutes: avgResponseTime,
          last_activity_at: new Date().toISOString()
        })
        .eq('id', corretorId);
    }

    console.log(`✓ Updated ${corretorStats.size} corretores`);

    return new Response(
      JSON.stringify({
        success: true,
        date: targetDate,
        metrics: {
          total_distributions: uniqueVisitas,
          successful: successfulDistributions,
          failed: uniqueVisitas - successfulDistributions,
          avg_response_time: avgResponseTime,
          total_attempts: totalAttempts,
          corretores_updated: corretorStats.size
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro ao calcular métricas:', error);
    
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
