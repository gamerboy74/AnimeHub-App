import { Alert as RNAlert } from 'react-native';

export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

type AlertHandler = (title: string, message?: string, buttons?: AlertButton[]) => void;

let alertHandler: AlertHandler | null = null;

// Backup of original RN alert
const originalAlert = RNAlert.alert;

// Override Alert.alert globally
RNAlert.alert = (
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: any
) => {
  if (alertHandler) {
    alertHandler(title, message, buttons);
  } else {
    originalAlert(title, message, buttons, options);
  }
};

export const registerAlertHandler = (handler: AlertHandler) => {
  alertHandler = handler;
};

export const unregisterAlertHandler = () => {
  alertHandler = null;
};
