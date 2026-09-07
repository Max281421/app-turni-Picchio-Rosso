-- Schema per la gestione dei planning settimanali pubblicati (separati dai turni mensili lavorati)

CREATE TABLE IF NOT EXISTS public.planned_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  turno VARCHAR(10) NOT NULL CHECK (turno IN ('pranzo', 'cena')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_planned_shift UNIQUE (employee_id, data, turno)
);

-- Indici per velocizzare i filtri per dipendente e data
CREATE INDEX IF NOT EXISTS idx_planned_shifts_employee_date ON public.planned_shifts(employee_id, data);
CREATE INDEX IF NOT EXISTS idx_planned_shifts_data ON public.planned_shifts(data);

-- Abilita RLS
ALTER TABLE public.planned_shifts ENABLE ROW LEVEL SECURITY;

-- Politiche RLS di accesso completo per utenti autenticati e anonimi (coerente con availabilities e shifts)
DROP POLICY IF EXISTS "Allow public read access on planned_shifts" ON public.planned_shifts;
DROP POLICY IF EXISTS "Allow authenticated insert on planned_shifts" ON public.planned_shifts;
DROP POLICY IF EXISTS "Allow authenticated update on planned_shifts" ON public.planned_shifts;
DROP POLICY IF EXISTS "Allow authenticated delete on planned_shifts" ON public.planned_shifts;
DROP POLICY IF EXISTS "Accesso completo planned_shifts per tutti" ON public.planned_shifts;

CREATE POLICY "Accesso completo planned_shifts per tutti"
ON public.planned_shifts FOR ALL
USING (true)
WITH CHECK (true);

-- PERMESSI FONDAMENTALI PER SUPABASE POSTGREST API (Senza questi Postgres restituisce errore 42501 permission denied)
GRANT ALL ON TABLE public.planned_shifts TO authenticated;
GRANT ALL ON TABLE public.planned_shifts TO anon;
