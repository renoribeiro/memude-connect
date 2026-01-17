-- Add email field to corretores table
ALTER TABLE public.corretores 
ADD COLUMN email text UNIQUE;

-- Add constraint to ensure email format is valid
ALTER TABLE public.corretores 
ADD CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$');

-- Add index for better performance on email searches
CREATE INDEX idx_corretores_email ON public.corretores(email);

-- Update the updated_at trigger to work with the new column
CREATE TRIGGER update_corretores_updated_at
    BEFORE UPDATE ON public.corretores
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();