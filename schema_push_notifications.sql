-- ==========================================
-- TABELLA NOTIFICHE PUSH (WEB PUSH VAPID)
-- App Turni - Sottoscrizioni Notifiche Push
-- ==========================================

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

-- Abilita RLS su push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy per consentire lettura/scrittura a tutti gli utenti dell'app
DROP POLICY IF EXISTS "Allow all access to push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Allow all access to push_subscriptions" 
    ON public.push_subscriptions 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- Permessi per Ruoli Anon e Authenticated
GRANT ALL ON TABLE public.push_subscriptions TO anon, authenticated, service_role;
