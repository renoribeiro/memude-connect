import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const query = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await query(sql, params))[0];
const actorId = '10000000-0000-4000-8000-000000000001';
const firstSaleId = '20000000-0000-4000-8000-000000000001';
const secondSaleId = '20000000-0000-4000-8000-000000000002';

await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role bypassrls;
  create schema auth;
  create schema private;
  create schema vault;
  create type public.app_role as enum ('admin', 'corretor', 'cliente');
  create table auth.users(id uuid primary key);
  create table vault.decrypted_secrets(name text primary key, decrypted_secret text);
  create table public.corretores(id uuid primary key);
  create table public.empreendimentos(id uuid primary key);
  create table public.leads(id uuid primary key);
  create table public.vendas(id uuid primary key, cliente text, valor numeric);
  insert into auth.users values ('${actorId}');
  insert into vault.decrypted_secrets values
    ('memude_financeiro_webhook_url', 'https://finance.example/api/webhook'),
    ('memude_financeiro_webhook_secret', 'test-secret');

  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
  create function private.has_role(_user_id uuid, _role public.app_role)
  returns boolean language sql stable as
    $$ select _user_id = '${actorId}'::uuid and _role = 'admin'::public.app_role $$;
  create function private.notify_memude_financeiro()
  returns trigger language plpgsql as $$ begin return new; end $$;
`);

await db.exec(await readFile(
  new URL('../supabase/migrations/20260922223625_sale_deletion_workflow.sql', import.meta.url),
  'utf8',
));

await query("select set_config('request.jwt.claim.sub', $1, false)", [actorId]);
await query("select set_config('request.jwt.claim.role', 'authenticated', false)");
await query('insert into public.vendas values ($1, $2, $3)', [firstSaleId, 'Cliente Core', 500000]);

const coreOnly = await one('select public.request_sale_deletion($1, false) result', [firstSaleId]);
assert.equal(coreOnly.result.state, 'completed');
assert.equal((await one('select count(*)::int count from public.vendas')).count, 0);
assert.equal((await one('select venda_snapshot from public.sale_deletion_requests where venda_id=$1', [firstSaleId])).venda_snapshot.cliente, 'Cliente Core');

await query('insert into public.vendas values ($1, $2, $3)', [secondSaleId, 'Cliente Integrado', 700000]);
const integrated = await one('select public.request_sale_deletion($1, true) result', [secondSaleId]);
assert.equal(integrated.result.state, 'pending');

await query("select set_config('request.jwt.claim.role', 'service_role', false)");
const claimed = await query('select * from public.claim_sale_deletion_requests($1, 1)', [integrated.result.request_id]);
assert.equal(claimed.length, 1);
assert.equal(claimed[0].attempts, 1);
assert.equal(claimed[0].state, 'processing');

await query('select public.finish_sale_deletion_request($1, true, null)', [integrated.result.request_id]);
assert.equal((await one('select state from public.sale_deletion_requests where id=$1', [integrated.result.request_id])).state, 'completed');

console.log('Sale deletion workflow: 8 checks passed.');
await db.close();
