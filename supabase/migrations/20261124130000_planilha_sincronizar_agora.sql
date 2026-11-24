-- ============================================================
-- Sincronização manual planilha ↔ CRM (botão na tela de Leads)
-- 1) Trava: lotes de importação da planilha rodam um de cada vez. Se o botão e o
--    cron das 17h30 rodarem juntos, o segundo espera o primeiro e encontra o lead
--    já criado (não duplica).
-- 2) public.planilha_sincronizar_agora(): qualquer pessoa da equipe comercial
--    dispara a mesma rotina do cron (modo "diario"), no máximo uma vez a cada 2 min.
-- ============================================================

-- 1) Trava na importação (insere a linha logo no início da função existente)
do $do$
declare src text;
begin
  src := pg_get_functiondef('public.planilha_importar_lote(text,jsonb)'::regprocedure);
  if position('pg_advisory_xact_lock' in src) = 0 then
    src := replace(src,
      E'begin\n  if p_aba not in (''LEADS'',''VISITAS'') then',
      E'begin\n  -- Um lote por vez (botão manual × cron): evita criar o mesmo lead duas vezes\n  perform pg_advisory_xact_lock(hashtext(''planilha_importar_lote''));\n  if p_aba not in (''LEADS'',''VISITAS'') then');
    if position('pg_advisory_xact_lock' in src) = 0 then
      raise exception 'Não foi possível incluir a trava em planilha_importar_lote';
    end if;
    execute src;
  end if;
end $do$;

-- 2) Disparo manual
create table if not exists private.planilha_sync_disparos (
  id bigserial primary key,
  pedido_por uuid,
  pedido_em timestamptz not null default now(),
  request_id bigint
);

create or replace function public.planilha_sincronizar_agora()
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  ator uuid := private.f1_exigir_comercial();
  v_ultimo timestamptz;
  v_req bigint;
begin
  select max(pedido_em) into v_ultimo from private.planilha_sync_disparos;
  if v_ultimo is not null and v_ultimo > now() - interval '2 minutes' then
    raise exception 'Uma sincronização acabou de ser pedida. Aguarde 2 minutos e tente de novo.' using errcode = '22023';
  end if;
  if exists (select 1 from public.sheet_sync_execucoes where iniciado_em > now() - interval '1 minute' and concluido_em is null) then
    raise exception 'A sincronização já está rodando. Aguarde um instante.' using errcode = '22023';
  end if;

  select net.http_post(
    url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/sheets-espelho',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')),
    body := '{"modo":"diario"}'::jsonb,
    timeout_milliseconds := 150000
  ) into v_req;

  insert into private.planilha_sync_disparos (pedido_por, request_id) values (ator, v_req);
  return jsonb_build_object('pedido_em', now(), 'request_id', v_req);
end $$;

revoke all on function public.planilha_sincronizar_agora() from public, anon;
grant execute on function public.planilha_sincronizar_agora() to authenticated;
