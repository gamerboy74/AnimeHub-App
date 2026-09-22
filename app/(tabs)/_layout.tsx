import React, { useCallback, useMemo } from 'react';
import { Tabs } from 'expo-router';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import UniversalHeader from '../../src/components/ui/UniversalHeader';
import { useTranslation } from '../../src/context/LocalizationContext';
import { haptic } from '../../src/lib/haptics';

export default function TabLayout() {
  const { t } = useTranslation();

  const screenOptions = useCallback(({ route }: any) => ({
    header: ({ options }: any) => (
      <UniversalHeader title={route.name !== 'index' ? (options.title as string) : undefined} />
    ),
    headerShown: true,
    tabBarStyle: { position: 'absolute' as const },
  }), []);

  const renderTabBar = useCallback((props: any) => <CustomTabBar {...props} />, []);

  return (
    <Tabs
      tabBar={renderTabBar}
      screenOptions={screenOptions}
    >
      <Tabs.Screen name="index" options={{ title: t('home') }} />
      <Tabs.Screen name="explore" options={{ title: t('exploreLabel') }} />
      <Tabs.Screen name="library" options={{ title: t('libraryLabel') }} />
      <Tabs.Screen name="profile" options={{ title: t('profileLabel') }} />
    </Tabs>
  );
}

const CustomTabBar = React.memo(function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  
  const TABS = useMemo(() => [
    { name: 'index', icon: 'home', iconOutline: 'home-outline', label: t('home') },
    { name: 'explore', icon: 'search', iconOutline: 'search-outline', label: t('exploreLabel') },
    { name: 'library', icon: 'bookmark', iconOutline: 'bookmark-outline', label: t('libraryLabel') },
    { name: 'profile', icon: 'person', iconOutline: 'person-outline', label: t('profileLabel') },
  ], [t]);

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
              onPress={() => {
                haptic.selection();
                navigation.navigate(tab.name);
              }}
              activeOpacity={0.7}
              accessible={true}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={`${tab.label} tab`}
            >
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                {focused && <View style={styles.iconGlow} />}
                <Ionicons
                  name={(focused ? tab.icon : tab.iconOutline) as any}
                  size={22}
                  color={focused ? COLORS.neon : COLORS.textMuted}
                />
                {focused && <View style={styles.activeIndicator} />}
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
});

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
    justifyContent: 'center',
    minHeight: 48,
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
    backgroundColor: 'rgba(255,43,60,0.25)',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -4,
    height: 3,
    width: 20,
    borderRadius: 2,
    backgroundColor: COLORS.neon,
    shadowColor: COLORS.neon,
    shadowOpacity: 0.8,
    shadowRadius: 4,
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
