/**
 * Fonctionnalité phare : ajout de tâche par la voix.
 *
 * Étape 1 ("input")  : simulation de l'entrée vocale via un champ texte
 *                      (à remplacer plus tard par expo-speech-recognition).
 * Étape 2 ("review") : POP-UP DE VALIDATION obligatoire — les données
 *                      extraites par l'IA sont affichées dans un formulaire
 *                      modifiable avant enregistrement.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from './PlatformDateTimePicker';
import { Ionicons } from '@expo/vector-icons';
import { createTask, voiceAnalyse } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { notify } from '../lib/notify';
import { COLORS } from '../lib/theme';
import { useSpeechRecognition } from '../lib/useSpeechRecognition';
import { CreateTaskResponse } from '../types';

/** Choix d'espace dans le formulaire de validation. */
type SpaceChoice = 'PRIVATE' | 'SHARED' | 'SHARED_PARTNER';

const SPACE_OPTIONS: { value: SpaceChoice; label: string }[] = [
  { value: 'PRIVATE', label: 'Mon Espace' },
  { value: 'SHARED', label: 'Notre Espace' },
  { value: 'SHARED_PARTNER', label: 'Son Espace' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Appelé après création réussie pour rafraîchir la liste. */
  onTaskCreated: () => void;
}

export default function VoiceModal({ visible, onClose, onTaskCreated }: Props) {
  const { partner } = useAuth();
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Étape 1 : texte issu de la dictée vocale (ou saisi à la main)
  const [voiceText, setVoiceText] = useState('');
  const speech = useSpeechRecognition(setVoiceText); // remplit le champ en direct

  // Étape 2 : formulaire pré-rempli par l'analyse IA, modifiable
  const [title, setTitle] = useState('');
  const [space, setSpace] = useState<SpaceChoice>('SHARED');
  const [dateLabel, setDateLabel] = useState<string | null>(null);
  const [dateIso, setDateIso] = useState<string | null>(null);
  const [isAllDay, setIsAllDay] = useState(true);
  // Sélecteurs de date/heure (pour poser ou corriger l'échéance manuellement,
  // notamment quand l'IA n'a détecté aucune date).
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  // Proposition : soumettre l'activité au partenaire avant qu'elle n'entre à l'agenda.
  const [isProposal, setIsProposal] = useState(false);

  /** Applique le jour choisi à l'échéance (crée l'échéance si elle était absente). */
  const applyDate = (selected: Date) => {
    const hadDate = dateIso !== null;
    const base = hadDate ? new Date(dateIso!) : new Date();
    base.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    if (isAllDay) base.setHours(0, 0, 0, 0);
    else if (!hadDate) base.setHours(9, 0, 0, 0); // heure par défaut d'un nouveau créneau
    setDateIso(base.toISOString());
    setDateLabel(null); // le libellé IA ("ce samedi") ne correspond plus après édition
  };

  /** Applique l'heure choisie à l'échéance existante. */
  const applyTime = (selected: Date) => {
    const base = dateIso ? new Date(dateIso) : new Date();
    base.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setDateIso(base.toISOString());
  };

  /** Bascule journée entière : ajuste l'heure du créneau en conséquence. */
  const handleAllDayToggle = (value: boolean) => {
    setIsAllDay(value);
    if (!dateIso) return;
    const d = new Date(dateIso);
    if (value) d.setHours(0, 0, 0, 0);
    else if (d.getHours() === 0 && d.getMinutes() === 0) d.setHours(9, 0, 0, 0);
    setDateIso(d.toISOString());
  };

  const reset = () => {
    speech.stop(); // coupe le micro si une écoute est en cours
    setStep('input');
    setVoiceText('');
    setIsProposal(false);
    setShowDate(false);
    setShowTime(false);
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  /** Étape 1 -> 2 : envoie le texte à l'endpoint IA et pré-remplit le formulaire. */
  const handleAnalyse = async () => {
    if (!voiceText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const analysis = await voiceAnalyse(voiceText);
      setTitle(analysis.title);
      setSpace(analysis.environment_type); // PRIVATE ou SHARED
      setDateLabel(analysis.due_date);
      setDateIso(analysis.due_datetime);
      setIsAllDay(analysis.is_all_day);
      setStep('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'analyse");
    } finally {
      setLoading(false);
    }
  };

  /** Confirmation : enregistre la tâche puis affiche l'alerte de conflit éventuelle. */
  const handleConfirm = async () => {
    if (!title.trim()) {
      setError('Le titre est requis');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result: CreateTaskResponse = await createTask({
        title: title.trim(),
        environment_type: isProposal || space !== 'PRIVATE' ? 'SHARED' : 'PRIVATE',
        assign_to_partner: !isProposal && space === 'SHARED_PARTNER',
        is_proposal: isProposal,
        start_datetime: dateIso,
        is_all_day: isAllDay,
      });

      handleClose();
      onTaskCreated();

      // Gestion de l'alerte de conflit d'agenda (message générique, sans
      // divulguer le contenu de la tâche privée du partenaire)
      if (isProposal) {
        notify('📨 Proposition envoyée', result.message);
      } else if (result.has_conflict) {
        notify('⚠️ Conflit d’agenda', result.message);
      } else {
        notify('✅ Tâche créée', `« ${result.task.title} » a été ajoutée.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la création');
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          {step === 'input' ? (
            <>
              <Text style={styles.title}>🎤 Dictée vocale</Text>
              <Text style={styles.subtitle}>
                Appuyez sur « Dicter » et parlez, ou tapez le texte.
              </Text>

              {/* Bouton micro : démarre/arrête la reconnaissance vocale */}
              <TouchableOpacity
                style={[styles.micBtn, speech.listening && styles.micBtnActive]}
                onPress={speech.listening ? speech.stop : speech.start}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={speech.listening ? 'stop-circle' : 'mic'}
                  size={22}
                  color="#fff"
                />
                <Text style={styles.micBtnText}>
                  {speech.listening ? 'En écoute… (appuyez pour arrêter)' : 'Dicter'}
                </Text>
              </TouchableOpacity>

              <TextInput
                style={[styles.input, styles.voiceInput]}
                value={voiceText}
                onChangeText={setVoiceText}
                placeholder='Ex : "Ajoute à notre liste de réparer la voiture ce samedi"'
                placeholderTextColor="#999"
                multiline
                autoFocus
              />
              {speech.error && <Text style={styles.error}>{speech.error}</Text>}
              {error && <Text style={styles.error}>{error}</Text>}
              <View style={styles.actions}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleClose}>
                  <Text style={styles.secondaryText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, !voiceText.trim() && styles.disabled]}
                  onPress={handleAnalyse}
                  disabled={loading || !voiceText.trim()}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryText}>Analyser ✨</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>✨ L’IA a compris :</Text>
              <Text style={styles.subtitle}>Vérifiez et corrigez avant d’enregistrer.</Text>

              {/* Titre extrait — modifiable */}
              <Text style={styles.label}>Titre</Text>
              <TextInput style={styles.input} value={title} onChangeText={setTitle} />

              {/* Espace cible — modifiable (masqué si proposition) */}
              {!isProposal && (
                <>
                  <Text style={styles.label}>Espace</Text>
                  <View style={styles.segments}>
                    {SPACE_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.segment, space === opt.value && styles.segmentActive]}
                        onPress={() => setSpace(opt.value)}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            space === opt.value && styles.segmentTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Proposition : soumettre au partenaire (seulement en couple) */}
              {partner && (
                <>
                  <View style={styles.switchRow}>
                    <Text style={styles.label}>Proposer à {partner.name}</Text>
                    <Switch value={isProposal} onValueChange={setIsProposal} />
                  </View>
                  {isProposal && (
                    <Text style={styles.hint}>
                      L'activité rejoindra l'agenda une fois validée par {partner.name}.
                    </Text>
                  )}
                </>
              )}

              {/* Échéance : détectée par l'IA, ajoutable/modifiable à la main */}
              <Text style={styles.label}>Échéance</Text>
              {dateIso ? (
                <>
                  <View style={styles.dateRow}>
                    <TouchableOpacity style={styles.dateField} onPress={() => setShowDate(true)}>
                      <Ionicons name="calendar-outline" size={18} color="#7F8C8D" />
                      <Text style={styles.dateFieldText}>
                        {`${dateLabel ? `${dateLabel} — ` : ''}${new Date(dateIso).toLocaleDateString(
                          'fr-FR',
                          { weekday: 'long', day: 'numeric', month: 'long' }
                        )}`}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setDateIso(null); setDateLabel(null); }}
                    >
                      <Ionicons name="close-circle" size={20} color="#95A5A6" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.switchRow}>
                    <Text style={styles.label}>Journée entière</Text>
                    <Switch value={isAllDay} onValueChange={handleAllDayToggle} />
                  </View>

                  {!isAllDay && (
                    <TouchableOpacity style={styles.dateField} onPress={() => setShowTime(true)}>
                      <Ionicons name="time-outline" size={18} color="#7F8C8D" />
                      <Text style={styles.dateFieldText}>
                        {new Date(dateIso).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <TouchableOpacity style={styles.addDateBtn} onPress={() => setShowDate(true)}>
                  <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.addDateText}>Ajouter une date</Text>
                </TouchableOpacity>
              )}

              {showDate && (
                <DateTimePicker
                  value={dateIso ? new Date(dateIso) : new Date()}
                  mode="date"
                  onValueChange={(_event, selected) => {
                    setShowDate(false);
                    applyDate(selected);
                  }}
                  onDismiss={() => setShowDate(false)}
                />
              )}
              {showTime && (
                <DateTimePicker
                  value={dateIso ? new Date(dateIso) : new Date()}
                  mode="time"
                  onValueChange={(_event, selected) => {
                    setShowTime(false);
                    applyTime(selected);
                  }}
                  onDismiss={() => setShowTime(false)}
                />
              )}

              {error && <Text style={styles.error}>{error}</Text>}

              <View style={styles.actions}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('input')}>
                  <Text style={styles.secondaryText}>Retour</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleConfirm}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryText}>Confirmer ✓</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    gap: 8,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#2C3E50' },
  subtitle: { color: '#7F8C8D', marginBottom: 8 },
  hint: { fontSize: 12, color: '#7F8C8D', fontStyle: 'italic', marginTop: 2 },
  label: { fontSize: 13, fontWeight: '600', color: '#2C3E50', marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#2C3E50',
  },
  voiceInput: { minHeight: 80, textAlignVertical: 'top' },
  micBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3498DB',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 4,
  },
  micBtnActive: { backgroundColor: '#C0392B' },
  micBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  segments: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  segmentText: { fontSize: 13, color: '#2C3E50' },
  segmentTextActive: { color: '#fff', fontWeight: '600' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  dateField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    padding: 12,
  },
  dateFieldText: { flex: 1, fontSize: 15, color: '#2C3E50', textTransform: 'capitalize' },
  addDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: 10,
    paddingVertical: 12,
  },
  addDateText: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  primaryBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  secondaryText: { color: '#2C3E50' },
  disabled: { opacity: 0.5 },
  error: { color: '#C0392B', marginTop: 4 },
});
