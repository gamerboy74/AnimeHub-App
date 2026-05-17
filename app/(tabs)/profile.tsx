import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { userAPI } from '../../src/lib/supabase';

const BADGES = [
  { id: '1', name: 'ELITE', icon: 'star', color: COLORS.neon, earned: true },
  { id: '2', name: 'GUARDIAN', icon: 'shield', color: COLORS.neonCyan, earned: true },
  { id: '3', name: 'VETERAN', icon: 'medal', color: '#ff7346', earned: true },
  { id: '4', name: 'LEGEND', icon: 'diamond', color: COLORS.textMuted, earned: false },
  { id: '5', name: 'WARRIOR', icon: 'flash', color: COLORS.textMuted, earned: false },
  { id: '6', name: 'MYSTIC', icon: 'color-wand', color: COLORS.neonPulse, earned: true },
];

const GENRE_PROGRESS = [
  { name: 'Cyberpunk', percent: 82, color: COLORS.neonCyan },
  { name: 'Seinen', percent: 65, color: COLORS.neon },
  { name: 'Psychological', percent: 48, color: '#ff7346' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setLoading(true);
      Promise.all([
        userAPI.getProgress(user.id),
        userAPI.getWatchlist(user.id),
        userAPI.getFavorites(user.id),
      ]).then(([progressRes, watchlistRes, favoritesRes]) => {
        setRecentActivity(progressRes.data?.slice(0, 3) || []);
        // Watchlist data structure is { anime: { ... } }
        setWatchlist(watchlistRes.data?.map(item => item.anime) || []);
        setFavorites(favoritesRes.data?.map(item => item.anime) || []);
        setLoading(false);
      });
    }
  }, [user]);

  if (!user) {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={styles.guestIcon}>
          <Ionicons name="person-outline" size={40} color={COLORS.neon} />
        </View>
        <Text style={styles.guestTitle}>NOT SIGNED IN</Text>
        <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/auth/login')}>
          <Text style={styles.signInText}>SIGN IN</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Log out of Neon Katana?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 120, paddingTop: insets.top + 16 }}
    >


      {/* Hero Profile Section */}
      <View style={styles.heroSection}>
        <View style={styles.avatarGlowContainer}>
          <View style={styles.avatarGlow} />
          <Image 
            source={{ uri: user.avatar_url || 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?q=80&w=200&auto=format&fit=crop' }} 
            style={styles.heroAvatar} 
          />
        </View>
        
        <View style={styles.heroInfo}>
          <Text style={styles.heroName} numberOfLines={1}>{user.username}</Text>
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumBadgeText}>PREMIUM MEMBER</Text>
          </View>
          <Text style={styles.heroBio}>
            Streaming the future of visual storytelling. Night owl, Sakuga enthusiast, and OST collector.
          </Text>
          
          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.editBtn} onPress={() => Alert.alert('Edit Profile', 'Profile editing coming soon!')}>
              <LinearGradient 
                colors={[COLORS.neon, COLORS.accent]} 
                start={{x:0, y:0}} end={{x:1, y:1}} 
                style={styles.gradientBtn}
              >
                <Text style={styles.editBtnText}>Edit Profile</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/settings')}>
              <Text style={styles.secondaryBtnText}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => Alert.alert('Achievements', 'Achievement system coming soon!')}>
              <Text style={styles.secondaryBtnText}>Achievements</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Bento Stats Grid */}
      <View style={styles.section}>
        <View style={styles.statsGrid}>
          <StatTile value={formatWatchTime(user.total_watch_time)} label="HOURS WATCHED" color={COLORS.neon} />
          <StatTile value={String(user.anime_watched || 0)} label="COMPLETED SERIES" color={COLORS.neonCyan} />
          <StatTile value="4.8k" label="FOLLOWERS" color="#ff7346" />
          <StatTile value="14" label="DAY STREAK" color={COLORS.neonPulse} isStreak />
        </View>
      </View>

      {/* Current Streak Card */}
      <View style={styles.section}>
        <BlurView intensity={20} style={styles.streakCard}>
          <View style={styles.streakHeader}>
            <View>
              <Text style={styles.streakTitle}>Current Streak</Text>
              <Text style={styles.streakSub}>Watch 1 more episode today to keep the streak!</Text>
            </View>
            <Ionicons name="flash" size={24} color={COLORS.neonCyan} />
          </View>
          <View style={styles.streakProgressContainer}>
            <View style={styles.streakProgressLabels}>
              <Text style={styles.progressLabel}>PROGRESS</Text>
              <Text style={[styles.progressLabel, { color: COLORS.text }]}>14/30 DAYS</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '46%', backgroundColor: COLORS.neonCyan }]} />
            </View>
            <View style={styles.streakLevels}>
              <Text style={styles.levelLabel}>Level 4: Shinobi</Text>
              <Text style={styles.levelLabel}>Level 5: Ronin</Text>
            </View>
          </View>
        </BlurView>
      </View>

      {/* Watchlist Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Watchlist</Text>
          <TouchableOpacity onPress={() => router.push('/watchlist')}>
            <Text style={styles.seeAllText}>VIEW ALL</Text>
          </TouchableOpacity>
        </View>
        {watchlist.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {watchlist.map(anime => (
              <TouchableOpacity key={anime.id} style={styles.animePosterCard} onPress={() => router.push(`/anime/${anime.id}`)}>
                <Image source={{ uri: anime.poster_url }} style={styles.animePoster} />
                <BlurView intensity={30} style={styles.posterOverlay}>
                  <Text style={styles.posterTitle} numberOfLines={1}>{anime.title}</Text>
                  <View style={styles.posterRating}>
                    <Ionicons name="star" size={10} color={COLORS.neonGold} />
                    <Text style={styles.posterRatingText}>{anime.rating || 'N/A'}</Text>
                  </View>
                </BlurView>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <BlurView intensity={10} style={styles.emptyCard}>
            <Ionicons name="list" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Your watchlist is empty</Text>
          </BlurView>
        )}
      </View>

      {/* Favorites Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top Favorites</Text>
          <TouchableOpacity onPress={() => router.push('/favorites')}>
            <Text style={styles.seeAllText}>VIEW ALL</Text>
          </TouchableOpacity>
        </View>
        {favorites.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {favorites.map(anime => (
              <TouchableOpacity key={anime.id} style={styles.animePosterCard} onPress={() => router.push(`/anime/${anime.id}`)}>
                <Image source={{ uri: anime.poster_url }} style={styles.animePoster} />
                <BlurView intensity={30} style={styles.posterOverlay}>
                  <Text style={styles.posterTitle} numberOfLines={1}>{anime.title}</Text>
                </BlurView>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <BlurView intensity={10} style={styles.emptyCard}>
            <Ionicons name="heart-outline" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No favorites yet</Text>
          </BlurView>
        )}
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity><Text style={styles.seeAllText}>VIEW ALL</Text></TouchableOpacity>
        </View>
        <View style={styles.activityList}>
          {recentActivity.map((activity, idx) => (
            <ActivityItem 
              key={activity.id || idx} 
              poster={activity.anime_poster_url} 
              title={activity.anime_title} 
              episode={activity.episode_number}
              progress={activity.progress_percent || 15}
              time="2h ago"
            />
          ))}
          {/* Mock Badge Earned Item */}
          <View style={styles.activityItemBadge}>
            <View style={styles.badgeActivityIcon}>
              <Ionicons name="ribbon-outline" size={24} color="#ff7346" />
            </View>
            <View style={styles.activityInfo}>
              <View style={styles.activityHeader}>
                <Text style={styles.activityTitle}>Badge Earned: "Sakuga Master"</Text>
                <Text style={styles.activityTime}>Yesterday</Text>
              </View>
              <Text style={styles.activitySub}>Completed 50+ series in the <Text style={{color: COLORS.text}}>Action</Text> genre.</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.gridContainer}>
        {/* Badges Wall */}
        <View style={styles.badgeSection}>
          <Text style={styles.gridSectionTitle}>Earned Badges</Text>
          <View style={styles.badgeGrid}>
            {BADGES.map(badge => (
              <View key={badge.id} style={styles.badgeItem}>
                <View style={[styles.badgeIconBox, !badge.earned && styles.lockedBadge]}>
                  <Ionicons name={badge.icon as any} size={20} color={badge.earned ? badge.color : COLORS.textMuted} />
                </View>
                <Text style={styles.badgeName}>{badge.name}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Top Genres */}
        <View style={styles.genreSection}>
          <Text style={styles.gridSectionTitle}>Top Genres</Text>
          <View style={styles.genreList}>
            {GENRE_PROGRESS.map(g => (
              <View key={g.name} style={styles.genreItem}>
                <View style={styles.genreLabelRow}>
                  <Text style={styles.genreNameLabel}>{g.name}</Text>
                  <Text style={styles.genreValue}>{g.percent}%</Text>
                </View>
                <View style={styles.genreBarBg}>
                  <View style={[styles.genreBarFill, { width: `${g.percent}%`, backgroundColor: g.color }]} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Friends Online */}
      <View style={styles.section}>
        <Text style={styles.gridSectionTitle}>Friends Online</Text>
        <View style={styles.friendsContainer}>
          <View style={styles.friendStack}>
            <Image source={{ uri: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=50' }} style={styles.friendAvatar} />
            <Image source={{ uri: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=50' }} style={[styles.friendAvatar, { marginLeft: -12 }]} />
            <Image source={{ uri: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=50' }} style={[styles.friendAvatar, { marginLeft: -12 }]} />
            <View style={[styles.friendAvatar, styles.friendPlus, { marginLeft: -12 }]}>
              <Text style={styles.friendPlusText}>+12</Text>
            </View>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
        <Text style={styles.signOutText}>SIGN OUT</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function StatTile({ value, label, color, isStreak }: any) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statValueRow}>
        {isStreak && <Ionicons name="flash" size={18} color={color} style={{ marginRight: 4 }} />}
        <Text style={[styles.statTileValue, { color }]}>{value}</Text>
      </View>
      <Text style={styles.statTileLabel}>{label}</Text>
    </View>
  );
}

function ActivityItem({ poster, title, episode, progress, time }: any) {
  return (
    <View style={styles.activityItem}>
      <Image source={{ uri: poster || 'https://via.placeholder.com/100x150' }} style={styles.activityPoster} />
      <View style={styles.activityInfo}>
        <View style={styles.activityHeader}>
          <Text style={styles.activityTitle}>{title}</Text>
          <Text style={styles.activityTime}>{time}</Text>
        </View>
        <Text style={styles.activitySub}>Started watching <Text style={{color: COLORS.text}}>Episode {episode}</Text></Text>
        <View style={styles.activityProgressContainer}>
          <View style={styles.activityProgressLine}>
            <View style={[styles.activityProgressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.activityProgressText}>{progress}%</Text>
        </View>
      </View>
    </View>
  );
}

function formatWatchTime(seconds: number = 0) {
  const hours = Math.floor(seconds / 3600);
  return hours.toLocaleString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },

  heroSection: {
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  avatarGlowContainer: {
    position: 'relative',
    marginBottom: SPACING.lg,
  },
  avatarGlow: {
    position: 'absolute',
    top: -10, left: -10, right: -10, bottom: -10,
    borderRadius: 100,
    backgroundColor: COLORS.neon,
    opacity: 0.15,
    transform: [{ scale: 1.1 }],
  },
  heroAvatar: {
    width: 130, height: 130,
    borderRadius: 65,
    borderWidth: 3, borderColor: COLORS.neon,
  },
  heroInfo: { alignItems: 'center', width: '100%' },
  heroName: { fontSize: 28, fontWeight: '900', color: COLORS.text, letterSpacing: -1, marginBottom: 6 },
  premiumBadge: {
    paddingHorizontal: 12, paddingVertical: 4,
    backgroundColor: 'rgba(0,227,253,0.1)',
    borderRadius: 100,
    borderWidth: 1, borderColor: 'rgba(0,227,253,0.3)',
    marginBottom: 10,
  },
  premiumBadgeText: { fontSize: 8, fontWeight: '800', color: COLORS.neonCyan, letterSpacing: 2 },
  heroBio: { color: COLORS.textSub, textAlign: 'center', fontSize: 13, lineHeight: 20, paddingHorizontal: SPACING.xl, marginBottom: SPACING.lg },
  
  heroActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 },
  editBtn: { borderRadius: 100, overflow: 'hidden' },
  gradientBtn: { paddingHorizontal: 24, paddingVertical: 12 },
  editBtnText: { color: '#000', fontWeight: '800', fontSize: 13 },
  secondaryBtn: {
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 100,
    borderWidth: 1, borderColor: 'rgba(189,157,255,0.2)',
  },
  secondaryBtnText: { color: COLORS.text, fontWeight: '700', fontSize: 13 },

  section: { paddingHorizontal: SPACING.md, marginBottom: SPACING.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: SPACING.md },
  sectionTitle: { fontSize: 20, color: COLORS.text, fontWeight: '900', letterSpacing: -0.5 },
  seeAllText: { fontSize: 10, color: COLORS.neonCyan, fontWeight: '800', letterSpacing: 1 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statTile: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: COLORS.bgElevated,
    padding: 20, borderRadius: RADIUS.lg,
    alignItems: 'center', gap: 6,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'center' },
  statTileValue: { fontSize: 28, fontWeight: '900', fontStyle: 'italic' },
  statTileLabel: { fontSize: 9, color: COLORS.textSub, fontWeight: '800', letterSpacing: 1.5 },

  streakCard: {
    padding: 24, borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(25,25,29,0.4)',
    overflow: 'hidden',
  },
  streakHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  streakTitle: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  streakSub: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  streakProgressContainer: { gap: 12 },
  streakProgressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 9, fontWeight: '800', color: COLORS.neonCyan, letterSpacing: 1 },
  progressBarBg: { height: 10, backgroundColor: COLORS.bgCard, borderRadius: 10 },
  progressBarFill: { height: '100%', borderRadius: 10 },
  streakLevels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  levelLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: '600' },

  activityList: { gap: 12 },
  activityItem: {
    flexDirection: 'row', gap: 16, padding: 12,
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg,
  },
  activityPoster: { width: 50, height: 75, borderRadius: 8 },
  activityInfo: { flex: 1, gap: 4 },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  activityTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text, flex: 1 },
  activityTime: { fontSize: 9, color: COLORS.textMuted, textTransform: 'uppercase', flexShrink: 0 },
  activitySub: { fontSize: 13, color: COLORS.textSub },
  activityProgressContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  activityProgressLine: { flex: 1, height: 3, backgroundColor: COLORS.bgCard, borderRadius: 2 },
  activityProgressFill: { height: '100%', backgroundColor: COLORS.neon, borderRadius: 2 },
  activityProgressText: { fontSize: 9, fontWeight: '800', color: COLORS.neon },

  activityItemBadge: {
    flexDirection: 'row', gap: 16, padding: 12,
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg, alignItems: 'center',
  },
  badgeActivityIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,115,70,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,115,70,0.2)',
  },

  gridContainer: { paddingHorizontal: SPACING.md, flexDirection: 'column', gap: SPACING.lg, marginBottom: SPACING.xl },
  gridSectionTitle: { fontSize: 18, fontWeight: '900', color: COLORS.text, marginBottom: 16 },
  badgeSection: { 
    padding: 20, backgroundColor: COLORS.bgElevated, 
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: 'rgba(72,71,75,0.1)' 
  },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, justifyContent: 'space-between' },
  badgeItem: { alignItems: 'center', gap: 6, width: '28%' },
  badgeIconBox: {
    width: 44, height: 44, backgroundColor: 'rgba(191,95,255,0.1)',
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(191,95,255,0.2)',
  },
  lockedBadge: { opacity: 0.3, backgroundColor: 'rgba(0,0,0,0.2)', borderColor: 'transparent' },
  badgeName: { fontSize: 8, fontWeight: '800', color: COLORS.textSub, letterSpacing: 1 },

  genreSection: { 
    padding: 20, backgroundColor: COLORS.bgElevated, 
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: 'rgba(72,71,75,0.1)' 
  },
  genreList: { gap: 15 },
  genreItem: { gap: 8 },
  genreLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  genreNameLabel: { fontSize: 10, fontWeight: '800', color: COLORS.text, textTransform: 'uppercase' },
  genreValue: { fontSize: 10, fontWeight: '800', color: COLORS.textSub },
  genreBarBg: { height: 4, backgroundColor: COLORS.bgCard, borderRadius: 2 },
  genreBarFill: { height: '100%', borderRadius: 2 },

  friendsContainer: {
    padding: 16, backgroundColor: COLORS.bgElevated, 
    borderRadius: RADIUS.lg, borderLeftWidth: 4, borderLeftColor: COLORS.neonCyan,
  },
  friendStack: { flexDirection: 'row' },
  friendAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: COLORS.bgElevated },
  friendPlus: { backgroundColor: '#25252A', alignItems: 'center', justifyContent: 'center' },
  friendPlusText: { fontSize: 9, fontWeight: '800', color: COLORS.textSub },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginHorizontal: SPACING.md, marginTop: 8, paddingVertical: 16,
    borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255,45,120,0.25)',
    backgroundColor: 'rgba(255,45,120,0.05)',
  },
  signOutText: { color: COLORS.danger, fontWeight: '900', fontSize: 13, letterSpacing: 2 },

  guestIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(191,95,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  guestTitle: { color: COLORS.text, fontWeight: '900', letterSpacing: 2, marginTop: 10 },
  signInBtn: { paddingHorizontal: 32, paddingVertical: 12, backgroundColor: COLORS.neon, borderRadius: 100, marginTop: 20 },
  signInText: { color: COLORS.bg, fontWeight: '900' },

  horizontalList: { gap: 16, paddingRight: SPACING.md },
  animePosterCard: {
    width: 130, height: 180,
    borderRadius: RADIUS.md, overflow: 'hidden',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1, borderColor: 'rgba(189,157,255,0.1)',
  },
  animePoster: { width: '100%', height: '100%' },
  posterOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 8, gap: 2,
  },
  posterTitle: { fontSize: 11, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2 },
  posterRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  posterRatingText: { fontSize: 9, fontWeight: '800', color: COLORS.neonGold },

  emptyCard: {
    padding: 30, borderRadius: RADIUS.md, alignItems: 'center', gap: 10,
    borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(189,157,255,0.1)',
  },
  emptyText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
});
