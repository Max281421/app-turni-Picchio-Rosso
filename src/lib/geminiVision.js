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
            if (errorMsg.includes('prepayment credits') || errorMsg.includes('depleted')) {
              errorMsg = 'Il progetto è impostato su "Pagamento Anticipato" con credito 0€. Per usarlo 100% GRATIS: vai su aistudio.google.com/app/apikey, e nella colonna "Livello di fatturazione" seleziona "Livello gratuito" (Free Tier), oppure crea una nuova chiave in "Default Gemini Project".';
            } else if (response.status === 401) {
              errorMsg = 'Chiave non autorizzata (HTTP 401). Verifica che l\'API Gemini sia attiva nel tuo progetto.';
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
      console.error('Scansione Gemini fallita:', err);
      // Se l'utente ha fornito una chiave esplicita, rilanciamo l'errore per mostrare l'avviso in UI
      throw err;
    }
  }

  // MODALITÀ SIMULAZIONE / DEMO (se l'API key non è impostata o siamo in sviluppo)
  await new Promise((resolve) => setTimeout(resolve, 1500)); // Simuliamo 1.5s di analisi IA

  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return {
    supplier_name: 'Latticini Rossi Srl',
    invoice_number: `FT-${Math.floor(1000 + Math.random() * 9000)}/2026`,
    invoice_date: today,
    due_date: nextMonth,
    total_amount: 245.50,
    payment_status: 'da_pagare',
    items: [
      {
        item_name: 'Mozzarella di Bufala DOP',
        quantity: 15.0,
        unit_of_measure: 'kg',
        total_price: 127.50,
        unit_price: 8.50, // 127.50 / 15
      },
      {
        item_name: 'Fior di Latte Appennino',
        quantity: 10.0,
        unit_of_measure: 'kg',
        total_price: 62.00,
        unit_price: 6.20, // 62.00 / 10
      },
      {
        item_name: 'Prosciutto Crudo di Parma',
        quantity: 3.0,
        unit_of_measure: 'kg',
        total_price: 56.00,
        unit_price: 18.66,
      },
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
