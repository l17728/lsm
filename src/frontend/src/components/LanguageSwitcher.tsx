/**
 * Language Switcher Component
 * Allows users to switch between Chinese and English
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

type Language = 'zh' | 'en';

interface LanguageOption {
  code: Language;
  label: string;
  flag: string;
}

const languages: LanguageOption[] = [
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState<Language>('zh');
  const [isOpen, setIsOpen] = useState(false);

  // Initialize current language
  useEffect(() => {
    const saved = localStorage.getItem('i18nextLng') as Language | null;
    if (saved && (saved === 'zh' || saved === 'en')) {
      setCurrentLang(saved);
    } else {
      setCurrentLang('zh');
    }
  }, []);

  // Change language
  const changeLanguage = (lang: Language) => {
    i18n.changeLanguage(lang);
    setCurrentLang(lang);
    localStorage.setItem('i18nextLng', lang);
    setIsOpen(false);
  };

  const currentLangData = languages.find((l) => l.code === currentLang);

  return (
    <div className="language-switcher" style={{ position: 'relative' }}>
      {/* Toggle Button */}
      <button
        className="lang-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Switch Language"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <span style={{ fontSize: '16px' }}>{currentLangData?.flag}</span>
        <span style={{ fontSize: '14px' }}>{currentLangData?.label}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M2 4L6 8L10 4" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 998,
            }}
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 999,
              minWidth: '140px',
              overflow: 'hidden',
            }}
          >
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => changeLanguage(lang.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '10px 12px',
                  border: 'none',
                  backgroundColor: currentLang === lang.code ? 'var(--bg-secondary)' : 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '14px',
                  transition: 'background-color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (currentLang !== lang.code) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentLang !== lang.code) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span style={{ fontSize: '16px' }}>{lang.flag}</span>
                <span>{lang.label}</span>
                {currentLang === lang.code && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="var(--primary-color)"
                    strokeWidth="2"
                    style={{ marginLeft: 'auto' }}
                  >
                    <path d="M3 8L6.5 11.5L13 4" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default LanguageSwitcher;
