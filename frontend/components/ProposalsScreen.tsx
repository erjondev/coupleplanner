/**
 * Onglet « Propositions » : les activités proposées au sein du couple.
 *  - Reçues : propositions du partenaire, à accepter ou refuser. Une fois
 *             acceptée, l'activité rejoint « Notre Espace » et l'agenda.
 *  - Envoyées : mes propositions en attente de validation, ou refusées (que je
 *               peux alors retirer).
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { acceptProposal, declineProposal, deleteTask, getProposals } from '../lib/api';
import { confirmAction, notify } from '../lib/notify';
import { COLORS } from '../lib/theme';
import { SIDEBAR_WIDTH, useIsWideWeb } from '../lib/responsive';
import { Task } from '../types';

/** Libellé de créneau, ou null si l'activité n'a pas de date. */
function formatWhen(task: Task): string | null {
  if (!task.startDatetime) return null;
  const start = new Date(task.startDatetime);
  const day = start.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  if (task.isAllDay) return `${day} · journée`;
  const time = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

export default function ProposalsScreen() {
  const wideWeb = useIsWideWeb();
  const [received, setReceived] = useState<Task[]>([]);
  const [sent, setSent] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { received: r, sent: s } = await getProposals();
      setReceived(r);
      setSent(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleAccept = async (task: Task) => {
    setBusyId(task.id);
    try {
      const result = await acceptProposal(task.id);
      await load();
      if (result.has_conflict) {
        notify('⚠️ Conflit d’agenda', result.message);
      } else {
        notify('✅ Proposition acceptée', `« ${task.title} » a rejoint votre agenda.`);
      }
    } catch (e) {
      notify('Erreur', e instanceof Error ? e.message : "Échec de l'acceptation");
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (task: Task) => {
    const ok = await confirmAction(
      'Refuser la proposition',
      `« ${task.title} » sera refusée.`,
      'Refuser'
    );
    if (!ok) return;
    setBusyId(task.id);
    try {
      await declineProposal(task.id);
      await load();
    } catch (e) {
      notify('Erreur', e instanceof Error ? e.message : 'Échec du refus');
    } finally {
      setBusyId(null);
    }
  };

  const handleDismiss = async (task: Task) => {
    setBusyId(task.id);
    try {
      await deleteTask(task.id);
      await load();
    } catch (e) {
      notify('Erreur', e instanceof Error ? e.message : 'Échec de la suppression');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[styles.container, wideWeb && { paddingLeft: SIDEBAR_WIDTH }]}>
      <ScrollView
        contentContainerStyle={[styles.content, Platform.OS === 'web' && styles.contentWeb]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        {error && <Text style={styles.error}>{error}</Text>}
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />}

        {!loading && (
          <>
            {/* --- Propositions reçues --- */}
            <Text style={styles.sectionTitle}>Reçues</Text>
            {received.length === 0 ? (
              <Text style={styles.empty}>Aucune proposition à valider.</Text>
            ) : (
              received.map((task) => {
                const when = formatWhen(task);
                return (
                  <View key={task.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{task.title}</Text>
                    <View style={styles.metaRow}>
                      {task.creator && <Text style={styles.meta}>💌 Proposé par {task.creator.name}</Text>}
                      {when && <Text style={styles.meta}>📅 {when}</Text>}
                    </View>
                    <View style={styles.actions}>
                      <Pressable
                        style={({ hovered }: any) => [
                          styles.btn,
                          styles.declineBtn,
                          hovered && styles.declineBtnHover,
                        ]}
                        onPress={() => handleDecline(task)}
                        disabled={busyId === task.id}
                      >
                        <Ionicons name="close" size={18} color="#C0392B" />
                        <Text style={[styles.btnText, { color: '#C0392B' }]}>Refuser</Text>
                      </Pressable>
                      <Pressable
                        style={({ hovered }: any) => [
                          styles.btn,
                          styles.acceptBtn,
                          hovered && styles.acceptBtnHover,
                        ]}
                        onPress={() => handleAccept(task)}
                        disabled={busyId === task.id}
                      >
                        {busyId === task.id ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <Ionicons name="checkmark" size={18} color="#fff" />
                            <Text style={[styles.btnText, { color: '#fff' }]}>Accepter</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}

            {/* --- Propositions envoyées --- */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Envoyées</Text>
            {sent.length === 0 ? (
              <Text style={styles.empty}>Aucune proposition en cours.</Text>
            ) : (
              sent.map((task) => {
                const when = formatWhen(task);
                const declined = task.proposalStatus === 'DECLINED';
                return (
                  <View key={task.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{task.title}</Text>
                    <View style={styles.metaRow}>
                      {when && <Text style={styles.meta}>📅 {when}</Text>}
                    </View>
                    <View style={styles.actions}>
                      <View style={[styles.badge, declined ? styles.badgeDeclined : styles.badgePending]}>
                        <Text style={[styles.badgeText, { color: declined ? '#C0392B' : '#F39C12' }]}>
                          {declined ? 'Refusée' : 'En attente'}
                        </Text>
                      </View>
                      {declined && (
                        <Pressable
                          style={({ hovered }: any) => [
                            styles.btn,
                            styles.declineBtn,
                            hovered && styles.declineBtnHover,
                          ]}
                          onPress={() => handleDismiss(task)}
                          disabled={busyId === task.id}
                        >
                          <Ionicons name="trash-outline" size={16} color="#C0392B" />
                          <Text style={[styles.btnText, { color: '#C0392B' }]}>Retirer</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryLight },
  content: { padding: 16, paddingBottom: 96 },
  contentWeb: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingTop: 24 },
  error: { color: '#C0392B', textAlign: 'center', padding: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#2C3E50', marginBottom: 10 },
  empty: { color: '#95A5A6', fontStyle: 'italic', marginBottom: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#2C3E50' },
  metaRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  meta: { fontSize: 12, color: '#7F8C8D' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    cursor: 'pointer',
  },
  btnText: { fontWeight: '600', fontSize: 13 },
  acceptBtn: { backgroundColor: '#27AE60', flex: 1 },
  acceptBtnHover: { opacity: 0.9 },
  declineBtn: { borderWidth: 1.5, borderColor: '#C0392B', backgroundColor: 'transparent' },
  declineBtnHover: { backgroundColor: '#C0392B14' },
  badge: { flex: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, alignSelf: 'flex-start' },
  badgePending: { backgroundColor: '#FEF5E7' },
  badgeDeclined: { backgroundColor: '#FDECEA' },
  badgeText: { fontSize: 12, fontWeight: '600' },
});
