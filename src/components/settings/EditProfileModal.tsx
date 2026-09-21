/**
 * src/components/settings/EditProfileModal.tsx
 *
 * Senior Dev Profile Information Editor Modal
 * Allows updating username and bio with real-time validation and persistence.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Modal, TouchableOpacity,
  ActivityIndicator, Alert, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import { userAPI, User, supabase } from '../../lib/supabase';

interface Props {
  visible: boolean;
  onClose: () => void;
  user: User;
  refreshUser: () => Promise<void>;
}

export default function EditProfileModal({ visible, onClose, user, refreshUser }: Props) {
  const [username, setUsername] = useState(user.username || '');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Load existing bio on mount / visible change
  useEffect(() => {
    if (visible && user) {
      setUsername(user.username || '');
      AsyncStorage.getItem(`user_bio_${user.id}`).then((stored) => {
        if (stored) setBio(stored);
      });
    }
  }, [visible, user]);

  // Debounced username format & duplicate check
  useEffect(() => {
    const trimmed = username.trim();
    if (!trimmed) {
      setUsernameError('Username cannot be empty');
      return;
    }

    if (trimmed === user.username) {
      setUsernameError(null);
      return;
    }

    const regex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!regex.test(trimmed)) {
      setUsernameError('3-20 alphanumeric characters or underscores');
      return;
    }

    setUsernameError(null);
    setCheckingUsername(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('users')
          .select('id')
          .eq('username', trimmed)
          .maybeSingle();

        if (data && data.id !== user.id) {
          setUsernameError('Username is already taken');
        } else {
          setUsernameError(null);
        }
      } catch {
        // ignore lookup errors
      } finally {
        setCheckingUsername(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username, user]);

  const handleSave = async () => {
    const cleanUsername = username.trim();
    if (!cleanUsername || usernameError) return;

    setSaving(true);
    try {
      if (cleanUsername !== user.username) {
        const { data, error } = await userAPI.updateProfile(user.id, {
          username: cleanUsername,
        });

        if (error) {
          const msg = (error as any)?.message || '';
          if (msg.includes('duplicate key') || msg.includes('already exists')) {
            Alert.alert('Notice', 'This username is already taken. Please choose another.');
            return;
          }
          throw error;
        }

        if (!data || (data as any[]).length === 0) {
          throw new Error('Profile update was restricted by security policy.');
        }
      }

      // Persist bio locally
      await AsyncStorage.setItem(`user_bio_${user.id}`, bio.trim());
      await refreshUser();
      Alert.alert('Profile Updated', 'Your profile details have been saved successfully.');
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={styles.title}>Edit Profile Information</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={COLORS.textSub} />
            </TouchableOpacity>
          </View>

          {/* Username Field */}
          <Text style={styles.label}>USERNAME</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="e.g. naruto_fan99"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
            {checkingUsername && (
              <ActivityIndicator size="small" color={COLORS.neon} style={styles.inputIcon} />
            )}
            {!checkingUsername && !usernameError && username.trim() !== '' && (
              <Ionicons name="checkmark-circle" size={18} color={COLORS.neonCyan} style={styles.inputIcon} />
            )}
          </View>
          {usernameError && (
            <Text style={styles.errorText}>
              <Ionicons name="alert-circle" size={11} color={COLORS.danger} /> {usernameError}
            </Text>
          )}

          {/* Bio Field */}
          <View style={styles.bioLabelRow}>
            <Text style={styles.label}>ANIME FAN BIO</Text>
            <Text style={styles.counterText}>{bio.length}/150</Text>
          </View>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell fellow otaku about your favorite anime, characters, or genres…"
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={150}
          />

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.saveBtn,
              (!!usernameError || checkingUsername || saving) && { opacity: 0.5 },
            ]}
            onPress={handleSave}
            disabled={!!usernameError || checkingUsername || saving}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={[COLORS.neon, COLORS.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveGradient}
            >
              {saving ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-sharp" size={16} color="#000" />
                  <Text style={styles.saveBtnText}>Save Profile Changes</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#121218',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(189,157,255,0.15)',
    padding: 24,
    paddingBottom: 36,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.textMuted,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(189,157,255,0.15)',
    color: COLORS.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  inputIcon: {
    position: 'absolute',
    right: 12,
  },
  errorText: {
    fontSize: 11,
    color: COLORS.danger,
    marginTop: 4,
    marginBottom: 8,
  },
  bioLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 14,
  },
  counterText: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  bioInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  saveBtn: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginTop: 22,
  },
  saveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  saveBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
