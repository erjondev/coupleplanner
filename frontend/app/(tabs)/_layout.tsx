import { Redirect, Tabs, useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth-context';

/**
 * Navigation principale : les 3 espaces du couple.
 *  - Mon Espace   : mes tâches privées
 *  - Notre Espace : toutes les tâches communes
 *  - Son Espace   : tâches communes assignées au partenaire
 */
export default function TabsLayout() {
  const { user, partner, loading, signOut } = useAuth();
  const router = useRouter();

  // On attend la restauration de session avant de décider de rediriger
  if (loading) return null;
  if (!user) return <Redirect href="/login" />;

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#E0526E',
        headerStyle: { backgroundColor: '#FDF2F4' },
        headerTitleStyle: { fontWeight: '700' },
        headerRight: () => (
          <TouchableOpacity onPress={handleSignOut} style={{ marginRight: 16 }}>
            <Ionicons name="log-out-outline" size={24} color="#E0526E" />
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
