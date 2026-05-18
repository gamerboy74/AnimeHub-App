import React, { useEffect, useState } from 'react';
import {
  View, Text, Switch, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS } from '../src/constants/theme';
import { userAPI } from '../src/lib/supabase';
import { useAuth } from '../src/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [prefs, setPrefs] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    userAPI.getPreferences(user.id).then(({ data }) => {
      setPrefs(data || { 
        auto_play_next: true, 
        quality_preference: 'auto', 
        theme_preference: 'dark', 
        notification_settings: { push: true, email: true, recommendations: true },
        privacy_settings: { profile_public: true, watch_history_public: false }
      });
      setLoading(false);
    });
  }, [user]);

  const updatePref = async (key: string, value: any) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    if (user) await userAPI.updatePreferences(user.id, updated);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Log out of Neon Katana?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const joinedDate = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'June 2023';

  if (!user) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>Please sign in to view settings.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.neon} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <BlurView intensity={20} style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.headerBackBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.neon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Profile Settings</Text>
      </BlurView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Identity Section */}
        <View style={styles.identitySection}>
          <View style={styles.avatarContainer}>
            <LinearGradient 
              colors={[COLORS.neon, COLORS.neonCyan, '#ff7346']} 
              start={{x:0, y:0}} end={{x:1, y:1}} 
              style={styles.avatarBorder}
            />
            <Image 
              source={{ uri: user.avatar_url || 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?q=80&w=200' }} 
              style={styles.avatar} 
            />
            <TouchableOpacity
              style={styles.editAvatarBtn}
              onPress={() => Alert.alert('Change Avatar', 'To update your avatar, paste a public image URL.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Use Gravatar', onPress: () => Alert.alert('Gravatar', `Your Gravatar for ${user.email} will be used automatically.`) },
              ])}
            >
              <Ionicons name="pencil" size={12} color={COLORS.bg} />
            </TouchableOpacity>
          </View>
          <View style={styles.identityInfo}>
            <Text style={styles.username}>{user.username}</Text>
            <View style={styles.identityBadges}>
              <View style={[styles.premiumBadge, user.subscription_type === 'premium' && { backgroundColor: 'rgba(255,214,0,0.1)', borderColor: 'rgba(255,214,0,0.3)' }]}>
                <Text style={[styles.premiumBadgeText, user.subscription_type === 'premium' && { color: COLORS.neonGold }]}>
                  {user.subscription_type === 'premium' ? 'PREMIUM MEMBER' : 'FREE PLAN'}
                </Text>
              </View>
              <Text style={styles.joinedText}>Joined {joinedDate}</Text>
            </View>
          </View>
        </View>

        {/* Subscription Bento Card */}
        <BlurView intensity={30} style={styles.bentoCard}>
          <View style={styles.bentoGlow} />
          <View style={styles.bentoHeader}>
            <View>
              <Text style={styles.bentoTitle}>Subscription</Text>
              {user.subscription_type === 'premium' ? (
                <Text style={styles.bentoSub}>You are on the <Text style={{color: COLORS.neonGold, fontWeight: '700'}}>Premium</Text> plan.</Text>
              ) : (
                <Text style={styles.bentoSub}>You are on the <Text style={{color: COLORS.textSub, fontWeight: '700'}}>Free</Text> plan. Upgrade for HD streaming, offline downloads, and more.</Text>
              )}
            </View>
            <Ionicons name="ribbon" size={28} color={user.subscription_type === 'premium' ? COLORS.neonGold : COLORS.textMuted} />
          </View>
          {user.subscription_type === 'premium' ? (
            <View style={styles.bentoStats}>
              <View style={styles.bentoStat}>
                <Text style={styles.statLabel}>Plan</Text>
                <Text style={styles.statValue}>Premium</Text>
              </View>
              <View style={styles.bentoStat}>
                <Text style={styles.statLabel}>Member Since</Text>
                <Text style={styles.statValue}>
                  {user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.freeFeatureList}>
              {['Unlimited Anime Access', 'HD Streaming', 'Offline Downloads', 'No Ads'].map(f => (
                <View key={f} style={styles.freeFeatureRow}>
                  <Ionicons name="lock-closed-outline" size={14} color={COLORS.textMuted} />
                  <Text style={styles.freeFeatureText}>{f}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.bentoActions}>
            {user.subscription_type === 'premium' ? (
              <TouchableOpacity style={styles.secondaryAction} onPress={() => Alert.alert('Manage Plan', 'Subscription management coming soon!')}>  
                <Text style={styles.secondaryActionText}>Manage Plan</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.primaryAction} onPress={() => Alert.alert('Upgrade to Premium', 'Premium plans coming soon! Stay tuned.')}>
                <LinearGradient
                  colors={[COLORS.neonGold, '#ff7346']}
                  start={{x:0, y:0}} end={{x:1, y:0}}
                  style={styles.actionGradient}
                >
                  <Text style={styles.primaryActionText}>⚡ Upgrade to Premium</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </BlurView>

        {/* Localization Card */}
        <BlurView intensity={30} style={styles.bentoCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="language" size={20} color={COLORS.neonCyan} />
            <Text style={styles.cardTitle}>Localization</Text>
          </View>
          <View style={styles.cardBody}>
            <ActionRow label="Display Language" value="English (US)" />
            <ActionRow label="Audio Preference" value="Japanese (Original)" />
            <ActionRow label="Content Region" value="North America" />
          </View>
        </BlurView>

        {/* Security Hub */}
        <BlurView intensity={30} style={styles.bentoCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="shield-checkmark" size={20} color="#ff7346" />
            <Text style={styles.cardTitle}>Security &amp; Login</Text>
          </View>
          <View style={styles.cardBody}>
            <ActionRow label="Change Password" sub="Updated 3 months ago" />
            <ActionRow label="Two-Factor Auth" value="Enabled" isValueHighlighted />
            <ActionRow label="Connected Devices" sub="3 active sessions" />
          </View>
        </BlurView>

        {/* Payment Methods */}
        <BlurView intensity={30} style={styles.bentoCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="card" size={20} color={COLORS.neon} />
            <Text style={styles.cardTitle}>Payment Methods</Text>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.paymentCard}>
              <View style={styles.visaBox}><Text style={styles.visaText}>VISA</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.cardNum} numberOfLines={1}>{'•••• 4242'}</Text>
                <Text style={styles.cardExpiry}>EXPIRES 12/26</Text>
              </View>
              <View style={styles.primaryPill}><Text style={styles.pillText}>PRIMARY</Text></View>
            </View>
            <TouchableOpacity style={styles.addPaymentBtn}>
              <Ionicons name="add-circle-outline" size={16} color={COLORS.textSub} />
              <Text style={styles.addPaymentText}>Add New Payment Method</Text>
            </TouchableOpacity>
          </View>
        </BlurView>

        {/* Preferences Module */}
        <BlurView intensity={30} style={styles.bentoCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="notifications" size={20} color={COLORS.neonCyan} />
            <Text style={styles.cardTitle}>Preferences</Text>
          </View>
          <View style={styles.preferenceGrid}>
            <PreferenceToggle 
              label="New Episode Alerts" 
              sub="Push & Email notifications" 
              value={prefs?.notification_settings?.push ?? true}
              onToggle={(v: boolean) => updatePref('notification_settings', { ...prefs?.notification_settings, push: v })}
            />
            <PreferenceToggle 
              label="Marketing Emails" 
              sub="Exclusive deals and news" 
              value={prefs?.notification_settings?.email ?? false}
              onToggle={(v: boolean) => updatePref('notification_settings', { ...prefs?.notification_settings, email: v })}
            />
            <PreferenceToggle 
              label="Auto-Next Play" 
              sub="Continuous viewing" 
              value={prefs?.auto_play_next ?? true}
              onToggle={(v: boolean) => updatePref('auto_play_next', v)}
            />
          </View>
        </BlurView>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={24} color={COLORS.danger} />
          <Text style={styles.signOutText}>SIGN OUT</Text>
        </TouchableOpacity>
        <Text style={styles.versionText}>APP VERSION 1.0.0-NEON</Text>
      </ScrollView>
    </View>
  );
}

function ActionRow({ label, value, sub, isValueHighlighted }: any) {
  return (
    <TouchableOpacity style={styles.actionRow}>
      <View style={styles.rowContent}>
        <Text style={styles.actionLabel}>{label}</Text>
        {sub && <Text style={styles.actionSubText}>{sub}</Text>}
        {value && <Text style={[styles.actionValue, isValueHighlighted && { color: COLORS.neonCyan, fontWeight: '700' }]}>{value}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
}

function PreferenceToggle({ label, sub, value, onToggle }: any) {
  return (
    <View style={styles.prefItem}>
      <View style={{ flex: 1 }}>
        <Text style={styles.prefLabel}>{label}</Text>
        <Text style={styles.prefSub}>{sub}</Text>
      </View>
      <Switch 
        value={value} 
        onValueChange={onToggle}
        trackColor={{ false: COLORS.border, true: COLORS.neon }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  errorText: { color: COLORS.textSub, fontSize: 16 },
  
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(189,157,255,0.1)',
  },
  headerBackBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.neon, letterSpacing: -0.5, flex: 1 },

  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },
  
  identitySection: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 40 },
  avatarContainer: { position: 'relative' },
  avatarBorder: { 
    position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, 
    borderRadius: 100, opacity: 0.6 
  },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: COLORS.bg },
  editAvatarBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.neon, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: COLORS.bg,
  },
  identityInfo: { flex: 1, minWidth: 0 },
  username: { fontSize: 26, fontWeight: '900', color: COLORS.text, letterSpacing: -1, marginBottom: 6 },
  identityBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  premiumBadge: {
    paddingHorizontal: 12, paddingVertical: 4,
    backgroundColor: 'rgba(191,95,255,0.1)',
    borderRadius: 100, borderWidth: 1, borderColor: 'rgba(191,95,255,0.2)',
    alignSelf: 'flex-start',
  },
  premiumBadgeText: { fontSize: 9, fontWeight: '800', color: COLORS.neon, letterSpacing: 2 },
  joinedText: { fontSize: 13, color: COLORS.textSub, marginTop: 4 },

  freeFeatureList: { gap: 10, marginBottom: 24 },
  freeFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  freeFeatureText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },

  bentoCard: {
    padding: 24, borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(25,25,29,0.4)',
    borderWidth: 1, borderColor: 'rgba(189,157,255,0.05)',
    marginBottom: 20,
  },
  bentoGlow: {
    position: 'absolute', top: -40, right: -40,
    width: 120, height: 120, backgroundColor: COLORS.neon,
    borderRadius: 60, opacity: 0.05,
  } as any,
  bentoHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  bentoTitle: { fontSize: 24, fontWeight: '900', color: COLORS.text, marginBottom: 4 },
  bentoSub: { fontSize: 13, color: COLORS.textSub, maxWidth: '80%' },
  
  bentoStats: { flexDirection: 'row', gap: 20, marginBottom: 24 },
  bentoStat: {
    flex: 1, padding: 16, backgroundColor: 'rgba(19,19,22,0.5)',
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.02)',
  },
  statLabel: { fontSize: 9, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: '700', color: COLORS.text },

  bentoActions: { flexDirection: 'column', gap: 10 },
  primaryAction: { borderRadius: 100, overflow: 'hidden' },
  actionGradient: { paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center' },
  primaryActionText: { color: '#000', fontWeight: '800', fontSize: 14 },
  secondaryAction: {
    paddingVertical: 14, alignItems: 'center',
    borderRadius: 100, borderWidth: 1, borderColor: 'rgba(189,157,255,0.15)',
  },
  secondaryActionText: { color: COLORS.text, fontWeight: '700', fontSize: 14 },

  gridRow: { flexDirection: 'row', gap: 20, marginBottom: 20 },
  localizationCard: { flex: 1, padding: 24, borderRadius: RADIUS.lg, backgroundColor: 'rgba(25,25,29,0.4)', borderWidth: 1, borderColor: 'rgba(189,157,255,0.05)' },
  halfCard: { flex: 1, padding: 20, borderRadius: 16, backgroundColor: 'rgba(25,25,29,0.4)', borderWidth: 1, borderColor: 'rgba(189,157,255,0.05)' },

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  cardBody: { gap: 16 },

  actionRow: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowContent: { flex: 1, gap: 2 },
  actionLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  actionSubText: { fontSize: 12, color: COLORS.textMuted },
  actionValue: { fontSize: 12, color: COLORS.textSub, fontWeight: '500' },

  paymentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, backgroundColor: 'rgba(25,25,29,0.5)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(189,157,255,0.1)',
  },
  visaBox: {
    width: 48, height: 32, backgroundColor: '#111', borderRadius: 6,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  visaText: { fontSize: 10, fontWeight: '900', color: COLORS.text, fontStyle: 'italic' },
  cardNum: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  cardExpiry: { fontSize: 8, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1 },
  primaryPill: { paddingHorizontal: 8, paddingVertical: 2, backgroundColor: 'rgba(191,95,255,0.2)', borderRadius: 100, alignSelf: 'center' },
  pillText: { fontSize: 8, fontWeight: '900', color: COLORS.neon },

  addPaymentBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: 'rgba(189,157,255,0.1)',
    borderRadius: 12, marginTop: 4,
  },
  addPaymentText: { fontSize: 12, fontWeight: '700', color: COLORS.textSub },

  preferenceGrid: { gap: 24, marginTop: 10 },
  prefItem: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  prefLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  prefSub: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    marginTop: 40, paddingVertical: 20,
  },
  signOutText: { fontSize: 14, fontWeight: '900', color: COLORS.danger, letterSpacing: 3 },
  versionText: { textAlign: 'center', fontSize: 10, color: COLORS.textMuted, opacity: 0.5, letterSpacing: 1.5, marginTop: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
});
