-- Puxa da planilha (abas VISITAS e LEADS) o status atual e o resultado das visitas para registros que já existem no core.
-- A função public.planilha_puxar foi criada aqui e substituída na migration seguinte (20261118165556), que é a versão vigente.

create schema if not exists backup_20261118;

-- Status da planilha -> status do core (vocabulário usado pela equipe na aba VISITAS)
create or replace function private.f1_status_visita_planilha(p_raw text)
returns text language sql immutable set search_path = '' as $$
  select case
    when private.f1_norm(p_raw) in ('aguardando corretor') then 'aguardando_corretor'
    when private.f1_norm(p_raw) in ('agendada', 'visita agendada') then 'agendada'
    when private.f1_norm(p_raw) in ('confirmada', 'visita confirmada') then 'confirmada'
    when private.f1_norm(p_raw) in ('realizada', 'visita realizada', 'comprou', 'vendemos', 'venda realizada', 'finalizado!',
      'finalizado', 'doc aprovada', 'documentacao', 'negociacao', 'pendente comissao', 'aguardando assinatura',
      'seguiu com outro imovel', 'vendido', 'vendido!') then 'realizada'
    when private.f1_norm(p_raw) in ('no-show', 'no show', 'noshow', 'nao compareceu', 'nao realizada', 'lead furou',
      'tentando remarcar', 'visita nao realizada') then 'no_show'
    when private.f1_norm(p_raw) in ('reagendada') then 'reagendada'
    when private.f1_norm(p_raw) in ('cancelada', 'cancelado', 'desistencia', 'desistiu') then 'cancelada'
  end;
$$;

create or replace function private.f1_status_lead_planilha(p_raw text)
returns text language sql immutable set search_path = '' as $$
  select case private.f1_norm(p_raw)
    when 'novo' then 'NOVO' when 'em conversa' then 'EM CONVERSA' when 'interessado' then 'INTERESSADO'
    when 'visita agendada' then 'VISITA AGENDADA' when 'investidor' then 'INVESTIDOR' when 'corretor' then 'CORRETOR'
    when 'sem renda' then 'SEM RENDA' when 'nao interessado' then 'NÃO INTERESSADO' end;
$$;

-- Backup aplicado antes da primeira atualização (18/11/2026):
-- backup_20261118.visitas_pre_puxar e backup_20261118.leads_pre_puxar
