import { Alert, Platform } from 'react-native';

/**
 * RN's Alert is compiled to a no-op on react-native-web, which would leave
 * every purchase/restore error path silent precisely where the e2e funnel
 * runs — the same dead-button experience review flagged on native. Web goes
 * through window.alert so feedback exists (and is assertable) everywhere.
 */
export function appAlert(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
