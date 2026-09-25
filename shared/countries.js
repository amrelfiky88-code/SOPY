// Every country for the sign-up form: the UN member states (Israel left
// out at the client's request) plus the two observer states (Vatican City,
// Palestine), grouped by region.
// Each entry is [ISO 3166 code, English name]. The English name is what's
// saved (tenants.country), so it stays the same whatever the browser or
// language; the code gives the name in the viewer's language.
export const COUNTRY_GROUPS = [
  ['gcc', [
    ['SA', 'Saudi Arabia'], ['AE', 'United Arab Emirates'], ['KW', 'Kuwait'], ['QA', 'Qatar'],
    ['BH', 'Bahrain'], ['OM', 'Oman'],
  ]],
  ['middleEast', [
    ['JO', 'Jordan'], ['LB', 'Lebanon'], ['SY', 'Syria'], ['IQ', 'Iraq'], ['PS', 'Palestine'],
    ['YE', 'Yemen'], ['IR', 'Iran'], ['TR', 'Turkey'],
  ]],
  ['northAfrica', [
    ['EG', 'Egypt'], ['MA', 'Morocco'], ['DZ', 'Algeria'], ['TN', 'Tunisia'], ['LY', 'Libya'],
  ]],
  ['europe', [
    ['AL', 'Albania'], ['AD', 'Andorra'], ['AT', 'Austria'], ['BY', 'Belarus'], ['BE', 'Belgium'],
    ['BA', 'Bosnia and Herzegovina'], ['BG', 'Bulgaria'], ['HR', 'Croatia'], ['CY', 'Cyprus'],
    ['CZ', 'Czechia'], ['DK', 'Denmark'], ['EE', 'Estonia'], ['FI', 'Finland'], ['FR', 'France'],
    ['DE', 'Germany'], ['GR', 'Greece'], ['HU', 'Hungary'], ['IS', 'Iceland'], ['IE', 'Ireland'],
    ['IT', 'Italy'], ['LV', 'Latvia'], ['LI', 'Liechtenstein'], ['LT', 'Lithuania'],
    ['LU', 'Luxembourg'], ['MT', 'Malta'], ['MD', 'Moldova'], ['MC', 'Monaco'], ['ME', 'Montenegro'],
    ['NL', 'Netherlands'], ['MK', 'North Macedonia'], ['NO', 'Norway'], ['PL', 'Poland'],
    ['PT', 'Portugal'], ['RO', 'Romania'], ['RU', 'Russia'], ['SM', 'San Marino'], ['RS', 'Serbia'],
    ['SK', 'Slovakia'], ['SI', 'Slovenia'], ['ES', 'Spain'], ['SE', 'Sweden'], ['CH', 'Switzerland'],
    ['UA', 'Ukraine'], ['GB', 'United Kingdom'], ['VA', 'Vatican City'],
  ]],
  ['africa', [
    ['AO', 'Angola'], ['BJ', 'Benin'], ['BW', 'Botswana'], ['BF', 'Burkina Faso'], ['BI', 'Burundi'],
    ['CV', 'Cabo Verde'], ['CM', 'Cameroon'], ['CF', 'Central African Republic'], ['TD', 'Chad'],
    ['KM', 'Comoros'], ['CG', 'Congo'], ['CD', 'DR Congo'], ['CI', "Côte d'Ivoire"], ['DJ', 'Djibouti'],
    ['GQ', 'Equatorial Guinea'], ['ER', 'Eritrea'], ['SZ', 'Eswatini'], ['ET', 'Ethiopia'],
    ['GA', 'Gabon'], ['GM', 'Gambia'], ['GH', 'Ghana'], ['GN', 'Guinea'], ['GW', 'Guinea-Bissau'],
    ['KE', 'Kenya'], ['LS', 'Lesotho'], ['LR', 'Liberia'], ['MG', 'Madagascar'], ['MW', 'Malawi'],
    ['ML', 'Mali'], ['MR', 'Mauritania'], ['MU', 'Mauritius'], ['MZ', 'Mozambique'], ['NA', 'Namibia'],
    ['NE', 'Niger'], ['NG', 'Nigeria'], ['RW', 'Rwanda'], ['ST', 'São Tomé and Príncipe'],
    ['SN', 'Senegal'], ['SC', 'Seychelles'], ['SL', 'Sierra Leone'], ['SO', 'Somalia'],
    ['ZA', 'South Africa'], ['SS', 'South Sudan'], ['SD', 'Sudan'], ['TZ', 'Tanzania'], ['TG', 'Togo'],
    ['UG', 'Uganda'], ['ZM', 'Zambia'], ['ZW', 'Zimbabwe'],
  ]],
  ['asia', [
    ['AF', 'Afghanistan'], ['AM', 'Armenia'], ['AZ', 'Azerbaijan'], ['BD', 'Bangladesh'], ['BT', 'Bhutan'],
    ['BN', 'Brunei'], ['KH', 'Cambodia'], ['CN', 'China'], ['GE', 'Georgia'], ['IN', 'India'],
    ['ID', 'Indonesia'], ['JP', 'Japan'], ['KZ', 'Kazakhstan'], ['KG', 'Kyrgyzstan'], ['LA', 'Laos'],
    ['MY', 'Malaysia'], ['MV', 'Maldives'], ['MN', 'Mongolia'], ['MM', 'Myanmar'], ['NP', 'Nepal'],
    ['KP', 'North Korea'], ['PK', 'Pakistan'], ['PH', 'Philippines'], ['SG', 'Singapore'],
    ['KR', 'South Korea'], ['LK', 'Sri Lanka'], ['TJ', 'Tajikistan'], ['TH', 'Thailand'],
    ['TL', 'Timor-Leste'], ['TM', 'Turkmenistan'], ['UZ', 'Uzbekistan'], ['VN', 'Vietnam'],
  ]],
  ['northAmerica', [
    ['US', 'United States'], ['CA', 'Canada'], ['MX', 'Mexico'],
  ]],
  ['caribbean', [
    ['AG', 'Antigua and Barbuda'], ['BS', 'Bahamas'], ['BB', 'Barbados'], ['BZ', 'Belize'],
    ['CR', 'Costa Rica'], ['CU', 'Cuba'], ['DM', 'Dominica'], ['DO', 'Dominican Republic'],
    ['SV', 'El Salvador'], ['GD', 'Grenada'], ['GT', 'Guatemala'], ['HT', 'Haiti'], ['HN', 'Honduras'],
    ['JM', 'Jamaica'], ['NI', 'Nicaragua'], ['PA', 'Panama'], ['KN', 'Saint Kitts and Nevis'],
    ['LC', 'Saint Lucia'], ['VC', 'Saint Vincent and the Grenadines'], ['TT', 'Trinidad and Tobago'],
  ]],
  ['southAmerica', [
    ['AR', 'Argentina'], ['BO', 'Bolivia'], ['BR', 'Brazil'], ['CL', 'Chile'], ['CO', 'Colombia'],
    ['EC', 'Ecuador'], ['GY', 'Guyana'], ['PY', 'Paraguay'], ['PE', 'Peru'], ['SR', 'Suriname'],
    ['UY', 'Uruguay'], ['VE', 'Venezuela'],
  ]],
  ['oceania', [
    ['AU', 'Australia'], ['FJ', 'Fiji'], ['KI', 'Kiribati'], ['MH', 'Marshall Islands'],
    ['FM', 'Micronesia'], ['NR', 'Nauru'], ['NZ', 'New Zealand'], ['PW', 'Palau'],
    ['PG', 'Papua New Guinea'], ['WS', 'Samoa'], ['SB', 'Solomon Islands'], ['TO', 'Tonga'],
    ['TV', 'Tuvalu'], ['VU', 'Vanuatu'],
  ]],
];

// Where the browser's own names read oddly ("Palestinian Territories",
// "Congo - Kinshasa", "Myanmar (Burma)"), or it has no names at all.
const NAME_OVERRIDES = {
  ar: { PS: 'فلسطين', CD: 'جمهورية الكونغو الديمقراطية', CG: 'الكونغو', MM: 'ميانمار' },
  fr: { PS: 'Palestine', CD: 'République démocratique du Congo', CG: 'Congo', MM: 'Myanmar' },
};

// [{ key, countries: [{ value, label }] }], each group sorted in the
// viewer's language. English uses the names above as written.
export function countryOptions(lang) {
  let display = null;
  if (lang !== 'en') {
    try { display = new Intl.DisplayNames([lang], { type: 'region' }); } catch { /* old browser: English */ }
  }
  const overrides = NAME_OVERRIDES[lang] || {};
  const label = (code, english) => overrides[code] || (display && display.of(code)) || english;
  return COUNTRY_GROUPS.map(([key, list]) => ({
    key,
    countries: list
      .map(([code, english]) => ({ value: english, label: label(code, english) }))
      .sort((a, b) => a.label.localeCompare(b.label, lang)),
  }));
}

// ISO code for a saved country name (tenants.country), or null for
// "Other" and anything not in the list.
const CODE_BY_NAME = new Map(COUNTRY_GROUPS.flatMap(([, list]) => list.map(([code, english]) => [english, code])));
export const countryCode = (englishName) => CODE_BY_NAME.get(englishName) || null;

// Arab League members: their cities get Arabic names in the city list.
export const ARABIC_NAMED_COUNTRIES = new Set([
  'SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'JO', 'LB', 'SY', 'IQ', 'PS', 'YE',
  'EG', 'MA', 'DZ', 'TN', 'LY', 'SD', 'SO', 'DJ', 'KM', 'MR',
]);
