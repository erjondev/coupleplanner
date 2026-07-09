/**
 * Reconnaissance vocale (Speech-to-Text) cross-platform.
 * Enveloppe expo-speech-recognition : iOS, Android et Web (Web Speech API).
 *
 * Le transcript (partiel puis final) est renvoyé via `onTranscript` — on le
 * branche sur le champ texte de la modale, qui reste éditable en repli.
 *
 * ⚠️ Le module natif n'existe pas dans Expo Go : les appels sont protégés,
 * et en cas d'indisponibilité l'utilisateur peut toujours taper le texte.
 */
import { useCallback, useState } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

interface SpeechRecognition {
  listening: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function useSpeechRecognition(onTranscript: (text: string) => void): SpeechRecognition {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Les listeners sont enregistrés inconditionnellement (règles des hooks) ;
  // ils ne se déclenchent simplement pas si le natif est absent.
  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript ?? '';
    if (transcript) onTranscript(transcript);
  });
  useSpeechRecognitionEvent('error', (event) => {
    setError(`Erreur de reconnaissance : ${event.error}`);
    setListening(false);
  });

  const start = useCallback(async () => {
    setError(null);
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        setError('Permission micro refusée.');
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: 'fr-FR',
        interimResults: true, // transcript en direct pendant qu'on parle
        continuous: false, // s'arrête automatiquement à la fin de la phrase
      });
    } catch {
      setError(
        "Reconnaissance vocale indisponible ici (nécessite un build de dev ou un navigateur compatible). Vous pouvez taper le texte."
      );
    }
  }, []);

  const stop = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      /* no-op */
    }
    setListening(false);
  }, []);

  return { listening, error, start, stop };
}
