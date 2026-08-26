-- Auditoria read-only de capacidade e fragmentação do MeMude Connect.
-- Execute no SQL Editor do projeto sistema-memude.

select
  current_database() as database_name,
  pg_database_size(current_database()) as bytes,
  pg_size_pretty(pg_database_size(current_database())) as size_pretty,
  now() as measured_at;

select
  n.nspname as schema_name,
  sum(pg_total_relation_size(c.oid))::bigint as total_bytes,
  pg_size_pretty(sum(pg_total_relation_size(c.oid))) as total_size
from pg_class as c
join pg_namespace as n on n.oid = c.relnamespace
where c.relkind in ('r', 'm', 'p')
  and n.nspname not like 'pg_toast%'
group by n.nspname
order by total_bytes desc;

select
  n.nspname as schema_name,
  c.relname as relation_name,
  pg_total_relation_size(c.oid) as total_bytes,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
  pg_size_pretty(pg_relation_size(c.oid)) as heap_size,
  pg_size_pretty(pg_indexes_size(c.oid)) as index_size,
  coalesce(s.n_live_tup, c.reltuples)::bigint as estimated_live_rows,
  coalesce(s.n_dead_tup, 0)::bigint as dead_rows,
  s.last_autovacuum,
  s.last_autoanalyze
from pg_class as c
join pg_namespace as n on n.oid = c.relnamespace
left join pg_stat_user_tables as s on s.relid = c.oid
where c.relkind in ('r', 'm')
order by total_bytes desc
limit 50;

select
  count(*) as retained_cron_runs,
  count(*) filter (where start_time >= now() - interval '24 hours') as runs_24h,
  count(*) filter (where start_time >= now() - interval '7 days') as runs_7d,
  min(start_time) as oldest_run,
  max(end_time) as newest_run
from cron.job_run_details;

select
  count(*) as pg_net_responses,
  min(created) as oldest_response,
  max(created) as newest_response,
  pg_size_pretty(pg_total_relation_size('net._http_response'::regclass)) as total_size
from net._http_response;

select
  inhparent::regclass::text as parent_table,
  inhrelid::regclass::text as partition_table,
  pg_get_expr(c.relpartbound, c.oid) as partition_bound,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size
from pg_inherits
join pg_class as c on c.oid = inhrelid
where inhparent in ('public.integration_logs'::regclass, 'public.audit_logs'::regclass)
order by parent_table, partition_bound;

select
  jobid,
  jobname,
  schedule,
  active
from cron.job
order by jobid;
