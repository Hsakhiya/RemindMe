import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { RemindersWidget } from './RemindersWidget';
import { getReminders, toggleReminder } from '../services/storageService';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetAction, clickAction, clickActionData } = props;

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      try {
        const reminders = await getReminders();
        props.renderWidget(<RemindersWidget reminders={reminders} />);
      } catch (error) {
        console.error('Error rendering widget on action:', widgetAction, error);
        props.renderWidget(<RemindersWidget reminders={[]} />);
      }
      break;
    }

    case 'WIDGET_CLICK': {
      if (clickAction === 'COMPLETE_REMINDER') {
        const reminderId = clickActionData?.reminderId as string | undefined;
        if (reminderId) {
          try {
            const updated = await toggleReminder(reminderId);
            props.renderWidget(<RemindersWidget reminders={updated} />);
          } catch (error) {
            console.error('Error completing reminder from widget:', error);
          }
        }
      }
      break;
    }

    case 'WIDGET_DELETED':
    default:
      break;
  }
}
