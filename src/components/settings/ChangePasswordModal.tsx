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
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants/theme';
import { styles } from '../../screens/settings.styles';

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ visible, onClose }: ChangePasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
        Alert.alert('Success', 'Password changed successfully!');
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
          <Text style={styles.modalTitle}>Change Password</Text>
          
          <Text style={styles.modalLabel}>New Password</Text>
          <TextInput
            style={styles.modalInput}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter at least 6 characters"
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry
            autoCapitalize="none"
            editable={!updating}
          />
          
          <Text style={styles.modalLabel}>Confirm New Password</Text>
          <TextInput
            style={styles.modalInput}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter your new password"
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry
            autoCapitalize="none"
            editable={!updating}
          />
          
          <TouchableOpacity
            style={styles.modalSaveBtn}
            onPress={handleUpdatePassword}
            disabled={updating}
          >
            <LinearGradient
              colors={[COLORS.neon, '#BD9DFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalSaveGradient}
            >
              <Text style={styles.modalSaveText}>
                {updating ? 'Updating...' : 'Update Password'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
