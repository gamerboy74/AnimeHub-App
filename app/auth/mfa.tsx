import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS, SPACING, RADIUS } from '../../src/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

export default function MFAScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);

  useEffect(() => {
    fetchFactors();
  }, []);

  const fetchFactors = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get assurance levels to verify if challenge is needed
      const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;

      // If already AAL2 or doesn't need AAL2, redirect to tabs
      if (aalData.currentLevel === 'aal2' || aalData.nextLevel === 'aal1') {
        router.replace('/(tabs)');
        return;
      }

      // Get active factors
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const verifiedFactors = factorsData?.all?.filter(
        (f: any) => f.factor_type === 'totp' && f.status === 'verified'
      );

      if (verifiedFactors && verifiedFactors.length > 0) {
        setFactorId(verifiedFactors[0].id);
      } else {
        // Fallback: no verified factors found even though AAL2 expected
        setError('No active 2FA factors found. Please sign in again.');
      }
    } catch (err: any) {
      console.error('[MFA] Error fetching factors:', err);
      setError(err.message || 'Failed to initialize 2FA verification.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!factorId) {
      Alert.alert('Error', 'No 2FA factor identified. Please restart the sign-in process.');
      return;
    }
    if (code.trim().length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit code.');
      return;
    }

    try {
      setVerifying(true);
      setError(null);

      // Challenge and verify the AAL1 session to upgrade to AAL2
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: code.trim(),
      });

      if (verifyError) {
        setError(verifyError.message);
        Alert.alert('Verification Failed', verifyError.message);
      } else {
        // Success! Upgrade AAL2 complete. Session context updates.
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      console.error('[MFA] Challenge and verify failed:', err);
      setError(err.message || 'An unexpected error occurred during verification.');
    } finally {
      setVerifying(false);
    }
  };

  const handleCancel = async () => {
    try {
      setLoading(true);
      await signOut();
      router.replace('/auth/login');
    } catch (err) {
      router.replace('/auth/login');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={[styles.inner, { paddingTop: insets.top + SPACING.xl }]}>
        <TouchableOpacity style={styles.back} onPress={handleCancel}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.logoArea}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>A</Text>
          </View>
          <Text style={styles.appName}>ANIMEHUB</Text>
          <Text style={styles.tagline}>// Security Check</Text>
        </View>

        <Text style={styles.title}>2FA VERIFICATION</Text>
        <Text style={styles.subtitle}>ENTER YOUR SECURITY CODE</Text>

        {loading ? (
          <View style={{ marginVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={COLORS.neon} />
            <Text style={{ color: COLORS.textMuted, marginTop: 12 }}>Loading security settings...</Text>
          </View>
        ) : (
          <>
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="warning-outline" size={14} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.form}>
              <View style={styles.inputWrap}>
                <Text style={styles.label}>6-DIGIT CODE</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.textMuted} />
                  <TextInput
                    style={[styles.input, { textAlign: 'center', fontSize: 24, letterSpacing: 8 }]}
                    placeholder="000000"
                    placeholderTextColor={COLORS.textMuted}
                    value={code}
                    onChangeText={(val) => setCode(val.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!verifying}
                    autoFocus
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.loginBtn, verifying && styles.loginBtnDisabled]}
                onPress={handleVerify}
                disabled={verifying || !factorId}
              >
                {verifying ? (
                  <ActivityIndicator color={COLORS.bg} />
                ) : (
                  <Text style={styles.loginBtnText}>VERIFY</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                <Text style={styles.cancelBtnText}>CANCEL SIGN IN</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  inner: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl },
  back: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  logoArea: { alignItems: 'center', marginBottom: SPACING.xl },
  logoBox: {
    width: 50, height: 50, borderRadius: RADIUS.md,
    backgroundColor: COLORS.neon,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.sm,
    shadowColor: COLORS.neon, shadowOpacity: 0.5, shadowRadius: 10,
  },
  logoText: { fontSize: 28, color: COLORS.bg, fontWeight: '900' },
  appName: { fontSize: 24, color: COLORS.text, fontWeight: '900', letterSpacing: 2 },
  tagline: { fontSize: 10, color: COLORS.neon, fontWeight: '700', letterSpacing: 2 },

  title: { fontSize: 20, color: COLORS.text, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginTop: 4, letterSpacing: 1 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,45,120,0.1)',
    padding: SPACING.sm, borderRadius: RADIUS.sm,
    marginTop: SPACING.md, borderWidth: 1, borderColor: 'rgba(255,45,120,0.2)',
  },
  errorText: { color: COLORS.danger, fontSize: 12, fontWeight: '600', flex: 1 },

  form: { marginTop: SPACING.xl, gap: SPACING.lg },
  inputWrap: { gap: SPACING.xs },
  label: { fontSize: 10, color: COLORS.textSub, fontWeight: '700', letterSpacing: 1.5, marginLeft: 4 },
  inputBox: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, height: 52,
  },
  input: { flex: 1, color: COLORS.text, fontSize: 15, fontWeight: '500' },

  loginBtn: {
    height: 52, backgroundColor: COLORS.neon,
    borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
    marginTop: SPACING.sm,
    shadowColor: COLORS.neon, shadowOpacity: 0.3, shadowRadius: 8,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: COLORS.bg, fontSize: 15, fontWeight: '800', letterSpacing: 1 },

  cancelBtn: {
    height: 52, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.bgCard,
    marginTop: 10,
  },
  cancelBtnText: { color: COLORS.textSub, fontSize: 14, fontWeight: '700', letterSpacing: 1 },
});
