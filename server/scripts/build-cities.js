// Builds server/data/cities.json, the store City list, from GeoNames'
// cities15000 file (every city of 15,000+ people; CC BY 4.0, credit
// GeoNames wherever the list is shown). To refresh it:
//
//   download https://download.geonames.org/export/dump/cities15000.zip, unzip it
//   node scripts/build-cities.js path/to/cities15000.txt      (from server/)
//
// Output: { "EG": [["Cairo", "القاهرة"], ["Alexandria", "الإسكندرية"], ...] }
// per country in SOPY's list, biggest city first. The Arabic name is only
// kept for Arab countries, where GeoNames' Arabic names are dependable.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRY_GROUPS, ARABIC_NAMED_COUNTRIES } from '../../shared/countries.js';

const source = process.argv[2];
if (!source) {
  console.error('Usage: node scripts/build-cities.js path/to/cities15000.txt');
  process.exit(1);
}

const wanted = new Set(COUNTRY_GROUPS.flatMap(([, list]) => list.map(([code]) => code)));
const DIACRITICS = /[ً-ْـ]/g; // harakat, shadda, tatweel
const ARABIC_ONLY = /^[ء-ي\s-]+$/;
// Letters that mark a Persian, Urdu or Pashto spelling rather than Arabic.
const NOT_ARABIC = /[پچژگکیۀڈٹںےھګۍېۆڤ]/;

// GeoNames lists a city's Arabic spellings in no particular order, mixed
// with administrative names ("إمارة الشارقة") and colloquial ones. Prefer
// the standard written form: the definite article, a final ta marbuta,
// hamza, and a final ya over alif maqsura (دبي, not دبى).
function score(name) {
  let s = 0;
  if (/^ال/.test(name)) s += 3;
  if (/ة$/.test(name)) s += 2;
  if (/[أإآ]/.test(name)) s += 1;
  if (/ى$/.test(name)) s -= 2;
  if (/ه$/.test(name)) s -= 1;
  if (/^(مدينة|إمارة|امارة|جزيرة|محافظة|ولاية|بلدية) /.test(name)) s -= 5;
  s -= name.split(' ').length > 2 ? 2 : 0;
  return s;
}

// Where the rules above still pick a colloquial spelling.
const ARABIC_OVERRIDES = { Ajman: 'عجمان', 'Ras Al Khaimah': 'رأس الخيمة' };

function arabicName(alternates) {
  const candidates = [...new Set(alternates.split(',')
    .map((n) => n.replace(DIACRITICS, '').trim())
    .filter((n) => n && ARABIC_ONLY.test(n) && !NOT_ARABIC.test(n)))];
  if (!candidates.length) return null;
  return candidates.sort((a, b) => score(b) - score(a))[0];
}

const byCountry = {};
for (const line of fs.readFileSync(source, 'utf8').split('\n')) {
  const cols = line.split('\t');
  if (cols.length < 15) continue;
  const [, name, , alternates] = cols;
  const code = cols[8];
  const population = Number(cols[14]) || 0;
  if (!wanted.has(code) || !name) continue;
  const ar = ARABIC_NAMED_COUNTRIES.has(code) ? ARABIC_OVERRIDES[name] || arabicName(alternates) : null;
  (byCountry[code] ||= []).push({ name, ar, population });
}

const out = {};
for (const code of Object.keys(byCountry).sort()) {
  const seen = new Set();
  out[code] = byCountry[code]
    .sort((a, b) => b.population - a.population)
    // Some names repeat within a country (two towns called Salem): list once.
    .filter((c) => (seen.has(c.name) ? false : seen.add(c.name)))
    .map((c) => (c.ar ? [c.name, c.ar] : [c.name]));
}

const target = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'cities.json');
fs.writeFileSync(target, JSON.stringify(out));
const total = Object.values(out).reduce((n, list) => n + list.length, 0);
console.log(`Wrote ${total} cities in ${Object.keys(out).length} countries to ${target}`);
const missing = [...wanted].filter((code) => !out[code]);
if (missing.length) console.log(`No city of 15,000+ people in: ${missing.join(', ')}`);
