export type CategoryType = 'General' | 'Work' | 'Personal' | 'Health' | 'Urgent' | 'Study';

export type RepeatFrequency = 'none' | 'interval' | 'daily' | 'weekly';

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  scheduledTime: string; // ISO 8601 string
  repeatFrequency: RepeatFrequency;
  intervalMinutes?: number; // e.g. 15, 30, 45, 60, 120
  stopAt?: string; // ISO 8601 string: optional cutoff time to stop repeating
  pausedUntil?: string; // ISO 8601 string: temporary pause / mute until this time
  category: CategoryType;
  notificationId?: string;
  isCompleted: boolean;
  createdAt: string;
}

export type FilterStatus = 'all' | 'today' | 'upcoming' | 'completed';
