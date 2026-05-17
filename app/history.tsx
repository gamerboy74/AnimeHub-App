import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../src/constants/theme';
import { userAPI } from '../src/lib/supabase';
import { useAuth } from '../src/context/AuthContext';

export default function WatchHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    userAPI.getProgress(user.id).then(({ data }) => {
      setHistory(data || []);
      setLoading(false);
    });
  }, [user]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerSub}>// HISTORY</Text>
        </View>
      </View>

      {!user ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Sign in to see your watch history</Text>
        </View>
      ) : loading ? (
        <ActivityIndicator color={COLORS.neon} style={{ marginTop: SPACING.xl }} />
      ) : history.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="time-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No watch history yet</Text>
          <Text style={styles.emptySub}>Start watching anime to track your progress</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.progress_id || item.episode_id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const progress = item.episode_duration > 0
              ? Math.round((item.progress_seconds / (item.episode_duration * 60)) * 100)
              : item.progress_percentage || 0;
            return (
              <TouchableOpacity
                style={styles.histRow}
                onPress={() => router.push(`/anime/${item.anime_id}`)}
              >
                <Image
                  source={{ uri: item.poster_url || '' }}
                  style={styles.poster}
                  resizeMode="cover"
                />
                <View style={styles.histInfo}>
                  <Text style={styles.animeTitle} numberOfLines={1}>{item.anime_title}</Text>
                  <Text style={styles.epTitle} numberOfLines={1}>
                    EP {item.episode_number} — {item.episode_title || `Episode ${item.episode_number}`}
                  </Text>
                  <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
                  </View>
                  <Text style={styles.progressText}>
                    {item.is_completed ? '✓ Completed' : `${progress}% watched`}
                  </Text>
                  <Text style={styles.watchedAt}>
                    {new Date(item.last_watched).toLocaleDateString()}
                  </Text>
                </View>
                {item.is_completed ? (
                  <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
                ) : (
                  <Ionicons name="play-circle-outline" size={22} color={COLORS.neon} />
                )}
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  headerSub: { fontSize: 10, color: COLORS.neon, letterSpacing: 2, fontWeight: '700' },
  headerTitle: { fontSize: 18, color: COLORS.text, fontWeight: '800' },
  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md },
  poster: { width: 60, height: 85, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgCard },
  histInfo: { flex: 1, gap: 3 },
  animeTitle: { fontSize: 14, color: COLORS.text, fontWeight: '700' },
  epTitle: { fontSize: 12, color: COLORS.textSub },
  progressBg: { height: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 4 },
  progressFill: { height: 3, backgroundColor: COLORS.neon, borderRadius: 2 },
  progressText: { fontSize: 11, color: COLORS.neon, marginTop: 2, fontWeight: '600' },
  watchedAt: { fontSize: 10, color: COLORS.textMuted },
  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  emptyText: { fontSize: 13, color: COLORS.textSub, fontWeight: '600' },
  emptySub: { fontSize: 12, color: COLORS.textMuted },
});
