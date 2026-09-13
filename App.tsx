import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Text,
  Alert,
  Vibration,
  BackHandler,
  Platform,
  AppState,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { Reminder, FilterStatus, CategoryType } from './src/types/reminder';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import {
  loadReminders,
  addReminder,
  updateReminder,
  toggleReminderStatus,
  deleteReminder,
  snoozeReminder,
  pauseReminder,
  resumeReminder,
} from './src/services/storageService';
import {
  initNotifications,
  requestNotificationPermissions,
  setupNotificationListeners,
  getLastNotificationAlarm,
  isExpoGo,
} from './src/services/notificationService';
import { AlarmNativeService } from './src/services/alarmNativeService';
import {
  isWithinDisabledRange,
  calculateNextIntervalTime,
} from './src/utils/intervalUtils';
import { Header } from './src/components/Header';
import { FilterBar } from './src/components/FilterBar';
import { ReminderCard } from './src/components/ReminderCard';
import { AddReminderModal } from './src/components/AddReminderModal';
import { SettingsModal } from './src/components/SettingsModal';
import { FullScreenAlarmModal } from './src/components/FullScreenAlarmModal';
import { EmptyState } from './src/components/EmptyState';

function ReminderMainScreen() {
  const { theme } = useTheme();

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasFullScreenPermission, setHasFullScreenPermission] = useState(true);

  // Filters
  const [currentTab, setCurrentTab] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | 'All'>('All');

  // Modals
  const [modalVisible, setModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [activeAlarmReminder, setActiveAlarmReminder] = useState<Reminder | null>(null);
  const [isLockScreenAlarm, setIsLockScreenAlarm] = useState(false);

  // Track triggered reminders in this session to prevent duplicate popups
  const triggeredRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // 1. Initialize notification channel and permissions safely
    initNotifications();
    requestNotificationPermissions();

    if (Platform.OS === 'android') {
      AlarmNativeService.canUseFullScreenIntent().then((canUse) => {
        setHasFullScreenPermission(canUse);
      });
    }

    // 2. Load stored reminders
    fetchReminders();

    // 3. Set up notification event listeners (receives lock-screen full-screen intents)
    const unsubscribeListeners = setupNotificationListeners(
      () => {
        fetchReminders();
      },
      (reminderId, data, isLockScreen) => {
        triggerAlarmScreen(reminderId, data, isLockScreen ?? true);
      }
    );

    // 4. Check if app was opened via notification/fullScreenIntent on cold start
    getLastNotificationAlarm().then((alarmData) => {
      if (alarmData?.reminderId) {
        triggerAlarmScreen(alarmData.reminderId, alarmData.data, true);
      }
    });

    // 5. In-App Timer Check: checks every 10 seconds for any due reminders
    const timerInterval = setInterval(() => {
      checkDueReminders();
    }, 10000);

    // 6. Listen for app foregrounding to re-check full-screen permission when returning from settings
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && Platform.OS === 'android') {
        AlarmNativeService.canUseFullScreenIntent().then((canUse) => {
          setHasFullScreenPermission(canUse);
        });
      }
    });

    return () => {
      unsubscribeListeners();
      clearInterval(timerInterval);
      appStateSub.remove();
    };
  }, []);

  const triggerAlarmScreen = async (reminderId: string, data?: any, isLockScreen: boolean = false) => {
    setIsLockScreenAlarm(isLockScreen);
    if (data?.testAlarm || reminderId === 'test_alarm_preview') {
      setActiveAlarmReminder({
        id: 'test_alarm_preview',
        title: data?.title || 'Test Full-Screen Alarm',
        description: data?.description || 'Lock-screen alarm triggered successfully!',
        scheduledTime: new Date().toISOString(),
        repeatFrequency: 'none',
        category: (data?.category as CategoryType) || 'Urgent',
        isCompleted: false,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    const currentList = await loadReminders();
    const found = currentList.find((r) => r.id === reminderId);
    if (found && !found.isCompleted) {
      setActiveAlarmReminder(found);
    }
  };

  const handleDismissAlarm = async () => {
    if (!activeAlarmReminder) return;
    const reminderId = activeAlarmReminder.id;
    const wasLockScreen = isLockScreenAlarm;

    if (wasLockScreen) {
      // Exit app immediately so screen cleanly returns to secure lock screen without exposing reminders list
      BackHandler.exitApp();
    }

    if (reminderId !== 'test_alarm_preview') {
      await handleToggle(reminderId);
    }
    setActiveAlarmReminder(null);
    setIsLockScreenAlarm(false);
  };

  const handleSnoozeAlarm = async () => {
    if (!activeAlarmReminder) return;
    const reminderId = activeAlarmReminder.id;
    const wasLockScreen = isLockScreenAlarm;

    if (wasLockScreen) {
      BackHandler.exitApp();
    }

    if (reminderId !== 'test_alarm_preview') {
      await handleSnooze(reminderId);
    }
    setActiveAlarmReminder(null);
    setIsLockScreenAlarm(false);
  };

  const fetchReminders = async () => {
    try {
      const data = await loadReminders();
      setReminders(data);
    } catch (error) {
      console.error('Error fetching reminders:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  /**
   * Check for due reminders and present an in-app alert with vibration
   */
  const checkDueReminders = async () => {
    try {
      const currentList = await loadReminders();
      const now = Date.now();

      for (const r of currentList) {
        if (r.isCompleted) continue;

        // If paused and pause duration has not yet passed, skip
        if (r.pausedUntil && new Date(r.pausedUntil).getTime() > now) {
          continue;
        }

        // If has a stop cutoff time that has passed, mark as complete / expired
        if (r.stopAt && new Date(r.stopAt).getTime() <= now) {
          await toggleReminderStatus(r.id);
          continue;
        }

        // If interval reminder and currently within quiet/disabled hours, advance silently without vibrating
        if (
          r.repeatFrequency === 'interval' &&
          r.disabledTimeRange?.enabled &&
          isWithinDisabledRange(new Date(), r.disabledTimeRange)
        ) {
          await advanceInterval(r);
          continue;
        }

        const dueTime = new Date(r.scheduledTime).getTime();
        // Trigger if due within past 60 seconds and not already triggered in this cycle
        if (dueTime <= now && now - dueTime < 60000 && !triggeredRef.current.has(r.id)) {
          triggeredRef.current.add(r.id);
          Vibration.vibrate([0, 400, 200, 400]);

          const isInterval = r.repeatFrequency === 'interval';
          const intervalMins = r.intervalMinutes || 30;

          Alert.alert(
            `⏰ Reminder: ${r.title}`,
            isInterval
              ? `${r.description || ''}\n(Interval: every ${intervalMins}m)`
              : r.description || `It's time for your ${r.category} task!`,
            [
              {
                text: 'Pause 1h',
                onPress: () =>
                  handlePause(
                    r.id,
                    new Date(Date.now() + 60 * 60 * 1000).toISOString()
                  ),
              },
              {
                text: isInterval ? 'Next' : 'Snooze 10m',
                onPress: () =>
                  isInterval ? advanceInterval(r) : handleSnooze(r.id),
              },
              {
                text: 'Mark Done',
                style: 'default',
                onPress: () => handleToggle(r.id),
              },
            ],
            { cancelable: false }
          );

          // If interval reminder, automatically schedule the next occurrence
          if (isInterval) {
            advanceInterval(r);
          }
        }
      }
    } catch (error) {
      console.warn('Error checking due reminders:', error);
    }
  };

  /**
   * Advance an interval reminder to its next scheduled cycle
   */
  const advanceInterval = async (reminder: Reminder) => {
    const nextDue = calculateNextIntervalTime(
      reminder.scheduledTime,
      reminder.intervalMinutes || 30,
      reminder.disabledTimeRange
    );

    // If stopAt cutoff is reached, stop repeating
    if (reminder.stopAt && nextDue.getTime() > new Date(reminder.stopAt).getTime()) {
      await toggleReminderStatus(reminder.id);
      fetchReminders();
      return;
    }

    const updated = await updateReminder({
      ...reminder,
      scheduledTime: nextDue.toISOString(),
    });
    triggeredRef.current.delete(reminder.id);
    setReminders(updated);
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchReminders();
  };

  const handleToggle = async (id: string) => {
    const updated = await toggleReminderStatus(id);
    setReminders(updated);
  };

  const handleDelete = async (id: string) => {
    const updated = await deleteReminder(id);
    setReminders(updated);
  };

  const handleSnooze = async (id: string) => {
    triggeredRef.current.delete(id);
    const updated = await snoozeReminder(id, 10);
    setReminders(updated);
  };

  const handlePause = async (id: string, pauseUntilISO: string) => {
    triggeredRef.current.delete(id);
    const updated = await pauseReminder(id, pauseUntilISO);
    setReminders(updated);
  };

  const handleResume = async (id: string) => {
    triggeredRef.current.delete(id);
    const updated = await resumeReminder(id);
    setReminders(updated);
  };

  const handleSaveReminder = async (
    data: Omit<Reminder, 'id' | 'createdAt' | 'isCompleted' | 'notificationId'>
  ) => {
    if (editingReminder) {
      const updatedItem: Reminder = {
        ...editingReminder,
        ...data,
      };
      triggeredRef.current.delete(updatedItem.id);
      const updatedList = await updateReminder(updatedItem);
      setReminders(updatedList);
      setEditingReminder(null);
    } else {
      const created = await addReminder(data);
      setReminders((prev) => [created, ...prev]);
    }
  };

  const handleOpenEdit = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setModalVisible(true);
  };

  const handleOpenAdd = () => {
    setEditingReminder(null);
    setModalVisible(true);
  };

  // Metrics
  const metrics = useMemo(() => {
    const totalPending = reminders.filter((r) => !r.isCompleted).length;
    const totalCompleted = reminders.filter((r) => r.isCompleted).length;

    const today = new Date();
    const totalToday = reminders.filter((r) => {
      if (r.isCompleted) return false;
      const d = new Date(r.scheduledTime);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    }).length;

    return { totalPending, totalToday, totalCompleted };
  }, [reminders]);

  // Filter and sort
  const filteredReminders = useMemo(() => {
    const today = new Date();

    return reminders
      .filter((reminder) => {
        if (currentTab === 'completed') {
          if (!reminder.isCompleted) return false;
        } else if (currentTab === 'today') {
          if (reminder.isCompleted) return false;
          const d = new Date(reminder.scheduledTime);
          const isSameDay =
            d.getFullYear() === today.getFullYear() &&
            d.getMonth() === today.getMonth() &&
            d.getDate() === today.getDate();
          if (!isSameDay) return false;
        } else if (currentTab === 'upcoming') {
          if (reminder.isCompleted) return false;
          const target = new Date(reminder.scheduledTime).getTime();
          const endOfToday = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            23,
            59,
            59
          ).getTime();
          if (target <= endOfToday) return false;
        }

        if (selectedCategory !== 'All' && reminder.category !== selectedCategory) {
          return false;
        }

        if (searchQuery.trim().length > 0) {
          const q = searchQuery.toLowerCase();
          const matchesTitle = reminder.title.toLowerCase().includes(q);
          const matchesDesc = reminder.description?.toLowerCase().includes(q);
          if (!matchesTitle && !matchesDesc) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (a.isCompleted !== b.isCompleted) {
          return a.isCompleted ? 1 : -1;
        }
        return new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime();
      });
  }, [reminders, currentTab, selectedCategory, searchQuery]);

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: theme.background,
        },
      ]}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <ExpoStatusBar style="light" />
      <StatusBar
        barStyle="light-content"
        backgroundColor={theme.background}
      />

      {/* Expo Go info banner if running in Expo Go */}
      {isExpoGo() && (
        <View style={styles.expoGoBanner}>
          <Ionicons name="information-circle-outline" size={16} color={theme.accent} />
          <Text style={[styles.expoGoBannerText, { color: theme.accent }]}>
            Expo Go Mode • In-app alerts enabled
          </Text>
        </View>
      )}

      {/* Lock screen permission warning banner on Android (especially Google Pixel & Android 14+) */}
      {!hasFullScreenPermission && Platform.OS === 'android' && (
        <TouchableOpacity
          style={styles.permissionBanner}
          onPress={async () => {
            await AlarmNativeService.openFullScreenIntentSettings();
            setTimeout(async () => {
              const allowed = await AlarmNativeService.canUseFullScreenIntent();
              setHasFullScreenPermission(allowed);
            }, 1500);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="warning-outline" size={20} color="#F59E0B" />
          <View style={styles.permissionBannerContent}>
            <Text style={styles.permissionBannerTitle}>
              Pixel / Android 14 Full-Screen Permission
            </Text>
            <Text style={styles.permissionBannerSubtitle}>
              Tap here to toggle ON "Allow full-screen notifications" in Settings so alarms wake up your screen!
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#F59E0B" />
        </TouchableOpacity>
      )}

      {/* App Header & Stat Overview */}
      <Header
        totalPending={metrics.totalPending}
        totalToday={metrics.totalToday}
        totalCompleted={metrics.totalCompleted}
        onOpenSettings={() => setSettingsVisible(true)}
      />

      {/* Filter and Search Bar */}
      <FilterBar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* Reminders List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textMuted }]}>
            Loading your reminders...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredReminders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              filter={currentTab}
              isSearching={searchQuery.length > 0}
              onAddPress={handleOpenAdd}
            />
          }
          renderItem={({ item }) => (
            <ReminderCard
              reminder={item}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onSnooze={handleSnooze}
              onPause={handlePause}
              onResume={handleResume}
              onPress={handleOpenEdit}
            />
          )}
        />
      )}

      {/* Floating Action Button (+) */}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: theme.primary,
            shadowColor: theme.primary,
          },
        ]}
        activeOpacity={0.85}
        onPress={handleOpenAdd}
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add / Edit Modal */}
      <AddReminderModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveReminder}
        initialReminder={editingReminder}
      />

      {/* Settings & Theme Customizer Modal */}
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />

      {/* Full-Screen Lock-Screen Alarm Modal */}
      <FullScreenAlarmModal
        visible={!!activeAlarmReminder}
        reminder={activeAlarmReminder}
        onDismiss={handleDismissAlarm}
        onSnooze={handleSnoozeAlarm}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ReminderMainScreen />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: 4,
  },
  expoGoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(56, 189, 248, 0.2)',
  },
  expoGoBannerText: {
    fontSize: 12,
    fontWeight: '500',
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.3)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 10,
  },
  permissionBannerContent: {
    flex: 1,
  },
  permissionBannerTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  permissionBannerSubtitle: {
    color: '#CBD5E1',
    fontSize: 11,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 100,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
});
