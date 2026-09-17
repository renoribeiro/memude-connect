import { authorize, handleOptions, jsonResponse } from '../_shared/security.ts';
import { runVisitLifecycle, visitGroups, visitInstance, checked } from '../_shared/visit-lifecycle.ts';
import { inspectVisitSheet, sheetsConfigured, verifyVisitSheetWrite } from '../_shared/visit-sheets.ts';
import { visitDashboard, visitMatchDashboard } from '../_shared/visit-dashboard.ts';

Deno.serve(async req => {
  const options = handleOptions(req); if (options) return options;
  const access = await authorize(req, 'internal'); if (access instanceof Response) return access;
  try {
    if(new URL(req.url).searchParams.get('check')==='match'){const result=await visitMatchDashboard(access.supabase);return jsonResponse(req,{match_dashboard_ok:true,count:result.count});}
    if (new URL(req.url).searchParams.get('check') === 'dashboard') {
      const pending = await visitDashboard(access.supabase);
      const all = await visitDashboard(access.supabase, false);
      return jsonResponse(req, { dashboard_ok: true, pending: pending.count, total: all.count, failures: all.failures });
    }
    if (new URL(req.url).searchParams.get('check') === 'sheet') {
      const { data, error } = await access.supabase.from('visit_automation_config').select('spreadsheet_id').eq('id', true).single();
      if (error) throw error;
      const headers = await inspectVisitSheet(data.spreadsheet_id);
      const verifyWrite = new URL(req.url).searchParams.get('write') === '1';
      if (verifyWrite) await verifyVisitSheetWrite(data.spreadsheet_id);
      return jsonResponse(req, { sheets_configured: sheetsConfigured(), readable: true, write_verified: verifyWrite, tab: 'VISITAS', columns: headers.length });
    }
    if (new URL(req.url).searchParams.get('check') === 'groups') {
      const instances = await checked(access.supabase.from('evolution_instances').select('id,instance_name').eq('is_active', true));
      const results = [];
      for (const instance of instances) {
        try { results.push({ ...instance, groups: await visitGroups(await visitInstance(access.supabase, instance.id)) }); }
        catch { results.push({ ...instance, error: 'Não foi possível consultar os grupos' }); }
      }
      return jsonResponse(req, { instances: results });
    }
    return jsonResponse(req, await runVisitLifecycle(access.supabase));
  }
  catch (error) { console.error('Visit worker failed:', (error as Error).message); return jsonResponse(req, { error: 'Falha no processamento de visitas' }, 500); }
});
