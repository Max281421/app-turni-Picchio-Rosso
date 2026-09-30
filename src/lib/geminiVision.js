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
 * Service principale per la scansione ed estrazione automatica dei dati da immagini di fatture e DDT.
 * Utilizza la API Route Serverless (/api/scan-invoice) con OpenRouter / AI Vision.
 * @param {File} file - Il file foto o PDF caricato dall'utente
 * @returns {Promise<Object>} Oggetto con i dati estratti della fattura e delle singole voci
 */
export async function analyzeInvoiceImage(file) {
  const today = new Date().toISOString().split('T')[0];
  const emptyResult = {
    supplier_name: '',
    invoice_number: `FT-${Date.now().toString().slice(-4)}`,
    invoice_date: today,
    due_date: '',
    total_amount: 0,
    payment_status: 'da_pagare',
    items: [],
  };

  if (!file) return emptyResult;

  try {
    const base64Data = await fileToBase64(file);
    const mimeType = file.type || 'image/jpeg';

    const apiResp = await fetch('/api/scan-invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64: base64Data,
        mimeType: mimeType,
      }),
    });

    if (apiResp.ok) {
      const parsed = await apiResp.json();
      if (parsed) {
        return formatExtractedInvoice(parsed);
      }
    } else {
      const errJson = await apiResp.json().catch(() => ({}));
      console.warn('Scansione Serverless fallita o chiave non presente:', errJson);
    }
  } catch (apiErr) {
    console.error('Errore durante la chiamata al servizio di scansione:', apiErr);
  }

  return emptyResult;
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
  };
}
