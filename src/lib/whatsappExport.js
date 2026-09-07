/**
 * Utility per formattare ed esportare il planning settimanale per WhatsApp
 */

// Mappatura dei giorni della settimana in abbreviazioni maiuscole
const DAY_NAMES_SHORT = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];

/**
 * Estrae solo il primo nome di battesimo in maiuscolo (es. "Alessandro Macchi" -> "ALLE" o "ALESSANDRO")
 * Se il dipendente ha un soprannome o nome breve, lo restituisce pulito.
 */
export function getShortFirstName(fullName) {
  if (!fullName) return '';
  const firstWord = fullName.trim().split(' ')[0].toUpperCase();
  return firstWord;
}

/**
 * Formatta un elenco di turni di una settimana nel formato WhatsApp richiesto:
 * LUN ALLE FABIO 
 * MER ANGELO ANTO 
 * GIO SIMO ALLE 
 * VEN UCCIO VICHI ANGELO 
 * SAB VICHI SIMO ALLE 
 * DOM UCCIO ALLE SAM
 * 
 * @param {Array} weekDaysArray - Array di 7 oggetti { dateStr, dayOfWeekIndex, shifts: [...] }
 * @param {Array} employeesList - Elenco completo dipendenti [{ id, nome }]
 * @returns {string} Il testo formattato pronto per l'invio
 */
export function generateWhatsAppPlanningText(weekDaysArray, employeesList) {
  const employeeMap = new Map(employeesList.map(e => [e.id, getShortFirstName(e.nome)]));

  const lines = ['🍕 *PLANNING SETTIMANALE* 🍕', ''];

  // Ordiniamo dal Lunedì (index 1) alla Domenica (index 0)
  // Reorder days so Monday comes first
  const reorderedDays = [...weekDaysArray].sort((a, b) => {
    const dayA = a.date.getDay() === 0 ? 7 : a.date.getDay();
    const dayB = b.date.getDay() === 0 ? 7 : b.date.getDay();
    return dayA - dayB;
  });

  for (const dayObj of reorderedDays) {
    const dayOfWeek = dayObj.date.getDay(); // 0 = DOM, 1 = LUN, 2 = MAR, etc.
    
    // Salta Martedì (Chiusura settimanale)
    if (dayOfWeek === 2) continue;

    const dayCode = DAY_NAMES_SHORT[dayOfWeek];

    // Raccogliamo gli employee_id che lavorano (escludendo pranzo la domenica)
    const validShifts = dayObj.assignedShifts.filter(s => {
      if (dayOfWeek === 0 && s.turno === 'pranzo') return false;
      return true;
    });

    const assignedIds = new Set(validShifts.map(s => s.employee_id));

    if (assignedIds.size > 0) {
      const names = Array.from(assignedIds)
        .map(id => employeeMap.get(id))
        .filter(Boolean)
        .join(' ');
      lines.push(`${dayCode} ${names}`);
    }
  }

  lines.push('');
  lines.push('📌 _Inviato tramite App Turni_');

  return lines.join('\n');
}

/**
 * Apre WhatsApp (Web su desktop, App nativa su mobile) con il testo pre-compilato
 */
export function sharePlanningToWhatsApp(weekDaysArray, employeesList) {
  const text = generateWhatsAppPlanningText(weekDaysArray, employeesList);
  const encodedText = encodeURIComponent(text);
  const url = `https://api.whatsapp.com/send?text=${encodedText}`;
  window.open(url, '_blank');
}
