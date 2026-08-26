-- Keep operational data bounded without changing any business workflow.
-- Physical compaction (VACUUM FULL) is intentionally executed as a separate
-- maintenance operation because PostgreSQL does not allow it in a migration
-- transaction.

begin;

-- ---------------------------------------------------------------------------
-- 1. Bounded retention for internal/cached operational data.
-- ---------------------------------------------------------------------------

create or replace function public.cleanup_database_operational_history()
returns table (
  cron_runs_deleted bigint,
  rate_limits_deleted bigint,
  response_cache_deleted bigint,
  health_metrics_deleted bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, cron, net, pg_temp
as $function$
declare
  v_cron_runs_deleted bigint := 0;
  v_rate_limits_deleted bigint := 0;
  v_response_cache_deleted bigint := 0;
  v_health_metrics_deleted bigint := 0;
begin
  -- pg_cron does not prune this history itself. Seven days covers the current
  -- monitoring screens and the 24-hour failure checks with a wide margin.
  delete from cron.job_run_details as run
  where coalesce(run.end_time, run.start_time) < now() - interval '7 days';
  get diagnostics v_cron_runs_deleted = row_count;

  delete from public.rate_limits as limit_row
  where limit_row.expires_at < now() - interval '5 minutes';
  get diagnostics v_rate_limits_deleted = row_count;

  delete from public.response_cache as cache_row
  where cache_row.expires_at < now();
  get diagnostics v_response_cache_deleted = row_count;

  delete from public.system_health_metrics as metric
  where metric.bucket_time < now() - interval '7 days';
  get diagnostics v_health_metrics_deleted = row_count;

  return query
  select
    v_cron_runs_deleted,
    v_rate_limits_deleted,
    v_response_cache_deleted,
    v_health_metrics_deleted;
end;
$function$;

revoke all on function public.cleanup_database_operational_history()
  from public, anon, authenticated;
grant execute on function public.cleanup_database_operational_history()
  to service_role;

select cron.unschedule(jobid)
from cron.job
where jobname = 'cleanup-database-operational-history';

select cron.schedule(
  'cleanup-database-operational-history',
  '15 3 * * *',
  $cron$select public.cleanup_database_operational_history();$cron$
);

comment on function public.cleanup_database_operational_history() is
  'Bounds pg_cron history to 7 days and removes expired technical cache data; no business records are removed.';

-- The managed extension tables are owned by supabase_admin, so project roles
-- cannot change their reloptions or run VACUUM FULL on them. This thresholded,
-- atomic rewrite uses the explicit TRUNCATE/INSERT grants provided by Supabase,
-- preserves the useful rows and releases the bloated relation files.
create or replace function public.compact_operational_tables_if_needed()
returns table (
  cron_compacted boolean,
  net_compacted boolean,
  cron_rows_preserved bigint,
  net_rows_preserved bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, cron, net, pg_temp
as $function$
declare
  v_cron_compacted boolean := false;
  v_net_compacted boolean := false;
  v_cron_rows_preserved bigint := 0;
  v_net_rows_preserved bigint := 0;
begin
  if pg_total_relation_size('cron.job_run_details'::regclass) > 134217728 then
    create temporary table operational_cron_runs_to_keep
      on commit drop
      as
      select *
      from cron.job_run_details as run
      where coalesce(run.end_time, run.start_time) >= now() - interval '7 days';

    select count(*) into v_cron_rows_preserved
    from operational_cron_runs_to_keep;

    truncate table cron.job_run_details;

    insert into cron.job_run_details (
      jobid, runid, job_pid, database, username, command, status,
      return_message, start_time, end_time
    )
    select
      jobid, runid, job_pid, database, username, command, status,
      return_message, start_time, end_time
    from operational_cron_runs_to_keep;

    v_cron_compacted := true;
  end if;

  if pg_total_relation_size('net._http_response'::regclass) > 67108864 then
    create temporary table operational_http_responses_to_keep
      on commit drop
      as
      select *
      from net._http_response;

    select count(*) into v_net_rows_preserved
    from operational_http_responses_to_keep;

    truncate table net._http_response;

    insert into net._http_response (
      id, status_code, content_type, headers, content, timed_out, error_msg, created
    )
    select
      id, status_code, content_type, headers, content, timed_out, error_msg, created
    from operational_http_responses_to_keep;

    v_net_compacted := true;
  end if;

  return query
  select
    v_cron_compacted,
    v_net_compacted,
    v_cron_rows_preserved,
    v_net_rows_preserved;
end;
$function$;

revoke all on function public.compact_operational_tables_if_needed()
  from public, anon, authenticated;
grant execute on function public.compact_operational_tables_if_needed()
  to service_role;

select cron.unschedule(jobid)
from cron.job
where jobname = 'compact-operational-tables-if-needed';

select cron.schedule(
  'compact-operational-tables-if-needed',
  '40 4 1 * *',
  $cron$select public.compact_operational_tables_if_needed();$cron$
);

comment on function public.compact_operational_tables_if_needed() is
  'Atomically rewrites oversized pg_cron and pg_net operational tables while preserving their active retention windows.';

-- ---------------------------------------------------------------------------
-- 2. Automatically maintain the already-established monthly log partitions.
-- ---------------------------------------------------------------------------

create or replace function public.ensure_monthly_log_partitions(
  p_months_ahead integer default 4
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_parent text;
  v_partition text;
  v_month_start timestamptz;
  v_month_end timestamptz;
  v_offset integer;
  v_created integer := 0;
begin
  if p_months_ahead < 1 or p_months_ahead > 24 then
    raise exception using
      errcode = '22023',
      message = 'p_months_ahead deve estar entre 1 e 24';
  end if;

  foreach v_parent in array array['integration_logs', 'audit_logs']
  loop
    for v_offset in 0..p_months_ahead
    loop
      v_month_start := date_trunc('month', now()) + make_interval(months => v_offset);
      v_month_end := v_month_start + interval '1 month';
      v_partition := format(
        '%s_y%sm%s',
        v_parent,
        to_char(v_month_start, 'YYYY'),
        to_char(v_month_start, 'MM')
      );

      if to_regclass(format('public.%I', v_partition)) is null then
        execute format(
          'create table public.%I partition of public.%I for values from (%L) to (%L)',
          v_partition,
          v_parent,
          v_month_start,
          v_month_end
        );

        execute format(
          'alter table public.%I set (autovacuum_vacuum_scale_factor = 0.05, autovacuum_vacuum_threshold = 100, autovacuum_analyze_scale_factor = 0.05, autovacuum_analyze_threshold = 100)',
          v_partition
        );

        v_created := v_created + 1;
      end if;
    end loop;
  end loop;

  return v_created;
end;
$function$;

revoke all on function public.ensure_monthly_log_partitions(integer)
  from public, anon, authenticated;
grant execute on function public.ensure_monthly_log_partitions(integer)
  to service_role;

select public.ensure_monthly_log_partitions(4);

select cron.unschedule(jobid)
from cron.job
where jobname = 'ensure-monthly-log-partitions';

select cron.schedule(
  'ensure-monthly-log-partitions',
  '15 1 15 * *',
  $cron$select public.ensure_monthly_log_partitions(4);$cron$
);

comment on function public.ensure_monthly_log_partitions(integer) is
  'Creates integration_logs and audit_logs monthly partitions four months ahead so new rows do not accumulate in default partitions.';

-- ---------------------------------------------------------------------------
-- 3. Per-table autovacuum for application-owned high-churn relations.
-- ---------------------------------------------------------------------------

alter table public.wp_sync_performance set (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 100,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_analyze_threshold = 100
);

alter table public.webhook_logs set (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 100,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_analyze_threshold = 100
);

do $block$
declare
  v_partition regclass;
begin
  for v_partition in
    select inhrelid::regclass
    from pg_inherits
    where inhparent in (
      'public.integration_logs'::regclass,
      'public.audit_logs'::regclass
    )
  loop
    execute format(
      'alter table %s set (autovacuum_vacuum_scale_factor = 0.05, autovacuum_vacuum_threshold = 100, autovacuum_analyze_scale_factor = 0.05, autovacuum_analyze_threshold = 100)',
      v_partition
    );
  end loop;
end;
$block$;

-- ---------------------------------------------------------------------------
-- 4. Remove only exact B-tree duplicates already covered by UNIQUE indexes.
-- ---------------------------------------------------------------------------

drop index if exists public.idx_agent_followups_sequence;
drop index if exists public.idx_corretores_email;
drop index if exists public.idx_corretores_profile_id;
drop index if exists public.idx_empreendimentos_wp_post_id;
drop index if exists public.idx_intent_cache_hash;
drop index if exists public.idx_lid_phone_map_lid;
drop index if exists public.idx_profiles_user_id;
drop index if exists public.idx_property_embeddings_empreendimento;
drop index if exists public.idx_response_cache_hash;
drop index if exists public.idx_user_roles_user_id;
drop index if exists public.idx_whatsapp_verification_phone;

commit;
