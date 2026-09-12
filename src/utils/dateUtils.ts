/**
 * Utility functions for date and time formatting and comparisons.
 */

export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();

  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) {
    return 'Today';
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate();

  if (isTomorrow) {
    return 'Tomorrow';
  }

  return date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatFullDateTime(isoString: string): string {
  return `${formatDate(isoString)} at ${formatTime(isoString)}`;
}

export function getTimeStatus(
  isoString: string,
  isCompleted: boolean
): { label: string; isOverdue: boolean; isToday: boolean } {
  if (isCompleted) {
    return { label: 'Completed', isOverdue: false, isToday: false };
  }

  const target = new Date(isoString).getTime();
  const now = Date.now();
  const diffMinutes = Math.round((target - now) / 60000);

  const date = new Date(isoString);
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (diffMinutes < 0) {
    const overdueMinutes = Math.abs(diffMinutes);
    if (overdueMinutes < 60) {
      return { label: `${overdueMinutes}m overdue`, isOverdue: true, isToday };
    }
    const overdueHours = Math.round(overdueMinutes / 60);
    if (overdueHours < 24) {
      return { label: `${overdueHours}h overdue`, isOverdue: true, isToday };
    }
    const overdueDays = Math.round(overdueHours / 24);
    return { label: `${overdueDays}d overdue`, isOverdue: true, isToday };
  }

  if (diffMinutes === 0) {
    return { label: 'Due now', isOverdue: false, isToday: true };
  }

  if (diffMinutes < 60) {
    return { label: `In ${diffMinutes}m`, isOverdue: false, isToday: true };
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24 && isToday) {
    return { label: `Today, in ${diffHours}h`, isOverdue: false, isToday: true };
  }

  return { label: formatFullDateTime(isoString), isOverdue: false, isToday };
}
