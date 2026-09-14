import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { Reminder } from '../types/reminder';
import {
  isNativeSchedulerAvailable,
  scheduleNativeReminder,
  cancelNativeReminder,
} from './nativeReminderSchedulerService';

export const REMINDER_CHANNEL_ID = 'reminders-channel';

/**
 * Check if the app is currently running inside the Expo Go sandbox client.
 */
export function isExpoGo(): boolean {
  try {
    return isRunningInExpoGo();
  } catch {
    return false;
  }
}

/**
 * Safe accessor for native expo-notifications module.
 * In Expo SDK 53+, Expo Go on Android removes remote push modules and throws
 * a fatal error if expo-notifications is evaluated at top level.
 * By dynamically requiring only outside Expo Go, we guarantee error-free execution.
 */
function getNativeNotifications(): typeof import('expo-notifications') | null {
  if (isExpoGo()) {
    return null;
  }
  try {
    const notif = require('expo-notifications');
    return notif;
  } catch {
    return null;
  }
}

/**
 * Initialize notification channels and platform-specific settings.
 */
export async function initNotifications(): Promise<void> {
  const notif = getNativeNotifications();
  if (!notif) return;

  try {
    notif.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    if (Platform.OS === 'android') {
      await notif.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
        name: 'Reminders & Alarms',
        description: 'Alerts and notifications for your scheduled reminders',
        importance: notif.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 200, 300],
        lightColor: '#6366F1',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
        enableLights: true,
      });
    }
  } catch (error) {
    console.warn('Notification channel setup skipped:', error);
  }
}

/**
 * Check and request notification permissions from the user.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const notif = getNativeNotifications();
  if (!notif) {
    // In Expo Go, permissions for system alerts are managed by the container
    return true;
  }

  try {
    const settings = await notif.getPermissionsAsync();
    if (settings.granted || settings.ios?.status === notif.IosAuthorizationStatus.PROVISIONAL) {
      return true;
    }

    const requested = await notif.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    return !!(requested.granted || requested.ios?.status === notif.IosAuthorizationStatus.PROVISIONAL);
  } catch (error) {
    console.warn('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Schedule a notification for a reminder based on its scheduled time and repeat frequency.
 */
export async function scheduleReminderNotification(reminder: Reminder): Promise<string | null> {
  const notif = getNativeNotifications();
  if (!notif) {
    // When running in Expo Go, in-app timer handles the alerts
    return `in_app_${reminder.id}`;
  }

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return null;

    const targetDate = new Date(reminder.scheduledTime);
    const now = new Date();

    // Check if stopped
    if (reminder.stopAt && new Date(reminder.stopAt).getTime() <= now.getTime()) {
      return null;
    }

    // If one-time reminder is in the past, don't schedule
    if (reminder.repeatFrequency === 'none' && targetDate.getTime() <= now.getTime()) {
      return null;
    }

    if (reminder.notificationId) {
      await cancelReminderNotification(reminder.notificationId);
    }

    // On native Android build, use dedicated AlarmManager + BroadcastReceiver
    if (isNativeSchedulerAvailable()) {
      const success = await scheduleNativeReminder(reminder);
      if (success) {
        return reminder.id;
      }
    }

    let trigger: any;

    // If currently paused, delay until pausedUntil time
    if (reminder.pausedUntil && new Date(reminder.pausedUntil).getTime() > now.getTime()) {
      trigger = {
        type: notif.SchedulableTriggerInputTypes.DATE,
        date: new Date(reminder.pausedUntil),
        channelId: REMINDER_CHANNEL_ID,
      };
    } else if (reminder.repeatFrequency === 'interval') {
      if (targetDate.getTime() > now.getTime()) {
        trigger = {
          type: notif.SchedulableTriggerInputTypes.DATE,
          date: targetDate,
          channelId: REMINDER_CHANNEL_ID,
        };
      } else {
        const intervalSec = Math.max((reminder.intervalMinutes || 30) * 60, 60);
        trigger = {
          type: notif.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: intervalSec,
          repeats: true,
          channelId: REMINDER_CHANNEL_ID,
        };
      }
    } else if (reminder.repeatFrequency === 'daily') {
      trigger = {
        type: notif.SchedulableTriggerInputTypes.DAILY,
        hour: targetDate.getHours(),
        minute: targetDate.getMinutes(),
        channelId: REMINDER_CHANNEL_ID,
      };
    } else if (reminder.repeatFrequency === 'weekly') {
      trigger = {
        type: notif.SchedulableTriggerInputTypes.WEEKLY,
        weekday: targetDate.getDay() + 1,
        hour: targetDate.getHours(),
        minute: targetDate.getMinutes(),
        channelId: REMINDER_CHANNEL_ID,
      };
    } else {
      trigger = {
        type: notif.SchedulableTriggerInputTypes.DATE,
        date: targetDate,
        channelId: REMINDER_CHANNEL_ID,
      };
    }

    const notificationId = await notif.scheduleNotificationAsync({
      content: {
        title: `⏰ ${reminder.title}`,
        body: reminder.description || `Reminder: ${reminder.category} priority task`,
        data: { reminderId: reminder.id, category: reminder.category },
        sound: true,
        priority: notif.AndroidNotificationPriority.MAX,
      },
      trigger,
    });

    return notificationId;
  } catch (error) {
    console.warn('Error scheduling native notification:', error);
    return null;
  }
}

/**
 * Cancel a scheduled notification by its ID.
 */
export async function cancelReminderNotification(notificationId?: string): Promise<void> {
  if (!notificationId || notificationId.startsWith('in_app_')) return;
  if (isNativeSchedulerAvailable()) {
    await cancelNativeReminder(notificationId);
  }
  const notif = getNativeNotifications();
  if (!notif) return;

  try {
    await notif.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.warn(`Error cancelling notification ${notificationId}:`, error);
  }
}

/**
 * Register foreground & notification tap listeners safely.
 * Returns an unsubscribe callback.
 */
export function setupNotificationListeners(onUpdate: () => void): () => void {
  const notif = getNativeNotifications();
  if (!notif) return () => {};

  try {
    const sub1 = notif.addNotificationReceivedListener(() => onUpdate());
    const sub2 = notif.addNotificationResponseReceivedListener(() => onUpdate());
    return () => {
      sub1.remove();
      sub2.remove();
    };
  } catch {
    return () => {};
  }
}

/**
 * Send an immediate test notification to verify audio, vibration, and banner.
 */
export async function sendTestNotificationNow(): Promise<string | null> {
  const notif = getNativeNotifications();
  if (!notif) {
    return 'in_app_test';
  }

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return null;

    return await notif.scheduleNotificationAsync({
      content: {
        title: '🔔 RemindMe Test Notification',
        body: 'Notifications and alarms are working properly!',
        sound: true,
        priority: notif.AndroidNotificationPriority.MAX,
      },
      trigger: {
        type: notif.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
        channelId: REMINDER_CHANNEL_ID,
      },
    });
  } catch (error) {
    console.warn('Error sending test notification:', error);
    return null;
  }
}
