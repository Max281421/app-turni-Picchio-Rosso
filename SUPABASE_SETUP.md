# Guida Passo Passo: Configurazione Supabase per App Turni

Guida semplice e dettagliata per configurare il backend gratuito di Supabase per l'applicazione **App Turni**.

---

## 1. Creare un Account ed un Progetto Supabase

1. Vai sul sito [https://supabase.com](https://supabase.com) e clicca su **Start your project** (oppure **Sign In** se hai già un account).
2. Registrati gratuitamente (puoi usare anche il tuo account GitHub o Google).
3. Una volta dentro la Dashboard, clicca sul pulsante verde **New Project**.
4. Inserisci i dati richiesti:
   - **Name**: `App Turni Ristorante`
   - **Database Password**: Inserisci una password sicura e annotala (es. `TurniRistorante2026!`).
   - **Region**: Seleziona `Central Europe (Frankfurt)` per massima velocità in Italia.
   - **Pricing Plan**: Seleziona **Free tier**.
5. Clicca su **Create new project** e attendi circa 1-2 minuti che il database venga preparato.

---

## 2. Creare le Tabelle ed i Permessi (SQL Editor)

1. Nel menu laterale sinistro di Supabase, clicca sull'icona **SQL Editor** (l'icona `>_`).
2. Clicca in alto su **New query**.
3. Incolla lo **Script Unificato Finale Completo** riportato di seguito.
4. Clicca sul pulsante **Run** in basso a destra.
5. Vedrai comparire il messaggio `Success. No rows returned`. Tutte le tabelle (`employees`, `shifts`, `availabilities`, `planned_shifts`), i permessi `GRANT` e le policy RLS saranno pronti all'uso!

```sql
-- ========================================================
-- SCRIPT DATABASE UNIFICATO FINALE COMPLETO - APP TURNI
-- ========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELLA EMPLOYEES (Dipendenti ed Admin, con supporto alias e mansioni multi-ruolo)
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    nome TEXT NOT NULL,
    alias TEXT,
    ruolo TEXT NOT NULL CHECK (ruolo IN ('dipendente', 'admin')) DEFAULT 'dipendente',
    mansioni TEXT[] DEFAULT ARRAY['cassa', 'fattorino', 'pizzeria'],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assicura che le colonne alias e mansioni esistano anche su tabelle preesistenti
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS alias TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS mansioni TEXT[] DEFAULT ARRAY['cassa', 'fattorino', 'pizzeria'];

-- 2. TABELLA SHIFTS (Turni mensili lavorati per report/commercialista, con campo note)
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    turno TEXT NOT NULL CHECK (turno IN ('pranzo', 'cena')),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_employee_date_shift UNIQUE (employee_id, data, turno)
);

-- Assicura che la colonna note esista anche su tabelle preesistenti
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS note TEXT;

CREATE INDEX IF NOT EXISTS idx_shifts_employee_date ON public.shifts(employee_id, data);
CREATE INDEX IF NOT EXISTS idx_shifts_data ON public.shifts(data);

-- 3. TABELLA AVAILABILITIES (Disponibilità inserite dai dipendenti)
CREATE TABLE IF NOT EXISTS public.availabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    turno TEXT NOT NULL CHECK (turno IN ('pranzo', 'cena')),
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_employee_date_shift_avail UNIQUE (employee_id, data, turno)
);

CREATE INDEX IF NOT EXISTS idx_availabilities_employee_date ON public.availabilities(employee_id, data);
CREATE INDEX IF NOT EXISTS idx_availabilities_data ON public.availabilities(data);

-- 4. TABELLA PLANNED_SHIFTS (Planning settimanale pubblicato dall'Admin - 100% isolato dal commercialista)
CREATE TABLE IF NOT EXISTS public.planned_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    turno VARCHAR(10) NOT NULL CHECK (turno IN ('pranzo', 'cena')),
    mansione VARCHAR(20) NOT NULL DEFAULT 'pizzeria',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_planned_shift_sector UNIQUE (employee_id, data, turno, mansione)
);

-- Assicura che la colonna mansione esista anche su tabelle preesistenti
ALTER TABLE public.planned_shifts ADD COLUMN IF NOT EXISTS mansione VARCHAR(20) DEFAULT 'pizzeria';

CREATE INDEX IF NOT EXISTS idx_planned_shifts_employee_date ON public.planned_shifts(employee_id, data);
CREATE INDEX IF NOT EXISTS idx_planned_shifts_data ON public.planned_shifts(data);

-- FUNZIONE DI CONTROLLO ADMIN
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.employees
    WHERE auth_user_id = auth.uid() AND ruolo = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ABILITAZIONE ROW LEVEL SECURITY (RLS) SU TUTTE LE TABELLE
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planned_shifts ENABLE ROW LEVEL SECURITY;

-- POLICIES: EMPLOYEES
DROP POLICY IF EXISTS "Gli utenti autenticati possono leggere gli employees" ON public.employees;
DROP POLICY IF EXISTS "Gli utenti possono creare il proprio profilo employee" ON public.employees;
DROP POLICY IF EXISTS "Gli utenti possono modificare il proprio profilo o se admin" ON public.employees;
DROP POLICY IF EXISTS "Gli utenti possono eliminare il proprio profilo o se admin" ON public.employees;
DROP POLICY IF EXISTS "Accesso completo employees per tutti" ON public.employees;

CREATE POLICY "Accesso completo employees per tutti"
ON public.employees FOR ALL
USING (true)
WITH CHECK (true);

-- POLICIES: SHIFTS
DROP POLICY IF EXISTS "Dipendente legge i propri turni o admin legge tutti" ON public.shifts;
CREATE POLICY "Dipendente legge i propri turni o admin legge tutti"
ON public.shifts FOR SELECT TO authenticated USING (
  employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid()) OR public.is_admin()
);

DROP POLICY IF EXISTS "Dipendente inserisce propri turni o admin inserisce per tutti" ON public.shifts;
CREATE POLICY "Dipendente inserisce propri turni o admin inserisce per tutti"
ON public.shifts FOR INSERT TO authenticated WITH CHECK (
  employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid()) OR public.is_admin()
);

DROP POLICY IF EXISTS "Dipendente aggiorna propri turni o admin aggiorna tutti" ON public.shifts;
CREATE POLICY "Dipendente aggiorna propri turni o admin aggiorna tutti"
ON public.shifts FOR UPDATE TO authenticated USING (
  employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid()) OR public.is_admin()
);

DROP POLICY IF EXISTS "Dipendente elimina propri turni o admin elimina tutti" ON public.shifts;
CREATE POLICY "Dipendente elimina propri turni o admin elimina tutti"
ON public.shifts FOR DELETE TO authenticated USING (
  employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid()) OR public.is_admin()
);

-- POLICIES: AVAILABILITIES
DROP POLICY IF EXISTS "Dipendente vede le proprie disponibilità o admin vede tutte" ON public.availabilities;
CREATE POLICY "Dipendente vede le proprie disponibilità o admin vede tutte"
ON public.availabilities FOR SELECT TO authenticated
USING (
  employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid()) OR public.is_admin()
);

DROP POLICY IF EXISTS "Dipendente o admin inserisce o modifica disponibilità" ON public.availabilities;
CREATE POLICY "Dipendente o admin inserisce o modifica disponibilità"
ON public.availabilities FOR ALL TO authenticated
USING (
  employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid()) OR public.is_admin()
)
WITH CHECK (
  employee_id IN (SELECT id FROM public.employees WHERE auth_user_id = auth.uid()) OR public.is_admin()
);

-- POLICIES: PLANNED_SHIFTS
DROP POLICY IF EXISTS "Allow public read access on planned_shifts" ON public.planned_shifts;
DROP POLICY IF EXISTS "Allow authenticated insert on planned_shifts" ON public.planned_shifts;
DROP POLICY IF EXISTS "Allow authenticated update on planned_shifts" ON public.planned_shifts;
DROP POLICY IF EXISTS "Allow authenticated delete on planned_shifts" ON public.planned_shifts;
DROP POLICY IF EXISTS "Accesso completo planned_shifts per tutti" ON public.planned_shifts;

CREATE POLICY "Accesso completo planned_shifts per tutti"
ON public.planned_shifts FOR ALL
USING (true)
WITH CHECK (true);

-- PERMESSI GRANT FONDAMENTALI PER L'API SUPABASE (AUTHENTICATED E ANON)
GRANT ALL ON TABLE public.employees TO authenticated;
GRANT ALL ON TABLE public.employees TO anon;

GRANT ALL ON TABLE public.shifts TO authenticated;
GRANT ALL ON TABLE public.shifts TO anon;

GRANT ALL ON TABLE public.availabilities TO authenticated;
GRANT ALL ON TABLE public.availabilities TO anon;

GRANT ALL ON TABLE public.planned_shifts TO authenticated;
GRANT ALL ON TABLE public.planned_shifts TO anon;
```

---

## 3. Disabilitare la Conferma Email (per la Registrazione Rapida)

Per fare in modo che i dipendenti possano registrarsi ed accedere subito senza dover confermare l'email:

1. Nel menu laterale sinistro, clicca su **Authentication** (icona persone / lucchetto).
2. Seleziona la voce **Providers** -> **Email**.
3. Disattiva l'opzione **Confirm email** (impostala su OFF).
4. Clicca su **Save** in fondo alla pagina.

---

## 4. Recuperare l'URL e la API Key (Publishable / Anon)

1. Nel menu laterale sinistro in basso, clicca sull'icona dell'ingranaggio **Project Settings**.
2. Seleziona la voce **API Keys** (o **Data API** per l'URL):
   - **Project URL**: L'indirizzo del tuo progetto (es. `https://abcdefghijklm.supabase.co`).
   - **Publishable Key** (scheda *Publishable and secret API keys*): La chiave che inizia per `sb_publishable_...` (oppure la chiave `anon public` che inizia per `eyJhY...` nella scheda *Legacy anon, service_role API keys*).

> ⚠️ **IMPORTANTE**: Usa la **Publishable key** o la **anon public key**. **NON** usare mai la `Secret key` o la `service_role secret` nell'app client!

---

## 5. Ambienti & Credenziali (Produzione & Beta)

### 🟢 5.1 Credenziali Produzione (Ramo `main`)
- **Project URL**: `https://anipnkftlyemgpulycqo.supabase.co`
- **Publishable Key**: `sb_publishable_sOd-X1rlfMbyBwJ2tVdbUw_Q3tZf-oi`
- **Database Password**: `[Inserisci la password del DB Produzione]`
- **Target Vercel**: `Production`

### 🧪 5.2 Credenziali Beta (Ramo `beta`)
- **Project URL**: `https://aexlzsgmupwbyqwoyvoh.supabase.co`
- **Publishable Key**: `sb_publishable_RtEies-3GqL5H7KaV4oaqg_XfaTmZyr`
- **Database Password**: `[Password impostata per il DB Beta]`
- **Target Vercel**: `Preview`


