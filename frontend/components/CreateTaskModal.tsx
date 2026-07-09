/**
 * Création rapide d'une tâche/événement, avec une date pré-remplie
 * (utilisé depuis l'agenda : « + » sur un jour sélectionné).
 */
import React, { useEffect, useState } from 'react';
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
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { createTask } from '../lib/api';
import { notify } from '../lib/notify';

type SpaceChoice = 'PRIVATE' | 'SHARED' | 'SHARED_PARTNER';

const SPACE_OPTIONS: { value: SpaceChoice; label: string }[] = [
  { value: 'PRIVATE', label: 'Mon Espace' },
  { value: 'SHARED', label: 'Notre Espace' },
  { value: 'SHARED_PARTNER', label: 'Son Espace' },
];

interface Props {
  /** Jour cible 'YYYY-MM-DD' ; null quand la modale est fermée. */
  day: string | null;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateTaskModal({ day, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [space, setSpace] = useState<SpaceChoice>('SHARED');
  const [isAllDay, setIsAllDay] = useState(true);
  const [time, setTime] = useState({ h: 9, m: 0 });
  const [showTime, setShowTime] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (day) {
      setTitle('');
      setSpace('SHARED');
      setIsAllDay(true);
      setTime({ h: 9, m: 0 });
      setShowTime(false);
      setError(null);
    }
  }, [day]);

  const handleCreate = async () => {
    if (!day) return;
    if (!title.trim()) {
      setError('Le titre est requis');
      return;
    }
    // Construit la date à partir du jour tapé + heure choisie (ou 00:00 si journée)
    const [y, mo, d] = day.split('-').map(Number);
    const start = new Date(y, mo - 1, d, isAllDay ? 0 : time.h, isAllDay ? 0 : time.m, 0);

    setLoading(true);
    setError(null);
    try {
      const result = await createTask({
        title: title.trim(),
        environment_type: space === 'PRIVATE' ? 'PRIVATE' : 'SHARED',
        assign_to_partner: space === 'SHARED_PARTNER',
        start_datetime: start.toISOString(),
        is_all_day: isAllDay,
      });
      onClose();
      onCreated();
      if (result.has_conflict) notify('⚠️ Conflit d’agenda', result.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la création');
      setLoading(false);
    }
  };

  const dayLabel = day
    ? new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : '';
  const timeLabel = `${`${time.h}`.padStart(2, '0')}:${`${time.m}`.padStart(2, '0')}`;

  return (
    <Modal visible={day !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <Text style={styles.title}>➕ Nouvel événement</Text>
          <View style={styles.dayRow}>
            <Ionicons name="calendar-outline" size={16} color="#7F8C8D" />
            <Text style={styles.dayText}>{dayLabel}</Text>
          </View>

          <Text style={styles.label}>Titre</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ex : Dîner au restaurant"
            autoFocus
          />

          <Text style={styles.label}>Espace</Text>
          <View style={styles.segments}>
            {SPACE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.segment, space === opt.value && styles.segmentActive]}
                onPress={() => setSpace(opt.value)}
              >
                <Text
                  style={[styles.segmentText, space === opt.value && styles.segmentTextActive]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.label}>Journée entière</Text>
            <Switch value={isAllDay} onValueChange={setIsAllDay} />
          </View>

          {!isAllDay && (
            <TouchableOpacity style={styles.dateField} onPress={() => setShowTime(true)}>
              <Ionicons name="time-outline" size={18} color="#7F8C8D" />
              <Text style={styles.dateFieldText}>{timeLabel}</Text>
            </TouchableOpacity>
          )}
          {showTime && (
            <DateTimePicker
              value={new Date(2020, 0, 1, time.h, time.m)}
              mode="time"
              onValueChange={(_e, selected) => {
                setShowTime(false);
                setTime({ h: selected.getHours(), m: selected.getMinutes() });
              }}
              onDismiss={() => setShowTime(false)}
            />
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
              <Text style={styles.secondaryText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleCreate} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>Créer ✓</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
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
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  dayText: { color: '#7F8C8D', textTransform: 'capitalize' },
  label: { fontSize: 13, fontWeight: '600', color: '#2C3E50', marginTop: 6 },
  input: { borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 10, padding: 12, fontSize: 16 },
  segments: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: '#E0526E', borderColor: '#E0526E' },
  segmentText: { fontSize: 13, color: '#2C3E50' },
  segmentTextActive: { color: '#fff', fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    padding: 12,
  },
  dateFieldText: { fontSize: 15, color: '#2C3E50' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#E0526E',
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
  error: { color: '#C0392B', marginTop: 4 },
});
