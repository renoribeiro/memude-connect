-- Fotos de perfil:
--  1) o corretor (e a equipe) envia a própria foto pelo app;
--  2) a foto do WhatsApp do cliente é copiada para o nosso armazenamento e aparece nas conversas
--     (o link do WhatsApp expira; a cópia não). Sem foto pública no WhatsApp, fica o bonequinho.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Cada pessoa grava só na própria pasta (avatares/<user_id>/...); clientes/ é escrito só pelo servidor
drop policy if exists "Avatares: enviar a própria foto" on storage.objects;
create policy "Avatares: enviar a própria foto" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Avatares: trocar a própria foto" on storage.objects;
create policy "Avatares: trocar a própria foto" on storage.objects for update to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Avatares: apagar a própria foto" on storage.objects;
create policy "Avatares: apagar a própria foto" on storage.objects for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Grava a foto no perfil (só aceita arquivo da própria pasta no nosso armazenamento)
create or replace function public.meu_avatar_definir(p_caminho text)
returns text language plpgsql security definer set search_path to '' as $$
declare u uuid := auth.uid(); url text;
begin
  if u is null then raise exception 'Faça login' using errcode = '42501'; end if;
  if p_caminho is null then
    update public.profiles set avatar_url = null where user_id = u;
    return null;
  end if;
  if p_caminho !~ ('^' || u::text || '/[A-Za-z0-9._-]{1,80}$') then
    raise exception 'Foto inválida' using errcode = '22023';
  end if;
  url := 'https://oxybasvtphosdmlmrfnb.supabase.co/storage/v1/object/public/avatares/' || p_caminho;
  update public.profiles set avatar_url = url where user_id = u;
  return url;
end $$;
revoke all on function public.meu_avatar_definir(text) from public, anon;
grant execute on function public.meu_avatar_definir(text) to authenticated;

-- ========== Foto do WhatsApp do cliente ==========
alter table public.conversas add column if not exists foto_url text;
alter table public.conversas add column if not exists foto_em timestamptz;

-- Listas de conversa passam a trazer a foto
do $do$
declare src text;
begin
  src := pg_get_functiondef('public.conversas_listar(text,text,integer)'::regprocedure);
  if position('foto_url' in src) = 0 then
    src := replace(src, $a$alertas_abertos integer, arquivada boolean)$a$, $a$alertas_abertos integer, arquivada boolean, foto_url text)$a$);
    src := replace(src, $a$    c.arquivada
  from public.conversas c$a$, $a$    c.arquivada, c.foto_url
  from public.conversas c$a$);
    if (length(src) - length(replace(src, 'foto_url', ''))) / 8 < 2 then raise exception 'Ajuste de conversas_listar não aplicado'; end if;
    drop function public.conversas_listar(text, text, integer);
    execute src;
    revoke all on function public.conversas_listar(text, text, integer) from public, anon;
    grant execute on function public.conversas_listar(text, text, integer) to authenticated;
  end if;

  src := pg_get_functiondef('public.corretor_meus_clientes()'::regprocedure);
  if position('foto_url' in src) = 0 then
    src := replace(src, $a$proxima_visita jsonb, empreendimento text)$a$, $a$proxima_visita jsonb, empreendimento text, foto_url text)$a$);
    src := replace(src, $a$    e.nome
  from public.conversas c$a$, $a$    e.nome, c.foto_url
  from public.conversas c$a$);
    if (length(src) - length(replace(src, 'foto_url', ''))) / 8 < 2 then raise exception 'Ajuste de corretor_meus_clientes não aplicado'; end if;
    drop function public.corretor_meus_clientes();
    execute src;
    revoke all on function public.corretor_meus_clientes() from public, anon;
    grant execute on function public.corretor_meus_clientes() to authenticated;
  end if;
end $do$;

-- Fila: conversas sem foto ou com foto de mais de 7 dias (só números conectados)
create or replace function public.conv_fotos_pendentes(p_limite int default 15)
returns table(conversa_id uuid, instancia text, telefone text)
language sql security definer set search_path to '' as $$
  update public.conversas c set foto_em = now()
  from public.conv_numeros n
  where n.id = c.numero_id and c.id in (
    select c2.id from public.conversas c2 join public.conv_numeros n2 on n2.id = c2.numero_id
    where n2.ativo and n2.status = 'aberto' and (c2.foto_em is null or c2.foto_em < now() - interval '7 days')
    order by c2.foto_em nulls first, c2.ultima_mensagem_em desc nulls last
    limit least(greatest(p_limite, 1), 30) for update of c2 skip locked)
  returning c.id, n.instancia, c.telefone;
$$;
create or replace function public.conv_foto_gravar(p_conversa uuid, p_url text)
returns void language sql security definer set search_path to '' as $$
  update public.conversas set foto_url = p_url, foto_em = now() where id = p_conversa;
$$;
revoke all on function public.conv_fotos_pendentes(int) from public, anon, authenticated;
revoke all on function public.conv_foto_gravar(uuid, text) from public, anon, authenticated;
grant execute on function public.conv_fotos_pendentes(int) to service_role;
grant execute on function public.conv_foto_gravar(uuid, text) to service_role;

do $do$
begin
  perform cron.unschedule('conversas-fotos') where exists (select 1 from cron.job where jobname = 'conversas-fotos');
  perform cron.schedule('conversas-fotos', '*/10 * * * *', $cron$
    select net.http_post(
      url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/conversas-fotos',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')),
      body := '{}'::jsonb, timeout_milliseconds := 60000)
    where exists (select 1 from public.conversas c join public.conv_numeros n on n.id = c.numero_id
                  where n.ativo and n.status = 'aberto' and (c.foto_em is null or c.foto_em < now() - interval '7 days'));
  $cron$);
end $do$;
