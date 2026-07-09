/**
 * Bannière affichée tant que le partenaire n'a pas rejoint le couple.
 * Montre le code d'invitation et permet de le partager.
 */
import React from 'react';
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth-context';
import { notify } from '../lib/notify';
import { COLORS } from '../lib/theme';

export default function InviteBanner() {
  const { partner, inviteCode } = useAuth();

  // Rien à afficher si le partenaire a déjà rejoint (ou pas de code)
  if (partner || !inviteCode) return null;

  const shareCode = async () => {
    const message = `Rejoins-moi sur CouplePlanner ! Crée ton compte avec le code d'invitation : ${inviteCode}`;
    try {
      await Share.share({ message });
    } catch {
      // Web ou partage indisponible : on affiche simplement le code
      notify("Code d'invitation", message);
    }
  };

  return (
    <View style={styles.banner}>
      <Ionicons name="heart-outline" size={20} color={COLORS.primary} />
      <View style={styles.texts}>
        <Text style={styles.title}>Invitez votre partenaire</Text>
        <Text style={styles.subtitle}>Partagez ce code pour lier vos comptes :</Text>
        <Text style={styles.code}>{inviteCode}</Text>
      </View>
      <TouchableOpacity style={styles.shareBtn} onPress={shareCode}>
        <Ionicons name="share-outline" size={18} color="#fff" />
        <Text style={styles.shareText}>Partager</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 16,
  },
  texts: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: '#2C3E50' },
  subtitle: { fontSize: 12, color: '#7F8C8D' },
  code: { fontSize: 20, fontWeight: '700', letterSpacing: 3, color: COLORS.primary, marginTop: 2 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  shareText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
