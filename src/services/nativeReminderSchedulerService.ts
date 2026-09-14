import { NativeModules, Platform } from 'react-native';
import { Reminder } from '../types/reminder';

const { ReminderSchedulerModule } = NativeModules;

export const isNativeSchedulerAvailable = (): boolean => {
  return Platform.OS === 'android' && !!ReminderSchedulerModule;
};

/**
 * Schedule a reminder using the native Android AlarmManager and BroadcastReceiver.
 * Works even when the app is swiped away from Recent Apps or the device reboots.
 */
export async function scheduleNativeReminder(reminder: Reminder): Promise<boolean> {
  if (!isNativeSchedulerAvailable()) {
    return false;
  }

  try {
    const payload = JSON.stringify({
      id: reminder.id,
      title: reminder.title,
      description: reminder.description || '',
      scheduledTime: reminder.scheduledTime,
      repeatFrequency: reminder.repeatFrequency,
      intervalMinutes: reminder.intervalMinutes || 30,
      stopAt: reminder.stopAt || '',
      disabledTimeRange: reminder.disabledTimeRange || null,
      category: reminder.category,
    });

    await ReminderSchedulerModule.scheduleNativeReminder(payload);
    return true;
  } catch (error) {
    console.warn('[NativeReminderScheduler] Failed to schedule native reminder:', error);
    return false;
  }
}

/**
 * Cancel a reminder from native AlarmManager and SharedPreferences.
 */
export async function cancelNativeReminder(reminderId: string): Promise<boolean> {
  if (!isNativeSchedulerAvailable()) {
    return false;
  }

  try {
    await ReminderSchedulerModule.cancelNativeReminder(reminderId);
    return true;
  } catch (error) {
    console.warn('[NativeReminderScheduler] Failed to cancel native reminder:', error);
    return false;
  }
}

/**
 * Retrieve active reminders currently tracked in native SharedPreferences.
 * Used to synchronize interval cycles that fired while the app was closed.
 */
export async function getStoredNativeReminders(): Promise<Record<string, any>> {
  if (!isNativeSchedulerAvailable()) {
    return {};
  }

  try {
    const jsonStr = await ReminderSchedulerModule.getStoredRemindersJson();
    return JSON.parse(jsonStr || '{}');
  } catch (error) {
    console.warn('[NativeReminderScheduler] Failed to fetch stored native reminders:', error);
    return {};
  }
}
