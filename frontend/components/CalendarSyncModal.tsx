/**
 * Abonnement calendrier : affiche l'URL ICS secrète de l'utilisateur à coller
 * dans Google/Apple/Outlook Agenda. Sens unique (app → agenda), mise à jour
 * automatique pilotée par le fournisseur. Le lien est régénérable pour révoquer
 * un ancien abonnement.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCalendarFeedUrl, rotateCalendarFeed } from '../lib/api';
import { confirmAction, notify } from '../lib/notify';
import { COLORS } from '../lib/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const STEPS = [
  {
    icon: 'logo-google' as const,
    title: 'Google Agenda',
    text: 'Autres agendas → « À partir de l’URL » → collez le lien.',
  },
  {
    icon: 'phone-portrait-outline' as const,
    title: 'iPhone / Apple',
    text: 'Réglages → Calendrier → Comptes → Ajouter un compte → Autre → Abonnement.',
  },
  {
    icon: 'mail-outline' as const,
    title: 'Outlook',
    text: 'Ajouter un calendrier → S’abonner à partir du Web → collez le lien.',
  },
];

export default function CalendarSyncModal({ visible, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setError(null);
    setLoading(true);
    getCalendarFeedUrl()
      .then((r) => !cancelled && setUrl(r.url))
      .catch(() => !cancelled && setError('Impossible de récupérer le lien.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const copy = async () => {
    if (!url) return;
    // Web : presse-papiers natif du navigateur. Natif : feuille de partage.
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(url);
        notify('Lien copié', 'Collez-le dans votre application Agenda.');
      } catch {
        notify('Lien à copier', url);
      }
    } else {
      try {
        await Share.share({ message: url });
      } catch {
        notify('Lien à copier', url);
      }
    }
  };

  const rotate = async () => {
    const ok = await confirmAction(
      'Régénérer le lien ?',
      "L'ancien lien cessera de fonctionner. Vous devrez ré-abonner vos agendas au nouveau lien.",
      'Régénérer'
    );
    if (!ok) return;
    setLoading(true);
    try {
      const r = await rotateCalendarFeed();
      setUrl(r.url);
      notify('Nouveau lien généré', 'Mettez à jour vos abonnements existants.');
    } catch {
      setError('La régénération a échoué.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>🔗 Synchroniser mon agenda</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color="#7F8C8D" />
            </TouchableOpacity>
          </View>

          <Text style={styles.intro}>
            Ajoutez ce lien dans votre application Agenda habituelle. Vos tâches CouplePlanner y
            apparaîtront et se mettront à jour automatiquement.
          </Text>

          {loading && !url ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
          ) : error && !url ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <>
              <View style={styles.urlBox}>
                <Text style={styles.url} selectable numberOfLines={2}>
                  {url}
                </Text>
              </View>

              <TouchableOpacity style={styles.primaryBtn} onPress={copy}>
                <Ionicons name="copy-outline" size={18} color="#fff" />
                <Text style={styles.primaryText}>
                  {Platform.OS === 'web' ? 'Copier le lien' : 'Partager / copier le lien'}
                </Text>
              </TouchableOpacity>

              <ScrollView style={styles.steps} contentContainerStyle={{ gap: 12 }}>
                {STEPS.map((s) => (
                  <View key={s.title} style={styles.step}>
                    <Ionicons name={s.icon} size={18} color={COLORS.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stepTitle}>{s.title}</Text>
                      <Text style={styles.stepText}>{s.text}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <Text style={styles.note}>
                Sens unique (lecture seule côté agenda). Le rafraîchissement dépend du fournisseur
                (souvent quelques heures ; jusqu’à 24 h sur Google).
              </Text>

              <TouchableOpacity style={styles.rotateBtn} onPress={rotate} disabled={loading}>
                <Ionicons name="refresh-outline" size={16} color="#C0392B" />
                <Text style={styles.rotateText}>Régénérer le lien</Text>
              </TouchableOpacity>
            </>
          )}
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
    gap: 10,
    maxHeight: '85%',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 19, fontWeight: '700', color: '#2C3E50' },
  intro: { fontSize: 13, color: '#7F8C8D', lineHeight: 18 },
  urlBox: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: 10,
    padding: 12,
  },
  url: { fontSize: 12, color: '#2C3E50', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 13,
  },
  primaryText: { color: '#fff', fontWeight: '600' },
  steps: { marginTop: 2 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepTitle: { fontSize: 13, fontWeight: '700', color: '#2C3E50' },
  stepText: { fontSize: 12, color: '#7F8C8D', lineHeight: 17 },
  note: { fontSize: 11, color: '#95A5A6', fontStyle: 'italic', lineHeight: 16 },
  error: { color: '#C0392B', marginVertical: 12, textAlign: 'center' },
  rotateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  rotateText: { color: '#C0392B', fontSize: 13, fontWeight: '600' },
});
