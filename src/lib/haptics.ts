import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNative } from './util';

/** Petites vibrations (Android seulement, ignorées dans le navigateur). */
export const haptic = {
  tap() {
    if (isNative()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  },
  medium() {
    if (isNative()) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
  },
  tick() {
    if (isNative()) Haptics.selectionChanged().catch(() => {});
  },
  success() {
    if (isNative()) Haptics.notification({ type: NotificationType.Success }).catch(() => {});
  },
  warning() {
    if (isNative()) Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
  },
};
