/**
 * Service per la scansione ed estrazione automatica dei dati da immagini di fatture e DDT
 * utilizzando Vision AI (Gemini 1.5 Flash API) o modalità simulazione/demo.
 */

// Helper per convertire un file in base64
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Scansiona l'immagine di una fattura ed estrae i dati in formato JSON strutturato.
 * @param {File} file - Il file foto o PDF caricato dall'utente
 * @param {string} [apiKey] - Opzionale API Key Gemini
 * @returns {Promise<Object>} Oggetto con i dati estratti della fattura e delle singole voci
 */
export async function analyzeInvoiceImage(file, apiKey = null) {
  const envKey = import.meta.env?.VITE_GEMINI_API_KEY;
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;
  const keyToUse = apiKey || localKey || envKey;

  // Se è presente l'API key, tentiamo la chiamata reale a Google Gemini Vision
  if (keyToUse) {
    try {
      const base64Data = await fileToBase64(file);
      const mimeType = file.type || 'image/jpeg';

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
1. "unit_of_measure" deve essere una tra: kg, litri, buste, cartoni, pezzi.
2. "unit_price" è il prezzo al kg o per unità. Se non indicato esplicitamente, calcolalo dividendo total_price per quantity.
3. Restituisci SOLO il JSON valido senza marcatori markdown o testo aggiuntivo.
`;

      const modelsToTry = [
        'gemini-2.0-flash',
        'gemini-1.5-flash-latest',
        'gemini-2.5-flash',
      ];

      let lastError = null;

      for (const modelName of modelsToTry) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${keyToUse}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': keyToUse,
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { text: promptText },
                      {
                        inline_data: {
                          mime_type: mimeType,
                          data: base64Data,
                        },
                      },
                    ],
                  },
                ],
                generationConfig: {
                  temperature: 0.1,
                  response_mime_type: 'application/json',
                },
              }),
            }
          );

          if (response.ok) {
            const result = await response.json();
            const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textResponse) {
              const parsed = JSON.parse(textResponse);
              return formatExtractedInvoice(parsed);
            }
          } else {
            const errData = await response.json().catch(() => ({}));
            let errorMsg = errData?.error?.message || `Errore HTTP ${response.status}`;
            const errReason = errData?.error?.details?.[0]?.reason || '';

            if (keyToUse.startsWith('AQ.') || errReason === 'ACCESS_TOKEN_TYPE_UNSUPPORTED' || errReason === 'API_KEY_SERVICE_BLOCKED') {
              errorMsg = '⚠️ La chiave utilizzata (' + keyToUse.substring(0, 8) + '...) è una chiave di Service Account Google Cloud non supportata direttamente per l\'API REST. Serve una API Key di Google AI Studio che inizia con "AIzaSy...". Crea una chiave gratuita su aistudio.google.com/app/apikey.';
            } else if (errorMsg.includes('prepayment credits') || errorMsg.includes('depleted')) {
              errorMsg = 'Il progetto è impostato su "Pagamento Anticipato" con credito 0€. Per usarlo 100% GRATIS: vai su aistudio.google.com/app/apikey, e nella colonna "Livello di fatturazione" seleziona "Livello gratuito" (Free Tier), oppure crea una nuova chiave in "Default Gemini Project".';
            } else if (response.status === 401) {
              errorMsg = 'Chiave non autorizzata (HTTP 401). Genera una API Key gratuita su aistudio.google.com/app/apikey (deve iniziare con AIzaSy...).';
            }
            lastError = new Error(errorMsg);
            if (response.status !== 404 && !errorMsg.includes('not found')) {
              throw lastError;
            }
          }
        } catch (mErr) {
          lastError = mErr;
          if (mErr.message.includes('401') || mErr.message.includes('403')) {
            throw mErr;
          }
        }
      }

      if (lastError) throw lastError;
    } catch (err) {
      console.warn('Scansione Gemini AI non riuscita, passaggio a Modalità Assistita:', err.message);
      const fallbackData = await getFallbackInvoiceData(file);
      fallbackData.fallback_notice = `Fattura analizzata in Modalità Assistita (${err.message}). Puoi verificare o modificare tutti i dati prima di salvare.`;
      return fallbackData;
    }
  }

  return await getFallbackInvoiceData(file);
}

async function getFallbackInvoiceData(file) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const fileName = file?.name?.toLowerCase() || '';

  if (fileName.includes('mulino') || fileName.includes('capriati')) {
    return {
      supplier_name: 'Mulino Capriati Srl',
      invoice_number: 'F-2026/0892',
      invoice_date: today,
      due_date: nextMonth,
      total_amount: 184.00,
      payment_status: 'da_pagare',
      items: [
        { item_name: 'Farina Tipo 00 Pizzeria', quantity: 50.0, unit_of_measure: 'kg', total_price: 65.00, unit_price: 1.30 },
        { item_name: 'Semola Rimacinata di Grano Duro', quantity: 25.0, unit_of_measure: 'kg', total_price: 37.50, unit_price: 1.50 },
        { item_name: 'Lievito Fresco di Birra', quantity: 5.0, unit_of_measure: 'kg', total_price: 16.50, unit_price: 3.30 },
        { item_name: 'Olio Extravergine d\'Oliva 5L', quantity: 15.0, unit_of_measure: 'litri', total_price: 65.00, unit_price: 4.33 },
      ],
      is_simulated: true,
    };
  }

  if (fileName.includes('vesuvio') || fileName.includes('food')) {
    return {
      supplier_name: 'Vesuvio Food Distribuzione',
      invoice_number: 'DDT-55412',
      invoice_date: today,
      due_date: nextMonth,
      total_amount: 312.00,
      payment_status: 'da_pagare',
      items: [
        { item_name: 'Pelati San Marzano DOP 3kg', quantity: 24.0, unit_of_measure: 'kg', total_price: 72.00, unit_price: 3.00 },
        { item_name: 'Salame Piccante Spianata', quantity: 8.0, unit_of_measure: 'kg', total_price: 112.00, unit_price: 14.00 },
        { item_name: 'Origano di Sicilia essiccato', quantity: 1.0, unit_of_measure: 'kg', total_price: 18.00, unit_price: 18.00 },
        { item_name: 'Friarielli Napoletani in Olio', quantity: 10.0, unit_of_measure: 'kg', total_price: 110.00, unit_price: 11.00 },
      ],
      is_simulated: true,
    };
  }

  return {
    supplier_name: 'Latticini Rossi Srl',
    invoice_number: `FT-${Math.floor(1000 + Math.random() * 9000)}/2026`,
    invoice_date: today,
    due_date: nextMonth,
    total_amount: 245.50,
    payment_status: 'da_pagare',
    items: [
      { item_name: 'Mozzarella di Bufala DOP', quantity: 15.0, unit_of_measure: 'kg', total_price: 127.50, unit_price: 8.50 },
      { item_name: 'Fior di Latte Appennino', quantity: 10.0, unit_of_measure: 'kg', total_price: 62.00, unit_price: 6.20 },
      { item_name: 'Prosciutto Crudo di Parma', quantity: 3.0, unit_of_measure: 'kg', total_price: 56.00, unit_price: 18.66 },
    ],
    is_simulated: true,
  };
}

function formatExtractedInvoice(raw) {
  return {
    supplier_name: raw.supplier_name || 'Fornitore Rilevato',
    invoice_number: raw.invoice_number || `FT-${Date.now().toString().slice(-4)}`,
    invoice_date: raw.invoice_date || new Date().toISOString().split('T')[0],
    due_date: raw.due_date || '',
    total_amount: Number(raw.total_amount) || 0,
    payment_status: raw.payment_status || 'da_pagare',
    items: Array.isArray(raw.items)
      ? raw.items.map((it) => {
          const qty = Number(it.quantity) || 1;
          const tot = Number(it.total_price) || 0;
          const uPrice = it.unit_price ? Number(it.unit_price) : qty > 0 ? tot / qty : 0;
          return {
            item_name: it.item_name || 'Prodotto',
            quantity: qty,
            unit_of_measure: it.unit_of_measure || 'kg',
            total_price: tot,
            unit_price: Number(uPrice.toFixed(2)),
          };
        })
      : [],
    is_simulated: false,
  };
}
