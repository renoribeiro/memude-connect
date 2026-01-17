-- Update the password for the existing admin user
UPDATE auth.users 
SET encrypted_password = crypt('123Re92019!@#', gen_salt('bf')),
    updated_at = NOW()
WHERE email = 'reno@re9.online';