-- ==============================================================================
-- SCHEMA PER LA GESTIONE MAGAZZINO, INVENTARIO E FATTURE FORNITORI (AI SCAN)
-- Sincronizzazione Multi-Dispositivo (PC & Smartphone)
-- ==============================================================================

-- 1. Tabella Anagrafica Fornitori
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),
  email VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabella Giacenze & Ingredienti Magazzino
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

-- 3. Tabella Archivio Fatture Fornitori
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
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabella Dettaglio Voci Fattura
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  item_name_raw VARCHAR(255) NOT NULL,
  quantity NUMERIC(10, 2) DEFAULT 0.00,
  unit_of_measure VARCHAR(20) DEFAULT 'cartoni',
  pieces_per_package INT DEFAULT 1,
  total_price NUMERIC(10, 2) DEFAULT 0.00,
  unit_price NUMERIC(10, 2) DEFAULT 0.00,
  discount_percent NUMERIC(5, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) DEFAULT 0.00;

-- 5. Tabella Storico Movimenti Magazzino
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

-- ABILITAZIONE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- POLICIES PER ACCESSO MULTI-DISPOSITIVO (Sincronizzazione PC & Smartphone)
DROP POLICY IF EXISTS "Permetti accesso agli utenti autenticati su suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Permetti accesso agli utenti autenticati su inventory_items" ON public.inventory_items;
DROP POLICY IF EXISTS "Permetti accesso agli utenti autenticati su invoices" ON public.invoices;
DROP POLICY IF EXISTS "Permetti accesso agli utenti autenticati su invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Permetti accesso agli utenti autenticati su inventory_movements" ON public.inventory_movements;

DROP POLICY IF EXISTS "Permetti accesso pubblico su suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Permetti accesso pubblico su inventory_items" ON public.inventory_items;
DROP POLICY IF EXISTS "Permetti accesso pubblico su invoices" ON public.invoices;
DROP POLICY IF EXISTS "Permetti accesso pubblico su invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Permetti accesso pubblico su inventory_movements" ON public.inventory_movements;

CREATE POLICY "Permetti accesso pubblico su suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permetti accesso pubblico su inventory_items" ON public.inventory_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permetti accesso pubblico su invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permetti accesso pubblico su invoice_items" ON public.invoice_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permetti accesso pubblico su inventory_movements" ON public.inventory_movements FOR ALL USING (true) WITH CHECK (true);
