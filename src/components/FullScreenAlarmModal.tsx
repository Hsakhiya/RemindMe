import React, { useEffect, useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Reminder } from '../types/reminder';
import { useTheme } from '../context/ThemeContext';
import { AlarmNativeService } from '../services/alarmNativeService';

interface FullScreenAlarmModalProps {
  visible: boolean;
  reminder: Reminder | null;
  onDismiss: () => void;
  onSnooze: (minutes?: number) => void;
}

export const FullScreenAlarmModal: React.FC<FullScreenAlarmModalProps> = ({
  visible,
  reminder,
  onDismiss,
  onSnooze,
}) => {
  const { theme } = useTheme();

  // Clock state
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  // Pulse animation for alarm bell
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  // Update clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setCurrentDate(
        now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Continuous vibration, alarm ringtone audio, and pulsing animation while visible
  useEffect(() => {
    let animInstance: Animated.CompositeAnimation | null = null;

    if (visible) {
      // Wake up physical display and play system alarm ringtone on loop
      AlarmNativeService.wakeScreen();
      AlarmNativeService.playAlarmSound();

      // Continuous looping vibration pattern
      Vibration.vibrate([0, 800, 400, 800, 400, 1000], true);

      // Pulse animation
      animInstance = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.15,
              duration: 700,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 700,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 0.9,
              duration: 700,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.3,
              duration: 700,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      animInstance.start();
    } else {
      AlarmNativeService.stopAlarmSound();
      Vibration.cancel();
    }

    return () => {
      AlarmNativeService.stopAlarmSound();
      Vibration.cancel();
      if (animInstance) {
        animInstance.stop();
      }
    };
  }, [visible]);

  if (!visible) return null;

  const title = reminder?.title || 'Reminder Alert';
  const description = reminder?.description || 'Your scheduled reminder has arrived';
  const category = reminder?.category || 'Urgent';

  const handleDismiss = () => {
    AlarmNativeService.stopAlarmSound();
    Vibration.cancel();
    onDismiss();
  };

  const handleSnooze = () => {
    AlarmNativeService.stopAlarmSound();
    Vibration.cancel();
    onSnooze(10);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
      <View style={styles.container}>
        {/* Ambient background glow */}
        <Animated.View
          style={[
            styles.ambientGlow,
            {
              backgroundColor: theme.primary,
              opacity: glowAnim,
            },
          ]}
        />

        {/* Top bar: Clock & Date */}
        <View style={styles.clockSection}>
          <Text style={styles.timeText}>{currentTime}</Text>
          <Text style={styles.dateText}>{currentDate}</Text>
        </View>

        {/* Center: Pulsing Icon & Reminder Info */}
        <View style={styles.centerSection}>
          <Animated.View
            style={[
              styles.iconWrapper,
              {
                borderColor: theme.primary,
                backgroundColor: `${theme.primary}20`,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Ionicons name="alarm" size={64} color={theme.primaryLight} />
          </Animated.View>

          {/* Category Pill */}
          <View style={[styles.categoryBadge, { backgroundColor: `${theme.primary}25`, borderColor: theme.primary }]}>
            <Ionicons name="pricetag" size={12} color={theme.primaryLight} />
            <Text style={[styles.categoryText, { color: theme.primaryLight }]}>
              {category.toUpperCase()}
            </Text>
          </View>

          {/* Title & Notes */}
          <Text style={styles.titleText}>{title}</Text>
          {description ? (
            <Text style={styles.descriptionText}>{description}</Text>
          ) : null}
        </View>

        {/* Bottom Actions: Snooze & Dismiss */}
        <View style={styles.actionsSection}>
          {/* Snooze Button */}
          <TouchableOpacity
            style={[styles.snoozeBtn, { borderColor: theme.surfaceBorder }]}
            onPress={handleSnooze}
            activeOpacity={0.8}
          >
            <Ionicons name="time-outline" size={22} color="#F59E0B" />
            <Text style={styles.snoozeBtnText}>Snooze (+10m)</Text>
          </TouchableOpacity>

          {/* Dismiss / Done Button */}
          <TouchableOpacity
            style={[styles.dismissBtn, { backgroundColor: '#10B981' }]}
            onPress={handleDismiss}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle" size={26} color="#FFFFFF" />
            <Text style={styles.dismissBtnText}>Dismiss & Mark Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070A13',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 48,
    alignItems: 'center',
  },
  ambientGlow: {
    position: 'absolute',
    top: '25%',
    width: 280,
    height: 280,
    borderRadius: 140,
    filter: 'blur(70px)',
  },
  clockSection: {
    alignItems: 'center',
  },
  timeText: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'],
  },
  dateText: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  centerSection: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 12,
  },
  iconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    elevation: 8,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  titleText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 34,
  },
  descriptionText: {
    fontSize: 15,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: '90%',
  },
  actionsSection: {
    width: '100%',
    gap: 14,
  },
  snoozeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    paddingVertical: 16,
    borderRadius: 16,
    width: '100%',
  },
  snoozeBtnText: {
    color: '#F59E0B',
    fontSize: 16,
    fontWeight: '700',
  },
  dismissBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    width: '100%',
    elevation: 6,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  dismissBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
