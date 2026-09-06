# Guida Passo Passo: Configurazione Supabase per App Turni

Guida semplice e dettagliata per configurare il backend gratuito di Supabase.

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
3. Apri il file `supabase/schema.sql` situato in questo progetto, copia l'intero contenuto ed incollalo nel grande riquadro bianco dell'SQL Editor.
4. Clicca sul pulsante **Run** in basso a destra (o in alto a destra).
5. Vedrai comparire il messaggio `Success. No rows returned`. Le tabelle `employees`, `shifts` e la sicurezza RLS sono state create con successo!

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
- **Publishable Key**: `sb_publishable_RtEics-3GqLSH7KaV4oaqg_...`
- **Database Password**: `[Password impostata per il DB Beta]`
- **Target Vercel**: `Preview`

