import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { Reminder } from '../types/reminder';
import { AlarmNativeService } from './alarmNativeService';

export const REMINDER_CHANNEL_ID = 'reminders-channel';
export const ALARM_CHANNEL_ID = 'alarm-channel-v3';

/**
 * Calculate the next exact trigger epoch millisecond for a reminder.
 */
export function getNextTriggerMillis(reminder: Reminder): number | null {
  const now = Date.now();
  if (reminder.stopAt && new Date(reminder.stopAt).getTime() <= now) {
    return null;
  }
  if (reminder.pausedUntil) {
    const pausedTime = new Date(reminder.pausedUntil).getTime();
    if (pausedTime > now) return pausedTime;
  }
  const targetDate = new Date(reminder.scheduledTime);
  if (reminder.repeatFrequency === 'none') {
    return targetDate.getTime() > now ? targetDate.getTime() : null;
  }
  if (reminder.repeatFrequency === 'daily') {
    const next = new Date();
    next.setHours(targetDate.getHours(), targetDate.getMinutes(), 0, 0);
    if (next.getTime() <= now) {
      next.setDate(next.getDate() + 1);
    }
    return next.getTime();
  }
  if (reminder.repeatFrequency === 'weekly') {
    const targetDay = targetDate.getDay();
    const next = new Date();
    next.setHours(targetDate.getHours(), targetDate.getMinutes(), 0, 0);
    let daysUntil = (targetDay - next.getDay() + 7) % 7;
    if (daysUntil === 0 && next.getTime() <= now) {
      daysUntil = 7;
    }
    next.setDate(next.getDate() + daysUntil);
    return next.getTime();
  }
  if (reminder.repeatFrequency === 'interval') {
    if (targetDate.getTime() > now) {
      return targetDate.getTime();
    }
    const intervalMinutes = reminder.intervalMinutes || 30;
    return now + intervalMinutes * 60 * 1000;
  }
  return targetDate.getTime() > now ? targetDate.getTime() : null;
}

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
      // 1. Standard Reminders Channel
      await notif.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
        name: 'Standard Reminders',
        description: 'Banner notifications for your scheduled reminders',
        importance: notif.AndroidImportance.HIGH,
        vibrationPattern: [0, 300, 200, 300],
        lightColor: '#6366F1',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
        enableLights: true,
      });

      // Clean up any stale or cached legacy channels so Android uses fresh settings
      try {
        await notif.deleteNotificationChannelAsync('alarm-channel');
        await notif.deleteNotificationChannelAsync('alarm-channel-v2');
      } catch {}

      // 2. High-Priority Full-Screen Alarm Channel (Wakes Screen & Overlays Lock Screen)
      await notif.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
        name: 'Full-Screen Alarms',
        description: 'Wakes the screen and displays full-screen alarm on lock screen',
        importance: notif.AndroidImportance.MAX,
        vibrationPattern: [0, 800, 400, 800, 400, 1000],
        lightColor: '#EF4444',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
        enableLights: true,
        audioAttributes: {
          usage: notif.AndroidAudioUsage.ALARM,
          contentType: notif.AndroidAudioContentType.SONIFICATION,
        },
        bypassDnd: true,
        lockscreenVisibility: notif.AndroidNotificationVisibility.PUBLIC,
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

    const isAlarm = reminder.isAlarm !== false;
    const targetChannelId = isAlarm ? ALARM_CHANNEL_ID : REMINDER_CHANNEL_ID;

    let trigger: any;

    // If currently paused, delay until pausedUntil time
    if (reminder.pausedUntil && new Date(reminder.pausedUntil).getTime() > now.getTime()) {
      trigger = {
        type: notif.SchedulableTriggerInputTypes.DATE,
        date: new Date(reminder.pausedUntil),
        channelId: targetChannelId,
      };
    } else if (reminder.repeatFrequency === 'interval') {
      if (targetDate.getTime() > now.getTime()) {
        trigger = {
          type: notif.SchedulableTriggerInputTypes.DATE,
          date: targetDate,
          channelId: targetChannelId,
        };
      } else {
        const intervalSec = Math.max((reminder.intervalMinutes || 30) * 60, 60);
        trigger = {
          type: notif.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: intervalSec,
          repeats: true,
          channelId: targetChannelId,
        };
      }
    } else if (reminder.repeatFrequency === 'daily') {
      trigger = {
        type: notif.SchedulableTriggerInputTypes.DAILY,
        hour: targetDate.getHours(),
        minute: targetDate.getMinutes(),
        channelId: targetChannelId,
      };
    } else if (reminder.repeatFrequency === 'weekly') {
      trigger = {
        type: notif.SchedulableTriggerInputTypes.WEEKLY,
        weekday: targetDate.getDay() + 1,
        hour: targetDate.getHours(),
        minute: targetDate.getMinutes(),
        channelId: targetChannelId,
      };
    } else {
      trigger = {
        type: notif.SchedulableTriggerInputTypes.DATE,
        date: targetDate,
        channelId: targetChannelId,
      };
    }

    const notificationId = await notif.scheduleNotificationAsync({
      content: {
        title: isAlarm ? `🚨 ${reminder.title}` : `⏰ ${reminder.title}`,
        body: reminder.description || `Reminder: ${reminder.category} priority task`,
        data: {
          reminderId: reminder.id,
          category: reminder.category,
          fullScreen: isAlarm,
          title: reminder.title,
          description: reminder.description || `Reminder: ${reminder.category} priority task`,
        },
        sound: true,
        priority: notif.AndroidNotificationPriority.MAX,
      },
      trigger,
    });

    // On Android, also schedule via native AlarmManager.setAlarmClock.
    // This directly launches AlarmActivity over the lock screen on Google Pixel and Android 14/15 devices.
    if (Platform.OS === 'android' && isAlarm) {
      const nextMillis = getNextTriggerMillis(reminder);
      if (nextMillis && nextMillis > Date.now()) {
        AlarmNativeService.scheduleAlarmClock(
          reminder.id,
          nextMillis,
          `🚨 ${reminder.title}`,
          reminder.description || `Reminder: ${reminder.category} priority task`,
          JSON.stringify({
            reminderId: reminder.id,
            category: reminder.category,
            fullScreen: true,
            title: reminder.title,
            description: reminder.description || `Reminder: ${reminder.category} priority task`,
          })
        );
      }
    }

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
  if (Platform.OS === 'android') {
    AlarmNativeService.cancelAlarmClock(notificationId);
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
 * Register foreground & notification tap/intent listeners safely.
 * Returns an unsubscribe callback.
 */
export function setupNotificationListeners(
  onUpdate: () => void,
  onAlarmTriggered?: (reminderId: string, data?: any, isLockScreen?: boolean) => void
): () => void {
  const notif = getNativeNotifications();
  if (!notif) return () => {};

  try {
    const sub1 = notif.addNotificationReceivedListener((notification: any) => {
      onUpdate();
      const data = notification?.request?.content?.data;
      if (data?.fullScreen && data?.reminderId && onAlarmTriggered) {
        onAlarmTriggered(data.reminderId, data, false);
      }
    });
    const sub2 = notif.addNotificationResponseReceivedListener((response: any) => {
      onUpdate();
      const data = response?.notification?.request?.content?.data;
      if (data?.reminderId && onAlarmTriggered) {
        onAlarmTriggered(data.reminderId, data, true);
      }
    });
    return () => {
      sub1.remove();
      sub2.remove();
    };
  } catch {
    return () => {};
  }
}

/**
 * Fetch the last notification response that launched or brought the app to foreground.
 */
export async function getLastNotificationAlarm(): Promise<{ reminderId: string; data?: any } | null> {
  const notif = getNativeNotifications();
  if (!notif) return null;

  try {
    const lastResponse = await notif.getLastNotificationResponseAsync();
    const data = lastResponse?.notification?.request?.content?.data as Record<string, any> | undefined;
    if (data?.reminderId) {
      return { reminderId: String(data.reminderId), data };
    }
    return null;
  } catch {
    return null;
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

/**
 * Schedule a full-screen alarm in 5 seconds so user can lock phone and test lock screen wake-up.
 */
export async function scheduleTestAlarm(delaySeconds: number = 5): Promise<string | null> {
  const triggerTime = Date.now() + Math.max(delaySeconds, 2) * 1000;
  if (Platform.OS === 'android') {
    AlarmNativeService.scheduleAlarmClock(
      'test_alarm_preview',
      triggerTime,
      '🚨 Test Full-Screen Alarm',
      'Lock-screen alarm test! Lock your phone now to test wake-up.',
      JSON.stringify({
        testAlarm: true,
        fullScreen: true,
        reminderId: 'test_alarm_preview',
        title: 'Test Full-Screen Alarm',
        description: 'Lock-screen alarm triggered successfully!',
        category: 'Urgent',
      })
    );
  }

  const notif = getNativeNotifications();
  if (!notif) {
    return 'in_app_test';
  }

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return null;

    return await notif.scheduleNotificationAsync({
      content: {
        title: '🚨 Test Full-Screen Alarm',
        body: 'Lock-screen alarm test! Lock your phone now to test wake-up.',
        data: {
          testAlarm: true,
          fullScreen: true,
          reminderId: 'test_alarm_preview',
          title: 'Test Full-Screen Alarm',
          description: 'Lock-screen alarm triggered successfully!',
          category: 'Urgent',
        },
        sound: true,
        priority: notif.AndroidNotificationPriority.MAX,
      },
      trigger: {
        type: notif.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(delaySeconds, 2),
        channelId: ALARM_CHANNEL_ID,
      },
    });
  } catch (error) {
    console.warn('Error scheduling test alarm:', error);
    return null;
  }
}
