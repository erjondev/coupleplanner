/**
 * Écran générique d'un "espace" : liste des tâches filtrées selon
 * l'onglet actif + bouton micro flottant pour la création vocale.
 */
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { deleteTask, getTasks, updateTaskStatus } from '../lib/api';
import { confirmAction } from '../lib/notify';
import { useAuth } from '../lib/auth-context';
import { COLORS } from '../lib/theme';
import { SIDEBAR_WIDTH, useIsWideWeb, useTaskColumns } from '../lib/responsive';
import { Space, Task } from '../types';
import TaskCard, { nextStatus, previousStatus } from './TaskCard';
import VoiceModal from './VoiceModal';
import EditTaskModal from './EditTaskModal';
import InviteBanner from './InviteBanner';

interface Props {
  space: Space;
  emptyLabel: string;
}

/** Séparateur vertical entre cartes/lignes sur le web. */
function WebSpacer() {
  return <View style={styles.webSpacer} />;
}

export default function SpaceScreen({ space, emptyLabel }: Props) {
  const { user } = useAuth();
  const wideWeb = useIsWideWeb();
  const columns = useTaskColumns();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [micOpen, setMicOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null); // tâche en cours d'édition
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setError(null);
      const { tasks: data } = await getTasks(space);
      setTasks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setRefreshing(false);
    }
  }, [space]);

  // Recharge la liste à chaque fois que l'onglet devient actif
  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks])
  );

  const applyStatus = async (task: Task, status: Task['status']) => {
    // Mise à jour optimiste pour une UI réactive
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      await updateTaskStatus(task.id, status);
    } catch {
      loadTasks(); // rollback en cas d'échec
    }
  };

  const handleToggleStatus = (task: Task) => applyStatus(task, nextStatus(task.status));
  const handleNextStatus = (task: Task) => applyStatus(task, nextStatus(task.status));
  const handlePreviousStatus = (task: Task) => applyStatus(task, previousStatus(task.status));

  // Sur une grille multi-colonnes, on complète la dernière ligne avec des cases
  // vides pour que les cartes gardent la largeur d'une colonne.
  type GridItem = Task | { id: string; filler: true };
  const gridData: GridItem[] = React.useMemo(() => {
    if (columns <= 1) return tasks;
    const rem = tasks.length % columns;
    if (rem === 0) return tasks;
    const fillers = Array.from({ length: columns - rem }, (_, i) => ({
      id: `__filler_${i}`,
      filler: true as const,
    }));
    return [...tasks, ...fillers];
  }, [tasks, columns]);

  const handleDelete = async (task: Task) => {
    const ok = await confirmAction(
      'Supprimer la tâche',
      `« ${task.title} » sera définitivement supprimée.`,
      'Supprimer'
    );
    if (!ok) return;
    // Suppression optimiste
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    try {
      await deleteTask(task.id);
    } catch {
      loadTasks(); // rollback si l'API échoue
    }
  };

  return (
    <View style={[styles.container, wideWeb && { paddingLeft: SIDEBAR_WIDTH }]}>
      <InviteBanner />
      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={gridData}
        keyExtractor={(t) => t.id}
        // La grille change de nombre de colonnes selon la largeur ; `key` force
        // FlatList à se re-monter quand numColumns change (contrainte RN).
        key={`cols-${columns}`}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
        ItemSeparatorComponent={Platform.OS === 'web' ? WebSpacer : undefined}
        contentContainerStyle={[styles.list, Platform.OS === 'web' && styles.listWeb]}
        renderItem={({ item }) => {
          // Case vide pour compléter la dernière ligne de la grille (web large).
          if ('filler' in item) return <View style={styles.filler} />;
          return (
            <TaskCard
              task={item}
              // Lecture seule si la tâche est assignée au partenaire (pas à moi).
              readOnly={item.assignedTo !== null && item.assignedTo !== user?.id}
              onToggleStatus={handleToggleStatus}
              onNextStatus={handleNextStatus}
              onPreviousStatus={handlePreviousStatus}
              onEdit={setEditing}
              onDelete={handleDelete}
            />
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadTasks();
            }}
          />
        }
        ListEmptyComponent={<Text style={styles.empty}>{emptyLabel}</Text>}
      />

      {/* Bouton micro flottant — fonctionnalité phare */}
      <TouchableOpacity style={styles.fab} onPress={() => setMicOpen(true)} activeOpacity={0.8}>
        <Ionicons name="mic" size={28} color="#fff" />
      </TouchableOpacity>

      <VoiceModal
        visible={micOpen}
        onClose={() => setMicOpen(false)}
        onTaskCreated={loadTasks}
      />

      <EditTaskModal
        task={editing}
        onClose={() => setEditing(null)}
        onSaved={loadTasks}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryLight },
  list: { padding: 16, paddingBottom: 96 },
  listWeb: { padding: 24, paddingBottom: 96 },
  gridRow: { gap: 16, alignItems: 'stretch' },
  webSpacer: { height: 16 },
  filler: { flex: 1 },
  empty: { textAlign: 'center', color: '#95A5A6', marginTop: 48, paddingHorizontal: 24 },
  error: { color: '#C0392B', textAlign: 'center', padding: 8 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
});
