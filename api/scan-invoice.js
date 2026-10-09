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
Analizza questa foto di un documento di trasporto (DDT) / scontrino termico / fattura del fornitore (es. F.lli Ciccarelli, Stefani Group, MARR, DAC, Metro).
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

Regole di estrazione universali per TUTTI i formati:

1. SCONTRINI TERMICISTI / VERTICALI (es. F.lli Ciccarelli, ricevute strette a cassa):
   - Gli articoli sono stampati su righe sovrapposte:
     - Riga 1: Nome del prodotto (es. SEMOLA RIMACINATA DI GRANO DURO PIVETTI, CUBETTATO/JULIENNE 3 KG, SPIANATA PICCANTE 1/2 SV BOMBIERI, BRESAOLA PUNTA D' ANCA, PROVOLA 500G, PORCINI REALE).
     - Riga 2: Prezzo unitario di listino e Unità di Misura indicati come 'euro/kg 1.20' oppure 'euro/pz 8.50'.
       * Se è scritto 'euro/kg X.XX', 'unit_of_measure' DEVE ESSERE 'kg'!
       * Se è scritto 'euro/pz X.XX', 'unit_of_measure' DEVE ESSERE 'pezzi'!
     - Riga 3: Eventuale aliquota IVA (es. IVA 4.00% o IVA 10.00%).
     - Riga 4: 'x [QUANTITÀ] = [TOTALE RIGA]' (es. 'x 10.00 = 12.00', 'x 12.00 = 84.00', 'x 2.23 = 20.07', 'x 1.34 = 30.82', 'x 0.50 = 3.65', 'x 1.00 = 8.50').
   - REGOLA QUANTITÀ vs PREZZO NEGLI SCONTRINI VERTICALI:
     - Il valore subito dopo la 'x ' (es. 10.00, 12.00, 2.23, 1.34, 0.50, 1.00) è la QUANTITÀ consegnata ('quantity').
     - Il valore dopo l'uguale '=' (es. 12.00, 84.00, 20.07, 30.82, 3.65, 8.50) è il TOTALE RIGA ('total_price').
     - Il valore dopo 'euro/kg' o 'euro/pz' è il PREZZO UNITARIO ('unit_price').
     - Se il nome del prodotto contiene indicazioni di confezione (es. 'CUBETTATO/JULIENNE 3 KG' o 'PROVOLA 500G'), mantieni quella descrizione nel NOME, ma imposta la quantità reale ('quantity') su quella espressa dopo la 'x ' (es. 12.00 o 0.50)!

2. TABELLE DISTRIBUTORI A4 (es. Stefani Group, DAC, MARR, Metro):
   - Le colonne sono: [Codice] [Descrizione] [qxc/Num um] [Quantità] [Um (CT/CF/KG/PZ)] [Prezzo] [Sconti] [Totale]
   - 'unit_of_measure': 'cartoni' per CT o CF, 'kg' per KG, 'pezzi' per PZ.
   - 'pieces_per_package': Numero pz per cartone/qxc (es. 24, 12, 15, 6). Se è a peso (kg) o pezzi singoli, imposta 1.

3. PRODOTTI SIMILI COME RIGHE SEPARATE:
   - Non unire prodotti con nomi o varianti simili (es. "PERONI 1/3" e "PERONI 2/3").

4. ESCLUSIONE CAUZIONI / IMBALLI:
   - Escludi righe intitolate "CAUZIONI", "PALLETS EPAL", "BOMBOLE", "RESI IMBALLI" o "VUOTI A RENDERE".

5. "total_amount": Importo totale finale del documento (es. 168.97 per Ciccarelli).

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
