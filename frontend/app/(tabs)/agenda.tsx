/**
 * Agenda partagé (version simple) : vue mois + liste des événements du jour.
 * Fusionne mes tâches privées, les tâches communes, et les créneaux privés
 * du partenaire affichés « Occupé » (opacité garantie côté serveur).
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { getCalendar } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { CalendarEvent, Task } from '../../types';
import EditTaskModal from '../../components/EditTaskModal';
import CreateTaskModal from '../../components/CreateTaskModal';
import { COLORS as PALETTE } from '../../lib/theme';
import { SIDEBAR_WIDTH, useIsWideWeb } from '../../lib/responsive';

const CONFLICT_COLOR = '#C0392B';

/** Deux créneaux se chevauchent-ils dans le temps ? */
function overlaps(a: CalendarEvent, b: CalendarEvent): boolean {
  const aStart = new Date(a.start).getTime();
  const aEnd = new Date(a.end ?? a.start).getTime();
  const bStart = new Date(b.start).getTime();
  const bEnd = new Date(b.end ?? b.start).getTime();
  return aStart < bEnd && aEnd > bStart;
}

// Localisation française du calendrier
LocaleConfig.locales.fr = {
  monthNames: [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ],
  monthNamesShort: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  dayNames: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
  dayNamesShort: ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'],
  today: "Aujourd'hui",
};
LocaleConfig.defaultLocale = 'fr';

const COLORS: Record<CalendarEvent['visibility'], string> = {
  mine: PALETTE.primary,
  ours: '#27AE60',
  partner_busy: '#95A5A6',
};
const LABELS: Record<CalendarEvent['visibility'], string> = {
  mine: 'Mon Espace',
  ours: 'Notre Espace',
  partner_busy: 'Occupé',
};

/** Clé de jour locale 'YYYY-MM-DD' à partir d'une date ISO. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function todayKey(): string {
  return dayKey(new Date().toISOString());
}

export default function AgendaScreen() {
  const { user } = useAuth();
  const wideWeb = useIsWideWeb();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selected, setSelected] = useState<string>(todayKey());
  const [month, setMonth] = useState<string>(todayKey().slice(0, 7)); // 'YYYY-MM'
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState<string | null>(null); // jour cible du '+'

  const loadMonth = useCallback(async (ym: string) => {
    const [year, mon] = ym.split('-').map(Number);
    const from = new Date(year, mon - 1, 1, 0, 0, 0);
    const to = new Date(year, mon, 0, 23, 59, 59); // dernier jour du mois
    setLoading(true);
    try {
      const { events: data } = await getCalendar(from.toISOString(), to.toISOString());
      setEvents(data);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMonth(month);
    }, [loadMonth, month])
  );

  // Jours en conflit : une tâche commune chevauche un engagement privé du partenaire
  const conflictDays = useMemo(() => {
    const ours = events.filter((e) => e.visibility === 'ours');
    const busy = events.filter((e) => e.visibility === 'partner_busy');
    const days = new Set<string>();
    for (const o of ours) {
      for (const b of busy) {
        if (overlaps(o, b)) days.add(dayKey(o.start));
      }
    }
    return days;
  }, [events]);

  // Pastilles par jour (une par visibilité présente + rouge si conflit)
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    for (const e of events) {
      const key = dayKey(e.start);
      if (!marks[key]) marks[key] = { dots: [] };
      const color = COLORS[e.visibility];
      if (!marks[key].dots.some((d: any) => d.color === color)) {
        marks[key].dots.push({ color });
      }
    }
    for (const key of conflictDays) {
      if (!marks[key]) marks[key] = { dots: [] };
      marks[key].dots.push({ key: 'conflict', color: CONFLICT_COLOR });
    }
    marks[selected] = { ...(marks[selected] || {}), selected: true, selectedColor: PALETTE.primary };
    return marks;
  }, [events, selected, conflictDays]);

  const dayEvents = useMemo(
    () =>
      events
        .filter((e) => dayKey(e.start) === selected)
        .sort((a, b) => a.start.localeCompare(b.start)),
    [events, selected]
  );

  const openEdit = (e: CalendarEvent) => {
    if (e.visibility === 'partner_busy') return; // opaque, non éditable
    // Tâche assignée au partenaire : consultable mais non modifiable.
    if (e.assignedTo !== null && e.assignedTo !== user?.id) return;
    const task: Task = {
      id: e.id,
      title: e.title,
      description: e.description,
      status: e.status,
      startDatetime: e.start,
      endDatetime: e.end,
      isAllDay: e.isAllDay,
      assignedTo: e.assignedTo,
      assignee: null,
    };
    setEditing(task);
  };

  const timeLabel = (e: CalendarEvent) => {
    if (e.isAllDay) return 'Journée';
    return new Date(e.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.container, wideWeb && { paddingLeft: SIDEBAR_WIDTH }]}>
      <View style={[styles.content, Platform.OS === 'web' && styles.contentWeb]}>
      <Calendar
        current={`${month}-01`}
        firstDay={1} // la semaine commence le lundi
        markingType="multi-dot"
        markedDates={markedDates}
        onDayPress={(d) => setSelected(d.dateString)}
        onMonthChange={(d) => setMonth(d.dateString.slice(0, 7))}
        theme={{
          todayTextColor: PALETTE.primary,
          arrowColor: PALETTE.primary,
          selectedDayBackgroundColor: PALETTE.primary,
        }}
      />

      {/* Légende */}
      <View style={styles.legend}>
        {(['mine', 'ours', 'partner_busy'] as const).map((v) => (
          <View key={v} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS[v] }]} />
            <Text style={styles.legendText}>{LABELS[v]}</Text>
          </View>
        ))}
      </View>

      {loading && <ActivityIndicator color={PALETTE.primary} style={{ marginTop: 8 }} />}

      <ScrollView style={styles.dayList} contentContainerStyle={styles.dayListContent}>
        {conflictDays.has(selected) && (
          <View style={styles.conflictBanner}>
            <Ionicons name="warning-outline" size={18} color={CONFLICT_COLOR} />
            <Text style={styles.conflictText}>
              Conflit : une tâche commune chevauche un engagement privé.
            </Text>
          </View>
        )}
        {dayEvents.length === 0 && !loading && (
          <Text style={styles.empty}>Aucun événement ce jour-là.</Text>
        )}
        {dayEvents.map((e) => {
          // Non éditable si créneau opaque du partenaire, ou tâche assignée au partenaire.
          const editable =
            e.visibility !== 'partner_busy' &&
            (e.assignedTo === null || e.assignedTo === user?.id);
          return (
            <TouchableOpacity
              key={e.id}
              style={styles.eventRow}
              activeOpacity={editable ? 0.6 : 1}
              onPress={() => openEdit(e)}
            >
              <View style={[styles.eventBar, { backgroundColor: COLORS[e.visibility] }]} />
              <Text style={styles.eventTime}>{timeLabel(e)}</Text>
              <Text
                style={[styles.eventTitle, e.visibility === 'partner_busy' && styles.eventBusy]}
                numberOfLines={1}
              >
                {e.visibility === 'partner_busy' ? 'Occupé' : e.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      </View>

      {/* Bouton flottant : créer un événement sur le jour sélectionné */}
      <TouchableOpacity style={styles.fab} onPress={() => setCreating(selected)} activeOpacity={0.8}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      <EditTaskModal
        task={editing}
        onClose={() => setEditing(null)}
        onSaved={() => loadMonth(month)}
      />

      <CreateTaskModal
        day={creating}
        onClose={() => setCreating(null)}
        onCreated={() => loadMonth(month)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PALETTE.primaryLight },
  content: { flex: 1 },
  // Sur le web, on limite la largeur et on centre pour éviter un calendrier étiré.
  contentWeb: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingTop: 16 },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 10,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: '#7F8C8D' },
  dayList: { flex: 1 },
  dayListContent: { padding: 16, paddingTop: 4 },
  empty: { textAlign: 'center', color: '#95A5A6', marginTop: 32 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  eventBar: { width: 4, height: 32, borderRadius: 2 },
  eventTime: { fontSize: 13, fontWeight: '600', color: '#7F8C8D', width: 64 },
  eventTitle: { fontSize: 15, color: '#2C3E50', flex: 1 },
  eventBusy: { fontStyle: 'italic', color: '#95A5A6' },
  conflictBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDECEA',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  conflictText: { flex: 1, color: '#C0392B', fontSize: 13 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: PALETTE.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
});
