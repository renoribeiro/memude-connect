-- MeMude Conversas — ajustes das telas
-- 1) Aceitar "imóveis que combinam": o escolhido vira o interesse do lead (com histórico)
do $do$
declare src text;
begin
  src := pg_get_functiondef('public.ia_sugestao_decidir(uuid,boolean,jsonb)'::regprocedure);
  if position('interesse_escolhido' in src) = 0 then
    src := replace(src, $a$'Sugerido pela IA nas conversas');$a$,
$a$'Sugerido pela IA nas conversas');
    elsif s.tipo = 'empreendimento' and c.lead_id is not null and v->>'escolhido' ~ '^[0-9a-f-]{36}$' then /* interesse_escolhido */
      update public.leads l set empreendimento_id = (v->>'escolhido')::uuid
      where l.id = c.lead_id and l.deleted_at is null
        and exists (select 1 from public.empreendimentos e where e.id = (v->>'escolhido')::uuid);
      insert into public.lead_eventos (lead_id, tipo, campo, para, observacao, ator_id)
      select c.lead_id, 'alteracao', 'Interesse (IA, confirmado)', e.nome, 'Escolhido entre os imóveis sugeridos nas conversas', u
      from public.empreendimentos e where e.id = (v->>'escolhido')::uuid;$a$);
    if position('interesse_escolhido' in src) = 0 then raise exception 'Ajuste de ia_sugestao_decidir não aplicado'; end if;
    execute src;
  end if;
end $do$;

-- 2) Quem atende a conversa (ex.: corretor) enxerga o lead daquele cliente — só leitura, só dos seus clientes
drop policy if exists "Conversas: dono da conversa vê o lead" on public.leads;
create policy "Conversas: dono da conversa vê o lead" on public.leads for select to authenticated
  using (exists (select 1 from public.conversas c where c.lead_id = leads.id and c.dono_id = (select auth.uid())));

-- 3) Defesa em profundidade: tabelas das conversas fora do alcance do anônimo; usuário logado só lê (escrita só pelas funções)
revoke all on public.conv_numeros, public.conversas, public.mensagens, public.conversa_leituras, public.conversa_donos,
  public.respostas_rapidas, public.ia_sugestoes, public.conv_alertas, public.push_inscricoes from anon;
revoke insert, update, delete, truncate, references, trigger on public.conv_numeros, public.conversas, public.mensagens,
  public.conversa_leituras, public.conversa_donos, public.respostas_rapidas, public.ia_sugestoes, public.conv_alertas,
  public.push_inscricoes from authenticated;

-- 4) Índices das chaves usadas nas telas (alertas por conversa/responsável, desempenho por autor, exclusões em cascata)
create index if not exists conv_alertas_conversa_idx on public.conv_alertas (conversa_id);
create index if not exists conv_alertas_responsavel_idx on public.conv_alertas (responsavel_id, criado_em desc);
create index if not exists conv_alertas_lead_idx on public.conv_alertas (lead_id);
create index if not exists ia_sugestoes_lead_idx on public.ia_sugestoes (lead_id);
create index if not exists mensagens_autor_idx on public.mensagens (autor_id, criado_em desc) where autor_id is not null;
create index if not exists conversa_donos_dono_idx on public.conversa_donos (dono_id);
create index if not exists conversa_leituras_user_idx on public.conversa_leituras (user_id);
create index if not exists respostas_rapidas_dono_idx on public.respostas_rapidas (dono_id);
