import { authorize, handleOptions, jsonResponse } from '../_shared/security.ts';
import { runVisitLifecycle } from '../_shared/visit-lifecycle.ts';
Deno.serve(async req=>{
  const options=handleOptions(req);if(options)return options;
  const access=await authorize(req,'internal');if(access instanceof Response)return access;
  try{return jsonResponse(req,await runVisitLifecycle(access.supabase));}
  catch(error){console.error('Visit match worker:',(error as Error).message);return jsonResponse(req,{error:'Falha no Match de visitas'},500);}
});
