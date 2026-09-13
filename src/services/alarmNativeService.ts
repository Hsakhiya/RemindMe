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

  /**
   * Schedule an exact system alarm clock using AlarmManager.setAlarmClock.
   * This directly launches AlarmActivity over the lock screen on Google Pixel and Android 14/15 devices.
   */
  scheduleAlarmClock(id: string, triggerAtMillis: number, title: string, body: string, data: string): void {
    if (Platform.OS === 'android' && AlarmModule?.scheduleAlarmClock) {
      AlarmModule.scheduleAlarmClock(id, triggerAtMillis, title, body, data);
    }
  },

  /**
   * Cancel an existing alarm clock scheduled via AlarmManager.
   */
  cancelAlarmClock(id: string): void {
    if (Platform.OS === 'android' && AlarmModule?.cancelAlarmClock) {
      AlarmModule.cancelAlarmClock(id);
    }
  },
};
