-- Fotos de clientes: não guardar o que ninguém vai ver.
--  * Conversa arquivada há mais de 30 dias  → a cópia da foto é apagada.
--  * Cliente "NÃO INTERESSADO" e sem movimento há 30 dias → idem.
-- Enquanto a conversa estiver assim, a foto não é buscada de novo no WhatsApp.
-- Se a conversa voltar (desarquivada ou cliente muda de status), a foto é buscada na próxima rodada.

alter table public.conversas add column if not exists arquivada_em timestamptz;

create or replace function private.conv_arquivada_em()
returns trigger language plpgsql set search_path to '' as $$
begin
  if TG_OP = 'INSERT' then
    NEW.arquivada_em := case when NEW.arquivada then now() end;
  elsif NEW.arquivada is distinct from OLD.arquivada then
    NEW.arquivada_em := case when NEW.arquivada then now() end;
  end if;
  return NEW;
end $$;
drop trigger if exists conv_arquivada_em on public.conversas;
create trigger conv_arquivada_em before insert or update of arquivada on public.conversas
  for each row execute function private.conv_arquivada_em();

-- Já arquivadas: os 30 dias contam a partir de agora (ninguém perde foto de surpresa)
update public.conversas set arquivada_em = now() where arquivada and arquivada_em is null;

-- Conversa que não precisa de foto (arquivada ou cliente sem interesse)
create or replace function private.conv_foto_dispensada(p_arquivada boolean, p_lead uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select coalesce(p_arquivada, false)
      or exists (select 1 from public.leads l where l.id = p_lead and l.status_atendimento = 'NÃO INTERESSADO');
$$;

-- Fila de busca: ignora as dispensadas
create or replace function public.conv_fotos_pendentes(p_limite int default 15)
returns table(conversa_id uuid, instancia text, telefone text)
language sql security definer set search_path to '' as $$
  update public.conversas c set foto_em = now()
  from public.conv_numeros n
  where n.id = c.numero_id and c.id in (
    select c2.id from public.conversas c2 join public.conv_numeros n2 on n2.id = c2.numero_id
    where n2.ativo and n2.status = 'aberto' and (c2.foto_em is null or c2.foto_em < now() - interval '7 days')
      and not private.conv_foto_dispensada(c2.arquivada, c2.lead_id)
    order by c2.foto_em nulls first, c2.ultima_mensagem_em desc nulls last
    limit least(greatest(p_limite, 1), 30) for update of c2 skip locked)
  returning c.id, n.instancia, c.telefone;
$$;

-- Fotos para apagar (arquivada há 30 dias, ou sem interesse e parado há 30 dias)
create or replace function public.conv_fotos_para_apagar(p_limite int default 100)
returns table(conversa_id uuid)
language sql stable security definer set search_path to '' as $$
  select c.id from public.conversas c
  left join public.leads l on l.id = c.lead_id
  where c.foto_url is not null
    and ((c.arquivada and c.arquivada_em < now() - interval '30 days')
      or (l.status_atendimento = 'NÃO INTERESSADO' and l.updated_at < now() - interval '30 days'))
  limit least(greatest(p_limite, 1), 500);
$$;

-- Depois de apagar o arquivo: limpa o link (foto_em nulo = busca de novo se a conversa voltar)
create or replace function public.conv_fotos_apagadas(p_ids uuid[])
returns integer language sql security definer set search_path to '' as $$
  with x as (update public.conversas set foto_url = null, foto_em = null where id = any(p_ids) and foto_url is not null returning 1)
  select count(*)::int from x;
$$;

revoke all on function public.conv_fotos_para_apagar(int) from public, anon, authenticated;
revoke all on function public.conv_fotos_apagadas(uuid[]) from public, anon, authenticated;
revoke all on function private.conv_foto_dispensada(boolean, uuid) from public, anon, authenticated;
grant execute on function public.conv_fotos_para_apagar(int) to service_role;
grant execute on function public.conv_fotos_apagadas(uuid[]) to service_role;

-- O cron só chama a função quando há foto para buscar ou para apagar
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
                  where n.ativo and n.status = 'aberto' and (c.foto_em is null or c.foto_em < now() - interval '7 days')
                    and not private.conv_foto_dispensada(c.arquivada, c.lead_id))
       or exists (select 1 from public.conv_fotos_para_apagar(1));
  $cron$);
end $do$;
