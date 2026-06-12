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
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/theme';
import { styles } from '../../screens/settings.styles';

interface TwoFactorModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  t: (key: any) => string;
}

export default function TwoFactorModal({ visible, onClose, onSuccess, t }: TwoFactorModalProps) {
  const insets = useSafeAreaInsets();
  const [enrollData, setEnrollData] = useState<any>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (visible) {
      enrollMFA();
    } else {
      setEnrollData(null);
      setCode('');
      setError(null);
      setCopied(false);
    }
  }, [visible]);

  const enrollMFA = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (factors && factors.all) {
        const totpFactors = factors.all.filter((f: any) => f.factor_type === 'totp');
        for (const factor of totpFactors) {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }

      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) {
        setError(error.message);
      } else {
        setEnrollData(data);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during enrollment.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (enrollData?.totp?.secret) {
      await Clipboard.setStringAsync(enrollData.totp.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVerify = async () => {
    if (!enrollData) return;
    if (code.trim().length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Verify the code with Supabase
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollData.id,
        code: code.trim(),
      });

      if (error) {
        setError(error.message);
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

  const qrCodeUrl = enrollData?.totp?.uri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(enrollData.totp.uri)}`
    : null;

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
          <Text style={styles.modalTitle}>Set Up Two-Factor Auth</Text>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {loading && !enrollData ? (
              <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={COLORS.neon} />
                <Text style={{ color: COLORS.textMuted, marginTop: 12 }}>Initializing 2FA...</Text>
              </View>
            ) : error && !enrollData ? (
              <View style={{ paddingVertical: 40, alignItems: 'center', width: '100%' }}>
                <View style={localStyles.errorBox}>
                  <Ionicons name="warning-outline" size={14} color={COLORS.danger} />
                  <Text style={localStyles.errorText}>{error}</Text>
                </View>
                <TouchableOpacity 
                  style={[styles.modalSaveBtn, { width: '100%' }]} 
                  onPress={enrollMFA}
                >
                  <LinearGradient
                    colors={[COLORS.neon, '#BD9DFF']}
                    style={styles.modalSaveGradient}
                  >
                    <Text style={styles.modalSaveText}>Retry</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              enrollData && (
                <View style={{ width: '100%', alignItems: 'stretch' }}>
                  {error ? (
                    <View style={localStyles.errorBox}>
                      <Ionicons name="warning-outline" size={14} color={COLORS.danger} />
                      <Text style={localStyles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  <Text style={{ color: COLORS.textSub, fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 18 }}>
                    Scan the QR code below using your authenticator app (e.g. Google Authenticator), or copy the secret key manually.
                  </Text>

                  {qrCodeUrl && (
                    <View style={{ alignItems: 'center', marginBottom: 20 }}>
                      <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 16 }}>
                        <Image
                          source={{ uri: qrCodeUrl }}
                          style={{ width: 160, height: 160 }}
                          contentFit="contain"
                        />
                      </View>
                    </View>
                  )}

                  <View style={{ 
                    width: '100%', 
                    backgroundColor: 'rgba(255,255,255,0.02)', 
                    borderRadius: 12, 
                    padding: 12, 
                    marginBottom: 20, 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    borderWidth: 1, 
                    borderColor: 'rgba(189,157,255,0.15)' 
                  }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ color: COLORS.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 2 }}>SECRET KEY</Text>
                      <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '500' }} numberOfLines={1}>
                        {enrollData.totp.secret}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={copyToClipboard}
                      style={{ backgroundColor: 'rgba(189,157,255,0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, minWidth: 64, alignItems: 'center' }}
                    >
                      <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: '700' }}>
                        {copied ? 'Copied!' : 'Copy'}
                      </Text>
                    </TouchableOpacity>
                  </View>

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
                    style={styles.modalSaveBtn}
                    onPress={handleVerify}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={[COLORS.neon, '#BD9DFF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.modalSaveGradient}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.modalSaveText}>Verify & Enable</Text>
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
