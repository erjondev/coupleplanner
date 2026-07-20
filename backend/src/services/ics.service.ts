import { CalendarEvent } from './calendarEvents.service';

/**
 * Génération d'un flux iCalendar (RFC 5545) à partir des événements du couple.
 *
 * Ce flux est destiné à être « abonné » dans Google/Apple/Outlook Agenda via
 * une URL secrète. Il applique la MÊME confidentialité que l'API JSON : les
 * créneaux privés du partenaire arrivent en `partner_busy` (aucun titre) et
 * sont rendus comme « Occupé » — jamais leur contenu réel.
 */

/** Échappe les caractères spéciaux d'une valeur texte iCalendar (RFC 5545 §3.3.11). */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Date → 'YYYYMMDD' en UTC (pour les événements journée entière : VALUE=DATE). */
function formatDate(d: Date): string {
  return (
    d.getUTCFullYear().toString().padStart(4, '0') +
    (d.getUTCMonth() + 1).toString().padStart(2, '0') +
    d.getUTCDate().toString().padStart(2, '0')
  );
}

/** Date → 'YYYYMMDDTHHMMSSZ' en UTC (horodatage iCalendar). */
function formatDateTime(d: Date): string {
  return (
    formatDate(d) +
    'T' +
    d.getUTCHours().toString().padStart(2, '0') +
    d.getUTCMinutes().toString().padStart(2, '0') +
    d.getUTCSeconds().toString().padStart(2, '0') +
    'Z'
  );
}

/**
 * Plie les lignes à 75 octets max (RFC 5545 §3.1) : les continuations
 * commencent par une espace. On coupe sur les octets (UTF-8) pour rester
 * conforme, ce qui suffit très largement pour nos titres.
 */
function foldLine(line: string): string {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line;
  const out: string[] = [];
  let current = '';
  for (const ch of line) {
    // +1 pour l'espace de continuation sur les lignes suivantes
    const prefix = out.length === 0 ? 0 : 1;
    if (Buffer.byteLength(current + ch, 'utf8') + prefix > 75) {
      out.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  if (current) out.push(current);
  return out.map((s, i) => (i === 0 ? s : ' ' + s)).join('\r\n');
}

function eventBlock(e: CalendarEvent, stamp: string): string[] {
  const lines: string[] = ['BEGIN:VEVENT'];
  // UID stable par tâche → mises à jour/suppressions propres côté client.
  lines.push(`UID:task-${e.id}@coupleplanner`);
  lines.push(`DTSTAMP:${stamp}`);

  const start = new Date(e.start);
  const end = e.end ? new Date(e.end) : null;

  if (e.isAllDay) {
    // Journée entière : DTEND est exclusif → +1 jour si aucune fin fournie.
    const endDate = end ?? new Date(start.getTime() + 24 * 60 * 60 * 1000);
    lines.push(`DTSTART;VALUE=DATE:${formatDate(start)}`);
    lines.push(`DTEND;VALUE=DATE:${formatDate(endDate)}`);
  } else {
    lines.push(`DTSTART:${formatDateTime(start)}`);
    if (end) lines.push(`DTEND:${formatDateTime(end)}`);
  }

  if (e.visibility === 'partner_busy') {
    // Opaque : aucun titre/description du privé partenaire n'est exposé.
    lines.push('SUMMARY:Occupé');
    lines.push('TRANSP:OPAQUE');
  } else {
    const prefix = e.visibility === 'ours' ? '👫 ' : '';
    lines.push(`SUMMARY:${escapeText(prefix + e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
  }

  lines.push('END:VEVENT');
  return lines;
}

/**
 * Construit le document iCalendar complet.
 * @param stamp horodatage de génération (ISO) — passé en argument car
 *   Date.now() n'est pas utilisable partout ; le contrôleur fournit `new Date()`.
 */
export function buildIcs(events: CalendarEvent[], stamp: Date): string {
  const dtstamp = formatDateTime(stamp);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CouplePlanner//Agenda//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:CouplePlanner',
    'X-WR-TIMEZONE:UTC',
  ];
  for (const e of events) lines.push(...eventBlock(e, dtstamp));
  lines.push('END:VCALENDAR');
  // Chaque ligne pliée puis jointes en CRLF (obligatoire RFC 5545).
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
