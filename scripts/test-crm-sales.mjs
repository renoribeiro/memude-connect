import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT $1='00000000-0000-4000-8000-000000000001'::uuid AND $2='admin' $$;
CREATE TABLE user_roles(user_id uuid,role text);
INSERT INTO user_roles VALUES ('00000000-0000-4000-8000-000000000001','admin');
CREATE TABLE profiles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid);
CREATE TABLE empreendimentos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ativo boolean DEFAULT true);
CREATE TABLE corretores(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),status text DEFAULT 'ativo',deleted_at timestamptz);
CREATE TABLE leads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),corretor_designado_id uuid REFERENCES corretores);
CREATE TYPE venda_status AS ENUM ('pendente','paga','cancelada');
CREATE TABLE vendas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lead_id uuid NOT NULL REFERENCES leads,
  empreendimento_id uuid NOT NULL REFERENCES empreendimentos,corretor_id uuid REFERENCES corretores,
  valor_imovel numeric NOT NULL,comissao_percentual numeric NOT NULL,imposto_percentual numeric NOT NULL,
  is_venda_direta boolean NOT NULL,status venda_status NOT NULL,data_venda date NOT NULL,data_pagamento date,
  observacoes text,created_by uuid REFERENCES profiles,comprovantes text[]);
CREATE TABLE crm_pipelines(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),nome text NOT NULL,descricao text,auto_add_visits boolean);
CREATE TABLE crm_stages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),pipeline_id uuid NOT NULL REFERENCES crm_pipelines ON DELETE CASCADE,
  nome text NOT NULL,cor text,posicao integer NOT NULL,is_final boolean DEFAULT false);
CREATE TABLE crm_leads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lead_id uuid NOT NULL REFERENCES leads,
  pipeline_id uuid NOT NULL REFERENCES crm_pipelines,stage_id uuid REFERENCES crm_stages ON DELETE SET NULL,
  valor_estimado numeric,empreendimento_id uuid REFERENCES empreendimentos,posicao integer DEFAULT 0,
  moved_at timestamptz DEFAULT now(),created_at timestamptz DEFAULT now());
GRANT USAGE ON SCHEMA public,auth,private TO authenticated,anon,service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated,service_role;
`);
const migration = await readFile(new URL('../supabase/migrations/20260922224552_crm_sales_completion.sql', import.meta.url),'utf8');
await db.exec(migration.split('-- cron installation')[0]);
await db.exec(await readFile(new URL('../supabase/migrations/20260922225959_crm_sales_role_check.sql',import.meta.url),'utf8'));
await db.exec('REVOKE USAGE ON SCHEMA private FROM authenticated');
const one = async (sql,args=[]) => (await db.query(sql,args)).rows[0];
const exec = async (sql,args=[]) => db.query(sql,args);
let count=0;
const pass = message => { count++; console.log('PASS '+message); };
const id = async table => (await one(`INSERT INTO ${table} DEFAULT VALUES RETURNING id`)).id;
const lead = await id('leads'), property = await id('empreendimentos'), broker = await id('corretores');
await exec("INSERT INTO profiles(user_id) VALUES('00000000-0000-4000-8000-000000000001')");
const pipeline = (await one("INSERT INTO crm_pipelines(nome) VALUES('Funil') RETURNING id")).id;
const open = (await one("INSERT INTO crm_stages(pipeline_id,nome,posicao) VALUES($1,'Aberto',0) RETURNING id",[pipeline])).id;
const won = (await one("INSERT INTO crm_stages(pipeline_id,nome,posicao) VALUES($1,'Ganho',1) RETURNING id",[pipeline])).id;
const stages = [{id:open,nome:'Aberto',cor:'#ffffff',posicao:0},{id:won,nome:'Ganho',cor:'#ffffff',posicao:1}];
const settings = (items=stages,destination=won) => exec("SELECT save_crm_pipeline_settings($1,'Funil','',false,$2,$3)",[pipeline,JSON.stringify(items),destination]);
const card = async () => (await one('INSERT INTO crm_leads(lead_id,pipeline_id,stage_id) VALUES($1,$2,$3) RETURNING id',[lead,pipeline,open])).id;
const sale = {empreendimento_id:property,corretor_id:broker,valor_imovel:500000.25,comissao_percentual:6,imposto_percentual:20,is_venda_direta:false,status:'pendente',data_venda:'2026-01-01',comprovantes:[]};
const close = async (cardId,payload=sale) => (await one('SELECT complete_crm_sale($1,$2) id',[cardId,JSON.stringify(payload)])).id;
const c = await card();
await db.exec('SET ROLE authenticated');
await assert.rejects(()=>close(c),/administradores/);await assert.rejects(()=>settings(),/administradores/);pass('unauthenticated caller cannot conclude or configure');
await db.exec("SET test.uid='00000000-0000-4000-8000-000000000002'");
await assert.rejects(()=>close(c),/administradores/);await assert.rejects(()=>settings(),/administradores/);pass('non-admin cannot conclude or configure');
await db.exec("SET test.uid='00000000-0000-4000-8000-000000000001'");
await assert.rejects(()=>close(c),/Configure/);pass('missing destination fails before any sale');
await settings();
for(const invalid of [{valor_imovel:0},{valor_imovel:-1},{valor_imovel:'NaN'},{valor_imovel:'Infinity'},
  {comissao_percentual:101},{imposto_percentual:-1},{imposto_percentual:'NaN'},
  {empreendimento_id:null},{corretor_id:null},{data_venda:'2999-01-01'},{status:'cancelada'}]) {
  await assert.rejects(()=>close(c,{...sale,...invalid}));
}
assert.equal((await one('SELECT count(*)::int n FROM vendas')).n,0);pass('invalid money, percent, property, broker, future date and status roll back');
const saleId=await close(c);
assert.equal(await close(c),saleId);assert.equal((await one('SELECT count(*)::int n FROM vendas')).n,1);
assert.deepEqual(await one('SELECT stage_id,venda_id,valor_estimado::float8 FROM crm_leads WHERE id=$1',[c]),{stage_id:won,venda_id:saleId,valor_estimado:500000.25});
pass('sale and movement are atomic and retry is idempotent');
await db.exec('RESET ROLE');
await db.exec(`CREATE FUNCTION reject_crm_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced failure'; END $$;
CREATE TRIGGER reject_crm_test BEFORE UPDATE ON crm_leads FOR EACH ROW EXECUTE FUNCTION reject_crm_test();`);
const failed=await card();await assert.rejects(()=>close(failed),/forced failure/);
assert.equal((await one('SELECT count(*)::int n FROM vendas')).n,1);await db.exec('DROP TRIGGER reject_crm_test ON crm_leads');pass('movement failure rolls back inserted sale');
const completed=(await one('SELECT completed_at::text t FROM crm_leads WHERE id=$1',[c])).t;
await exec('UPDATE crm_leads SET stage_id=$1,completed_at=now()+interval \'1 day\',posicao=9 WHERE id=$2',[open,c]);
assert.equal((await one('SELECT stage_id FROM crm_leads WHERE id=$1',[c])).stage_id,won);
assert.equal((await one('SELECT completed_at::text t FROM crm_leads WHERE id=$1',[c])).t,completed);pass('reorder and automation cannot reopen sold card or renew completion');
await exec('UPDATE vendas SET valor_imovel=700000.33 WHERE id=$1',[saleId]);
assert.equal((await one('SELECT valor_estimado::float8 v FROM crm_leads WHERE id=$1',[c])).v,700000.33);pass('sale edit updates CRM value');
await settings(stages.map(s=>({...s,nome:s.id===won?'Venda concluída':s.nome})));
assert.equal((await one('SELECT completed_stage_id FROM crm_pipelines WHERE id=$1',[pipeline])).completed_stage_id,won);pass('rename keeps configured destination');
await assert.rejects(()=>settings(stages.filter(s=>s.id!==open)),/ocupada/);pass('occupied stage deletion rejected transactionally');
const third=(await one("INSERT INTO crm_stages(pipeline_id,nome,posicao) VALUES($1,'Novo destino',2) RETURNING id",[pipeline])).id;
await settings([...stages,{id:third,nome:'Novo destino',posicao:2}],third);
assert.equal((await one('SELECT stage_id FROM crm_leads WHERE id=$1',[c])).stage_id,third);
assert.equal((await one('SELECT completed_at::text t FROM crm_leads WHERE id=$1',[c])).t,completed);pass('changing completion column moves sold card and preserves completion');
await assert.rejects(()=>settings(stages,null),/possui vendas/);pass('cannot remove completion configuration while linked sales exist');
const foreignPipeline=(await one("INSERT INTO crm_pipelines(nome) VALUES('Outro') RETURNING id")).id;
const foreignStage=(await one("INSERT INTO crm_stages(pipeline_id,nome,posicao) VALUES($1,'Outro',0) RETURNING id",[foreignPipeline])).id;
await assert.rejects(()=>settings([...stages,{id:foreignStage,nome:'Inválido',posicao:3}]),/outro funil/);pass('foreign stage IDs cannot be reassigned');
// Explicit timestamps on insert allow deterministic boundary tests without changing old completion dates.
const boundary = async t => (await one('INSERT INTO crm_leads(lead_id,pipeline_id,stage_id,completed_at) VALUES($1,$2,$3,$4) RETURNING id',[lead,pipeline,third,t])).id;
const previous=await boundary('2030-10-01T02:59:59Z'), current=await boundary('2030-10-01T03:00:00Z');
await one("SELECT private.archive_completed_crm_leads('2030-10-01T02:59:59Z')");
assert.equal((await one('SELECT archived_at FROM crm_leads WHERE id=$1',[previous])).archived_at,null);
await one("SELECT private.archive_completed_crm_leads('2030-10-01T03:00:00Z')");
assert.ok((await one('SELECT archived_at FROM crm_leads WHERE id=$1',[previous])).archived_at);
assert.equal((await one('SELECT archived_at FROM crm_leads WHERE id=$1',[current])).archived_at,null);
assert.equal((await one("SELECT private.archive_completed_crm_leads('2030-10-01T03:00:00Z') n")).n,0);pass('São Paulo month boundary, current month retained, archive idempotent');
assert.equal((await one('SELECT count(*)::int n FROM vendas')).n,1);pass('archive preserves sale and lead records');
await db.exec('SET ROLE authenticated');await assert.rejects(()=>one('SELECT private.archive_completed_crm_leads()'),/permission denied/);pass('clients cannot run archive worker');await db.exec('RESET ROLE');
await exec("UPDATE vendas SET status='cancelada' WHERE id=$1",[saleId]);
assert.deepEqual(await one('SELECT venda_id,completed_at,archived_at,stage_id FROM crm_leads WHERE id=$1',[c]),{venda_id:null,completed_at:null,archived_at:null,stage_id:open});pass('cancellation reopens even an archived card and keeps cancelled sale');
const direct=await close(c,{...sale,is_venda_direta:true,corretor_id:null});
assert.equal((await one('SELECT corretor_id FROM vendas WHERE id=$1',[direct])).corretor_id,null);
await exec('DELETE FROM vendas WHERE id=$1',[direct]);assert.equal((await one('SELECT venda_id FROM crm_leads WHERE id=$1',[c])).venda_id,null);pass('direct sale and sale deletion reconcile correctly');
await db.exec('SET ROLE anon');await assert.rejects(()=>close(c),/permission denied/);pass('anon has no RPC execution permission');
console.log(`${count} CRM database scenarios passed`);
await db.close();
