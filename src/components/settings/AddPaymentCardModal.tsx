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
import { COLORS, RADIUS } from '../../constants/theme';
import { styles } from '../../screens/settings.styles';

interface AddPaymentCardModalProps {
  visible: boolean;
  onClose: () => void;
  onAddCard: (brand: string, last4: string, expiry: string) => Promise<void>;
}

export default function AddPaymentCardModal({
  visible,
  onClose,
  onAddCard,
}: AddPaymentCardModalProps) {
  const [cardNum, setCardNum] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardBrand, setCardBrand] = useState('VISA');
  const [adding, setAdding] = useState(false);

  const handleSubmit = async () => {
    if (cardNum.trim().length < 4) {
      Alert.alert('Error', 'Please enter the last 4 digits of your card.');
      return;
    }
    const expiryPattern = /^(0[1-9]|1[0-2])\/(\d{2})$/;
    if (!expiryPattern.test(cardExpiry.trim())) {
      Alert.alert('Error', 'Expiry must be in MM/YY format (e.g. 08/27).');
      return;
    }

    try {
      setAdding(true);
      await onAddCard(cardBrand, cardNum.trim(), cardExpiry.trim());
      setCardNum('');
      setCardExpiry('');
      setCardBrand('VISA');
      onClose();
      Alert.alert('Success', 'Card added successfully!');
    } catch (err) {
      Alert.alert('Error', 'Failed to add card. Please try again.');
    } finally {
      setAdding(false);
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
          <Text style={styles.modalTitle}>Add Payment Card</Text>
          
          <Text style={styles.modalLabel}>Card Provider</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            {['VISA', 'MC', 'AMEX'].map(brand => (
              <TouchableOpacity 
                key={brand}
                onPress={() => setCardBrand(brand)}
                disabled={adding}
                style={[
                  {
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: RADIUS.md,
                    borderWidth: 1,
                    borderColor: 'rgba(189,157,255,0.1)',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                  },
                  cardBrand === brand && {
                    borderColor: COLORS.neon,
                    backgroundColor: 'rgba(189,157,255,0.05)',
                  },
                ]}
              >
                <Text style={{ color: COLORS.text, fontWeight: '700' }}>{brand}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.modalLabel}>Last 4 Digits</Text>
          <TextInput
            style={styles.modalInput}
            value={cardNum}
            onChangeText={setCardNum}
            placeholder="e.g. 5678"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="number-pad"
            maxLength={4}
            editable={!adding}
          />

          <Text style={styles.modalLabel}>Expiration Date</Text>
          <TextInput
            style={styles.modalInput}
            value={cardExpiry}
            onChangeText={setCardExpiry}
            placeholder="MM/YY"
            placeholderTextColor={COLORS.textMuted}
            maxLength={5}
            editable={!adding}
          />

          <TouchableOpacity 
            style={styles.modalSaveBtn} 
            onPress={handleSubmit}
            disabled={adding}
          >
            <LinearGradient
              colors={[COLORS.neon, '#BD9DFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalSaveGradient}
            >
              <Text style={styles.modalSaveText}>
                {adding ? 'Adding Card...' : 'Add Payment Card'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
