ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS grade_level smallint;
COMMENT ON COLUMN public.classes.grade_level IS 'Khối lớp 1-12';