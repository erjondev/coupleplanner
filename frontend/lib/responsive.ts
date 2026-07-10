/**
 * Helpers responsives : permettent un design différent sur le web (grand écran)
 * tout en conservant l'UI mobile native.
 */
import { Platform, useWindowDimensions } from 'react-native';

/** Largeur à partir de laquelle on bascule sur la mise en page « bureau ». */
export const WIDE_BREAKPOINT = 768;

/** Largeur de la barre latérale de navigation (web large). */
export const SIDEBAR_WIDTH = 240;

/** true sur le web (toutes tailles). */
export function useIsWeb(): boolean {
  return Platform.OS === 'web';
}

/** true uniquement sur le web ET sur un écran large (bureau) → sidebar, grille. */
export function useIsWideWeb(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE_BREAKPOINT;
}

/** Nombre de colonnes de la grille de tâches selon la largeur (web uniquement). */
export function useTaskColumns(): number {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web') return 1;
  const usable = width - SIDEBAR_WIDTH;
  if (width < WIDE_BREAKPOINT) return 1;
  if (usable >= 1000) return 3;
  return 2;
}
