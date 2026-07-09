/**
 * Modale d'édition d'une tâche existante.
 * Ouverte via le swipe horizontal → « Modifier » sur une TaskCard.
 * Édite le titre, la description, le statut et la date/heure ; PATCH partiel.
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
import { updateTask } from '../lib/api';
import { notify } from '../lib/notify';
import { Task, TaskStatus, UpdateTaskPayload } from '../types';

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'TODO', label: 'À faire' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'DONE', label: 'Terminé' },
];

interface Props {
  /** Tâche à éditer, ou null quand la modale est fermée. */
  task: Task | null;
  onClose: () => void;
  /** Appelé après sauvegarde réussie pour rafraîchir la liste. */
  onSaved: () => void;
}

export default function EditTaskModal({ task, onClose, onSaved }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('TODO');

  // Date : "scheduled" active/désactive un créneau ; date + journée entière + heure
  const [scheduled, setScheduled] = useState(false);
  const [date, setDate] = useState(new Date());
  const [isAllDay, setIsAllDay] = useState(true);
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pré-remplit le formulaire à chaque ouverture (nouvelle tâche sélectionnée)
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? '');
    setStatus(task.status);
    setError(null);
    setShowDate(false);
    setShowTime(false);
    if (task.startDatetime) {
      setScheduled(true);
      setDate(new Date(task.startDatetime));
      setIsAllDay(task.isAllDay);
    } else {
      setScheduled(false);
      setDate(new Date());
      setIsAllDay(true);
    }
  }, [task]);

  const handleSave = async () => {
    if (!task) return;
    if (!title.trim()) {
      setError('Le titre est requis');
      return;
    }
    setLoading(true);
    setError(null);

    const payload: UpdateTaskPayload = {
      title: title.trim(),
      description: description.trim() || null,
      status,
    };
    if (scheduled) {
      payload.start_datetime = date.toISOString();
      payload.end_datetime = null; // le backend dérive la fin (journée ou +1h)
      payload.is_all_day = isAllDay;
    } else {
      payload.start_datetime = null; // on retire le créneau
      payload.end_datetime = null;
    }

    try {
      const result = await updateTask(task.id, payload);
      onClose();
      onSaved();
      if (result.has_conflict) notify('⚠️ Conflit d’agenda', result.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la mise à jour');
      setLoading(false);
    }
  };

  const dateLabel = date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const timeLabel = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <Modal visible={task !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <Text style={styles.title}>✏️ Modifier la tâche</Text>

          <Text style={styles.label}>Titre</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Optionnel"
            multiline
          />

          <Text style={styles.label}>Statut</Text>
          <View style={styles.segments}>
            {STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.segment, status === opt.value && styles.segmentActive]}
                onPress={() => setStatus(opt.value)}
              >
                <Text
                  style={[styles.segmentText, status === opt.value && styles.segmentTextActive]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* --- Date / heure --- */}
          <View style={styles.switchRow}>
            <Text style={styles.label}>Planifier une date</Text>
            <Switch value={scheduled} onValueChange={setScheduled} />
          </View>

          {scheduled && (
            <>
              <TouchableOpacity style={styles.dateField} onPress={() => setShowDate(true)}>
                <Ionicons name="calendar-outline" size={18} color="#7F8C8D" />
                <Text style={styles.dateFieldText}>{dateLabel}</Text>
              </TouchableOpacity>

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

              {showDate && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  onValueChange={(_event, selected) => {
                    setShowDate(false);
                    const d = new Date(date);
                    d.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                    setDate(d);
                  }}
                  onDismiss={() => setShowDate(false)}
                />
              )}
              {showTime && (
                <DateTimePicker
                  value={date}
                  mode="time"
                  onValueChange={(_event, selected) => {
                    setShowTime(false);
                    const d = new Date(date);
                    d.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
                    setDate(d);
                  }}
                  onDismiss={() => setShowTime(false)}
                />
              )}
            </>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
              <Text style={styles.secondaryText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSave} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>Enregistrer ✓</Text>
              )}
            </TouchableOpacity>
          </View>
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
  title: { fontSize: 20, fontWeight: '700', color: '#2C3E50', marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#2C3E50', marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    padding: 12,
  },
  dateFieldText: { fontSize: 15, color: '#2C3E50', textTransform: 'capitalize' },
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
