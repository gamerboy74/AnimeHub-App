import { StyleSheet } from 'react-native';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  errorText: { color: COLORS.textSub, fontSize: 16 },
  
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(189,157,255,0.1)',
  },
  headerBackBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.neon, letterSpacing: -0.5, flex: 1 },

  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },
  
  identitySection: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 40 },
  avatarContainer: { position: 'relative' },
  avatarBorder: { 
    position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, 
    borderRadius: 100, opacity: 0.6 
  },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: COLORS.bg },
  editAvatarBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.neon, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: COLORS.bg,
  },
  identityInfo: { flex: 1, minWidth: 0 },
  username: { fontSize: 26, fontWeight: '900', color: COLORS.text, letterSpacing: -1, marginBottom: 6 },
  identityBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  premiumBadge: {
    paddingHorizontal: 12, paddingVertical: 4,
    backgroundColor: 'rgba(191,95,255,0.1)',
    borderRadius: 100, borderWidth: 1, borderColor: 'rgba(191,95,255,0.2)',
    alignSelf: 'flex-start',
  },
  premiumBadgeText: { fontSize: 9, fontWeight: '800', color: COLORS.neon, letterSpacing: 2 },
  joinedText: { fontSize: 13, color: COLORS.textSub, marginTop: 4 },

  freeFeatureList: { gap: 10, marginBottom: 24 },
  freeFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  freeFeatureText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },

  bentoCard: {
    padding: 24, borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(25,25,29,0.4)',
    borderWidth: 1, borderColor: 'rgba(189,157,255,0.05)',
    marginBottom: 20,
  },
  bentoGlow: {
    position: 'absolute', top: -40, right: -40,
    width: 120, height: 120, backgroundColor: COLORS.neon,
    borderRadius: 60, opacity: 0.05,
  } as any,
  bentoHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  bentoTitle: { fontSize: 24, fontWeight: '900', color: COLORS.text, marginBottom: 4 },
  bentoSub: { fontSize: 13, color: COLORS.textSub, maxWidth: '80%' },
  
  bentoStats: { flexDirection: 'row', gap: 20, marginBottom: 24 },
  bentoStat: {
    flex: 1, padding: 16, backgroundColor: 'rgba(19,19,22,0.5)',
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.02)',
  },
  statLabel: { fontSize: 9, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: '700', color: COLORS.text },

  bentoActions: { flexDirection: 'column', gap: 10 },
  primaryAction: { borderRadius: 100, overflow: 'hidden' },
  actionGradient: { paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center' },
  primaryActionText: { color: '#000', fontWeight: '800', fontSize: 14 },
  secondaryAction: {
    paddingVertical: 14, alignItems: 'center',
    borderRadius: 100, borderWidth: 1, borderColor: 'rgba(189,157,255,0.15)',
  },
  secondaryActionText: { color: COLORS.text, fontWeight: '700', fontSize: 14 },

  gridRow: { flexDirection: 'row', gap: 20, marginBottom: 20 },
  localizationCard: { flex: 1, padding: 24, borderRadius: RADIUS.lg, backgroundColor: 'rgba(25,25,29,0.4)', borderWidth: 1, borderColor: 'rgba(189,157,255,0.05)' },
  halfCard: { flex: 1, padding: 20, borderRadius: 16, backgroundColor: 'rgba(25,25,29,0.4)', borderWidth: 1, borderColor: 'rgba(189,157,255,0.05)' },

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  cardBody: { gap: 16 },

  actionRow: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowContent: { flex: 1, gap: 2 },
  actionLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  actionSubText: { fontSize: 12, color: COLORS.textMuted },
  actionValue: { fontSize: 12, color: COLORS.textSub, fontWeight: '500' },

  paymentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, backgroundColor: 'rgba(25,25,29,0.5)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(189,157,255,0.1)',
  },
  visaBox: {
    width: 48, height: 32, backgroundColor: '#111', borderRadius: 6,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  visaText: { fontSize: 10, fontWeight: '900', color: COLORS.text, fontStyle: 'italic' },
  cardNum: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  cardExpiry: { fontSize: 8, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1 },
  primaryPill: { paddingHorizontal: 8, paddingVertical: 2, backgroundColor: 'rgba(191,95,255,0.2)', borderRadius: 100, alignSelf: 'center' },
  pillText: { fontSize: 8, fontWeight: '900', color: COLORS.neon },

  addPaymentBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: 'rgba(189,157,255,0.1)',
    borderRadius: 12, marginTop: 4,
  },
  addPaymentText: { fontSize: 12, fontWeight: '700', color: COLORS.textSub },

  preferenceGrid: { gap: 24, marginTop: 10 },
  prefItem: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  prefLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  prefSub: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },

  // Playback toggle row
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 4,
  },
  toggleLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  toggleSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 3, lineHeight: 16 },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    marginTop: 40, paddingVertical: 20,
  },
  signOutText: { fontSize: 14, fontWeight: '900', color: COLORS.danger, letterSpacing: 3 },
  versionText: { textAlign: 'center', fontSize: 10, color: COLORS.textMuted, opacity: 0.5, letterSpacing: 1.5, marginTop: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  modalSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#121214', borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg,
    borderWidth: 1, borderColor: 'rgba(189,157,255,0.1)',
    padding: 24, paddingBottom: 40,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5, marginBottom: 20 },
  modalLabel: { fontSize: 11, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(189,157,255,0.1)',
    color: COLORS.text, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14,
  },
  modalSaveBtn: { marginTop: 24, borderRadius: 100, overflow: 'hidden' },
  modalSaveGradient: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  modalSaveText: { color: '#000', fontWeight: '800', fontSize: 14 },
  uploadImageBtn: { borderRadius: 100, overflow: 'hidden', marginTop: 8 },
  uploadImageGradient: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  uploadImageText: { color: '#000', fontWeight: '800', fontSize: 14 },
  modalDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  dividerText: { marginHorizontal: 16, fontSize: 11, fontWeight: '800', color: COLORS.textMuted },
});
