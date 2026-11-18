-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

-- Funções de normalização de telefone (reaproveitadas no front via RPC e na API)
create or replace function public.normalize_phone_canonical(raw text)
returns text
language plpgsql
immutable
as $$
declare
  digits text := regexp_replace(coalesce(raw,''), '\D', '', 'g');
  ddd text;
  subscriber text;
begin
  if digits = '' then return null; end if;

  if length(digits) in (12,13) and left(digits,2) = '55' then
    digits := substring(digits from 3);
  end if;

  if length(digits) not in (10,11) then
    return digits; -- estrangeiro ou inválido: devolve só os dígitos
  end if;

  ddd := left(digits,2);
  subscriber := substring(digits from 3);

  if length(subscriber) = 8 and substring(subscriber,1,1) between '6' and '9' then
    subscriber := '9' || subscriber; -- celular sem o 9
  end if;

  return '55' || ddd || subscriber;
end;
$$;

comment on function public.normalize_phone_canonical(text) is
  'Fase 1 Leads/Visitas: normaliza um telefone para o formato canônico 55DDDNUMERO, adicionando o 9 do celular quando faltar.';

create or replace function public.normalize_phone_key(raw text)
returns text
language plpgsql
immutable
as $$
declare
  canonical text := public.normalize_phone_canonical(raw);
  digits text;
  ddd text;
  subscriber text;
begin
  if canonical is null then return null; end if;
  digits := canonical;
  if length(digits) in (12,13) and left(digits,2) = '55' then
    digits := substring(digits from 3);
    ddd := left(digits,2);
    subscriber := substring(digits from 3);
    return ddd || '-' || right(subscriber, 8);
  end if;
  if length(digits) <= 2 then return digits; end if;
  return left(digits,2) || '-' || substring(digits from 3);
end;
$$;

comment on function public.normalize_phone_key(text) is
  'Fase 1 Leads/Visitas: chave única de deduplicação de lead = DDD + últimos 8 dígitos (ignora o 9 do celular). Estrangeiros usam DDI-número.';

create or replace function public.normalize_phone_display(raw text)
returns text
language plpgsql
immutable
as $$
declare
  canonical text := public.normalize_phone_canonical(raw);
  digits text;
  ddi text;
  ddd text;
  subscriber text;
begin
  if canonical is null then return null; end if;
  digits := canonical;
  if length(digits) = 13 and left(digits,2) = '55' then
    ddi := left(digits,2);
    ddd := substring(digits from 3 for 2);
    subscriber := substring(digits from 5);
    return ddi || ' ' || ddd || ' ' || left(subscriber,5) || '-' || right(subscriber,4);
  end if;
  if length(digits) = 12 and left(digits,2) = '55' then
    ddi := left(digits,2);
    ddd := substring(digits from 3 for 2);
    subscriber := substring(digits from 5);
    return ddi || ' ' || ddd || ' ' || left(subscriber,4) || '-' || right(subscriber,4);
  end if;
  return digits;
end;
$$;

comment on function public.normalize_phone_display(text) is
  'Fase 1 Leads/Visitas: formato de exibição "55 85 99999-9999".';
;
