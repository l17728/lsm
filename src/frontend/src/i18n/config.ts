/**
 * Internationalization (i18n) Configuration
 * Supports Chinese (zh) and English (en)
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import zhTranslation from './locales/zh.json';
import enTranslation from './locales/en.json';

// Resources
const resources = {
  zh: {
    translation: zhTranslation,
  },
  en: {
    translation: enTranslation,
  },
};

// Detection options
const detectionOptions = {
  order: ['localStorage', 'navigator', 'htmlTag'],
  caches: ['localStorage'],
};

i18n
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    resources,
    fallbackLng: 'zh',
    debug: import.meta.env.DEV,
    
    // Language detection
    detection: detectionOptions,
    
    // Interpolation
    interpolation: {
      escapeValue: false, // React already safes from XSS
    },
    
    // React options
    react: {
      useSuspense: false,
    },
    
    // Default namespace
    defaultNS: 'translation',
    
    // Load translations on demand (optional for lazy loading)
    // ns: ['common', 'server', 'gpu', 'task', 'user'],
  });

// Export for use in components
export default i18n;

// Helper function to change language
export const changeLanguage = (lng: string) => {
  i18n.changeLanguage(lng);
  localStorage.setItem('i18nextLng', lng);
};

// Helper function to get current language
export const getCurrentLanguage = () => {
  return i18n.language || 'zh';
};
