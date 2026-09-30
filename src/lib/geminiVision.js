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
 * Utilizza una pipeline a 2 livelli: API Vision Serverless -> OCR Tesseract Locale + Parser Matematico Flessibile.
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

  // 2. TENTATIVO VIA OCR TESSERACT LOCALE CON PRE-PROCESSING NITIDO
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
 * Pre-processa l'immagine in Canvas ridimensionandola e ottimizzando la nitidezza senza aggiungere rumore di griglia
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

        const maxDim = 2000;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Pulizia bilanciamento grigi senza sogliare in modo aggressivo le linee delle tabelle
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
          const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          data[i] = avg;
          data[i + 1] = avg;
          data[i + 2] = avg;
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

  if (!text || text.trim().length < 6) {
    return null;
  }

  return parseGenericOCRText(text);
}

function cleanOCRText(rawText) {
  return rawText
    .replace(/[|\[\]{}]/g, ' ')
    .replace(/(\d+)\s*(titi|liti|litri|litro|lt|l)\b/gi, '$1 litri')
    .replace(/(\d+)\s*(kg|kilos|kilo)\b/gi, '$1 kg')
    .replace(/(\d+)\s*(pz|pezzi|pezzo)\b/gi, '$1 pezzi')
    .replace(/\b(ska)\b/gi, '6 kg');
}

function parseGenericOCRText(rawText) {
  const cleanedText = cleanOCRText(rawText);
  const lines = cleanedText.split('\n').map((l) => l.trim()).filter(Boolean);
  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // 1. Nome Fornitore
  let supplier_name = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\b(s\.?r\.?l|s\.?p\.?a|caseificio|mulino|distribuzione|food|grossista|vesuvio|latticini|capriati)\b/i.test(line) && !/spett\.le|destinatario|pizzeria|numero|fattura/i.test(line)) {
      supplier_name = line
        .replace(/^(fornitore|ditta|spett\.le|destinatario)\s*[:\-]?\s*/i, '')
        .replace(/(via|p\.iva|tel|cod|c\.f\.|numero|fattura).*/i, '')
        .replace(/[&“"']/g, '')
        .trim();
      if (supplier_name.length > 2) break;
    }
  }
  if (!supplier_name && lines.length > 0) {
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      if (!/numero|fattura|data|spett|via|p\.iva/i.test(lines[i])) {
        supplier_name = lines[i].replace(/(via|p\.iva|tel|cod|c\.f\.).*/i, '').trim();
        if (supplier_name.length > 2) break;
      }
    }
  }
  if (!supplier_name) supplier_name = 'Fornitore Rilevato';

  // 2. Numero Fattura
  let invoice_number = '';
  const matchInv = cleanedText.match(/(?:FT|F|DDT)-[0-9]{4}\/[0-9]+/i) || cleanedText.match(/(?:fattura|ddt)\s*(?:numero|n\.?)?\s*[:\-]?\s*([a-z0-9\/\-_]{4,20})/i);
  if (matchInv) {
    invoice_number = (matchInv[1] || matchInv[0]).toUpperCase();
  } else {
    invoice_number = `FT-${Date.now().toString().slice(-4)}`;
  }

  // 3. Data Fattura
  let invoice_date = today;
  const dateMatch = cleanedText.match(/(?:data|del)?\s*[:\-]?\s*(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/i);
  if (dateMatch) {
    const d = dateMatch[1].padStart(2, '0');
    const m = dateMatch[2].padStart(2, '0');
    let y = dateMatch[3];
    if (y.length === 2) y = `20${y}`;
    invoice_date = `${y}-${m}-${d}`;
  }

  // 4. Totale Documento (incluso IVA se presente nella fattura)
  let total_amount = 0;
  const totalMatch = cleanedText.match(/(?:totale\s*(?:fattura|documento|doc|complessivo|importo|generale)?|totale\s*:?)\s*[:\-]?\s*€?\s*(\d+[.,]\d{2})/i);
  if (totalMatch) {
    total_amount = parseFloat(totalMatch[1].replace(',', '.'));
  }

  // 5. Estrazione Flessibile Righe Prodotto
  const items = [];
  for (const line of lines) {
    if (/\b(totale|imponibile|iva|iban|pagamento|banca|p\.iva|destinatario|pizzeria|spett\.le|descrizione|articolo|numero|data|via|napoli|roma)\b/i.test(line)) continue;

    const uomMatch = /(litri|litro|buste|busta|cartoni|cartone|pezzi|pezzo|pz|kg)/i.exec(line);
    const uom = uomMatch ? uomMatch[0].toLowerCase() : 'kg';

    const rawTokens = line.split(/\s+/);
    const numTokens = [];
    for (const tok of rawTokens) {
      const cleanedTok = tok.replace('€', '').replace('%', '').trim();
      if (/^\d+([.,]\d+)?$/.test(cleanedTok)) {
        numTokens.push(parseFloat(cleanedTok.replace(',', '.')));
      }
    }

    if (numTokens.length >= 1) {
      let q = 0, u = 0, t = 0;
      let matched = false;

      // Caso A: 3 o più numeri -> Cerca match q * u = t
      if (numTokens.length >= 3) {
        for (let i = 0; i < numTokens.length && !matched; i++) {
          for (let j = 0; j < numTokens.length && !matched; j++) {
            if (i === j) continue;
            for (let k = 0; k < numTokens.length && !matched; k++) {
              if (k === i || k === j) continue;
              const n1 = numTokens[i], n2 = numTokens[j], n3 = numTokens[k];
              if (n1 > 0 && n2 > 0 && n3 > 0 && Math.abs(n1 * n2 - n3) < 0.15) {
                q = n1; u = n2; t = n3;
                matched = true;
              }
            }
          }
        }
      }

      // Caso B: 2 numeri -> Assume primo numero = q ed il secondo/ultimo = t
      if (!matched && numTokens.length >= 2) {
        const n1 = numTokens[0];
        const n2 = numTokens[numTokens.length - 1];
        if (n1 > 0 && n2 > 0 && n2 >= n1) {
          if (n1 <= 500 && n2 <= 10000) {
            q = n1;
            t = n2;
            u = Number((t / q).toFixed(2));
            matched = true;
          }
        }
      }

      // Caso C: 1 solo numero alla fine -> Assume sia il totale della riga
      if (!matched && numTokens.length === 1) {
        const n = numTokens[0];
        if (n > 0.5 && n < 5000) {
          q = 1;
          t = n;
          u = n;
          matched = true;
        }
      }

      if (matched && t > 0) {
        let itemName = line;
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

        if (itemName.length >= 3 && !/^(totale|imponibile|iva)$/i.test(itemName)) {
          items.push({
            item_name: itemName,
            quantity: q,
            unit_of_measure: uom.startsWith('l') ? 'litri' : uom,
            unit_price: Number(u.toFixed(2)),
            total_price: Number(t.toFixed(2)),
          });
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
