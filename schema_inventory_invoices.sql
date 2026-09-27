-- ==============================================================================
-- SCHEMA PER LA GESTIONE MAGAZZINO, INVENTARIO E FATTURE FORNITORI (AI SCAN)
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
  category VARCHAR(100) DEFAULT 'Generale', -- es. Latticini, Farine, Conserve, Salumi, Bevande, Consumabili
  unit_of_measure VARCHAR(20) DEFAULT 'kg', -- kg, litri, buste, cartoni, pezzi
  current_stock NUMERIC(10, 2) DEFAULT 0.00,
  min_stock_alert NUMERIC(10, 2) DEFAULT 5.00,
  last_unit_price NUMERIC(10, 2) DEFAULT 0.00, -- prezzo al kg / unità (€/kg)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabella Archivio Fatture Fornitori
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name_raw VARCHAR(255), -- nome letto da OCR se fornitore non ancora associato
  invoice_number VARCHAR(100) NOT NULL,
  invoice_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  total_amount NUMERIC(10, 2) DEFAULT 0.00,
  payment_status VARCHAR(20) DEFAULT 'da_pagare', -- 'pagato', 'da_pagare', 'scaduto'
  file_url TEXT, -- link alla foto/PDF salvato su Supabase Storage
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabella Dettaglio Voci Fattura (Ingredienti Acquistati)
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  item_name_raw VARCHAR(255) NOT NULL, -- testo estratto dall'IA
  quantity NUMERIC(10, 2) DEFAULT 0.00,
  total_price NUMERIC(10, 2) DEFAULT 0.00,
  unit_price NUMERIC(10, 2) DEFAULT 0.00, -- calcolato: total_price / quantity (€/kg)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabella Storico Movimenti Magazzino (Carichi/Scarichi)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE NOT NULL,
  movement_type VARCHAR(50) NOT NULL, -- 'carico_fattura', 'rettifica_manuale', 'scarico_uso'
  quantity_change NUMERIC(10, 2) NOT NULL, -- es. +15.00 o -2.50
  resulting_stock NUMERIC(10, 2) NOT NULL,
  reference_id UUID, -- es. invoice_id se carico da fattura
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HABILITAZIONE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- POLITICHE DI SICUREZZA (Permetti lettura ed edit agli utenti autenticati)
CREATE POLICY "Permetti accesso agli utenti autenticati su suppliers" ON public.suppliers
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Permetti accesso agli utenti autenticati su inventory_items" ON public.inventory_items
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Permetti accesso agli utenti autenticati su invoices" ON public.invoices
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Permetti accesso agli utenti autenticati su invoice_items" ON public.invoice_items
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Permetti accesso agli utenti autenticati su inventory_movements" ON public.inventory_movements
  FOR ALL USING (auth.role() = 'authenticated');

-- DATI DI INIZIALIZZAZIONE (SEEDING INGREDIENTI TIPICI PIZZERIA)
INSERT INTO public.suppliers (name, phone, email) VALUES
  ('Latticini Rossi Srl', '081-5551234', 'ordini@latticinirossi.it'),
  ('Mulino Capriati SpA', '0823-777888', 'commerciale@mulinocapriati.it'),
  ('Distribuzione Conserve San Marzano', '081-999444', 'info@sanmarzanofood.it')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.inventory_items (name, category, unit_of_measure, current_stock, min_stock_alert, last_unit_price) VALUES
  ('Mozzarella di Bufala DOP', 'Latticini', 'kg', 25.00, 10.00, 8.50),
  ('Fior di Latte Appennino', 'Latticini', 'kg', 40.00, 15.00, 6.20),
  ('Farina Tipo 00 Pizza', 'Farine', 'kg', 150.00, 50.00, 1.10),
  ('Pelati San Marzano DOP', 'Conserve', 'kg', 60.00, 20.00, 2.30),
  ('Olio Extra Vergine di Oliva', 'Consumabili', 'litri', 18.00, 5.00, 9.80),
  ('Prosciutto Crudo di Parma', 'Salumi', 'kg', 8.50, 3.00, 18.50)
ON CONFLICT (name) DO NOTHING;
