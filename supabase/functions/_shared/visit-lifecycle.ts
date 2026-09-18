import { visitPhone, parseVisitReply, visitPromptText, visitEventLabels } from './visit-workflow.ts';
import { syncVisitSheet } from './visit-sheets.ts';
import { validateExternalHttpUrl } from './security.ts';
import { deliveryUncertain } from './visit-message.ts';

export async function checked(query: any): Promise<any> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function visitConfig(db: any) {
  return checked(db.from('visit_automation_config').select('*').eq('id', true).single());
}

export async function visitSnapshot(db: any, id: string) {
  const [visit, cycle] = await Promise.all([
    checked(db.from('visitas').select('id,visit_code,lead_id,corretor_id,status,data_visita,horario_visita,deleted_at,feedback_corretor,meeting_address,meeting_neighborhood,customer_profile,lead:leads(nome,telefone,origem),broker:corretores(whatsapp,telefone,profiles(first_name,last_name)),property:empreendimentos(nome,endereco,bairro:bairros(nome))').eq('id', id).single()),
    checked(db.from('visit_cycles').select('*').eq('visita_id', id).single()),
  ]);
  return { visit, cycle };
}

export async function visitInstance(db: any, id: string) {
  if (!id) throw new Error('Selecione a instância WhatsApp nas configurações de visitas');
  const instance = await checked(db.from('evolution_instances').select('id,instance_name,api_url,api_token,is_active').eq('id', id).single());
  if (!instance.is_active) throw new Error('Instância WhatsApp inativa');
  validateExternalHttpUrl(instance.api_url);
  return instance;
}

async function evolution(instance: any, path: string, body?: unknown) {
  const response = await fetch(`${instance.api_url.replace(/\/$/, '')}${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { apikey: instance.api_token, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`WhatsApp recusou a operação (${response.status})`);
  return response.json();
}

export async function visitGroups(instance: any) {
  const response = await evolution(instance, `/group/fetchAllGroups/${encodeURIComponent(instance.instance_name)}?getParticipants=false`);
  const groups = Array.isArray(response) ? response : response.groups || [];
  return groups.filter((g: any) => typeof g.id === 'string' && g.id.endsWith('@g.us')).map((g: any) => ({ id: g.id, name: g.subject || g.id }));
}

export async function receiveVisitReply(db: any, phone: string, text: string, messageId: string, quoted?: string) {
  // WhatsApp JIDs already contain a country code, including international numbers.
  const recipientPhone = phone.replace(/\D/g, '');
  let parsed = parseVisitReply(text);
  if(!parsed && quoted && recipientPhone) {
    const delivery=await checked(db.from('visit_outbox').select('prompt_id').eq('provider_id',quoted).not('prompt_id','is',null).limit(1).maybeSingle());
    if(delivery) parsed={promptId:delivery.prompt_id,answer:text.trim().replace(/^não$/i,'nao')};
  }
  const explicitReference = Boolean(parsed);
  if (!parsed) {
    const candidates = await checked(db.from('visit_prompts').select('id,kind,audience,visita_id')
      .eq('phone', recipientPhone).is('answered_at', null).not('sent_at', 'is', null)
      .gt('expires_at', new Date().toISOString()).limit(2));
    if (candidates.length !== 1) return candidates.length > 0 && /^(sim|não|nao|[0-9]|10)$/i.test(text.trim());
    const candidate = candidates[0];
    const validAnswer = candidate.kind === 'rating' ? /^(10|[0-9])$/.test(text.trim())
      : candidate.kind === 'reason' ? false
      : false;
    if (!validAnswer) return false;
    // Bare replies are safe only when there is one question and no competing distribution.
    const visit = candidate.audience === 'broker' ? await checked(db.from('visitas').select('corretor_id').eq('id',candidate.visita_id).single()) : null;
    const broker = visit?.corretor_id ? { id: visit.corretor_id } : null;
    if (broker) {
      const [visits, leads] = await Promise.all([
        checked(db.from('visit_distribution_attempts').select('id').eq('corretor_id', broker.id).eq('status', 'pending').limit(1)),
        checked(db.from('distribution_attempts').select('id').eq('corretor_id', broker.id).eq('status', 'pending').limit(1)),
      ]);
      if (visits.length || leads.length) return true;
    }
    parsed = { promptId: candidate.id, answer: text.trim().replace(/^não$/i, 'nao') };
  }
  // Consume explicit workflow references even when expired, so they never reach AI/distribution.
  if (!messageId || text.length > 2500) return true;
  const cfg = await visitConfig(db);
  if (!cfg.enabled) return explicitReference;
  await checked(db.rpc('visit_lifecycle_reply', { p_prompt: parsed.promptId, p_phone: recipientPhone, p_answer: parsed.answer, p_message: messageId }));
  return true;
}

export async function runVisitLifecycle(db: any, channel = 'whatsapp') {
  const cfg = await visitConfig(db);
  if (!cfg.enabled) return { enabled: false, processed: 0 };
  await checked(db.from('visit_worker_health').upsert({name:channel,last_started:new Date().toISOString(),last_error:null}));
  if(channel==='whatsapp') await checked(db.rpc('visit_lifecycle_tick'));
  const items = await checked(db.rpc('visit_lifecycle_claim', { p_limit: 5,p_channel:channel }));
  let sent = 0;
  for (const item of items) {
    let transportStarted=false;
    let assignment=false;
    try {
      const currentConfig = await visitConfig(db);
      if (!currentConfig.enabled) {
        await checked(db.rpc('visit_lifecycle_finish', { p_id: item.id, p_lease: item.lease_token, p_status: 'failed', p_error: 'Automação pausada' }));
        continue;
      }
      const snapshot = await visitSnapshot(db, item.visita_id);
      const { visit: v, cycle: c } = snapshot;
      if (item.revision !== c.revision && !['closer','group','sheets'].includes(item.destination)) {
        await checked(db.rpc('visit_lifecycle_finish', { p_id: item.id, p_lease: item.lease_token, p_status: 'obsolete' }));
        continue;
      }
      let providerId: string | null = null;
      if (item.destination === 'sheets') {
        const prompts = await checked(db.from('visit_prompts').select('kind,audience,revision,sent_at').eq('visita_id', v.id));
        await syncVisitSheet(currentConfig.spreadsheet_id, snapshot, prompts);
      } else {
        let context = `📅 Visita ${v.visit_code}\nCliente: ${v.lead?.nome || 'Cliente'}\nImóvel: ${v.property?.nome || 'A definir'}\nData: ${v.data_visita.split('-').reverse().join('/')} às ${v.horario_visita}\nLocal: ${v.meeting_address || v.property?.endereco || 'A confirmar'}\nCorretor: ${v.broker?.profiles?.first_name || 'A designar'}`;
        let text: string;
        let buttons: any[] | undefined;
        let phone: string;
        if (item.prompt_id) {
          const p = await checked(db.from('visit_prompts').select('*').eq('id', item.prompt_id).single());
          assignment=p.kind==='assignment';
          if(assignment){
            const attempt=await checked(db.from('visit_match_attempts').select('status,broker:corretores(profiles(first_name,last_name))').eq('prompt_id',p.id).single());
            if(attempt.status!=='pending'){await checked(db.rpc('visit_lifecycle_finish',{p_id:item.id,p_lease:item.lease_token,p_status:'obsolete'}));continue;}
            context=context.replace(/Corretor:.*$/,`Corretor consultado: ${[attempt.broker?.profiles?.first_name,attempt.broker?.profiles?.last_name].filter(Boolean).join(' ')}`);
          }
          const invalidOutcome = p.kind==='assignment' ? c.outcome!=='pending'||c.match_status!=='searching' : p.kind==='feedback' ? c.outcome!=='held'||!!c.broker_feedback_at : ['eve','h2','attendance'].includes(p.kind) ? c.outcome !== 'pending' : p.kind === 'rating' ? c.outcome !== 'held' : !c.recovery_open;
          if (p.answered_at || new Date(p.expires_at).getTime() <= Date.now() || v.deleted_at || invalidOutcome || (p.audience === 'broker' && c.match_status !== 'accepted' && ['eve','h2','attendance'].includes(p.kind))) {
            await checked(db.rpc('visit_lifecycle_finish', { p_id: item.id, p_lease: item.lease_token, p_status: 'obsolete' }));
            continue;
          }
          ({ text, buttons } = visitPromptText(p.kind, p.audience, p.id, context));
          phone = p.phone;
        } else {
          const event = await checked(db.from('visit_events').select('kind,payload,created_at').eq('id', item.event_id).single());
          if (['client','broker'].includes(item.destination) && ['scheduled','changed','client_confirmed','broker_confirmed'].includes(event.kind) && c.outcome !== 'pending') {
            await checked(db.rpc('visit_lifecycle_finish', { p_id: item.id, p_lease: item.lease_token, p_status: 'obsolete' }));
            continue;
          }
          if(event.payload.broker_id){
            const named=await checked(db.from('corretores').select('profiles(first_name,last_name)').eq('id',event.payload.broker_id).single());
            context=context.replace(/Corretor:.*$/,`Corretor: ${[named.profiles?.first_name,named.profiles?.last_name].filter(Boolean).join(' ')}`);
          }
          if(['scheduled','changed'].includes(event.kind)&&c.match_status!=='accepted')context=context.replace(/Corretor:.*$/, 'Corretor: aguardando aceite');
          const label = event.kind === 'prompt_sent' ? `Pergunta/lembrete enviado: ${visitEventLabels[event.payload.kind] || event.payload.kind}` : visitEventLabels[event.kind] || event.kind;
          text = `${item.urgent ? '🚨' : '📋'} *${label}*\n${context}\nEvento: ${new Date(event.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
          if (['closer','group'].includes(item.destination)) text += `\nSituação atual: ${({ pending: 'agendada', held: 'realizada', not_held: 'não realizada', cancelled: 'cancelada', rescheduled: 'reagendada', withdrawn: 'desistência' } as Record<string,string>)[c.outcome]}`;
          if (event.payload.audience) text += `\nDestinatário: ${event.payload.audience === 'client' ? 'cliente' : 'corretor'}`;
          if (event.kind === 'reason') text += `\nMotivo: ${event.payload.reason}`;
          if(event.kind==='scheduled'&&item.destination==='client')text=`📅 Recebemos seu agendamento! Estamos consultando um corretor para atender você. Avisaremos assim que ele aceitar.\n${context}`;
          if(event.kind==='match_accepted')text+=`\nWhatsApp do corretor: ${v.broker?.whatsapp||v.broker?.telefone||'Consulte o Closer'}`;
          if(event.kind==='post_visit_summary')text+=`\nNota do cliente: ${event.payload.rating}/10\nFeedback: ${event.payload.feedback?.text||v.feedback_corretor||''}`;
          if(event.payload.attempt)text+=`\nTentativa: ${event.payload.attempt}`;
          if (event.kind === 'rating') text += `\nNota: ${event.payload.rating}/10`;
          if (event.kind === 'feedback') text += `\n${v.feedback_corretor || ''}`;
          text += '\nAcompanhe em https://core.memudecore.com.br/visitas';
          phone = item.destination === 'group' ? currentConfig.group_jid : item.destination === 'closer' ? currentConfig.closer_phone
            : visitPhone(item.destination === 'client' ? v.lead?.telefone || '' : v.broker?.whatsapp || v.broker?.telefone || '');
          if (!phone && ['client','broker'].includes(item.destination)) {
            throw new Error('Destino de WhatsApp ausente; corrija o cadastro');
          }
        }
        if (!phone) throw new Error('Destino de WhatsApp não configurado');
        const instance = await visitInstance(db, currentConfig.instance_id);
        // Text fallback is chosen explicitly on unsupported-button responses, never on ambiguous timeout.
        let response;
        transportStarted=true;
        if (buttons) {
          try { response = await evolution(instance, `/message/sendButtons/${encodeURIComponent(instance.instance_name)}`, { number: phone, title: 'Confirmação de visita', description: text, buttons }); }
          catch (error) {
            if (!/\((400|404|405|422|501)\)/.test((error as Error).message)) throw error;
            response = await evolution(instance, `/message/sendText/${encodeURIComponent(instance.instance_name)}`, { number: phone, text });
          }
        } else response = await evolution(instance, `/message/sendText/${encodeURIComponent(instance.instance_name)}`, { number: phone, text });
        providerId = response?.key?.id || response?.id || null;
        if(!providerId)throw new Error("WhatsApp retornou sem identificador de entrega");
      }
      await checked(db.rpc('visit_lifecycle_finish', { p_id: item.id, p_lease: item.lease_token, p_status: 'sent', p_provider: providerId }));
      await checked(db.from('visit_outbox').update({delivery_state:'accepted'}).eq('id',item.id).eq('delivery_state','queued'));
      sent++;
    } catch (error) {
      if(transportStarted && deliveryUncertain(error)) await checked(db.from('visit_outbox').update({status:'failed',delivery_state:'unknown',leased_until:null,last_error:'Entrega incerta: confira o WhatsApp antes de reenviar. '+(error as Error).message}).eq('id',item.id).eq('lease_token',item.lease_token).in('delivery_state',['queued','accepted','unknown']));
      else if(assignment&&transportStarted)await checked(db.from('visit_outbox').update({status:'failed',delivery_state:'failed',leased_until:null,last_error:(error as Error).message}).eq('id',item.id).eq('lease_token',item.lease_token).in('delivery_state',['queued','accepted']));
      else await checked(db.rpc('visit_lifecycle_finish', { p_id: item.id, p_lease: item.lease_token, p_status: 'failed', p_error: (error as Error).message }));
    }
  }
  await checked(db.from('visit_worker_health').upsert({name:channel,last_completed:new Date().toISOString()}));
  return { enabled: true, processed: items.length, sent };
}
