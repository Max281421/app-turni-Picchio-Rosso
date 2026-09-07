-- Schema per la gestione dei planning settimanali pubblicati (separati dai turni mensili lavorati)

CREATE TABLE IF NOT EXISTS public.planned_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  turno VARCHAR(10) NOT NULL CHECK (turno IN ('pranzo', 'cena')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (employee_id, data, turno)
);

-- Abilita RLS
ALTER TABLE public.planned_shifts ENABLE ROW LEVEL SECURITY;

-- Criteri di accesso RLS per Supabase
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'planned_shifts' AND policyname = 'Allow public read access on planned_shifts'
  ) THEN
    CREATE POLICY "Allow public read access on planned_shifts"
      ON public.planned_shifts FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'planned_shifts' AND policyname = 'Allow authenticated insert on planned_shifts'
  ) THEN
    CREATE POLICY "Allow authenticated insert on planned_shifts"
      ON public.planned_shifts FOR INSERT
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'planned_shifts' AND policyname = 'Allow authenticated update on planned_shifts'
  ) THEN
    CREATE POLICY "Allow authenticated update on planned_shifts"
      ON public.planned_shifts FOR UPDATE
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'planned_shifts' AND policyname = 'Allow authenticated delete on planned_shifts'
  ) THEN
    CREATE POLICY "Allow authenticated delete on planned_shifts"
      ON public.planned_shifts FOR DELETE
      USING (true);
  END IF;
END $$;
