-- Force clean all data and recreate admin
TRUNCATE TABLE public.profiles CASCADE;

-- Create admin user directly
DO $$
DECLARE
    admin_user_id uuid := gen_random_uuid();
BEGIN
    -- Insert admin user
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
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        email_change_token_current
    ) VALUES (
        admin_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'reno@re9.online',
        crypt('123Re92019!@#', gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"]}',
        '{"first_name":"Reno","last_name":"Administrador"}',
        NOW(),
        NOW(),
        '',
        '',
        '',
        '',
        ''
    );
    
    -- Insert admin profile
    INSERT INTO public.profiles (
        user_id,
        first_name,
        last_name,
        role
    ) VALUES (
        admin_user_id,
        'Reno',
        'Administrador',
        'admin'
    );
END $$;