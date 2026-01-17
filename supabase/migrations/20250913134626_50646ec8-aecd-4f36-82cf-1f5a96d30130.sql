-- Fix infinite recursion in RLS policies by creating a security definer function
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role::text FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Create new non-recursive policies using the security definer function
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (public.get_current_user_role() = 'admin');

-- Fix the admin user role (currently 'cliente' should be 'admin')
UPDATE public.profiles 
SET role = 'admin'::user_role,
    first_name = 'Reno',
    last_name = 'Administrador'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'reno@re9.online');

-- Ensure the user exists in auth.users (fallback if previous migration failed)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'reno@re9.online') THEN
    INSERT INTO auth.users (
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      email_change_token_current
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'reno@re9.online',
      crypt('123Re92019!@#', gen_salt('bf')),
      NOW(),
      '{"first_name": "Reno", "last_name": "Administrador"}',
      NOW(),
      NOW(),
      '',
      '',
      '',
      '',
      ''
    );
    
    -- Update profile role to admin after user creation
    UPDATE public.profiles 
    SET role = 'admin'::user_role,
        first_name = 'Reno',
        last_name = 'Administrador'
    WHERE user_id = (SELECT id FROM auth.users WHERE email = 'reno@re9.online');
  END IF;
END $$;