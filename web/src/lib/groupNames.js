import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n/index.jsx';
import { setLibraryNames } from '../i18n/formLabels.js';

// A checklist started with Library "Run now" is named after its SOP in
// English ("SOP 17: Allergen Awareness"). The app shell loads those names
// in the reader's language once per language (GET /checklists/library/groups)
// and hands them to reportTitle(), so every list, report and PDF shows them
// translated. Re-renders the shell when they arrive.
const cache = {};

export function useLibraryNames() {
  const { lang } = useI18n();
  const [, setLoaded] = useState(null);
  useEffect(() => {
    let current = true;
    if (!cache[lang]) {
      cache[lang] = api.get(`/checklists/library/groups?lang=${lang}`).then((d) => d.names).catch(() => {
        delete cache[lang]; // try again next time
        return {};
      });
    }
    cache[lang].then((names) => {
      if (!current) return;
      setLibraryNames(names);
      setLoaded(lang + Object.keys(names).length);
    });
    return () => { current = false; };
  }, [lang]);
}
