-- Create admin user and let the trigger handle the profile creation
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

-- Update the profile role to admin (trigger created it as default role)
UPDATE public.profiles 
SET role = 'admin'::user_role,
    first_name = 'Reno',
    last_name = 'Administrador'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'reno@re9.online');