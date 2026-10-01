---
title: "App Turni - Documentazione Master"
project: "App Turni"
type: master_doc
tags:
  - app-turni/master
  - app-turni/documentazione
  - app-turni/produzione
related_notes:
  - "[[ROADMAP_E_BACKLOG]]"
  - "[[ISTRUZIONI_DIPENDENTI]]"
  - "[[SUPABASE_SETUP]]"
  - "[[prompt-antigravity-app-turni]]"
last_updated: 2026-10-01
---

# App Turni Ristorante & Catering 🍽️

Applicazione Web Progressive Web App (PWA) Full-Stack per la gestione dei turni del personale del ristorante/pizzeria con esportazioni automatizzate in Excel e PDF per il commercialista e per i dipendenti, controllo incrociato delle discrepanze ed interfaccia ottimizzata per mobile.

---

## 🌐 Link Ufficiali ed Ambienti (Produzione & Beta)

### 🟢 Ambiente di Produzione (Ramo `main`)
- **App Online (Vercel Produzione)**: [https://app-turni-psi.vercel.app](https://app-turni-psi.vercel.app)
- **Repository GitHub (Ramo Main)**: [https://github.com/Max281421/app-turni-Picchio-Rosso/tree/main](https://github.com/Max281421/app-turni-Picchio-Rosso/tree/main)
- **Database Supabase Produzione**:
  - **Project URL**: `https://anipnkftlyemgpulycqo.supabase.co`
  - **Publishable / Anon Key**: `sb_publishable_sOd-X1rlfMbyBwJ2tVdbUw_Q3tZf-oi`
  - **Database Password**: `[Inserisci la password del DB Produzione]`

---

## 📁 Percorso Codice Sorgente Progetto
Il codice sorgente dell'applicazione risiede sul PC al seguente percorso:
`C:\Users\aller\Documents\altro\App Turni`

---

## 🛠️ Comandi Utili per lo Sviluppo ed Aggiornamenti Futuri

Per aggiornare l'applicazione online dopo una modifica al codice:
1. Apri il terminale nella cartella del progetto:
   ```bash
   cd "C:\Users\aller\Documents\altro\App Turni"
   ```
2. Esegui il comando di pubblicazione automatica su Vercel:
   ```bash
   npx vercel --prod --yes
   ```

---

## 📄 Storico Funzionalità Implementate

### 🔑 1. Autenticazione & Gestione Profili (Sicurezza Ruoli & Nome)
- Registrazione ed accesso separato tra **Amministratore (Titolare)** e **Dipendente**.
- **Schermata Iniziale Admin**: All'apertura dell'app per l'Admin la schermata di default è **"I Miei Turni"**. L'admin può passare in qualsiasi momento a *"Tutti i Dipendenti"* dal selettore in Navbar.
- **Protezione Ruolo Admin**: I dipendenti **NON possono elevarsi autonomamente ad Admin**. Soltanto gli Admin possono promuovere o retrocedere un profilo dal pannello `Tutti i Dipendenti`.
- **Modifica Nome e Cognome per TUTTI**: Ogni utente può aggiornare il proprio "Nome Cognome" in *"Gestione Profilo"*.
- **Modifica Nome per Admin**: Gli Admin possono rinominare qualsiasi dipendente per uniformare gli account.

### 🔄 2. Gesture Pull-to-Refresh (Trascina in Basso per Ricaricare)
- Gesture touch nativa ed intuitiva: trascinando il dito verso il basso da smartphone o PWA compare l'indicatore fluido per ricaricare la pagina ed i dati all'istante.
- **Protezione Modali**: La gesture si disattiva automaticamente durante la compilazione dei turni per evitare ricaricamenti accidentali.

### 🎨 3. Riprogettazione Header Navbar (Design Glass Card)
- Intestazione trasformata in una card fluttuante con tutti e 4 gli angoli arrotondati (`16px`), margine superiore distanziato dalla barra dello smartphone e bordo sottile luminoso a 360°.

### 📅 4. Inserimento e Gestione Turni (Senza Bug Fuso Orario)
- Calendario mensile interattivo con gestione esatta delle date locali (es. 31 del mese).
- Selezione dei turni **Pranzo ☀️**, **Cena 🌙** o **Pranzo + Cena (Spezzato)**.
- **Griglia Contatori 2x2 su Mobile**: 4 card riepilogative (*Dipendenti Registrati, Turni Pranzo, Turni Cena, Totale Turni*) disposte su griglia 2 a 2.

### 📊 5. Esportazioni Excel (.xlsx) per il Commercialista
- **Sheet 1 (Riepilogo e Date)**: Colonne *Nome Dipendente*, *Date Esatte Lavorate*, *Turni Pranzo*, *Turni Cena*, *Totale Turni*, *Giorni Presenza (Totale)*.
- **Sheet 2 (Griglia 1-31 Cartellino)**: Colonne *Nome Dipendente*, giorni 1-31 con iniziali del giorno della settimana e mese (es. `S 1/8, D 2/8`), Totali e bordatura nera sottile su ogni singola cella.

### 📄 6. Esportazioni PDF (Admin e Dipendente)
- **PDF Riepilogo Admin (Verticale A4)**: Tabella bordata completa del riepilogo mensile dipendenti con riga finale di Totale Generale.
- **PDF Griglia 1-31 Admin (Orizzontale A4 Landscape)**: Griglia cartellino mensile 1-31 formattata in landscape A4 per la stampa.
- **PDF Resoconto Personale Dipendente (Ibrido Landscape)**: Tabella riepilogativa, griglia cartellino 1-31 ed elenco dettagliato delle date lavorate nel mese generato con 1 click dal dipendente.

### 📜 7. Navigazione Storico Mesi Precedenti
- Navigazione libera con frecce `<` e `>` per consultare i turni dei mesi precedenti (fino a 6+ mesi indietro) e scaricare i resoconti PDF storici.

### 📱 8. Progressive Web App (PWA)
- Installabile come applicazione nativa sulla home screen di **iOS (Safari)** e **Android (Chrome)** con icona personalizzata e funzionamento a tutto schermo.

### 🗓️ 9. Gestione Planning Settimanale Pubblicato & Tabella `planned_shifts`
- **Isolamento Rigido del Commercialista**: Il salvataggio del planning settimanale scrive esclusivamente sulla nuova tabella `planned_shifts` senza toccare la tabella `shifts` usata per i report mensili lavorati del commercialista.
- **Layout a 2 Box nella Pagina Disponibilità**:
  - **Box 1 (Inserimento Disponibilità)**: Selezione disponibilità personali (Pranzo e Cena) per dipendenti, o griglia di assegnazione per Admin.
  - **Box 2 (Turni Confermati dall'Admin)**: Griglia dei turni confermati (Pranzo e Cena) visibile a tutti i dipendenti con controlli di navigazione della settimana integrati (`<` `Oggi` `>`) per consultare facilmente lo storico delle settimane passate dello stesso mese.
- **Regole Specifiche Pizzeria**:
  - **Martedì Chiuso**: Card grigia disabilitata con etichetta `🔒 CHIUSO`.
  - **Domenica Pranzo Chiuso**: Slot pranzo disattivato e layout con allineamento orizzontale automatico del tasto Cena su tutti i giorni.

### 💬 10. Esportazione WhatsApp Pulita 1-Click (Solo Cene)
- Generazione istantanea del messaggio per il gruppo WhatsApp del personale.
- Considera **rigorosamente solo i turni di CENA** (`turno === 'cena'`).
- Formattazione pulita su singole righe per giorno (es. `LUN ALLE GIGI SAM`, `MER ANTO VICHI`), senza alcuna riga aggiuntiva di intestazione o piè di pagina.

### 🏷️ 11. Supporto Alias / Soprannomi Dipendenti per WhatsApp
- Aggiunta colonna `alias` alla tabella `public.employees`.
- Ogni utente (o l'Admin per suo conto) può impostare un **Alias / Soprannome** personalizzato dal menu *"Gestione Profilo"*.
- L'esportatore WhatsApp utilizza prioritariamente l'alias in maiuscolo (es. `ALLE`, `GIGI`, `ROBY`) con fallback automatico al primo nome di battesimo se vuoto.

### 🍕 12. Gestione Settori Operativi Multi-Ruolo (Cassa, Fattorino, Pizzeria)
- **Ruoli Operativi Indipendenti**: Tre ruoli operativi (**💵 Cassa**, **🛵 Fattorino**, **🍕 Pizzeria**) salvati come array `mansioni TEXT[]` nella tabella `public.employees`. Un dipendente può assumere più settori contemporaneamente.
- **Tre Calendari Settimanali per Settore nel Planning Admin**: Nella pagina *Planning Settimanale*, l'Admin può passare da un settore all'altro tramite i tab **💵 Cassa**, **🛵 Fattorino**, **🍕 Pizzeria**. Gli slot dei turni vengono salvati isolatamente specificando la colonna `mansione` nella tabella `planned_shifts`.
- **Tasti Dedicati di Pubblicazione ed Esportazione WhatsApp per Settore**: Ciascun settore possiede i propri pulsanti **"Pubblica Planning [Settore]"** e **"Condividi [Settore] su WhatsApp"**.
- **Messaggio WhatsApp 100% Pulito ed Intestazioni Assenti**: Generazione delle sole linee di codici giorni ed alias/nomi per il settore selezionato (es. `LUN ALLE GIGI`), mantenendo la totale assenza di intestazioni.
- **Turni Confermati Suddivisi per Settore (Box 2)**: Nel Box 2 della pagina *Le mie disponibilità*, i turni confermati vengono mostrati ripartiti con le icone ed i colori dei settori (**💵 Cassa**, **🛵 Fattorino**, **🍕 Pizzeria**) con controllo di navigazione delle settimane (`<` `Oggi` `>`).

### ⚠️ 13. Controllo Incrociato Turni (Discrepanze) & Note Motivazionali Dipendenti
- **Cross-Check Incrociato Automatico**: L'Admin Dashboard confronta in tempo reale i turni segnati dai dipendenti (`shifts`) con il planning settimanale pubblicato dall'Admin (`planned_shifts`).
- **Banner Globale di Allerta**: In presenza di turni inseriti autonomamente dai ragazzi non previsti dal planning, appare un banner in evidenza: `⚠️ Discrepanze Rilevate: X turni non presenti a planning`.
- **Badge di Conformità**:
  - `🟢 Conforme`: Il dipendente ha segnato esattamente i turni concordati.
  - `⚠️ X Non a planning`: Indica il numero di turni extra o non pianificati segnati dal dipendente.
- **Campo Note / Motivazione (`ShiftModal.jsx`)**: Inserimento opzionale di note spiegative per cambi turno o sostituzioni (es. *"Sostituito Mario a cena"*). Le note sono visibili direttamente nel cruscotto Admin con l'icona `📝`.

### 🔄 14. Sovrascrittura Pulita dei Planning di Settore
- Ogni volta che l'Admin clicca su *"Pubblica Planning [Settore]"*, il sistema esegue una **cancellazione pulita dei soli turni precedenti di quel settore** per la settimana e ri-accredita unicamente le selezioni attive.
- Se un dipendente viene deselezionato ed il settore viene repubblicato, il dipendente torna immediatamente libero e selezionabile per gli altri settori.

### 📱 15. Ottimizzazione Layout Mobile & Finestre Modal (PWA/Smartphone)
- **Blocco Scroll di Sfondo (`body.modal-open`)**: All'apertura di qualsiasi modal (Profilo, Turni, Settori), lo scrolling della pagina sottostante viene congelato.
- **Scroll Interno alla Modal**: Modali con altezza limitata (`max-height: 85vh`/`88vh`), scrolling interno touch e pulsante **"Chiudi Finestra"** in fondo.
- **Header Appuntata (`modal-header-sticky`)**: Titolo ed icona di chiusura `[X]` rimangono sempre ancorati in alto durante lo scorrimento dei moduli.
- **Griglia 7 Giorni Orizzontale (`.weekly-planning-grid-container`)**: Griglia settimanale scrollabile lateralmente con larghezza minima garantita (`min-width: 145px` per giorno) e badge guida `← Scorri orizzontalmente per vedere tutti i 7 giorni →`. I nomi (*Giuseppe Verdi*, *Mario Rossi*) non vengono più schiacciati o troncati.

### 📱 16. Barra di Navigazione Fissa in Basso (Instagram-Style Tab Bar)
- **Dock Bar Fissa Ancorata (`position: fixed`, `bottom: 0`, `z-index: 900`)**: Spostati tutti i pulsanti di navigazione tra le pagine dalla Navbar superiore ad una barra fluttuante inferiore in stile app nativa iOS / Instagram.
- **Adattamento Dinamico per Ruolo**:
  - **Dipendente (2 tasti)**: `📅 I Miei Turni`, `📋 Le Mie Disponibilità`.
  - **Admin (4 tasti)**: `📅 I Miei Turni`, `👥 Tutti i Dipendenti`, `📋 Le Mie Disponibilità`, `🍕 Planning Settimanale`.
- **Design Glassmorphic & Safe-Area Mobile**: Sfondo semitrasparente sfocato (`backdrop-filter: blur(16px)`), pillola attiva gradiente e margine inferiore automatico della pagina (`padding-bottom: 90px`) per prevenire la sovrapposizione dei contenuti.

### 📝 17. Selezione Settori in Registrazione & Supporto a 0 Settori
- **Griglia Settori in Signup**: Nella pagina di creazione dell'account (`Login.jsx`), il nuovo dipendente può scegliere fin da subito i settori a cui appartiene (**💵 Cassa**, **🛵 Fattorino**, **🍕 Pizzeria**).
- **Possibilità di Deselezionare Tutti i Settori (0 Settori)**: Sia in registrazione che nella gestione del profilo (`ProfileModal.jsx`), è consentito deselezionare tutti e tre i settori. Un account senza settori operativi non apparirà nei planning settoriali e mostrerà il messaggio: `⚠️ Nessun settore selezionato. L'account non apparirà nei planning settoriali.`

### 📑 18. Esclusione Account Specifici dai PDF per il Commercialista
- **Filtraggio Automatico nei Report PDF**: Gli account **"Angelo Giuliano"**, **"Antonio Rocco"** e **"Saverio Nicoscia"** vengono esclusi automaticamente dai PDF di riepilogo per il commercialista (`exportSummaryToPDF` ed `exportGridToPDF` in `src/lib/pdfExport.js`) in quanto retribuiti separatamente.
- **Totali Dinamici**: I totali delle presenze e dei turni calcolati in calce al PDF ricalcolano solo i dipendenti inclusi.

### ⚙️ 19. Pulsante Unificato "Modifica Account" nell'Admin Dashboard
- **Sostituzione Pulsanti Sparsi**: I vecchi pulsanti sparsi (*Modifica Settori*, *Imposta come Dipendente*, *Modifica Nome*, *Elimina Dipendente*) sono stati sostituiti da un unico pulsante pulito **`⚙️ Modifica Account`**.
- **Gestione Unificata Profilo (`ProfileModal.jsx`)**: Cliccando su `⚙️ Modifica Account`, l'Admin apre la modale del profilo pre-compilata per il dipendente target, modificando in un'unica vista: **Nome e Cognome**, **Alias / Soprannome WhatsApp**, **Settori Operativi (inclusa l'opzione 0 settori)**, **Ruolo (Admin/Dipendente)** ed **Eliminazione Account con doppia conferma**.

### 📦 20. Modulo Gestione Magazzino, Inventario & Scansione Fatture AI Vision
- **Dashboard Magazzino (`InventoryDashboard.jsx`)**: Integrazione del 5° pulsante **`📦 Magazzino`** nella Bottom Navigation Bar per gli Admin.
- **Giacenze in Tempo Reale (`InventoryList.jsx`)**: Elenco interattivo degli ingredienti divisi per categoria con filtri rapidi, avvisi visivi in ROSSO per le scorte minime in esaurimento e modale per la rettifica rapida delle quantità.
- **Scansione Fatture AI (`InvoiceScanForm.jsx` & `geminiVision.js`)**: Scatto foto da fotocamera smartphone o caricamento file/PDF ed estrazione automatica tramite **Vision AI** di Fornitore, N° Fattura, Data, Totale e la lista prodotti con quantità e **prezzo al kg (€/kg)**. Conferma guidata con auto-carico immediato nell'inventario.
- **Archivio Fatture & Scadenzario (`InvoiceArchive.jsx`)**: Registro con riepilogo della spesa mensile (€), scadenze pagamenti, filtri di stato (*Pagato, Da Pagare, Scaduto*) e toggle rapido a 1-tap.
- **Anagrafica Fornitori (`SupplierModal.jsx`)**: Gestione contatti e ditte fornitori.

### ✏️ 21. Modifica, Eliminazione Dati & Viste Dettaglio a Scomparsa (Ingrediente e Fatture)
- **Modifica ed Eliminazione Ingredienti (`InventoryList.jsx`)**: Tasto di modifica `Edit3` e cancellazione per ciascun ingrediente registrato.
- **Modifica ed Eliminazione Fatture (`InvoiceArchive.jsx`)**: Modifica completa dei dati della fattura (fornitore, n° documento, totale, date, stato pagamento) ed eliminazione definitiva dell'intero documento.
- **Ingredienti in Fattura Incolonnati in Verticale**: Per ogni fattura salvata, l'elenco degli ingredienti contenuti è disposto verticalmente e nascosto di default, espandibile a scomparsa con 1-tap sull'entità.

### 📈 22. Storico Prezzi & Confronto Fornitori per Ingrediente (`PriceHistoryModal.jsx`)
- **Metriche Sintetiche**: Ultimo prezzo, prezzo minimo, massimo e prezzo medio al kg/unità calcolati in automatico per ogni ingrediente.
- **Confronto tra Fornitori**: Tabella comparativa dei prezzi praticati da diversi fornitori per lo stesso ingrediente con indicazione dell'ultima consegna e del range di prezzo.
- **Cronologia Acquisti & Badge Trend %**: Timeline storica degli acquisti con badge colorati di variazione percentuale rispetto all'acquisto precedente (`+X% 📈` o `-X% 📉`).

### 🎨 23. Perfezionamento Layout Dark Glassmorphic & Fix Centratura Icone
- **Allineamento Icone Standardizzato**: Corretta la centratura di tutte le icone dell'interfaccia (`justifyContent: 'center'`) sia nei box fluttuanti che sui pulsanti d'azione da mobile PWA e da desktop.

### 📦 24. Gestione Pezzi per Cartone (qxc) e Conteggio Bottiglie
- **Tracciamento Bottiglie & Unità Cartone**: Quando viene selezionata l'unità di misura "Cartone" per bevande o articoli confezionati, l'app abilita il campo dedicato **Pz / Cartone (qxc)** (`pieces_per_package`).
- **Calcolo Automatico Giacenze Bottiglie**: Visualizzazione dinamica e immediata del numero totale di bottiglie/pezzi singoli (es. `5 cartoni × 24 pz = 120 bottiglie totali`) con badge dedicati sia nel form di scansione fattura (`InvoiceScanForm.jsx`), sia nell'elenco magazzino (`InventoryList.jsx`), sia nello storico fatture (`InvoiceArchive.jsx`).
- **Pulizia del Nome dell'Ingrediente**: Rimozione automatica delle indicazioni di pezzi per cartone (es. `x24`, `x15`, `x12`) dal nome dell'ingrediente durante la scansione AI Vision (`scan-invoice.js`), separando la descrizione del prodotto dalla sua confezione.

### 🔄 25. Persistenza Locale (`localStorage`) e Sincronizzazione Cloud Supabase Multi-Dispositivo
- **Salvataggio Istantaneo Locale**: Archiviazione immediata in `localStorage` su PC e Smartphone per evitare perdite di dati o rallentamenti di rete.
- **Sincronizzazione Automatica Cloud**: Implementata la funzione `syncLocalWithSupabase` in `InventoryDashboard.jsx` che allinea automaticamente il database Supabase cloud e il dispositivo locale ad ogni apertura/ricaricamento dell'app.
- **Risoluzione Permessi SQL RLS (Error 42501)**: Aggiornate le policy di Row Level Security (RLS) e concessi i permessi `GRANT ALL ON TABLE ... TO anon, authenticated, service_role` per garantire la sincronizzazione bidirezionale trasparente tra PC e smartphone.
- **Pulizia Dati Demo**: Rimossi definitivamente dal database Supabase i 6 articoli di test iniziali per evitare contaminazioni nell'inventario reale.

### 🔒 26. Fix Critico Sicurezza Auth (`deleteAccount` e `updateEmployeeRole`)
- **Isolamento Profilo Admin**: Risolto il bug in `AuthContext.jsx` dove l'eliminazione o il cambio di ruolo di un altro dipendente tramite query Supabase `.or('id.eq.TARGET,auth_user_id.eq.ADMIN')` provocava accidentalmente la cancellazione/alterazione del profilo dell'admin esecutore ed il conseguente logout forzato.
- **Helper `checkIsSelf`**: Aggiunta la funzione helper `checkIsSelf(targetId)` per verificare prima di ogni mutazione se l'operazione riguarda il profilo dell'utente correntemente autenticato, garantendo il totale isolamento dei ruoli e la protezione degli account Admin.

---

## 🔗 Documenti del Progetto App Turni
- 🗺️ [[ROADMAP_E_BACKLOG]]: Funzionalità future programmate e stato aggiornato.
- 📲 [[ISTRUZIONI_DIPENDENTI]]: Guida passo-passo all'uso per i dipendenti e salvataggio PWA.
- 🗄️ [[SUPABASE_SETUP]]: Schema SQL, indici, funzioni ed architettura database.
- 📝 [[prompt-antigravity-app-turni]]: Prompt originale di creazione del progetto.
