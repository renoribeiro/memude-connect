-- Migração para auto-criar registro na tabela corretores ao atribuir a função de corretor
-- Além de corrigir perfis órfãos existentes

CREATE OR REPLACE FUNCTION public.handle_corretor_role_assignment()
RETURNS TRIGGER AS $$
DECLARE
    v_profile_id UUID;
    v_phone TEXT;
    v_creci TEXT;
BEGIN
    -- Busca o ID do perfil e telefone associados ao user_id
    SELECT id, phone INTO v_profile_id, v_phone
    FROM public.profiles
    WHERE user_id = NEW.user_id;

    IF v_profile_id IS NOT NULL THEN
        -- Verifica se já existe um registro na tabela corretores
        IF NOT EXISTS (SELECT 1 FROM public.corretores WHERE profile_id = v_profile_id) THEN
            -- Gera um CRECI provisório único baseado nos primeiros 8 caracteres do ID do perfil
            v_creci := 'PROV-' || upper(substring(v_profile_id::text from 1 for 8));
            
            -- Insere o registro na tabela corretores
            INSERT INTO public.corretores (
                profile_id, 
                creci, 
                whatsapp, 
                status, 
                nota_media, 
                total_visitas
            )
            VALUES (
                v_profile_id,
                v_creci,
                COALESCE(v_phone, '00000000000'), -- Fallback para telefone não-nulo
                'em_avaliacao',
                5.0, -- Nota inicial excelente
                0
            );
            
            RAISE NOTICE 'Auto-criado registro de corretor para profile_id % com CRECI provisório %', v_profile_id, v_creci;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para automatizar a criação na tabela corretores
DROP TRIGGER IF EXISTS on_corretor_role_assigned ON public.user_roles;
CREATE TRIGGER on_corretor_role_assigned
  AFTER INSERT OR UPDATE OF role ON public.user_roles
  FOR EACH ROW
  WHEN (NEW.role = 'corretor')
  EXECUTE FUNCTION public.handle_corretor_role_assignment();

-- Backfill: Criar retroativamente registros para corretores existentes sem perfil na tabela corretores
INSERT INTO public.corretores (
    profile_id, 
    creci, 
    whatsapp, 
    status, 
    nota_media, 
    total_visitas
)
SELECT 
    p.id as profile_id,
    'PROV-' || upper(substring(p.id::text from 1 for 8)) as creci,
    COALESCE(p.phone, '00000000000') as whatsapp,
    'em_avaliacao' as status,
    5.0 as nota_media,
    0 as total_visitas
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.user_id
WHERE ur.role = 'corretor'
  AND NOT EXISTS (
      SELECT 1 FROM public.corretores c WHERE c.profile_id = p.id
  )
ON CONFLICT (profile_id) DO NOTHING;
