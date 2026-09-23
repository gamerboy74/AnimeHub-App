import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, TOUCH } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { supabase, userAPI } from '../../src/lib/supabase';
import { haptic } from '../../src/lib/haptics';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, signInWithGoogle, resetPassword, session } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordNotSet, setPasswordNotSet] = useState(false);

  // Automatically navigate away as soon as an active session is detected
  useEffect(() => {
    if (session) {
      setGoogleLoading(false);
      router.replace('/(tabs)');
    }
  }, [session, router]);

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
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      haptic.light();
      setError('Please enter your email address');
      return;
    }

    if (!password) {
      haptic.light();
      // Check if this account was created via Google and has no password set
      const authStatus = await userAPI.checkEmailAuthStatus(cleanEmail);
      if (authStatus.exists && !authStatus.hasPassword) {
        setPasswordNotSet(true);
        setError('Password not set for this account. You registered with Google.');
        return;
      }
      setError('Please enter your password');
      return;
    }

    haptic.medium();
    setLoading(true);
    setError(null);
    setPasswordNotSet(false);

    try {
      const { error: signInError } = await signIn(cleanEmail, password);
      if (signInError) {
        haptic.light();
        // Check if user exists and has no password set (e.g. Google OAuth account)
        const authStatus = await userAPI.checkEmailAuthStatus(cleanEmail);
        if (authStatus.exists && !authStatus.hasPassword) {
          setPasswordNotSet(true);
          setError('Password not set for this account. This account was registered with Google.');
        } else {
          setError(signInError.message);
        }
      } else {
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      haptic.light();
      setError(e.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    haptic.selection();
    setGoogleLoading(true);
    setError(null);
    try {
      const { error: googleError } = await signInWithGoogle();
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      if (activeSession) {
        setGoogleLoading(false);
        router.replace('/(tabs)');
        return;
      }
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
      haptic.light();
      setForgotError('Please enter your email address');
      return;
    }
    haptic.selection();
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
        <TouchableOpacity
          style={styles.back}
          hitSlop={TOUCH.hitSlop}
          activeOpacity={0.7}
          onPress={() => {
            haptic.selection();
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)');
          }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
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

        {/* Password Not Set Banner */}
        {passwordNotSet ? (
          <View style={styles.passwordNotSetBox}>
            <View style={styles.passwordNotSetHeader}>
              <Ionicons name="information-circle" size={20} color="#FFA500" />
              <Text style={styles.passwordNotSetTitle}>Password Not Set</Text>
            </View>
            <Text style={styles.passwordNotSetText}>
              This account was registered using Google sign-in and does not have a password set.
            </Text>
            <TouchableOpacity
              style={styles.googleActionBtn}
              onPress={handleGoogle}
              activeOpacity={0.85}
              disabled={googleLoading}
            >
              <Ionicons name="logo-google" size={16} color="#FFFFFF" />
              <Text style={styles.googleActionBtnText}>Sign In with Google</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.forgotActionBtn}
              onPress={() => {
                setForgotEmail(email);
                setForgotVisible(true);
              }}
            >
              <Text style={styles.forgotActionBtnText}>Or set a password via email link →</Text>
            </TouchableOpacity>
          </View>
        ) : error ? (
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
                onChangeText={(text) => {
                  setEmail(text);
                  setPasswordNotSet(false);
                }}
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
                onChangeText={(text) => {
                  setPassword(text);
                  setPasswordNotSet(false);
                }}
                secureTextEntry={!showPassword}
                textContentType="password"
                autoComplete="password"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={TOUCH.hitSlop}
                style={{ padding: 4 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
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
          <TouchableOpacity
            hitSlop={TOUCH.hitSlop}
            onPress={() => {
              haptic.selection();
              router.replace('/auth/signup');
            }}
          >
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
              hitSlop={TOUCH.hitSlop}
              activeOpacity={0.7}
              onPress={() => {
                haptic.selection();
                setForgotVisible(false);
                setForgotSuccess(false);
                setForgotError(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Close"
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
                    <ActivityIndicator color="#FFFFFF" />
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
  logoText: { fontSize: 28, color: '#FFFFFF', fontWeight: '900' },
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

  // Password Not Set Alert Box
  passwordNotSetBox: {
    backgroundColor: 'rgba(255, 165, 0, 0.08)',
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(255, 165, 0, 0.3)',
    padding: SPACING.md, marginTop: SPACING.md, gap: 10,
  },
  passwordNotSetHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  passwordNotSetTitle: {
    color: '#FFA500', fontSize: 14, fontWeight: '800', letterSpacing: 0.5,
  },
  passwordNotSetText: {
    color: COLORS.textSub, fontSize: 12, lineHeight: 18,
  },
  googleActionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#DB4437', height: 42, borderRadius: RADIUS.sm,
    marginTop: 2,
  },
  googleActionBtnText: {
    color: '#FFFFFF', fontSize: 13, fontWeight: '800',
  },
  forgotActionBtn: {
    alignSelf: 'center', paddingVertical: 4,
  },
  forgotActionBtnText: {
    color: COLORS.neon, fontSize: 12, fontWeight: '700',
  },

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
  loginBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 1 },

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
