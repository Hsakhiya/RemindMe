import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FilterStatus, CategoryType } from '../types/reminder';
import { useTheme } from '../context/ThemeContext';

interface FilterBarProps {
  currentTab: FilterStatus;
  onSelectTab: (tab: FilterStatus) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: CategoryType | 'All';
  onSelectCategory: (cat: CategoryType | 'All') => void;
}

const TABS: { id: FilterStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Done' },
];

const CATEGORIES: (CategoryType | 'All')[] = [
  'All',
  'General',
  'Work',
  'Personal',
  'Health',
  'Urgent',
  'Study',
];

export const FilterBar: React.FC<FilterBarProps> = ({
  currentTab,
  onSelectTab,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
}) => {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: theme.surface,
            borderColor: theme.surfaceBorder,
          },
        ]}
      >
        <Ionicons name="search" size={17} color={theme.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search reminders..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={onSearchChange}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange('')}>
            <Ionicons name="close-circle" size={17} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs Row */}
      <View
        style={[
          styles.tabsRow,
          {
            backgroundColor: theme.surface,
            borderColor: theme.surfaceBorder,
          },
        ]}
      >
        {TABS.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                isActive && { backgroundColor: theme.primary },
              ]}
              onPress={() => onSelectTab(tab.id)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: isActive ? '#FFFFFF' : theme.textMuted },
                  isActive && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Category Scroll Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
      >
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[
                styles.catFilterChip,
                {
                  backgroundColor: theme.surface,
                  borderColor: isActive
                    ? theme.primaryLight
                    : theme.surfaceBorder,
                },
                isActive && {
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                },
              ]}
              onPress={() => onSelectCategory(cat)}
            >
              <Text
                style={[
                  styles.catFilterText,
                  {
                    color: isActive ? theme.primaryLight : theme.textMuted,
                  },
                  isActive && styles.catFilterTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  tabsRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  categoryScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  catFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  catFilterText: {
    fontSize: 12,
    fontWeight: '500',
  },
  catFilterTextActive: {
    fontWeight: '700',
  },
});
