import React from 'react';
import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { Reminder } from '../types/reminder';
import { RemindersWidget } from '../widgets/RemindersWidget';

export function isExpoGoClient(): boolean {
  try {
    return isRunningInExpoGo();
  } catch {
    return false;
  }
}

/**
 * Triggers an immediate refresh of the Home Screen Widget.
 * Safely bypassed when running in Expo Go or non-Android platforms.
 */
export async function syncWidgetReminders(reminders: Reminder[]): Promise<void> {
  if (Platform.OS !== 'android' || isExpoGoClient()) {
    return;
  }

  try {
    const { requestWidgetUpdate } = require('react-native-android-widget');
    await requestWidgetUpdate({
      widgetName: 'RemindersWidget',
      renderWidget: () => <RemindersWidget reminders={reminders} />,
      widgetNotFound: () => {
        // User hasn't placed the widget on their home screen yet - ignore
      },
    });
  } catch (error) {
    // Graceful silent catch if native widget receiver is not registered in this runtime
    console.log('[WidgetSync] Widget update not available in this environment');
  }
}

/**
 * Registers the widget background task handler at startup.
 * Safely bypassed in Expo Go or non-Android environments.
 */
export function registerAppWidget(): void {
  if (Platform.OS !== 'android' || isExpoGoClient()) {
    return;
  }

  try {
    const { registerWidgetTaskHandler } = require('react-native-android-widget');
    const { widgetTaskHandler } = require('../widgets/widgetTaskHandler');
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch (error) {
    console.log('[WidgetSync] Failed to register widget task handler:', error);
  }
}
