import { authorize,handleOptions,jsonResponse,readJson } from '../_shared/security.ts';
import { runVisitIntake,inspectVisitIntake } from '../_shared/visit-intake.ts';
import { extractIntakeAI } from '../_shared/visit-intake-ai.ts';
Deno.serve(async req=>{
 const options=handleOptions(req);if(options)return options;
 const access=await authorize(req,'internal');if(access instanceof Response)return access;
 try{
   if(new URL(req.url).searchParams.get('check')==='ai'){
     const fields=await extractIntakeAI(access.supabase,'AGENDAR VISITA\nCliente: Teste Sintético\nEmpreendimento: Imóvel de teste');
     return jsonResponse(req,{ai_ok:fields.client_name==='Teste Sintético'&&fields.property_name==='Imóvel de teste'});
   }
   if(new URL(req.url).searchParams.get('check')==='preview'){
     const body=await readJson<{text:string}>(req,10000);
     if(typeof body.text!=='string'||body.text.length>8000)return jsonResponse(req,{error:'Texto inválido'},400);
     return jsonResponse(req,await inspectVisitIntake(access.supabase,{input_text:body.text,revision:1,fields:{},choices:{}}));
   }
   return jsonResponse(req,await runVisitIntake(access.supabase));
 }
 catch(error){console.error('Visit intake worker failed:',(error as Error).message);return jsonResponse(req,{error:'Falha no processamento dos agendamentos pelo grupo'},500);}
});
