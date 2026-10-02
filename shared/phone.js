import { COUNTRY_GROUPS } from './countries.js';

// International dialling codes for every country on the sign-up list
// (countries.js), so a phone number is saved with its country:
// "+20 1222553971" rather than "01222553971", which only works from inside
// Egypt. Caribbean countries in the North American plan dial +1 and an area
// code, kept together here ("1268" for Antigua and Barbuda). Vatican City
// is reached through Italy's +39.
export const DIAL_CODES = {
  SA: '966', AE: '971', KW: '965', QA: '974', BH: '973', OM: '968',
  JO: '962', LB: '961', SY: '963', IQ: '964', PS: '970', YE: '967', IR: '98', TR: '90',
  EG: '20', MA: '212', DZ: '213', TN: '216', LY: '218',
  AL: '355', AD: '376', AT: '43', BY: '375', BE: '32', BA: '387', BG: '359', HR: '385', CY: '357',
  CZ: '420', DK: '45', EE: '372', FI: '358', FR: '33', DE: '49', GR: '30', HU: '36', IS: '354',
  IE: '353', IT: '39', LV: '371', LI: '423', LT: '370', LU: '352', MT: '356', MD: '373', MC: '377',
  ME: '382', NL: '31', MK: '389', NO: '47', PL: '48', PT: '351', RO: '40', RU: '7', SM: '378',
  RS: '381', SK: '421', SI: '386', ES: '34', SE: '46', CH: '41', UA: '380', GB: '44', VA: '39',
  AO: '244', BJ: '229', BW: '267', BF: '226', BI: '257', CV: '238', CM: '237', CF: '236', TD: '235',
  KM: '269', CG: '242', CD: '243', CI: '225', DJ: '253', GQ: '240', ER: '291', SZ: '268', ET: '251',
  GA: '241', GM: '220', GH: '233', GN: '224', GW: '245', KE: '254', LS: '266', LR: '231', MG: '261',
  MW: '265', ML: '223', MR: '222', MU: '230', MZ: '258', NA: '264', NE: '227', NG: '234', RW: '250',
  ST: '239', SN: '221', SC: '248', SL: '232', SO: '252', ZA: '27', SS: '211', SD: '249', TZ: '255',
  TG: '228', UG: '256', ZM: '260', ZW: '263',
  AF: '93', AM: '374', AZ: '994', BD: '880', BT: '975', BN: '673', KH: '855', CN: '86', GE: '995',
  IN: '91', ID: '62', JP: '81', KZ: '7', KG: '996', LA: '856', MY: '60', MV: '960', MN: '976',
  MM: '95', NP: '977', KP: '850', PK: '92', PH: '63', SG: '65', KR: '82', LK: '94', TJ: '992',
  TH: '66', TL: '670', TM: '993', UZ: '998', VN: '84',
  US: '1', CA: '1', MX: '52',
  AG: '1268', BS: '1242', BB: '1246', BZ: '501', CR: '506', CU: '53', DM: '1767', DO: '1809',
  SV: '503', GD: '1473', GT: '502', HT: '509', HN: '504', JM: '1876', NI: '505', PA: '507',
  KN: '1869', LC: '1758', VC: '1784', TT: '1868',
  AR: '54', BO: '591', BR: '55', CL: '56', CO: '57', EC: '593', GY: '592', PY: '595', PE: '51',
  SR: '597', UY: '598', VE: '58',
  AU: '61', FJ: '679', KI: '686', MH: '692', FM: '691', NR: '674', NZ: '64', PW: '680', PG: '675',
  WS: '685', SB: '677', TO: '676', TV: '688', VU: '678',
};

// "+1 268" rather than "+1268" for the North American plan's area codes.
export const dialLabel = (iso) => {
  const code = DIAL_CODES[iso];
  if (!code) return '';
  return code.length === 4 && code.startsWith('1') ? `+1 ${code.slice(1)}` : `+${code}`;
};

// Where a national number starts with 0 that's dropped after the country
// code (Egypt's 0122… is +20 122…). Italy, San Marino and the Vatican keep it.
const KEEPS_LEADING_ZERO = new Set(['IT', 'SM', 'VA']);

// The saved form: "+<code> <national number>", or '' when there's no number.
export function composePhone(iso, national) {
  let digits = String(national || '').replace(/\D/g, '');
  if (!digits || !DIAL_CODES[iso]) return digits ? digits : '';
  if (!KEEPS_LEADING_ZERO.has(iso)) digits = digits.replace(/^0/, '');
  return digits ? `+${DIAL_CODES[iso]} ${digits}` : '';
}

// Countries in list order, which puts the main country first where several
// share a code (United States before Canada, Russia before Kazakhstan,
// Italy before the Vatican).
const ORDERED_ISO = COUNTRY_GROUPS.flatMap(([, list]) => list.map(([iso]) => iso));

// A saved phone back into { iso, national }. "+20 1222553971" → Egypt;
// a number saved before country codes ("01222553971") keeps its digits
// and takes the fallback country. Where a code is shared (+1), the
// fallback country wins if it has that code.
export function parsePhone(value, fallbackIso = null) {
  const text = String(value || '').trim();
  const intl = text.startsWith('+') ? text.slice(1) : text.startsWith('00') ? text.slice(2) : null;
  if (intl === null) return { iso: fallbackIso, national: text };
  const digits = intl.replace(/\D/g, '');
  let best = null;
  for (const iso of ORDERED_ISO) {
    const code = DIAL_CODES[iso];
    if (!digits.startsWith(code)) continue;
    if (!best || code.length > DIAL_CODES[best].length || (code.length === DIAL_CODES[best].length && iso === fallbackIso)) best = iso;
  }
  if (!best) return { iso: fallbackIso, national: text };
  // Keep the grouping the person typed after the code ("+20 122 255 3971").
  const afterCode = intl.replace(/^[\s-]*/, '').replace(new RegExp(`^${DIAL_CODES[best].split('').join('[\\s-]*')}`), '').trim();
  return { iso: best, national: afterCode };
}
