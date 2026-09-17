import { authorize, handleOptions, jsonResponse, readJson } from '../_shared/security.ts';
import { checked, visitConfig, visitGroups, visitInstance } from '../_shared/visit-lifecycle.ts';
import { inspectVisitSheet, sheetsConfigured } from '../_shared/visit-sheets.ts';
import { visitPhone } from '../_shared/visit-workflow.ts';
import { visitDashboard } from '../_shared/visit-dashboard.ts';

Deno.serve(async req => {
  const options = handleOptions(req); if (options) return options;
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Método não permitido' }, 405);
  const access = await authorize(req, 'admin'); if (access instanceof Response) return access;
  const db = access.supabase;
  try {
    const body = await readJson<any>(req, 16384);
    const config = await visitConfig(db);
    switch (body.action) {
      case 'settings': {
        const instances = await checked(db.from('evolution_instances').select('id,instance_name,is_active').eq('is_active', true));
        return jsonResponse(req, { config, instances, sheets_configured: sheetsConfigured() });
      }
      case 'groups': return jsonResponse(req, { groups: await visitGroups(await visitInstance(db, body.instance_id)) });
      case 'save_settings': {
        const input = body.config || {};
        const closerPhone = visitPhone(input.closer_phone || '');
        const enabled = input.enabled === true;
        if (closerPhone && !/^\d{12,15}$/.test(closerPhone)) throw new Error('WhatsApp do Closer inválido');
        if (input.group_jid && !/^[0-9-]+@g\.us$/.test(input.group_jid)) throw new Error('Selecione um grupo válido');
        if (enabled) {
          if (!closerPhone || !input.group_jid || !input.instance_id) throw new Error('Configure Closer, instância e grupo');
          const groups = await visitGroups(await visitInstance(db, input.instance_id));
          if (!groups.some((g: any) => g.id === input.group_jid)) throw new Error('Grupo indisponível nesta instância');
          if (!sheetsConfigured()) throw new Error('Configure a credencial Google no servidor antes de ativar');
          await inspectVisitSheet(config.spreadsheet_id);
        }
        await checked(db.from('visit_automation_config').update({ enabled, intake_enabled: input.intake_enabled === true, closer_phone: closerPhone, group_jid: input.group_jid || '', instance_id: input.instance_id || null, updated_at: new Date().toISOString() }).eq('id', true));
        return jsonResponse(req, { success: true });
      }
      case 'intake_list': {
        const offset=Math.max(0,Math.floor(Number(body.offset)||0));
        const {data,error,count}=await db.from('visit_intake').select('id,protocol,revision,status,fields,choices,resolution_note,last_error,conflict_ids,visita_id,input_text,created_at,updated_at',{count:'exact'}).order('created_at',{ascending:false}).range(offset,offset+19);
        if(error)throw error;
        const failures=await checked(db.from('visit_intake_outbox').select('id,intake_id,last_error').eq('status','failed').limit(100));
        return jsonResponse(req,{requests:data,count,failures,enabled:config.intake_enabled});
      }
      case 'intake_resolve': {
        if(!['correct','approve','cancel'].includes(body.resolution))throw new Error('Ação inválida');
        const draft=await checked(db.from('visit_intake').select('*').eq('id',body.id).single());
        if(body.revision!==draft.revision)throw new Error('A solicitação mudou; atualize a página');
        const id=await checked(db.rpc('visit_intake_receive',{p_message:`admin:${crypto.randomUUID()}`,p_group:draft.group_jid,p_instance:draft.instance_id,p_author:`admin:${access.userId}`,p_phone:'',p_text:String(body.text||body.resolution),p_protocol:draft.protocol,p_revision:body.revision,p_action:body.resolution,p_admin:access.userId}));
        if(!id)throw new Error('Solicitação encerrada, pausada ou não permite essa ação');
        return jsonResponse(req,{success:true});
      }
      case 'intake_retry_delivery': {
        await checked(db.from('visit_intake_outbox').update({status:'pending',delivery_state:'queued',provider_id:null,attempts:0,available_at:new Date().toISOString(),last_error:null}).eq('intake_id',body.id).eq('status','failed'));
        return jsonResponse(req,{success:true});
      }
      case 'dashboard': {
        const offset = Math.max(0, Number(body.offset) || 0);
        return jsonResponse(req, { ...await visitDashboard(db, body.pending_only !== false, offset), enabled: config.enabled });
      }
      case 'cycle': return jsonResponse(req,{cycle:await checked(db.from('visit_cycles').select('*,visita:visitas!visit_cycles_visita_id_fkey(id,data_visita,horario_visita,corretor_id,lead:leads(nome),broker:corretores(profiles(first_name,last_name)))').eq('visita_id',body.visita_id).maybeSingle())});
      case 'history': {
        const [events, deliveries] = await Promise.all([
          checked(db.from('visit_events').select('id,kind,payload,created_at').eq('visita_id', body.visita_id).order('created_at', { ascending: false }).limit(100)),
          checked(db.from('visit_outbox').select('id,destination,status,delivery_state,attempts,last_error,sent_at').eq('visita_id', body.visita_id).order('created_at', { ascending: false }).limit(100)),
        ]);
        return jsonResponse(req, { events, deliveries });
      }
      case 'retry': {
        await checked(db.from('visit_outbox').update({ status: 'pending',delivery_state:'queued',provider_id:null, attempts: 0, available_at: new Date().toISOString(), last_error: null }).eq('status', 'failed').eq('visita_id', body.visita_id));
        return jsonResponse(req, { success: true });
      }
      case 'brokers': return jsonResponse(req, { brokers: await checked(db.from('corretores').select('id,profiles(first_name,last_name)').eq('status', 'ativo').is('deleted_at', null)) });
      case 'attendance': case 'feedback': case 'withdraw': case 'reschedule': case 'replace_broker': {
        const id = await checked(db.rpc('visit_lifecycle_action', { p_visit: body.visita_id, p_action: body.action, p_data: body.data || {}, p_actor: access.userId }));
        return jsonResponse(req, { success: true, visita_id: id });
      }
      default: return jsonResponse(req, { error: 'Ação inválida' }, 400);
    }
  } catch (error) { return jsonResponse(req, { error: (error as Error).message }, 400); }
});
