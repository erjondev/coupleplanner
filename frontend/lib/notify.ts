import { Alert, Platform } from 'react-native';

/**
 * Alerte cross-platform : Alert.alert est un no-op sur le web,
 * on bascule donc sur window.alert dans ce cas.
 */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

/**
 * Confirmation cross-platform (destructive). Résout à true si l'utilisateur
 * confirme. Web -> window.confirm ; natif -> Alert.alert à deux boutons.
 */
export function confirmAction(
  title: string,
  message: string,
  confirmLabel = 'Confirmer'
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
