import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Esporta il Foglio 1 (Riepilogo e Date Esatte) in formato PDF (Verticale A4)
 */
export function exportSummaryToPDF(employees, shifts, monthLabel) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Intestazione del Documento PDF
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42); // #0f172a
  doc.text(`Riepilogo Turni e Date - ${monthLabel}`, 14, 15);

  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generato il ${new Date().toLocaleDateString('it-IT')} - App Turni Ristorante`, 14, 21);

  const head = [[
    'Nome Dipendente',
    'Date Esatte Lavorate',
    'Turni Pranzo',
    'Turni Cena',
    'Totale Turni',
    'Giorni Presenza'
  ]];

  const body = employees.map((emp) => {
    const empShifts = shifts.filter((s) => s.employee_id === emp.id || s.employee_id === emp.auth_user_id);
    const pranzi = empShifts.filter((s) => s.turno === 'pranzo').length;
    const cene = empShifts.filter((s) => s.turno === 'cena').length;

    const uniqueDates = Array.from(new Set(empShifts.map((s) => s.data))).sort();
    const datesFormattedList = uniqueDates.map((d) => {
      const parts = d.split('-');
      return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
    }).join(', ');

    return [
      emp.nome || 'N/D',
      datesFormattedList || 'Nessuna',
      pranzi,
      cene,
      pranzi + cene,
      uniqueDates.length
    ];
  });

  // Calcola Totali Generali
  const totalPranzi = body.reduce((acc, r) => acc + Number(r[2]), 0);
  const totalCene = body.reduce((acc, r) => acc + Number(r[3]), 0);
  const totalTurni = body.reduce((acc, r) => acc + Number(r[4]), 0);

  body.push([
    'TOTALE GENERALE',
    '-',
    totalPranzi,
    totalCene,
    totalTurni,
    '-'
  ]);

  autoTable(doc, {
    startY: 25,
    head: head,
    body: body,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // #1e293b
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 9
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 70 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 18 }
    },
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      valign: 'middle'
    },
    didParseCell: function(data) {
      if (data.section === 'body' && data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
      }
    }
  });

  const cleanMonthLabel = monthLabel.replace(/\s+/g, '_').toLowerCase();
  doc.save(`Riepilogo_Turni_${cleanMonthLabel}.pdf`);
}

/**
 * Esporta il Foglio 2 (Griglia Cartellino 1-31) in formato PDF Orizzontale (Landscape A4)
 */
export function exportGridToPDF(employees, shifts, monthLabel, currentYear = new Date().getFullYear(), currentMonth = new Date().getMonth()) {
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthNum = currentMonth + 1;
  const dayInitialsMap = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Titolo Documento
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`Griglia Presenze 1-31 (Cartellino) - ${monthLabel}`, 14, 12);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generato il ${new Date().toLocaleDateString('it-IT')} - App Turni Ristorante`, 14, 17);

  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dateObj = new Date(currentYear, currentMonth, dayNum);
    const dayInitial = dayInitialsMap[dateObj.getDay()];
    return `${dayInitial}\n${dayNum}/${monthNum}`;
  });

  const head = [[
    'Nome Dipendente',
    ...dayHeaders,
    'Pranzi',
    'Cene',
    'Totale'
  ]];

  const body = employees.map((emp) => {
    const empShifts = shifts.filter((s) => s.employee_id === emp.id || s.employee_id === emp.auth_user_id);
    const row = [emp.nome || 'N/D'];

    let pCount = 0;
    let cCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayShifts = empShifts.filter((s) => s.data === dayStr);

      const hasP = dayShifts.some((s) => s.turno === 'pranzo');
      const hasC = dayShifts.some((s) => s.turno === 'cena');

      if (hasP) pCount++;
      if (hasC) cCount++;

      if (hasP && hasC) {
        row.push('P+C');
      } else if (hasP) {
        row.push('P');
      } else if (hasC) {
        row.push('C');
      } else {
        row.push('');
      }
    }

    row.push(pCount, cCount, pCount + cCount);
    return row;
  });

  autoTable(doc, {
    startY: 20,
    head: head,
    body: body,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 6,
      cellPadding: 0.8
    },
    bodyStyles: {
      fontSize: 6.5,
      textColor: [30, 41, 59],
      halign: 'center',
      cellPadding: 1
    },
    columnStyles: {
      0: { cellWidth: 35, halign: 'left' }
    },
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      valign: 'middle'
    }
  });

  const cleanMonthLabel = monthLabel.replace(/\s+/g, '_').toLowerCase();
  doc.save(`Griglia_Presenze_${cleanMonthLabel}.pdf`);
}

/**
 * Esporta il resoconto mensile individuale del singolo dipendente in formato PDF (Orizzontale A4 per mixare Griglia + Riepilogo Dettagliato)
 * 
 * @param {string} employeeName Nome del dipendente
 * @param {Array} shifts Lista dei turni del dipendente nel mese
 * @param {string} monthLabel Etichetta del mese (es. "Agosto 2026")
 * @param {number} currentYear Anno
 * @param {number} currentMonth Mese (0-indexed)
 */
export function exportPersonalShiftPDF(employeeName, shifts, monthLabel, currentYear = new Date().getFullYear(), currentMonth = new Date().getMonth()) {
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthNum = currentMonth + 1;
  const dayInitialsMap = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Titolo ed Intestazione
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(`Resoconto Turni Personali - ${employeeName || 'Dipendente'}`, 14, 13);

  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Mese: ${monthLabel}  |  Generato il ${new Date().toLocaleDateString('it-IT')}  |  App Turni Ristorante`, 14, 18);

  // 1. TABELLA RIEPILOGO CONTEGGI (Pranzi, Cene, Totale, Giorni)
  const totalPranzi = shifts.filter((s) => s.turno === 'pranzo').length;
  const totalCene = shifts.filter((s) => s.turno === 'cena').length;
  const totalTurni = totalPranzi + totalCene;
  const uniqueDatesCount = new Set(shifts.map((s) => s.data)).size;

  const summaryHead = [['Turni Pranzo', 'Turni Cena', 'Totale Turni', 'Giorni Presenza']];
  const summaryBody = [[totalPranzi, totalCene, totalTurni, uniqueDatesCount]];

  autoTable(doc, {
    startY: 22,
    head: summaryHead,
    body: summaryBody,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8.5
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [30, 41, 59],
      halign: 'center',
      fontStyle: 'bold'
    },
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      valign: 'middle'
    }
  });

  // 2. TABELLA GRIGLIA CARTELLINO 1-31 (Stile Griglia)
  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dateObj = new Date(currentYear, currentMonth, dayNum);
    const dayInitial = dayInitialsMap[dateObj.getDay()];
    return `${dayInitial}\n${dayNum}/${monthNum}`;
  });

  const gridHead = [['Giorno', ...dayHeaders, 'Totale']];
  const gridRow = ['Presenze'];

  let pCount = 0;
  let cCount = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayShifts = shifts.filter((s) => s.data === dayStr);

    const hasP = dayShifts.some((s) => s.turno === 'pranzo');
    const hasC = dayShifts.some((s) => s.turno === 'cena');

    if (hasP) pCount++;
    if (hasC) cCount++;

    if (hasP && hasC) {
      gridRow.push('P+C');
    } else if (hasP) {
      gridRow.push('P');
    } else if (hasC) {
      gridRow.push('C');
    } else {
      gridRow.push('');
    }
  }
  gridRow.push(pCount + cCount);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    head: gridHead,
    body: [gridRow],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 6,
      cellPadding: 0.8
    },
    bodyStyles: {
      fontSize: 6.5,
      textColor: [30, 41, 59],
      halign: 'center',
      cellPadding: 1
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'left', fontStyle: 'bold' }
    },
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      valign: 'middle'
    }
  });

  // 3. ELENCO DETTAGLIATO DATE E TURNI (Stile Riepilogo Dettagliato)
  const sortedDates = Array.from(new Set(shifts.map((s) => s.data))).sort();
  const detailHead = [['Data Lavorata', 'Giorno della Settimana', 'Turni Svolti nella Giornata']];
  const detailBody = sortedDates.map((dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const formattedDate = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    const weekdayName = dateObj.toLocaleDateString('it-IT', { weekday: 'long' });
    const capitalizedWeekday = weekdayName.charAt(0).toUpperCase() + weekdayName.slice(1);

    const dayShifts = shifts.filter((s) => s.data === dateStr);
    const hasP = dayShifts.some((s) => s.turno === 'pranzo');
    const hasC = dayShifts.some((s) => s.turno === 'cena');

    let desc = '';
    if (hasP && hasC) desc = 'Pranzo + Cena (Turno Spezzato)';
    else if (hasP) desc = 'Turno di Pranzo';
    else if (hasC) desc = 'Turno di Cena';

    return [formattedDate, capitalizedWeekday, desc];
  });

  if (detailBody.length === 0) {
    detailBody.push(['-', 'Nessun turno registrato in questo mese', '-']);
  }

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    head: detailHead,
    body: detailBody,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 35, halign: 'center' },
      1: { cellWidth: 45, halign: 'center' },
      2: { halign: 'left' }
    },
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      valign: 'middle'
    }
  });

  const cleanMonthLabel = monthLabel.replace(/\s+/g, '_').toLowerCase();
  const cleanName = (employeeName || 'dipendente').replace(/\s+/g, '_').toLowerCase();
  doc.save(`Resoconto_Turni_${cleanName}_${cleanMonthLabel}.pdf`);
}
