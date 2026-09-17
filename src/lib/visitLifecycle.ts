import { supabase } from '@/integrations/supabase/client';

export async function visitLifecycle<T = any>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('visit-lifecycle', { body: { action, ...params } });
  if (error) {
    let message = error.message;
    if (error.context instanceof Response) {
      try { message = (await error.context.clone().json()).error || message; } catch { /* Preserve transport error. */ }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export interface VisitCycle {
  match_status?: 'searching'|'accepted'|'exhausted'|'closed'; match_round?:number; broker_feedback_at?:string|null;
  visita_id: string; outcome: string; scheduled_at: string;
  recovery_open: boolean; attendance_overdue: boolean; confirmation_overdue: boolean;
  client_confirmed: boolean | null; broker_confirmed: boolean | null;
  reason: string | null; rating: number | null; feedback_at: string | null;
  feedback: { text?:string; interest: boolean; objections: string; next_step: string; return_at: string } | null;
  visita: { id: string; data_visita: string; horario_visita: string; corretor_id: string | null; lead: { nome: string }; broker: { profiles: { first_name: string; last_name: string } } | null };
}

export interface VisitDashboardData { cycles: VisitCycle[]; count: number; failures: number; enabled: boolean; intake_pending?: number; intake_failures?:number; intake_stalled?:number; health?:Array<{name:string;last_completed:string}>; failed_visits?:Array<{visita_id:string;destination:string;last_error:string;delivery_state:string}> }
