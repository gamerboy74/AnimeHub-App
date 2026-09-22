import React, { useState } from 'react';
import {
  Modal,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/theme';
import { styles } from '../../screens/settings.styles';

interface LogOutOthersModalProps {
  visible: boolean;
  onClose: () => void;
  t: (key: any) => string;
}

export default function LogOutOthersModal({ visible, onClose, t }: LogOutOthersModalProps) {
  const insets = useSafeAreaInsets();
  const { logOutOtherSessions } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogOutOthers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Securely revokes all other sessions server-side and broadcasts instant logout to other devices,
      // while keeping the current device active and authenticated.
      const res = await logOutOtherSessions();
      if (res?.error) throw res.error;

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error('[LogOutOthers] Error logging out other sessions:', err);
      setError(err?.message || 'Failed to log out other devices. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[
          styles.modalSheet, 
          { 
            paddingBottom: Math.max(insets.bottom, 24) 
          }
        ]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{t('logOutOthersTitle') || 'Log Out Other Devices?'}</Text>

          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={COLORS.danger} />
              <Text style={{ color: COLORS.textMuted, marginTop: 12 }}>Logging out other devices...</Text>
            </View>
          ) : success ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.success} />
              <Text style={{ color: COLORS.text, marginTop: 12, fontSize: 15, fontWeight: '600', textAlign: 'center' }}>
                {t('logOutOthersSuccess') || 'Other devices logged out successfully!'}
              </Text>
            </View>
          ) : (
            <View style={{ width: '100%', alignItems: 'stretch' }}>
              {error ? (
                <View style={localStyles.errorBox}>
                  <Ionicons name="warning-outline" size={14} color={COLORS.danger} />
                  <Text style={localStyles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Text style={{ color: COLORS.textSub, fontSize: 13, textAlign: 'center', marginBottom: 24, lineHeight: 18 }}>
                {t('logOutOthersSub') || 'This signs out your account from all other apps, tablets, and devices. You will remain logged in on this device.'}
              </Text>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleLogOutOthers}
              >
                <LinearGradient
                  colors={[COLORS.danger, '#ff7346']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalSaveGradient}
                >
                  <Text style={[styles.modalSaveText, { color: '#fff' }]}>
                    {t('logOut') || 'Log Out'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, { marginTop: 12, backgroundColor: 'transparent' }]}
                onPress={onClose}
              >
                <View style={[styles.modalSaveGradient, { backgroundColor: 'transparent' }]}>
                  <Text style={{ color: COLORS.textSub, fontWeight: '700', fontSize: 14 }}>
                    {t('cancel')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const localStyles = {
  errorBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: 'rgba(255,45,120,0.08)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,45,120,0.2)',
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '600' as const,
    flex: 1,
  }
};
