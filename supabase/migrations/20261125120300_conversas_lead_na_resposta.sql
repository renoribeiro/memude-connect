-- MeMude Conversas — conversa que começou pelo celular do número (sem lead):
-- quando o cliente responde, liga ao lead do mesmo telefone ou cria um lead novo.
do $do$
declare src text;
begin
  src := pg_get_functiondef('public.conv_registrar_mensagem(jsonb)'::regprocedure);
  if position('lead_na_resposta' in src) = 0 then
    src := replace(src, $a$  if v_dir = 'saida' and v_wa is not null then$a$,
$a$  if c.lead_id is null and v_dir = 'entrada' then /* lead_na_resposta */
    select id into v_lead from public.leads where telefone_chave = v_chave and deleted_at is null
      order by telefone_chave_conflito, created_at limit 1;
    if v_lead is null then
      perform set_config('memude.fase1', '1', true);
      insert into public.leads (nome, telefone, fonte, status_atendimento, origem, data_entrada)
      values (coalesce(v_nome, c.nome_contato, 'Contato ' || right(v_tel, 4)), v_tel, private.conv_fonte_por_texto(v_texto), 'NOVO',
              'conversas', (v_quando at time zone 'America/Fortaleza')::date)
      returning id into v_lead;
    end if;
    update public.conversas set lead_id = v_lead where id = c.id returning * into c;
  end if;

  if v_dir = 'saida' and v_wa is not null then$a$);
    if position('lead_na_resposta' in src) = 0 then raise exception 'Ajuste de conv_registrar_mensagem não aplicado'; end if;
    execute src;
  end if;
end $do$;
