import React from 'react';
import { Tabs } from 'expo-router';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import UniversalHeader from '../../src/components/ui/UniversalHeader';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        header: () => <UniversalHeader />,
        headerShown: true,
        tabBarStyle: { position: 'absolute' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  
  const TABS = [
    { name: 'index', icon: 'home', iconOutline: 'home-outline', label: 'Home' },
    { name: 'explore', icon: 'search', iconOutline: 'search-outline', label: 'Explore' },
    { name: 'library', icon: 'bookmark', iconOutline: 'bookmark-outline', label: 'Library' },
    { name: 'profile', icon: 'person', iconOutline: 'person-outline', label: 'Profile' },
  ];

  return (
    <View style={[styles.tabBarContainer, { paddingBottom: insets.bottom || SPACING.sm }]}>
      <View style={styles.glowLine} />
      <View style={styles.tabBarInner}>
        {TABS.map((tab, index) => {
          const focused = state.index === index;
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabButton}
              onPress={() => navigation.navigate(tab.name)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                {focused && <View style={styles.iconGlow} />}
                <Ionicons
                  name={(focused ? tab.icon : tab.iconOutline) as any}
                  size={22}
                  color={focused ? COLORS.neon : COLORS.textMuted}
                />
              </View>
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    backgroundColor: COLORS.bgCard,
    borderTopWidth: 0,
  },
  glowLine: {
    height: 1,
    backgroundColor: COLORS.neon,
    opacity: 0.3,
    shadowColor: COLORS.neon,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  tabBarInner: {
    flexDirection: 'row',
    paddingTop: SPACING.sm,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  iconWrap: {
    width: 44,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    position: 'relative',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(191,95,255,0.12)',
  },
  iconGlow: {
    position: 'absolute',
    width: 40,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.neon,
    opacity: 0.15,
  },
  tabLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: COLORS.neon,
    fontWeight: '700',
  },
});
