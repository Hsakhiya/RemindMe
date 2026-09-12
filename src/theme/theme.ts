import { CategoryType } from '../types/reminder';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceLight: string;
  surfaceBorder: string;

  primary: string;
  primaryLight: string;
  primaryDark: string;

  accent: string;
  success: string;
  warning: string;
  danger: string;

  text: string;
  textMuted: string;
  textSecondary: string;
}

export type ThemeKey =
  | 'indigo'
  | 'emerald'
  | 'ocean'
  | 'purple'
  | 'rose'
  | 'amber'
  | 'teal'
  | 'coral';

export type BackgroundKey = 'slate' | 'amoled' | 'midnight';

export interface ThemePreset {
  id: ThemeKey;
  name: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  accent: string;
}

export const THEME_PRESETS: Record<ThemeKey, ThemePreset> = {
  indigo: {
    id: 'indigo',
    name: 'Indigo Dream',
    primary: '#6366F1',
    primaryLight: '#818CF8',
    primaryDark: '#4338CA',
    accent: '#38BDF8',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Forest',
    primary: '#10B981',
    primaryLight: '#34D399',
    primaryDark: '#059669',
    accent: '#6EE7B7',
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean Wave',
    primary: '#0284C7',
    primaryLight: '#38BDF8',
    primaryDark: '#0369A1',
    accent: '#7DD3FC',
  },
  purple: {
    id: 'purple',
    name: 'Royal Violet',
    primary: '#8B5CF6',
    primaryLight: '#A78BFA',
    primaryDark: '#6D28D9',
    accent: '#C084FC',
  },
  rose: {
    id: 'rose',
    name: 'Sunset Rose',
    primary: '#F43F5E',
    primaryLight: '#FB7185',
    primaryDark: '#E11D48',
    accent: '#FDA4AF',
  },
  amber: {
    id: 'amber',
    name: 'Golden Amber',
    primary: '#F59E0B',
    primaryLight: '#FBBF24',
    primaryDark: '#D97706',
    accent: '#FDE68A',
  },
  teal: {
    id: 'teal',
    name: 'Electric Teal',
    primary: '#0D9488',
    primaryLight: '#2DD4BF',
    primaryDark: '#0F766E',
    accent: '#5EEAD4',
  },
  coral: {
    id: 'coral',
    name: 'Warm Coral',
    primary: '#FB7185',
    primaryLight: '#FDA4AF',
    primaryDark: '#E11D48',
    accent: '#FDBA74',
  },
};

export const BACKGROUND_PRESETS: Record<
  BackgroundKey,
  { id: BackgroundKey; name: string; background: string; surface: string; surfaceLight: string; surfaceBorder: string }
> = {
  slate: {
    id: 'slate',
    name: 'Dark Slate',
    background: '#0F172A',
    surface: '#1E293B',
    surfaceLight: '#334155',
    surfaceBorder: '#475569',
  },
  amoled: {
    id: 'amoled',
    name: 'AMOLED Black',
    background: '#000000',
    surface: '#121212',
    surfaceLight: '#242424',
    surfaceBorder: '#333333',
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Navy',
    background: '#0B1120',
    surface: '#162032',
    surfaceLight: '#23324C',
    surfaceBorder: '#2E4163',
  },
};

export function createTheme(themeKey: ThemeKey = 'indigo', bgKey: BackgroundKey = 'slate'): ThemeColors {
  const accent = THEME_PRESETS[themeKey] || THEME_PRESETS.indigo;
  const bg = BACKGROUND_PRESETS[bgKey] || BACKGROUND_PRESETS.slate;

  return {
    background: bg.background,
    surface: bg.surface,
    surfaceLight: bg.surfaceLight,
    surfaceBorder: bg.surfaceBorder,

    primary: accent.primary,
    primaryLight: accent.primaryLight,
    primaryDark: accent.primaryDark,
    accent: accent.accent,

    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',

    text: '#F8FAFC',
    textMuted: '#94A3B8',
    textSecondary: '#CBD5E1',
  };
}

export const COLORS = createTheme('indigo', 'slate');

export const CATEGORY_CONFIG: Record<
  CategoryType,
  { label: string; color: string; bg: string; icon: string }
> = {
  General: {
    label: 'General',
    color: '#818CF8',
    bg: 'rgba(129, 140, 248, 0.15)',
    icon: 'bookmark-outline',
  },
  Work: {
    label: 'Work',
    color: '#38BDF8',
    bg: 'rgba(56, 189, 248, 0.15)',
    icon: 'briefcase-outline',
  },
  Personal: {
    label: 'Personal',
    color: '#34D399',
    bg: 'rgba(52, 211, 153, 0.15)',
    icon: 'person-outline',
  },
  Health: {
    label: 'Health',
    color: '#F472B6',
    bg: 'rgba(244, 114, 182, 0.15)',
    icon: 'heart-outline',
  },
  Urgent: {
    label: 'Urgent',
    color: '#FB7185',
    bg: 'rgba(251, 113, 133, 0.2)',
    icon: 'alert-circle-outline',
  },
  Study: {
    label: 'Study',
    color: '#FBBF24',
    bg: 'rgba(251, 191, 36, 0.15)',
    icon: 'book-outline',
  },
};
