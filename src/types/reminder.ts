export type CategoryType = 'General' | 'Work' | 'Personal' | 'Health' | 'Urgent' | 'Study';

export type RepeatFrequency = 'none' | 'interval' | 'daily' | 'weekly';

export interface DisabledTimeRange {
  enabled: boolean;
  startTime: string; // "HH:mm" in 24h format, e.g. "22:00"
  endTime: string;   // "HH:mm" in 24h format, e.g. "08:00"
}

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  scheduledTime: string; // ISO 8601 string
  repeatFrequency: RepeatFrequency;
  intervalMinutes?: number; // e.g. 15, 30, 45, 60, 120
  stopAt?: string; // ISO 8601 string: optional cutoff time to stop repeating
  pausedUntil?: string; // ISO 8601 string: temporary pause / mute until this time
  disabledTimeRange?: DisabledTimeRange; // specific daily quiet/disabled hours
  category: CategoryType;
  notificationId?: string;
  isCompleted: boolean;
  createdAt: string;
}

export type FilterStatus = 'all' | 'today' | 'upcoming' | 'completed';
