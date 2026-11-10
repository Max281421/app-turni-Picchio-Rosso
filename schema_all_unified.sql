-- ==============================================================================
-- QUERY UNIFICATA DEFINITIVA PER SUPABASE (APP TURNI & MAGAZZINO)
-- Copia e incolla questo intero blocco nell'SQL Editor di Supabase e clicca "Run"
-- ==============================================================================

-- 1. TABELLA EMPLOYEES & COLONNE ALIAS / MANSIONI
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID,
    nome VARCHAR(255) NOT NULL,
    alias VARCHAR(100),
    ruolo VARCHAR(50) DEFAULT 'dipendente',
    mansioni TEXT[] DEFAULT ARRAY['pizzeria']::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS alias VARCHAR(100);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS mansioni TEXT[] DEFAULT ARRAY['pizzeria']::TEXT[];

-- 2. TABELLA PLANNED_SHIFTS (PLANNING SETTIMANALE PER SETTORE)
CREATE TABLE IF NOT EXISTS public.planned_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    turno VARCHAR(10) NOT NULL CHECK (turno IN ('pranzo', 'cena')),
    mansione VARCHAR(20) NOT NULL DEFAULT 'pizzeria',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.planned_shifts ADD COLUMN IF NOT EXISTS mansione VARCHAR(20) DEFAULT 'pizzeria';

-- 3. TABELLA SUPPLIERS (FORNITORI MAGAZZINO)
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50),
    email VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELLA INVENTORY_ITEMS (GIACENZE & INGREDIENTI)
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(100) DEFAULT 'Generale',
    unit_of_measure VARCHAR(20) DEFAULT 'cartoni',
    pieces_per_package INT DEFAULT 1,
    current_stock NUMERIC(10, 2) DEFAULT 0.00,
    min_stock_alert NUMERIC(10, 2) DEFAULT 5.00,
    last_unit_price NUMERIC(10, 2) DEFAULT 0.00,
    last_discount_percent NUMERIC(5, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS last_discount_percent NUMERIC(5, 2) DEFAULT 0.00;

-- 5. TABELLA INVOICES (ARCHIVIO FATTURE & DDT)
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    supplier_name_raw VARCHAR(255),
    invoice_number VARCHAR(100) NOT NULL,
    invoice_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    total_amount NUMERIC(10, 2) DEFAULT 0.00,
    payment_status VARCHAR(20) DEFAULT 'da_pagare',
    file_url TEXT,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABELLA INVOICE_ITEMS (DETTAGLIO VOCI FATTURA CON SCONTI)
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
    item_name_raw VARCHAR(255) NOT NULL,
    quantity NUMERIC(10, 2) DEFAULT 0.00,
    unit_of_measure VARCHAR(20) DEFAULT 'cartoni',
    pieces_per_package INT DEFAULT 1,
    unit_price NUMERIC(10, 2) DEFAULT 0.00,
    discount_percent NUMERIC(5, 2) DEFAULT 0.00,
    total_price NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) DEFAULT 0.00;

-- 7. TABELLA INVENTORY_MOVEMENTS (STORICO MOVIMENTI)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE NOT NULL,
    movement_type VARCHAR(50) NOT NULL,
    quantity_change NUMERIC(10, 2) NOT NULL,
    resulting_stock NUMERIC(10, 2) NOT NULL,
    reference_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABELLA PUSH_SUBSCRIPTIONS (NOTIFICHE PUSH DISPOSITIVI)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    auth_user_id UUID,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ABILITAZIONE ROW LEVEL SECURITY (RLS) SU TUTTE LE TABELLE
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planned_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- CREAZIONE POLICIES PER ACCESSO COMPLETO MULTI-DISPOSITIVO
DROP POLICY IF EXISTS "Accesso completo su employees" ON public.employees;
CREATE POLICY "Accesso completo su employees" ON public.employees FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Accesso completo su planned_shifts" ON public.planned_shifts;
CREATE POLICY "Accesso completo su planned_shifts" ON public.planned_shifts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Accesso completo su suppliers" ON public.suppliers;
CREATE POLICY "Accesso completo su suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Accesso completo su inventory_items" ON public.inventory_items;
CREATE POLICY "Accesso completo su inventory_items" ON public.inventory_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Accesso completo su invoices" ON public.invoices;
CREATE POLICY "Accesso completo su invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Accesso completo su invoice_items" ON public.invoice_items;
CREATE POLICY "Accesso completo su invoice_items" ON public.invoice_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Accesso completo su inventory_movements" ON public.inventory_movements;
CREATE POLICY "Accesso completo su inventory_movements" ON public.inventory_movements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Accesso completo su push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Accesso completo su push_subscriptions" ON public.push_subscriptions FOR ALL USING (true) WITH CHECK (true);

-- CONCESSIONE GRANTS AI RUOLI PER EVITARE ERRORI PERMESSI (42501)
GRANT ALL ON TABLE public.employees TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.planned_shifts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.suppliers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.inventory_items TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.invoices TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.invoice_items TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.inventory_movements TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.push_subscriptions TO anon, authenticated, service_role;

-- 9. TRIGGER SINCRONIZZAZIONE ELIMINAZIONE UTENTI DA AUTH.USERS
CREATE OR REPLACE FUNCTION public.handle_employee_deleted()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.auth_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = OLD.auth_user_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tr_employee_deleted ON public.employees;
CREATE TRIGGER tr_employee_deleted
AFTER DELETE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.handle_employee_deleted();

