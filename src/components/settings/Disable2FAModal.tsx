import React, { useState, useEffect } from 'react';
import {
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/theme';
import { styles } from '../../screens/settings.styles';

interface Disable2FAModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  t: (key: any) => string;
}

export default function Disable2FAModal({ visible, onClose, onSuccess, t }: Disable2FAModalProps) {
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      fetchActiveFactor();
    } else {
      setCode('');
      setFactorId(null);
      setError(null);
    }
  }, [visible]);

  const fetchActiveFactor = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: factors, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const verified = factors?.all?.find(
        (f: any) => f.factor_type === 'totp' && f.status === 'verified'
      );

      if (verified) {
        setFactorId(verified.id);
      } else {
        setError('No active 2FA factor found on your account.');
      }
    } catch (err: any) {
      console.error('[Disable2FA] Error listing factors:', err);
      setError(err.message || 'Failed to check security settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!factorId) {
      setError('No active 2FA factor identified.');
      return;
    }
    if (code.trim().length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Verify the code with Supabase to authorize unenrollment
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: code.trim(),
      });

      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      // 2. Unenroll the factor
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId,
      });

      if (unenrollError) {
        setError(unenrollError.message);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[
          styles.modalSheet, 
          { 
            maxHeight: '90%', 
            paddingBottom: Math.max(insets.bottom, 24) 
          }
        ]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Disable Two-Factor Auth</Text>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {loading && !factorId ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={COLORS.danger} />
                <Text style={{ color: COLORS.textMuted, marginTop: 12 }}>Loading security settings...</Text>
              </View>
            ) : error && !factorId ? (
              <View style={{ paddingVertical: 20, alignItems: 'center', width: '100%' }}>
                <View style={localStyles.errorBox}>
                  <Ionicons name="warning-outline" size={14} color={COLORS.danger} />
                  <Text style={localStyles.errorText}>{error}</Text>
                </View>
                <TouchableOpacity 
                  style={[styles.modalSaveBtn, { width: '100%' }]} 
                  onPress={onClose}
                >
                  <LinearGradient
                    colors={[COLORS.neon, COLORS.primaryDark]}
                    style={styles.modalSaveGradient}
                  >
                    <Text style={styles.modalSaveText}>Go Back</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              factorId && (
                <View style={{ width: '100%', alignItems: 'stretch' }}>
                  {error ? (
                    <View style={localStyles.errorBox}>
                      <Ionicons name="warning-outline" size={14} color={COLORS.danger} />
                      <Text style={localStyles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  <Text style={{ color: COLORS.textSub, fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 18 }}>
                    For security reasons, please enter the 6-digit verification code from your authenticator app to authorize disabling 2FA.
                  </Text>

                  <Text style={styles.modalLabel}>Enter 6-Digit Code</Text>
                  <TextInput
                    style={[styles.modalInput, { textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: '600' }]}
                    value={code}
                    onChangeText={(val) => setCode(val.replace(/[^0-9]/g, ''))}
                    placeholder="000000"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!loading}
                    autoFocus
                  />

                  <TouchableOpacity
                    style={[styles.modalSaveBtn, { marginTop: 24 }]}
                    onPress={handleDisable}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={[COLORS.danger, '#ff7346']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.modalSaveGradient}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={[styles.modalSaveText, { color: '#fff' }]}>Confirm & Disable 2FA</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const localStyles = {
  errorBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: 'rgba(255,45,120,0.08)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,45,120,0.2)',
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '600' as const,
    flex: 1,
  }
};
