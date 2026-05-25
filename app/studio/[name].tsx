import React, { useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../src/constants/theme';
import { animeAPI, Anime } from '../../src/lib/supabase';
import AnimeCard from '../../src/components/ui/AnimeCard';

const STUDIO_COVERS: Record<string, string> = {
  'MAPPA': 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=600&auto=format&fit=crop',
  'Ufotable': 'https://images.unsplash.com/photo-1528164344705-47542687000d?q=80&w=600&auto=format&fit=crop',
  'Madhouse': 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop',
  'Wit Studio': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=600&auto=format&fit=crop',
  'Trigger': 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=600&auto=format&fit=crop',
  'Kyoto Animation': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=600&auto=format&fit=crop',
  'A-1 Pictures': 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop',
  'Studio Ghibli': 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=600&auto=format&fit=crop',
  'Bones': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop',
  'CloverWorks': 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?q=80&w=600&auto=format&fit=crop',
};

const STUDIO_COLORS: Record<string, string> = {
  'MAPPA': COLORS.neon ?? '#BF5FFF',
  'Ufotable': COLORS.neonCyan ?? '#00F5FF',
  'Madhouse': '#FFD600',
  'Wit Studio': COLORS.text ?? '#F0EEFF',
  'Trigger': COLORS.neonPink ?? '#FF2D78',
  'Kyoto Animation': '#FF8833',
  'A-1 Pictures': '#3388FF',
  'Studio Ghibli': '#22CC88',
  'Bones': COLORS.neonGold ?? '#FFD600',
  'CloverWorks': '#00D2C4',
};

export default function StudioBrowseScreen() {
  const { name } = useLocalSearchParams();
  const studioName = name as string;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const themeColor = STUDIO_COLORS[studioName] || COLORS.neon;
  const coverUrl = STUDIO_COVERS[studioName] || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop';

  const { data: anime = [], isLoading: loading } = useQuery({
    queryKey: ['anime', 'studio', studioName],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!studioName,
    queryFn: async (): Promise<Anime[]> => {
      const { data, error } = await animeAPI.getByStudio(studioName, 50);
      if (error) {
        Alert.alert('Error', `Could not load ${studioName} anime. Please try again.`);
        throw error;
      }
      return data || [];
    },
  });

  const handleCardPress = useCallback((id: string) => {
    router.push(`/anime/${id}`);
  }, [router]);

  const renderItem = useCallback(({ item }: { item: Anime }) => (
    <AnimeCard
      anime={item}
      size="sm"
      onPress={() => handleCardPress(item.id)}
    />
  ), [handleCardPress]);

  const keyExtractor = useCallback((item: Anime) => item.id, []);

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Banner Area */}
      <View style={styles.bannerContainer}>
        <Image
          source={{ uri: coverUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        <LinearGradient
          colors={['rgba(8,8,16,0.3)', 'rgba(8,8,16,0.95)']}
          style={StyleSheet.absoluteFill}
        />
        
        {/* Navigation / Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.titleWrap}>
            <Text style={styles.headerSub}>// STUDIO</Text>
            <Text style={[styles.headerTitle, { color: themeColor }]}>{studioName?.toUpperCase()}</Text>
          </View>
        </View>

        {/* Stats / Info Overlay */}
        <View style={styles.infoOverlay}>
          <BlurView intensity={25} tint="dark" style={styles.badgeBlur}>
            <Text style={[styles.badgeText, { color: themeColor }]}>
              {loading ? 'CALCULATING...' : `${anime.length} TITLES AVAILABLE`}
            </Text>
          </BlurView>
        </View>
      </View>

      {/* Grid List */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={themeColor} size="large" />
          <Text style={[styles.loadingText, { color: themeColor }]}>LOADING VAULT...</Text>
        </View>
      ) : anime.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="cube-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No anime listed under {studioName} in the registry.</Text>
        </View>
      ) : (
        <FlatList
          data={anime}
          keyExtractor={keyExtractor}
          numColumns={3}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 32 }]}
          columnWrapperStyle={styles.row}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  bannerContainer: {
    height: 180,
    width: '100%',
    position: 'relative',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(14,14,26,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  titleWrap: {
    flex: 1,
  },
  headerSub: {
    fontSize: 9,
    color: COLORS.textMuted ?? '#6B6888',
    letterSpacing: 2,
    fontWeight: '800',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  infoOverlay: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    alignItems: 'flex-start',
  },
  badgeBlur: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  grid: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
  },
  row: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  loadingText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
