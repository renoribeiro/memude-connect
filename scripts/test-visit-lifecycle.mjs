import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Real PostgreSQL semantics in an isolated database; never connects to production.
const db = new PGlite();
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
  CREATE SCHEMA private; GRANT USAGE ON SCHEMA private TO service_role;
  CREATE TABLE public.evolution_instances(id uuid PRIMARY KEY);
  CREATE TABLE public.user_roles(user_id uuid,role text);
  CREATE TABLE public.leads(id uuid PRIMARY KEY,nome text,telefone text,status text DEFAULT 'visita_agendada');
  CREATE TABLE public.corretores(id uuid PRIMARY KEY,whatsapp text,status text DEFAULT 'ativo');
  CREATE TABLE public.visitas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lead_id uuid REFERENCES leads(id),corretor_id uuid REFERENCES corretores(id),empreendimento_id uuid,data_visita date,horario_visita time,status text,deleted_at timestamptz,lead_confirmou boolean,corretor_confirmou boolean,interesse boolean,feedback_corretor text);
  GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
`);
await db.exec(await readFile(new URL('../supabase/migrations/20260916004310_visit_lifecycle.sql', import.meta.url), 'utf8'));
const q = async (sql, args = []) => (await db.query(sql,args)).rows;
const one = async (sql,args=[]) => (await q(sql,args))[0];
const actor = '10000000-0000-4000-8000-000000000001';
const lead = '20000000-0000-4000-8000-000000000001';
const broker = '30000000-0000-4000-8000-000000000001';
await q(`INSERT INTO user_roles VALUES ($1,'admin')`,[actor]);
await q(`INSERT INTO leads(id,nome,telefone) VALUES ($1,'Cliente sintético','5585999990001')`,[lead]);
await q(`INSERT INTO corretores(id,whatsapp) VALUES ($1,'5585999990002')`,[broker]);
const createVisit = async () => (await one(`INSERT INTO visitas(lead_id,corretor_id,data_visita,horario_visita,status) VALUES($1,$2,current_date+2,'10:00','agendada') RETURNING id`,[lead,broker])).id;
const cycle = id => one('SELECT * FROM visit_cycles WHERE visita_id=$1',[id]);
const reply = async (p,phone,answer,msg) => (await one('SELECT visit_lifecycle_reply($1,$2,$3,$4) AS ok',[p,phone,answer,msg])).ok;
let tests = 0;
const check = (name, fn) => { fn(); tests++; console.log(`PASS ${name}`); };

const old = await createVisit();
assert.equal(await cycle(old),undefined);
check('disabled workflow leaves existing visits untouched',()=>assert.ok(true));
await db.exec('UPDATE visit_automation_config SET enabled=true');
const id = await createVisit();
assert.equal((await cycle(id)).outcome,'pending');
const permissions = await one(`SELECT has_table_privilege('authenticated','visit_cycles','UPDATE') AS writes,has_function_privilege('anon','public.visit_lifecycle_reply(uuid,text,text,text)','EXECUTE') AS replies`);
check('client roles cannot modify cycles or call internal reply RPC',()=>assert.deepEqual(permissions,{writes:false,replies:false}));

await q(`UPDATE visit_cycles SET scheduled_at=now()-interval '61 minutes' WHERE visita_id=$1`,[id]);
await db.exec('SELECT visit_lifecycle_tick(); SELECT visit_lifecycle_tick();');
const prompts = await q(`SELECT * FROM visit_prompts WHERE visita_id=$1 AND kind='attendance'`,[id]);
check('repeated worker ticks create exactly one attendance question',()=>assert.equal(prompts.length,1));
assert.equal(await reply(prompts[0].id,'5585999998888','sim','wrong-person'),false);
assert.equal(await reply(prompts[0].id,'5585999990002','sim','held'),true);
assert.equal(await reply(prompts[0].id,'5585999990002','nao','duplicate'),false);
check('wrong sender and duplicate answer cannot change occurrence',()=>assert.ok(true));
assert.equal((await cycle(id)).outcome,'held');
const rating = await one(`SELECT id FROM visit_prompts WHERE visita_id=$1 AND kind='rating'`,[id]);
assert.equal(await reply(rating.id,'5585999990001','11','bad-rating'),false);
assert.equal(await reply(rating.id,'5585999990001','0','zero-rating'),true);
check('zero is a valid rating; eleven is rejected',()=>assert.ok(true));
assert.equal((await cycle(id)).rating,0);

const missed = await createVisit();
await q(`UPDATE visit_cycles SET scheduled_at=now()-interval '3 hours' WHERE visita_id=$1`,[missed]);
await db.exec('SELECT visit_lifecycle_tick()');
const before = await cycle(missed);
check('silence opens apuration without inventing a no-show',()=>{assert.equal(before.attendance_overdue,true);assert.equal(before.outcome,'pending');});
const missedPrompt = await one(`SELECT id FROM visit_prompts WHERE visita_id=$1 AND kind='attendance'`,[missed]);
assert.equal(await reply(missedPrompt.id,'5585999990002','nao','missed'),true);
assert.equal((await cycle(missed)).recovery_open,true);
const reason = await one(`SELECT id FROM visit_prompts WHERE visita_id=$1 AND kind='reason'`,[missed]);
assert.equal(await reply(reason.id,'5585999990002','Cliente teve um imprevisto','reason'),true);
assert.equal((await cycle(missed)).recovery_open,true);
check('receiving the reason never dismisses recovery',()=>assert.ok(true));
await assert.rejects(q(`SELECT visit_lifecycle_action($1,'withdraw','{"reason":"teste"}',$2)`,[missed,lead]),/Acesso restrito/);
await assert.rejects(q(`UPDATE visitas SET horario_visita='11:00' WHERE id=$1`,[missed]),/Reagendar/);
check('recovery cannot be bypassed by direct schedule edit or non-admin action',()=>assert.ok(true));
const { next } = await one(`SELECT visit_lifecycle_action($1,'reschedule',jsonb_build_object('date',(current_date+3)::text,'time','14:00'),$2) AS next`,[missed,actor]);
assert.equal((await cycle(missed)).recovery_open,false);
assert.equal((await cycle(next)).previous_visita_id,missed);
assert.equal((await cycle(next)).client_confirmed,null);
assert.equal(await reply(reason.id,'5585999990002','outro motivo','late'),false);
check('reschedule preserves history, resets confirmations and expires old questions',()=>assert.ok(true));
assert.equal((await one('SELECT status FROM leads WHERE id=$1',[lead])).status,'visita_agendada');
check('a missed visit never cancels the lead',()=>assert.ok(true));

const edited = await createVisit();
await q('SELECT visit_lifecycle_remind($1)',[edited]);
const oldQuestion = await one(`SELECT id FROM visit_prompts WHERE visita_id=$1 AND audience='client'`,[edited]);
await q(`UPDATE visitas SET horario_visita='15:00' WHERE id=$1`,[edited]);
assert.equal((await cycle(edited)).revision,2);
assert.equal(await reply(oldQuestion.id,'5585999990001','sim','old-revision'),false);
check('editing invalidates earlier confirmation buttons',()=>assert.ok(true));

const declined = await createVisit();
await q('SELECT visit_lifecycle_remind($1)',[declined]);
const clientQuestion = await one(`SELECT id FROM visit_prompts WHERE visita_id=$1 AND audience='client'`,[declined]);
assert.equal(await reply(clientQuestion.id,'5585999990001','nao','cancel'),true);
assert.equal((await cycle(declined)).outcome,'cancelled');
assert.equal((await cycle(declined)).recovery_open,true);
await assert.rejects(q(`SELECT visit_lifecycle_action($1,'reschedule','{"date":"2020-01-01","time":"10:00"}',$2)`,[declined,actor]),/futura/);
assert.equal((await cycle(declined)).recovery_open,true);
check('failed rescheduling cannot close a cancellation task',()=>assert.ok(true));

const replacement = '30000000-0000-4000-8000-000000000002';
await q(`INSERT INTO corretores(id,whatsapp) VALUES($1,'5585999990003')`,[replacement]);
const covered = await createVisit();
await q('SELECT visit_lifecycle_remind($1)',[covered]);
const brokerQuestion = await one(`SELECT id FROM visit_prompts WHERE visita_id=$1 AND audience='broker'`,[covered]);
assert.equal(await reply(brokerQuestion.id,'5585999990002','nao','broker-decline'),true);
await q(`SELECT visit_lifecycle_action($1,'replace_broker',jsonb_build_object('broker_id',$2::text),$3)`,[covered,replacement,actor]);
assert.equal((await cycle(covered)).revision,2);
assert.equal((await cycle(covered)).broker_confirmed,null);
assert.equal((await one('SELECT corretor_id FROM visitas WHERE id=$1',[covered])).corretor_id,replacement);
check('Closer can replace an unavailable broker before the visit',()=>assert.ok(true));

const deleted = await createVisit();
await q('SELECT visit_lifecycle_remind($1)',[deleted]);
const deletedQuestion = await one(`SELECT id FROM visit_prompts WHERE visita_id=$1 AND audience='client'`,[deleted]);
await q('UPDATE visitas SET deleted_at=now() WHERE id=$1',[deleted]);
assert.equal(await reply(deletedQuestion.id,'5585999990001','sim','deleted'),false);
check('deleted visits reject previous confirmation buttons',()=>assert.ok(true));

const timeZone = await one(`SELECT to_char(scheduled_at AT TIME ZONE 'America/Sao_Paulo','HH24:MI') AS time FROM visit_cycles WHERE visita_id=$1`,[covered]);
check('scheduled times preserve the Brazil business timezone',()=>assert.equal(timeZone.time,'10:00'));

await q(`SELECT visit_lifecycle_action($1,'feedback','{"interest":true,"objections":"Prazo","next_step":"Enviar proposta","return_at":"2027-01-15"}',$2)`,[id,actor]);
assert.ok((await cycle(id)).feedback_at);
const afterFeedback = await cycle(id);
check('Closer feedback is persisted separately from the client rating',()=>{assert.equal(afterFeedback.rating,0);assert.equal(afterFeedback.feedback.next_step,'Enviar proposta');});

const batch = await q('SELECT * FROM visit_lifecycle_claim(10)');
const competing = await q('SELECT * FROM visit_lifecycle_claim(10)');
check('concurrent worker cannot claim while an active lease exists',()=>{assert.ok(batch.length);assert.equal(competing.length,0);});
const item = batch[0];
await q(`SELECT visit_lifecycle_finish($1,$2,'sent')`,[item.id,'00000000-0000-4000-8000-000000000000']);
assert.equal((await one('SELECT status FROM visit_outbox WHERE id=$1',[item.id])).status,'processing');
await q(`SELECT visit_lifecycle_finish($1,$2,'failed','synthetic failure')`,[item.id,item.lease_token]);
assert.equal((await one('SELECT status FROM visit_outbox WHERE id=$1',[item.id])).status,'pending');
check('only lease owner can finish; failed delivery retries independently',()=>assert.ok(true));
await db.close();
console.log(`${tests} workflow database scenarios passed`);
