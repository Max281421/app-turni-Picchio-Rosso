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
Analizza questa foto di un documento di trasporto (DDT) / fattura per ristorante/pizzeria.
Estrai i dati esatti in formato JSON strutturato con questa schema:

{
  "supplier_name": "Nome fornitore (es. STEFANI GROUP SRL)",
  "invoice_number": "Numero bolla o fattura esatto (es. 01-B 057379)",
  "invoice_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD",
  "total_amount": 0.00,
  "payment_status": "da_pagare",
  "items": [
    {
      "item_name": "Nome prodotto pulito",
      "quantity": 0.00,
      "unit_of_measure": "cartoni", 
      "total_price": 0.00,
      "unit_price": 0.00
    }
  ]
}

Regole fondamentali di estrazione per massima precisione:

1. INTETESTAZIONE E NUMERO DOCUMENTO:
   - "invoice_number": Cerca il numero documento di consegna/bolla esatto (es. "01-B 057379" o "FT-2026/1044").
   - "supplier_name": Ragione sociale del fornitore (es. "STEFANI GROUP SRL").
   - "total_amount": Importo totale finale del documento comprensivo di IVA espresso in calce (es. 273.87).

2. ESTROLAZIONE TABELLA PRODOTTI:
   - Estrai TUTTI i prodotti/bevande/ingredienti consegnati nella tabella principale dei beni.
   - NOMI PULITI E ACCURATI: Leggi fedelmente le descrizioni senza storpiare le parole (es. "LIPTON I.TEA PESCA 1/2 PET", "COCA COLA SLEEK LATT. 0.33", "MORETTI 1/3 VP", "PERONI 1/3 VP", "CORONA 1/3 VP", "S.BEN. 1/1 NAT TOWER PET x12").
   - QUANTITÀ E UNITÀ:
     * Nella colonna Quantità/UM, se sono indicati cartoni/casse (es. "5 CT" o "2 CT" o "1 CT"), imposta quantity col numero di cartoni (es. 5) e unit_of_measure = "cartoni" (oppure "pezzi" moltiplicando per i pezzi per cassa "qxc").
   - PREZZO UNITARIO E TOTALE RIGA:
     * "unit_price": Prezzo unitario al cartone/confezione dalla colonna "Prezzo" (es. 14.87 per 1 cartone di Coca Cola).
     * "total_price": Prezzo totale dell'intera riga dalla colonna di destra "Totale" (es. 74.35 per 5 cartoni di Coca Cola = 5 * 14.87). NON scambiare mai il prezzo unitario con il totale riga!
   - VERIFICA MATEMATICA: Assicurati sempre che total_price sia uguale a (quantity * unit_price).

3. RIGOROSA ESCLUSIONE SEZIONI NON-PRODOTTO / IMBALLI:
   - ESCLUDI sistematicamente qualsiasi tabella o riga in basso intitolata "A DEBITO", "CAUZIONI", "PALLETS EPAL", "BOMBOLE", "RESI IMBALLI" o "VUOTI A RENDERE".
   - Quelli non sono ingredienti o bevande ma cauzioni/depositi di imballo a rendere che NON vanno caricati in magazzino.

4. Restituisci SOLO il JSON valido senza marcatori markdown o altro testo.
`;

    // 1. TENTATIVO CON OPENROUTER (Se configurato)
    if (openrouterKey) {
      const openRouterResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterKey}`,
          'HTTP-Referer': 'https://app-turni-psi.vercel.app',
          'X-Title': 'App Turni Pizzeria',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
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
        return res.status(200).json(parsed);
      } else {
        const errText = await openRouterResp.text();
        console.error('Errore OpenRouter API:', errText);
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
