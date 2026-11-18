-- public.planilha_puxar: puxa da planilha o status (e o resultado das visitas) dos registros que já existem no core.
-- Usada pela edge function sheets-espelho, modo "puxar" (simulação por padrão; aplica só com aplicar=true).
-- Sem session_replication_role (bloqueado no Supabase): usa os sinalizadores da Fase 1 (sem robô e sem card novo no
-- CRM) e trata cada linha isoladamente — uma linha recusada pela validação não interrompe as demais.
create or replace function public.planilha_puxar(p_aba text, p_linhas jsonb, p_aplicar boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r jsonb; v_id uuid; v_raw text; v_novo text; v_fu text; v_dv date; v_tent int;
  vis public.visitas; ld public.leads; v_render text;
  c jsonb := jsonb_build_object('lidas', 0, 'sem_registro', 0, 'status', 0, 'rotulo', 0, 'resultado', 0, 'data_venda', 0,
    'tentativas', 0, 'resultado_em_conflito', 0, 'status_desconhecido', 0, 'recusadas', 0);
  amostras jsonb := '[]'::jsonb; desconhecidos jsonb := '{}'::jsonb; recusas jsonb := '[]'::jsonb;
  mudou boolean;
begin
  if p_aba not in ('VISITAS', 'LEADS') then raise exception 'Aba inválida' using errcode = '22023'; end if;
  perform set_config('memude.fase1', '1', true);
  perform set_config('memude.reagendamento', '1', true);

  for r in select * from jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) loop
    c := jsonb_set(c, '{lidas}', to_jsonb((c->>'lidas')::int + 1));
    begin v_id := (r->>'id')::uuid; exception when others then v_id := null; end;
    v_raw := nullif(btrim(coalesce(r->>'status', '')), '');

    begin
      if p_aba = 'VISITAS' then
        select * into vis from public.visitas where id = v_id and deleted_at is null;
        if not found then c := jsonb_set(c, '{sem_registro}', to_jsonb((c->>'sem_registro')::int + 1)); continue; end if;
        mudou := false;
        v_novo := private.f1_status_visita_planilha(v_raw);
        if v_raw is not null and v_novo is null then
          c := jsonb_set(c, '{status_desconhecido}', to_jsonb((c->>'status_desconhecido')::int + 1));
          desconhecidos := jsonb_set(desconhecidos, array[v_raw], to_jsonb(coalesce((desconhecidos->>v_raw)::int, 0) + 1));
        end if;
        if v_novo is not null and v_novo <> vis.status then
          c := jsonb_set(c, '{status}', to_jsonb((c->>'status')::int + 1)); mudou := true;
          if jsonb_array_length(amostras) < 25 then
            amostras := amostras || jsonb_build_object('id', vis.id, 'de', vis.status, 'para', v_novo, 'planilha', v_raw);
          end if;
          if p_aplicar then update public.visitas set status = v_novo where id = vis.id; end if;
        end if;
        if v_raw is not null and (v_raw is distinct from public.sheet_status_visita(coalesce(v_novo, vis.status)))
           and (vis.planilha_extra->>'status_label') is distinct from v_raw then
          c := jsonb_set(c, '{rotulo}', to_jsonb((c->>'rotulo')::int + 1)); mudou := true;
          if p_aplicar then
            update public.visitas set planilha_extra = coalesce(planilha_extra, '{}'::jsonb) || jsonb_build_object('status_label', v_raw)
            where id = vis.id;
          end if;
        elsif v_raw is not null and v_raw = public.sheet_status_visita(coalesce(v_novo, vis.status)) and vis.planilha_extra ? 'status_label' then
          c := jsonb_set(c, '{rotulo}', to_jsonb((c->>'rotulo')::int + 1)); mudou := true;
          if p_aplicar then
            update public.visitas set planilha_extra = nullif(planilha_extra - 'status_label', '{}'::jsonb) where id = vis.id;
          end if;
        end if;
        v_fu := nullif(btrim(coalesce(r->>'follow up lucas', '')), '');
        v_render := nullif(private.sheet_linha_visita(vis.id)->>'follow up lucas', '');
        if v_fu is not null and v_fu is distinct from v_render then
          if vis.avaliacao_lead is null and nullif(vis.feedback_corretor, '') is null and nullif(vis.proximo_passo, '') is null then
            c := jsonb_set(c, '{resultado}', to_jsonb((c->>'resultado')::int + 1)); mudou := true;
            if p_aplicar then update public.visitas set comentarios_lead = left(v_fu, 4000) where id = vis.id; end if;
          else
            c := jsonb_set(c, '{resultado_em_conflito}', to_jsonb((c->>'resultado_em_conflito')::int + 1));
          end if;
        end if;
        v_dv := private.f1_data_br(r->>'data venda');
        if v_dv is not null and v_dv is distinct from vis.data_venda then
          c := jsonb_set(c, '{data_venda}', to_jsonb((c->>'data_venda')::int + 1)); mudou := true;
          if p_aplicar then update public.visitas set data_venda = v_dv where id = vis.id; end if;
        end if;
        if coalesce(r->>'follow up no show', '') ~ '^\d+$' then
          v_tent := (r->>'follow up no show')::int;
          if v_tent is distinct from vis.tentativas_remarcar then
            c := jsonb_set(c, '{tentativas}', to_jsonb((c->>'tentativas')::int + 1)); mudou := true;
            if p_aplicar then update public.visitas set tentativas_remarcar = v_tent where id = vis.id; end if;
          end if;
        end if;
        if p_aplicar and mudou then
          update public.visit_cycles cy set
            outcome = case v.status when 'realizada' then 'held' when 'no_show' then 'not_held' else 'cancelled' end,
            match_status = 'closed', updated_at = now()
          from public.visitas v where v.id = vis.id and cy.visita_id = v.id and v.status in ('realizada','no_show','cancelada')
            and cy.outcome is distinct from case v.status when 'realizada' then 'held' when 'no_show' then 'not_held' else 'cancelled' end;
          update public.tarefas t set status = 'cancelada', concluida_em = now(),
            observacao = 'Atualização pela planilha: visita já encerrada'
          from public.visitas v where v.id = vis.id and t.visita_id = v.id and t.status = 'pendente'
            and v.status in ('realizada','no_show','cancelada') and t.tipo in ('aceite_corretor','confirmacao_d2','confirmacao_d1','confirmacao_d0');
        end if;

      else -- LEADS
        select * into ld from public.leads where id = v_id and deleted_at is null;
        if not found then c := jsonb_set(c, '{sem_registro}', to_jsonb((c->>'sem_registro')::int + 1)); continue; end if;
        v_novo := private.f1_status_lead_planilha(v_raw);
        if v_novo is not null and (v_novo <> ld.status_atendimento or ld.planilha_extra ? 'status_label') then
          c := jsonb_set(c, '{status}', to_jsonb((c->>'status')::int + 1));
          if jsonb_array_length(amostras) < 25 then
            amostras := amostras || jsonb_build_object('id', ld.id, 'de', coalesce(ld.planilha_extra->>'status_label', ld.status_atendimento), 'para', v_novo);
          end if;
          if p_aplicar then
            update public.leads set status_atendimento = v_novo, updated_at = now(),
              planilha_extra = nullif(coalesce(planilha_extra, '{}'::jsonb) - 'status_label', '{}'::jsonb)
            where id = ld.id;
          end if;
        elsif v_novo is null and v_raw is not null and (ld.planilha_extra->>'status_label') is distinct from v_raw then
          c := jsonb_set(c, '{rotulo}', to_jsonb((c->>'rotulo')::int + 1));
          desconhecidos := jsonb_set(desconhecidos, array[v_raw], to_jsonb(coalesce((desconhecidos->>v_raw)::int, 0) + 1));
          if jsonb_array_length(amostras) < 25 then
            amostras := amostras || jsonb_build_object('id', ld.id, 'de', coalesce(ld.planilha_extra->>'status_label', ld.status_atendimento), 'para', v_raw);
          end if;
          if p_aplicar then
            update public.leads set updated_at = now(),
              planilha_extra = coalesce(planilha_extra, '{}'::jsonb) || jsonb_build_object('status_label', v_raw)
            where id = ld.id;
          end if;
        end if;
      end if;
    exception when others then
      c := jsonb_set(c, '{recusadas}', to_jsonb((c->>'recusadas')::int + 1));
      if jsonb_array_length(recusas) < 20 then
        recusas := recusas || jsonb_build_object('id', v_id, 'planilha', v_raw, 'motivo', left(sqlerrm, 200));
      end if;
    end;
  end loop;

  return jsonb_build_object('aba', p_aba, 'aplicado', p_aplicar, 'contagem', c, 'rotulos_fora_do_padrao', desconhecidos,
    'exemplos', amostras, 'recusas', recusas);
end $$;
revoke all on function public.planilha_puxar(text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.planilha_puxar(text, jsonb, boolean) to service_role;
