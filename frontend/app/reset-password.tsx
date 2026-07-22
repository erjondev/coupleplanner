import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../lib/auth-context';
import { COLORS } from '../lib/theme';

/** Écran de réinitialisation : email + code reçu + nouveau mot de passe. */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const { resetPassword } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !code.trim() || !password) {
      setError('Email, code et nouveau mot de passe requis');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email.trim(), code.trim(), password);
      router.replace('/(tabs)/notre-espace');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Réinitialisation impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>🔒 Nouveau mot de passe</Text>
        <Text style={styles.subtitle}>
          Saisissez le code reçu par email et votre nouveau mot de passe.
        </Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="#999"
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />
        <TextInput
          style={[styles.input, styles.codeInput]}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="Code (ex : A1B2C3D4)"
          placeholderTextColor="#999"
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Nouveau mot de passe"
          placeholderTextColor="#999"
          secureTextEntry
          editable={!loading}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Réinitialiser</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/login')}>
          <Text style={styles.link}>← Retour à la connexion</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', backgroundColor: COLORS.primaryLight, padding: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    gap: 12,
  },
  logo: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  subtitle: { textAlign: 'center', color: '#888', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#2C3E50',
  },
  codeInput: { letterSpacing: 2, textAlign: 'center', fontWeight: '700' },
  button: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { color: '#C0392B', textAlign: 'center' },
  link: { textAlign: 'center', color: COLORS.primary, fontWeight: '600', marginTop: 4 },
});
