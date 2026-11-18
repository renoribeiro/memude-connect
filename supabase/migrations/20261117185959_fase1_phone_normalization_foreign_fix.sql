-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

create or replace function public.normalize_phone_canonical(raw text)
returns text
language plpgsql
immutable
as $$
declare
  trimmed text := btrim(coalesce(raw,''));
  digits text := regexp_replace(trimmed, '\D', '', 'g');
  ddd text;
  subscriber text;
begin
  if digits = '' then return null; end if;

  if left(trimmed,2) = '00' then
    digits := substring(digits from 3);
    trimmed := '+' || digits;
  end if;

  -- DDI explícito diferente de 55: estrangeiro, fica como veio
  if left(trimmed,1) = '+' and left(digits,2) <> '55' then
    return digits;
  end if;

  if length(digits) in (12,13) and left(digits,2) = '55' then
    digits := substring(digits from 3);
  end if;

  if length(digits) not in (10,11) then
    return digits;
  end if;

  ddd := left(digits,2);
  subscriber := substring(digits from 3);

  if length(subscriber) = 8 and substring(subscriber,1,1) between '6' and '9' then
    subscriber := '9' || subscriber;
  end if;

  return '55' || ddd || subscriber;
end;
$$;

create or replace function public.normalize_phone_key(raw text)
returns text
language plpgsql
immutable
as $$
declare
  canonical text := public.normalize_phone_canonical(raw);
  national text;
begin
  if canonical is null then return null; end if;
  if length(canonical) in (12,13) and left(canonical,2) = '55' then
    national := substring(canonical from 3);
    return left(national,2) || '-' || right(substring(national from 3), 8);
  end if;
  return 'INT-' || canonical;
end;
$$;

create or replace function public.normalize_phone_display(raw text)
returns text
language plpgsql
immutable
as $$
declare
  canonical text := public.normalize_phone_canonical(raw);
  subscriber text;
begin
  if canonical is null then return null; end if;
  if length(canonical) in (12,13) and left(canonical,2) = '55' then
    subscriber := substring(canonical from 5);
    return '55 ' || substring(canonical from 3 for 2) || ' '
      || left(subscriber, length(subscriber) - 4) || '-' || right(subscriber,4);
  end if;
  return '+' || canonical;
end;
$$;

-- Versão para uso no front/API (RPC): devolve as três formas de uma vez
create or replace function public.normalize_phone(raw text)
returns table(chave text, exibicao text, canonico text)
language sql
immutable
as $$
  select public.normalize_phone_key(raw), public.normalize_phone_display(raw), public.normalize_phone_canonical(raw);
$$;

grant execute on function public.normalize_phone(text) to authenticated;
;
