import { authorize, handleOptions, jsonResponse, readJson } from '../_shared/security.ts';
import { checked, runVisitLifecycle } from '../_shared/visit-lifecycle.ts';
Deno.serve(async req => {
  const options=handleOptions(req);if(options)return options;
  const access=await authorize(req,'admin');if(access instanceof Response)return access;
  try {
    const body=await readJson<any>(req,2048);
    const cycle=await checked(access.supabase.from('visit_cycles').select('visita_id,match_status').eq('visita_id',body.visita_id).single());
    await runVisitLifecycle(access.supabase);
    return jsonResponse(req,{success:true,visita_id:cycle.visita_id,message:'Consulta persistida no fluxo de visitas'});
  } catch(error){return jsonResponse(req,{error:(error as Error).message},400);}
});
