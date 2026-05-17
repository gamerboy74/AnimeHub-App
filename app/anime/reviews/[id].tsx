import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, SPACING, RADIUS } from '../../../src/constants/theme';
import { reviewAPI } from '../../../src/lib/supabase';
import { useAuth } from '../../../src/context/AuthContext';

export default function ReviewsScreen() {
  const params = useLocalSearchParams();
  const animeId = typeof params.id === 'string' ? params.id : (Array.isArray(params.id) ? params.id[0] : '');
  const animeTitle = typeof params.animeTitle === 'string' ? params.animeTitle : '';
  
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [reviews, setReviews] = useState<any[]>([]);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (animeId) {
      setLoading(true);
      reviewAPI.getByAnime(animeId).then(({ data }) => {
        setReviews(data || []);
        setLoading(false);
      });
    }
  }, [animeId]);

  const handleSubmit = async () => {
    if (!user) { 
      router.push('/auth/login'); 
      return; 
    }
    if (!rating) { 
      Alert.alert('Rate it', 'Please give a rating before submitting.'); 
      return; 
    }
    if (!text.trim()) {
      Alert.alert('Write it', 'Please write a review before submitting.');
      return;
    }
    
    setSubmitting(true);
    try {
      await reviewAPI.upsert(user.id, animeId, rating, text, isSpoiler);
      const { data } = await reviewAPI.getByAnime(animeId);
      setReviews(data || []);
      setRating(0); 
      setText(''); 
      setIsSpoiler(false);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerSub}>// REVIEWS</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{animeTitle}</Text>
        </View>
      </View>

      {/* Write review box */}
      {user && (
        <View style={styles.writeBox}>
          <Text style={styles.writeLabel}>YOUR REVIEW</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(i => (
              <TouchableOpacity key={i} onPress={() => setRating(i)}>
                <Ionicons name={i <= rating ? 'star' : 'star-outline'} size={28} color={COLORS.neonGold} />
              </TouchableOpacity>
            ))}
            <Text style={styles.ratingLabel}>{rating > 0 ? `${rating}/5` : 'Tap to rate'}</Text>
          </View>
          <TextInput
            style={styles.textInput}
            value={text}
            onChangeText={setText}
            placeholder="Write your review..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={500}
          />
          <View style={styles.writeFooter}>
            <TouchableOpacity
              style={[styles.spoilerToggle, isSpoiler && styles.spoilerToggleActive]}
              onPress={() => setIsSpoiler(!isSpoiler)}
            >
              <Ionicons name={isSpoiler ? 'warning' : 'warning-outline'} size={14} color={isSpoiler ? COLORS.neonPink : COLORS.textMuted} />
              <Text style={[styles.spoilerText, isSpoiler && { color: COLORS.neonPink }]}>SPOILER</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} 
              onPress={handleSubmit} 
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color={COLORS.bg} size="small" /> : <Text style={styles.submitText}>SUBMIT</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Reviews list */}
      {loading ? (
        <ActivityIndicator color={COLORS.neon} style={{ marginTop: SPACING.xl }} />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.reviewCard}>
              <View style={styles.reviewTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.users?.username?.[0]?.toUpperCase() || '?'}</Text>
                </View>
                <View style={styles.reviewMeta}>
                  <Text style={styles.reviewUser}>{item.users?.username || 'Anonymous'}</Text>
                  <View style={styles.stars}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <Ionicons key={i} name={i <= (item.rating || 0) ? 'star' : 'star-outline'} size={11} color={COLORS.neonGold} />
                    ))}
                  </View>
                </View>
                <Text style={styles.reviewDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
              </View>
              {item.is_spoiler && (
                <View style={styles.spoilerWarn}>
                  <Ionicons name="warning-outline" size={12} color={COLORS.neonPink} />
                  <Text style={styles.spoilerWarnText}>CONTAINS SPOILERS</Text>
                </View>
              )}
              <Text style={styles.reviewText}>{item.review_text}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No reviews yet. Be the first!</Text>
            </View>
          }
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  headerContent: { flex: 1 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  headerSub: { fontSize: 10, color: COLORS.neon, letterSpacing: 2, fontWeight: '700' },
  headerTitle: { fontSize: 18, color: COLORS.text, fontWeight: '800' },

  writeBox: { margin: SPACING.md, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  writeLabel: { fontSize: 10, color: COLORS.neon, fontWeight: '700', letterSpacing: 2, marginBottom: SPACING.sm },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.sm },
  ratingLabel: { fontSize: 12, color: COLORS.textMuted, marginLeft: SPACING.xs },
  textInput: { color: COLORS.text, fontSize: 14, backgroundColor: COLORS.bg, borderRadius: RADIUS.sm, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, minHeight: 80, textAlignVertical: 'top', marginBottom: SPACING.sm },
  writeFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  spoilerToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border },
  spoilerToggleActive: { borderColor: COLORS.neonPink, backgroundColor: 'rgba(255,45,120,0.1)' },
  spoilerText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '700', letterSpacing: 1 },
  submitBtn: { backgroundColor: COLORS.neon, paddingVertical: 8, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.sm },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: COLORS.bg, fontWeight: '800', fontSize: 12, letterSpacing: 1 },

  list: { padding: SPACING.md, gap: SPACING.md },
  reviewCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  reviewTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(191,95,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.neon },
  avatarText: { fontSize: 13, color: COLORS.neon, fontWeight: '700' },
  reviewMeta: { flex: 1 },
  reviewUser: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  stars: { flexDirection: 'row', gap: 1, marginTop: 2 },
  reviewDate: { fontSize: 11, color: COLORS.textMuted },
  spoilerWarn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: SPACING.xs },
  spoilerWarnText: { fontSize: 10, color: COLORS.neonPink, fontWeight: '700', letterSpacing: 1 },
  reviewText: { fontSize: 14, color: COLORS.textSub, lineHeight: 20 },
  empty: { alignItems: 'center', paddingVertical: SPACING.xl },
  emptyText: { fontSize: 13, color: COLORS.textMuted },
});
