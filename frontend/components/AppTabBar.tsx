/**
 * Barre de navigation adaptative :
 *  - mobile / web étroit : barre d'onglets native en bas (BottomTabBar).
 *  - web large            : barre latérale (sidebar) à gauche, avec logo,
 *                           navigation verticale et déconnexion.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
// Cette version d'Expo vendorise react-navigation ; BottomTabBar est réexporté ici.
import { BottomTabBar, BottomTabBarProps } from 'expo-router/js-tabs';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth-context';
import { COLORS } from '../lib/theme';
import { SIDEBAR_WIDTH, useIsWideWeb } from '../lib/responsive';

export default function AppTabBar(props: BottomTabBarProps) {
  const wide = useIsWideWeb();
  if (!wide) return <BottomTabBar {...props} />;
  return <Sidebar {...props} />;
}

function Sidebar({ state, descriptors, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <View style={styles.sidebar}>
      <Text style={styles.logo}>💑 CouplePlanner</Text>

      <View style={styles.nav}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name;
          const icon = options.tabBarIcon?.({
            focused,
            color: focused ? COLORS.primary : '#7F8C8D',
            size: 20,
          });

          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={({ hovered }: any) => [
                styles.item,
                hovered && styles.itemHover,
                focused && styles.itemActive,
              ]}
            >
              {icon}
              <Text style={[styles.itemLabel, focused && styles.itemLabelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={handleSignOut}
        style={({ hovered }: any) => [styles.signOut, hovered && styles.itemHover]}
      >
        <Text style={styles.signOutText}>⎋  Se déconnecter</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: COLORS.primaryBorder,
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  logo: { fontSize: 18, fontWeight: '700', color: COLORS.primary, paddingHorizontal: 10, marginBottom: 24 },
  nav: { flex: 1, gap: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  itemHover: { backgroundColor: COLORS.primaryLight },
  itemActive: { backgroundColor: COLORS.primaryLight },
  itemLabel: { fontSize: 15, color: '#2C3E50', fontWeight: '500' },
  itemLabelActive: { color: COLORS.primary, fontWeight: '700' },
  signOut: { paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10 },
  signOutText: { fontSize: 14, color: '#7F8C8D', fontWeight: '600' },
});
