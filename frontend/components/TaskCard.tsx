import React, { useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
// Touchables importées de gesture-handler (et non de react-native) : requis pour que
// les onPress soient bien reçus sur le web quand elles sont imbriquées dans un Swipeable.
import { Swipeable, TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../lib/theme';
import { Task, TaskStatus } from '../types';

const STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  TODO: { label: 'À faire', color: '#95A5A6' },
  IN_PROGRESS: { label: 'En cours', color: '#F39C12' },
  DONE: { label: 'Terminé', color: '#27AE60' },
};

/** Libellé d'ACTION vers un statut (web) : formule à la 1re personne. */
const STATUS_ACTION: Record<TaskStatus, string> = {
  TODO: 'Je mets en pause',
  IN_PROGRESS: 'Je débute la tâche',
  DONE: "J'ai terminé",
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
  /** Tâche assignée au partenaire : consultable mais non modifiable. */
  readOnly?: boolean;
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
  readOnly = false,
  onToggleStatus,
  onNextStatus,
  onPreviousStatus,
  onEdit,
  onDelete,
}: Props) {
  const meta = STATUS_META[task.status];
  const date = formatDate(task);
  const swipeRef = useRef<Swipeable>(null);

  // Les 2 boutons de statut affichent le libellé du statut CIBLE.
  const prev = previousStatus(task.status);
  const next = nextStatus(task.status);

  // --- Variante WEB : carte à coins arrondis avec boutons visibles en bas
  // (le swipe est peu naturel à la souris) + effets de survol.
  if (Platform.OS === 'web') {
    return (
      <Pressable style={({ hovered }: any) => [styles.webCard, hovered && styles.webCardHover]}>
        <View style={styles.webHeader}>
          <View style={[styles.webDot, { backgroundColor: meta.color }]} />
          <Text style={[styles.webTitle, task.status === 'DONE' && styles.done]} numberOfLines={2}>
            {task.title}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={[styles.statusLabel, { color: meta.color }]}>{meta.label}</Text>
          {date && <Text style={styles.date}>{date}</Text>}
          {task.assignee && <Text style={styles.assignee}>👤 {task.assignee.name}</Text>}
        </View>

        {readOnly ? (
          <Text style={[styles.readOnly, styles.webFooter]}>🔒 Lecture seule</Text>
        ) : (
          <View style={styles.webFooter}>
            <View style={styles.webStatusGroup}>
              <WebActionButton
                color={STATUS_META[prev].color}
                icon={STATUS_ICON[prev]}
                label={STATUS_ACTION[prev]}
                onPress={() => onPreviousStatus(task)}
              />
              <WebActionButton
                color={STATUS_META[next].color}
                icon={STATUS_ICON[next]}
                label={STATUS_ACTION[next]}
                onPress={() => onNextStatus(task)}
              />
            </View>
            <View style={styles.webIconGroup}>
              <WebIconBtn color="#3498DB" icon="create-outline" onPress={() => onEdit(task)} />
              <WebIconBtn color="#C0392B" icon="trash-outline" onPress={() => onDelete(task)} />
            </View>
          </View>
        )}
      </Pressable>
    );
  }

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
      // En lecture seule : aucune action de swipe (ni statut, ni modifier/supprimer).
      renderRightActions={readOnly ? undefined : renderRightActions}
      renderLeftActions={readOnly ? undefined : renderLeftActions}
      overshootRight={false}
      overshootLeft={false}
      containerStyle={styles.swipeContainer}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={() => onToggleStatus(task)}
        activeOpacity={readOnly ? 1 : 0.7}
        disabled={readOnly}
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
            {readOnly && <Text style={styles.readOnly}>🔒 Lecture seule</Text>}
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

/** Bouton d'action de changement de statut (web) : contour, sans fond, avec
 *  un léger remplissage au survol pour l'affordance. */
function WebActionButton({
  color,
  icon,
  label,
  onPress,
}: {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: any) => [
        styles.actionBtn,
        { borderColor: color },
        hovered && { backgroundColor: `${color}14` }, // teinte ~8% au survol
      ]}
    >
      <Ionicons name={icon} size={15} color={color} />
      <Text style={[styles.actionBtnText, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** Bouton icône (modifier / supprimer) sur le web. */
function WebIconBtn({
  color,
  icon,
  onPress,
}: {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: any) => [styles.iconBtn, hovered && { backgroundColor: color }]}
    >
      {({ hovered }: any) => (
        <Ionicons name={icon} size={18} color={hovered ? '#fff' : color} />
      )}
    </Pressable>
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
  readOnly: { fontSize: 10, color: '#95A5A6', fontStyle: 'italic' },

  // --- Variante web (carte + boutons visibles) ---
  webCard: {
    flex: 1,
    minHeight: 132,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECECEC',
    padding: 16,
    gap: 8,
    cursor: 'auto',
  },
  webCardHover: {
    borderColor: COLORS.secondary,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    transform: [{ translateY: -2 }],
  },
  webHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  webDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  webTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#2C3E50' },
  webFooter: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  webStatusGroup: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  webIconGroup: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    cursor: 'pointer',
  },
  actionBtnText: { fontWeight: '600', fontSize: 12 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ECECEC',
    cursor: 'pointer',
  },
});
