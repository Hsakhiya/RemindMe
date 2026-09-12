import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { sendTestNotificationNow } from '../services/notificationService';

interface HeaderProps {
  totalPending: number;
  totalToday: number;
  totalCompleted: number;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  totalPending,
  totalToday,
  totalCompleted,
  onOpenSettings,
}) => {
  const { theme } = useTheme();

  const handleTestNotification = async () => {
    const id = await sendTestNotificationNow();
    if (id) {
      Alert.alert(
        'Test Notification Sent',
        'A test alert has been scheduled for 2 seconds from now. Check your notification shade!'
      );
    } else {
      Alert.alert(
        'Permission Denied',
        'Notification permission is disabled. Please enable it in Android App Settings.'
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Top row: Branding + Actions */}
      <View style={styles.topRow}>
        <View style={styles.branding}>
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: theme.primary,
                shadowColor: theme.primary,
              },
            ]}
          >
            <Ionicons name="notifications" size={20} color="#FFFFFF" />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>RemindMe</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Scheduled Alerts & Tasks
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {/* Test Notification Button */}
          <TouchableOpacity
            style={[
              styles.testBtn,
              {
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                borderColor: 'rgba(56, 189, 248, 0.3)',
              },
            ]}
            onPress={handleTestNotification}
            activeOpacity={0.8}
          >
            <Ionicons name="flash" size={14} color={theme.accent} />
            <Text style={[styles.testBtnText, { color: theme.accent }]}>
              Test
            </Text>
          </TouchableOpacity>

          {/* Settings Button */}
          <TouchableOpacity
            style={[
              styles.settingsBtn,
              {
                backgroundColor: theme.surface,
                borderColor: theme.surfaceBorder,
              },
            ]}
            onPress={onOpenSettings}
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsRow}>
        <View
          style={[
            styles.metricCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.surfaceBorder,
            },
          ]}
        >
          <Text style={[styles.metricNumber, { color: theme.text }]}>
            {totalPending}
          </Text>
          <Text style={[styles.metricLabel, { color: theme.textMuted }]}>
            Pending
          </Text>
        </View>

        <View
          style={[
            styles.metricCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.surfaceBorder,
            },
          ]}
        >
          <Text style={[styles.metricNumber, { color: theme.accent }]}>
            {totalToday}
          </Text>
          <Text style={[styles.metricLabel, { color: theme.textMuted }]}>
            Due Today
          </Text>
        </View>

        <View
          style={[
            styles.metricCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.surfaceBorder,
            },
          ]}
        >
          <Text style={[styles.metricNumber, { color: theme.success }]}>
            {totalCompleted}
          </Text>
          <Text style={[styles.metricLabel, { color: theme.textMuted }]}>
            Done
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  branding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  testBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  metricNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  metricLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
});
