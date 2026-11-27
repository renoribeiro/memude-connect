-- Regra única de "lead qualificado" (painel, histórico e apresentação usam a mesma):
--  * Descartes NUNCA contam, mesmo que o lead tenha tido visita: sem renda, não interessado, corretor, inválido,
--    já comprou, não no momento, perdido, desistiu.
--  * Contam: em conversa, interessado, investidor, visita agendada e etapas seguintes até vendido.
--  * Outros status (novo, reativado, sem interação...) contam só se o lead teve visita.
create or replace function private.lead_qualificado(p_status text, p_tem_visita boolean)
returns boolean language sql immutable set search_path to '' as $$
  select case
    when p_status in ('sem renda', 'nao interessado', 'corretor', 'invalido', 'ja comprou', 'nao no momento', 'perdido', 'desistiu') then false
    when p_status in ('em conversa', 'interessado', 'investidor', 'visita agendada', 'visitou', 'documentacao', 'doc aprovada',
                      'negociacao', 'aguardando assinatura', 'vendido', 'vendido!') then true
    else coalesce(p_tem_visita, false)
  end;
$$;
revoke all on function private.lead_qualificado(text, boolean) from public, anon, authenticated;

do $do$
declare src text; antes text;
begin
  src := pg_get_functiondef('private.painel_numeros(date,date)'::regprocedure);
  if position('lead_qualificado' in src) = 0 then
    antes := src;
    src := replace(src,
      E'(select count(*) from l where l.st in (''em conversa'', ''interessado'', ''visita agendada'', ''documentacao'',\n        ''doc aprovada'', ''negociacao'', ''ja comprou'', ''vendido'', ''vendido!'')\n        or exists (select 1 from public.visitas x where x.lead_id = l.id and x.deleted_at is null))',
      E'(select count(*) from l where private.lead_qualificado(l.st,\n        exists (select 1 from public.visitas x where x.lead_id = l.id and x.deleted_at is null)))');
    if src = antes then raise exception 'painel_numeros não ajustado'; end if;
    execute src;
  end if;

  src := pg_get_functiondef('public.painel_apresentacao(date,date)'::regprocedure);
  if position('lead_qualificado' in src) = 0 then
    antes := src;
    src := replace(src,
      E'(l.st in (''em conversa'', ''interessado'', ''visita agendada'', ''documentacao'', ''doc aprovada'', ''negociacao'',\n        ''ja comprou'', ''vendido'', ''vendido!'')\n      or exists (select 1 from public.visitas x where x.lead_id = l.id and x.deleted_at is null)) as qualificado',
      E'private.lead_qualificado(l.st,\n        exists (select 1 from public.visitas x where x.lead_id = l.id and x.deleted_at is null)) as qualificado');
    if src = antes then raise exception 'painel_apresentacao não ajustado'; end if;
    execute src;
  end if;
end $do$;
