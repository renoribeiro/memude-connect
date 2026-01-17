-- Add deleted_at column to leads table for soft delete support
ALTER TABLE public.leads ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;
