import React, { useState, useEffect } from 'react';
import {
  Modal,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { registerAlertHandler, unregisterAlertHandler, AlertButton } from '../../lib/customAlert';
import { COLORS, RADIUS } from '../../constants/theme';

const { width } = Dimensions.get('window');

export default function CustomAlertModal() {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [buttons, setButtons] = useState<AlertButton[]>([]);

  useEffect(() => {
    // Register this modal to intercept all global Alert.alert calls
    registerAlertHandler((alertTitle, alertMessage, alertButtons) => {
      setTitle(alertTitle);
      setMessage(alertMessage || '');
      setButtons(alertButtons || []);
      setVisible(true);
    });

    return () => {
      unregisterAlertHandler();
    };
  }, []);

  const handleButtonPress = (btn: AlertButton) => {
    setVisible(false);
    if (btn.onPress) {
      btn.onPress();
    }
  };

  const isWarningAction = 
    title.toLowerCase().includes('delete') || 
    title.toLowerCase().includes('remove') ||
    title.toLowerCase().includes('sign out') ||
    title.toLowerCase().includes('log out') ||
    title.toLowerCase().includes('cancel') ||
    title.toLowerCase().includes('disable') ||
    title.toLowerCase().includes('error') ||
    title.toLowerCase().includes('fail') ||
    buttons.some(b => b.style === 'destructive' || (b.text && ['delete', 'remove', 'logout', 'disable', 'cancel'].some(w => b.text?.toLowerCase().includes(w))));

  const accentColor = isWarningAction ? COLORS.danger : COLORS.neon;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => setVisible(false)}
    >
      <View style={styles.overlay} accessibilityViewIsModal={true}>
        <View
          style={[styles.card, { borderColor: `${accentColor}30` }]}
          accessible={true}
          accessibilityRole="alert"
          accessibilityLabel={title}
          accessibilityViewIsModal={true}
        >
          {/* Subtle accent glow line at the top */}
          <View style={[styles.glowBar, { backgroundColor: accentColor }]} />

          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={[
            styles.buttonContainer, 
            buttons.length > 2 ? styles.buttonContainerVertical : styles.buttonContainerHorizontal
          ]}>
            {buttons.length === 0 ? (
              <TouchableOpacity
                style={styles.btnFull}
                onPress={() => setVisible(false)}
              >
                <LinearGradient
                  colors={[COLORS.neon, '#BD9DFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradient}
                >
                  <Text style={styles.btnTextDark}>OK</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              buttons.map((btn, index) => {
                const isDestructive = btn.style === 'destructive' || (btn.text && ['delete', 'remove', 'logout', 'disable', 'cancel plan', 'sign out'].some(w => btn.text?.toLowerCase().includes(w)));
                const isCancel = btn.style === 'cancel' || btn.text?.toLowerCase() === 'cancel';
                
                if (isCancel) {
                  return (
                    <TouchableOpacity
                      key={index}
                      style={buttons.length > 2 ? styles.btnVertical : styles.btnFlex}
                      onPress={() => handleButtonPress(btn)}
                    >
                      <Text style={styles.btnTextMuted}>{btn.text}</Text>
                    </TouchableOpacity>
                  );
                }

                return (
                  <TouchableOpacity
                    key={index}
                    style={buttons.length > 2 ? styles.btnVertical : styles.btnFlex}
                    onPress={() => handleButtonPress(btn)}
                  >
                    <LinearGradient
                      colors={isDestructive ? [COLORS.danger, '#ff7346'] : [COLORS.neon, '#BD9DFF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.gradient}
                    >
                      <Text style={isDestructive ? styles.btnTextLight : styles.btnTextDark}>
                        {btn.text}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 10, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: Math.min(width * 0.85, 320),
    backgroundColor: '#0E0E1A',
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  glowBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    opacity: 0.8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F0EEFF',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  message: {
    fontSize: 13,
    color: '#8A87A8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  buttonContainerHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buttonContainerVertical: {
    flexDirection: 'column',
  },
  btnFlex: {
    flex: 1,
    height: 44,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  btnVertical: {
    width: '100%',
    height: 44,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  btnFull: {
    width: '100%',
    height: 44,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  gradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnTextDark: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
  },
  btnTextLight: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  btnTextMuted: {
    color: '#8A87A8',
    fontSize: 13,
    fontWeight: '700',
  },
});
