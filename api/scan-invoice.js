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
Analizza questa immagine di fattura o documento di trasporto (DDT) di un fornitore per ristorante/pizzeria.
Estrai esattamente i seguenti dati in formato JSON valido:
{
  "supplier_name": "Nome della ditta/fornitore",
  "invoice_number": "Numero fattura o DDT",
  "invoice_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD",
  "total_amount": 0.00,
  "payment_status": "da_pagare",
  "items": [
    {
      "item_name": "Nome prodotto/ingrediente",
      "quantity": 0.00,
      "unit_of_measure": "kg", 
      "total_price": 0.00,
      "unit_price": 0.00
    }
  ]
}

Regole importanti:
1. "total_amount" deve essere il TOTALE FINALE FATTURA / DOCUMENTO espresso sul documento (COMPRESO IVA/TASSE E SPESE, ad esempio "TOTALE FATTURA" o "TOTALE DOCUMENTO" o "TOTALE A PAGARE"), non solo l'imponibile dei singoli beni.
2. "item_name" deve contenere la descrizione pulita del prodotto senza codici articolo iniziali (es. BUF-01, ART-123).
3. "unit_of_measure" deve essere una tra: kg, litri, buste, cartoni, pezzi.
4. "unit_price" è il prezzo al kg o per unità. Se non indicato esplicitamente, calcolalo dividendo total_price per quantity.
5. Restituisci SOLO il JSON valido senza marcatori markdown o altro testo.
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
          model: 'google/gemini-2.0-flash-001',
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

    // 2. TENTATIVO CON OPENAI (Se configurato)
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
