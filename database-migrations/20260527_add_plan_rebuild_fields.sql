-- Adds reproducible Schliessplan link fields to Supabase.
-- Safe to run more than once in the Supabase SQL editor.

ALTER TABLE public.schliessplaene
ADD COLUMN IF NOT EXISTS plan_rebuild_url TEXT,
ADD COLUMN IF NOT EXISTS plan_rebuild_code TEXT;

COMMENT ON COLUMN public.schliessplaene.plan_rebuild_url IS
    'URL that can restore the Schliessplan rows, systems, functions and key matrix.';

COMMENT ON COLUMN public.schliessplaene.plan_rebuild_code IS
    'Readable row-wise rebuild code, e.g. Keys:Gruppe 1_Gruppe 2|Row1:...:Keylogic:X/.';
