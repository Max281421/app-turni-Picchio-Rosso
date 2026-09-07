-- ========================================================
-- TABELLA DISPONIBILITÀ SETTIMANALI DIPENDENTI (BETA)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.availabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    turno TEXT NOT NULL CHECK (turno IN ('pranzo', 'cena')),
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_employee_date_shift_avail UNIQUE (employee_id, data, turno)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_availabilities_employee_date ON public.availabilities(employee_id, data);
CREATE INDEX IF NOT EXISTS idx_availabilities_data ON public.availabilities(data);

-- Attivazione Row Level Security (RLS)
ALTER TABLE public.availabilities ENABLE ROW LEVEL SECURITY;

-- Policies per la tabella availabilities
DROP POLICY IF EXISTS "Dipendente vede le proprie disponibilità o admin vede tutte" ON public.availabilities;
CREATE POLICY "Dipendente vede le proprie disponibilità o admin vede tutte"
ON public.availabilities FOR SELECT
TO authenticated
USING (
  employee_id IN (
    SELECT id FROM public.employees WHERE auth_user_id = auth.uid()
  )
  OR public.is_admin()
);

DROP POLICY IF EXISTS "Dipendente o admin inserisce o modifica disponibilità" ON public.availabilities;
CREATE POLICY "Dipendente o admin inserisce o modifica disponibilità"
ON public.availabilities FOR ALL
TO authenticated
USING (
  employee_id IN (
    SELECT id FROM public.employees WHERE auth_user_id = auth.uid()
  )
  OR public.is_admin()
)
WITH CHECK (
  employee_id IN (
    SELECT id FROM public.employees WHERE auth_user_id = auth.uid()
  )
  OR public.is_admin()
);

GRANT ALL ON TABLE public.availabilities TO authenticated;
GRANT ALL ON TABLE public.availabilities TO anon;
