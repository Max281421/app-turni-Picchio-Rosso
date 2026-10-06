---
title: "App Turni - Roadmap e Backlog"
project: "App Turni"
type: roadmap
tags:
  - app-turni/roadmap
  - app-turni/backlog
related_notes:
  - "[[App Turni - Documentazione e Link]]"
  - "[[ISTRUZIONI_DIPENDENTI]]"
  - "[[SUPABASE_SETUP]]"
  - "[[prompt-antigravity-app-turni]]"
last_updated: 2026-10-06
---

# 🗺️ ROADMAP E BACKLOG PROGETTO - APP TURNI

In questo documento sono tracciate le prossime funzionalità concordate, le personalizzazioni future per la pizzeria ed il backlog delle attività per l'applicazione **App Turni**.

---

## 🟡 Prossimi Sviluppi Programmati (Backlog & To-Do)

### 📌 1. Gestione Ferie, Malattia e Indisponibilità (Personalizzato per Pizzeria)
- **Stato**: *In Programmazione / Rimandato per approfondimento specifico*
- **Obiettivo**: Consentire ai dipendenti di inserire richieste di ferie o giorni di indisponibilità prima della pianificazione dei turni.
- **Specifiche per Pizzeria da Definire**:
  - Distinzione tra personale di Sala, Forno e Cucina.
  - Regole per i giorni di picco del weekend (Venerdì, Sabato, Domenica) con avvisi all'Admin se troppi dipendenti chiedono indisponibilità nella stessa serata.
  - Conteggio dedicato nel PDF per il commercialista per la distinzione tra giornate lavorate, ferie e malattia.

---

### 📌 2. Sistema di Notifiche (In-App / Push / Email)
- **Stato**: *In Valutazione Futura (Analisi di fattibilità completata)*
- **Obiettivo**: Inviare avvisi in tempo reale per cambi turno o comunicazioni dell'amministratore.

---

## 📊 Tabella Stato delle Funzionalità

| Funzionalità | Categoria | Stato | Note |
| :--- | :--- | :--- | :--- |
| **Login & Ruoli (Admin / Dipendente)** | Sicurezza | ✅ Completato | RLS Supabase attivo |
| **Schermata Default Admin ("I Miei Turni")** | UX / Admin | ✅ Completato | Impostata vista iniziale su turni personali |
| **Protezione Ruolo Admin** | Sicurezza | ✅ Completato | Solo l'Admin può cambiare i ruoli utente |
| **Modifica Nome e Cognome (TUTTI)** | Profilo | ✅ Completato | Modifica autonoma in "Gestione Profilo" |
| **Modifica Nome Dipendenti (Solo Admin)** | Profilo | ✅ Completato | Tasto "Modifica Nome" nel pannello Admin |
| **Gesture Pull-to-Refresh** | UX / Mobile | ✅ Completato | Trascina in basso per ricaricare la pagina |
| **Header Navbar Glass Card Riprogettato** | UI / Design | ✅ Completato | Angoli arrotondati 16px e bordo 360° |
| **Inserimento Turni Pranzo / Cena** | Core | ✅ Completato | Selezione multipla o spezzato |
| **Gestione Data 31 del Mese (No Bug UTC)** | Core | ✅ Completato | Generazione date locali pure YYYY-MM-DD |
| **Griglia Contatori 2x2 Mobile** | UX / UI | ✅ Completato | Layout ottimizzato per smartphone |
| **Esportatore Excel (.xlsx) 2 Fogli** | Commercialista | ✅ Completato | Bordi completi e iniziali giorno/mese |
| **Esportatore PDF Riepilogo & Griglia 1-31** | Commercialista | ✅ Completato | Formato A4 Verticale e Landscape |
| **Esportatore PDF Personale Dipendente** | Dipendenti | ✅ Completato | Layout ibrido con cartellino ed elenco date |
| **Storico Mesi Precedenti (fino a 6+ mesi)** | Dipendenti/Admin | ✅ Completato | Consultazione e download PDF storici |
| **PWA Installazione Schermata Home** | Mobile | ✅ Completato | Supporto iOS Safari e Android Chrome |
| **Deploy Produzione 24/7 su Vercel** | Cloud | ✅ Completato | URL: `https://app-turni-psi.vercel.app` |
| **Disponibilità Settimanali & Planning Admin** | Core / Pizzeria | ✅ Completato | Tabella `planned_shifts` 100% isolata dai turni mensili |
| **Esportazione & Condivisione WhatsApp 1-Click** | Pizzeria / WhatsApp | ✅ Completato | Rigorosamente solo Cene, formato pulito su singole righe |
| **Alias / Soprannomi Dipendenti per WhatsApp** | Pizzeria / WhatsApp | ✅ Completato | Campo `alias` su DB `employees`, modale Profilo & export |
| **Ruoli Operativi Multi-Settore (Cassa, Fattorino, Pizzeria)** | Core / Pizzeria | ✅ Completato | 3 calendari per settore, export WhatsApp settoriale, Box 2 |
| **Controllo Incrociato Turni & Discrepanze (Opzione 1)** | Sicurezza / Admin | ✅ Completato | Cross-check turni segnati vs planning con banner allerta e badge `🟢 Conforme` / `⚠️ Non a planning` |
| **Note / Motivazioni sui Turni** | Core / Dipendenti | ✅ Completato | Campo `note` in `ShiftModal.jsx`, backup LocalStorage e visibilità `📝` nell'Admin Dashboard |
| **Sovrascrittura Pulita Planning Settore** | Core / Admin | ✅ Completato | Purga automatica dei vecchi turni del settore per sbloccare subito i dipendenti deselezionati |
| **Layout Mobile & Scroll Modali Fluidi** | UI / Mobile | ✅ Completato | Blocco scroll di sfondo, modali con scroll interno, header sticky e griglia 7 giorni scrollabile orizzontalmente |
| **Barra Navigazione Fissa in Basso (Instagram-Style)** | UI / Mobile | ✅ Completato | Dock bar fissa ancorata sul fondo con 2/4 tab per ruolo ed adattamento iOS safe area |
| **Selezione Settori in Signup & Supporto 0 Settori** | Core / Account | ✅ Completato | Scelta settori in registrazione, possibilità di 0 settori e messaggio di avviso |
| **Esclusione Account Specifici dai PDF Commercialista** | Commercialista | ✅ Completato | Esclusi "Angelo Giuliano", "Antonio Rocco", "Saverio Nicoscia" dai PDF riepilogativi |
| **Pulsante Unificato "Modifica Account" (Admin)** | Admin / UX | ✅ Completato | Pulsante singolo `⚙️ Modifica Account` che apre `ProfileModal.jsx` per qualsiasi dipendente |
| **Gestione Magazzino, Inventario & Scansione Fatture AI Vision** | Magazzino / AI | ✅ Completato | Giacenze ingredienti, avvisi scorte minime, lettura foto fatture con Gemini Vision, auto-carico e archivio scadenze |
| **Modifica ed Eliminazione Dati Magazzino & Fatture** | Magazzino / UX | ✅ Completato | Tasti modifica/eliminazione su ingredienti e fatture, voci incolonnate in verticale a scomparsa |
| **Storico Prezzi & Confronto Fornitori Ingrediente** | Magazzino / Analytics | ✅ Completato | Metriche sintetiche (€/kg), confronto fornitori e timeline acquisti con badge trend % (`+X% 📈` / `-X% 📉`) |
| **Fix Grafico & Allineamento Centrato Icone** | UI / Design | ✅ Completato | Sostituita regola CSS non valida con `justifyContent: 'center'` su tutti i pulsanti ed i box |
| **Test Lettura Fatture Reali da Foto (Gemini Vision)** | Magazzino / AI | ✅ Completato | Testato su DDT reali fornitori (es. Stefani Group) con 100% estrazione esatta dei dati |
| **Gestione Pezzi per Cartone (qxc) e Conteggio Bottiglie** | Magazzino / AI | ✅ Completato | Campo `qxc`, calcolo bottiglie totali, rimozione suffissi `x24` dal nome e badge visivi |
| **Persistenza LocalStorage & Sincronizzazione Cloud Supabase** | Magazzino / Cloud | ✅ Completato | Sincronizzazione automatica due vie PC/Smartphone e fix permessi RLS (error 42501) |
| **Fix Critico Auth e Isolamento Profilo Admin** | Sicurezza | ✅ Completato | Risolto bug cancellazione admin durante rimozione dipendenti con helper `checkIsSelf` |
| **Gestione Sconti Articoli Fattura & Giacenze (AI Scan & Edit)** | Magazzino / AI | ✅ Completato | Riconoscimento AI sconti riga %, form editabile, ricalcolo prezzo netto unitario, badge visivi e storico prezzi |
| **Anteprima Foto Lightbox & Download Allegati Fatture** | Magazzino / UX | ✅ Completato | Visualizzazione in-app foto/PDF fattura archiviati, download 1-click e compressione Canvas client-side (~150-250KB JPEG) |
| **Ferie / Indisponibilità Pizzeria** | Pizzeria | 🟡 Programmato | Da definire con regole specifiche pizzeria |
| **Sistema di Notifiche** | Feature | ⚪ In Valutazione | Fattibile (In-App / Push / Email) |

---

## ❌ Funzionalità Escluse (Scartate per Inutilità)
- ❌ **Evidenziatore "Oggi"**: Non necessario, la data odierna è già risaltata dal bordo blu brillante.
- ❌ **Pulsante "Copia Mese Precedente"**: Valutato non utile per la dinamicità dei turni del locale.

---

## 🔗 Documenti del Progetto App Turni
- 📄 [[App Turni - Documentazione e Link]]: Documentazione master e configurazione produzioni.
- 📲 [[ISTRUZIONI_DIPENDENTI]]: Guida per i dipendenti all'uso dell'app.
- 🗄️ [[SUPABASE_SETUP]]: Guida alla configurazione del database.
- 📝 [[prompt-antigravity-app-turni]]: Prompt originale di creazione del progetto.
