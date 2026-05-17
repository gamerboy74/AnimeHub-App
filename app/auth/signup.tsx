import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async () => {
    if (!username || !email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: signUpError } = await signUp(email, password, username);
      if (signUpError) setError(signUpError.message);
      else {
        // Success - usually Supabase sends a confirmation email or auto-logs in
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
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
          <Text style={styles.tagline}>// JOIN THE UNIVERSE</Text>
        </View>

        <Text style={styles.title}>CREATE ACCOUNT</Text>
        <Text style={styles.subtitle}>START YOUR JOURNEY</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={14} color={COLORS.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.inputWrap}>
            <Text style={styles.label}>USERNAME</Text>
            <View style={styles.inputBox}>
              <Ionicons name="person-outline" size={18} color={COLORS.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Pick a username"
                placeholderTextColor={COLORS.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>
          </View>

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
              />
            </View>
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputBox}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Create a password"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.signupBtn, loading && styles.signupBtnDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.bg} />
            ) : (
              <Text style={styles.signupBtnText}>SIGN UP</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.push('/auth/login')}>
            <Text style={styles.footerLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
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
    backgroundColor: COLORS.neonPulse || COLORS.neon,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.sm,
    shadowColor: COLORS.neonPulse || COLORS.neon, shadowOpacity: 0.5, shadowRadius: 10,
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
  errorText: { color: COLORS.danger, fontSize: 12, fontWeight: '600' },

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

  signupBtn: {
    height: 52, backgroundColor: COLORS.neon,
    borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
    marginTop: SPACING.sm,
    shadowColor: COLORS.neon, shadowOpacity: 0.3, shadowRadius: 8,
  },
  signupBtnDisabled: { opacity: 0.6 },
  signupBtnText: { color: COLORS.bg, fontSize: 15, fontWeight: '800', letterSpacing: 1 },

  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: SPACING.xl },
  footerText: { fontSize: 14, color: COLORS.textMuted },
  footerLink: { fontSize: 14, color: COLORS.neon, fontWeight: '700' },
});
