import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Reminder } from '../types/reminder';
import { CATEGORY_CONFIG } from '../theme/theme';
import { useTheme } from '../context/ThemeContext';
import { getTimeStatus, formatTime, formatDate } from '../utils/dateUtils';

interface ReminderCardProps {
  reminder: Reminder;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onSnooze: (id: string) => void;
  onPause?: (id: string, pauseUntilISO: string) => void;
  onResume?: (id: string) => void;
  onPress?: (reminder: Reminder) => void;
}

export const ReminderCard: React.FC<ReminderCardProps> = ({
  reminder,
  onToggle,
  onDelete,
  onSnooze,
  onPause,
  onResume,
  onPress,
}) => {
  const { theme } = useTheme();
  const categoryInfo = CATEGORY_CONFIG[reminder.category] || CATEGORY_CONFIG.General;
  const timeStatus = getTimeStatus(reminder.scheduledTime, reminder.isCompleted);

  const isPaused =
    !!reminder.pausedUntil &&
    new Date(reminder.pausedUntil).getTime() > Date.now();

  const isExpired =
    !!reminder.stopAt && new Date(reminder.stopAt).getTime() <= Date.now();

  const confirmDelete = () => {
    Alert.alert(
      'Delete Reminder',
      `Are you sure you want to delete "${reminder.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(reminder.id),
        },
      ]
    );
  };

  const promptPauseOptions = () => {
    Alert.alert(
      'Pause Notifications',
      `Stop notifications for "${reminder.title}" for a specific time:`,
      [
        {
          text: '30 Minutes',
          onPress: () =>
            onPause &&
            onPause(
              reminder.id,
              new Date(Date.now() + 30 * 60 * 1000).toISOString()
            ),
        },
        {
          text: '1 Hour',
          onPress: () =>
            onPause &&
            onPause(
              reminder.id,
              new Date(Date.now() + 60 * 60 * 1000).toISOString()
            ),
        },
        {
          text: '2 Hours',
          onPress: () =>
            onPause &&
            onPause(
              reminder.id,
              new Date(Date.now() + 120 * 60 * 1000).toISOString()
            ),
        },
        {
          text: 'Until Tomorrow 9 AM',
          onPress: () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(9, 0, 0, 0);
            onPause && onPause(reminder.id, tomorrow.toISOString());
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress && onPress(reminder)}
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.surfaceBorder,
        },
        reminder.isCompleted && styles.cardCompleted,
        timeStatus.isOverdue && !isPaused && styles.cardOverdue,
        isPaused && styles.cardPaused,
      ]}
    >
      <View style={styles.contentRow}>
        {/* Toggle Checkbox */}
        <TouchableOpacity
          style={styles.checkButton}
          onPress={() => onToggle(reminder.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={reminder.isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
            size={26}
            color={reminder.isCompleted ? theme.success : theme.primaryLight}
          />
        </TouchableOpacity>

        {/* Text Details */}
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.title,
              { color: theme.text },
              reminder.isCompleted && { color: theme.textMuted },
              reminder.isCompleted && styles.titleCompleted,
            ]}
            numberOfLines={2}
          >
            {reminder.title}
          </Text>

          {reminder.description ? (
            <Text
              style={[
                styles.description,
                { color: theme.textSecondary },
                reminder.isCompleted && { color: theme.textMuted },
                reminder.isCompleted && styles.descriptionCompleted,
              ]}
              numberOfLines={2}
            >
              {reminder.description}
            </Text>
          ) : null}

          {/* Metadata Row: Badges */}
          <View style={styles.badgesRow}>
            {/* Paused Badge */}
            {isPaused && (
              <View style={[styles.badge, styles.badgePaused]}>
                <Ionicons name="pause-circle" size={13} color="#F59E0B" />
                <Text style={[styles.badgeText, { color: '#F59E0B', fontWeight: '700' }]}>
                  Paused until {formatTime(reminder.pausedUntil!)}
                </Text>
              </View>
            )}

            {/* Time / Status Badge */}
            {!isPaused && (
              <View
                style={[
                  styles.badge,
                  timeStatus.isOverdue
                    ? styles.badgeDanger
                    : { backgroundColor: 'rgba(56, 189, 248, 0.12)' },
                ]}
              >
                <Ionicons
                  name={timeStatus.isOverdue ? 'alert-circle' : 'time-outline'}
                  size={13}
                  color={timeStatus.isOverdue ? theme.danger : theme.accent}
                />
                <Text
                  style={[
                    styles.badgeText,
                    timeStatus.isOverdue
                      ? styles.badgeDangerText
                      : { color: theme.accent },
                  ]}
                >
                  {timeStatus.label}
                </Text>
              </View>
            )}

            {/* Interval Badge */}
            {reminder.repeatFrequency === 'interval' && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
                ]}
              >
                <Ionicons name="timer" size={12} color="#10B981" />
                <Text style={[styles.badgeText, { color: '#10B981', fontWeight: '600' }]}>
                  Every {reminder.intervalMinutes || 30}m
                </Text>
              </View>
            )}

            {/* Daily / Weekly Badge */}
            {(reminder.repeatFrequency === 'daily' ||
              reminder.repeatFrequency === 'weekly') && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: 'rgba(99, 102, 241, 0.15)' },
                ]}
              >
                <Ionicons name="repeat" size={12} color={theme.primaryLight} />
                <Text style={[styles.badgeText, { color: theme.primaryLight }]}>
                  {reminder.repeatFrequency === 'daily' ? 'Daily' : 'Weekly'}
                </Text>
              </View>
            )}

            {/* Stop Time Badge */}
            {reminder.stopAt && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isExpired
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(245, 158, 11, 0.12)',
                  },
                ]}
              >
                <Ionicons
                  name="stopwatch"
                  size={12}
                  color={isExpired ? theme.danger : '#F59E0B'}
                />
                <Text
                  style={[
                    styles.badgeText,
                    { color: isExpired ? theme.danger : '#F59E0B' },
                  ]}
                >
                  {isExpired
                    ? 'Stopped'
                    : `Ends ${formatTime(reminder.stopAt)}`}
                </Text>
              </View>
            )}

            {/* Category Badge */}
            <View
              style={[
                styles.badge,
                { backgroundColor: categoryInfo.bg },
              ]}
            >
              <Text style={[styles.badgeText, { color: categoryInfo.color }]}>
                {categoryInfo.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsColumn}>
          {!reminder.isCompleted && !isExpired && (
            <>
              {/* Pause / Resume Button */}
              {isPaused ? (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => onResume && onResume(reminder.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="play-circle" size={22} color={theme.success} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={promptPauseOptions}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="pause-circle-outline"
                    size={20}
                    color={theme.warning}
                  />
                </TouchableOpacity>
              )}

              {/* Snooze Button */}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => onSnooze(reminder.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="timer-outline" size={19} color={theme.accent} />
              </TouchableOpacity>
            </>
          )}

          {/* Delete Button */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={confirmDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  cardCompleted: {
    opacity: 0.6,
  },
  cardOverdue: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  cardPaused: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkButton: {
    marginRight: 12,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
  },
  description: {
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  descriptionCompleted: {
    textDecorationLine: 'line-through',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  badgeDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  badgeDangerText: {
    color: '#EF4444',
    fontWeight: '600',
  },
  badgePaused: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  actionsColumn: {
    marginLeft: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  actionBtn: {
    padding: 3,
  },
});
