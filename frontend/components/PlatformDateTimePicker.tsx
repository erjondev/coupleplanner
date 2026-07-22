/**
 * Sélecteur de date/heure multi-plateforme.
 *
 * Sur natif (iOS/Android), on réexporte tel quel le composant de
 * `@react-native-community/datetimepicker`. Ce package NE fournit PAS
 * d'implémentation web (il rend `null` et log « not supported ») ; la variante
 * `PlatformDateTimePicker.web.tsx` prend le relais côté navigateur.
 *
 * L'API exposée est un sous-ensemble volontairement minimal (value, mode,
 * onValueChange, onDismiss) — le seul utilisé dans l'app.
 */
export { default } from '@react-native-community/datetimepicker';
