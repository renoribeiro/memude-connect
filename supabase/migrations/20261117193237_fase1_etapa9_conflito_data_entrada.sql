-- Fase 1 Leads e Visitas (core.memude) — aplicada em produção em 20261117

do $$
declare d text;
begin
  d := pg_get_functiondef('public.planilha_importar_lote(text,jsonb)'::regprocedure);
  d := replace(d,
    '          res := res || jsonb_build_object(''linha'', v_linha, ''id'', v_lead_id,
            ''acao'', case when v_diffs > 0 then ''conflito'' else ''existente'' end, ''conflitos'', v_diffs);',
    '          if private.f1_data_br(v->>''entrada'') is not null and private.f1_data_br(v->>''entrada'') <> v_lead.data_entrada then
            insert into public.import_conflitos (aba, linha, telefone_chave, lead_id, campo, valor_core, valor_planilha, dados_planilha)
            values (p_aba, v_linha, v_chave, v_lead_id, ''Entrada'', to_char(v_lead.data_entrada, ''DD/MM/YYYY''), v->>''entrada'', v);
            v_diffs := v_diffs + 1;
          end if;
          res := res || jsonb_build_object(''linha'', v_linha, ''id'', v_lead_id,
            ''acao'', case when v_diffs > 0 then ''conflito'' else ''existente'' end, ''conflitos'', v_diffs);');
  if position('''Entrada''' in d) = 0 then raise exception 'Ajuste não aplicado'; end if;
  execute d;
end $$;
;
