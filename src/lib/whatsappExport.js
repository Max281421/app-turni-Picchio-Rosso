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

  // 1. Considera ESCLUSIVAMENTE il turno di CENA per l'esportazione WhatsApp
  // Controlla se l'Admin ha assegnato ufficialmente almeno un turno di CENA nella settimana
  const hasAnyAssignedCena = reorderedDays.some(
    dayObj => dayObj.assignedShifts && dayObj.assignedShifts.some(s => s.turno === 'cena')
  );

  for (const dayObj of reorderedDays) {
    const dayOfWeek = dayObj.date.getDay(); // 0 = DOM, 1 = LUN, 2 = MAR, etc.
    
    // Salta Martedì (Chiusura settimanale)
    if (dayOfWeek === 2) continue;

    const dayCode = DAY_NAMES_SHORT[dayOfWeek];

    // Filtra mantenendo SOLO i turni di CENA (i pranzi vengono ignorati nel messaggio)
    const assignedCena = (dayObj.assignedShifts || []).filter(s => s.turno === 'cena');
    const availableCena = (dayObj.availableShifts || []).filter(s => s.turno === 'cena');

    // Se c'è almeno un turno di CENA assegnato nell'intera settimana, usa ESCLUSIVAMENTE le cene assegnate.
    // Se l'admin non ha ancora assegnato alcuna cena nella settimana, usa le cene disponibili.
    const targetCenaShifts = hasAnyAssignedCena ? assignedCena : availableCena;

    const targetIds = new Set(targetCenaShifts.map(s => s.employee_id));

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
