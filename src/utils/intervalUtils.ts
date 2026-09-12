import { DisabledTimeRange } from '../types/reminder';

/**
 * Parse a "HH:mm" 24-hour time string into numeric hours and minutes.
 */
export function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  if (!timeStr) return { hours: 0, minutes: 0 };
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0] || '0', 10);
  const minutes = parseInt(parts[1] || '0', 10);
  return {
    hours: isNaN(hours) ? 0 : Math.min(23, Math.max(0, hours)),
    minutes: isNaN(minutes) ? 0 : Math.min(59, Math.max(0, minutes)),
  };
}

/**
 * Check if a given Date falls within a disabled time range (e.g. 22:00 to 08:00).
 * Accurately handles overnight windows spanning midnight.
 */
export function isWithinDisabledRange(
  date: Date,
  range?: DisabledTimeRange
): boolean {
  if (!range || !range.enabled || !range.startTime || !range.endTime) {
    return false;
  }

  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const start = parseTimeString(range.startTime);
  const end = parseTimeString(range.endTime);
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;

  if (startMinutes === endMinutes) {
    return false;
  }

  // Same-day window (e.g. 13:00 to 15:00)
  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  // Overnight window spanning midnight (e.g. 22:00 to 08:00)
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

/**
 * When a scheduled time falls inside the disabled range, find the exact moment
 * when the disabled range concludes and notifications resume.
 */
export function getNextResumeTimeFromDisabledRange(
  date: Date,
  range: DisabledTimeRange
): Date {
  const resume = new Date(date);
  const end = parseTimeString(range.endTime);
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const endMinutes = end.hours * 60 + end.minutes;

  resume.setHours(end.hours, end.minutes, 0, 0);

  // If the end time is earlier in the day than current time (e.g. current is 23:00, end is 08:00),
  // then the resume time is tomorrow morning at 08:00.
  if (endMinutes <= currentMinutes) {
    resume.setDate(resume.getDate() + 1);
  }

  return resume;
}

/**
 * Calculate the next valid upcoming cycle for an interval reminder.
 * If the scheduled time has passed, calculates the next cycle from now.
 * If that cycle falls within the disabled range, it advances to when the range ends.
 */
export function calculateNextIntervalTime(
  scheduledTime: string,
  intervalMinutes: number,
  disabledRange?: DisabledTimeRange
): Date {
  const startMs = new Date(scheduledTime).getTime();
  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;
  const nowMs = Date.now();

  let nextDate: Date;

  if (startMs > nowMs) {
    nextDate = new Date(startMs);
  } else {
    // Determine how many complete cycles have elapsed and find the next future cycle
    const cyclesPassed = Math.floor((nowMs - startMs) / intervalMs) + 1;
    nextDate = new Date(startMs + cyclesPassed * intervalMs);
  }

  // If nextDate falls inside quiet / disabled hours, push to the resume time
  if (disabledRange?.enabled && isWithinDisabledRange(nextDate, disabledRange)) {
    nextDate = getNextResumeTimeFromDisabledRange(nextDate, disabledRange);
  }

  return nextDate;
}

/**
 * Format a 24h "HH:mm" time string into human-friendly 12-hour format (e.g. "10:00 PM").
 */
export function formatTimeString12h(timeStr: string): string {
  const { hours, minutes } = parseTimeString(timeStr);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Format a time range into "10:00 PM – 8:00 AM".
 */
export function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTimeString12h(startTime)} – ${formatTimeString12h(endTime)}`;
}
