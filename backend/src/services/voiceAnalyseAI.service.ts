/**
 * Analyse vocale RÉELLE via Google Gemini (palier gratuit).
 *
 * Remplace le mock regex par une extraction structurée : on envoie le texte
 * brut (résultat du Speech-to-Text) à Gemini, qui renvoie un JSON garanti
 * conforme au schéma grâce au mode structured output (responseSchema).
 *
 * Repli automatique sur le mock (voiceAnalyse.service.ts) si GEMINI_API_KEY
 * n'est pas défini — pratique pour développer sans clé.
 *
 * Clé gratuite : https://aistudio.google.com/app/apikey
 */
import { GoogleGenAI, Type } from '@google/genai';
import { analyseVoiceText as analyseVoiceTextMock, VoiceAnalysis } from './voiceAnalyse.service';

// Modèle par défaut : rapide et sur le palier gratuit. Surchargeable via env.
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

// Schéma que Gemini est CONTRAINT de respecter (structured output).
const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Titre court et clair de la tâche, sans la formule de commande ni la date',
    },
    environment_type: {
      type: Type.STRING,
      enum: ['PRIVATE', 'SHARED'],
      description:
        'SHARED si la tâche concerne le couple (mots comme "notre", "nous", "ensemble"), sinon PRIVATE',
    },
    due_date: {
      type: Type.STRING,
      nullable: true,
      description: 'Libellé humain de la date, ex: "Prochain samedi", "Demain". null si aucune date.',
    },
    due_datetime: {
      type: Type.STRING,
      nullable: true,
      description:
        'Date/heure au format ISO 8601 AVEC décalage horaire local (ex: "2026-07-11T20:00:00+02:00"), ' +
        'résolue par rapport à la date du jour. Ne jamais utiliser le suffixe "Z". null si aucune date.',
    },
    is_all_day: {
      type: Type.BOOLEAN,
      description: 'false si une heure précise est mentionnée (ex: "à 10h"), true sinon',
    },
  },
  required: ['title', 'environment_type', 'due_date', 'due_datetime', 'is_all_day'],
  // Ordonne les clés dans la sortie (recommandé par Gemini pour la stabilité)
  propertyOrdering: ['title', 'environment_type', 'due_date', 'due_datetime', 'is_all_day'],
};

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

/** Décalage horaire local sous forme ISO, ex: "+02:00" (heure d'été FR). */
function tzOffset(date: Date): string {
  const minutes = -date.getTimezoneOffset(); // getTimezoneOffset renvoie l'inverse
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  const hh = `${Math.floor(abs / 60)}`.padStart(2, '0');
  const mm = `${abs % 60}`.padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/**
 * Date/heure locale au format ISO 8601 AVEC décalage horaire (jamais "Z"),
 * ex: "2026-07-10T09:42:47+02:00". Sert de référence "maintenant" pour le modèle,
 * afin qu'il produise des heures dans le bon fuseau (une heure dictée = heure locale).
 */
function localIsoWithOffset(date: Date): string {
  const p = (n: number) => `${n}`.padStart(2, '0');
  const d = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  const t = `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
  return `${d}T${t}${tzOffset(date)}`;
}

export async function analyseVoiceTextAI(rawText: string): Promise<VoiceAnalysis> {
  const ai = getClient();

  // Pas de clé -> repli sur le mock regex, l'app reste fonctionnelle.
  if (!ai) {
    return analyseVoiceTextMock(rawText);
  }

  // On donne la date du jour au modèle pour qu'il résolve les dates relatives
  // ("ce samedi", "demain") en dates ISO absolues. La référence est fournie en
  // heure LOCALE avec décalage (et non en UTC) pour que les heures dictées
  // soient interprétées dans le bon fuseau.
  const today = new Date();
  const todayLabel = today.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const offset = tzOffset(today);

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: rawText,
      config: {
        systemInstruction:
          "Tu extrais une tâche à partir d'une phrase dictée en français pour une app de couple. " +
          `Aujourd'hui nous sommes le ${todayLabel}. Il est actuellement ${localIsoWithOffset(today)}. ` +
          `Le fuseau horaire de l'utilisateur est UTC${offset}. ` +
          'Résous les dates relatives en dates ISO 8601 absolues. ' +
          `IMPORTANT : une heure dictée est une heure LOCALE ; inclus TOUJOURS le décalage ${offset} ` +
          `dans due_datetime (ex : "20h" ce jour → une date se terminant par T20:00:00${offset}). ` +
          "N'utilise JAMAIS le suffixe « Z » (qui signifie UTC). " +
          'Un jour de la semaine cité sans autre précision désigne sa PROCHAINE occurrence future.',
        responseMimeType: 'application/json',
        responseSchema: ANALYSIS_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) return analyseVoiceTextMock(rawText); // sécurité : réponse vide
    return JSON.parse(text) as VoiceAnalysis;
  } catch (err) {
    // Quota dépassé, réseau, refus... : on ne plante pas, on retombe sur le mock.
    console.error('Analyse Gemini échouée, repli sur le mock :', err);
    return analyseVoiceTextMock(rawText);
  }
}
