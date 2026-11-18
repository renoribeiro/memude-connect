-- Kanban acompanha a visita (pedido do Ramon em 18/11/2026):
--  visita agendada  -> card do cliente vai para "Visita Agendada"
--  visita realizada -> card vai para "Visita Realizada"
-- Só avança (nunca puxa de volta um card que já está mais adiante) e reaproveita o card aberto do cliente,
-- em vez de criar um card novo por visita no Bolsão.

create or replace function private.crm_mover_por_visita(p_visita uuid, p_alvo text, p_pode_criar boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.visitas; v_pipe uuid; v_stage uuid; v_pos int;
  c_id uuid; c_pos int; c_visita uuid;
begin
  select * into v from public.visitas where id = p_visita;
  if not found or v.deleted_at is not null or v.lead_id is null then return; end if;

  select id into v_pipe from public.crm_pipelines
  where is_default = true and auto_add_visits = true order by created_at, id limit 1;
  if v_pipe is null then return; end if;

  select id, posicao into v_stage, v_pos from public.crm_stages
  where pipeline_id = v_pipe and private.f1_norm(nome) = p_alvo order by posicao limit 1;
  if v_stage is null then return; end if;

  -- Card aberto do cliente: o da própria visita primeiro, depois o mais recente
  select c.id, s.posicao, c.visita_id into c_id, c_pos, c_visita
  from public.crm_leads c join public.crm_stages s on s.id = c.stage_id
  where c.pipeline_id = v_pipe and c.lead_id = v.lead_id
    and c.archived_at is null and c.completed_at is null and c.venda_id is null
  order by (c.visita_id = v.id) desc nulls last, c.updated_at desc
  limit 1;

  if c_id is not null then
    if c_pos < v_pos then
      update public.crm_leads set
        stage_id = v_stage,
        posicao = coalesce((select max(posicao) + 1 from public.crm_leads where stage_id = v_stage), 0),
        visita_id = case when c_visita is null and not exists (
            select 1 from public.crm_leads o where o.pipeline_id = v_pipe and o.visita_id = v.id) then v.id else visita_id end,
        empreendimento_id = coalesce(empreendimento_id, v.empreendimento_id),
        moved_at = now(), updated_at = now()
      where id = c_id;
    end if;
  elsif p_pode_criar then
    insert into public.crm_leads (lead_id, pipeline_id, stage_id, empreendimento_id, visita_id, posicao)
    values (v.lead_id, v_pipe, v_stage, v.empreendimento_id, v.id,
      coalesce((select max(posicao) + 1 from public.crm_leads where stage_id = v_stage), 0))
    on conflict (pipeline_id, visita_id) where visita_id is not null do nothing;
  end if;
end $$;
revoke all on function private.crm_mover_por_visita(uuid, text, boolean) from public, anon, authenticated;

-- Criação da visita (substitui o "card novo no Bolsão" por visita)
create or replace function public.auto_add_lead_to_crm()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Importações e reagendamentos (memude.reagendamento) só movem o card existente; não criam card novo.
  perform private.crm_mover_por_visita(NEW.id,
    case when NEW.status = 'realizada' then 'visita realizada'
         when NEW.status in ('aguardando_corretor', 'agendada', 'confirmada') then 'visita agendada' end,
    coalesce(current_setting('memude.reagendamento', true), '') <> '1')
  where NEW.status in ('realizada', 'aguardando_corretor', 'agendada', 'confirmada');
  return NEW;
end $$;

-- Mudança de status da visita
create or replace function private.crm_visita_status_kanban()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if NEW.status = 'realizada' then
    perform private.crm_mover_por_visita(NEW.id, 'visita realizada', true);
  elsif NEW.status in ('aguardando_corretor', 'agendada', 'confirmada')
        and OLD.status not in ('aguardando_corretor', 'agendada', 'confirmada') then
    perform private.crm_mover_por_visita(NEW.id, 'visita agendada', true);
  end if;
  return NEW;
end $$;

drop trigger if exists crm_kanban_status_visita on public.visitas;
create trigger crm_kanban_status_visita
  after update of status on public.visitas
  for each row when (OLD.status is distinct from NEW.status)
  execute function private.crm_visita_status_kanban();
