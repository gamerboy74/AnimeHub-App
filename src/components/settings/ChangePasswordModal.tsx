import React, { useState } from 'react';
import {
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/theme';
import { styles } from '../../screens/settings.styles';
import { useAuth } from '../../context/AuthContext';

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
  hasPassword?: boolean;
}

export default function ChangePasswordModal({ visible, onClose, hasPassword = true }: ChangePasswordModalProps) {
  const { refreshUser } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [updating, setUpdating] = useState(false);

  const handleUpdatePassword = async () => {
    if (!password.trim() || password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match. Please try again.');
      return;
    }

    try {
      setUpdating(true);
      const { error } = await supabase.auth.updateUser({ password: password.trim() });
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        await refreshUser();
        Alert.alert(
          'Success',
          hasPassword
            ? 'Password changed successfully!'
            : 'Password set successfully! You can now sign in using your email and password.'
        );
        setPassword('');
        setConfirmPassword('');
        onClose();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to update password. Please try again.');
    } finally {
      setUpdating(false);
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
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{hasPassword ? 'Change Password' : 'Set Password'}</Text>
          
          {!hasPassword && (
            <View style={{
              flexDirection: 'row', alignItems: 'flex-start', gap: 8,
              backgroundColor: 'rgba(255,165,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,165,0,0.25)',
              padding: 12, borderRadius: 10, marginBottom: 12
            }}>
              <Ionicons name="information-circle" size={18} color="#FFA500" style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 12, color: '#EAEAEA', lineHeight: 17 }}>
                Your account was created via Google and doesn't have a password set yet. Create one below to enable email sign-in.
              </Text>
            </View>
          )}

          <Text style={styles.modalLabel}>{hasPassword ? 'New Password' : 'Create Password'}</Text>
          <View style={{ position: 'relative', justifyContent: 'center' }}>
            <TextInput
              style={[styles.modalInput, { paddingRight: 44 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter at least 6 characters"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              editable={!updating}
            />
            <TouchableOpacity
              style={{ position: 'absolute', right: 12, padding: 6 }}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.modalLabel}>Confirm Password</Text>
          <TextInput
            style={styles.modalInput}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter your password"
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            editable={!updating}
          />
          
          <TouchableOpacity
            style={styles.modalSaveBtn}
            onPress={handleUpdatePassword}
            disabled={updating}
          >
            <LinearGradient
              colors={[COLORS.neon, COLORS.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalSaveGradient}
            >
              <Text style={styles.modalSaveText}>
                {updating
                  ? 'Saving...'
                  : hasPassword
                    ? 'Update Password'
                    : 'Set Password'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
