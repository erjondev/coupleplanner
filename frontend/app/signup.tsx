import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth-context';

/**
 * Inscription. Deux parcours :
 *  - Créer un nouveau couple (par défaut) → génère un code à partager.
 *  - Rejoindre le couple du partenaire via son code d'invitation.
 */
export default function SignupScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hasCode, setHasCode] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setError(null);
    if (!name.trim() || !email.trim() || !password) {
      setError('Nom, email et mot de passe sont requis.');
      return;
    }
    if (hasCode && !inviteCode.trim()) {
      setError("Saisissez le code d'invitation, ou décochez l'option.");
      return;
    }
    setLoading(true);
    try {
      await signUp({
        name: name.trim(),
        email: email.trim(),
        password,
        invite_code: hasCode ? inviteCode.trim() : undefined,
      });
      router.replace('/(tabs)/notre-espace');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Inscription impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.logo}>💑 Créer un compte</Text>
          <Text style={styles.subtitle}>
            {hasCode
              ? 'Rejoignez le couple de votre partenaire avec son code.'
              : 'Créez votre couple, puis invitez votre partenaire.'}
          </Text>

          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Votre prénom"
          />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Mot de passe (min. 6 caractères)"
            secureTextEntry
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>J’ai un code d’invitation</Text>
            <Switch value={hasCode} onValueChange={setHasCode} />
          </View>

          {hasCode && (
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={inviteCode}
              onChangeText={(t) => setInviteCode(t.toUpperCase())}
              placeholder="Code (ex : J5EK8K)"
              autoCapitalize="characters"
              autoCorrect={false}
            />
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {hasCode ? 'Rejoindre le couple' : 'Créer mon couple'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/login')}>
            <Text style={styles.link}>Déjà un compte ? Se connecter</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF2F4' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    gap: 12,
  },
  logo: { fontSize: 26, fontWeight: '700', textAlign: 'center' },
  subtitle: { textAlign: 'center', color: '#888', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  codeInput: { letterSpacing: 3, fontWeight: '700', textAlign: 'center' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: { fontSize: 15, color: '#2C3E50' },
  button: {
    backgroundColor: '#E0526E',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { color: '#C0392B', textAlign: 'center' },
  link: { textAlign: 'center', color: '#E0526E', fontWeight: '600', marginTop: 4 },
});
