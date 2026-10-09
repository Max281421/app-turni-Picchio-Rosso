export default async function handler(req, res) {
  // Configurazione CORS per consentire chiamate dal frontend
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  try {
    const { imageBase64, mimeType } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ error: 'Immagine base64 mancante' });
    }

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!openrouterKey && !openaiKey && !geminiKey) {
      return res.status(500).json({
        error: 'Nessuna chiave API configurata (OPENROUTER_API_KEY, OPENAI_API_KEY o GEMINI_API_KEY).',
      });
    }

    const promptText = `
Analizza questa foto di un documento di trasporto (DDT) / scontrino termico / fattura del fornitore (es. F.lli Ciccarelli, MR.FOOD, AGRI 1, Stefani Group, MARR, DAC, Metro).
Estrai i dati esatti in formato JSON strutturato con questo schema:

{
  "supplier_name": "Nome della ditta/fornitore",
  "invoice_number": "Numero fattura o DDT",
  "invoice_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD",
  "total_amount": 0.00,
  "payment_status": "da_pagare",
  "items": [
    {
      "item_name": "Nome prodotto pulito",
      "quantity": 0.00,
      "unit_of_measure": "kg", 
      "pieces_per_package": 1,
      "unit_price": 0.00,
      "discount_percent": 0.00,
      "total_price": 0.00
    }
  ]
}

Regole di estrazione universali per TUTTI i documenti italiani:

1. DATA DOCUMENTO (FORMATO ITALIANO GG/MM/AAAA):
   - Nei documenti italiani la data è SEMPRE in formato GG/MM/AAAA (Giorno/Mese/Anno).
   - Esempio: '07/10/2026' o '07-10-2026' indica il 7 OTTOBRE 2026 ('2026-10-07'), NON il 10 Luglio!
   - Esempio: '08/10/2026' indica l'8 OTTOBRE 2026 ('2026-10-08').

2. NUMERO FATTURA / DDT:
   - Estrai l'intero codice alfanumerico esatto (es. '2400A/2026', '002235', '3.275'). Non saltare zeri centrali!

3. SCONTRINI TERMICISTI / VERTICALI (es. F.lli Ciccarelli S.r.l.):
   - Gli articoli sono stampati su righe sovrapposte:
     - Riga 1: Nome del prodotto (es. SEMOLA RIMACINATA DI GRANO DURO PIVETTI, CUBETTATO/JULIENNE 3 KG, SPIANATA PICCANTE 1/2 SV BOMBIERI, BRESAOLA PUNTA D' ANCA, PROVOLA 500G AFF CF/PZ SING.LIQUIDO, PORCINI REALE 4/4 Ca' de la marca).
     - Riga 2: 'euro/kg X.XX' oppure 'euro/pz X.XX'.
       * Se è scritto 'euro/kg X.XX', 'unit_of_measure' DEVE ESSERE 'kg' e 'unit_price' è X.XX!
       * Se è scritto 'euro/pz X.XX', 'unit_of_measure' DEVE ESSERE 'pezzi' e 'unit_price' è X.XX!
     - Riga 3: Eventuale aliquota IVA.
     - Riga 4: 'x [QUANTITÀ] = [TOTALE RIGA]' (es. 'x 10.00 = 12.00', 'x 12.00 = 84.00', 'x 2.23 = 20.07', 'x 1.34 = 30.82', 'x 0.50 = 3.65', 'x 1.00 = 8.50').
   - REGOLA QUANTITÀ: Il valore dopo la 'x ' (es. 10.00, 12.00, 2.23, 1.34, 0.50, 1.00) è la QUANTITÀ ('quantity'). Il valore dopo '=' è il TOTALE RIGA ('total_price'). Se il nome contiene '3 KG' o '500G', fa parte del nome commerciale, mentre la quantità reale acquistata è quella dopo la 'x '!

4. GESTIONE SCONTI MULTIPLI O SINGOLI (es. MR.FOOD '25%+5%' o '25%'):
   - Cerca sempre la colonna degli sconti (es. 'SCONTI %', 'Sc %', 'Sc.').
   - Se leggi sconti multipli come '25%+5%', calcola la percentuale reale di sconto combinata: 100 - (100 * 0.75 * 0.95) = 28.75%.
   - Se leggi '25%', imposta 'discount_percent' su 25.00.
   - Leggi il totale netto reale della riga dalla colonna 'TOTALE' a destra (es. 56.41 per pelati MR.FOOD, 18.73 per polpa fine MR.FOOD).

5. DOCUMENTI SU CARTA CHIMICA / MATRICE E PRODOTTI CONSUMABILI (es. AGRI 1):
   - Leggi anche fornitura legna/pellet per forno pizza o materiali consumabili (es. 'agri 1', DDT '3.275', 'LEGNA IN BILI', quantità '1.000', totale '272.73' o '299.99' con IVA).
   - 'unit_of_measure' per la legna: 'pezzi' o 'kg' o 'bancali'.

6. TABELLE DISTRIBUTORI A4 (es. Stefani Group, DAC, MARR, Metro):
   - Le colonne sono: [Codice] [Descrizione] [qxc/Num um] [Quantità] [Um (CT/CF/KG/PZ)] [Prezzo] [Sconti] [Totale]
   - 'unit_of_measure': 'cartoni' per CT o CF, 'kg' per KG, 'pezzi' per PZ.

7. ESCLUSIONE CAUZIONI:
   - Escludi solo righe intitolate 'CAUZIONI', 'PALLETS EPAL', 'BOMBOLE', 'RESI IMBALLI'.

Restituisci SOLO il JSON valido senza marcatori markdown o altro testo.
`;

    // 1. TENTATIVO CON OPENROUTER (Se configurato)
    if (openrouterKey) {
      // Modelli vision in ordine di preferenza per la massima accuratezza
      const modelsToTry = [
        'google/gemini-2.5-flash-image',
        'openai/gpt-4o-mini',
        'openai/gpt-4o'
      ];

      for (const modelName of modelsToTry) {
        try {
          const openRouterResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openrouterKey}`,
              'HTTP-Referer': 'https://app-turni-psi.vercel.app',
              'X-Title': 'App Turni Pizzeria',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: modelName,
              max_tokens: 1500,
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: promptText },
                    {
                      type: 'image_url',
                      image_url: {
                        url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`,
                      },
                    },
                  ],
                },
              ],
            }),
          });

          if (openRouterResp.ok) {
            const data = await openRouterResp.json();
            const content = data.choices?.[0]?.message?.content || '';
            const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
              return res.status(200).json(parsed);
            }
          } else {
            const errText = await openRouterResp.text();
            console.error(`Errore OpenRouter (${modelName}):`, errText);
          }
        } catch (err) {
          console.error(`Eccezione OpenRouter (${modelName}):`, err.message);
        }
      }
    }

    // 2. TENTATIVO CON OPENAI DIRECT (Se configurato)
    if (openaiKey) {
      const openAiResp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: promptText },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (openAiResp.ok) {
        const data = await openAiResp.json();
        const content = data.choices?.[0]?.message?.content || '';
        const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        return res.status(200).json(parsed);
      }
    }

    // 3. TENTATIVO CON GEMINI DIRECT (Se configurato)
    if (geminiKey) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
      const geminiResp = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: promptText },
                {
                  inline_data: {
                    mime_type: mimeType || 'image/jpeg',
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (geminiResp.ok) {
        const data = await geminiResp.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        return res.status(200).json(parsed);
      }
    }

    return res.status(500).json({ error: 'Nessun provider AI ha risposto con successo.' });
  } catch (error) {
    console.error('Errore API Serverless Vision:', error);
    return res.status(500).json({ error: error.message || 'Errore durante l\'analisi dell\'immagine' });
  }
}
