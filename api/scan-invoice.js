import { GoogleGenerativeAI } from '@google/generative-ai';

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

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Chiave API non configurata sul server' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
1. "total_amount" deve essere il TOTALE FINALE FATTURA / DOCUMENTO espresso sul documento (COMPRESO IVA/TATTURE E TASSE, ad esempio indicato come "TOTALE FATTURA" o "TOTALE DOCUMENTO" o "TOTALE A PAGARE"), non solo l'imponibile dei singoli beni.
2. "item_name" deve contenere la descrizione pulita del prodotto. Rimuovi eventuali codici articolo iniziali (es. BUF-01, ART-12, COD-99).
3. "unit_of_measure" deve essere una tra: kg, litri, buste, cartoni, pezzi.
4. "unit_price" è il prezzo al kg o per unità. Se non indicato esplicitamente, calcolalo dividendo total_price per quantity.
5. Restituisci SOLO il JSON valido senza marcatori markdown o testo aggiuntivo.
`;

    const result = await model.generateContent([
      promptText,
      {
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: imageBase64,
        },
      },
    ]);

    const responseText = result.response.text();
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Errore API Serverless Vision:', error);
    return res.status(500).json({ error: error.message || 'Errore durante l\'analisi dell\'immagine' });
  }
}
