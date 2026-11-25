-- ============================================================
-- MeMude Conversas — plataforma de atendimento (WhatsApp via Evolution)
-- Números próprios (não mexe nas instâncias do robô), conversas por cliente e número,
-- mensagens com mídia, dono da conversa (SDR → corretor → closer), notas internas,
-- sugestões da IA (só sugere), alertas ao closer e notificações (web push).
--
-- Quem vê o quê:
--   corretor → só as conversas em que ele é o dono;
--   equipe comercial (admin/sdr/closer) → todas.
-- Toda escrita passa por funções com verificação de papel (padrão do SECURITY.md).
-- ============================================================

-- ---------- Números (instâncias Evolution da plataforma) ----------
create table if not exists public.conv_numeros (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 60),
  instancia text not null unique check (instancia ~ '^conversas-[a-z0-9-]{2,40}$'),
  telefone text,
  status text not null default 'conectando' check (status in ('conectando', 'aberto', 'desconectado')),
  papel text not null default 'principal' check (papel in ('principal', 'backup')),
  ativo boolean not null default true,
  ultimo_evento_em timestamptz,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null
);

-- ---------- Conversas ----------
create table if not exists public.conversas (
  id uuid primary key default gen_random_uuid(),
  numero_id uuid not null references public.conv_numeros(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  telefone text not null,
  telefone_chave text not null,
  jid text not null,
  nome_contato text,
  dono_id uuid references auth.users(id) on delete set null,
  dono_papel text not null default 'sdr' check (dono_papel in ('sdr', 'corretor', 'closer')),
  etapa text not null default 'novo' check (etapa in ('novo', 'em_atendimento', 'visita_marcada', 'visitou', 'proposta', 'documentacao', 'vendido', 'perdido')),
  ultima_mensagem_em timestamptz,
  ultima_previa text,
  ultima_direcao text check (ultima_direcao in ('entrada', 'saida', 'nota')),
  aguardando_desde timestamptz,           -- 1ª mensagem do cliente ainda sem resposta
  resumo_ia text,
  temperatura text check (temperatura in ('quente', 'morno', 'frio')),
  ia_pendente_desde timestamptz,          -- há mensagens novas para a IA analisar
  ia_analisada_em timestamptz,
  arquivada boolean not null default false,
  criada_em timestamptz not null default now(),
  unique (numero_id, telefone_chave)
);
create index if not exists conversas_lista_idx on public.conversas (ultima_mensagem_em desc nulls last) where not arquivada;
create index if not exists conversas_dono_idx on public.conversas (dono_id, ultima_mensagem_em desc);
create index if not exists conversas_lead_idx on public.conversas (lead_id);
create index if not exists conversas_ia_idx on public.conversas (ia_pendente_desde) where ia_pendente_desde is not null;
create index if not exists conversas_sla_idx on public.conversas (aguardando_desde) where aguardando_desde is not null;

-- ---------- Mensagens ----------
create table if not exists public.mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  wa_id text,
  direcao text not null check (direcao in ('entrada', 'saida', 'nota')),
  tipo text not null default 'texto' check (tipo in ('texto', 'imagem', 'audio', 'video', 'documento', 'figurinha', 'localizacao', 'contato', 'reacao', 'sistema')),
  texto text check (char_length(texto) <= 8000),
  midia_path text,
  midia_mime text,
  midia_nome text,
  midia_bytes integer,
  duracao_s integer,
  transcricao text,
  autor_id uuid references auth.users(id) on delete set null,
  autor_nome text,
  origem text not null default 'cliente' check (origem in ('cliente', 'app', 'celular', 'sistema')),
  status text not null default 'recebida' check (status in ('recebida', 'pendente', 'enviada', 'entregue', 'lida', 'erro')),
  erro text,
  responde_a uuid references public.mensagens(id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (conversa_id, wa_id)
);
create index if not exists mensagens_conversa_idx on public.mensagens (conversa_id, criado_em desc);
create index if not exists mensagens_wa_idx on public.mensagens (wa_id) where wa_id is not null;
create index if not exists mensagens_transcrever_idx on public.mensagens (criado_em) where tipo = 'audio' and transcricao is null;

-- ---------- Leitura, histórico de dono, respostas rápidas ----------
create table if not exists public.conversa_leituras (
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  lida_em timestamptz not null default now(),
  primary key (conversa_id, user_id)
);

create table if not exists public.conversa_donos (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  dono_id uuid references auth.users(id) on delete set null,
  dono_papel text not null,
  motivo text not null,
  ator_id uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists conversa_donos_idx on public.conversa_donos (conversa_id, criado_em desc);

create table if not exists public.respostas_rapidas (
  id uuid primary key default gen_random_uuid(),
  atalho text not null check (atalho ~ '^[a-z0-9-]{2,30}$'),
  titulo text not null check (char_length(titulo) between 2 and 60),
  texto text not null check (char_length(texto) between 2 and 2000),
  dono_id uuid references auth.users(id) on delete cascade,   -- null = da equipe toda
  criado_em timestamptz not null default now()
);
create unique index if not exists respostas_rapidas_atalho_idx on public.respostas_rapidas (coalesce(dono_id, '00000000-0000-0000-0000-000000000000'::uuid), atalho);

-- ---------- IA: sugestões (nunca aplica sozinha) ----------
create table if not exists public.ia_sugestoes (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  tipo text not null check (tipo in ('crm', 'etapa', 'resposta', 'empreendimento', 'lembrete')),
  titulo text not null,
  conteudo jsonb not null default '{}'::jsonb,
  status text not null default 'aberta' check (status in ('aberta', 'aceita', 'descartada', 'substituida')),
  criada_em timestamptz not null default now(),
  decidida_por uuid references auth.users(id) on delete set null,
  decidida_em timestamptz
);
create index if not exists ia_sugestoes_abertas_idx on public.ia_sugestoes (conversa_id, tipo) where status = 'aberta';

-- ---------- Alertas (closer e dono) ----------
create table if not exists public.conv_alertas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('sem_resposta', 'pos_visita_esquecido', 'sinal_compra', 'contato_pessoal', 'numero_caiu')),
  conversa_id uuid references public.conversas(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  responsavel_id uuid references auth.users(id) on delete set null,   -- quem deveria agir (ex.: corretor)
  titulo text not null,
  detalhe text,
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por uuid references auth.users(id) on delete set null
);
create index if not exists conv_alertas_abertos_idx on public.conv_alertas (criado_em desc) where resolvido_em is null;
create unique index if not exists conv_alertas_unico_aberto on public.conv_alertas (tipo, conversa_id) where resolvido_em is null and conversa_id is not null;

-- ---------- Notificações (web push) ----------
create table if not exists public.push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  user_agent text,
  criado_em timestamptz not null default now(),
  ultimo_uso_em timestamptz
);
create index if not exists push_inscricoes_user_idx on public.push_inscricoes (user_id);

-- ============================================================
-- Funções de apoio
-- ============================================================
create or replace function private.conv_user_corretor(p_user uuid)
returns uuid language sql stable security definer set search_path to '' as $$
  select c.id from public.corretores c join public.profiles p on p.id = c.profile_id
  where p.user_id = p_user and c.deleted_at is null limit 1;
$$;

create or replace function private.conv_nome_usuario(p_user uuid)
returns text language sql stable security definer set search_path to '' as $$
  select nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '') from public.profiles where user_id = p_user limit 1;
$$;

-- Quem pode ver a conversa: equipe comercial vê todas; corretor só as que são dele
create or replace function private.conv_pode_ver(p_conversa uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select private.is_comercial() or exists (
    select 1 from public.conversas c where c.id = p_conversa and c.dono_id = (select auth.uid()));
$$;

-- Quem pode responder: o dono, ou a equipe comercial
create or replace function private.conv_pode_responder(p_conversa uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select private.is_comercial() or exists (
    select 1 from public.conversas c where c.id = p_conversa and c.dono_id = (select auth.uid()));
$$;

create or replace function private.conv_exigir_ver(p_conversa uuid)
returns uuid language plpgsql stable security definer set search_path to '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Faça login' using errcode = '42501'; end if;
  if not private.conv_pode_ver(p_conversa) then raise exception 'Conversa não encontrada' using errcode = 'P0002'; end if;
  return u;
end $$;

-- Troca de dono (registra no histórico)
create or replace function private.conv_trocar_dono(p_conversa uuid, p_dono uuid, p_papel text, p_motivo text, p_ator uuid)
returns void language plpgsql security definer set search_path to '' as $$
begin
  update public.conversas set dono_id = p_dono, dono_papel = p_papel where id = p_conversa
    and (dono_id is distinct from p_dono or dono_papel is distinct from p_papel);
  if found then
    insert into public.conversa_donos (conversa_id, dono_id, dono_papel, motivo, ator_id)
    values (p_conversa, p_dono, p_papel, left(p_motivo, 200), p_ator);
  end if;
end $$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.conv_numeros enable row level security;
alter table public.conversas enable row level security;
alter table public.mensagens enable row level security;
alter table public.conversa_leituras enable row level security;
alter table public.conversa_donos enable row level security;
alter table public.respostas_rapidas enable row level security;
alter table public.ia_sugestoes enable row level security;
alter table public.conv_alertas enable row level security;
alter table public.push_inscricoes enable row level security;

create policy "Conversas: equipe e corretor leem números" on public.conv_numeros for select to authenticated
  using ((select private.is_comercial()) or (select private.conv_user_corretor((select auth.uid()))) is not null);
create policy "Conversas: ver a própria ou todas (equipe)" on public.conversas for select to authenticated
  using ((select private.is_comercial()) or dono_id = (select auth.uid()));
create policy "Conversas: mensagens de conversa visível" on public.mensagens for select to authenticated
  using (private.conv_pode_ver(conversa_id));
create policy "Conversas: minhas leituras" on public.conversa_leituras for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Conversas: histórico de dono visível" on public.conversa_donos for select to authenticated
  using (private.conv_pode_ver(conversa_id));
create policy "Conversas: respostas rápidas da equipe e minhas" on public.respostas_rapidas for select to authenticated
  using (dono_id is null or dono_id = (select auth.uid()));
create policy "Conversas: sugestões de conversa visível" on public.ia_sugestoes for select to authenticated
  using (private.conv_pode_ver(conversa_id));
create policy "Conversas: alertas da equipe ou meus" on public.conv_alertas for select to authenticated
  using ((select private.is_comercial()) or responsavel_id = (select auth.uid()));
create policy "Conversas: minhas inscrições de push" on public.push_inscricoes for select to authenticated
  using (user_id = (select auth.uid()));

-- Tempo real
do $$ begin
  begin alter publication supabase_realtime add table public.conversas; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.mensagens; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.ia_sugestoes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.conv_alertas; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.visita_convites; exception when duplicate_object then null; end;
end $$;

-- ============================================================
-- Armazenamento privado de mídia
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('conversas', 'conversas', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

-- Leitura: quem vê a conversa (pasta = id da conversa). Upload de saída: pasta "saida/<user>/".
create policy "Conversas: ler mídia de conversa visível" on storage.objects for select to authenticated
  using (bucket_id = 'conversas' and (
    ((storage.foldername(name))[1] = 'saida' and (storage.foldername(name))[2] = (select auth.uid())::text)
    or ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and private.conv_pode_ver(((storage.foldername(name))[1])::uuid))));
create policy "Conversas: enviar mídia própria" on storage.objects for insert to authenticated
  with check (bucket_id = 'conversas' and (storage.foldername(name))[1] = 'saida'
    and (storage.foldername(name))[2] = (select auth.uid())::text);

-- ============================================================
-- RPCs da tela
-- ============================================================

-- Lista de conversas com não lidas do usuário, SLA e dados do lead
create or replace function public.conversas_listar(p_filtro text default 'todas', p_busca text default null, p_limite int default 200)
returns table (
  id uuid, numero_id uuid, numero_nome text, numero_status text, lead_id uuid, lead_nome text, lead_status text,
  telefone text, nome_contato text, dono_id uuid, dono_nome text, dono_papel text, etapa text,
  ultima_mensagem_em timestamptz, ultima_previa text, ultima_direcao text, aguardando_desde timestamptz,
  nao_lidas int, temperatura text, resumo_ia text, sugestoes_abertas int, alertas_abertos int, arquivada boolean
) language plpgsql stable security definer set search_path to '' as $$
declare u uuid := auth.uid(); equipe boolean := private.is_comercial(); b text := nullif(btrim(coalesce(p_busca, '')), '');
begin
  if u is null then raise exception 'Faça login' using errcode = '42501'; end if;
  return query
  select c.id, c.numero_id, n.nome, n.status, c.lead_id, l.nome, l.status_atendimento,
    c.telefone, c.nome_contato, c.dono_id, private.conv_nome_usuario(c.dono_id), c.dono_papel, c.etapa,
    c.ultima_mensagem_em, c.ultima_previa, c.ultima_direcao, c.aguardando_desde,
    (select count(*)::int from public.mensagens m where m.conversa_id = c.id and m.direcao = 'entrada'
       and m.criado_em > coalesce((select r.lida_em from public.conversa_leituras r where r.conversa_id = c.id and r.user_id = u), '-infinity'::timestamptz)),
    c.temperatura, c.resumo_ia,
    (select count(*)::int from public.ia_sugestoes s where s.conversa_id = c.id and s.status = 'aberta'),
    (select count(*)::int from public.conv_alertas a where a.conversa_id = c.id and a.resolvido_em is null),
    c.arquivada
  from public.conversas c
  join public.conv_numeros n on n.id = c.numero_id
  left join public.leads l on l.id = c.lead_id
  where (equipe or c.dono_id = u)
    and (case p_filtro
          when 'minhas' then c.dono_id = u
          when 'sdr' then c.dono_papel = 'sdr' and not c.arquivada
          when 'corretores' then c.dono_papel = 'corretor' and not c.arquivada
          when 'sem_resposta' then c.aguardando_desde is not null and not c.arquivada
          when 'arquivadas' then c.arquivada
          else not c.arquivada end)
    and (b is null or c.nome_contato ilike '%' || b || '%' or l.nome ilike '%' || b || '%'
         or c.telefone like '%' || regexp_replace(b, '\D', '', 'g') || '%' and length(regexp_replace(b, '\D', '', 'g')) >= 4)
  order by c.ultima_mensagem_em desc nulls last
  limit least(greatest(coalesce(p_limite, 200), 1), 500);
end $$;

create or replace function public.conversa_marcar_lida(p_conversa uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare u uuid := private.conv_exigir_ver(p_conversa);
begin
  insert into public.conversa_leituras (conversa_id, user_id, lida_em) values (p_conversa, u, now())
  on conflict (conversa_id, user_id) do update set lida_em = excluded.lida_em;
end $$;

-- Assumir a conversa (equipe): a pessoa vira a dona
create or replace function public.conversa_assumir(p_conversa uuid)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare u uuid := private.f1_exigir_comercial(); papel text;
begin
  select case when private.has_role(u, 'closer'::public.app_role) then 'closer' else 'sdr' end into papel;
  perform private.conv_trocar_dono(p_conversa, u, papel, 'Assumiu a conversa', u);
  return jsonb_build_object('dono_id', u, 'dono_papel', papel);
end $$;

-- Passar a conversa para alguém (equipe): SDR (dono vazio), uma pessoa da equipe ou um corretor
create or replace function public.conversa_transferir(p_conversa uuid, p_para uuid, p_papel text, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare u uuid := private.f1_exigir_comercial();
begin
  if p_papel not in ('sdr', 'corretor', 'closer') then raise exception 'Papel inválido' using errcode = '22023'; end if;
  if p_papel = 'corretor' and (p_para is null or private.conv_user_corretor(p_para) is null) then
    raise exception 'Escolha um corretor com acesso ao app' using errcode = '22023';
  end if;
  perform private.conv_trocar_dono(p_conversa, p_para, p_papel, coalesce(nullif(btrim(p_motivo), ''), 'Transferida'), u);
  return jsonb_build_object('dono_id', p_para, 'dono_papel', p_papel);
end $$;

-- Nota interna (não vai para o cliente)
create or replace function public.conversa_nota(p_conversa uuid, p_texto text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare u uuid := private.conv_exigir_ver(p_conversa); t text := btrim(coalesce(p_texto, '')); v_id uuid;
begin
  if length(t) < 1 or length(t) > 4000 then raise exception 'Escreva a nota (até 4000 caracteres)' using errcode = '22023'; end if;
  insert into public.mensagens (conversa_id, direcao, tipo, texto, autor_id, autor_nome, origem, status)
  values (p_conversa, 'nota', 'texto', t, u, private.conv_nome_usuario(u), 'app', 'recebida') returning id into v_id;
  return v_id;
end $$;

create or replace function public.conversa_arquivar(p_conversa uuid, p_arquivar boolean)
returns void language plpgsql security definer set search_path to '' as $$
declare u uuid := private.conv_exigir_ver(p_conversa);
begin
  if not private.conv_pode_responder(p_conversa) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  update public.conversas set arquivada = coalesce(p_arquivar, false) where id = p_conversa;
end $$;

-- Funil do corretor (mini-kanban): quem responde a conversa move a etapa
create or replace function public.conversa_mover_etapa(p_conversa uuid, p_etapa text)
returns void language plpgsql security definer set search_path to '' as $$
declare u uuid := private.conv_exigir_ver(p_conversa);
begin
  if not private.conv_pode_responder(p_conversa) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if p_etapa not in ('novo', 'em_atendimento', 'visita_marcada', 'visitou', 'proposta', 'documentacao', 'vendido', 'perdido') then
    raise exception 'Etapa inválida' using errcode = '22023';
  end if;
  update public.conversas set etapa = p_etapa where id = p_conversa;
end $$;

-- Vincular a conversa a outro lead (equipe)
create or replace function public.conversa_vincular_lead(p_conversa uuid, p_lead uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare u uuid := private.f1_exigir_comercial();
begin
  if not exists (select 1 from public.leads where id = p_lead and deleted_at is null) then
    raise exception 'Lead não encontrado' using errcode = 'P0002';
  end if;
  update public.conversas set lead_id = p_lead where id = p_conversa;
end $$;

-- Sugestão da IA: aceitar (aplica no lead/conversa) ou descartar
create or replace function public.ia_sugestao_decidir(p_sugestao uuid, p_aceitar boolean, p_valor jsonb default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  u uuid := auth.uid(); s public.ia_sugestoes; c public.conversas; v jsonb; campos jsonb := '{}'::jsonb;
  quando timestamptz;
begin
  select * into s from public.ia_sugestoes where id = p_sugestao for update;
  if not found then raise exception 'Sugestão não encontrada' using errcode = 'P0002'; end if;
  perform private.conv_exigir_ver(s.conversa_id);
  if not private.conv_pode_responder(s.conversa_id) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if s.status <> 'aberta' then raise exception 'Esta sugestão já foi decidida' using errcode = '22023'; end if;
  select * into c from public.conversas where id = s.conversa_id;
  v := coalesce(p_valor, s.conteudo);

  if p_aceitar then
    perform set_config('memude.fase1', '1', true);
    if s.tipo = 'crm' and c.lead_id is not null then
      if v ? 'status_atendimento' then campos := campos || jsonb_build_object('status_atendimento', v->>'status_atendimento'); end if;
      if v ? 'empreendimento_id' then campos := campos || jsonb_build_object('empreendimento_id', v->>'empreendimento_id'); end if;
      if v ? 'qualificacao' and jsonb_typeof(v->'qualificacao') = 'object' then
        campos := campos || jsonb_build_object('qualificacao', v->'qualificacao');
      end if;
      update public.leads l set
        status_atendimento = coalesce(campos->>'status_atendimento', l.status_atendimento),
        empreendimento_id = coalesce(nullif(campos->>'empreendimento_id', '')::uuid, l.empreendimento_id),
        qualificacao = case when campos ? 'qualificacao'
          then jsonb_strip_nulls(coalesce(l.qualificacao, '{}'::jsonb) || (campos->'qualificacao') || jsonb_build_object('atualizado_em', now()))
          else l.qualificacao end
      where l.id = c.lead_id and l.deleted_at is null;
      insert into public.lead_eventos (lead_id, tipo, campo, para, observacao, ator_id)
      values (c.lead_id, 'alteracao', 'IA (confirmado)', left(s.titulo, 200), left(v::text, 1000), u);
    elsif s.tipo = 'etapa' and v ? 'etapa' then
      perform public.conversa_mover_etapa(c.id, v->>'etapa');
    elsif s.tipo = 'lembrete' and c.lead_id is not null then
      quando := coalesce(nullif(v->>'quando', '')::timestamptz, now() + interval '1 day');
      insert into public.tarefas (tipo, titulo, lead_id, dono_id, disponivel_em, vence_em, status, observacao)
      values ('atividade', left(coalesce(v->>'atividade', s.titulo), 200), c.lead_id, u, quando, quando + interval '1 hour', 'pendente',
        'Sugerido pela IA nas conversas');
    end if;
  end if;

  update public.ia_sugestoes set status = case when p_aceitar then 'aceita' else 'descartada' end,
    decidida_por = u, decidida_em = now(), conteudo = v where id = s.id;
  return jsonb_build_object('status', case when p_aceitar then 'aceita' else 'descartada' end);
end $$;

-- Alertas: resolver
create or replace function public.conv_alerta_resolver(p_alerta uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Faça login' using errcode = '42501'; end if;
  update public.conv_alertas set resolvido_em = now(), resolvido_por = u
  where id = p_alerta and resolvido_em is null and (private.is_comercial() or responsavel_id = u);
end $$;

-- Respostas rápidas (cada pessoa cria as suas; a equipe comercial cria as da equipe)
create or replace function public.resposta_rapida_salvar(p_id uuid, p_atalho text, p_titulo text, p_texto text, p_equipe boolean default false)
returns uuid language plpgsql security definer set search_path to '' as $$
declare u uuid := auth.uid(); v_id uuid; dono uuid;
begin
  if u is null then raise exception 'Faça login' using errcode = '42501'; end if;
  dono := case when coalesce(p_equipe, false) and private.is_comercial() then null else u end;
  if p_id is null then
    insert into public.respostas_rapidas (atalho, titulo, texto, dono_id)
    values (lower(btrim(p_atalho)), btrim(p_titulo), btrim(p_texto), dono) returning id into v_id;
  else
    update public.respostas_rapidas set atalho = lower(btrim(p_atalho)), titulo = btrim(p_titulo), texto = btrim(p_texto)
    where id = p_id and (dono_id = u or (dono_id is null and private.is_comercial())) returning id into v_id;
    if v_id is null then raise exception 'Resposta rápida não encontrada' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.resposta_rapida_excluir(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare u uuid := auth.uid();
begin
  delete from public.respostas_rapidas where id = p_id and (dono_id = u or (dono_id is null and private.is_comercial()));
end $$;

-- Notificações: inscrever/remover o aparelho
create or replace function public.push_inscrever(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void language plpgsql security definer set search_path to '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Faça login' using errcode = '42501'; end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 then raise exception 'Inscrição inválida' using errcode = '22023'; end if;
  insert into public.push_inscricoes (user_id, endpoint, p256dh, auth, user_agent)
  values (u, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update set user_id = u, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end $$;

create or replace function public.push_remover(p_endpoint text)
returns void language sql security definer set search_path to '' as $$
  delete from public.push_inscricoes where endpoint = p_endpoint and user_id = (select auth.uid());
$$;

-- ============================================================
-- Corretor: convites ("Cliente novo"), aceitar/recusar, clientes e desempenho
-- ============================================================
create or replace function public.corretor_meus_convites()
returns table (convite_id uuid, visita_id uuid, enviado_em timestamptz, prazo_em timestamptz, lead_nome text, empreendimento text,
  bairro text, data_visita date, horario_visita time, local_nome text, perfil text, renda text, fonte text)
language plpgsql stable security definer set search_path to '' as $$
declare cid uuid := private.conv_user_corretor(auth.uid()); prazo int;
begin
  if cid is null then raise exception 'Acesso do corretor não encontrado' using errcode = '42501'; end if;
  select coalesce(prazo_aceite_min, 15) into prazo from public.fase1_config where id;
  return query
  select vc.id, v.id, vc.enviado_em, vc.enviado_em + make_interval(mins => coalesce(prazo, 15)),
    l.nome, e.nome, coalesce(v.meeting_neighborhood, b.nome), v.data_visita, v.horario_visita,
    v.local_nome, v.customer_profile, l.qualificacao->>'renda', l.fonte
  from public.visita_convites vc
  join public.visitas v on v.id = vc.visita_id and v.deleted_at is null and v.status = 'aguardando_corretor'
  join public.leads l on l.id = v.lead_id
  left join public.empreendimentos e on e.id = v.empreendimento_id
  left join public.bairros b on b.id = e.bairro_id
  where vc.corretor_id = cid and vc.resposta is null
  order by vc.enviado_em;
end $$;

-- Mesmas regras do closer registrando a resposta (visita_resposta_corretor), feitas pelo próprio corretor
create or replace function public.corretor_responder_convite(p_convite uuid, p_aceitar boolean, p_observacao text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  u uuid := auth.uid(); cid uuid := private.conv_user_corretor(u);
  vc public.visita_convites; v public.visitas;
begin
  if cid is null then raise exception 'Acesso do corretor não encontrado' using errcode = '42501'; end if;
  select * into vc from public.visita_convites where id = p_convite for update;
  if not found or vc.corretor_id <> cid then raise exception 'Convite não encontrado' using errcode = 'P0002'; end if;
  if vc.resposta is not null then raise exception 'Este convite já foi respondido ou expirou' using errcode = '22023'; end if;
  perform set_config('memude.fase1', '1', true);
  v := private.f1_visita(vc.visita_id);
  if v.status <> 'aguardando_corretor' then raise exception 'Esta visita não está mais aguardando corretor' using errcode = '22023'; end if;

  if p_aceitar then
    perform private.f1_validar_corretor(cid, v.data_visita, v.horario_visita, v.id);
    update public.visita_convites set resposta = 'aceitou', respondido_em = now() where id = vc.id;
    update public.visit_cycles set match_status = 'accepted', broker_confirmed = true, updated_at = now() where visita_id = v.id;
    update public.visitas set corretor_id = cid where id = v.id and corretor_id is distinct from cid;
    perform private.f1_status(v.id, 'agendada', u, coalesce(p_observacao, 'Aceita pelo corretor no app'),
      jsonb_build_object('corretor_id', cid, 'corretor', private.f1_nome_corretor(cid), 'resposta', 'aceitou', 'via', 'app'));
    perform private.f1_fechar_tarefas(v.id, array['aceite_corretor'], 'concluida', u, 'Corretor aceitou no app');
    perform private.f1_tarefas_confirmacao(v.id);
    update public.leads set status = 'visita_agendada'::public.lead_status
    where id = v.lead_id and status::text in ('novo','buscando_corretor','corretor_designado','follow_up','cancelado');
    return jsonb_build_object('visita_id', v.id, 'status', 'agendada');
  end if;

  update public.visita_convites set resposta = 'recusou', respondido_em = now() where id = vc.id;
  update public.visitas set corretor_id = null where id = v.id;
  perform private.f1_evento(v.id, 'f1_resposta_corretor', jsonb_build_object('corretor_id', cid,
    'corretor', private.f1_nome_corretor(cid), 'resposta', 'recusou', 'via', 'app', 'observacao', p_observacao), u);
  perform private.f1_fechar_tarefas(v.id, array['aceite_corretor'], 'concluida', u, 'Corretor recusou no app');
  return jsonb_build_object('visita_id', v.id, 'status', 'aguardando_corretor', 'recusou', true);
end $$;

-- Ao aceitar (pelo app ou registrado pelo closer), as conversas do cliente passam para o corretor
create or replace function private.conv_dono_por_convite()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v public.visitas; uid uuid; c record;
begin
  if NEW.resposta is distinct from 'aceitou' or OLD.resposta is not distinct from 'aceitou' then return NEW; end if;
  select * into v from public.visitas where id = NEW.visita_id;
  select p.user_id into uid from public.corretores co join public.profiles p on p.id = co.profile_id where co.id = NEW.corretor_id;
  if v.lead_id is null or uid is null then return NEW; end if;
  for c in select id from public.conversas where lead_id = v.lead_id loop
    perform private.conv_trocar_dono(c.id, uid, 'corretor', 'Corretor aceitou a visita', auth.uid());
    update public.conversas set etapa = 'visita_marcada', arquivada = false where id = c.id and etapa in ('novo', 'em_atendimento');
  end loop;
  return NEW;
end $$;

drop trigger if exists conv_dono_por_convite on public.visita_convites;
create trigger conv_dono_por_convite after update of resposta on public.visita_convites
  for each row execute function private.conv_dono_por_convite();

-- Pós-visita: quem atende muda conforme o resultado (2.1 no-show e cancelada → SDR; realizada → segue com o corretor)
create or replace function private.conv_dono_por_visita()
returns trigger language plpgsql security definer set search_path to '' as $$
declare c record;
begin
  if NEW.lead_id is null or NEW.status is not distinct from OLD.status then return NEW; end if;
  for c in select id, dono_papel from public.conversas where lead_id = NEW.lead_id loop
    if NEW.status = 'realizada' then
      update public.conversas set etapa = 'visitou' where id = c.id and etapa in ('novo', 'em_atendimento', 'visita_marcada');
    elsif NEW.status in ('no_show', 'cancelada') and c.dono_papel = 'corretor' then
      perform private.conv_trocar_dono(c.id, null, 'sdr',
        case when NEW.status = 'no_show' then 'No-show: volta para a SDR remarcar' else 'Visita cancelada: volta para a SDR' end, auth.uid());
      update public.conversas set etapa = 'em_atendimento' where id = c.id and etapa in ('visita_marcada', 'visitou');
    end if;
  end loop;
  return NEW;
end $$;

drop trigger if exists conv_dono_por_visita on public.visitas;
create trigger conv_dono_por_visita after update of status on public.visitas
  for each row execute function private.conv_dono_por_visita();

-- Clientes do corretor (para o funil, a lista e "Hoje")
create or replace function public.corretor_meus_clientes()
returns table (conversa_id uuid, lead_id uuid, nome text, telefone text, etapa text, temperatura text, resumo_ia text,
  ultima_mensagem_em timestamptz, ultima_previa text, ultima_direcao text, aguardando_desde timestamptz,
  proxima_visita jsonb, empreendimento text)
language plpgsql stable security definer set search_path to '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Faça login' using errcode = '42501'; end if;
  return query
  select c.id, c.lead_id, coalesce(l.nome, c.nome_contato, c.telefone), c.telefone, c.etapa, c.temperatura, c.resumo_ia,
    c.ultima_mensagem_em, c.ultima_previa, c.ultima_direcao, c.aguardando_desde,
    (select jsonb_build_object('id', v.id, 'data', v.data_visita, 'hora', to_char(v.horario_visita, 'HH24:MI'), 'status', v.status,
        'empreendimento', e2.nome)
     from public.visitas v left join public.empreendimentos e2 on e2.id = v.empreendimento_id
     where v.lead_id = c.lead_id and v.deleted_at is null and v.status in ('aguardando_corretor', 'agendada', 'confirmada')
     order by v.data_visita, v.horario_visita limit 1),
    e.nome
  from public.conversas c
  left join public.leads l on l.id = c.lead_id
  left join public.empreendimentos e on e.id = l.empreendimento_id
  where c.dono_id = u and not c.arquivada
  order by c.ultima_mensagem_em desc nulls last;
end $$;

-- Desempenho (corretor vê o seu; a equipe vê todos)
create or replace function public.conversas_desempenho(p_dias int default 30)
returns table (user_id uuid, nome text, corretor_id uuid, conversas_ativas int, aguardando int, tempo_medio_resposta_min numeric,
  respondidas_15min_pct numeric, mensagens_enviadas int, visitas_agendadas int, visitas_realizadas int, vendas int,
  alertas_sem_resposta int, sem_contato_3d int)
language plpgsql stable security definer set search_path to '' as $$
declare u uuid := auth.uid(); equipe boolean := private.is_comercial(); desde timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_dias, 30), 180)));
begin
  if u is null then raise exception 'Faça login' using errcode = '42501'; end if;
  return query
  with corretores_app as (
    select co.id cid, p.user_id uid, nullif(btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), '') nome
    from public.corretores co join public.profiles p on p.id = co.profile_id
    where co.deleted_at is null and p.user_id is not null and (equipe or p.user_id = u)
  ),
  respostas as (   -- para cada mensagem do cliente, quanto tempo até a 1ª resposta seguinte do dono
    select c.dono_id uid, extract(epoch from (r.criado_em - m.criado_em)) / 60 minutos
    from public.mensagens m
    join public.conversas c on c.id = m.conversa_id
    join lateral (select r.criado_em from public.mensagens r where r.conversa_id = m.conversa_id and r.direcao = 'saida'
                  and r.criado_em > m.criado_em order by r.criado_em limit 1) r on true
    where m.direcao = 'entrada' and m.criado_em >= desde
      and not exists (select 1 from public.mensagens p2 where p2.conversa_id = m.conversa_id and p2.direcao = 'entrada'
                      and p2.criado_em < m.criado_em and p2.criado_em > coalesce((select max(s.criado_em) from public.mensagens s
                        where s.conversa_id = m.conversa_id and s.direcao = 'saida' and s.criado_em < m.criado_em), '-infinity'::timestamptz))
  )
  select ca.uid, ca.nome, ca.cid,
    (select count(*)::int from public.conversas c where c.dono_id = ca.uid and not c.arquivada),
    (select count(*)::int from public.conversas c where c.dono_id = ca.uid and c.aguardando_desde is not null),
    (select round(avg(r.minutos)::numeric, 1) from respostas r where r.uid = ca.uid),
    (select round(100.0 * count(*) filter (where r.minutos <= 15) / nullif(count(*), 0), 1) from respostas r where r.uid = ca.uid),
    (select count(*)::int from public.mensagens m where m.autor_id = ca.uid and m.direcao = 'saida' and m.criado_em >= desde),
    (select count(*)::int from public.visitas v where v.corretor_id = ca.cid and v.deleted_at is null and v.created_at >= desde),
    (select count(*)::int from public.visitas v where v.corretor_id = ca.cid and v.deleted_at is null and v.status = 'realizada' and v.data_visita >= desde::date),
    (select count(*)::int from public.vendas ve where ve.corretor_id = ca.cid and ve.data_venda >= desde::date and ve.status::text <> 'cancelada'),
    (select count(*)::int from public.conv_alertas a where a.responsavel_id = ca.uid and a.tipo = 'sem_resposta' and a.criado_em >= desde),
    (select count(*)::int from public.conversas c where c.dono_id = ca.uid and not c.arquivada and c.etapa in ('visitou', 'proposta', 'documentacao')
       and coalesce((select max(m.criado_em) from public.mensagens m where m.conversa_id = c.id and m.direcao = 'saida'), c.criada_em) < now() - interval '3 days')
  from corretores_app ca
  order by ca.nome;
end $$;

-- ============================================================
-- Alertas automáticos (rodam pelo cron)
-- ============================================================
-- Horário comercial: 8h–20h em Fortaleza
create or replace function private.conv_horario_comercial(p_em timestamptz default now())
returns boolean language sql stable set search_path to '' as $$
  select extract(hour from p_em at time zone 'America/Fortaleza') between 8 and 19;
$$;

create or replace function private.conv_verificar_alertas()
returns int language plpgsql security definer set search_path to '' as $$
declare n int := 0; k int;
begin
  -- 1) Corretor há mais de 15 min (em horário comercial) sem responder o cliente
  if private.conv_horario_comercial() then
    insert into public.conv_alertas (tipo, conversa_id, lead_id, responsavel_id, titulo, detalhe)
    select 'sem_resposta', c.id, c.lead_id, c.dono_id,
      coalesce(private.conv_nome_usuario(c.dono_id), 'Corretor') || ' sem responder ' || coalesce(l.nome, c.nome_contato, c.telefone),
      'Cliente aguardando desde ' || to_char(c.aguardando_desde at time zone 'America/Fortaleza', 'DD/MM HH24:MI')
    from public.conversas c left join public.leads l on l.id = c.lead_id
    where c.dono_papel = 'corretor' and c.dono_id is not null and not c.arquivada
      and c.aguardando_desde < now() - interval '15 minutes'
      and private.conv_horario_comercial(c.aguardando_desde + interval '15 minutes')
    on conflict do nothing;
    get diagnostics k = row_count; n := n + k;
  end if;

  -- Resolve "sem resposta" quando o cliente foi respondido
  update public.conv_alertas a set resolvido_em = now()
  from public.conversas c
  where a.tipo = 'sem_resposta' and a.resolvido_em is null and c.id = a.conversa_id and c.aguardando_desde is null;

  -- 2) Pós-visita esquecido: visitou/proposta/documentação sem mensagem nossa há 3 dias
  insert into public.conv_alertas (tipo, conversa_id, lead_id, responsavel_id, titulo, detalhe)
  select 'pos_visita_esquecido', c.id, c.lead_id, c.dono_id,
    coalesce(l.nome, c.nome_contato, c.telefone) || ' sem contato há 3 dias',
    'Etapa: ' || c.etapa || coalesce(' · com ' || private.conv_nome_usuario(c.dono_id), '')
  from public.conversas c left join public.leads l on l.id = c.lead_id
  where not c.arquivada and c.etapa in ('visitou', 'proposta', 'documentacao')
    and coalesce((select max(m.criado_em) from public.mensagens m where m.conversa_id = c.id and m.direcao = 'saida'), c.criada_em)
        < now() - interval '3 days'
  on conflict do nothing;
  get diagnostics k = row_count; n := n + k;

  update public.conv_alertas a set resolvido_em = now()
  from public.conversas c
  where a.tipo = 'pos_visita_esquecido' and a.resolvido_em is null and c.id = a.conversa_id
    and (c.etapa not in ('visitou', 'proposta', 'documentacao') or c.arquivada
      or exists (select 1 from public.mensagens m where m.conversa_id = c.id and m.direcao = 'saida' and m.criado_em > a.criado_em));
  return n;
end $$;

-- ============================================================
-- Notificações: chamar a função de push (alerta novo, convite novo, mensagem para o corretor)
-- ============================================================
create or replace function private.conv_push(p_users uuid[], p_titulo text, p_corpo text, p_url text, p_tag text)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if p_users is null or cardinality(p_users) = 0 then return; end if;
  if not exists (select 1 from public.push_inscricoes where user_id = any (p_users)) then return; end if;
  perform net.http_post(
    url := 'https://oxybasvtphosdmlmrfnb.supabase.co/functions/v1/conversas-push',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')),
    body := jsonb_build_object('users', to_jsonb(p_users), 'titulo', left(p_titulo, 80), 'corpo', left(p_corpo, 180),
      'url', p_url, 'tag', p_tag),
    timeout_milliseconds := 15000);
exception when others then
  raise warning 'push não enviado: %', sqlerrm;   -- notificação nunca derruba a operação principal
end $$;

create or replace function private.conv_push_alerta()
returns trigger language plpgsql security definer set search_path to '' as $$
declare equipe uuid[];
begin
  select array_agg(distinct user_id) into equipe from public.user_roles where role::text in ('admin', 'closer');
  perform private.conv_push(
    array(select distinct x from unnest(coalesce(equipe, '{}') || coalesce(array[NEW.responsavel_id], '{}')) x where x is not null),
    case NEW.tipo when 'sem_resposta' then 'Cliente sem resposta' when 'pos_visita_esquecido' then 'Cliente esfriando'
      when 'sinal_compra' then 'Sinal de compra' when 'contato_pessoal' then 'Atenção na conversa' else 'Alerta' end,
    NEW.titulo, case when NEW.conversa_id is not null then '/conversas?c=' || NEW.conversa_id else '/conversas' end,
    'alerta-' || NEW.tipo || '-' || coalesce(NEW.conversa_id::text, NEW.id::text));
  return NEW;
end $$;

drop trigger if exists conv_push_alerta on public.conv_alertas;
create trigger conv_push_alerta after insert on public.conv_alertas
  for each row execute function private.conv_push_alerta();

create or replace function private.conv_push_convite()
returns trigger language plpgsql security definer set search_path to '' as $$
declare uid uuid; lead_nome text; emp text;
begin
  select p.user_id into uid from public.corretores co join public.profiles p on p.id = co.profile_id where co.id = NEW.corretor_id;
  select l.nome, e.nome into lead_nome, emp from public.visitas v join public.leads l on l.id = v.lead_id
    left join public.empreendimentos e on e.id = v.empreendimento_id where v.id = NEW.visita_id;
  perform private.conv_push(array[uid], 'Cliente novo', coalesce(lead_nome, 'Cliente') || coalesce(' · ' || emp, '') || ' — toque para aceitar',
    '/app?convite=' || NEW.id, 'convite-' || NEW.id);
  return NEW;
end $$;

drop trigger if exists conv_push_convite on public.visita_convites;
create trigger conv_push_convite after insert on public.visita_convites
  for each row execute function private.conv_push_convite();

-- ============================================================
-- Permissões
-- ============================================================
revoke all on function public.conversas_listar(text, text, int) from public, anon;
revoke all on function public.conversa_marcar_lida(uuid) from public, anon;
revoke all on function public.conversa_assumir(uuid) from public, anon;
revoke all on function public.conversa_transferir(uuid, uuid, text, text) from public, anon;
revoke all on function public.conversa_nota(uuid, text) from public, anon;
revoke all on function public.conversa_arquivar(uuid, boolean) from public, anon;
revoke all on function public.conversa_mover_etapa(uuid, text) from public, anon;
revoke all on function public.conversa_vincular_lead(uuid, uuid) from public, anon;
revoke all on function public.ia_sugestao_decidir(uuid, boolean, jsonb) from public, anon;
revoke all on function public.conv_alerta_resolver(uuid) from public, anon;
revoke all on function public.resposta_rapida_salvar(uuid, text, text, text, boolean) from public, anon;
revoke all on function public.resposta_rapida_excluir(uuid) from public, anon;
revoke all on function public.push_inscrever(text, text, text, text) from public, anon;
revoke all on function public.push_remover(text) from public, anon;
revoke all on function public.corretor_meus_convites() from public, anon;
revoke all on function public.corretor_responder_convite(uuid, boolean, text) from public, anon;
revoke all on function public.corretor_meus_clientes() from public, anon;
revoke all on function public.conversas_desempenho(int) from public, anon;
grant execute on function public.conversas_listar(text, text, int), public.conversa_marcar_lida(uuid), public.conversa_assumir(uuid),
  public.conversa_transferir(uuid, uuid, text, text), public.conversa_nota(uuid, text), public.conversa_arquivar(uuid, boolean),
  public.conversa_mover_etapa(uuid, text), public.conversa_vincular_lead(uuid, uuid), public.ia_sugestao_decidir(uuid, boolean, jsonb),
  public.conv_alerta_resolver(uuid), public.resposta_rapida_salvar(uuid, text, text, text, boolean), public.resposta_rapida_excluir(uuid),
  public.push_inscrever(text, text, text, text), public.push_remover(text), public.corretor_meus_convites(),
  public.corretor_responder_convite(uuid, boolean, text), public.corretor_meus_clientes(), public.conversas_desempenho(int)
  to authenticated;

-- Respostas rápidas iniciais da equipe
insert into public.respostas_rapidas (atalho, titulo, texto, dono_id) values
  ('ola', 'Saudação', 'Olá! Aqui é da MeMude 😊 Como posso te ajudar?', null),
  ('visita', 'Convite para visita', 'Que tal conhecer pessoalmente? Posso agendar uma visita para você no dia e horário que preferir.', null),
  ('tabela', 'Tabela de preços', 'Vou te enviar a tabela atualizada com as unidades disponíveis. 📄', null),
  ('simulacao', 'Simulação', 'Para fazer sua simulação, me informe por favor sua renda familiar e se pretende usar FGTS.', null),
  ('obrigado', 'Agradecimento', 'Obrigado pelo contato! Qualquer dúvida, é só me chamar por aqui. 🙌', null)
on conflict do nothing;
