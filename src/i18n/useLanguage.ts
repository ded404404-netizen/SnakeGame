import { useState, useEffect, useCallback } from 'react';
import { translations, Language, Translation, languageCodes } from './translations';

function detectLanguage(): Language {
  const saved = localStorage.getItem('snake-language');
  if (saved && languageCodes.includes(saved as Language)) {
    return saved as Language;
  }
  const browserLang = navigator.language.split('-')[0];
  if (languageCodes.includes(browserLang as Language)) {
    return browserLang as Language;
  }
  return 'es';
}

export function useLanguage() {
  const [language, setLanguageState] = useState<Language>(detectLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('snake-language', lang);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t: Translation = translations[language];

  return { language, setLanguage, t };
}
