import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { FilterStatus } from '../types/reminder';

interface EmptyStateProps {
  filter: FilterStatus;
  isSearching: boolean;
  onAddPress: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  filter,
  isSearching,
  onAddPress,
}) => {
  const { theme } = useTheme();

  let title = 'No Reminders Yet';
  let subtitle = 'Schedule a reminder and you will be alerted at the exact time.';
  let iconName: keyof typeof Ionicons.glyphMap = 'notifications-outline';

  if (isSearching) {
    title = 'No matches found';
    subtitle = 'Try searching with a different keyword.';
    iconName = 'search-outline';
  } else if (filter === 'today') {
    title = 'All clear for today!';
    subtitle = 'You have no pending reminders scheduled for today.';
    iconName = 'sunny-outline';
  } else if (filter === 'upcoming') {
    title = 'No upcoming reminders';
    subtitle = 'Add tasks you want to be notified about in the future.';
    iconName = 'calendar-outline';
  } else if (filter === 'completed') {
    title = 'No completed reminders';
    subtitle = 'Completed tasks will be recorded here.';
    iconName = 'checkmark-done-circle-outline';
  }

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            borderColor: 'rgba(99, 102, 241, 0.2)',
          },
        ]}
      >
        <Ionicons name={iconName} size={42} color={theme.primaryLight} />
      </View>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>
        {subtitle}
      </Text>

      {!isSearching && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: theme.primary }]}
          onPress={onAddPress}
        >
          <Ionicons name="add-circle" size={18} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>Add Reminder</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 30,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
