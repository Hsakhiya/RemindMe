import { NativeModules, Platform } from 'react-native';

const { AlarmModule } = NativeModules;

export const AlarmNativeService = {
  /**
   * Play device alarm sound on loop using USAGE_ALARM stream.
   * Rings even if phone is on vibrate or silent mode.
   */
  playAlarmSound(): void {
    if (Platform.OS === 'android' && AlarmModule?.playAlarmSound) {
      AlarmModule.playAlarmSound();
    }
  },

  /**
   * Stop the looping alarm sound.
   */
  stopAlarmSound(): void {
    if (Platform.OS === 'android' && AlarmModule?.stopAlarmSound) {
      AlarmModule.stopAlarmSound();
    }
  },

  /**
   * Wake up the physical screen illumination if display is off.
   */
  wakeScreen(): void {
    if (Platform.OS === 'android' && AlarmModule?.wakeScreen) {
      AlarmModule.wakeScreen();
    }
  },

  /**
   * Check whether the app has full-screen intent permission on Android 14+.
   */
  async canUseFullScreenIntent(): Promise<boolean> {
    if (Platform.OS === 'android' && AlarmModule?.canUseFullScreenIntent) {
      try {
        return await AlarmModule.canUseFullScreenIntent();
      } catch {
        return true;
      }
    }
    return true;
  },

  /**
   * Open the Android system settings page for full-screen intent permissions.
   */
  openFullScreenIntentSettings(): void {
    if (Platform.OS === 'android' && AlarmModule?.openFullScreenIntentSettings) {
      AlarmModule.openFullScreenIntentSettings();
    }
  },
};
