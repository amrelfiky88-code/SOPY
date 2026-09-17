// Supported UI languages. Shared by the server (validating the profile
// setting, translating library content) and the web app (the language
// picker, the i18n dictionaries) so the two can't drift apart.

export const LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English', dir: 'ltr' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', dir: 'rtl' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', dir: 'ltr' },
];

export const DEFAULT_LANGUAGE = 'en';

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);

export function isSupportedLanguage(code) {
  return LANGUAGE_CODES.includes(code);
}

export function languageDir(code) {
  return LANGUAGES.find((l) => l.code === code)?.dir || 'ltr';
}
