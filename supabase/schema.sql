-- ========================================================
-- SCHEMA DATABASE SUPABASE PER APP GESTIONE TURNI RISTORANTE
-- ========================================================

-- 1. Abilitazione estensioni (uuid)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Creazione Tabella EMPLOYEES
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    nome TEXT NOT NULL,
    ruolo TEXT NOT NULL CHECK (ruolo IN ('dipendente', 'admin')) DEFAULT 'dipendente',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Creazione Tabella SHIFTS
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    turno TEXT NOT NULL CHECK (turno IN ('pranzo', 'cena')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_employee_date_shift UNIQUE (employee_id, data, turno)
);

-- Index per velocizzare le query per data ed employee
CREATE INDEX IF NOT EXISTS idx_shifts_employee_date ON public.shifts(employee_id, data);
CREATE INDEX IF NOT EXISTS idx_shifts_data ON public.shifts(data);

-- 4. Funzione Helper per verificare se un utente è Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.employees
    WHERE auth_user_id = auth.uid() AND ruolo = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. ATTIVAZIONE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- ========================================================
-- POLICIES PER TABELLA EMPLOYEES
-- ========================================================

-- Permetti la lettura della lista dipendenti a tutti gli utenti autenticati
DROP POLICY IF EXISTS "Gli utenti autenticati possono leggere gli employees" ON public.employees;
CREATE POLICY "Gli utenti autenticati possono leggere gli employees"
ON public.employees FOR SELECT
TO authenticated
USING (true);

-- Permetti l'inserimento del proprio profilo employee al momento della registrazione
DROP POLICY IF EXISTS "Gli utenti possono creare il proprio profilo employee" ON public.employees;
CREATE POLICY "Gli utenti possono creare il proprio profilo employee"
ON public.employees FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = auth_user_id);

-- Permetti la modifica del proprio profilo oppure all'admin
DROP POLICY IF EXISTS "Gli utenti possono modificare il proprio profilo o se admin" ON public.employees;
CREATE POLICY "Gli utenti possono modificare il proprio profilo o se admin"
ON public.employees FOR UPDATE
TO authenticated
USING (auth.uid() = auth_user_id OR public.is_admin())
WITH CHECK (auth.uid() = auth_user_id OR public.is_admin());

-- Permetti l'eliminazione del proprio profilo oppure all'admin
DROP POLICY IF EXISTS "Gli utenti possono eliminare il proprio profilo o se admin" ON public.employees;
CREATE POLICY "Gli utenti possono eliminare il proprio profilo o se admin"
ON public.employees FOR DELETE
TO authenticated
USING (auth.uid() = auth_user_id OR public.is_admin());

-- ========================================================
-- POLICIES PER TABELLA SHIFTS
-- ========================================================

-- Lettura turni: il dipendente legge solo i propri, l'admin legge tutti
DROP POLICY IF EXISTS "Dipendente legge i propri turni o admin legge tutti" ON public.shifts;
CREATE POLICY "Dipendente legge i propri turni o admin legge tutti"
ON public.shifts FOR SELECT
TO authenticated
USING (
  employee_id IN (
    SELECT id FROM public.employees WHERE auth_user_id = auth.uid()
  )
  OR public.is_admin()
);

-- Inserimento turni: dipendente per se stesso, admin per tutti
DROP POLICY IF EXISTS "Dipendente inserisce propri turni o admin inserisce per tutti" ON public.shifts;
CREATE POLICY "Dipendente inserisce propri turni o admin inserisce per tutti"
ON public.shifts FOR INSERT
TO authenticated
WITH CHECK (
  employee_id IN (
    SELECT id FROM public.employees WHERE auth_user_id = auth.uid()
  )
  OR public.is_admin()
);

-- Modifica turni: dipendente per se stesso, admin per tutti
DROP POLICY IF EXISTS "Dipendente aggiorna propri turni o admin aggiorna tutti" ON public.shifts;
CREATE POLICY "Dipendente aggiorna propri turni o admin aggiorna tutti"
ON public.shifts FOR UPDATE
TO authenticated
USING (
  employee_id IN (
    SELECT id FROM public.employees WHERE auth_user_id = auth.uid()
  )
  OR public.is_admin()
);

-- Eliminazione turni: dipendente per se stesso, admin per tutti
DROP POLICY IF EXISTS "Dipendente elimina propri turni o admin elimina tutti" ON public.shifts;
CREATE POLICY "Dipendente elimina propri turni o admin elimina tutti"
ON public.shifts FOR DELETE
TO authenticated
USING (
  employee_id IN (
    SELECT id FROM public.employees WHERE auth_user_id = auth.uid()
  )
  OR public.is_admin()
);

-- Permessi completi sulle tabelle per gli utenti autenticati
GRANT ALL ON TABLE public.employees TO authenticated;
GRANT ALL ON TABLE public.shifts TO authenticated;
GRANT ALL ON TABLE public.employees TO anon;
GRANT ALL ON TABLE public.shifts TO anon;

