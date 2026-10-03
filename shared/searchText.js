// Text folded for searching, so what someone types finds the text however
// it's written. Arabic vowel marks and tatweel are dropped (مُعقّم → معقم),
// أ إ آ ٱ become ا, ى becomes ي and ة becomes ه, Arabic-Indic digits become
// 0–9 (the library stores Arabic with ٥, people type 5), and accents come
// off Latin letters (sécurité → securite). Then lower case.
//
// Used by the search boxes in the app and, through foldSql, by the server's
// library search, so the Library tab and the Checklist Builder agree.

// After NFD: Latin combining accents, Arabic marks (harakat, shadda, sukun,
// the hamza that NFD splits off أ إ ؤ ئ, superscript alef, Quranic marks)
// and tatweel.
const MARKS = '[\\u0300-\\u036f\\u0610-\\u061a\\u064b-\\u065f\\u0670\\u06d6-\\u06ed\\u0640]';
const MARKS_RE = new RegExp(MARKS, 'g');
export const FOLD_FROM = 'ٱىة٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹';
export const FOLD_TO = 'ايه01234567890123456789';
const MAP_RE = new RegExp(`[${FOLD_FROM}]`, 'g');

export function foldText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(MARKS_RE, '')
    .replace(MAP_RE, (c) => FOLD_TO[FOLD_FROM.indexOf(c)])
    .toLowerCase();
}

// The same fold in Postgres, for a column or expression. The three values
// are bound as parameters: foldSql('t.text', '$5', '$6', '$7') with
// [FOLD_MARKS, FOLD_FROM, FOLD_TO]. Needs a UTF-8 database (normalize()).
export const FOLD_MARKS = MARKS;
export const foldSql = (expr, marks, from, to) =>
  `lower(translate(regexp_replace(normalize(${expr}, NFD), ${marks}, '', 'g'), ${from}, ${to}))`;
