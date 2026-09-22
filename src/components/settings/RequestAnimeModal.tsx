import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { COLORS, RADIUS, SPACING, TOUCH } from '../../constants/theme';
import { requestAPI } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { haptic } from '../../lib/haptics';

interface RequestAnimeModalProps {
  visible: boolean;
  onClose: () => void;
  prefillTitle?: string;
}

// ─── Animated upvote row ───────────────────────────────────────────────────
function RequestRow({
  req,
  isUpvoted,
  onUpvote,
}: {
  req: any;
  isUpvoted: boolean;
  onUpvote: (id: string) => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (isUpvoted) return;
    haptic.selection();
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.4, useNativeDriver: true, speed: 45 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();
    onUpvote(req.id);
  };

  const onPressIn  = () => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 40 }).start();

  return (
    <Animated.View style={[styles.requestRowCard, { transform: [{ scale }] }]}>
      <View style={styles.requestRowLeft}>
        <Text style={styles.requestRowTitle}>
          {req.title}
        </Text>
        <View style={styles.votePill}>
          <Text style={styles.votePillText}>⚡ {req.vote_count} votes</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.rowUpvoteBtn, isUpvoted && styles.rowUpvoteBtnActive]}
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isUpvoted}
        activeOpacity={1}
      >
        <Animated.View style={{ transform: [{ scale: heartScale }] }}>
          <Ionicons
            name={isUpvoted ? 'heart' : 'heart-outline'}
            size={14}
            color={isUpvoted ? '#fff' : COLORS.neon}
          />
        </Animated.View>
        <Text style={[styles.rowUpvoteBtnText, isUpvoted && styles.rowUpvoteBtnTextActive]}>
          {isUpvoted ? 'Voted' : 'Boost'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────
function OrDivider() {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>OR SUBMIT NEW</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

// ─── Labelled input wrapper ───────────────────────────────────────────────────
function FieldLabel({ label, optional }: { label: string; optional?: boolean }) {
  return (
    <View style={styles.fieldLabelRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {optional && <Text style={styles.fieldLabelOptional}> · optional</Text>}
    </View>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export default function RequestAnimeModal({
  visible,
  onClose,
  prefillTitle = '',
}: RequestAnimeModalProps) {
  const { user } = useAuth();

  const [title, setTitle]     = useState(prefillTitle);
  const [debouncedTitle, setDebouncedTitle] = useState(prefillTitle);
  const [malId, setMalId]     = useState('');
  const [notes, setNotes]     = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [topRequests, setTopRequests]   = useState<any[]>([]);
  const [upvotedIds, setUpvotedIds]     = useState<string[]>([]);
  const [titleFocused, setTitleFocused] = useState(false);
  const [malFocused, setMalFocused]     = useState(false);
  const [notesFocused, setNotesFocused] = useState(false);
  const [showAllRequests, setShowAllRequests] = useState(false);

  // sheet slide-up
  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  // success bounce
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setTitle(prefillTitle);
      setDebouncedTitle(prefillTitle);
      setMalId('');
      setNotes('');
      setSubmitted(false);
      setShowAllRequests(false);
      bounceAnim.setValue(0);
      slideAnim.setValue(40);
      fadeAnim.setValue(0);

      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 10 }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();

      fetchTopRequests();

      // Load stored upvotes persistently
      const loadUpvotes = async () => {
        try {
          const stored = await AsyncStorage.getItem('animehub_upvoted_request_ids');
          if (stored) {
            setUpvotedIds(JSON.parse(stored));
          }
        } catch (e) {
          console.error('Error loading persistent upvotes:', e);
        }
      };
      loadUpvotes();
    }
  }, [visible, prefillTitle]);

  useEffect(() => {
    if (submitted) {
      Animated.spring(bounceAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 55,
        friction: 6,
      }).start();
    }
  }, [submitted]);

  // Debounce duplicate scanner to allow clean user typing experience
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTitle(title.trim());
    }, 750);
    return () => clearTimeout(handler);
  }, [title]);

  const fetchTopRequests = async () => {
    try {
      const { data, error } = await requestAPI.getTopRequests(15);
      if (!error && data) setTopRequests(data);
    } catch (e) {
      console.error('Error fetching top requests:', e);
    }
  };

  const handleUpvote = async (requestId: string) => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to upvote requests.');
      return;
    }
    if (upvotedIds.includes(requestId)) return;

    setUpvotedIds(prev => [...prev, requestId]);
    setTopRequests(prev =>
      prev.map(r => (r.id === requestId ? { ...r, vote_count: r.vote_count + 1 } : r))
    );

    try {
      const { error } = await requestAPI.upvote(requestId);
      if (error) {
        setUpvotedIds(prev => prev.filter(id => id !== requestId));
        setTopRequests(prev =>
          prev.map(r => (r.id === requestId ? { ...r, vote_count: r.vote_count - 1 } : r))
        );
        Alert.alert('Error', 'Could not upvote. Please try again.');
      } else {
        // Persist to local storage
        try {
          const stored = await AsyncStorage.getItem('animehub_upvoted_request_ids');
          const currentList = stored ? JSON.parse(stored) : [];
          if (!currentList.includes(requestId)) {
            const newList = [...currentList, requestId];
            await AsyncStorage.setItem('animehub_upvoted_request_ids', JSON.stringify(newList));
          }
        } catch (e) {
          console.error('Error saving persistent upvote:', e);
        }
      }
    } catch {
      setUpvotedIds(prev => prev.filter(id => id !== requestId));
      setTopRequests(prev =>
        prev.map(r => (r.id === requestId ? { ...r, vote_count: r.vote_count - 1 } : r))
      );
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to request anime.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter the anime title you want added.');
      return;
    }

    const parsedMalId = malId.trim() ? parseInt(malId.trim(), 10) : null;
    if (malId.trim() && (isNaN(parsedMalId!) || parsedMalId! <= 0)) {
      Alert.alert('Invalid MAL ID', 'MyAnimeList ID must be a positive number. Leave blank if unsure.');
      return;
    }

    setLoading(true);
    haptic.medium();
    try {
      const { error } = await requestAPI.submit(user.id, title.trim(), parsedMalId, notes.trim());

      if (error) {
        if (error.code === '23505') {
          Alert.alert(
            'Already Requested',
            `You already submitted a request for "${title.trim()}". We'll notify you when it's added! 🎉`,
          );
          onClose();
          return;
        }
        throw error;
      }
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not submit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const hasDuplicate =
    debouncedTitle.length > 2 &&
    topRequests.some(r => r.title.toLowerCase().includes(debouncedTitle.toLowerCase()));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.wrapper}
      >
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetOuter,
            { transform: [{ translateY: slideAnim }], opacity: fadeAnim },
          ]}
        >
          <BlurView intensity={80} tint="dark" style={styles.sheet}>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.kicker}>REQUEST AN ANIME</Text>
                <Text style={styles.title}>Can't find what you want?</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  haptic.selection();
                  onClose();
                }}
                style={styles.closeBtn}
                hitSlop={TOUCH.hitSlop}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            {submitted ? (
              /* ── Success ─────────────────────────────────────────────── */
              <View style={styles.successContainer}>
                <Animated.View
                  style={[
                    styles.successCircle,
                    {
                      transform: [
                        {
                          scale: bounceAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.4, 1],
                          }),
                        },
                      ],
                      opacity: bounceAnim,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={[COLORS.neon, '#FF2D78']}
                    style={styles.successGradient}
                  >
                    <Ionicons name="checkmark" size={38} color="#fff" />
                  </LinearGradient>
                </Animated.View>

                <Text style={styles.successTitle}>Request Submitted! 🎉</Text>
                <Text style={styles.successBody}>
                  We got your request for{' '}
                  <Text style={{ color: COLORS.neon, fontWeight: '800' }}>"{title}"</Text>.{'\n'}
                  We'll notify you as soon as it's available.
                </Text>

                <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
                  <LinearGradient
                    colors={[COLORS.neon, '#FF2D78']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.doneBtnGradient}
                  >
                    <Text style={styles.doneBtnText}>DONE</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              /* ── Form ────────────────────────────────────────────────── */
              <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Community upvote section */}
                {topRequests.length > 0 && (
                  <View style={styles.communitySection}>
                    <Text style={styles.communityKicker}>🔥 OTHERS ALSO WANT...</Text>
                    <Text style={styles.communitySub}>
                      Tap a heart to boost an existing request
                    </Text>
                    <View style={{ gap: 8, marginTop: 10 }}>
                      {topRequests.slice(0, showAllRequests ? undefined : 3).map(req => (
                        <RequestRow
                          key={req.id}
                          req={req}
                          isUpvoted={upvotedIds.includes(req.id)}
                          onUpvote={handleUpvote}
                        />
                      ))}
                    </View>
                    {topRequests.length > 3 && (
                      <TouchableOpacity
                        style={styles.showMoreBtn}
                        onPress={() => setShowAllRequests(!showAllRequests)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.showMoreBtnText}>
                          {showAllRequests ? 'SHOW LESS' : `SEE ALL ${topRequests.length} REQUESTS`}
                        </Text>
                        <Ionicons
                          name={showAllRequests ? 'chevron-up' : 'chevron-down'}
                          size={12}
                          color={COLORS.neon}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <OrDivider />

                {/* Title field */}
                <FieldLabel label="Anime Title" />
                <View style={[styles.inputWrap, titleFocused && styles.inputWrapFocused]}>
                  <Ionicons name="tv-outline" size={17} color={COLORS.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. Mushoku Tensei Season 3"
                    placeholderTextColor={COLORS.textMuted}
                    editable={!loading}
                    returnKeyType="next"
                    autoCapitalize="words"
                    onFocus={() => setTitleFocused(true)}
                    onBlur={() => setTitleFocused(false)}
                  />
                  {title.length > 0 && (
                    <TouchableOpacity onPress={() => setTitle('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Duplicate detection */}
                {hasDuplicate && (
                  <View style={styles.matchBanner}>
                    <Ionicons name="sparkles" size={14} color="#00E5C8" />
                    <Text style={styles.matchText}>
                      Someone already requested this — upvote it above instead!
                    </Text>
                  </View>
                )}

                {/* MAL ID field */}
                <FieldLabel label="MyAnimeList ID" optional />
                <View style={[styles.inputWrap, malFocused && styles.inputWrapFocused]}>
                  <Ionicons name="link-outline" size={17} color={COLORS.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={malId}
                    onChangeText={setMalId}
                    placeholder="e.g. 51179"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                    editable={!loading}
                    returnKeyType="next"
                    onFocus={() => setMalFocused(true)}
                    onBlur={() => setMalFocused(false)}
                  />
                </View>
                <Text style={styles.hint}>
                  Find the ID in the MAL URL — helps us add the right show faster.
                </Text>

                {/* Notes field */}
                <FieldLabel label="Additional Notes" optional />
                <View style={[styles.inputWrap, styles.inputWrapMultiline, notesFocused && styles.inputWrapFocused]}>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Season, dub preference, anything helps…"
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                    numberOfLines={3}
                    editable={!loading}
                    textAlignVertical="top"
                    onFocus={() => setNotesFocused(true)}
                    onBlur={() => setNotesFocused(false)}
                  />
                </View>

                {/* Submit */}
                <TouchableOpacity
                  style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={loading ? ['#333', '#2a2a2a'] : [COLORS.neon, '#FF2D78']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.submitGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="paper-plane-outline" size={17} color="#fff" />
                        <Text style={styles.submitText}>SEND REQUEST</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={styles.footerNote}>
                  Popular requests get reviewed first 🚀
                </Text>
              </ScrollView>
            )}
          </BlurView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheetOuter: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
    backgroundColor: 'rgba(10,10,18,0.97)',
    borderTopWidth: 1,
    borderColor: 'rgba(255,43,60,0.2)',
  },

  handle: {
    width: 36, height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: SPACING.lg,
  },

  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.neon,
    letterSpacing: 3,
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 38, height: 38,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Community section ──
  communitySection: {
    marginBottom: 4,
  },
  communityKicker: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.neon,
    letterSpacing: 2.5,
  },
  communitySub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },

  // ── Request Row Card ──
  requestRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161624',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,43,60,0.12)',
    padding: 12,
    gap: 12,
  },
  requestRowLeft: {
    flex: 1,
    gap: 6,
  },
  requestRowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 18,
  },
  votePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,229,200,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.2)',
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  votePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#00E5C8',
  },
  rowUpvoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,43,60,0.08)',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,43,60,0.25)',
    minWidth: 76,
  },
  rowUpvoteBtnActive: {
    backgroundColor: COLORS.neon,
    borderColor: COLORS.neon,
  },
  rowUpvoteBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.neon,
    letterSpacing: 0.5,
  },
  rowUpvoteBtnTextActive: {
    color: '#fff',
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 6,
  },
  showMoreBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.neon,
    letterSpacing: 1.5,
  },

  // ── Divider ──
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,43,60,0.12)',
  },
  dividerText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 2,
  },

  // ── Field label ──
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: SPACING.md,
    marginBottom: 7,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  fieldLabelOptional: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textMuted,
    letterSpacing: 0,
    textTransform: 'none',
  },

  // ── Inputs ──
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161626',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,43,60,0.15)',
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 13 : 3,
  },
  inputWrapFocused: {
    borderColor: 'rgba(255,43,60,0.45)',
    backgroundColor: '#1a1a2e',
  },
  inputWrapMultiline: {
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  inputMultiline: {
    minHeight: 72,
    paddingTop: 4,
  },
  hint: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 5,
    marginLeft: 2,
    lineHeight: 15,
  },

  // ── Match banner ──
  matchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(0,229,200,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,200,0.18)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginTop: 8,
  },
  matchText: {
    fontSize: 11,
    color: COLORS.textSub,
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },

  // ── Submit ──
  submitBtn: {
    marginTop: SPACING.xl,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  submitBtnDisabled: {
    opacity: 0.55,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
  },
  submitText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.5,
  },
  footerNote: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.md,
    lineHeight: 18,
  },

  // ── Scroll ──
  scrollContainer: {
    maxHeight: 480,
  },
  scrollContent: {
    paddingBottom: 8,
  },

  // ── Success ──
  successContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.md,
  },
  successCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    overflow: 'hidden',
    marginBottom: 4,
  },
  successGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  successBody: {
    fontSize: 14,
    color: COLORS.textSub,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING.md,
  },
  doneBtn: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    width: 160,
  },
  doneBtnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.5,
  },
});
