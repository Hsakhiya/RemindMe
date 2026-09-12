import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ThemeColors,
  ThemeKey,
  BackgroundKey,
  createTheme,
  THEME_PRESETS,
  BACKGROUND_PRESETS,
} from '../theme/theme';

interface ThemeContextType {
  theme: ThemeColors;
  themeKey: ThemeKey;
  backgroundKey: BackgroundKey;
  setThemeKey: (key: ThemeKey) => Promise<void>;
  setBackgroundKey: (key: BackgroundKey) => Promise<void>;
}

const STORAGE_THEME_KEY = '@remindme_theme_accent_v1';
const STORAGE_BG_KEY = '@remindme_theme_bg_v1';

const defaultTheme = createTheme('indigo', 'slate');

const ThemeContext = createContext<ThemeContextType>({
  theme: defaultTheme,
  themeKey: 'indigo',
  backgroundKey: 'slate',
  setThemeKey: async () => {},
  setBackgroundKey: async () => {},
});

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [themeKey, setThemeKeyState] = useState<ThemeKey>('indigo');
  const [backgroundKey, setBackgroundKeyState] = useState<BackgroundKey>('slate');

  useEffect(() => {
    loadSavedTheme();
  }, []);

  const loadSavedTheme = async () => {
    try {
      const [savedAccent, savedBg] = await Promise.all([
        AsyncStorage.getItem(STORAGE_THEME_KEY),
        AsyncStorage.getItem(STORAGE_BG_KEY),
      ]);

      if (savedAccent && THEME_PRESETS[savedAccent as ThemeKey]) {
        setThemeKeyState(savedAccent as ThemeKey);
      }
      if (savedBg && BACKGROUND_PRESETS[savedBg as BackgroundKey]) {
        setBackgroundKeyState(savedBg as BackgroundKey);
      }
    } catch (e) {
      console.warn('Failed to load saved theme preferences:', e);
    }
  };

  const setThemeKey = async (key: ThemeKey) => {
    setThemeKeyState(key);
    try {
      await AsyncStorage.setItem(STORAGE_THEME_KEY, key);
    } catch (e) {
      console.warn('Failed to save theme accent preference:', e);
    }
  };

  const setBackgroundKey = async (key: BackgroundKey) => {
    setBackgroundKeyState(key);
    try {
      await AsyncStorage.setItem(STORAGE_BG_KEY, key);
    } catch (e) {
      console.warn('Failed to save theme background preference:', e);
    }
  };

  const theme = createTheme(themeKey, backgroundKey);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeKey,
        backgroundKey,
        setThemeKey,
        setBackgroundKey,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => useContext(ThemeContext);
