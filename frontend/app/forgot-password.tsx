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
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth-context';
import { COLORS } from '../lib/theme';

/** Écran « Mot de passe oublié » : saisie de l'email pour recevoir un code. */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Email requis');
      return;
    }
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const message = await requestPasswordReset(email.trim());
      setInfo(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'envoi");
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
        <Text style={styles.logo}>🔑 Mot de passe oublié</Text>
        <Text style={styles.subtitle}>
          Entrez votre email : nous vous enverrons un code de réinitialisation.
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

        {error && <Text style={styles.error}>{error}</Text>}
        {info && <Text style={styles.info}>{info}</Text>}

        {info ? (
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push({ pathname: '/reset-password', params: { email: email.trim() } })}
          >
            <Text style={styles.buttonText}>J'ai reçu un code →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Envoyer le code</Text>
            )}
          </TouchableOpacity>
        )}

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
  button: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { color: '#C0392B', textAlign: 'center' },
  info: { color: '#27AE60', textAlign: 'center' },
  link: { textAlign: 'center', color: COLORS.primary, fontWeight: '600', marginTop: 4 },
});
