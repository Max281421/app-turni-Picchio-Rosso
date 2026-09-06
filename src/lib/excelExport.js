import ExcelJS from 'exceljs';

/**
 * Esporta il riepilogo mensile dei turni in formato Excel (.xlsx) per il commercialista
 * con bordi completi su ogni cella ed iniziale del giorno della settimana nelle intestazioni (es. "L 1", "M 2", "G 4").
 * 
 * @param {Array} employees Lista dei dipendenti
 * @param {Array} shifts Lista di tutti i turni del mese selezionato
 * @param {string} monthLabel Etichetta del mese (es. "Agosto 2026")
 * @param {number} currentYear Anno selezionato (es. 2026)
 * @param {number} currentMonth Mese selezionato (0-indexed, 0 = Gennaio, 7 = Agosto)
 */
export async function exportShiftsToExcel(employees, shifts, monthLabel, currentYear = new Date().getFullYear(), currentMonth = new Date().getMonth()) {
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'App Turni Ristorante';

  // Stile di bordo nero sottile completo per ciascuna cella
  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } }
  };

  // ---------------------------------------------------------
  // FOGLIO 1: RIEPILOGO E DATE
  // ---------------------------------------------------------
  const summarySheet = workbook.addWorksheet('Riepilogo e Date', {
    views: [{ showGridLines: true }],
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });

  summarySheet.columns = [
    { header: 'Nome Dipendente', key: 'nome', width: 25 },
    { header: 'Date Esatte Lavorate', key: 'date', width: 45 },
    { header: 'Turni Pranzo', key: 'pranzi', width: 15 },
    { header: 'Turni Cena', key: 'cene', width: 15 },
    { header: 'Totale Turni', key: 'totale', width: 15 },
    { header: 'Giorni Presenza (Totale)', key: 'giorni', width: 24 }
  ];

  employees.forEach((emp) => {
    const empShifts = shifts.filter((s) => s.employee_id === emp.id || s.employee_id === emp.auth_user_id);
    const pranzi = empShifts.filter((s) => s.turno === 'pranzo').length;
    const cene = empShifts.filter((s) => s.turno === 'cena').length;

    const uniqueDates = Array.from(new Set(empShifts.map((s) => s.data))).sort();
    const datesFormattedList = uniqueDates.map((d) => {
      const parts = d.split('-');
      return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
    }).join(', ');

    summarySheet.addRow({
      nome: emp.nome || 'N/D',
      date: datesFormattedList || 'Nessuna',
      pranzi,
      cene,
      totale: pranzi + cene,
      giorni: uniqueDates.length
    });
  });

  // Riga totale generale
  const summaryRows = summarySheet.getRows(2, employees.length) || [];
  const totalPranzi = summaryRows.reduce((acc, row) => acc + Number(row.getCell(3).value || 0), 0);
  const totalCene = summaryRows.reduce((acc, row) => acc + Number(row.getCell(4).value || 0), 0);
  const totalTurni = summaryRows.reduce((acc, row) => acc + Number(row.getCell(5).value || 0), 0);

  summarySheet.addRow({
    nome: 'TOTALE GENERALE',
    date: '-',
    pranzi: totalPranzi,
    cene: totalCene,
    totale: totalTurni,
    giorni: '-'
  });

  // Applica bordi e allineamenti a tutte le celle di summarySheet
  summarySheet.eachRow((row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = thinBorder;
      if (rowNumber === 1) {
        cell.font = { bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: typeof cell.value === 'number' ? 'center' : 'left' };
      }
    });
  });

  // ---------------------------------------------------------
  // FOGLIO 2: GRIGLIA 1-31 (CARTELLINO CON INIZIALE GIORNO)
  // ---------------------------------------------------------
  const gridSheet = workbook.addWorksheet('Griglia 1-31 (Cartellino)', {
    views: [{ showGridLines: true }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });

  // Iniziali dei giorni della settimana in italiano (D=Domenica, L=Lunedì, M=Martedì, M=Mercoledì, G=Giovedì, V=Venerdì, S=Sabato)
  const dayInitialsMap = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];
  const monthNum = currentMonth + 1;

  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dateObj = new Date(currentYear, currentMonth, dayNum);
    const dayInitial = dayInitialsMap[dateObj.getDay()];
    return {
      header: `${dayInitial} ${dayNum}/${monthNum}`,
      key: `day_${dayNum}`,
      width: 8
    };
  });

  gridSheet.columns = [
    { header: 'Nome Dipendente', key: 'nome', width: 25 },
    ...dayHeaders,
    { header: 'Turni Pranzo', key: 'pranzi', width: 14 },
    { header: 'Turni Cena', key: 'cene', width: 14 },
    { header: 'Totale Turni', key: 'totale', width: 14 }
  ];

  employees.forEach((emp) => {
    const empShifts = shifts.filter((s) => s.employee_id === emp.id || s.employee_id === emp.auth_user_id);
    const rowObj = { nome: emp.nome || 'N/D' };

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
        rowObj[`day_${day}`] = 'P+C';
      } else if (hasP) {
        rowObj[`day_${day}`] = 'P';
      } else if (hasC) {
        rowObj[`day_${day}`] = 'C';
      } else {
        rowObj[`day_${day}`] = '';
      }
    }

    rowObj.pranzi = pCount;
    rowObj.cene = cCount;
    rowObj.totale = pCount + cCount;

    gridSheet.addRow(rowObj);
  });

  // Applica bordi e allineamenti a tutte le celle di gridSheet
  gridSheet.eachRow((row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = thinBorder;
      if (rowNumber === 1) {
        cell.font = { bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });
  });

  // Genera ed avvia il download del file .xlsx
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const cleanMonthLabel = monthLabel.replace(/\s+/g, '_').toLowerCase();
  const filename = `Riepilogo_Turni_${cleanMonthLabel}.xlsx`;

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
