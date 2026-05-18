import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, SPACING, RADIUS } from '../../../src/constants/theme';
import { episodeAPI, Episode } from '../../../src/lib/supabase';
import { useAuth } from '../../../src/context/AuthContext';

export default function EpisodesListScreen() {
  const params = useLocalSearchParams();
  const animeId = typeof params.id === 'string' ? params.id : (Array.isArray(params.id) ? params.id[0] : '');
  const animeTitle = typeof params.animeTitle === 'string' ? params.animeTitle : '';
  
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'free' | 'premium'>('all');

  useEffect(() => {
    if (animeId) {
      setLoading(true);
      episodeAPI.getByAnime(animeId).then(({ data }) => {
        // Only show episodes that have a working stream URL
        setEpisodes((data || []).filter(ep => !!ep.video_url?.trim()));
        setLoading(false);
      });
    }
  }, [animeId]);

  const filtered = episodes.filter(ep =>
    filter === 'all' ? true : filter === 'free' ? !ep.is_premium : ep.is_premium
  );

  const handleEpPress = (ep: Episode) => {
    if (ep.is_premium && user?.subscription_type !== 'premium') {
      Alert.alert('Premium Content', 'Upgrade to premium to watch this episode.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upgrade', onPress: () => router.push('/profile') },
      ]);
      return;
    }
    router.push(`/watch/${ep.id}?animeTitle=${encodeURIComponent(animeTitle)}`);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerSub}>// EPISODES</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{animeTitle}</Text>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['all', 'free', 'premium'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.episodeCount}>{filtered.length} eps</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.neon} style={{ marginTop: SPACING.xl }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: ep }) => (
            <TouchableOpacity style={styles.epRow} onPress={() => handleEpPress(ep)}>
              <View style={styles.epLeft}>
                <View style={[styles.epNumBox, ep.is_premium && styles.epNumBoxPremium]}>
                  {ep.is_premium
                    ? <Ionicons name="star" size={14} color={COLORS.neonGold} />
                    : <Text style={styles.epNumText}>{ep.episode_number}</Text>
                  }
                </View>
              </View>
              <View style={styles.epMid}>
                <Text style={styles.epTitle} numberOfLines={1}>
                  {ep.title || `Episode ${ep.episode_number}`}
                </Text>
                <View style={styles.epMetaRow}>
                  {ep.duration && <Text style={styles.epMeta}>{Math.round(ep.duration / 60)}m</Text>}
                  {ep.air_date && <Text style={styles.epMeta}>• {ep.air_date}</Text>}
                  {ep.is_premium && <Text style={[styles.epMeta, { color: COLORS.neonGold }]}>• PREMIUM</Text>}
                </View>
              </View>
              {ep.is_premium && user?.subscription_type !== 'premium'
                ? <Ionicons name="lock-closed-outline" size={18} color={COLORS.neonGold} />
                : <Ionicons name="play-circle-outline" size={24} color={COLORS.neon} />
              }
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  headerContent: { flex: 1 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerSub: { fontSize: 10, color: COLORS.neon, letterSpacing: 2, fontWeight: '700' },
  headerTitle: { fontSize: 18, color: COLORS.text, fontWeight: '800' },
  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    paddingHorizontal: SPACING.md, marginBottom: SPACING.md,
  },
  filterChip: {
    paddingVertical: 6, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  filterChipActive: { borderColor: COLORS.neon, backgroundColor: 'rgba(191,95,255,0.15)' },
  filterText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '700', letterSpacing: 1 },
  filterTextActive: { color: COLORS.neon },
  episodeCount: { fontSize: 12, color: COLORS.textMuted, marginLeft: 'auto' },
  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  epRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.md,
  },
  epLeft: {},
  epNumBox: {
    width: 40, height: 40, borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(191,95,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  epNumBoxPremium: {
    backgroundColor: 'rgba(255,214,0,0.1)',
    borderColor: 'rgba(255,214,0,0.3)',
  },
  epNumText: { fontSize: 14, color: COLORS.neon, fontWeight: '700' },
  epMid: { flex: 1 },
  epTitle: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  epMetaRow: { flexDirection: 'row', gap: 4, marginTop: 3 },
  epMeta: { fontSize: 11, color: COLORS.textMuted },
  separator: { height: 1, backgroundColor: COLORS.border },
});
