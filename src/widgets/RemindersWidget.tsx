import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { Reminder } from '../types/reminder';
import { isWithinDisabledRange, formatTimeString12h } from '../utils/intervalUtils';

interface RemindersWidgetProps {
  reminders?: Reminder[];
}

export const RemindersWidget: React.FC<RemindersWidgetProps> = ({
  reminders = [],
}) => {
  const pendingReminders = reminders
    .filter((r) => !r.isCompleted)
    .sort(
      (a, b) =>
        new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
    );

  const displayedReminders = pendingReminders.slice(0, 3);
  const now = new Date();

  const formatTime = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#0F172A',
        borderRadius: 16,
        padding: 12,
        borderColor: '#334155',
        borderWidth: 1,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
      clickAction="OPEN_APP"
    >
      {/* Header Bar */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextWidget
            text="RemindMe"
            style={{
              color: '#818CF8',
              fontSize: 14,
              fontWeight: 'bold',
            }}
          />
          <TextWidget
            text={` • ${pendingReminders.length} Active`}
            style={{
              color: '#94A3B8',
              fontSize: 12,
            }}
          />
        </FlexWidget>

        <FlexWidget
          style={{
            backgroundColor: '#4F46E5',
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
          clickAction="OPEN_APP"
        >
          <TextWidget
            text="+ Open"
            style={{
              color: '#FFFFFF',
              fontSize: 11,
              fontWeight: 'bold',
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* Reminders List or Empty State */}
      {displayedReminders.length === 0 ? (
        <FlexWidget
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
          }}
        >
          <TextWidget
            text="✨ All caught up!"
            style={{
              color: '#E2E8F0',
              fontSize: 13,
              fontWeight: 'bold',
              marginBottom: 2,
            }}
          />
          <TextWidget
            text="Tap to open and create a reminder"
            style={{
              color: '#64748B',
              fontSize: 11,
            }}
          />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ flexDirection: 'column', flex: 1 }}>
          {displayedReminders.map((reminder, index) => {
            const isPaused =
              reminder.pausedUntil && new Date(reminder.pausedUntil) > now;
            const isInsideQuietHours =
              reminder.repeatFrequency === 'interval' &&
              reminder.disabledTimeRange?.enabled &&
              isWithinDisabledRange(now, reminder.disabledTimeRange);

            const timeDisplay = isPaused
              ? `⏸ Paused until ${formatTime(reminder.pausedUntil!)}`
              : isInsideQuietHours
              ? `🌙 Quiet (resumes ${formatTimeString12h(reminder.disabledTimeRange!.endTime)})`
              : reminder.repeatFrequency === 'interval'
              ? `🔁 Every ${reminder.intervalMinutes ?? 30}m (${formatTime(reminder.scheduledTime)})`
              : `🕒 ${formatTime(reminder.scheduledTime)}`;

            return (
              <FlexWidget
                key={reminder.id || index.toString()}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#1E293B',
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  marginBottom: index < displayedReminders.length - 1 ? 6 : 0,
                  borderColor: '#334155',
                  borderWidth: 1,
                }}
              >
                <FlexWidget style={{ flexDirection: 'column', flex: 1 }}>
                  <TextWidget
                    text={reminder.title}
                    style={{
                      color: '#F8FAFC',
                      fontSize: 12,
                      fontWeight: 'bold',
                    }}
                    truncate="END"
                    maxLines={1}
                  />
                  <TextWidget
                    text={timeDisplay}
                    style={{
                      color: isPaused || isInsideQuietHours ? '#F59E0B' : '#94A3B8',
                      fontSize: 10,
                      marginTop: 2,
                    }}
                    truncate="END"
                    maxLines={1}
                  />
                </FlexWidget>

                <FlexWidget
                  style={{
                    backgroundColor: '#10B98125',
                    borderColor: '#10B981',
                    borderWidth: 1,
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    marginLeft: 6,
                  }}
                  clickAction="COMPLETE_REMINDER"
                  clickActionData={{ reminderId: reminder.id }}
                >
                  <TextWidget
                    text="✓ Done"
                    style={{
                      color: '#10B981',
                      fontSize: 10,
                      fontWeight: 'bold',
                    }}
                  />
                </FlexWidget>
              </FlexWidget>
            );
          })}
        </FlexWidget>
      )}
    </FlexWidget>
  );
};
