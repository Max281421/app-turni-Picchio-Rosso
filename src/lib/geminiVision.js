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
 * Ridimensiona e comprime un file immagine in formato Data URL ottimizzato (JPEG 1600px max, ~150-250KB).
 * Se il file è un PDF o un documento non immagine, restituisce il Data URL originale.
 * @param {File} file - Il file caricato dall'utente
 * @param {number} maxWidth - Larghezza massima in pixel (default 1600)
 * @param {number} maxHeight - Altezza massima in pixel (default 1600)
 * @param {number} quality - Qualità di compressione JPEG (default 0.78)
 * @returns {Promise<string>} Stringa Data URL pronta per la memorizzazione/visualizzazione
 */
export function compressImageFile(file, maxWidth = 1600, maxHeight = 1600, quality = 0.78) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);

    if (!file.type || !file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result || null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => resolve(e.target?.result || null);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
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
          const discountPct = Number(it.discount_percent || it.discount || it.sconto) || 0;
          const tot = Number(it.total_price) || 0;
          let uPrice = Number(it.unit_price) || 0;

          if (!uPrice && qty > 0) {
            const netUPrice = tot / qty;
            uPrice = discountPct > 0 ? netUPrice / (1 - discountPct / 100) : netUPrice;
          }
          
          let pzPerPkg = Number(it.pieces_per_package || it.qxc || it.num_um) || 1;
          
          // Pulizia ulteriore del nome per rimuovere x24, x12, x15 alla fine
          let cleanName = (it.item_name || 'Prodotto').trim();
          const multMatch = cleanName.match(/\s*(?:x|X|\*)\s*(\d+)\s*(?:pz|PZ)?\s*$/i);
          if (multMatch) {
            if (pzPerPkg === 1) {
              pzPerPkg = Number(multMatch[1]) || 1;
            }
            cleanName = cleanName.replace(/\s*(?:x|X|\*)\s*\d+\s*(?:pz|PZ)?\s*$/i, '').trim();
          }

          return {
            item_name: cleanName,
            quantity: qty,
            unit_of_measure: it.unit_of_measure || 'cartoni',
            pieces_per_package: pzPerPkg,
            unit_price: Number(uPrice.toFixed(2)),
            discount_percent: Number(discountPct.toFixed(2)),
            total_price: Number(tot.toFixed(2)),
          };
        })
      : [],
  };
}
