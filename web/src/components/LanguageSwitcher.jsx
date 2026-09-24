import React from 'react';
import { useI18n } from '../i18n/index.jsx';
import { LANGUAGES } from '../../../shared/languages.js';

// Language choice for pages seen before signing in (landing, log in,
// sign-up, invite). Signed-in people change it under Profile & billing,
// where it's saved to their account; here it's remembered on the device
// and sent along when the account is created.
export default function LanguageSwitcher({ style }) {
  const { lang, setLang, t } = useI18n();
  return (
    <select
      className="language-switcher"
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      aria-label={t('page.languageLabel')}
      style={style}
    >
      {LANGUAGES.map((l) => <option key={l.code} value={l.code} lang={l.code}>{l.nativeLabel}</option>)}
    </select>
  );
}
