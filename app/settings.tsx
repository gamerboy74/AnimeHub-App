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
import TwoFactorModal from '../src/components/settings/TwoFactorModal';
import Disable2FAModal from '../src/components/settings/Disable2FAModal';
import LogOutOthersModal from '../src/components/settings/LogOutOthersModal';
import { useTranslation } from '../src/context/LocalizationContext';
import PickerBottomSheet, { PickerOption } from '../src/components/settings/PickerBottomSheet';

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
  const [twoFactorModalVisible, setTwoFactorModalVisible] = useState(false);
  const [disableModalVisible, setDisableModalVisible] = useState(false);
  const [logOutOthersModalVisible, setLogOutOthersModalVisible] = useState(false);

  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [audioPickerVisible, setAudioPickerVisible] = useState(false);

  const handleEditAvatarPress = () => {
    setAvatarModalVisible(true);
  };

  const languageOptions: PickerOption[] = [
    { value: 'en', label: 'English (US)', icon: 'language-outline' },
    { value: 'ja', label: '日本語 (Japanese)', icon: 'language-outline' },
  ];

  const audioOptions: PickerOption[] = [
    { value: 'Japanese (Original)', label: 'Japanese (Original)', icon: 'musical-notes-outline' },
    { value: 'English Dub', label: 'English Dub', icon: 'volume-medium-outline' },
  ];

  const updatePref = async (key: string, value: any) => {
    if (!user) return;
    const current = queryClient.getQueryData<any>(['user', user.id, 'preferences']) || {};
    const updated = { ...current, [key]: value };

    console.log(`[Settings] Updating preference: ${key} =`, value);

    // Optimistic update
    queryClient.setQueryData(['user', user.id, 'preferences'], updated);

    try {
      // DB save
      const { error } = await userAPI.updatePreferences(user.id, updated);
      if (error) {
        console.error(`[Settings] DB error updating preference ${key}:`, error.message);
        // Revert optimistic update
        queryClient.setQueryData(['user', user.id, 'preferences'], current);
        Alert.alert(t('error'), 'Failed to save preference to cloud.');
      } else {
        console.log(`[Settings] DB save successful for: ${key}`);
      }
    } catch (err: any) {
      console.error(`[Settings] Exception updating preference ${key}:`, err);
      queryClient.setQueryData(['user', user.id, 'preferences'], current);
    } finally {
      // Invalidate query to sync across other screens
      queryClient.invalidateQueries({ queryKey: ['user', user.id, 'preferences'] });
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('signOutTitle'), t('signOutSub'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('logOut'), style: 'destructive', onPress: signOut },
    ]);
  };

  const getLocaleTag = (loc: string) => {
    if (loc === 'ja') return 'ja-JP';
    return 'en-US';
  };

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
              <View style={[styles.premiumBadge, user.subscription_type === 'premium' && { backgroundColor: 'rgba(255,214,0,0.1)', borderColor: 'rgba(255,214,0,0.3)' }]}>
                <Text style={[styles.premiumBadgeText, user.subscription_type === 'premium' && { color: COLORS.neonGold }]}>
                  {user.subscription_type === 'premium' ? t('premiumMember') : t('freePlan')}
                </Text>
              </View>
              <Text style={styles.joinedText}>{t('joined', { date: formattedJoinedDate })}</Text>
            </View>
          </View>
        </View>

        {/* Subscription Bento Card */}
        <BlurView intensity={30} style={styles.bentoCard}>
          <View style={styles.bentoGlow} />
          <View style={styles.bentoHeader}>
            <View>
              <Text style={styles.bentoTitle}>{t('subscription')}</Text>
              {user.subscription_type === 'premium' ? (
                <Text style={styles.bentoSub}>{t('premiumPlanText')}</Text>
              ) : (
                <Text style={styles.bentoSub}>{t('freePlanText')}</Text>
              )}
            </View>
            <Ionicons name="ribbon" size={28} color={user.subscription_type === 'premium' ? COLORS.neonGold : COLORS.textMuted} />
          </View>
          {user.subscription_type === 'premium' ? (
            <View style={styles.bentoStats}>
              <View style={styles.bentoStat}>
                <Text style={styles.statLabel}>{t('plan')}</Text>
                <Text style={styles.statValue}>{t('premium')}</Text>
              </View>
              <View style={styles.bentoStat}>
                <Text style={styles.statLabel}>{t('memberSince')}</Text>
                <Text style={styles.statValue}>
                  {user.created_at ? new Date(user.created_at).toLocaleDateString(getLocaleTag(locale), { month: 'short', year: 'numeric' }) : '—'}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.freeFeatureList}>
              {['Unlimited Anime Access', 'HD Streaming', 'Offline Downloads', 'No Ads'].map(f => {
                const featuresDict: Record<string, string> = {
                  'Unlimited Anime Access': locale === 'ja' ? 'アニメ見放題' : 'Unlimited Anime Access',
                  'HD Streaming': locale === 'ja' ? 'HD配信' : 'HD Streaming',
                  'Offline Downloads': locale === 'ja' ? 'オフライン再生' : 'Offline Downloads',
                  'No Ads': locale === 'ja' ? '広告非表示' : 'No Ads',
                };
                return (
                  <View key={f} style={styles.freeFeatureRow}>
                    <Ionicons name="lock-closed-outline" size={14} color={COLORS.textMuted} />
                    <Text style={styles.freeFeatureText}>{featuresDict[f] || f}</Text>
                  </View>
                );
              })}
            </View>
          )}
          <View style={styles.bentoActions}>
            {user.subscription_type === 'premium' ? (
              <>
                <TouchableOpacity style={styles.primaryAction} onPress={() => router.push('/manage-plan' as any)}>
                  <LinearGradient
                    colors={[COLORS.neonGold, '#ff7346']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.actionGradient}
                  >
                    <Text style={styles.primaryActionText}>⚙️ {t('managePlan')}</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/plans' as any)}>
                  <Text style={styles.secondaryActionText}>{t('viewAllPlans')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.primaryAction} onPress={() => router.push('/premium' as any)}>
                  <LinearGradient
                    colors={[COLORS.neonGold, '#ff7346']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.actionGradient}
                  >
                    <Text style={styles.primaryActionText}>⚡ {t('upgradeToPremium')}</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/plans' as any)}>
                  <Text style={styles.secondaryActionText}>{t('comparePlans')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </BlurView>

        {/* Playback Card */}
        <BlurView intensity={30} style={styles.bentoCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="play-circle" size={20} color={COLORS.neonCyan} />
            <Text style={styles.cardTitle}>{t('playback')}</Text>
          </View>
          <View style={styles.cardBody}>
            {/* Auto-play next episode toggle */}
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>{t('autoPlayLabel')}</Text>
                <Text style={styles.toggleSub}>{t('autoPlaySub')}</Text>
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
                <Text style={styles.toggleLabel}>{t('autoSkipLabel')}</Text>
                <Text style={styles.toggleSub}>{t('autoSkipSub')}</Text>
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

        {/* Security Hub */}
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

        {/* Payment Methods */}
        <BlurView intensity={30} style={styles.bentoCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="card" size={20} color={COLORS.neon} />
            <Text style={styles.cardTitle}>{t('paymentMethods')}</Text>
          </View>
          <View style={styles.cardBody}>
            {loadingCards ? (
              <ActivityIndicator size="small" color={COLORS.neon} style={{ marginVertical: 16 }} />
            ) : cards.length === 0 ? (
              <Text style={{ fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginVertical: 16 }}>
                {t('noPaymentMethods')}
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
                    <View style={styles.primaryPill}><Text style={styles.pillText}>{t('primary')}</Text></View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setPrimaryCard(c.id)}
                    >
                      <Text style={{ fontSize: 9, fontWeight: '700', color: COLORS.textMuted }}>{t('setPrimary')}</Text>
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
              <Text style={styles.addPaymentText}>{t('addNewPayment')}</Text>
            </TouchableOpacity>
          </View>
        </BlurView>

        {/* Preferences Module */}
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

        {/* Two-Factor Auth Setup Modal */}
        <TwoFactorModal
          visible={twoFactorModalVisible}
          onClose={() => setTwoFactorModalVisible(false)}
          onSuccess={() => updatePref('two_factor_enabled', true)}
          t={t}
        />

        {/* Two-Factor Auth Disable Modal */}
        <Disable2FAModal
          visible={disableModalVisible}
          onClose={() => setDisableModalVisible(false)}
          onSuccess={() => updatePref('two_factor_enabled', false)}
          t={t}
        />

        {/* Log Out Others Modal */}
        <LogOutOthersModal
          visible={logOutOthersModalVisible}
          onClose={() => setLogOutOthersModalVisible(false)}
          t={t}
        />

        {/* Custom Frosted-Glass Language Picker Bottom Sheet */}
        <PickerBottomSheet
          visible={languagePickerVisible}
          onClose={() => setLanguagePickerVisible(false)}
          title={t('displayLanguage')}
          options={languageOptions}
          selectedValue={prefs?.preferred_language || 'en'}
          onSelect={(v) => updatePref('preferred_language', v)}
        />

        {/* Custom Frosted-Glass Audio Picker Bottom Sheet */}
        <PickerBottomSheet
          visible={audioPickerVisible}
          onClose={() => setAudioPickerVisible(false)}
          title={t('audioPreference')}
          options={audioOptions}
          selectedValue={prefs?.audio_preference || 'Japanese (Original)'}
          onSelect={(v) => updatePref('audio_preference', v)}
        />

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={24} color={COLORS.danger} />
          <Text style={styles.signOutText}>{t('signOut')}</Text>
        </TouchableOpacity>
        <Text style={styles.versionText}>{t('version')}</Text>
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


