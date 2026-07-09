/**
 * Écran générique d'un "espace" : liste des tâches filtrées selon
 * l'onglet actif + bouton micro flottant pour la création vocale.
 */
import React, { useCallback, useState } from 'react';
import {
  FlatList,
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
import { Space, Task } from '../types';
import TaskCard, { nextStatus } from './TaskCard';
import VoiceModal from './VoiceModal';
import EditTaskModal from './EditTaskModal';
import InviteBanner from './InviteBanner';

interface Props {
  space: Space;
  emptyLabel: string;
}

export default function SpaceScreen({ space, emptyLabel }: Props) {
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

  const handleToggleStatus = async (task: Task) => {
    const status = nextStatus(task.status);
    // Mise à jour optimiste pour une UI réactive
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      await updateTaskStatus(task.id, status);
    } catch {
      loadTasks(); // rollback en cas d'échec
    }
  };

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
    <View style={styles.container}>
      <InviteBanner />
      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            onToggleStatus={handleToggleStatus}
            onEdit={setEditing}
            onDelete={handleDelete}
          />
        )}
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
  container: { flex: 1, backgroundColor: '#FDF2F4' },
  list: { padding: 16, paddingBottom: 96 },
  empty: { textAlign: 'center', color: '#95A5A6', marginTop: 48, paddingHorizontal: 24 },
  error: { color: '#C0392B', textAlign: 'center', padding: 8 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E0526E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
});
