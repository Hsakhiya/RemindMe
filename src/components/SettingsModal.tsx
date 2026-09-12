import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import {
  THEME_PRESETS,
  BACKGROUND_PRESETS,
  ThemeKey,
  BackgroundKey,
} from '../theme/theme';
import { sendTestNotificationNow } from '../services/notificationService';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const { theme, themeKey, backgroundKey, setThemeKey, setBackgroundKey } = useTheme();

  const handleTestAlert = async () => {
    await sendTestNotificationNow();
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
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              ACCENT COLOR THEME
            </Text>
            <View style={styles.accentGrid}>
              {(Object.keys(THEME_PRESETS) as ThemeKey[]).map((key) => {
                const preset = THEME_PRESETS[key];
                const isSelected = themeKey === key;
                return (
                  <TouchableOpacity
                    key={key}
                    activeOpacity={0.8}
                    style={[
                      styles.accentCard,
                      {
                        backgroundColor: theme.background,
                        borderColor: isSelected
                          ? preset.primary
                          : theme.surfaceBorder,
                      },
                      isSelected && styles.accentCardSelected,
                    ]}
                    onPress={() => setThemeKey(key)}
                  >
                    <View
                      style={[
                        styles.colorCircle,
                        { backgroundColor: preset.primary },
                      ]}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.accentName,
                        {
                          color: isSelected ? theme.text : theme.textMuted,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {preset.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Section: Background Style */}
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.textSecondary, marginTop: 20 },
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

            {/* App Info Footer */}
            <View style={styles.infoFooter}>
              <Text style={[styles.appVersion, { color: theme.textMuted }]}>
                RemindMe v1.0.0 • Offline & Private
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
  accentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  accentCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 10,
  },
  accentCardSelected: {
    borderWidth: 2,
  },
  colorCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentName: {
    fontSize: 13,
    flex: 1,
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
  infoFooter: {
    alignItems: 'center',
    marginTop: 24,
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
