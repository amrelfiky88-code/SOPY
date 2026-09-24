// Builds { ar, fr } dictionaries from [english, arabic, french] rows, so
// each English source string (the lookup key, matched exactly) is written
// once instead of once per language.
//
// Arabic is written here with Western digits and stored with Arabic-Indic
// digits, matching the rest of the Arabic content (١ ٤ °م).

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export const arabicDigits = (s) => s.replace(/[0-9]/g, (d) => AR_DIGITS[d]);

export function byLanguage(rows) {
  const ar = {};
  const fr = {};
  for (const [en, a, f] of rows) {
    if (ar[en]) throw new Error(`Duplicate translation row: ${en}`);
    ar[en] = arabicDigits(a);
    fr[en] = f;
  }
  return { ar, fr };
}
