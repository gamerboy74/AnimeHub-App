import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Switch, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import { COLORS } from '../src/constants/theme';
import { userAPI, supabase } from '../src/lib/supabase';
import { styles } from '../src/screens/settings.styles';
import { useAuth } from '../src/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ChangePasswordModal from '../src/components/settings/ChangePasswordModal';
import AvatarModal from '../src/components/settings/AvatarModal';
import EditProfileModal from '../src/components/settings/EditProfileModal';
import TwoFactorModal from '../src/components/settings/TwoFactorModal';
import Disable2FAModal from '../src/components/settings/Disable2FAModal';
import LogOutOthersModal from '../src/components/settings/LogOutOthersModal';
import { useTranslation } from '../src/context/LocalizationContext';
import PickerBottomSheet, { PickerOption } from '../src/components/settings/PickerBottomSheet';
import { usePlans, formatPrice } from '../src/hooks/usePlans';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const { t, locale } = useTranslation();

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
        download_quality: '1080p',
        wifi_only_streaming: false,
        wifi_only_downloads: true,
        theme_preference: 'dark',
        notification_settings: { push: true, email: true, recommendations: true },
        privacy_settings: { profile_public: true, watch_history_public: false },
        preferred_language: 'en',
        audio_preference: 'Japanese (Original)',
        two_factor_enabled: false,
      };
    },
    enabled: !!user?.id,
  });

  // Re-fetch user profile and invalidate preferences query every time this screen is focused.
  useFocusEffect(useCallback(() => {
    refreshUser();
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: ['user', user.id, 'preferences'] });
    }
  }, [refreshUser, user?.id, queryClient]));

  // Dynamic lists and modal states
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [twoFactorModalVisible, setTwoFactorModalVisible] = useState(false);
  const [disableModalVisible, setDisableModalVisible] = useState(false);
  const [logOutOthersModalVisible, setLogOutOthersModalVisible] = useState(false);

  // BottomSheet Pickers
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [audioPickerVisible, setAudioPickerVisible] = useState(false);
  const [qualityPickerVisible, setQualityPickerVisible] = useState(false);
  const [downloadQualityPickerVisible, setDownloadQualityPickerVisible] = useState(false);

  // Cache & Storage states
  const [cacheSize, setCacheSize] = useState<string>('Calculating...');
  const [clearingCache, setClearingCache] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);

  // Dynamic VIP Pricing
  const { data: plansData } = usePlans();
  const monthlyPlan = plansData?.plans?.find(p => p.billing_cycle === 'monthly');
  const yearlyPlan = plansData?.plans?.find(p => p.billing_cycle === 'yearly');
  const vipPriceText = yearlyPlan?.savings_text
    ? `From ${yearlyPlan.savings_text.split('·')[0].trim()}`
    : monthlyPlan
      ? `${formatPrice(monthlyPlan)}/mo`
      : 'From ₹67/mo';

  useEffect(() => {
    let active = true;
    async function inspectCache() {
      try {
        if (FileSystem.cacheDirectory) {
          const info = await FileSystem.getInfoAsync(FileSystem.cacheDirectory);
          if (info.exists && info.size) {
            const mb = (info.size / (1024 * 1024)).toFixed(1);
            if (active) setCacheSize(`${mb} MB`);
            return;
          }
        }
        if (active) setCacheSize('~32.5 MB');
      } catch {
        if (active) setCacheSize('~32.5 MB');
      }
    }
    inspectCache();
    return () => { active = false; };
  }, []);

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      if (FileSystem.cacheDirectory) {
        const files = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory).catch(() => []);
        for (const file of files) {
          await FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${file}`, { idempotent: true }).catch(() => {});
        }
      }
      setCacheSize('0.0 MB');
      Alert.alert('Cache Cleared', 'Temporary playback and image caches have been freed.');
    } catch {
      setCacheSize('0.0 MB');
      Alert.alert('Cache Cleared', 'Temporary caches have been cleared.');
    } finally {
      setClearingCache(false);
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear Watch History?',
      'This will remove all your continue watching progress and completed episode records. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear History',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            setClearingHistory(true);
            try {
              await supabase.from('user_progress').delete().eq('user_id', user.id);
              queryClient.invalidateQueries({ queryKey: ['user', user.id, 'history'] });
              Alert.alert('History Cleared', 'Your watch history progress has been reset.');
            } catch {
              Alert.alert('Error', 'Failed to clear watch history.');
            } finally {
              setClearingHistory(false);
            }
          },
        },
      ],
    );
  };

  const handleEditAvatarPress = () => {
    setAvatarModalVisible(true);
  };

  // Picker options
  const languageOptions: PickerOption[] = [
    { value: 'en', label: 'English (US)', icon: 'language-outline' },
    { value: 'ja', label: '日本語 (Japanese)', icon: 'language-outline' },
  ];

  const audioOptions: PickerOption[] = [
    { value: 'Japanese (Original)', label: 'Japanese (Original)', icon: 'musical-notes-outline' },
    { value: 'English Dub', label: 'English Dub', icon: 'volume-medium-outline' },
  ];

  const qualityOptions: PickerOption[] = [
    { value: 'auto', label: 'Auto (Recommended, up to 4K)', icon: 'hardware-chip-outline' },
    { value: '4k', label: '4K Ultra HD (VIP Only)', icon: 'tv-outline' },
    { value: '1080p', label: '1080p Full HD', icon: 'videocam-outline' },
    { value: '720p', label: '720p HD (Data Friendly)', icon: 'film-outline' },
    { value: '480p', label: '480p Data Saver', icon: 'cellular-outline' },
  ];

  const downloadQualityOptions: PickerOption[] = [
    { value: '1080p', label: '1080p High Definition', icon: 'videocam-outline' },
    { value: '720p', label: '720p Standard (Recommended)', icon: 'film-outline' },
    { value: '480p', label: '480p Compact Storage', icon: 'save-outline' },
  ];

  const updatePref = async (key: string, value: any) => {
    if (!user) return;

    // Optimistic update in cache
    const prev = queryClient.getQueryData<any>(['user', user.id, 'preferences']) || {};
    const next = { ...prev, [key]: value };
    queryClient.setQueryData(['user', user.id, 'preferences'], next);

    try {
      // Only send the ONE changed key + user_id, not the whole merged object.
      // Sending extra/unknown keys causes Supabase to return 400.
      const payload: Record<string, unknown> = { user_id: user.id, [key]: value };

      const { error } = await supabase
        .from('user_preferences')
        .upsert(payload, { onConflict: 'user_id', ignoreDuplicates: false });

      if (error) {
        // Roll back optimistic update
        queryClient.setQueryData(['user', user.id, 'preferences'], prev);
        console.error('[updatePref] Supabase error:', error.code, error.message, error.details);
        Alert.alert('Could not save', error.message || 'Failed to save preference.');
        return;
      }
    } catch (e: any) {
      queryClient.setQueryData(['user', user.id, 'preferences'], prev);
      console.error('[updatePref] Unexpected error:', e);
    } finally {
      queryClient.invalidateQueries({ queryKey: ['user', user.id, 'preferences'] });
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('signOutTitle'), t('signOutSub'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('logOut'), style: 'destructive', onPress: signOut },
    ]);
  };

  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account & Data?',
      'This will permanently delete your account, watch history, watchlist, favorites, and active subscriptions.\n\nThis action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'Are you absolutely sure? All data associated with your account will be removed permanently.',
              [
                { text: 'Keep My Account', style: 'cancel' },
                {
                  text: 'Permanently Delete',
                  style: 'destructive',
                  onPress: async () => {
                    if (!user) return;
                    setDeletingAccount(true);
                    try {
                      await Promise.allSettled([
                        supabase.from('user_active_streams').delete().eq('user_id', user.id),
                        supabase.from('user_progress').delete().eq('user_id', user.id),
                        supabase.from('user_favorites').delete().eq('user_id', user.id),
                        supabase.from('user_watchlist').delete().eq('user_id', user.id),
                        supabase.from('notifications').delete().eq('user_id', user.id),
                        supabase.from('user_preferences').delete().eq('user_id', user.id),
                        supabase.from('user_push_tokens').delete().eq('user_id', user.id),
                      ]);

                      await supabase.from('users').delete().eq('id', user.id);
                      await signOut();

                      Alert.alert('Account Deleted', 'Your account and personal data have been removed.');
                      router.replace('/(tabs)');
                    } catch (e: any) {
                      Alert.alert('Error', e?.message ?? 'Failed to delete account. Try again later.');
                    } finally {
                      setDeletingAccount(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const getLocaleTag = (loc: string) => (loc === 'ja' ? 'ja-JP' : 'en-US');

  const formattedJoinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(getLocaleTag(locale), { month: 'long', year: 'numeric' })
    : (locale === 'ja' ? '2023年6月' : 'June 2023');

  if (!user) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>{t('pleaseSignInSettings')}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.neon} />
        </TouchableOpacity>
      </View>
    );
  }

  const isVip = user.subscription_type === 'premium';
  const rawQuality = prefs?.quality_preference || 'auto';
  const qualityLabel = qualityOptions.find(q => q.value === rawQuality)?.label || 'Auto (Up to 4K)';
  const rawDownloadQuality = prefs?.download_quality || '1080p';
  const downloadQualityLabel = downloadQualityOptions.find(q => q.value === rawDownloadQuality)?.label || '1080p Full HD';

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <BlurView intensity={20} style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.headerBackBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.neon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{t('profileSettings')}</Text>
      </BlurView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Identity Section */}
        <View style={styles.identitySection}>
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={[COLORS.neon, COLORS.neonCyan, '#ff7346']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
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
              <View style={[styles.premiumBadge, isVip && { backgroundColor: 'rgba(255,214,0,0.1)', borderColor: 'rgba(255,214,0,0.3)' }]}>
                <Text style={[styles.premiumBadgeText, isVip && { color: COLORS.neonGold }]}>
                  {isVip ? t('premiumMember') : t('freePlan')}
                </Text>
              </View>
              <Text style={styles.joinedText}>{t('joined', { date: formattedJoinedDate })}</Text>
            </View>
            <TouchableOpacity
              style={styles.editProfileBtn}
              onPress={() => setEditProfileModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={13} color={COLORS.neon} />
              <Text style={styles.editProfileBtnText}>Edit Profile Info</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── VIP Membership Banner Card ── */}
        {isVip ? (
          <LinearGradient
            colors={['rgba(255, 214, 0, 0.15)', 'rgba(255, 140, 0, 0.06)', 'rgba(14, 14, 26, 0.9)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.vipBannerCard}
          >
            <View style={styles.vipBannerTop}>
              <View style={styles.vipIconWrap}>
                <Ionicons name="ribbon" size={26} color={COLORS.neonGold} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.vipTagRow}>
                  <Text style={styles.vipCardTitle}>VIP Membership Active</Text>
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>VIP</Text>
                  </View>
                </View>
                <Text style={styles.vipCardSub}>
                  Enjoying 4K Ultra HD, zero commercial ads, dual-screen streaming & offline downloads.
                </Text>
              </View>
            </View>

            <View style={styles.vipActionsRow}>
              <TouchableOpacity
                style={styles.managePlanActionBtn}
                onPress={() => router.push('/manage-plan' as any)}
                activeOpacity={0.85}
              >
                <Ionicons name="settings-outline" size={15} color={COLORS.neonGold} />
                <Text style={styles.managePlanActionText}>Manage VIP Plan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.compareActionBtn}
                onPress={() => router.push('/plans')}
                activeOpacity={0.85}
              >
                <Text style={styles.compareActionText}>View All Perks</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        ) : (
          <LinearGradient
            colors={['rgba(255, 214, 0, 0.12)', 'rgba(191, 95, 255, 0.08)', 'rgba(14, 14, 26, 0.9)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.vipBannerCard}
          >
            <View style={styles.vipBannerTop}>
              <View style={styles.vipIconWrap}>
                <Ionicons name="sparkles" size={24} color={COLORS.neonGold} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.vipTagRow}>
                  <Text style={styles.vipCardTitle}>Upgrade to AnimeHub VIP</Text>
                  <View style={styles.savePill}>
                    <Text style={styles.savePillText}>SAVE 33%</Text>
                  </View>
                </View>
                <Text style={styles.vipCardSub}>
                  Watch in 4K UHD with 0 ads, 2 simultaneous screens, and unlimited offline downloads.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.upgradeVipBtn}
              onPress={() => router.push('/plans')}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#FFD600', '#FFA500']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.upgradeVipGradient}
              >
                <Ionicons name="star" size={15} color="#000" />
                <Text style={styles.upgradeVipBtnText}>Unlock VIP · {vipPriceText}</Text>
                <Ionicons name="arrow-forward" size={15} color="#000" />
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        )}

        {/* ── Video & Download Quality Card (NEW) ── */}
        <BlurView intensity={30} style={styles.bentoCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="videocam" size={20} color={COLORS.neonCyan} />
            <Text style={styles.cardTitle}>Streaming & Downloads</Text>
          </View>
          <View style={styles.cardBody}>
            <ActionRow
              label="Streaming Quality"
              sub="Default resolution for episode playback"
              value={qualityLabel}
              isValueHighlighted={true}
              onPress={() => setQualityPickerVisible(true)}
            />
            <ActionRow
              label="Download Quality"
              sub="Resolution for offline saved episodes"
              value={downloadQualityLabel}
              onPress={() => setDownloadQualityPickerVisible(true)}
            />
            <View style={[styles.toggleRow, { marginTop: 4 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Stream on Wi-Fi Only</Text>
                <Text style={styles.toggleSub}>Prevents accidental mobile data usage</Text>
              </View>
              <Switch
                value={prefs?.wifi_only_streaming === true}
                onValueChange={(v) => updatePref('wifi_only_streaming', v)}
                trackColor={{ false: COLORS.border, true: COLORS.neonCyan }}
                thumbColor={prefs?.wifi_only_streaming ? COLORS.bg : COLORS.textMuted}
                ios_backgroundColor={COLORS.border}
              />
            </View>
            <View style={[styles.toggleRow, { marginTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)', paddingTop: 12 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Download on Wi-Fi Only</Text>
                <Text style={styles.toggleSub}>Downloads will pause if on cellular network</Text>
              </View>
              <Switch
                value={prefs?.wifi_only_downloads !== false}
                onValueChange={(v) => updatePref('wifi_only_downloads', v)}
                trackColor={{ false: COLORS.border, true: COLORS.neonCyan }}
                thumbColor={prefs?.wifi_only_downloads !== false ? COLORS.bg : COLORS.textMuted}
                ios_backgroundColor={COLORS.border}
              />
            </View>
          </View>
        </BlurView>

        {/* ── Playback Controls Card ── */}
        <BlurView intensity={30} style={styles.bentoCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="play-circle" size={20} color={COLORS.neon} />
            <Text style={styles.cardTitle}>{t('playback')}</Text>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>{t('autoPlayLabel')}</Text>
                <Text style={styles.toggleSub}>{t('autoPlaySub')}</Text>
              </View>
              <Switch
                value={prefs?.auto_play_next !== false}
                onValueChange={(v) => updatePref('auto_play_next', v)}
                trackColor={{ false: COLORS.border, true: COLORS.neon }}
                thumbColor={prefs?.auto_play_next !== false ? COLORS.bg : COLORS.textMuted}
                ios_backgroundColor={COLORS.border}
              />
            </View>
            <View style={[styles.toggleRow, { marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)', paddingTop: 12 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>{t('autoSkipLabel')}</Text>
                <Text style={styles.toggleSub}>{t('autoSkipSub')}</Text>
              </View>
              <Switch
                value={prefs?.auto_skip_intro !== false}
                onValueChange={(v) => updatePref('auto_skip_intro', v)}
                trackColor={{ false: COLORS.border, true: COLORS.neon }}
                thumbColor={prefs?.auto_skip_intro !== false ? COLORS.bg : COLORS.textMuted}
                ios_backgroundColor={COLORS.border}
              />
            </View>
          </View>
        </BlurView>

        {/* ── Audio & Language Card ── */}
        <BlurView intensity={30} style={styles.bentoCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="language" size={20} color={COLORS.neonCyan} />
            <Text style={styles.cardTitle}>{t('localization')}</Text>
          </View>
          <View style={styles.cardBody}>
            <ActionRow
              label={t('displayLanguage')}
              value={
                prefs?.preferred_language === 'ja' || prefs?.preferred_language === '日本語 (Japanese)'
                  ? '日本語 (Japanese)'
                  : 'English (US)'
              }
              onPress={() => setLanguagePickerVisible(true)}
            />
            <ActionRow
              label={t('audioPreference')}
              value={prefs?.audio_preference || 'Japanese (Original)'}
              onPress={() => setAudioPickerVisible(true)}
            />
          </View>
        </BlurView>

        {/* ── Storage & Cache Management Card (NEW) ── */}
        <BlurView intensity={30} style={styles.bentoCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="file-tray-full" size={20} color={COLORS.neonGold} />
            <Text style={styles.cardTitle}>Storage & Cache</Text>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.storageRow}>
              <View>
                <Text style={styles.actionLabel}>Temporary Cache</Text>
                <Text style={styles.actionSubText}>Video buffer & cached poster artwork</Text>
              </View>
              <Text style={styles.storageSizeText}>{cacheSize}</Text>
            </View>

            <TouchableOpacity
              style={[styles.clearCacheBtn, clearingCache && { opacity: 0.6 }]}
              onPress={handleClearCache}
              disabled={clearingCache}
              activeOpacity={0.8}
            >
              {clearingCache ? (
                <ActivityIndicator size="small" color={COLORS.neonPink} />
              ) : (
                <>
                  <Ionicons name="trash-bin-outline" size={15} color={COLORS.neonPink} />
                  <Text style={styles.clearCacheText}>Clear Cache</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Clear Watch History Action */}
            <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)', paddingTop: 12 }}>
              <View style={styles.storageRow}>
                <View>
                  <Text style={styles.actionLabel}>Watch History</Text>
                  <Text style={styles.actionSubText}>Reset all continue watching episode markers</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.clearHistoryBtn, clearingHistory && { opacity: 0.6 }]}
                onPress={handleClearHistory}
                disabled={clearingHistory}
                activeOpacity={0.8}
              >
                {clearingHistory ? (
                  <ActivityIndicator size="small" color={COLORS.textSub} />
                ) : (
                  <>
                    <Ionicons name="time-outline" size={15} color={COLORS.textSub} />
                    <Text style={styles.clearHistoryText}>Clear Watch History</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>

        {/* ── Security & Login ── */}
        <BlurView intensity={30} style={styles.bentoCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="shield-checkmark" size={20} color="#ff7346" />
            <Text style={styles.cardTitle}>{t('securityLogin')}</Text>
          </View>
          <View style={styles.cardBody}>
            <ActionRow
              label={t('changePassword')}
              sub={t('changePasswordSub')}
              onPress={() => setPasswordModalVisible(true)}
            />
            <ActionRow
              label={t('twoFactorAuth')}
              value={prefs?.two_factor_enabled ? t('enabled') : t('disabled')}
              isValueHighlighted={prefs?.two_factor_enabled}
              onPress={() => {
                const current = prefs?.two_factor_enabled ?? false;
                if (current) {
                  setDisableModalVisible(true);
                } else {
                  setTwoFactorModalVisible(true);
                }
              }}
            />
            <ActionRow
              label={t('connectedDevices')}
              sub={t('connectedDevicesSub')}
              onPress={() => setLogOutOthersModalVisible(true)}
            />
          </View>
        </BlurView>

        {/* ── Notification Preferences ── */}
        <BlurView intensity={30} style={styles.bentoCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="notifications" size={20} color={COLORS.neonCyan} />
            <Text style={styles.cardTitle}>{t('preferences')}</Text>
          </View>
          <View style={styles.preferenceGrid}>
            <PreferenceToggle
              label={t('newEpisodeAlerts')}
              sub={t('newEpisodeSub')}
              value={prefs?.notification_settings?.push ?? true}
              onToggle={(v: boolean) => updatePref('notification_settings', { ...prefs?.notification_settings, push: v })}
            />
            <PreferenceToggle
              label={t('marketingEmails')}
              sub={t('marketingSub')}
              value={prefs?.notification_settings?.email ?? false}
              onToggle={(v: boolean) => updatePref('notification_settings', { ...prefs?.notification_settings, email: v })}
            />
          </View>
        </BlurView>

        {/* ── Modals ── */}
        <AvatarModal
          visible={avatarModalVisible}
          onClose={() => setAvatarModalVisible(false)}
          user={user}
          refreshUser={refreshUser}
        />

        <EditProfileModal
          visible={editProfileModalVisible}
          onClose={() => setEditProfileModalVisible(false)}
          user={user}
          refreshUser={refreshUser}
        />

        <ChangePasswordModal
          visible={passwordModalVisible}
          onClose={() => setPasswordModalVisible(false)}
        />

        <TwoFactorModal
          visible={twoFactorModalVisible}
          onClose={() => setTwoFactorModalVisible(false)}
          onSuccess={() => updatePref('two_factor_enabled', true)}
          t={t}
        />

        <Disable2FAModal
          visible={disableModalVisible}
          onClose={() => setDisableModalVisible(false)}
          onSuccess={() => updatePref('two_factor_enabled', false)}
          t={t}
        />

        <LogOutOthersModal
          visible={logOutOthersModalVisible}
          onClose={() => setLogOutOthersModalVisible(false)}
          t={t}
        />

        {/* Streaming Video Quality Picker */}
        <PickerBottomSheet
          visible={qualityPickerVisible}
          onClose={() => setQualityPickerVisible(false)}
          title="Streaming Quality"
          options={qualityOptions}
          selectedValue={rawQuality}
          onSelect={(v) => updatePref('quality_preference', v)}
        />

        {/* Download Quality Picker */}
        <PickerBottomSheet
          visible={downloadQualityPickerVisible}
          onClose={() => setDownloadQualityPickerVisible(false)}
          title="Download Quality"
          options={downloadQualityOptions}
          selectedValue={rawDownloadQuality}
          onSelect={(v) => updatePref('download_quality', v)}
        />

        {/* Display Language Picker */}
        <PickerBottomSheet
          visible={languagePickerVisible}
          onClose={() => setLanguagePickerVisible(false)}
          title={t('displayLanguage')}
          options={languageOptions}
          selectedValue={prefs?.preferred_language || 'en'}
          onSelect={(v) => updatePref('preferred_language', v)}
        />

        {/* Audio Preference Picker */}
        <PickerBottomSheet
          visible={audioPickerVisible}
          onClose={() => setAudioPickerVisible(false)}
          title={t('audioPreference')}
          options={audioOptions}
          selectedValue={prefs?.audio_preference || 'Japanese (Original)'}
          onSelect={(v) => updatePref('audio_preference', v)}
        />

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={24} color={COLORS.danger} />
          <Text style={styles.signOutText}>{t('signOut')}</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity
          style={styles.deleteAccountBtn}
          onPress={handleDeleteAccount}
          disabled={deletingAccount}
        >
          {deletingAccount ? (
            <ActivityIndicator size="small" color={COLORS.danger} />
          ) : (
            <>
              <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
              <Text style={styles.deleteAccountText}>Delete Account & Data</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.versionText}>{t('version')}</Text>
      </ScrollView>
    </View>
  );
}

function ActionRow({ label, value, sub, isValueHighlighted, onPress }: any) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.75}>
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
        {sub && <Text style={styles.prefSub}>{sub}</Text>}
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
