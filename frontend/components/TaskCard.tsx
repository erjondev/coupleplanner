import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
// Touchables importées de gesture-handler (et non de react-native) : requis pour que
// les onPress soient bien reçus sur le web quand elles sont imbriquées dans un Swipeable.
import { Swipeable, TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Task, TaskStatus } from '../types';

const STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  TODO: { label: 'À faire', color: '#95A5A6' },
  IN_PROGRESS: { label: 'En cours', color: '#F39C12' },
  DONE: { label: 'Terminé', color: '#27AE60' },
};

const STATUS_ICON: Record<TaskStatus, keyof typeof Ionicons.glyphMap> = {
  TODO: 'ellipse-outline',
  IN_PROGRESS: 'time-outline',
  DONE: 'checkmark-circle-outline',
};

/** Cycle de statut au tap : TODO -> IN_PROGRESS -> DONE -> TODO. */
export function nextStatus(status: TaskStatus): TaskStatus {
  if (status === 'TODO') return 'IN_PROGRESS';
  if (status === 'IN_PROGRESS') return 'DONE';
  return 'TODO';
}

/** Cycle inverse (utilisé par le bouton de statut précédent) : TODO -> DONE -> IN_PROGRESS -> TODO. */
export function previousStatus(status: TaskStatus): TaskStatus {
  if (status === 'IN_PROGRESS') return 'TODO';
  if (status === 'DONE') return 'IN_PROGRESS';
  return 'DONE';
}

function formatDate(task: Task): string | null {
  if (!task.startDatetime) return null;
  const start = new Date(task.startDatetime);
  const day = start.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  if (task.isAllDay) return `${day} · journée`;
  const time = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

interface Props {
  task: Task;
  onToggleStatus: (task: Task) => void;
  /** Fait passer la tâche au statut suivant (swipe vers la gauche). */
  onNextStatus: (task: Task) => void;
  /** Fait passer la tâche au statut précédent (swipe vers la gauche). */
  onPreviousStatus: (task: Task) => void;
  /** Ouvre l'édition (swipe vers la gauche → Modifier). */
  onEdit: (task: Task) => void;
  /** Supprime la tâche (swipe vers la droite → Supprimer). */
  onDelete: (task: Task) => void;
}

export default function TaskCard({
  task,
  onToggleStatus,
  onNextStatus,
  onPreviousStatus,
  onEdit,
  onDelete,
}: Props) {
  const meta = STATUS_META[task.status];
  const date = formatDate(task);
  const swipeRef = useRef<Swipeable>(null);

  // Swipe vers la gauche (actions à droite de la carte) : changement de statut + Modifier.
  // Les 2 boutons de statut affichent le libellé du statut CIBLE (pas "Précédent"/"Suivant").
  const prev = previousStatus(task.status);
  const next = nextStatus(task.status);

  const renderRightActions = () => (
    <>
      <TouchableOpacity
        style={[styles.statusAction, { backgroundColor: STATUS_META[prev].color }]}
        onPress={() => {
          swipeRef.current?.close();
          onPreviousStatus(task);
        }}
      >
        <Ionicons name={STATUS_ICON[prev]} size={22} color="#fff" />
        <Text style={styles.actionText}>{STATUS_META[prev].label}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.statusAction, { backgroundColor: STATUS_META[next].color }]}
        onPress={() => {
          swipeRef.current?.close();
          onNextStatus(task);
        }}
      >
        <Ionicons name={STATUS_ICON[next]} size={22} color="#fff" />
        <Text style={styles.actionText}>{STATUS_META[next].label}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.editAction}
        onPress={() => {
          swipeRef.current?.close();
          onEdit(task);
        }}
      >
        <Ionicons name="create-outline" size={22} color="#fff" />
        <Text style={styles.actionText}>Modifier</Text>
      </TouchableOpacity>
    </>
  );

  // Swipe vers la droite (action à gauche de la carte) : Supprimer.
  const renderLeftActions = () => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => {
        swipeRef.current?.close();
        onDelete(task);
      }}
    >
      <Ionicons name="trash-outline" size={22} color="#fff" />
      <Text style={styles.actionText}>Supprimer</Text>
    </TouchableOpacity>
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      overshootRight={false}
      overshootLeft={false}
      containerStyle={styles.swipeContainer}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={() => onToggleStatus(task)}
        activeOpacity={0.7}
      >
        <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
        <View style={styles.content}>
          <Text style={[styles.title, task.status === 'DONE' && styles.done]} numberOfLines={2}>
            {task.title}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.statusLabel, { color: meta.color }]}>{meta.label}</Text>
            {date && <Text style={styles.date}>{date}</Text>}
            {task.assignee && <Text style={styles.assignee}>👤 {task.assignee.name}</Text>}
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  swipeContainer: {
    marginBottom: 8,
    borderRadius: 10,
    overflow: 'hidden', // pour que l'action révélée respecte les coins arrondis
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 11,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  editAction: {
    backgroundColor: '#3498DB',
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    gap: 2,
  },
  deleteAction: {
    backgroundColor: '#C0392B',
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    gap: 2,
  },
  statusAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    gap: 2,
  },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  content: { flex: 1 },
  title: { fontSize: 13, fontWeight: '600', color: '#2C3E50' },
  done: { textDecorationLine: 'line-through', color: '#95A5A6' },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 3, flexWrap: 'wrap' },
  statusLabel: { fontSize: 10, fontWeight: '600' },
  date: { fontSize: 10, color: '#7F8C8D' },
  assignee: { fontSize: 10, color: '#7F8C8D' },
});
