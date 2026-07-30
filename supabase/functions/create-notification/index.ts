import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { authorize, readJson } from '../_shared/security.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || 'https://core.memudecore.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  user_id: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  related_lead_id?: string;
  related_visit_id?: string;
  related_corretor_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const access = await authorize(req, 'admin-or-internal');
    if (access instanceof Response) return access;

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: NotificationRequest = await readJson(req, 1024 * 1024);
    
    console.log('Creating notification', { type: body.type, target_user_id: body.user_id });

    const { data, error } = await supabaseClient
      .rpc('create_notification', {
        p_user_id: body.user_id,
        p_type: body.type,
        p_title: body.title,
        p_message: body.message,
        p_metadata: body.metadata || {},
        p_related_lead_id: body.related_lead_id || null,
        p_related_visit_id: body.related_visit_id || null,
        p_related_corretor_id: body.related_corretor_id || null,
      });

    if (error) {
      console.error('Error creating notification:', error);
      throw error;
    }

    console.log('Notification created successfully');

    return new Response(
      JSON.stringify({ success: true, notification_id: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in create-notification function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
