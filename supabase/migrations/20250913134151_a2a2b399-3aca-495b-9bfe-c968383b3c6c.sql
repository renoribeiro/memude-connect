-- Delete any existing conflicting data first
DELETE FROM public.profiles WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'reno@re9.online'
);

DELETE FROM auth.users WHERE email = 'reno@re9.online';

-- Create the admin user with simpler approach
DO $$
DECLARE
    new_user_id uuid;
BEGIN
    -- Generate a new UUID
    new_user_id := gen_random_uuid();
    
    -- Insert into auth.users
    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
    ) VALUES (
        new_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'reno@re9.online',
        crypt('123Re92019!@#', gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"]}',
        '{"first_name":"Reno","last_name":"Administrador"}',
        NOW(),
        NOW()
    );
    
    -- Insert into profiles
    INSERT INTO public.profiles (
        user_id,
        first_name,
        last_name,
        role
    ) VALUES (
        new_user_id,
        'Reno',
        'Administrador',
        'admin'::user_role
    );
END $$;