-- Migration to ensure reports table has consistent schema and proper default values
-- This script will add missing columns and ensure default values are set correctly

-- First, let's ensure the reports table exists with all required columns
DO $$ 
BEGIN
    -- Add missing columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reports' AND column_name = 'no_agenda') THEN
        ALTER TABLE public.reports ADD COLUMN no_agenda TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reports' AND column_name = 'kelompok_asal_surat') THEN
        ALTER TABLE public.reports ADD COLUMN kelompok_asal_surat TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reports' AND column_name = 'agenda_sestama') THEN
        ALTER TABLE public.reports ADD COLUMN agenda_sestama TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reports' AND column_name = 'sifat') THEN
        ALTER TABLE public.reports ADD COLUMN sifat JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reports' AND column_name = 'derajat') THEN
        ALTER TABLE public.reports ADD COLUMN derajat JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Ensure default values are set correctly
ALTER TABLE public.reports 
    ALTER COLUMN progress SET DEFAULT 0,
    ALTER COLUMN created_at SET DEFAULT NOW(),
    ALTER COLUMN updated_at SET DEFAULT NOW(),
    ALTER COLUMN status SET DEFAULT 'draft',
    ALTER COLUMN priority SET DEFAULT 'sedang';

-- Add or update the updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_reports_updated_at ON public.reports;
CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON public.reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Ensure RLS policies exist for authenticated users
DO $$
BEGIN
    -- Check if policy exists before creating
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'reports' AND policyname = 'reports_insert_authenticated'
    ) THEN
        CREATE POLICY "reports_insert_authenticated" ON public.reports 
        FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON public.reports(created_by);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at);
