import React, { useState } from 'react';
import {
  Modal,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { userAPI, User } from '../../lib/supabase';
import { COLORS } from '../../constants/theme';
import { styles } from '../../screens/settings.styles';

interface AvatarModalProps {
  visible: boolean;
  onClose: () => void;
  user: User;
  refreshUser: () => Promise<void>;
}

export default function AvatarModal({
  visible,
  onClose,
  user,
  refreshUser,
}: AvatarModalProps) {
  const [uploading, setUploading] = useState(false);

  const handleSelectAndUploadAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need photo library access to change your avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const selectedUri = result.assets[0].uri;

    try {
      setUploading(true);
      const oldAvatarUrl = user.avatar_url;
      const publicUrl = await userAPI.uploadAvatar(user.id, selectedUri);

      const { error } = await userAPI.updateProfile(user.id, { avatar_url: publicUrl });
      if (error) throw error;

      // Asynchronously delete old avatar from storage to keep buckets clean (non-blocking)
      if (oldAvatarUrl) {
        userAPI.deleteAvatar(oldAvatarUrl).catch(err => {
          console.warn('[Storage] Failed to delete old avatar:', err);
        });
      }

      Alert.alert('Success', 'Avatar updated!');
      await refreshUser();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', `Failed to upload avatar: ${err.message || JSON.stringify(err)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setUploading(true);
      const oldAvatarUrl = user.avatar_url;
      
      const { error } = await userAPI.updateProfile(user.id, { avatar_url: null });
      if (error) throw error;
      
      if (oldAvatarUrl) {
        userAPI.deleteAvatar(oldAvatarUrl).catch(err => {
          console.warn('[Storage] Failed to delete old avatar:', err);
        });
      }
      
      Alert.alert('Success', 'Avatar removed!');
      await refreshUser();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', `Failed to remove avatar: ${err.message || JSON.stringify(err)}`);
    } finally {
      setUploading(false);
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
          <Text style={styles.modalTitle}>Change Avatar</Text>
          
          <Text style={styles.modalLabel}>Upload from Device</Text>
          <TouchableOpacity 
            style={styles.uploadImageBtn}
            onPress={handleSelectAndUploadAvatar}
            disabled={uploading}
          >
            <LinearGradient 
              colors={[COLORS.neonCyan, COLORS.neon]} 
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }} 
              style={styles.uploadImageGradient}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="cloud-upload" size={20} color="#000" style={{ marginRight: 8 }} />
                  <Text style={styles.uploadImageText}>Choose Photo from Library</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {user.avatar_url && (
            <>
              <Text style={styles.modalLabel}>Remove Current Avatar</Text>
              <TouchableOpacity 
                style={styles.uploadImageBtn}
                onPress={handleRemoveAvatar}
                disabled={uploading}
              >
                <LinearGradient 
                  colors={['#ff5b5b', '#ff2d2d']} 
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }} 
                  style={styles.uploadImageGradient}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="trash" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={[styles.uploadImageText, { color: '#fff' }]}>Remove Current Avatar</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
