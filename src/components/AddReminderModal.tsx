import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  KeyboardAvoidingView,
  Switch,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Reminder, CategoryType, RepeatFrequency } from '../types/reminder';
import { CATEGORY_CONFIG } from '../theme/theme';
import { useTheme } from '../context/ThemeContext';
import { formatDate, formatTime } from '../utils/dateUtils';

interface AddReminderModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (
    data: Omit<Reminder, 'id' | 'createdAt' | 'isCompleted' | 'notificationId'>
  ) => void;
  initialReminder?: Reminder | null;
}

const CATEGORIES: CategoryType[] = [
  'General',
  'Work',
  'Personal',
  'Health',
  'Urgent',
  'Study',
];

const REPEAT_OPTIONS: { label: string; value: RepeatFrequency }[] = [
  { label: 'One-time', value: 'none' },
  { label: 'Interval', value: 'interval' },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
];

const INTERVAL_PRESETS: { label: string; minutes: number }[] = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '4 hours', minutes: 240 },
];

export const AddReminderModal: React.FC<AddReminderModalProps> = ({
  visible,
  onClose,
  onSave,
  initialReminder,
}) => {
  const { theme } = useTheme();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [category, setCategory] = useState<CategoryType>('General');
  const [repeatFrequency, setRepeatFrequency] = useState<RepeatFrequency>('none');
  const [intervalMinutes, setIntervalMinutes] = useState<number>(30);
  const [hasStopTime, setHasStopTime] = useState<boolean>(false);
  const [stopAtDate, setStopAtDate] = useState<Date>(
    new Date(Date.now() + 4 * 60 * 60 * 1000)
  );

  // Picker state for start Date/Time
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);

  // Picker state for stop Date/Time
  const [stopPickerMode, setStopPickerMode] = useState<'date' | 'time' | null>(null);

  useEffect(() => {
    if (initialReminder) {
      setTitle(initialReminder.title);
      setDescription(initialReminder.description || '');
      setSelectedDate(new Date(initialReminder.scheduledTime));
      setCategory(initialReminder.category);
      setRepeatFrequency(initialReminder.repeatFrequency);
      setIntervalMinutes(initialReminder.intervalMinutes || 30);
      if (initialReminder.stopAt) {
        setHasStopTime(true);
        setStopAtDate(new Date(initialReminder.stopAt));
      } else {
        setHasStopTime(false);
        setStopAtDate(new Date(Date.now() + 4 * 60 * 60 * 1000));
      }
    } else {
      const defaultTime = new Date(Date.now() + 60 * 60 * 1000);
      defaultTime.setMinutes(Math.ceil(defaultTime.getMinutes() / 5) * 5, 0, 0);
      setTitle('');
      setDescription('');
      setSelectedDate(defaultTime);
      setCategory('General');
      setRepeatFrequency('none');
      setIntervalMinutes(30);
      setHasStopTime(false);
      setStopAtDate(new Date(Date.now() + 4 * 60 * 60 * 1000));
    }
  }, [initialReminder, visible]);

  const handlePickerChange = (event: DateTimePickerEvent, date?: Date) => {
    setPickerMode(null);
    if (event.type === 'set' && date) {
      setSelectedDate(date);
    }
  };

  const handleStopPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    setStopPickerMode(null);
    if (event.type === 'set' && date) {
      setStopAtDate(date);
    }
  };

  const applyPreset = (preset: '15m' | '1h' | 'tonight' | 'tomorrow') => {
    const now = new Date();
    if (preset === '15m') {
      setSelectedDate(new Date(now.getTime() + 15 * 60 * 1000));
    } else if (preset === '1h') {
      setSelectedDate(new Date(now.getTime() + 60 * 60 * 1000));
    } else if (preset === 'tonight') {
      const tonight = new Date();
      tonight.setHours(20, 0, 0, 0);
      if (tonight.getTime() <= now.getTime()) {
        tonight.setDate(tonight.getDate() + 1);
      }
      setSelectedDate(tonight);
    } else if (preset === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      setSelectedDate(tomorrow);
    }
  };

  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Missing Title', 'Please provide a title for your reminder.');
      return;
    }

    const now = new Date();
    if (repeatFrequency === 'none' && selectedDate.getTime() <= now.getTime()) {
      Alert.alert(
        'Time in the Past',
        'The scheduled time is in the past. Please choose a future time.'
      );
      return;
    }

    if (hasStopTime && stopAtDate.getTime() <= selectedDate.getTime()) {
      Alert.alert(
        'Invalid Stop Time',
        'The stop time must be after the starting scheduled time.'
      );
      return;
    }

    onSave({
      title: trimmedTitle,
      description: description.trim() || undefined,
      scheduledTime: selectedDate.toISOString(),
      category,
      repeatFrequency,
      intervalMinutes: repeatFrequency === 'interval' ? intervalMinutes : undefined,
      stopAt: hasStopTime ? stopAtDate.toISOString() : undefined,
    });

    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
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
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {initialReminder ? 'Edit Reminder' : 'New Reminder'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Title Input */}
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Title *
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.surfaceBorder,
                  color: theme.text,
                },
              ]}
              placeholder="e.g. Drink water, stretch, take medicine..."
              placeholderTextColor={theme.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
            />

            {/* Description / Notes */}
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Notes (Optional)
            </Text>
            <TextInput
              style={[
                styles.textInput,
                styles.textArea,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.surfaceBorder,
                  color: theme.text,
                },
              ]}
              placeholder="Additional details or instructions..."
              placeholderTextColor={theme.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              maxLength={200}
            />

            {/* Quick Presets (for start time) */}
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Quick Start Time
            </Text>
            <View style={styles.presetRow}>
              <TouchableOpacity
                style={[styles.presetBtn, { backgroundColor: theme.surfaceLight }]}
                onPress={() => applyPreset('15m')}
              >
                <Text style={[styles.presetText, { color: theme.accent }]}>
                  +15 min
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.presetBtn, { backgroundColor: theme.surfaceLight }]}
                onPress={() => applyPreset('1h')}
              >
                <Text style={[styles.presetText, { color: theme.accent }]}>
                  +1 hour
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.presetBtn, { backgroundColor: theme.surfaceLight }]}
                onPress={() => applyPreset('tonight')}
              >
                <Text style={[styles.presetText, { color: theme.accent }]}>
                  Tonight (8 PM)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.presetBtn, { backgroundColor: theme.surfaceLight }]}
                onPress={() => applyPreset('tomorrow')}
              >
                <Text style={[styles.presetText, { color: theme.accent }]}>
                  Tomorrow (9 AM)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Start Date and Time Pickers */}
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Start Date & Time *
            </Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={[
                  styles.pickerTrigger,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.surfaceBorder,
                  },
                ]}
                onPress={() => setPickerMode('date')}
              >
                <Ionicons name="calendar-outline" size={18} color={theme.accent} />
                <Text style={[styles.pickerTriggerText, { color: theme.text }]}>
                  {formatDate(selectedDate.toISOString())}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.pickerTrigger,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.surfaceBorder,
                  },
                ]}
                onPress={() => setPickerMode('time')}
              >
                <Ionicons name="time-outline" size={18} color={theme.accent} />
                <Text style={[styles.pickerTriggerText, { color: theme.text }]}>
                  {formatTime(selectedDate.toISOString())}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Native Date Time Picker dialog */}
            {pickerMode && (
              <DateTimePicker
                value={selectedDate}
                mode={pickerMode}
                is24Hour={false}
                display="default"
                onChange={handlePickerChange}
              />
            )}

            {/* Repeat Frequency Options */}
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Repeat Option
            </Text>
            <View style={styles.repeatRow}>
              {REPEAT_OPTIONS.map((opt) => {
                const isSelected = repeatFrequency === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.repeatChip,
                      {
                        backgroundColor: isSelected
                          ? theme.primary
                          : theme.background,
                        borderColor: isSelected
                          ? theme.primary
                          : theme.surfaceBorder,
                      },
                    ]}
                    onPress={() => setRepeatFrequency(opt.value)}
                  >
                    <Text
                      style={[
                        styles.repeatChipText,
                        { color: isSelected ? '#FFFFFF' : theme.textMuted },
                        isSelected && styles.repeatChipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Interval Specific Settings */}
            {repeatFrequency === 'interval' && (
              <View
                style={[
                  styles.intervalSection,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.surfaceBorder,
                  },
                ]}
              >
                <View style={styles.intervalHeader}>
                  <Ionicons name="timer-outline" size={18} color={theme.accent} />
                  <Text style={[styles.intervalTitle, { color: theme.text }]}>
                    Notify Every:
                  </Text>
                </View>

                {/* Preset intervals */}
                <View style={styles.intervalPresetsRow}>
                  {INTERVAL_PRESETS.map((item) => {
                    const isSelected = intervalMinutes === item.minutes;
                    return (
                      <TouchableOpacity
                        key={item.minutes}
                        style={[
                          styles.intervalChip,
                          {
                            backgroundColor: isSelected
                              ? theme.primary
                              : theme.surface,
                            borderColor: isSelected
                              ? theme.primary
                              : theme.surfaceBorder,
                          },
                        ]}
                        onPress={() => setIntervalMinutes(item.minutes)}
                      >
                        <Text
                          style={[
                            styles.intervalChipText,
                            { color: isSelected ? '#FFFFFF' : theme.textMuted },
                          ]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Custom Minutes Input */}
                <View style={styles.customIntervalRow}>
                  <Text style={[styles.customIntervalLabel, { color: theme.textMuted }]}>
                    Or custom interval:
                  </Text>
                  <TextInput
                    style={[
                      styles.customIntervalInput,
                      {
                        color: theme.text,
                        borderColor: theme.surfaceBorder,
                        backgroundColor: theme.surface,
                      },
                    ]}
                    keyboardType="numeric"
                    value={intervalMinutes.toString()}
                    onChangeText={(val) => {
                      const num = parseInt(val, 10);
                      if (!isNaN(num) && num > 0) {
                        setIntervalMinutes(num);
                      }
                    }}
                    maxLength={4}
                  />
                  <Text style={[styles.customIntervalLabel, { color: theme.textMuted }]}>
                    minutes
                  </Text>
                </View>
              </View>
            )}

            {/* Optional Stop Time Toggle & Pickers */}
            {(repeatFrequency === 'interval' || repeatFrequency === 'daily') && (
              <View
                style={[
                  styles.stopTimeCard,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.surfaceBorder,
                  },
                ]}
              >
                <View style={styles.stopTimeToggleRow}>
                  <View style={styles.stopTimeLabelContainer}>
                    <Ionicons name="stopwatch-outline" size={18} color={theme.warning} />
                    <View>
                      <Text style={[styles.stopTimeTitle, { color: theme.text }]}>
                        Stop Repeating At
                      </Text>
                      <Text style={[styles.stopTimeSubtitle, { color: theme.textMuted }]}>
                        Automatically end alerts after a specific time
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={hasStopTime}
                    onValueChange={setHasStopTime}
                    trackColor={{ false: theme.surfaceBorder, true: theme.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {hasStopTime && (
                  <View style={styles.dateTimeRow}>
                    <TouchableOpacity
                      style={[
                        styles.pickerTrigger,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.surfaceBorder,
                        },
                      ]}
                      onPress={() => setStopPickerMode('date')}
                    >
                      <Ionicons name="calendar" size={16} color={theme.warning} />
                      <Text style={[styles.pickerTriggerText, { color: theme.text }]}>
                        {formatDate(stopAtDate.toISOString())}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.pickerTrigger,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.surfaceBorder,
                        },
                      ]}
                      onPress={() => setStopPickerMode('time')}
                    >
                      <Ionicons name="time" size={16} color={theme.warning} />
                      <Text style={[styles.pickerTriggerText, { color: theme.text }]}>
                        {formatTime(stopAtDate.toISOString())}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {stopPickerMode && (
                  <DateTimePicker
                    value={stopAtDate}
                    mode={stopPickerMode}
                    is24Hour={false}
                    display="default"
                    onChange={handleStopPickerChange}
                  />
                )}
              </View>
            )}

            {/* Category Selector */}
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Category
            </Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((cat) => {
                const conf = CATEGORY_CONFIG[cat];
                const isSelected = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: isSelected ? conf.color : conf.bg,
                        borderColor: conf.color,
                      },
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: isSelected ? '#FFFFFF' : conf.color },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={[
                styles.cancelBtn,
                { backgroundColor: theme.surfaceLight },
              ]}
              onPress={onClose}
            >
              <Text
                style={[styles.cancelBtnText, { color: theme.textSecondary }]}
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.primary }]}
              onPress={handleSave}
            >
              <Ionicons name="notifications" size={18} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>
                {initialReminder ? 'Update' : 'Schedule'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '92%',
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  presetText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerTrigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  pickerTriggerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  repeatRow: {
    flexDirection: 'row',
    gap: 8,
  },
  repeatChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
  },
  repeatChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  repeatChipTextActive: {
    fontWeight: '700',
  },
  intervalSection: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  intervalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  intervalTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  intervalPresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  intervalChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  intervalChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  customIntervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  customIntervalLabel: {
    fontSize: 13,
  },
  customIntervalInput: {
    width: 60,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  stopTimeCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  stopTimeToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stopTimeLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  stopTimeTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  stopTimeSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
