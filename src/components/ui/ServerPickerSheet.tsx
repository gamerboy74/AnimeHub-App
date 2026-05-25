import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import type { Server, ServerLang } from '../../hooks/useServerSelection';

// ─── Props ────────────────────────────────────────────────────────────────────
interface ServerPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  servers: Server[];
  grouped: Record<ServerLang, Server[]>;
  availableLangs: ServerLang[];
  selectedLang: ServerLang;
  selectedIndex: number;
  onSelectLang: (lang: ServerLang) => void;
  onSelectServer: (index: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ServerPickerSheet({
  visible,
  onClose,
  grouped,
  availableLangs,
  selectedLang,
  selectedIndex,
  onSelectLang,
  onSelectServer,
}: ServerPickerSheetProps) {
  const filteredServers = grouped[selectedLang] ?? [];
  const { height } = useWindowDimensions();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop — tap to dismiss */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Sheet / Modal */}
      <View style={styles.modalContainer} pointerEvents="box-none">
        <BlurView
          intensity={65}
          tint="dark"
          style={styles.modalContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>SELECT SERVER</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* ── Sub / Dub language tabs ── */}
          {availableLangs.length > 1 && (
            <View style={styles.langRow}>
              {availableLangs.map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.langPill,
                    lang === selectedLang && styles.langPillActive,
                  ]}
                  onPress={() => onSelectLang(lang)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.langPillText,
                      lang === selectedLang && styles.langPillTextActive,
                    ]}
                  >
                    {lang === 'sub' ? '🎌 SUB' : '🔊 DUB'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* ── Server list ── */}
          <ScrollView
            contentContainerStyle={styles.serverList}
            showsVerticalScrollIndicator={false}
          >
            {filteredServers.map((srv, i) => {
              const isActive = i === selectedIndex;
              return (
                <TouchableOpacity
                  key={`${selectedLang}-${i}`}
                  style={[styles.serverRow, isActive && styles.serverRowActive]}
                  onPress={() => {
                    onSelectServer(i);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  {/* Left: status dot + name */}
                  <View style={styles.serverLeft}>
                    <View
                      style={[
                        styles.dot,
                        isActive ? styles.dotActive : styles.dotIdle,
                      ]}
                    />
                    <View>
                      <Text
                        style={[
                          styles.serverName,
                          isActive && { color: COLORS.neonCyan },
                        ]}
                      >
                        {srv.name}
                      </Text>
                      <Text style={styles.serverSub}>
                        {isActive ? 'Now playing' : 'Tap to switch'}
                      </Text>
                    </View>
                  </View>

                  {/* Right: active checkmark */}
                  {isActive && (
                    <View style={styles.activeCheck}>
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={COLORS.neonCyan}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </BlurView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  modalContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: 360,
    height: 280, // Fixed height so tabs never jump when server count changes
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(14,14,17,0.75)',
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.textMuted,
    letterSpacing: 2.5,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Lang tabs ───────────────────────────────────────────────────────────
  langRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  langPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  langPillActive: {
    borderColor: COLORS.neonCyan,
    backgroundColor: 'rgba(0,229,255,0.12)',
  },
  langPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  langPillTextActive: {
    color: COLORS.neonCyan,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 20,
    marginBottom: 12,
  },

  // ── Server rows ─────────────────────────────────────────────────────────
  serverList: {
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  serverRowActive: {
    backgroundColor: 'rgba(0,229,255,0.07)',
    borderColor: 'rgba(0,229,255,0.25)',
  },
  serverLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: COLORS.neonCyan,
    shadowColor: COLORS.neonCyan,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  dotIdle: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  serverName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  serverSub: {
    fontSize: 9,
    fontWeight: '500',
    color: COLORS.textMuted,
    marginTop: 2,
  },
  activeCheck: {
    opacity: 1,
  },
});
