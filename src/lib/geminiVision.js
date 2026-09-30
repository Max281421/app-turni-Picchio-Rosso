import Tesseract from 'tesseract.js';

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
 * Utilizza una pipeline a 2 livelli: API Vision Serverless -> OCR Tesseract Locale + Parser Matematico.
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

  const base64Data = await fileToBase64(file);
  const mimeType = file.type || 'image/jpeg';

  // 1. TENTATIVO VIA SERVERLESS API ROUTE (/api/scan-invoice)
  try {
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
      if (parsed && (parsed.supplier_name || (Array.isArray(parsed.items) && parsed.items.length > 0))) {
        return formatExtractedInvoice(parsed);
      }
    }
  } catch (apiErr) {
    console.warn('Endpoint /api/scan-invoice non disponibile, passaggio a OCR locale:', apiErr);
  }

  // 2. TENTATIVO VIA OCR TESSERACT LOCALE CON CANVAS PRE-PROCESSING
  try {
    const processedFile = await preprocessImageForOCR(file);
    const ocrResult = await processOCR(processedFile || file);
    if (ocrResult) {
      return ocrResult;
    }
  } catch (ocrErr) {
    console.warn('Errore durante l\'estrazione OCR locale:', ocrErr);
  }

  // 3. SE NON VIENE TROVATO ALCUN DATO, RITORNA FORM VUOTO (MAI DATI FINTI HARDCODATI)
  return emptyResult;
}

/**
 * Pre-processa l'immagine in Canvas migliorando il contrasto prima dell'OCR Tesseract
 */
async function preprocessImageForOCR(file) {
  if (typeof window === 'undefined' || !file.type?.startsWith('image/')) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const maxDim = 1800;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
          const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          const v = avg < 145 ? Math.max(0, avg - 35) : Math.min(255, avg + 35);
          data[i] = v;
          data[i + 1] = v;
          data[i + 2] = v;
        }

        ctx.putImageData(imgData, 0, 0);
        canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.95);
      } catch (e) {
        resolve(file);
      }
    };
    img.onerror = () => resolve(file);
    img.src = objectUrl;
  });
}

async function processOCR(file) {
  const { data: { text } } = await Tesseract.recognize(file, 'ita+eng', {
    logger: () => {},
  });

  if (!text || text.trim().length < 8) {
    return null;
  }

  return parseGenericOCRText(text);
}

function parseGenericOCRText(rawText) {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // 1. Nome Fornitore
  let supplier_name = '';
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const line = lines[i];
    if (/\b(s\.?r\.?l|s\.?p\.?a|ditta|fornitore|caseificio|mulino|distribuzione|food|grossista|vesuvio|latticini)\b/i.test(line)) {
      supplier_name = line
        .replace(/^(fornitore|spett\.le|ditta)\s*[:\-]?\s*/i, '')
        .replace(/(via|p\.iva|tel|cod|c\.f\.).*/i, '')
        .trim();
      break;
    }
  }
  if (!supplier_name && lines.length > 0) {
    supplier_name = lines[0].replace(/(via|p\.iva|tel|cod|c\.f\.).*/i, '').trim();
  }
  if (!supplier_name) supplier_name = 'Fornitore Rilevato';

  // 2. Numero Fattura
  let invoice_number = '';
  const matchInv = rawText.match(/(?:FT|F|DDT)-[0-9]{4}\/[0-9]+/i) || rawText.match(/(?:fattura|ddt)\s*(?:numero|n\.?)?\s*[:\-]?\s*([a-z0-9\/\-_]{4,20})/i);
  if (matchInv) {
    invoice_number = (matchInv[1] || matchInv[0]).toUpperCase();
  } else {
    invoice_number = `FT-${Date.now().toString().slice(-4)}`;
  }

  // 3. Data Fattura
  let invoice_date = today;
  const dateMatch = rawText.match(/(?:data|del)?\s*[:\-]?\s*(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/i);
  if (dateMatch) {
    const d = dateMatch[1].padStart(2, '0');
    const m = dateMatch[2].padStart(2, '0');
    let y = dateMatch[3];
    if (y.length === 2) y = `20${y}`;
    invoice_date = `${y}-${m}-${d}`;
  }

  // 4. Totale Documento (incluso IVA se presente nella fattura)
  let total_amount = 0;
  const totalMatch = rawText.match(/(?:totale\s*(?:fattura|documento|doc|complessivo|importo|generale)?|totale\s*:?)\s*[:\-]?\s*€?\s*(\d+[.,]\d{2})/i);
  if (totalMatch) {
    total_amount = parseFloat(totalMatch[1].replace(',', '.'));
  }

  // 5. Estrazione Matematica Righe Prodotto (q * u = t)
  const items = [];
  for (const line of lines) {
    if (/\b(totale|imponibile|iva|iban|pagamento|banca|p\.iva|destinatario|pizzeria|spett\.le|descrizione|articolo)\b/i.test(line)) continue;

    const uomMatch = /(litri|litro|buste|busta|cartoni|cartone|pezzi|pezzo|pz|kg)/i.exec(line);
    const uom = uomMatch ? uomMatch[0].toLowerCase() : 'kg';

    const rawTokens = line.split(/\s+/);
    const numTokens = [];
    for (const tok of rawTokens) {
      const cleaned = tok.replace('€', '').replace('%', '').trim();
      if (/^\d+([.,]\d+)?$/.test(cleaned)) {
        numTokens.push(parseFloat(cleaned.replace(',', '.')));
      }
    }

    if (numTokens.length >= 2) {
      let matched = false;
      for (let i = 0; i < numTokens.length && !matched; i++) {
        for (let j = 0; j < numTokens.length && !matched; j++) {
          if (i === j) continue;
          for (let k = 0; k < numTokens.length && !matched; k++) {
            if (k === i || k === j) continue;
            const q = numTokens[i];
            const u = numTokens[j];
            const t = numTokens[k];

            if (q > 0 && u > 0 && t > 0 && Math.abs(q * u - t) < 0.1) {
              let itemName = line;
              // Clean product code prefixes (e.g. BUF-01, ART-102)
              itemName = itemName.replace(/^[A-Z0-9]{2,8}[-\/][0-9]{2,8}\s*/i, '');
              itemName = itemName.replace(/^(?:cod|art|rif)\.?\s*[A-Z0-9-]+\s*/i, '');

              const words = itemName.split(/\s+/);
              const cleanWords = words.filter((w) => {
                const c = w.replace('€', '').replace('%', '').replace(',', '.').trim();
                if (!c) return false;
                const val = parseFloat(c);
                if (!isNaN(val) && (val === q || val === u || val === t || /^\d+([.,]\d+)?$/.test(c))) {
                  return false;
                }
                if (/^(€|%|kg|litri|litro|buste|busta|cartoni|pezzi|pz)$/i.test(w)) {
                  return false;
                }
                return true;
              });
              itemName = cleanWords.join(' ').trim();

              items.push({
                item_name: itemName || 'Prodotto Rilevato',
                quantity: q,
                unit_of_measure: uom.startsWith('l') ? 'litri' : uom,
                unit_price: Number(u.toFixed(2)),
                total_price: Number(t.toFixed(2)),
              });
              matched = true;
            }
          }
        }
      }
    }
  }

  // Se non è stato trovato il totale fattura stampato, usiamo la somma delle righe
  if (!total_amount && items.length > 0) {
    total_amount = items.reduce((sum, item) => sum + item.total_price, 0);
  }

  return {
    supplier_name,
    invoice_number,
    invoice_date,
    due_date: nextMonth,
    total_amount: Number(total_amount.toFixed(2)),
    payment_status: 'da_pagare',
    items,
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
  };
}
