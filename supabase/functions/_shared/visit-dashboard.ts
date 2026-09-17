// Explicit FK distinguishes this visit from the previous visit in a reschedule.
export async function visitDashboard(db: any, pendingOnly = true, offset = 0) {
  let query = db.from('visit_cycles').select('*,visita:visitas!visit_cycles_visita_id_fkey(id,data_visita,horario_visita,corretor_id,lead:leads(nome),broker:corretores(profiles(first_name,last_name)))', { count: 'exact' });
  if (pendingOnly) query = query.or('recovery_open.eq.true,attendance_overdue.eq.true,confirmation_overdue.eq.true,and(outcome.eq.held,or(broker_feedback_at.is.null,rating.is.null))');
  const { data, error, count } = await query.order('scheduled_at').range(offset, offset + 19);
  if (error) throw error;
  const { count: failures, error: failureError } = await db.from('visit_outbox').select('id', { head: true, count: 'exact' }).eq('status', 'failed');
  if (failureError) throw failureError;
  const {count: intake_pending,error: intakeError}=await db.from('visit_intake').select('id',{head:true,count:'exact'}).in('status',['needs_input','needs_closer','failed']);
  if(intakeError)throw intakeError;
  const {count:intake_failures,error:intakeFailureError}=await db.from('visit_intake_outbox').select('id',{head:true,count:'exact'}).eq('status','failed');
  const staleBefore=new Date(Date.now()-5*60000).toISOString();
  const {count:intake_stalled,error:stalledError}=await db.from('visit_intake').select('id',{head:true,count:'exact'}).in('status',['queued','processing']).lt('updated_at',staleBefore);
  const {data:health,error:healthError}=await db.from('visit_worker_health').select('*');
  const {data:failed_visits,error:failedVisitsError}=await db.from('visit_outbox').select('visita_id,last_error,destination,delivery_state').eq('status','failed').limit(50);
  for (const error of [intakeFailureError,stalledError,healthError,failedVisitsError]) if(error) throw error;
  return { cycles: data, count, failures, intake_pending, intake_failures:intake_failures||0,intake_stalled:intake_stalled||0,health:health||[],failed_visits:failed_visits||[] };
}

export async function visitMatchDashboard(db:any,offset=0){
 const {data,error,count}=await db.from('visit_match_attempts').select('id,round,status,created_at,ranking,broker:corretores!visit_match_attempts_corretor_id_fkey(profiles(first_name,last_name)),cycle:visit_cycles!visit_match_attempts_visita_id_fkey(visit:visitas!visit_cycles_visita_id_fkey(lead:leads(nome))),prompt:visit_prompts!visit_match_attempts_prompt_id_fkey(sent_at,expires_at)',{count:'exact'}).order('created_at',{ascending:false}).range(offset,offset+19);
 if(error)throw error;return {attempts:data.map((a:any)=>({...a,visit:a.cycle?.visit})),count};
}
