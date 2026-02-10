-- Add is_active column to profiles for user activation/deactivation
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Admin delete policy for profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polrelid = 'public.profiles'::regclass 
    AND polname = 'Admin can delete profiles'
  ) THEN
    CREATE POLICY "Admin can delete profiles" 
      ON profiles FOR DELETE TO authenticated
      USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END
$$;
