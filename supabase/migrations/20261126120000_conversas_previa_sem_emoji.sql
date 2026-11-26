-- MeMude Conversas — identidade visual (26/11/2026): tom de voz sem emoji.
-- Prévia da última mensagem na lista e nas notificações passa a ser só texto.
create or replace function private.conv_previa(p_tipo text, p_texto text, p_nome text)
returns text language sql immutable set search_path to '' as $$
  select coalesce(left(p_texto, 140), case p_tipo when 'imagem' then 'Foto' when 'audio' then 'Áudio' when 'video' then 'Vídeo'
    when 'documento' then coalesce(p_nome, 'Documento') when 'figurinha' then 'Figurinha' when 'localizacao' then 'Localização'
    when 'contato' then 'Contato' when 'reacao' then 'Reagiu a uma mensagem' else 'Mensagem' end);
$$;

-- Conversas que já estavam com a prévia antiga
update public.conversas set ultima_previa = case ultima_previa
    when '📷 Foto' then 'Foto' when '🎤 Áudio' then 'Áudio' when '🎥 Vídeo' then 'Vídeo'
    when '📍 Localização' then 'Localização' when '👤 Contato' then 'Contato'
    else regexp_replace(ultima_previa, '^📄 ', '') end
where ultima_previa ~ '^(📷|🎤|🎥|📍|👤|📄) ';
