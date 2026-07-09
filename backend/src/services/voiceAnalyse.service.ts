/**
 * Service d'analyse vocale MOCKÉ.
 * Simule ce qu'un LLM renverrait à partir d'un texte issu d'un Speech-to-Text.
 * En production, remplacer le corps de `analyseVoiceText` par un appel
 * à l'API Claude/OpenAI avec un prompt d'extraction structurée.
 */

export interface VoiceAnalysis {
  title: string;
  environment_type: 'PRIVATE' | 'SHARED';
  /** Libellé humain, ex: "Prochain samedi" */
  due_date: string | null;
  /** Date ISO exploitable par le frontend */
  due_datetime: string | null;
  is_all_day: boolean;
}

const DAYS: Record<string, number> = {
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
};

/** Prochaine occurrence d'un jour de la semaine (jamais aujourd'hui). */
function nextWeekday(day: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  let diff = (day - d.getDay() + 7) % 7;
  if (diff === 0) diff = 7;
  d.setDate(d.getDate() + diff);
  return d;
}

export function analyseVoiceText(rawText: string): VoiceAnalysis {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  // --- 1. Espace cible : mots-clés "collectifs" => SHARED, sinon PRIVATE
  const isShared = /\b(notre|nos|nous|on doit|ensemble|commune?)\b/.test(lower);

  // --- 2. Détection de la date
  let dueDate: Date | null = null;
  let dueLabel: string | null = null;

  if (/\baujourd'?hui\b/.test(lower)) {
    dueDate = new Date();
    dueDate.setHours(0, 0, 0, 0);
    dueLabel = "Aujourd'hui";
  } else if (/\bdemain\b/.test(lower)) {
    dueDate = new Date();
    dueDate.setHours(0, 0, 0, 0);
    dueDate.setDate(dueDate.getDate() + 1);
    dueLabel = 'Demain';
  } else if (/\bweek[- ]?end\b/.test(lower)) {
    dueDate = nextWeekday(6);
    dueLabel = 'Ce week-end';
  } else {
    for (const [name, index] of Object.entries(DAYS)) {
      if (new RegExp(`\\b${name}\\b`).test(lower)) {
        dueDate = nextWeekday(index);
        dueLabel = `Prochain ${name}`;
        break;
      }
    }
  }

  // --- 3. Heure éventuelle ("à 15h", "a 9h30") => tâche non "journée entière"
  // NB : pas de \b devant "à" (les caractères accentués ne sont pas des
  // caractères de mot en regex JS), on ancre sur un espace ou le début.
  let isAllDay = true;
  const hourMatch = lower.match(/(?:^|\s)(?:à|a)\s*(\d{1,2})\s*h(\d{2})?\b/);
  if (dueDate && hourMatch) {
    dueDate.setHours(parseInt(hourMatch[1], 10), parseInt(hourMatch[2] ?? '0', 10));
    isAllDay = false;
  }

  // --- 4. Extraction du titre : on retire la formule de commande et la date
  let title = text
    // "Ajoute / Rajoute / Mets / Crée / Note / Planifie ..."
    .replace(/^(ajoute[sz]?|rajoute[sz]?|mets?|crée[sz]?|note[sz]?|planifie[sz]?)\s+/i, '')
    // "... à notre/ma/sa/la liste (de|d') ..."
    .replace(/^(?:à|a|dans|sur)\s+(?:ma|mon|notre|sa|son|la|l')\s*liste\s*(?:de\s+|d')?/i, '')
    // retire la mention de date/heure du titre
    .replace(/\b(?:pour\s+|ce\s+|cette\s+)?(aujourd'?hui|demain|week[- ]?end|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/gi, '')
    .replace(/(?:^|\s)(?:à|a)\s*\d{1,2}\s*h(?:\d{2})?\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/[.,;\s]+$/, '');

  if (title.length === 0) title = text; // filet de sécurité
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return {
    title,
    environment_type: isShared ? 'SHARED' : 'PRIVATE',
    due_date: dueLabel,
    due_datetime: dueDate ? dueDate.toISOString() : null,
    is_all_day: isAllDay,
  };
}
