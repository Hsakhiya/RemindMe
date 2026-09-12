import AsyncStorage from '@react-native-async-storage/async-storage';
import { Reminder } from '../types/reminder';
import {
  scheduleReminderNotification,
  cancelReminderNotification,
} from './notificationService';

const STORAGE_KEY = '@remindme_reminders_v1';

/**
 * Load all reminders from persistent storage.
 */
export async function loadReminders(): Promise<Reminder[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getInitialWelcomeReminders();
    }
    const parsed: Reminder[] = JSON.parse(raw);
    return parsed;
  } catch (error) {
    console.error('Failed to load reminders from storage:', error);
    return [];
  }
}

/**
 * Save array of reminders to persistent storage.
 */
export async function saveReminders(reminders: Reminder[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  } catch (error) {
    console.error('Failed to save reminders to storage:', error);
  }
}

/**
 * Add a new reminder, schedule its notification, and persist it.
 */
export async function addReminder(
  data: Omit<Reminder, 'id' | 'createdAt' | 'isCompleted' | 'notificationId'>
): Promise<Reminder> {
  const currentList = await loadReminders();

  const id = `rem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const newReminder: Reminder = {
    ...data,
    id,
    isCompleted: false,
    createdAt: new Date().toISOString(),
  };

  // Schedule notification if time is in future or it repeats
  const notifId = await scheduleReminderNotification(newReminder);
  if (notifId) {
    newReminder.notificationId = notifId;
  }

  const updatedList = [newReminder, ...currentList];
  await saveReminders(updatedList);
  return newReminder;
}

/**
 * Update an existing reminder, re-schedule notification, and persist.
 */
export async function updateReminder(updated: Reminder): Promise<Reminder[]> {
  const currentList = await loadReminders();

  // If reminder was previously scheduled, re-schedule
  if (!updated.isCompleted) {
    const notifId = await scheduleReminderNotification(updated);
    updated.notificationId = notifId || undefined;
  } else if (updated.notificationId) {
    await cancelReminderNotification(updated.notificationId);
    updated.notificationId = undefined;
  }

  const newList = currentList.map((item) => (item.id === updated.id ? updated : item));
  await saveReminders(newList);
  return newList;
}

/**
 * Toggle the completion status of a reminder.
 */
export async function toggleReminderStatus(id: string): Promise<Reminder[]> {
  const currentList = await loadReminders();
  const index = currentList.findIndex((item) => item.id === id);
  if (index === -1) return currentList;

  const target = { ...currentList[index] };
  target.isCompleted = !target.isCompleted;

  if (target.isCompleted) {
    // If marked done, cancel upcoming notification
    if (target.notificationId) {
      await cancelReminderNotification(target.notificationId);
      target.notificationId = undefined;
    }
  } else {
    // If unmarked and time is in future or repeating, re-schedule
    const targetDate = new Date(target.scheduledTime);
    if (targetDate.getTime() > Date.now() || target.repeatFrequency !== 'none') {
      const notifId = await scheduleReminderNotification(target);
      if (notifId) target.notificationId = notifId;
    }
  }

  currentList[index] = target;
  await saveReminders(currentList);
  return [...currentList];
}

/**
 * Delete a reminder and cancel any scheduled alarm.
 */
export async function deleteReminder(id: string): Promise<Reminder[]> {
  const currentList = await loadReminders();
  const target = currentList.find((item) => item.id === id);
  if (target?.notificationId) {
    await cancelReminderNotification(target.notificationId);
  }

  const updatedList = currentList.filter((item) => item.id !== id);
  await saveReminders(updatedList);
  return updatedList;
}

/**
 * Snooze a reminder by adding specified minutes and rescheduling.
 */
export async function snoozeReminder(id: string, minutes: number = 10): Promise<Reminder[]> {
  const currentList = await loadReminders();
  const index = currentList.findIndex((item) => item.id === id);
  if (index === -1) return currentList;

  const target = { ...currentList[index] };
  const newDate = new Date(Date.now() + minutes * 60 * 1000);
  target.scheduledTime = newDate.toISOString();
  target.isCompleted = false;

  const notifId = await scheduleReminderNotification(target);
  if (notifId) target.notificationId = notifId;

  currentList[index] = target;
  await saveReminders(currentList);
  return [...currentList];
}

/**
 * Pause / mute a reminder until a specific date or timestamp.
 */
export async function pauseReminder(id: string, pauseUntil: string): Promise<Reminder[]> {
  const currentList = await loadReminders();
  const index = currentList.findIndex((item) => item.id === id);
  if (index === -1) return currentList;

  const target = { ...currentList[index] };
  target.pausedUntil = pauseUntil;

  // Re-schedule notification to fire after pauseUntil
  const notifId = await scheduleReminderNotification(target);
  if (notifId) target.notificationId = notifId;

  currentList[index] = target;
  await saveReminders(currentList);
  return [...currentList];
}

/**
 * Resume a previously paused reminder immediately.
 */
export async function resumeReminder(id: string): Promise<Reminder[]> {
  const currentList = await loadReminders();
  const index = currentList.findIndex((item) => item.id === id);
  if (index === -1) return currentList;

  const target = { ...currentList[index] };
  delete target.pausedUntil;

  // If repeating by interval and current scheduledTime was in past, reset to next interval
  if (target.repeatFrequency === 'interval') {
    const intervalMs = (target.intervalMinutes || 30) * 60 * 1000;
    target.scheduledTime = new Date(Date.now() + intervalMs).toISOString();
  }

  const notifId = await scheduleReminderNotification(target);
  if (notifId) target.notificationId = notifId;

  currentList[index] = target;
  await saveReminders(currentList);
  return [...currentList];
}

/**
 * Provide sample starter reminders on first launch.
 */
function getInitialWelcomeReminders(): Reminder[] {
  const inThirtyMinutes = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const tomorrowMorning = new Date();
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
  tomorrowMorning.setHours(9, 0, 0, 0);

  return [
    {
      id: 'welcome_1',
      title: 'Welcome to RemindMe!',
      description: 'Tap the checkbox to complete, or tap (+) to schedule a new reminder.',
      scheduledTime: inThirtyMinutes,
      repeatFrequency: 'none',
      category: 'General',
      isCompleted: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'welcome_2',
      title: 'Review daily priorities',
      description: 'Check tasks and plan ahead for the day.',
      scheduledTime: tomorrowMorning.toISOString(),
      repeatFrequency: 'daily',
      category: 'Work',
      isCompleted: false,
      createdAt: new Date().toISOString(),
    },
  ];
}
