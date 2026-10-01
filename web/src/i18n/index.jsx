import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LANGUAGE, isSupportedLanguage, languageDir } from '../../../shared/languages.js';
import en from './en.js';
import ar from './ar.js';
import fr from './fr.js';
import { FORM_LABELS } from './formLabels.js';
import { PAGE_LABELS } from './pageLabels.js';
import { APP_LABELS } from './appLabels.js';

const DICTIONARIES = {
  en: { ...en, ...FORM_LABELS.en, ...PAGE_LABELS.en, ...APP_LABELS.en },
  ar: { ...ar, ...FORM_LABELS.ar, ...PAGE_LABELS.ar, ...APP_LABELS.ar },
  fr: { ...fr, ...FORM_LABELS.fr, ...PAGE_LABELS.fr, ...APP_LABELS.fr },
};
const STORAGE_KEY = 'sopy_lang';

const I18nContext = createContext(null);

// Read before React mounts so the very first paint is already in the
// right language and direction — otherwise an Arabic user sees a flash
// of left-to-right English on every load.
function initialLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isSupportedLanguage(stored)) return stored;
  } catch {
    // private mode / blocked storage — fall through to the default
  }
  return DEFAULT_LANGUAGE;
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLanguage);

  useEffect(() => {
    const dir = languageDir(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* not fatal */ }
  }, [lang]);

  const setLang = useCallback((next) => {
    if (isSupportedLanguage(next)) setLangState(next);
  }, []);

  const t = useCallback(
    (key, vars) => {
      const dict = DICTIONARIES[lang] || DICTIONARIES[DEFAULT_LANGUAGE];
      // Fall back to English rather than rendering the raw key, so a
      // missing translation degrades to readable text.
      let out = dict[key] ?? DICTIONARIES[DEFAULT_LANGUAGE][key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v);
      return out;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t, dir: languageDir(lang) }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

// Convenience for components that only need the translate function.
export function useT() {
  return useI18n().t;
}
