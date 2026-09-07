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
  const employeeMap = new Map();
  employeesList.forEach(e => {
    const shortName = getShortFirstName(e.nome);
    if (e.id) employeeMap.set(e.id, shortName);
    if (e.auth_user_id) employeeMap.set(e.auth_user_id, shortName);
  });

  const lines = [];

  // Ordiniamo dal Lunedì (index 1) alla Domenica (index 0)
  // Reorder days so Monday comes first
  const reorderedDays = [...weekDaysArray].sort((a, b) => {
    const dayA = a.date.getDay() === 0 ? 7 : a.date.getDay();
    const dayB = b.date.getDay() === 0 ? 7 : b.date.getDay();
    return dayA - dayB;
  });

  // Controlla se c'è almeno un turno di cena assegnato ufficialmente nell'intera settimana
  const hasAnyAssigned = reorderedDays.some(
    dayObj => dayObj.assignedShifts && dayObj.assignedShifts.some(s => s.turno === 'cena')
  );

  for (const dayObj of reorderedDays) {
    const dayOfWeek = dayObj.date.getDay(); // 0 = DOM, 1 = LUN, 2 = MAR, etc.
    
    // Salta Martedì (Chiusura settimanale)
    if (dayOfWeek === 2) continue;

    const dayCode = DAY_NAMES_SHORT[dayOfWeek];

    // Se c'è almeno un turno di cena assegnato nell'intera settimana, usa ESCLUSIVAMENTE i turni assegnati.
    // Se l'admin non ha ancora assegnato alcun turno di cena nella settimana, fa da fallback sulle disponibilità.
    const targetShifts = hasAnyAssigned
      ? (dayObj.assignedShifts || [])
      : (dayObj.availableShifts || []);

    // Raccogliamo solo gli employee_id assegnati/disponibili per il turno di CENA (i pranzi figurano solo sull'app)
    const validShifts = targetShifts.filter(s => s.turno === 'cena');

    const targetIds = new Set(validShifts.map(s => s.employee_id));

    if (targetIds.size > 0) {
      const names = Array.from(targetIds)
        .map(id => employeeMap.get(id))
        .filter(Boolean)
        .join(' ');
      if (names.trim()) {
        lines.push(`${dayCode} ${names.trim()}`);
      }
    }
  }

  return lines.join('\n').trim();
}

/**
 * Apre WhatsApp (Web su desktop, App nativa su mobile) con il testo pre-compilato
 */
export function sharePlanningToWhatsApp(weekDaysArray, employeesList) {
  const text = generateWhatsAppPlanningText(weekDaysArray, employeesList).trim();
  const encodedText = encodeURIComponent(text);
  const url = `https://api.whatsapp.com/send?text=${encodedText}`;
  window.open(url, '_blank');
}
