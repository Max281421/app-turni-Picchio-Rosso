# Prompt per Antigravity — App Tracciamento Turni

## Contesto

Devo sviluppare un'applicazione web (PWA, Progressive Web App) per il tracciamento dei turni di lavoro di un piccolo team (circa 20 dipendenti) in un'attività di ristorazione. Ogni fine mese, il datore di lavoro deve inviare al commercialista un riepilogo dei turni (pranzo/cena) lavorati da ciascun dipendente.

L'app deve permettere a ogni dipendente di segnare i propri turni lavorati durante il mese, e a un utente admin (il datore di lavoro) di visualizzare i turni di tutti i dipendenti ed esportare un riepilogo mensile consolidato in formato Excel, pronto per essere inviato al commercialista.

## Requisiti tecnici

- **Frontend**: React (con Vite), sviluppato come PWA installabile su Android e iOS tramite "Aggiungi a Home" da browser, senza passare per App Store / Play Store (vincolo di costo zero, niente Apple Developer Program).
- **Backend**: Supabase (Postgres + autenticazione + API REST), piano gratuito.
- **Design**: interfaccia mobile-first, semplice e intuitiva, utilizzabile da persone non esperte di tecnologia.
- Il manifest PWA e il service worker devono essere configurati correttamente per garantire l'installabilità su iOS (Safari) e Android (Chrome).

## Ruoli utente

1. **Dipendente**: si autentica (login semplice, es. email + password gestita da Supabase Auth), può:
   - Inserire un turno lavorato per una data specifica, specificando se pranzo, cena, o entrambi
   - Visualizzare/modificare/eliminare i propri turni già inseriti
   - Vedere un riepilogo dei turni fatti nel mese corrente (e idealmente nei mesi precedenti)

2. **Admin** (il datore di lavoro): oltre alle funzionalità del dipendente sui propri turni (se applicabile), può:
   - Visualizzare i turni di tutti i dipendenti, filtrabili per mese
   - Esportare un file Excel (.xlsx) con il riepilogo mensile consolidato di tutti i dipendenti (una riga per dipendente/data/turno, o formato tabellare equivalente facilmente leggibile da un commercialista)

## Modello dati (proposta di partenza, modificabile se necessario)

**Tabella `employees`**
- `id` (uuid, PK)
- `auth_user_id` (uuid, collegato a Supabase Auth)
- `nome` (text)
- `ruolo` (enum: `dipendente`, `admin`)

**Tabella `shifts`**
- `id` (uuid, PK)
- `employee_id` (uuid, FK verso `employees`)
- `data` (date)
- `turno` (enum: `pranzo`, `cena`)
- `created_at` (timestamp)

Applicare Row Level Security (RLS) su Supabase in modo che:
- ogni dipendente possa leggere/scrivere solo i propri turni
- l'admin possa leggere i turni di tutti i dipendenti

## Cosa mi aspetto come output

- Struttura di progetto React completa e funzionante, collegata a un progetto Supabase (chiedimi le credenziali/chiavi API quando servono, non inventarle)
- Schema del database Supabase (script SQL o istruzioni per crearlo da dashboard)
- Le schermate principali: login, "i miei turni" (dipendente), dashboard admin con vista di tutti i dipendenti ed esportazione Excel
- Configurazione PWA funzionante e testata (manifest, service worker, icone)
- Verifica che l'app funzioni correttamente testandola tu stesso nel browser prima di considerarla completa

## Nota

Non ho competenze di programmazione: se devo eseguire comandi manualmente (es. terminale, configurazione Supabase da dashboard), spiegami passo passo cosa fare, senza dare per scontato che io sappia già come muovermi nell'ambiente di sviluppo.
