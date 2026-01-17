import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

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

    console.log(`Found ${scheduledReports.length} reports to process`);

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
        processed: scheduledReports.length,
        message: `Processed ${scheduledReports.length} scheduled reports`
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
  // This is a simplified version - in production you'd generate actual report data
  // based on the template configuration
  
  try {
    // Fetch basic metrics that are commonly needed
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    const { data: visitas } = await supabase
      .from('visitas')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    return {
      summary: {
        total_leads: leads?.length || 0,
        total_visitas: visitas?.length || 0,
        period: templateConfig.period || 'monthly',
        generated_at: new Date().toISOString()
      },
      detailed: {
        leads: leads || [],
        visitas: visitas || []
      }
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
  console.log(`Sending email to: ${scheduledReport.recipients.join(', ')}`);
  
  // In a real implementation, you would integrate with an email service like Resend
  // For now, we'll just log the email details
  console.log('Email would contain:', {
    subject: scheduledReport.email_subject,
    message: scheduledReport.email_message,
    recipients: scheduledReport.recipients,
    reportSummary: reportData.summary
  });
  
  // TODO: Integrate with actual email service
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