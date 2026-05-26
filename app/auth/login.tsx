import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, signInWithGoogle, resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, []);

  // Forgot password modal state
  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await signIn(email, password);
      if (signInError) setError(signInError.message);
      else router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const { error: googleError } = await signInWithGoogle();
      if (googleError) {
        // User just cancelled — don't show an error banner
        if (googleError.message !== 'Google sign-in was cancelled') {
          setError(googleError.message);
        }
      } else {
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      setError(e.message || 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your email address');
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    try {
      const { error } = await resetPassword(forgotEmail.trim());
      if (error) setForgotError(error.message);
      else setForgotSuccess(true);
    } catch (e: any) {
      setForgotError(e.message || 'Something went wrong');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={[styles.inner, { paddingTop: insets.top + SPACING.lg }]}>
        {/* Back */}
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>

        {/* Logo area */}
        <View style={styles.logoArea}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>A</Text>
          </View>
          <Text style={styles.appName}>ANIMEHUB</Text>
          <Text style={styles.tagline}>// Your anime universe</Text>
        </View>

        <Text style={styles.title}>SIGN IN</Text>
        <Text style={styles.subtitle}>WELCOME BACK</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={14} color={COLORS.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.inputWrap}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <View style={styles.inputBox}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor={COLORS.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
              />
            </View>
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputBox}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
                autoComplete="password"
              />
            </View>
            <TouchableOpacity style={styles.forgot} onPress={() => { setForgotEmail(email); setForgotVisible(true); }}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.bg} />
            ) : (
              <Text style={styles.loginBtnText}>SIGN IN</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.socialBtn} onPress={handleGoogle} disabled={googleLoading}>
          {googleLoading ? (
            <ActivityIndicator color={COLORS.text} size="small" />
          ) : (
            <Ionicons name="logo-google" size={18} color={COLORS.text} />
          )}
          <Text style={styles.socialBtnText}>
            {googleLoading ? 'Opening Google…' : 'Continue with Google'}
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => router.push('/auth/signup')}>
            <Text style={styles.footerLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Forgot Password Modal ── */}
      <Modal
        visible={forgotVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setForgotVisible(false); setForgotSuccess(false); setForgotError(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => { setForgotVisible(false); setForgotSuccess(false); setForgotError(null); }}
            >
              <Ionicons name="close" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>

            <Ionicons name="lock-open-outline" size={36} color={COLORS.neon} style={{ marginBottom: 12 }} />
            <Text style={styles.modalTitle}>Reset Password</Text>
            <Text style={styles.modalSubtitle}>
              Enter your email and we'll send you a reset link.
            </Text>

            {forgotSuccess ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.neon} />
                <Text style={styles.successText}>
                  Email sent! Check your inbox and follow the link to reset your password.
                </Text>
              </View>
            ) : (
              <>
                {forgotError ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="warning-outline" size={14} color={COLORS.danger} />
                    <Text style={styles.errorText}>{forgotError}</Text>
                  </View>
                ) : null}

                <View style={[styles.inputBox, { marginTop: SPACING.md }]}>
                  <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} />
                  <TextInput
                    style={styles.input}
                    placeholder="your@email.com"
                    placeholderTextColor={COLORS.textMuted}
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.loginBtn, { marginTop: SPACING.md }, forgotLoading && styles.loginBtnDisabled]}
                  onPress={handleForgotPassword}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color={COLORS.bg} />
                  ) : (
                    <Text style={styles.loginBtnText}>SEND RESET LINK</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
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

  successBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(0,245,180,0.08)',
    padding: SPACING.md, borderRadius: RADIUS.sm,
    marginTop: SPACING.md, borderWidth: 1, borderColor: 'rgba(0,245,180,0.2)',
  },
  successText: { color: COLORS.neon, fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 20 },

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
  forgot: { alignSelf: 'flex-end', marginTop: 6 },
  forgotText: { fontSize: 12, color: COLORS.neon, fontWeight: '600' },

  loginBtn: {
    height: 52, backgroundColor: COLORS.neon,
    borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
    marginTop: SPACING.sm,
    shadowColor: COLORS.neon, shadowOpacity: 0.3, shadowRadius: 8,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: COLORS.bg, fontSize: 15, fontWeight: '800', letterSpacing: 1 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginVertical: SPACING.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '700' },

  socialBtn: {
    height: 52, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.md,
    backgroundColor: COLORS.bgCard,
  },
  socialBtnText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },

  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: SPACING.xl },
  footerText: { fontSize: 14, color: COLORS.textMuted },
  footerLink: { fontSize: 14, color: COLORS.neon, fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: SPACING.xl,
  },
  modalCard: {
    width: '100%', backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl, padding: SPACING.xl,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute', top: SPACING.md, right: SPACING.md,
    padding: 4,
  },
  modalTitle: {
    fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 19,
  },
});
