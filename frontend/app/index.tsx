import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../lib/auth-context';
import { COLORS } from '../lib/theme';

/** Point d'entrée : attend la restauration de session, puis redirige. */
export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: COLORS.primaryLight }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return user ? <Redirect href="/(tabs)/notre-espace" /> : <Redirect href="/login" />;
}
