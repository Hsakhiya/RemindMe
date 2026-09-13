import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useTheme } from '../context/ThemeContext';
import {
  THEME_PRESETS,
  BACKGROUND_PRESETS,
  ThemeKey,
  BackgroundKey,
} from '../theme/theme';
import { sendTestNotificationNow, scheduleTestAlarm } from '../services/notificationService';
import { AlarmNativeService } from '../services/alarmNativeService';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const { theme, themeKey, backgroundKey, setThemeKey, setBackgroundKey } = useTheme();

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const buildNumber = Constants.expoConfig?.android?.versionCode ?? 1;

  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatusText, setUpdateStatusText] = useState<string | null>(null);
  const [alarmCountdown, setAlarmCountdown] = useState<number | null>(null);

  const handleTestAlert = async () => {
    await sendTestNotificationNow();
  };

  const handleTestFullScreenAlarm = async () => {
    Alert.alert(
      'Test Full-Screen Lock Alarm',
      'The test alarm will trigger in 5 seconds.\n\n👉 LOCK YOUR PHONE NOW to test whether the screen wakes up and displays the full-screen alarm over your lock screen!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start 5s Test',
          style: 'default',
          onPress: async () => {
            setAlarmCountdown(5);
            await scheduleTestAlarm(5);
            const timer = setInterval(() => {
              setAlarmCountdown((prev) => {
                if (prev === null || prev <= 1) {
                  clearInterval(timer);
                  return null;
                }
                return prev - 1;
              });
            }, 1000);
          },
        },
      ]
    );
  };

  const handleCheckUpdates = async () => {
    if (!Updates.isEnabled) {
      Alert.alert(
        'Development Mode',
        'Over-The-Air (OTA) updates are active in installed APK builds. Updates are disabled when running in Expo Go or local dev server.'
      );
      return;
    }

    try {
      setCheckingUpdate(true);
      setUpdateStatusText('Checking for updates...');
      const check = await Updates.checkForUpdateAsync();
      if (check.isAvailable) {
        setUpdateStatusText('Downloading update...');
        await Updates.fetchUpdateAsync();
        setUpdateStatusText('Update ready to apply');
        Alert.alert(
          'Update Downloaded',
          'A new version has been downloaded over the air. Restart the app now to apply the changes?',
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Restart Now',
              style: 'default',
              onPress: async () => {
                await Updates.reloadAsync();
              },
            },
          ]
        );
      } else {
        setUpdateStatusText('App is up to date');
        Alert.alert('Up to Date', 'You are running the latest version of RemindMe.');
      }
    } catch (error: any) {
      setUpdateStatusText('Check failed');
      Alert.alert(
        'Update Check',
        error?.message || 'Unable to check for updates right now. Please verify your internet connection.'
      );
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: theme.surface,
              borderColor: theme.surfaceBorder,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Ionicons name="color-palette" size={22} color={theme.primaryLight} />
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Theme & Settings
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Section: Accent Color */}
            <View style={styles.colorHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginBottom: 0 }]}>
                ACCENT COLOR
              </Text>
              <View
                style={[
                  styles.activeColorBadge,
                  {
                    backgroundColor: `${THEME_PRESETS[themeKey]?.primary}18`,
                    borderColor: `${THEME_PRESETS[themeKey]?.primary}40`,
                  },
                ]}
              >
                <View
                  style={[
                    styles.activeColorDot,
                    { backgroundColor: THEME_PRESETS[themeKey]?.primary },
                  ]}
                />
                <Text
                  style={[
                    styles.activeColorText,
                    { color: THEME_PRESETS[themeKey]?.primaryLight },
                  ]}
                >
                  {THEME_PRESETS[themeKey]?.name}
                </Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.colorSwatchesContainer}
              style={styles.colorSwatchesScroll}
            >
              {(Object.keys(THEME_PRESETS) as ThemeKey[]).map((key) => {
                const preset = THEME_PRESETS[key];
                const isSelected = themeKey === key;
                return (
                  <TouchableOpacity
                    key={key}
                    activeOpacity={0.7}
                    onPress={() => setThemeKey(key)}
                    style={[
                      styles.swatchTouchTarget,
                      isSelected && {
                        borderColor: preset.primary,
                        backgroundColor: `${preset.primary}20`,
                      },
                    ]}
                    accessibilityLabel={preset.name}
                  >
                    <View
                      style={[
                        styles.swatchCircle,
                        { backgroundColor: preset.primary },
                      ]}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Section: Background Style */}
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.textSecondary, marginTop: 16 },
              ]}
            >
              BACKGROUND STYLE
            </Text>
            <View style={styles.bgRow}>
              {(Object.keys(BACKGROUND_PRESETS) as BackgroundKey[]).map(
                (bgId) => {
                  const bgPreset = BACKGROUND_PRESETS[bgId];
                  const isSelected = backgroundKey === bgId;
                  return (
                    <TouchableOpacity
                      key={bgId}
                      activeOpacity={0.8}
                      style={[
                        styles.bgCard,
                        {
                          backgroundColor: bgPreset.background,
                          borderColor: isSelected
                            ? theme.primary
                            : theme.surfaceBorder,
                        },
                      ]}
                      onPress={() => setBackgroundKey(bgId)}
                    >
                      <View style={styles.bgCardHeader}>
                        <View
                          style={[
                            styles.bgDot,
                            { backgroundColor: bgPreset.surface },
                          ]}
                        />
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color={theme.primary}
                          />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.bgName,
                          {
                            color: isSelected ? theme.text : theme.textMuted,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {bgPreset.name}
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </View>

            {/* Section: Alerts Test */}
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.textSecondary, marginTop: 20 },
              ]}
            >
              NOTIFICATIONS & ALERTS
            </Text>
            <TouchableOpacity
              style={[
                styles.testAlertBox,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.surfaceBorder,
                },
              ]}
              onPress={handleTestAlert}
              activeOpacity={0.8}
            >
              <View style={styles.testAlertInfo}>
                <Ionicons
                  name="notifications-circle"
                  size={30}
                  color={theme.primaryLight}
                />
                <View>
                  <Text style={[styles.testAlertTitle, { color: theme.text }]}>
                    Test Sound & Vibration
                  </Text>
                  <Text
                    style={[styles.testAlertSubtitle, { color: theme.textMuted }]}
                  >
                    Triggers a test reminder alert immediately
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            {/* Test Full-Screen Alarm (5s Delay) */}
            <TouchableOpacity
              style={[
                styles.testAlertBox,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.surfaceBorder,
                  marginTop: 10,
                },
              ]}
              onPress={handleTestFullScreenAlarm}
              activeOpacity={0.8}
            >
              <View style={styles.testAlertInfo}>
                <Ionicons
                  name="alarm"
                  size={30}
                  color="#EF4444"
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.testAlertTitle, { color: theme.text }]}>
                    {alarmCountdown !== null
                      ? `Alarm firing in ${alarmCountdown}s! Lock now!`
                      : 'Test Full-Screen Lock Alarm'}
                  </Text>
                  <Text
                    style={[styles.testAlertSubtitle, { color: theme.textMuted }]}
                  >
                    Fires in 5s — lock your screen to test wake-up
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.badgeContainer,
                  { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
                ]}
              >
                <Text style={[styles.badgeText, { color: '#EF4444', fontSize: 11 }]}>
                  {alarmCountdown !== null ? `${alarmCountdown}s` : '5s Test'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Lock Screen Permissions (Android 14+ / OEM Display Over Lock Screen) */}
            <TouchableOpacity
              style={[
                styles.testAlertBox,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.surfaceBorder,
                  marginTop: 10,
                },
              ]}
              onPress={() => AlarmNativeService.openFullScreenIntentSettings()}
              activeOpacity={0.8}
            >
              <View style={styles.testAlertInfo}>
                <Ionicons
                  name="shield-checkmark"
                  size={30}
                  color={theme.primaryLight}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.testAlertTitle, { color: theme.text }]}>
                    Lock Screen & Alarm Permission
                  </Text>
                  <Text
                    style={[styles.testAlertSubtitle, { color: theme.textMuted }]}
                  >
                    Check & allow 'Show on lock screen' and full-screen intents
                  </Text>
                </View>
              </View>
              <Ionicons name="open-outline" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            {/* Section: About & App Info */}
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.textSecondary, marginTop: 20 },
              ]}
            >
              ABOUT & SYSTEM INFO
            </Text>
            <View
              style={[
                styles.aboutCard,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.surfaceBorder,
                },
              ]}
            >
              <View style={styles.aboutRow}>
                <View style={styles.aboutLabelGroup}>
                  <Ionicons name="information-circle-outline" size={18} color={theme.primaryLight} />
                  <Text style={[styles.aboutLabel, { color: theme.text }]}>App Version</Text>
                </View>
                <View style={styles.versionBadgeGroup}>
                  <View style={[styles.badgeContainer, { backgroundColor: `${theme.primary}20` }]}>
                    <Text style={[styles.badgeText, { color: theme.primaryLight }]}>
                      v{appVersion}
                    </Text>
                  </View>
                  {Updates.isEnabled && (
                    <View
                      style={[
                        styles.badgeContainer,
                        {
                          backgroundColor: Updates.isEmbeddedLaunch
                            ? `${theme.surfaceBorder}`
                            : '#10B98120',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          {
                            fontSize: 11,
                            color: Updates.isEmbeddedLaunch ? theme.textMuted : '#10B981',
                          },
                        ]}
                      >
                        {Updates.isEmbeddedLaunch ? 'Base APK' : 'OTA Live'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={[styles.aboutDivider, { backgroundColor: theme.surfaceBorder }]} />

              <View style={styles.aboutRow}>
                <View style={styles.aboutLabelGroup}>
                  <Ionicons name="git-commit-outline" size={18} color={theme.textMuted} />
                  <Text style={[styles.aboutLabel, { color: theme.text }]}>Build Code</Text>
                </View>
                <Text style={[styles.aboutValue, { color: theme.textMuted }]}>
                  #{buildNumber}
                </Text>
              </View>

              <View style={[styles.aboutDivider, { backgroundColor: theme.surfaceBorder }]} />

              <View style={styles.aboutRow}>
                <View style={styles.aboutLabelGroup}>
                  <Ionicons name="cloud-download-outline" size={18} color={theme.primaryLight} />
                  <Text style={[styles.aboutLabel, { color: theme.text }]}>OTA Channel</Text>
                </View>
                <Text style={[styles.aboutValue, { color: theme.textMuted }]}>
                  {Updates.channel || (Updates.isEnabled ? 'preview' : 'Disabled in Dev')}
                </Text>
              </View>

              <View style={[styles.aboutDivider, { backgroundColor: theme.surfaceBorder }]} />

              <View style={styles.aboutRow}>
                <View style={styles.aboutLabelGroup}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#10B981" />
                  <Text style={[styles.aboutLabel, { color: theme.text }]}>Privacy & Storage</Text>
                </View>
                <Text style={[styles.aboutValue, { color: '#10B981' }]}>
                  100% Offline
                </Text>
              </View>
            </View>

            {/* Check for Updates CTA */}
            <TouchableOpacity
              style={[
                styles.updateCheckCard,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.surfaceBorder,
                },
              ]}
              onPress={handleCheckUpdates}
              disabled={checkingUpdate}
              activeOpacity={0.8}
            >
              <View style={styles.updateCheckLeft}>
                <Ionicons
                  name={checkingUpdate ? 'sync' : 'refresh-circle-outline'}
                  size={24}
                  color={theme.primaryLight}
                />
                <View style={styles.updateCheckTextContainer}>
                  <Text style={[styles.updateCheckTitle, { color: theme.text }]}>
                    Check for Updates (OTA)
                  </Text>
                  <Text
                    style={[styles.updateCheckSubtitle, { color: theme.textMuted }]}
                    numberOfLines={1}
                  >
                    {updateStatusText ||
                      (Updates.isEnabled
                        ? 'Download latest features without reinstalling APK'
                        : 'Over-The-Air updates active in APK builds')}
                  </Text>
                </View>
              </View>
              {checkingUpdate ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              )}
            </TouchableOpacity>

            {/* App Info Footer */}
            <View style={styles.infoFooter}>
              <Text style={[styles.appVersion, { color: theme.textMuted }]}>
                RemindMe • Built with React Native & Expo
              </Text>
            </View>
          </ScrollView>

          {/* Close CTA */}
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: theme.primary }]}
            onPress={onClose}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '85%',
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  colorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  activeColorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  activeColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeColorText: {
    fontSize: 12,
    fontWeight: '700',
  },
  colorSwatchesScroll: {
    marginBottom: 4,
  },
  colorSwatchesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  swatchTouchTarget: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
  },
  bgRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bgCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  bgCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bgDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  bgName: {
    fontSize: 12,
  },
  testAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  testAlertInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  testAlertTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  testAlertSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  aboutCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  aboutLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aboutLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  aboutValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  aboutDivider: {
    height: StyleSheet.hairlineWidth,
  },
  badgeContainer: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  versionBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  updateCheckCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
  },
  updateCheckLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  updateCheckTextContainer: {
    flex: 1,
  },
  updateCheckTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  updateCheckSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  infoFooter: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  appVersion: {
    fontSize: 12,
  },
  doneBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
