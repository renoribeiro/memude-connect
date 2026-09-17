import { checked, visitConfig, visitInstance } from './visit-lifecycle.ts';
import { intakeCommand, parseIntake, normalizeFields, validateFields, intakePhone, norm, similarity, candidateSimilarity, legacyPhoneCandidate, type IntakeFields } from './visit-intake-parser.ts';
import { extractIntakeAI, rankIntakeAI } from './visit-intake-ai.ts';
import { visitMessage, deliveryUncertain } from './visit-message.ts';

export async function receiveVisitIntake(db:any,event:any,text:string) {
  const normalized=visitMessage(event.data?.message||event.data);
  text=normalized.text||text;
  const key=event.data?.key || event.data?.message?.key || {};
  const remote=key.remoteJid||'';
  const isGroup=remote.endsWith('@g.us');
  if(!isGroup&&!intakeCommand(text)&&!normalized.quoted)return false;
  const cfg=await visitConfig(db);
  let privatePhone='';
  if(!isGroup){
    if(key.fromMe)return false;
    const jid=[key.remoteJidAlt,remote].find(v=>typeof v==='string'&&/^\d+@s\.whatsapp\.net$/.test(v));
    privatePhone=jid?.split('@')[0]||'';
    if(!privatePhone&&remote.endsWith('@lid'))privatePhone=(await checked(db.from('lid_phone_map').select('phone').eq('lid',remote.split('@')[0]).maybeSingle()))?.phone||'';
    privatePhone=privatePhone.replace(/\D/g,'');
    if(!privatePhone||privatePhone!==cfg.closer_phone)return false;
  }
  const group=isGroup?remote:cfg.group_jid;
  if(group!==cfg.group_jid)return false;
  // Traffic in the configured company group never falls through to the private sales AI.
  if(key.fromMe)return true;
  let command=intakeCommand(text);
  if(!command){
    const quoted=normalized.quoted;
    if(quoted){
      const reply=await checked(db.from('visit_intake_outbox').select('revision,intake:visit_intake!visit_intake_outbox_intake_id_fkey(protocol,group_jid,instance_id,choices)').eq('provider_id',quoted).eq('destination',isGroup?'group':'closer').limit(1).maybeSingle());
      if(reply?.intake?.group_jid===group&&reply.intake.instance_id===cfg.instance_id){
        command={action:norm(text)==='liberar'?'approve':norm(text)==='cancelar'?'cancel':'correct',protocol:reply.intake.protocol,revision:reply.revision};
        const c=reply.intake.choices;
        if(/^[1-3]$/.test(text.trim())&&Boolean(c?.broker?.length)!==Boolean(c?.property?.length))text=`${c?.broker?.length?'Corretor':'Empreendimento'}: opção ${text.trim()}`;
      }
    }
  }
  if(!command)return isGroup;
  if(!isGroup&&command.action==='create')return false;
  if(!cfg.intake_enabled||!cfg.enabled)return true;
  const instance=await checked(db.from('evolution_instances').select('id,instance_name').eq('id',cfg.instance_id).single());
  if(event.instance!==instance.instance_name||!key.id)return true;
  const author=isGroup?(key.participant||key.participantAlt||''):remote;
  if(!author||(!author.endsWith('@lid')&&!author.endsWith('@s.whatsapp.net')))return true;
  const phoneJid=[key.participantAlt,key.participant].find(v=>typeof v==='string'&&/^\d+@s\.whatsapp\.net$/.test(v));
  let phone=privatePhone||phoneJid?.split('@')[0]||'';
  if(!phone&&author.endsWith('@lid'))phone=(await checked(db.from('lid_phone_map').select('phone').eq('lid',author.split('@')[0]).maybeSingle()))?.phone||'';
  const requestId=await checked(db.rpc('visit_intake_receive',{p_message:`evolution:${event.instance}:${group}:${key.id}`,p_group:group,p_instance:instance.id,p_author:author,p_phone:phone.replace(/\D/g,''),p_text:text,...{p_protocol:command.protocol,p_revision:command.revision,p_action:command.action}}));
  if(!requestId) {
    const transport=await visitInstance(db,instance.id);
    await fetch(`${transport.api_url.replace(/\/$/,'')}/message/sendText/${encodeURIComponent(transport.instance_name)}`,{method:'POST',headers:{apikey:transport.api_token,'Content-Type':'application/json'},body:JSON.stringify({number:isGroup?group:phone,text:'Não foi possível aplicar esse comando. Confira a versão mais recente do pedido e responda citando a mensagem do sistema. Somente o autor ou Closer pode resolver. Para visita já cadastrada, use o acompanhamento no sistema.'}),signal:AbortSignal.timeout(12000)});
  }
  return true;
}

async function catalog(db:any,table:string,select:string,filters:(q:any)=>any) {
  const rows:any[]=[];
  for(let offset=0;offset<10000;offset+=500){const part=await checked(filters(db.from(table).select(select)).order('id').range(offset,offset+499));rows.push(...part);if(part.length<500)return rows;}
  throw new Error('Catálogo muito grande; revisão da busca paginada necessária');
}
async function resolveCandidate(db:any,kind:string,value:string|undefined,phone:string|undefined,rows:any[],oldChoices:any[],questions:string[],context='',traceId?:string) {
  const label=kind==='broker'?'Corretor':'Empreendimento';
  const choice=value?.match(/^op[cç][aã]o\s+(\d+)$/i);
  if(choice){const selected=oldChoices?.[Number(choice[1])-1];const row=rows.find(r=>r.id===selected?.id);if(row)return {row,choices:[]};questions.push(`${label}: a opção não está mais disponível.`);return {choices:[]};}
  const exact=rows.filter(r=>norm(r.name)===norm(value||''));
  const byPhone=phone?rows.filter(r=>r.phone===phone||r.alternatePhone===phone):[];
  if(kind==='broker'&&phone){
    if(byPhone.length===1&&(!value||norm(byPhone[0].name)===norm(value)||norm(byPhone[0].name).split(' ').includes(norm(value))))return {row:byPhone[0],choices:[]};
    if(byPhone.length!==1||value&&byPhone.length===1)questions.push('Corretor e telefone: não há correspondência única e consistente. Selecione uma opção abaixo ou corrija os campos.');
  }else if(exact.length===1)return {row:exact[0],choices:[]};
  const nearPhone=phone?rows.filter(r=>legacyPhoneCandidate(r.phone||'',phone)||legacyPhoneCandidate(r.alternatePhone||'',phone)):[];
  let candidates=[...new Map([...byPhone,...nearPhone,...exact,...rows.filter(r=>candidateSimilarity(r.name,value||'')>=0.35).sort((a,b)=>(candidateSimilarity(b.name,value||'')+(norm(context).includes(norm(b.neighborhood||''))&&b.neighborhood?0.2:0))-(candidateSimilarity(a.name,value||'')+(norm(context).includes(norm(a.neighborhood||''))&&a.neighborhood?0.2:0)))].map(r=>[r.id,r])).values()].slice(0,10);
  try {candidates=await rankIntakeAI(db,label,`${value||''}\nContexto: ${context}`,candidates,traceId);}catch{/* Deterministic candidates still allow human resolution when AI is unavailable. */}
  candidates=candidates.slice(0,3);
  questions.push(candidates.length?`${label}: escolha uma opção.\n${candidates.map((r,i)=>`${i+1}. ${r.name}${r.neighborhood?' — '+r.neighborhood:''}${r.phone?' — final '+r.phone.slice(-4):''}`).join('\n')}\nResponda ${label}: opção 1 (ou 2/3).`:`${label}: informe o nome de um cadastro ativo; não encontrei correspondência segura.`);
  return {choices:candidates.map(c=>({id:c.id,name:c.name}))};
}

export async function inspectVisitIntake(db:any,draft:any) {
  const parsed=parseIntake(draft.input_text);
  let extracted:IntakeFields={};
  // Parsing by rules is authoritative, including explicitly blank/ambiguous fields.
  if(draft.input_text.trim()&&(!Object.keys(parsed).length||draft.revision===1&&(!parsed.client_name||!parsed.property_name||!parsed.broker_name)))extracted=await extractIntakeAI(db,draft.input_text,draft.id);
  const fields=normalizeFields({...draft.fields,...extracted,...parsed});
  const questions=validateFields(fields);
  const [brokers,properties]=await Promise.all([
    catalog(db,'corretores','id,whatsapp,telefone,profiles(first_name,last_name)',q=>q.eq('status','ativo').is('deleted_at',null)),
    catalog(db,'empreendimentos','id,nome,endereco,bairro:bairros(nome),wp_post_id',q=>q.eq('ativo',true)),
  ]);
  const brokerRows=brokers.map(r=>({id:r.id,name:[r.profiles?.first_name,r.profiles?.last_name].filter(Boolean).join(' '),phone:intakePhone(r.whatsapp||''),alternatePhone:intakePhone(r.telefone||'')}));
  const propertyRows=properties.map(r=>({id:r.id,name:r.nome,neighborhood:r.bairro?.nome}));
  const broker:any=(fields.broker_name||fields.broker_phone)?await resolveCandidate(db,'broker',fields.broker_name,fields.broker_phone,brokerRows,draft.choices?.broker,questions,'',draft.id):{choices:[]};
  const property=await resolveCandidate(db,'property',fields.property_name,undefined,propertyRows,draft.choices?.property,questions,`${fields.neighborhood||''} ${fields.address||''} ${fields.url||''}`,draft.id);
  if(broker.row){fields.broker_name=broker.row.name;fields.broker_phone=broker.row.phone||broker.row.alternatePhone;}
  if(broker.row&&!/^[1-9]\d{9,14}$/.test(fields.broker_phone||''))questions.push('Corretor: o cadastro precisa de um telefone válido para receber os avisos. Solicite correção ao administrador.');
  if(property.row)fields.property_name=property.row.name;
  if(fields.url){
    try {const url=new URL(fields.url);if(url.protocol!=='https:'||!['www.memude.com.br','memude.com.br'].includes(url.hostname))questions.push('Link do empreendimento: use o site MeMude ou deixe esse campo vazio.');
      else if(property.row&&similarity(decodeURIComponent(url.pathname.split('/').filter(Boolean).pop()||''),property.row.name)<0.65)questions.push('Link e empreendimento parecem diferentes. Confirme o nome e corrija o link, ou deixe Link: vazio.');
    }catch{questions.push('Link do empreendimento: informe uma URL válida ou deixe vazio.');}
  }
  if(fields.client_phone&&questions.every(q=>!q.startsWith('Telefone do cliente'))){
    const leads=await checked(db.rpc('visit_intake_find_leads',{p_phone:fields.client_phone}));
    if(leads.length===1){if(norm(leads[0].nome)!==norm(fields.client_name||'')&&!norm(leads[0].nome).startsWith(norm(fields.client_name||'')+' '))questions.push(`Cliente: esse telefone já pertence a ${leads[0].nome}. Confirme usando o nome cadastrado ou corrija o telefone.`);else fields.client_name=leads[0].nome;}
  }
  return {fields,choices:{broker:broker.choices,property:property.choices},questions:questions.join('\n\n'),broker_id:broker.row?.id||null,property_id:property.row?.id||null};
}
async function processDraft(db:any,draft:any) {
  const result=await inspectVisitIntake(db,draft);
  await checked(db.rpc('visit_intake_finish',{p_id:draft.id,p_lease:draft.lease_token,p_fields:result.fields,p_choices:result.choices,p_questions:result.questions,p_broker:result.broker_id,p_property:result.property_id}));
}

export async function runVisitIntake(db:any) {
  const config=await visitConfig(db);if(!config.enabled||!config.intake_enabled)return {intake_enabled:false};
  await checked(db.from('visit_worker_health').upsert({name:'intake',last_started:new Date().toISOString(),last_error:null}));
  const earlyNotifications=await deliverIntakeNotifications(db);
  let processed=0;
  const started=Date.now();
  for(let i=0;i<5&&Date.now()-started<45000;i++){
    const drafts=await checked(db.rpc('visit_intake_claim'));if(!drafts.length)break;
    for(const draft of drafts){try{await processDraft(db,draft);}catch(error){await checked(db.rpc('visit_intake_fail',{p_id:draft.id,p_lease:draft.lease_token,p_error:(error as Error).message}));}processed++;}
  }
  const notifications=earlyNotifications+await deliverIntakeNotifications(db);
  await checked(db.from('visit_worker_health').upsert({name:'intake',last_completed:new Date().toISOString()}));
  return {intake_enabled:true,processed,notifications};
}

async function deliverIntakeNotifications(db:any) {
  const deliveries=await checked(db.rpc('visit_intake_delivery_claim'));
  for(const delivery of deliveries){
    let transportStarted=false;
    try{
      const current=await visitConfig(db);if(!current.enabled||!current.intake_enabled)throw new Error('Agendamento pelo grupo pausado');
      const draft=await checked(db.from('visit_intake').select('revision,group_jid,instance_id').eq('id',delivery.intake_id).single());
      if(draft.revision!==delivery.revision){await checked(db.from('visit_intake_outbox').update({status:'obsolete',leased_until:null}).eq('id',delivery.id).eq('lease_token',delivery.lease_token));continue;}
      const instance=await visitInstance(db,draft.instance_id);
      const number=delivery.destination==='group'?draft.group_jid:current.closer_phone;
      if(!number)throw new Error('Destino de aviso não configurado');
      transportStarted=true;
      const response=await fetch(`${instance.api_url.replace(/\/$/,'')}/message/sendText/${encodeURIComponent(instance.instance_name)}`,{method:'POST',headers:{apikey:instance.api_token,'Content-Type':'application/json'},body:JSON.stringify({number,text:delivery.body}),signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error(`WhatsApp recusou aviso (${response.status})`);
      const result=await response.json();
      if(!result.key?.id)throw new Error("WhatsApp retornou sem identificador de entrega");
      await checked(db.rpc('visit_intake_delivery_finish',{p_id:delivery.id,p_lease:delivery.lease_token,p_provider:result.key?.id||null}));
      await checked(db.from('visit_intake_outbox').update({delivery_state:'accepted'}).eq('id',delivery.id).eq('delivery_state','queued'));
    }catch(error){
      if(transportStarted&&deliveryUncertain(error))await checked(db.from('visit_intake_outbox').update({status:'failed',delivery_state:'unknown',leased_until:null,last_error:'Entrega incerta; confira o WhatsApp antes de reenviar. '+(error as Error).message}).eq('id',delivery.id).eq('lease_token',delivery.lease_token).in('delivery_state',['queued','accepted','unknown']));
      else await checked(db.rpc('visit_intake_delivery_finish',{p_id:delivery.id,p_lease:delivery.lease_token,p_error:(error as Error).message}));
    }
  }
  return deliveries.length;
}
