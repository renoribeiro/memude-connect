-- SQL Migration: Add comprovantes to vendas and create storage bucket

-- 1. Add column to vendas table
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS comprovantes TEXT[] DEFAULT '{}';

-- 2. Create public storage bucket for comprovantes
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes', 'comprovantes', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Configure RLS Policies on storage.objects for 'comprovantes' bucket

-- Allow SELECT for all authenticated users
CREATE POLICY "Permitir leitura para usuarios autenticados" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'comprovantes');

-- Allow INSERT for admins only
CREATE POLICY "Permitir upload para administradores" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'comprovantes' AND
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

-- Allow UPDATE for admins only
CREATE POLICY "Permitir atualizacao para administradores" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'comprovantes' AND
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

-- Allow DELETE for admins only
CREATE POLICY "Permitir exclusao para administradores" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'comprovantes' AND
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );
