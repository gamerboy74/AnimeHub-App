import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Switch, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS } from '../src/constants/theme';
import { userAPI, supabase } from '../src/lib/supabase';
import { useAuth } from '../src/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut, refreshUser } = useAuth();
  const [prefs, setPrefs] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Re-fetch user profile every time this screen is focused.
  // Ensures subscription_type is current even if it was changed externally.
  useFocusEffect(useCallback(() => { refreshUser(); }, [refreshUser]));

  // Dynamic lists and modal states
  const [cards, setCards] = useState<any[]>([
    { id: '1', brand: 'VISA', last4: '4242', expiry: '12/26', primary: true }
  ]);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [avatarInputUrl, setAvatarInputUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [cardModalVisible, setCardModalVisible] = useState(false);
  const [cardNumInput, setCardNumInput] = useState('');
  const [cardExpiryInput, setCardExpiryInput] = useState('');
  const [cardBrandInput, setCardBrandInput] = useState('VISA');

  const handleSelectAndUploadAvatar = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to upload an avatar.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need photo library access to change your avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const selectedUri = result.assets[0].uri;

    try {
      setUploadingAvatar(true);
      const publicUrl = await userAPI.uploadAvatar(user.id, selectedUri);

      const { error } = await userAPI.updateProfile(user.id, { avatar_url: publicUrl });
      if (error) throw error;

      Alert.alert('Success', 'Avatar updated!');
      setAvatarModalVisible(false);
      await refreshUser();
    } catch (err: any) {
      Alert.alert('Error', `Failed to upload avatar: ${err.message || JSON.stringify(err)}`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    
    // Load local cards cache
    AsyncStorage.getItem(`user_cards_${user.id}`).then(cached => {
      if (cached) setCards(JSON.parse(cached));
    });

    userAPI.getPreferences(user.id).then(({ data }) => {
      setPrefs(data || { 
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
              contentFit="cover"
              transition={200}
            />
            <TouchableOpacity
              style={styles.editAvatarBtn}
              onPress={() => {
                setAvatarInputUrl(user.avatar_url || '');
                setAvatarModalVisible(true);
              }}
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
              onPress={() => {
                setPasswordInput('');
                setPasswordModalVisible(true);
              }}
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
            {cards.map(c => (
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
                    onPress={() => {
                      const updated = cards.map(x => ({ ...x, primary: x.id === c.id }));
                      setCards(updated);
                      AsyncStorage.setItem(`user_cards_${user.id}`, JSON.stringify(updated));
                    }}
                  >
                    <Text style={{ fontSize: 9, fontWeight: '700', color: COLORS.textMuted }}>SET PRIMARY</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  onPress={() => {
                    const updated = cards.filter(x => x.id !== c.id);
                    setCards(updated);
                    AsyncStorage.setItem(`user_cards_${user.id}`, JSON.stringify(updated));
                  }}
                  style={{ marginLeft: 10 }}
                >
                  <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity 
              style={styles.addPaymentBtn}
              onPress={() => {
                setCardNumInput('');
                setCardExpiryInput('');
                setCardBrandInput('VISA');
                setCardModalVisible(true);
              }}
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
        <Modal visible={avatarModalVisible} transparent animationType="slide" onRequestClose={() => setAvatarModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setAvatarModalVisible(false)} />
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Change Avatar</Text>
              
              {/* Option 1: Upload from Device */}
              <Text style={styles.modalLabel}>Upload from Device</Text>
              <TouchableOpacity 
                style={styles.uploadImageBtn}
                onPress={handleSelectAndUploadAvatar}
                disabled={uploadingAvatar}
              >
                <LinearGradient 
                  colors={[COLORS.neonCyan, COLORS.neon]} 
                  start={{x:0,y:0}} end={{x:1,y:1}} 
                  style={styles.uploadImageGradient}
                >
                  {uploadingAvatar ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="cloud-upload" size={20} color="#000" style={{ marginRight: 8 }} />
                      <Text style={styles.uploadImageText}>Choose Photo from Library</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.modalDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Option 2: Paste URL */}
              <Text style={styles.modalLabel}>Or, Paste Public Image URL</Text>
              <TextInput
                style={styles.modalInput}
                value={avatarInputUrl}
                onChangeText={setAvatarInputUrl}
                placeholder="Paste a public avatar image URL"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
              />
              <TouchableOpacity 
                style={styles.modalSaveBtn} 
                onPress={async () => {
                  if (!avatarInputUrl.trim()) return;
                  const { error } = await userAPI.updateProfile(user.id, { avatar_url: avatarInputUrl.trim() });
                  if (error) {
                    Alert.alert('Error', `Failed to update avatar: ${(error as any)?.message || JSON.stringify(error)}`);
                  } else {
                    Alert.alert('Success', 'Avatar updated!');
                    setAvatarModalVisible(false);
                    await refreshUser();
                  }
                }}
              >
                <LinearGradient colors={[COLORS.neon, COLORS.accent]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.modalSaveGradient}>
                  <Text style={styles.modalSaveText}>Update URL</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Change Password Modal */}
        <Modal visible={passwordModalVisible} transparent animationType="slide" onRequestClose={() => setPasswordModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setPasswordModalVisible(false)} />
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Change Password</Text>
              <Text style={styles.modalLabel}>New Password</Text>
              <TextInput
                style={styles.modalInput}
                value={passwordInput}
                onChangeText={setPasswordInput}
                placeholder="Enter at least 6 characters"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
                autoCapitalize="none"
              />
              <Text style={styles.modalLabel}>Confirm New Password</Text>
              <TextInput
                style={styles.modalInput}
                value={confirmPasswordInput}
                onChangeText={setConfirmPasswordInput}
                placeholder="Re-enter your new password"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
                autoCapitalize="none"
              />
              <TouchableOpacity 
                style={styles.modalSaveBtn} 
                onPress={async () => {
                  if (!passwordInput.trim() || passwordInput.length < 6) {
                    Alert.alert('Error', 'Password must be at least 6 characters.');
                    return;
                  }
                  if (passwordInput !== confirmPasswordInput) {
                    Alert.alert('Error', 'Passwords do not match. Please try again.');
                    return;
                  }
                  const { error } = await supabase.auth.updateUser({ password: passwordInput.trim() });
                  if (error) {
                    Alert.alert('Error', error.message);
                  } else {
                    Alert.alert('Success', 'Password changed successfully!');
                    setPasswordModalVisible(false);
                    setPasswordInput('');
                    setConfirmPasswordInput('');
                  }
                }}
              >
                <LinearGradient colors={[COLORS.neon, COLORS.accent]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.modalSaveGradient}>
                  <Text style={styles.modalSaveText}>Update Password</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Add Payment Method Modal */}
        <Modal visible={cardModalVisible} transparent animationType="slide" onRequestClose={() => setCardModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setCardModalVisible(false)} />
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Add Payment Card</Text>
              
              <Text style={styles.modalLabel}>Card Provider</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                {['VISA', 'MC', 'AMEX'].map(brand => (
                  <TouchableOpacity 
                    key={brand}
                    onPress={() => setCardBrandInput(brand)}
                    style={[{
                      paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(189,157,255,0.1)',
                      backgroundColor: 'rgba(255,255,255,0.03)'
                    }, cardBrandInput === brand && { borderColor: COLORS.neon, backgroundColor: 'rgba(189,157,255,0.05)' }]}
                  >
                    <Text style={{ color: COLORS.text, fontWeight: '700' }}>{brand}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Last 4 Digits</Text>
              <TextInput
                style={styles.modalInput}
                value={cardNumInput}
                onChangeText={setCardNumInput}
                placeholder="e.g. 5678"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                maxLength={4}
              />

              <Text style={styles.modalLabel}>Expiration Date</Text>
              <TextInput
                style={styles.modalInput}
                value={cardExpiryInput}
                onChangeText={setCardExpiryInput}
                placeholder="MM/YY"
                placeholderTextColor={COLORS.textMuted}
                maxLength={5}
              />

              <TouchableOpacity 
                style={styles.modalSaveBtn} 
                onPress={async () => {
                  if (cardNumInput.trim().length < 4) {
                    Alert.alert('Error', 'Please enter the last 4 digits of your card.');
                    return;
                  }
                  const expiryPattern = /^(0[1-9]|1[0-2])\/(\d{2})$/;
                  if (!expiryPattern.test(cardExpiryInput.trim())) {
                    Alert.alert('Error', 'Expiry must be in MM/YY format (e.g. 08/27).');
                    return;
                  }
                  const newCard = {
                    id: Date.now().toString(),
                    brand: cardBrandInput,
                    last4: cardNumInput.trim(),
                    expiry: cardExpiryInput.trim(),
                    primary: cards.length === 0,
                  };
                  const updated = [...cards, newCard];
                  setCards(updated);
                  await AsyncStorage.setItem(`user_cards_${user.id}`, JSON.stringify(updated));
                  setCardModalVisible(false);
                  Alert.alert('Success', 'Card added successfully!');
                }}
              >
                <LinearGradient colors={[COLORS.neon, COLORS.accent]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.modalSaveGradient}>
                  <Text style={styles.modalSaveText}>Add Payment Card</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

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

  // Playback toggle row
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 4,
  },
  toggleLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  toggleSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 3, lineHeight: 16 },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    marginTop: 40, paddingVertical: 20,
  },
  signOutText: { fontSize: 14, fontWeight: '900', color: COLORS.danger, letterSpacing: 3 },
  versionText: { textAlign: 'center', fontSize: 10, color: COLORS.textMuted, opacity: 0.5, letterSpacing: 1.5, marginTop: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  modalSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#121214', borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg,
    borderWidth: 1, borderColor: 'rgba(189,157,255,0.1)',
    padding: 24, paddingBottom: 40,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5, marginBottom: 20 },
  modalLabel: { fontSize: 11, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(189,157,255,0.1)',
    color: COLORS.text, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14,
  },
  modalSaveBtn: { marginTop: 24, borderRadius: 100, overflow: 'hidden' },
  modalSaveGradient: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  modalSaveText: { color: '#000', fontWeight: '800', fontSize: 14 },
  uploadImageBtn: { borderRadius: 100, overflow: 'hidden', marginTop: 8 },
  uploadImageGradient: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  uploadImageText: { color: '#000', fontWeight: '800', fontSize: 14 },
  modalDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  dividerText: { marginHorizontal: 16, fontSize: 11, fontWeight: '800', color: COLORS.textMuted },
});
