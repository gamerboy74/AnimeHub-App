import React from 'react';
import {
  Modal,
  Text,
  TouchableOpacity,
  View,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { useTranslation } from '../../context/LocalizationContext';

const { height } = Dimensions.get('window');

export interface PickerOption {
  value: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface PickerBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: PickerOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

export default function PickerBottomSheet({
  visible,
  onClose,
  title,
  options,
  selectedValue,
  onSelect,
}: PickerBottomSheetProps) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Semi-transparent dark overlay backdrop */}
      <Pressable style={styles.modalOverlay} onPress={onClose} />
      
      {/* Beautiful Frosted Glass Bottom Sheet */}
      <BlurView intensity={90} tint="dark" style={styles.sortSheet}>
        {/* Futuristic Swipe Handle */}
        <View style={styles.sortHandle} />

        {/* Glow Effects */}
        <View style={styles.neonGlow} />

        {/* Header Title with premium lettering */}
        <Text style={styles.sortSheetTitle}>{title.toUpperCase()}</Text>

        <View style={styles.sortOptions}>
          {options.map((opt) => {
            const isActive = selectedValue === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.sortOptionRow, isActive && styles.sortOptionRowActive]}
                onPress={() => {
                  onSelect(opt.value);
                  onClose();
                }}
                activeOpacity={0.85}
              >
                {/* Glowing option icon */}
                <View style={[styles.sortIconWrap, isActive && styles.sortIconWrapActive]}>
                  <Ionicons 
                    name={opt.icon} 
                    size={18} 
                    color={isActive ? '#080810' : COLORS.neonCyan} 
                  />
                </View>

                {/* Localized Label */}
                <Text style={[styles.sortOptionText, isActive && styles.sortOptionTextActive]}>
                  {opt.label}
                </Text>

                {/* Animated checkmark indicator */}
                {isActive && (
                  <View style={styles.checkIconWrap}>
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
        </View>

        {/* Premium Cyber Close Button */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>{t('cancel').toUpperCase()}</Text>
        </TouchableOpacity>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(4, 4, 8, 0.75)' 
  },
  sortSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: 24,
    paddingBottom: 44,
    backgroundColor: 'rgba(12, 12, 22, 0.94)',
    borderTopWidth: 1.5,
    borderColor: 'rgba(0, 245, 255, 0.25)', // cyber cyan glow border
    overflow: 'hidden',
  },
  neonGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    backgroundColor: COLORS.neonCyan,
    borderRadius: 75,
    opacity: 0.08,
    filter: 'blur(35px)',
  } as any,
  sortHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignSelf: 'center',
    marginBottom: 22,
  },
  sortSheetTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.neonCyan,
    letterSpacing: 3,
    marginBottom: 24,
    textAlign: 'center',
  },
  sortOptions: {
    gap: 12,
  },
  sortOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  sortOptionRowActive: {
    backgroundColor: 'rgba(0, 245, 255, 0.08)',
    borderColor: 'rgba(0, 245, 255, 0.25)',
  },
  sortIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 245, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  sortIconWrapActive: {
    backgroundColor: COLORS.neonCyan,
  },
  sortOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSub,
  },
  sortOptionTextActive: {
    color: COLORS.text,
    fontWeight: '800',
  },
  checkIconWrap: {
    marginLeft: 'auto',
  },
  closeBtn: {
    marginTop: 20,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
  },
  closeBtnText: {
    color: COLORS.textSub,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
