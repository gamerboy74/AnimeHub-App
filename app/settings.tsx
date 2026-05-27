import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Switch, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../src/constants/theme';
import { userAPI, supabase } from '../src/lib/supabase';
import { styles } from '../src/screens/settings.styles';
import { useAuth } from '../src/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePaymentCards } from '../src/hooks/usePaymentCards';
import ChangePasswordModal from '../src/components/settings/ChangePasswordModal';
import AddPaymentCardModal from '../src/components/settings/AddPaymentCardModal';
import AvatarModal from '../src/components/settings/AvatarModal';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  // Fetch preferences via TanStack Query
  const { data: prefs, isLoading: loading } = useQuery({
    queryKey: ['user', user?.id, 'preferences'],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await userAPI.getPreferences(user.id);
      return data || { 
        auto_play_next: true, 
        auto_skip_intro: true,
        quality_preference: 'auto', 
        theme_preference: 'dark', 
        notification_settings: { push: true, email: true, recommendations: true },
        privacy_settings: { profile_public: true, watch_history_public: false },
        display_language: 'English (US)',
        audio_preference: 'Japanese (Original)',
        content_region: 'North America',
        two_factor_enabled: false,
      };
    },
    enabled: !!user?.id,
  });

  // Re-fetch user profile and invalidate preferences query every time this screen is focused.
  // Ensures subscription_type and preferences are current even if changed externally.
  useFocusEffect(useCallback(() => { 
    refreshUser(); 
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: ['user', user.id, 'preferences'] });
    }
  }, [refreshUser, user?.id, queryClient]));

  // Dynamic lists and modal states
  const { cards, isLoading: loadingCards, addCard, deleteCard, setPrimaryCard } = usePaymentCards(user?.id);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [cardModalVisible, setCardModalVisible] = useState(false);

  const handleEditAvatarPress = () => {
    setAvatarModalVisible(true);
  };



  const updatePref = async (key: string, value: any) => {
    if (!user) return;
    const current = queryClient.getQueryData<any>(['user', user.id, 'preferences']) || {};
    const updated = { ...current, [key]: value };
    
    // Optimistic update
    queryClient.setQueryData(['user', user.id, 'preferences'], updated);
    
    // DB save
    await userAPI.updatePreferences(user.id, updated);
    
    // Invalidate query to sync across other screens
    queryClient.invalidateQueries({ queryKey: ['user', user.id, 'preferences'] });
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
              contentFit="cover"
              transition={200}
            />
            <TouchableOpacity
              style={styles.editAvatarBtn}
              onPress={handleEditAvatarPress}
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
              <>
                <TouchableOpacity style={styles.primaryAction} onPress={() => router.push('/manage-plan' as any)}>
                  <LinearGradient
                    colors={[COLORS.neonGold, '#ff7346']}
                    start={{x:0, y:0}} end={{x:1, y:0}}
                    style={styles.actionGradient}
                  >
                    <Text style={styles.primaryActionText}>⚙️ Manage Plan</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/plans' as any)}>
                  <Text style={styles.secondaryActionText}>View All Plans</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.primaryAction} onPress={() => router.push('/premium' as any)}>
                  <LinearGradient
                    colors={[COLORS.neonGold, '#ff7346']}
                    start={{x:0, y:0}} end={{x:1, y:0}}
                    style={styles.actionGradient}
                  >
                    <Text style={styles.primaryActionText}>⚡ Upgrade to Premium</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/plans' as any)}>
                  <Text style={styles.secondaryActionText}>Compare Plans</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </BlurView>

        {/* Playback Card */}
        <BlurView intensity={30} style={styles.bentoCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="play-circle" size={20} color={COLORS.neonCyan} />
            <Text style={styles.cardTitle}>Playback</Text>
          </View>
          <View style={styles.cardBody}>
            {/* Auto-play next episode toggle */}
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Auto-play Next Episode</Text>
                <Text style={styles.toggleSub}>
                  Automatically starts the next episode when the current one ends (5 second countdown)
                </Text>
              </View>
              <Switch
                value={prefs?.auto_play_next !== false}
                onValueChange={(v) => updatePref('auto_play_next', v)}
                trackColor={{ false: COLORS.border, true: COLORS.neonCyan }}
                thumbColor={prefs?.auto_play_next !== false ? COLORS.bg : COLORS.textMuted}
                ios_backgroundColor={COLORS.border}
              />
            </View>
            {/* Auto-skip intro & outro toggle */}
            <View style={[styles.toggleRow, { marginTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)', paddingTop: 16 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Auto-skip Intro &amp; Outro</Text>
                <Text style={styles.toggleSub}>
                  Automatically skips opening/ending credits when a skip button is available in the player
                </Text>
              </View>
              <Switch
                value={prefs?.auto_skip_intro !== false}
                onValueChange={(v) => updatePref('auto_skip_intro', v)}
                trackColor={{ false: COLORS.border, true: COLORS.neonCyan }}
                thumbColor={prefs?.auto_skip_intro !== false ? COLORS.bg : COLORS.textMuted}
                ios_backgroundColor={COLORS.border}
              />
            </View>
          </View>
        </BlurView>

        {/* Localization Card */}
        <BlurView intensity={30} style={styles.bentoCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="language" size={20} color={COLORS.neonCyan} />
            <Text style={styles.cardTitle}>Localization</Text>
          </View>
          <View style={styles.cardBody}>
            <ActionRow 
              label="Display Language" 
              value={prefs?.display_language || 'English (US)'} 
              onPress={() => {
                Alert.alert('Display Language', 'Select display language:', [
                  { text: 'English (US)', onPress: () => updatePref('display_language', 'English (US)') },
                  { text: '日本語 (Japanese)', onPress: () => updatePref('display_language', '日本語 (Japanese)') },
                  { text: 'Español (Spanish)', onPress: () => updatePref('display_language', 'Español (Spanish)') },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }}
            />
            <ActionRow 
              label="Audio Preference" 
              value={prefs?.audio_preference || 'Japanese (Original)'} 
              onPress={() => {
                Alert.alert('Audio Preference', 'Select audio track:', [
                  { text: 'Japanese (Original)', onPress: () => updatePref('audio_preference', 'Japanese (Original)') },
                  { text: 'English Dub', onPress: () => updatePref('audio_preference', 'English Dub') },
                  { text: 'Spanish Dub', onPress: () => updatePref('audio_preference', 'Spanish Dub') },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }}
            />
            <ActionRow 
              label="Content Region" 
              value={prefs?.content_region || 'North America'} 
              onPress={() => {
                Alert.alert('Content Region', 'Select stream gateway region:', [
                  { text: 'North America', onPress: () => updatePref('content_region', 'North America') },
                  { text: 'Europe', onPress: () => updatePref('content_region', 'Europe') },
                  { text: 'Asia', onPress: () => updatePref('content_region', 'Asia') },
                  { text: 'Global', onPress: () => updatePref('content_region', 'Global') },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              }}
            />
          </View>
        </BlurView>

        {/* Security Hub */}
        <BlurView intensity={30} style={styles.bentoCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="shield-checkmark" size={20} color="#ff7346" />
            <Text style={styles.cardTitle}>Security &amp; Login</Text>
          </View>
          <View style={styles.cardBody}>
            <ActionRow 
              label="Change Password" 
              sub="Update account password securely" 
              onPress={() => setPasswordModalVisible(true)}
            />
            <ActionRow 
              label="Two-Factor Auth" 
              value={prefs?.two_factor_enabled ? 'Enabled' : 'Disabled'} 
              isValueHighlighted={prefs?.two_factor_enabled}
              onPress={() => {
                const current = prefs?.two_factor_enabled ?? false;
                Alert.alert('Two-Factor Auth', `${current ? 'Disable' : 'Enable'} 2FA protection?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: current ? 'Disable' : 'Enable', onPress: () => updatePref('two_factor_enabled', !current) }
                ]);
              }}
            />
            <ActionRow 
              label="Connected Devices" 
              sub="Log out other active sessions" 
              onPress={() => {
                Alert.alert('Log out all other sessions?', 'This signs out your account from all other apps, tablets, and devices.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Log Out Others', style: 'destructive', onPress: async () => {
                      const { error } = await supabase.auth.signOut({ scope: 'others' });
                      if (error) Alert.alert('Error', 'Failed to log out other devices.');
                      else Alert.alert('Success', 'Logged out all other active sessions.');
                    }
                  }
                ]);
              }}
            />
          </View>
        </BlurView>

        {/* Payment Methods */}
        <BlurView intensity={30} style={styles.bentoCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="card" size={20} color={COLORS.neon} />
            <Text style={styles.cardTitle}>Payment Methods</Text>
          </View>
          <View style={styles.cardBody}>
            {loadingCards ? (
              <ActivityIndicator size="small" color={COLORS.neon} style={{ marginVertical: 16 }} />
            ) : cards.length === 0 ? (
              <Text style={{ fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginVertical: 16 }}>
                No payment methods registered.
              </Text>
            ) : (
              cards.map(c => (
                <View key={c.id} style={styles.paymentCard}>
                  <View style={styles.visaBox}><Text style={styles.visaText}>{c.brand}</Text></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cardNum} numberOfLines={1}>{`•••• ${c.last4}`}</Text>
                    <Text style={styles.cardExpiry}>EXPIRES {c.expiry}</Text>
                  </View>
                  {c.primary ? (
                    <View style={styles.primaryPill}><Text style={styles.pillText}>PRIMARY</Text></View>
                  ) : (
                    <TouchableOpacity 
                      onPress={() => setPrimaryCard(c.id)}
                    >
                      <Text style={{ fontSize: 9, fontWeight: '700', color: COLORS.textMuted }}>SET PRIMARY</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    onPress={() => deleteCard(c.id)}
                    style={{ marginLeft: 10 }}
                  >
                    <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              ))
            )}
             <TouchableOpacity 
              style={styles.addPaymentBtn}
              onPress={() => setCardModalVisible(true)}
            >
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
          </View>
        </BlurView>

        {/* Edit Avatar Modal */}
        <AvatarModal
          visible={avatarModalVisible}
          onClose={() => setAvatarModalVisible(false)}
          user={user}
          refreshUser={refreshUser}
        />

        {/* Change Password Modal */}
        <ChangePasswordModal
          visible={passwordModalVisible}
          onClose={() => setPasswordModalVisible(false)}
        />

        {/* Add Payment Method Modal */}
        <AddPaymentCardModal
          visible={cardModalVisible}
          onClose={() => setCardModalVisible(false)}
          onAddCard={addCard}
        />

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={24} color={COLORS.danger} />
          <Text style={styles.signOutText}>SIGN OUT</Text>
        </TouchableOpacity>
        <Text style={styles.versionText}>APP VERSION 1.0.0-NEON</Text>
      </ScrollView>
    </View>
  );
}

function ActionRow({ label, value, sub, isValueHighlighted, onPress }: any) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress}>
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


