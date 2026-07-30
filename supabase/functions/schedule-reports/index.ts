import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { authorize, readJson } from '../_shared/security.ts';
import { Resend } from 'npm:resend@4.6.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || 'https://core.memudecore.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const access = await authorize(req, 'internal');
    if (access instanceof Response) return access;

    const supabase = access.supabase;

    console.log('Processing scheduled reports...');

    // Get all active scheduled reports that need to run
    const { data: scheduledReports, error: reportsError } = await supabase
      .from('scheduled_reports')
      .select(`
        *,
        report_templates (
          name,
          description,
          template_config
        )
      `)
      .eq('is_active', true)
      .lte('next_run', new Date().toISOString());

    if (reportsError) {
      console.error('Error fetching scheduled reports:', reportsError);
      throw reportsError;
    }

    console.log(`Found ${scheduledReports?.length ?? 0} reports to process`);

    for (const scheduledReport of scheduledReports) {
      try {
        await processScheduledReport(supabase, scheduledReport);
      } catch (error) {
        console.error(`Error processing report ${scheduledReport.id}:`, error);
        // Continue processing other reports even if one fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: scheduledReports?.length ?? 0,
        message: `Processed ${scheduledReports?.length ?? 0} scheduled reports`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in schedule-reports function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

async function processScheduledReport(supabase: any, scheduledReport: any) {
  console.log(`Processing report: ${scheduledReport.report_templates.name}`);

  // Generate report data based on template config
  const reportData = await generateReportData(supabase, scheduledReport.report_templates.template_config);
  
  // Send email with report
  await sendReportEmail(scheduledReport, reportData);
  
  // Update next run time
  const nextRun = calculateNextRun(scheduledReport.schedule_type);
  
  const { error: updateError } = await supabase
    .from('scheduled_reports')
    .update({
      last_run: new Date().toISOString(),
      next_run: nextRun.toISOString()
    })
    .eq('id', scheduledReport.id);

  if (updateError) {
    console.error('Error updating scheduled report:', updateError);
    throw updateError;
  }

  console.log(`Report ${scheduledReport.id} processed successfully. Next run: ${nextRun}`);
}

async function generateReportData(supabase: any, templateConfig: any) {
  try {
    const [leadsResult, visitasResult, vendasResult] = await Promise.all([
      supabase
      .from('leads')
      .select('id', { count: 'exact', head: true }),
      supabase
      .from('visitas')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null),
      supabase
      .from('vendas')
      .select('id, valor_imovel, status')
      .neq('status', 'cancelada'),
    ]);

    if (leadsResult.error) throw leadsResult.error;
    if (visitasResult.error) throw visitasResult.error;
    if (vendasResult.error) throw vendasResult.error;

    const vendas = vendasResult.data ?? [];
    const totalVendas = vendas.length;
    const valorVendido = vendas.reduce(
      (total: number, venda: { valor_imovel?: number | null }) =>
        total + Number(venda.valor_imovel ?? 0),
      0,
    );

    return {
      summary: {
        total_leads: leadsResult.count ?? 0,
        total_visitas: visitasResult.count ?? 0,
        total_vendas: totalVendas,
        valor_vendido: valorVendido,
        conversao_lead_venda:
          leadsResult.count ? (totalVendas / leadsResult.count) * 100 : 0,
        period: templateConfig.period || 'monthly',
        generated_at: new Date().toISOString()
      },
    };
  } catch (error) {
    console.error('Error generating report data:', error);
    return {
      summary: { error: 'Failed to generate report data' },
      detailed: {}
    };
  }
}

async function sendReportEmail(scheduledReport: any, reportData: any) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('RESEND_API_KEY não configurada');

  const recipients = Array.isArray(scheduledReport.recipients)
    ? scheduledReport.recipients.filter(
      (recipient: unknown): recipient is string =>
        typeof recipient === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient),
    )
    : [];
  if (recipients.length === 0) throw new Error('Relatório sem destinatários válidos');

  const escapeHtml = (value: unknown) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
  const currency = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(reportData.summary.valor_vendido ?? 0);

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: Deno.env.get('REPORT_FROM_EMAIL') || 'MeMude Connect <relatorios@memude.com>',
    to: recipients,
    subject: scheduledReport.email_subject,
    html: `
      <main style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#172033">
        <h1>${escapeHtml(scheduledReport.report_templates?.name || 'Relatório MeMude')}</h1>
        <p>${escapeHtml(scheduledReport.email_message || 'Segue o resumo programado.')}</p>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:8px;border-bottom:1px solid #ddd">Leads</td><td>${reportData.summary.total_leads}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #ddd">Visitas</td><td>${reportData.summary.total_visitas}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #ddd">Vendas</td><td>${reportData.summary.total_vendas}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #ddd">Valor vendido</td><td>${currency}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #ddd">Conversão lead → venda</td><td>${reportData.summary.conversao_lead_venda.toFixed(2)}%</td></tr>
        </table>
        <p style="color:#667085;font-size:12px">Gerado automaticamente em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.</p>
      </main>
    `,
  });
  if (error) throw new Error(`Falha ao enviar relatório: ${error.message}`);
  console.log('Scheduled report sent', { report_id: scheduledReport.id, recipient_count: recipients.length });
}

function calculateNextRun(scheduleType: string): Date {
  const now = new Date();
  const nextRun = new Date(now);

  switch (scheduleType) {
    case 'daily':
      nextRun.setDate(now.getDate() + 1);
      break;
    case 'weekly':
      nextRun.setDate(now.getDate() + 7);
      break;
    case 'monthly':
      nextRun.setMonth(now.getMonth() + 1);
      break;
    case 'quarterly':
      nextRun.setMonth(now.getMonth() + 3);
      break;
    default:
      nextRun.setDate(now.getDate() + 1); // Default to daily
  }

  // Set to same time next period
  nextRun.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
  
  return nextRun;
}
