-- App do corretor: "próxima visita" só considera visitas de hoje em diante (visita antiga não fechada não aparece como próxima)
do $do$
declare src text;
begin
  src := pg_get_functiondef('public.corretor_meus_clientes()'::regprocedure);
  if position('proxima_de_hoje' in src) = 0 then
    src := replace(src, $a$where v.lead_id = c.lead_id and v.deleted_at is null and v.status in ('aguardando_corretor', 'agendada', 'confirmada')$a$,
      $a$where v.lead_id = c.lead_id and v.deleted_at is null and v.status in ('aguardando_corretor', 'agendada', 'confirmada')
       and v.data_visita >= (now() at time zone 'America/Fortaleza')::date /* proxima_de_hoje */$a$);
    if position('proxima_de_hoje' in src) = 0 then raise exception 'Ajuste de corretor_meus_clientes não aplicado'; end if;
    execute src;
  end if;
end $do$;
