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
Analizza questa foto di un documento di trasporto (DDT) / fattura del fornitore (es. Stefani Group Srl, MARR, DAC, Metro).
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
      "item_name": "Nome prodotto pulito (senza x24, x12, x15 alla fine)",
      "quantity": 0.00,
      "unit_of_measure": "cartoni", 
      "pieces_per_package": 24,
      "total_price": 0.00,
      "unit_price": 0.00
    }
  ]
}

Regole fondamentali di estrazione per massima precisione:

1. GUIDA COLONNE TABELLA DISTRIBUTORI (es. Stefani Group, DAC, MARR):
   Nelle tabelle dei distributori alimentari e bevande in Italia, le colonne sono disposte nell'ordine:
   [Codice] [Descrizione del bene] [Num. um (pezzi per cassa/qxc)] [Quantità (numero casse/cartoni)] [Um (CT/CF)] [Prezzo (prezzo al cartone)] [Sconti] [Totale (importo riga)]

   REGOLE SULLE COLONNE:
   - "pieces_per_package": DEVE ESSERE IL NUMERO DI PEZZI PER CARTONE/CASSA riportato nella colonna 'Num. um' o 'qxc' (es. 24, 12, 15, 6, 20). Se non specificato, imposta 1.
   - "item_name": NOME PULITO DEL PRODOTTO. Rimuovi dal nome eventuali moltiplicatori di imballo alla fine come "X 24", "x24", "X 12", "x12", "x15", "x20" (es. "COCA COLA SLEEK LATT. 0.33 X 24" diventa "COCA COLA SLEEK LATT. 0.33", "S.BEN. 1/1 NAT TOWER ANNIA PET x12" diventa "S.BEN. 1/1 NAT TOWER ANNIA PET"). MANTIENI SEMPRE numeri di varianti come "1/3 VP", "2/3 VP", "0.33", "0.5"!
   - "quantity": DEVE ESSERE IL NUMERO DI CARTONI/CASSE CONSEGNATI riportato nella colonna "Quantità" (es. 5 per Coca Cola Sleek, 2 per Coca Cola Zero, 1 per Lipton Tea, 1 per Moretti, 1 per Peroni 1/3, 2 per Peroni 2/3, 1 per Corona, 2 per S.Ben Nat, 2 per S.Ben Gas). NON prendere il valore della colonna 'Num. um' o 'qxc'!
   - "unit_of_measure": "cartoni" (se la colonna Um indica CT o CF) o "pezzi" o "kg" o "litri".
   - "unit_price": Prezzo unitario al cartone dalla colonna "Prezzo" (es. 14.87 per 1 cartone di Coca Cola).
   - "total_price": Prezzo totale della riga dalla colonna di destra "Totale" (es. 74.35 per 5 cartoni di Coca Cola = 5 * 14.87; 29.74 per 2 cartoni = 2 * 14.87).
   - VERIFICA MATEMATICA: Assicurati sempre che total_price sia uguale a (quantity * unit_price).

2. PRODOTTI SIMILI COME RIGHE SEPARATE (NESSUNA FUSIONE):
   - Prodotti con nomi o varianti simili (es. "PERONI 1/3 VP BIRRA PERONI SRL" e "PERONI 2/3 VP BIRRA PERONI SRL") sono DUE PRODOTTI DIVERSI e DEVONO essere due elementi separati nell'array "items". NON UNIRLI O ELIMINARLI MAI!

3. RIGOROSA ESCLUSIONE SEZIONI NON-PRODOTTO / IMBALLI:
   - ESCLUDI completamente qualsiasi tabella o riga in basso intitolata "A DEBITO", "CAUZIONI", "PALLETS EPAL", "BOMBOLE", "RESI IMBALLI" o "VUOTI A RENDERE".
   - Quelli non sono ingredienti o bevande ma cauzioni/depositi di imballo a rendere che NON vanno caricati in magazzino.

4. "total_amount": Importo totale finale espresso in calce alla voce Totale documento (es. 273.87).

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
