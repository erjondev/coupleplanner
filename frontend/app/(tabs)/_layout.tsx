import { Redirect, Tabs, useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth-context';
import { COLORS } from '../../lib/theme';
import { useIsWideWeb } from '../../lib/responsive';
import AppTabBar from '../../components/AppTabBar';

/**
 * Navigation principale : les 3 espaces du couple + l'agenda.
 *  - Mobile / web étroit : onglets en bas + en-tête avec déconnexion.
 *  - Web large           : barre latérale (sidebar), en-tête masqué.
 */
export default function TabsLayout() {
  const { user, partner, loading, signOut } = useAuth();
  const router = useRouter();
  const wideWeb = useIsWideWeb();

  // On attend la restauration de session avant de décider de rediriger
  if (loading) return null;
  if (!user) return <Redirect href="/login" />;

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        // Sur web large, la déconnexion et le titre passent dans la sidebar.
        headerShown: !wideWeb,
        tabBarActiveTintColor: COLORS.primary,
        headerStyle: { backgroundColor: COLORS.primaryLight },
        headerTitleStyle: { fontWeight: '700' },
        headerRight: () => (
          <TouchableOpacity onPress={handleSignOut} style={{ marginRight: 16 }}>
            <Ionicons name="log-out-outline" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="mon-espace"
        options={{
          title: 'Mon Espace',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notre-espace"
        options={{
          title: 'Notre Espace',
          tabBarIcon: ({ color, size }) => <Ionicons name="heart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="son-espace"
        options={{
          title: partner ? `Espace de ${partner.name}` : 'Son Espace',
          tabBarLabel: 'Son Espace',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="propositions"
        options={{
          title: 'Propositions',
          tabBarIcon: ({ color, size }) => <Ionicons name="gift" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
