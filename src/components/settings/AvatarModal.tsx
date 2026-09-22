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
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { userAPI, User } from '../../lib/supabase';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { ANIME_AVATARS, getRandomAnimeAvatar, AnimeAvatar } from '../../constants/avatars';
import { haptic } from '../../lib/haptics';
import { styles as settingsStyles } from '../../screens/settings.styles';

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
  const [selectedPresetUrl, setSelectedPresetUrl] = useState<string | null>(null);

  const handleSelectPresetAvatar = async (avatar: AnimeAvatar) => {
    if (uploading) return;
    haptic.selection();
    setSelectedPresetUrl(avatar.url);

    try {
      setUploading(true);
      const oldAvatarUrl = user.avatar_url;
      const { error } = await userAPI.updateProfile(user.id, { avatar_url: avatar.url });
      if (error) throw error;

      // Clean up previous storage avatar if it was custom uploaded
      if (oldAvatarUrl) {
        userAPI.deleteAvatar(oldAvatarUrl).catch(() => {});
      }

      haptic.success();
      await refreshUser();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', `Failed to update avatar: ${err.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
      setSelectedPresetUrl(null);
    }
  };

  const handleRandomAvatar = () => {
    haptic.medium();
    const random = getRandomAnimeAvatar();
    handleSelectPresetAvatar(random);
  };

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

      // Asynchronously delete old avatar from storage if it was custom uploaded
      if (oldAvatarUrl) {
        userAPI.deleteAvatar(oldAvatarUrl).catch(err => {
          console.warn('[Storage] Failed to delete old avatar:', err);
        });
      }

      haptic.success();
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

      haptic.success();
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
          style={settingsStyles.modalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[settingsStyles.modalSheet, localStyles.sheetContainer]}>
          <View style={settingsStyles.modalHandle} />
          
          <View style={localStyles.headerRow}>
            <Text style={settingsStyles.modalTitle}>Choose Avatar</Text>
            <TouchableOpacity
              style={localStyles.randomBtn}
              onPress={handleRandomAvatar}
              disabled={uploading}
              activeOpacity={0.8}
            >
              <Text style={localStyles.randomBtnText}>🎲 Surprise Me</Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={localStyles.scrollContent}
          >
            <Text style={settingsStyles.modalLabel}>ANIME CHARACTERS</Text>
            
            <View style={localStyles.grid}>
              {ANIME_AVATARS.map((avatar) => {
                const isSelected = user.avatar_url === avatar.url || selectedPresetUrl === avatar.url;
                return (
                  <TouchableOpacity
                    key={avatar.id}
                    style={[
                      localStyles.avatarCard,
                      isSelected && localStyles.avatarCardSelected,
                    ]}
                    onPress={() => handleSelectPresetAvatar(avatar)}
                    disabled={uploading}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={{ uri: avatar.url }}
                      style={localStyles.avatarImg}
                      contentFit="cover"
                      transition={150}
                    />
                    {isSelected && (
                      <View style={localStyles.checkBadge}>
                        <Ionicons name="checkmark-sharp" size={12} color="#000" />
                      </View>
                    )}
                    <Text style={localStyles.charName} numberOfLines={1}>
                      {avatar.name.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[settingsStyles.modalLabel, { marginTop: SPACING.lg }]}>CUSTOM PHOTO</Text>
            <TouchableOpacity
              style={settingsStyles.uploadImageBtn}
              onPress={handleSelectAndUploadAvatar}
              disabled={uploading}
            >
              <LinearGradient
                colors={[COLORS.neonCyan, COLORS.neon]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={settingsStyles.uploadImageGradient}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="cloud-upload" size={20} color="#000" style={{ marginRight: 8 }} />
                    <Text style={settingsStyles.uploadImageText}>Upload from Device</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {user.avatar_url && (
              <>
                <Text style={[settingsStyles.modalLabel, { marginTop: SPACING.md }]}>REMOVE AVATAR</Text>
                <TouchableOpacity
                  style={settingsStyles.uploadImageBtn}
                  onPress={handleRemoveAvatar}
                  disabled={uploading}
                >
                  <LinearGradient
                    colors={['#ff5b5b', '#ff2d2d']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={settingsStyles.uploadImageGradient}
                  >
                    {uploading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="trash" size={18} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={[settingsStyles.uploadImageText, { color: '#fff' }]}>Remove Current Avatar</Text>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  sheetContainer: {
    maxHeight: '82%',
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  randomBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 43, 60, 0.15)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 43, 60, 0.3)',
  },
  randomBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.neon,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 6,
  },
  avatarCard: {
    width: '22%',
    aspectRatio: 0.82,
    alignItems: 'center',
    position: 'relative',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 3,
  },
  avatarCardSelected: {
    borderColor: COLORS.neon,
    backgroundColor: 'rgba(255, 43, 60, 0.1)',
  },
  avatarImg: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#1E1F24',
  },
  checkBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: COLORS.neon,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  charName: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSub,
    marginTop: 4,
    textAlign: 'center',
  },
});
