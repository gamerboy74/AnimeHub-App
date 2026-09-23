import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, TOUCH } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { userAPI, supabase } from '../../src/lib/supabase';
import { haptic } from '../../src/lib/haptics';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp, signInWithGoogle, session } = useAuth();

  useEffect(() => {
    if (session) {
      setGoogleLoading(false);
      router.replace('/(tabs)');
    }
  }, [session, router]);
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);

  // Username validation state
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [usernameReason, setUsernameReason] = useState<string>('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Format validations
  const cleanUsername = username.trim().toLowerCase();
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isPasswordValid = password.length >= 6;
  const isUsernameAvailable = usernameStatus === 'available';

  // Overall form validity — locked until all conditions pass
  const isFormValid = isUsernameAvailable && isEmailValid && isPasswordValid;

  // Real-time debounced username availability check
  const checkUsername = useCallback((val: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = val.trim().toLowerCase();
    if (!trimmed) {
      setUsernameStatus('idle');
      setUsernameReason('');
      return;
    }

    if (trimmed.length < 3) {
      setUsernameStatus('invalid');
      setUsernameReason('At least 3 characters required');
      return;
    }

    if (trimmed.length > 20) {
      setUsernameStatus('invalid');
      setUsernameReason('Maximum 20 characters allowed');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setUsernameStatus('invalid');
      setUsernameReason('Letters, numbers, and underscores only');
      return;
    }

    setUsernameStatus('checking');
    setUsernameReason('Checking availability…');

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await userAPI.checkUsernameAvailable(trimmed);
        if (res.available) {
          setUsernameStatus('available');
          setUsernameReason('Username is available');
        } else {
          setUsernameStatus('taken');
          setUsernameReason(res.reason || 'Username is already taken');
        }
      } catch {
        setUsernameStatus('invalid');
        setUsernameReason('Unable to verify username');
      }
    }, 380);
  }, []);

  const handleUsernameChange = (text: string) => {
    // Restrict characters immediately to alphanumeric + underscore
    const sanitized = text.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
    setUsername(sanitized);
    checkUsername(sanitized);
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

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

  const handleSignup = async () => {
    if (!isFormValid || loading) {
      haptic.light();
      if (!isUsernameAvailable) {
        setError('Please choose an available username');
      } else if (!isEmailValid) {
        setError('Please enter a valid email address');
      } else if (!isPasswordValid) {
        setError('Password must be at least 6 characters');
      }
      return;
    }

    haptic.medium();
    setLoading(true);
    setError(null);

    try {
      const res = await signUp(email.trim(), password, cleanUsername);
      if (res.error) {
        haptic.light();
        const msg = (res.error.message || '').toLowerCase();
        if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
          setError('Email rate limit reached on Supabase. Please sign up with Google below or turn off "Confirm email" in Supabase settings.');
        } else {
          setError(res.error.message || 'Signup failed. Please try again.');
        }
      } else if (res.needsEmailConfirmation) {
        haptic.success();
        setEmailSentTo(email.trim());
      } else {
        haptic.success();
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      haptic.light();
      const msg = (e.message || '').toLowerCase();
      if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
        setError('Email rate limit reached on Supabase. Please sign up with Google below or turn off "Confirm email" in Supabase settings.');
      } else {
        setError(e.message || 'An unexpected error occurred during signup');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderUsernameStatusIcon = () => {
    switch (usernameStatus) {
      case 'checking':
        return <ActivityIndicator size="small" color={COLORS.textMuted} />;
      case 'available':
        return <Ionicons name="checkmark-circle" size={18} color={COLORS.neon} />;
      case 'taken':
        return <Ionicons name="close-circle" size={18} color={COLORS.danger} />;
      case 'invalid':
        return <Ionicons name="alert-circle" size={18} color="#FFA500" />;
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + SPACING.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back navigation */}
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
          <Text style={styles.tagline}>// JOIN THE UNIVERSE</Text>
        </View>

        {/* Email verification confirmation view */}
        {emailSentTo ? (
          <View style={styles.verificationCard}>
            <View style={styles.verificationIconWrap}>
              <Ionicons name="mail-unread-outline" size={42} color={COLORS.neon} />
            </View>
            <Text style={styles.verificationTitle}>Check Your Inbox</Text>
            <Text style={styles.verificationText}>
              We sent a verification link to <Text style={styles.boldEmail}>{emailSentTo}</Text>.
              Please click the link in your email to activate your account and start watching.
            </Text>

            <TouchableOpacity
              style={styles.signinRedirectBtn}
              onPress={() => {
                haptic.selection();
                router.replace('/auth/login');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.signinRedirectText}>PROCEED TO SIGN IN</Text>
              <Ionicons name="arrow-forward" size={16} color={COLORS.bg} />
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: SPACING.md, padding: SPACING.xs }}
              onPress={() => setEmailSentTo(null)}
            >
              <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>Wrong email? Go back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.title}>CREATE ACCOUNT</Text>
            <Text style={styles.subtitle}>START YOUR ANIME JOURNEY</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="warning-outline" size={15} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.form}>
              {/* Username Input */}
              <View style={styles.inputWrap}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>USERNAME</Text>
                  {usernameReason ? (
                    <Text
                      style={[
                        styles.statusBadgeText,
                        usernameStatus === 'available' && { color: COLORS.neon },
                        usernameStatus === 'taken' && { color: COLORS.danger },
                        usernameStatus === 'invalid' && { color: '#FFA500' },
                      ]}
                    >
                      {usernameReason}
                    </Text>
                  ) : null}
                </View>

                <View
                  style={[
                    styles.inputBox,
                    usernameStatus === 'available' && styles.inputBoxAvailable,
                    usernameStatus === 'taken' && styles.inputBoxTaken,
                    usernameStatus === 'invalid' && styles.inputBoxInvalid,
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={
                      usernameStatus === 'available'
                        ? COLORS.neon
                        : usernameStatus === 'taken'
                        ? COLORS.danger
                        : COLORS.textMuted
                    }
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Pick a unique username"
                    placeholderTextColor={COLORS.textMuted}
                    value={username}
                    onChangeText={handleUsernameChange}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={20}
                  />
                  {renderUsernameStatusIcon()}
                </View>
              </View>

              {/* Email Address Input */}
              <View style={styles.inputWrap}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>EMAIL ADDRESS</Text>
                  {email.length > 0 && !isEmailValid && (
                    <Text style={[styles.statusBadgeText, { color: '#FFA500' }]}>
                      Enter a valid email
                    </Text>
                  )}
                </View>

                <View style={[styles.inputBox, isEmailValid && styles.inputBoxValid]}>
                  <Ionicons
                    name="mail-outline"
                    size={18}
                    color={isEmailValid ? COLORS.neon : COLORS.textMuted}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor={COLORS.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                  />
                  {isEmailValid && (
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.neon} />
                  )}
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputWrap}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>PASSWORD</Text>
                  {password.length > 0 && !isPasswordValid && (
                    <Text style={[styles.statusBadgeText, { color: '#FFA500' }]}>
                      At least 6 characters
                    </Text>
                  )}
                </View>

                <View style={[styles.inputBox, isPasswordValid && styles.inputBoxValid]}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color={isPasswordValid ? COLORS.neon : COLORS.textMuted}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Create a password (min 6 chars)"
                    placeholderTextColor={COLORS.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    textContentType="newPassword"
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
              </View>

              {/* Requirements Checklist */}
              <View style={styles.checklist}>
                <View style={styles.checkItem}>
                  <Ionicons
                    name={isUsernameAvailable ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={isUsernameAvailable ? COLORS.neon : COLORS.textMuted}
                  />
                  <Text style={[styles.checkText, isUsernameAvailable && styles.checkTextActive]}>
                    Username is available & unique
                  </Text>
                </View>

                <View style={styles.checkItem}>
                  <Ionicons
                    name={isEmailValid ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={isEmailValid ? COLORS.neon : COLORS.textMuted}
                  />
                  <Text style={[styles.checkText, isEmailValid && styles.checkTextActive]}>
                    Valid email address
                  </Text>
                </View>

                <View style={styles.checkItem}>
                  <Ionicons
                    name={isPasswordValid ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={isPasswordValid ? COLORS.neon : COLORS.textMuted}
                  />
                  <Text style={[styles.checkText, isPasswordValid && styles.checkTextActive]}>
                    Password at least 6 characters
                  </Text>
                </View>
              </View>

              {/* Locked / Active Create Account Button */}
              <TouchableOpacity
                style={[
                  styles.signupBtn,
                  (!isFormValid || loading) && styles.signupBtnDisabled,
                ]}
                onPress={handleSignup}
                disabled={!isFormValid || loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.bg} />
                ) : (
                  <View style={styles.btnContent}>
                    {!isFormValid && (
                      <Ionicons
                        name="lock-closed"
                        size={16}
                        color="rgba(255,255,255,0.4)"
                        style={{ marginRight: 6 }}
                      />
                    )}
                    <Text
                      style={[
                        styles.signupBtnText,
                        !isFormValid && styles.signupBtnTextDisabled,
                      ]}
                    >
                      {isFormValid ? 'CREATE ACCOUNT' : 'FILL REQUIRED FIELDS'}
                    </Text>
                    {isFormValid && (
                      <Ionicons
                        name="arrow-forward"
                        size={16}
                        color={COLORS.bg}
                        style={{ marginLeft: 6 }}
                      />
                    )}
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.socialBtn}
              onPress={handleGoogle}
              disabled={googleLoading}
              activeOpacity={0.85}
            >
              {googleLoading ? (
                <ActivityIndicator color={COLORS.text} size="small" />
              ) : (
                <Ionicons name="logo-google" size={18} color={COLORS.text} />
              )}
              <Text style={styles.socialBtnText}>
                {googleLoading ? 'Opening Google…' : 'Continue with Google'}
              </Text>
            </TouchableOpacity>

            {/* Modal Swap to Sign In */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <TouchableOpacity
                hitSlop={TOUCH.hitSlop}
                onPress={() => {
                  haptic.selection();
                  router.replace('/auth/login');
                }}
              >
                <Text style={styles.footerLink}>Sign In</Text>
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
  inner: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxl },
  back: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  logoArea: { alignItems: 'center', marginBottom: SPACING.lg },
  logoBox: {
    width: 48, height: 48, borderRadius: RADIUS.md,
    backgroundColor: COLORS.neonPulse || COLORS.neon,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.xs,
    shadowColor: COLORS.neonPulse || COLORS.neon, shadowOpacity: 0.5, shadowRadius: 10,
  },
  logoText: { fontSize: 26, color: '#000000', fontWeight: '900' },
  appName: { fontSize: 22, color: COLORS.text, fontWeight: '900', letterSpacing: 2 },
  tagline: { fontSize: 9, color: COLORS.neon, fontWeight: '800', letterSpacing: 2, marginTop: 2 },

  title: { fontSize: 20, color: COLORS.text, fontWeight: '900', textAlign: 'center' },
  subtitle: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center', marginTop: 4, letterSpacing: 1 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,45,120,0.12)',
    padding: SPACING.sm, borderRadius: RADIUS.sm,
    marginTop: SPACING.md, borderWidth: 1, borderColor: 'rgba(255,45,120,0.3)',
  },
  errorText: { color: COLORS.danger, fontSize: 12, fontWeight: '600', flex: 1 },

  form: { marginTop: SPACING.lg, gap: SPACING.md },
  inputWrap: { gap: SPACING.xs },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  label: { fontSize: 10, color: COLORS.textSub, fontWeight: '800', letterSpacing: 1.5 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },

  inputBox: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, height: 50,
  },
  inputBoxAvailable: {
    borderColor: 'rgba(0, 245, 180, 0.4)',
    backgroundColor: 'rgba(0, 245, 180, 0.03)',
  },
  inputBoxValid: {
    borderColor: 'rgba(0, 245, 180, 0.25)',
  },
  inputBoxTaken: {
    borderColor: 'rgba(255, 45, 120, 0.5)',
    backgroundColor: 'rgba(255, 45, 120, 0.04)',
  },
  inputBoxInvalid: {
    borderColor: 'rgba(255, 165, 0, 0.4)',
  },
  input: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: '500' },

  checklist: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    padding: SPACING.sm, gap: 6, marginTop: SPACING.xs,
  },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  checkTextActive: { color: COLORS.text, fontWeight: '700' },

  signupBtn: {
    height: 52, backgroundColor: COLORS.neon,
    borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
    marginTop: SPACING.xs,
    shadowColor: COLORS.neon, shadowOpacity: 0.35, shadowRadius: 10,
  },
  signupBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    shadowOpacity: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  btnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  signupBtnText: { color: COLORS.bg, fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  signupBtnTextDisabled: { color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginVertical: SPACING.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '700' },

  socialBtn: {
    height: 50, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.md,
    backgroundColor: COLORS.bgCard,
  },
  socialBtnText: { color: COLORS.text, fontSize: 13, fontWeight: '700' },

  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: SPACING.lg },
  footerText: { fontSize: 13, color: COLORS.textMuted },
  footerLink: { fontSize: 13, color: COLORS.neon, fontWeight: '800' },

  // Verification View
  verificationCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: 'rgba(0, 245, 180, 0.3)',
    padding: SPACING.xl, alignItems: 'center', marginTop: SPACING.lg,
  },
  verificationIconWrap: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: 'rgba(0, 245, 180, 0.1)',
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md,
  },
  verificationTitle: { fontSize: 19, fontWeight: '900', color: COLORS.text, marginBottom: 8 },
  verificationText: {
    fontSize: 13, color: COLORS.textMuted, textAlign: 'center',
    lineHeight: 20, marginBottom: SPACING.xl,
  },
  boldEmail: { color: COLORS.neon, fontWeight: '800' },
  signinRedirectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.neon, height: 48, borderRadius: RADIUS.md,
    width: '100%',
  },
  signinRedirectText: { color: COLORS.bg, fontSize: 13, fontWeight: '900', letterSpacing: 1 },
});
