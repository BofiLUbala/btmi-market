/**
 * Every calling code in the world, for the country picker beside a phone
 * field.
 *
 * Names are in French, the app's first language; for any other locale the
 * device translates the ISO code itself through `Intl.DisplayNames`, so a
 * second table of names does not have to be carried here and kept in step.
 *
 * `dial` has no leading "+": it is concatenated after one. Several countries
 * share a code (+1, +44, +590, +262, +7), which is why `iso` — not `dial` —
 * identifies an entry.
 */
export type Country = { iso: string; dial: string; name: string }

export const COUNTRIES: Country[] = [
  { iso: 'AF', dial: '93', name: 'Afghanistan' },
  { iso: 'ZA', dial: '27', name: 'Afrique du Sud' },
  { iso: 'AL', dial: '355', name: 'Albanie' },
  { iso: 'DZ', dial: '213', name: 'Algérie' },
  { iso: 'DE', dial: '49', name: 'Allemagne' },
  { iso: 'AD', dial: '376', name: 'Andorre' },
  { iso: 'AO', dial: '244', name: 'Angola' },
  { iso: 'AI', dial: '1264', name: 'Anguilla' },
  { iso: 'AG', dial: '1268', name: 'Antigua-et-Barbuda' },
  { iso: 'SA', dial: '966', name: 'Arabie saoudite' },
  { iso: 'AR', dial: '54', name: 'Argentine' },
  { iso: 'AM', dial: '374', name: 'Arménie' },
  { iso: 'AW', dial: '297', name: 'Aruba' },
  { iso: 'AU', dial: '61', name: 'Australie' },
  { iso: 'AT', dial: '43', name: 'Autriche' },
  { iso: 'AZ', dial: '994', name: 'Azerbaïdjan' },
  { iso: 'BS', dial: '1242', name: 'Bahamas' },
  { iso: 'BH', dial: '973', name: 'Bahreïn' },
  { iso: 'BD', dial: '880', name: 'Bangladesh' },
  { iso: 'BB', dial: '1246', name: 'Barbade' },
  { iso: 'BE', dial: '32', name: 'Belgique' },
  { iso: 'BZ', dial: '501', name: 'Belize' },
  { iso: 'BJ', dial: '229', name: 'Bénin' },
  { iso: 'BM', dial: '1441', name: 'Bermudes' },
  { iso: 'BT', dial: '975', name: 'Bhoutan' },
  { iso: 'BY', dial: '375', name: 'Biélorussie' },
  { iso: 'BO', dial: '591', name: 'Bolivie' },
  { iso: 'BA', dial: '387', name: 'Bosnie-Herzégovine' },
  { iso: 'BW', dial: '267', name: 'Botswana' },
  { iso: 'BR', dial: '55', name: 'Brésil' },
  { iso: 'BN', dial: '673', name: 'Brunei' },
  { iso: 'BG', dial: '359', name: 'Bulgarie' },
  { iso: 'BF', dial: '226', name: 'Burkina Faso' },
  { iso: 'BI', dial: '257', name: 'Burundi' },
  { iso: 'KH', dial: '855', name: 'Cambodge' },
  { iso: 'CM', dial: '237', name: 'Cameroun' },
  { iso: 'CA', dial: '1', name: 'Canada' },
  { iso: 'CV', dial: '238', name: 'Cap-Vert' },
  { iso: 'CL', dial: '56', name: 'Chili' },
  { iso: 'CN', dial: '86', name: 'Chine' },
  { iso: 'CY', dial: '357', name: 'Chypre' },
  { iso: 'CO', dial: '57', name: 'Colombie' },
  { iso: 'KM', dial: '269', name: 'Comores' },
  { iso: 'CG', dial: '242', name: 'Congo-Brazzaville' },
  { iso: 'CD', dial: '243', name: 'Congo (RDC)' },
  { iso: 'KP', dial: '850', name: 'Corée du Nord' },
  { iso: 'KR', dial: '82', name: 'Corée du Sud' },
  { iso: 'CR', dial: '506', name: 'Costa Rica' },
  { iso: 'CI', dial: '225', name: "Côte d'Ivoire" },
  { iso: 'HR', dial: '385', name: 'Croatie' },
  { iso: 'CU', dial: '53', name: 'Cuba' },
  { iso: 'CW', dial: '599', name: 'Curaçao' },
  { iso: 'DK', dial: '45', name: 'Danemark' },
  { iso: 'DJ', dial: '253', name: 'Djibouti' },
  { iso: 'DM', dial: '1767', name: 'Dominique' },
  { iso: 'EG', dial: '20', name: 'Égypte' },
  { iso: 'AE', dial: '971', name: 'Émirats arabes unis' },
  { iso: 'EC', dial: '593', name: 'Équateur' },
  { iso: 'ER', dial: '291', name: 'Érythrée' },
  { iso: 'ES', dial: '34', name: 'Espagne' },
  { iso: 'EE', dial: '372', name: 'Estonie' },
  { iso: 'SZ', dial: '268', name: 'Eswatini' },
  { iso: 'US', dial: '1', name: 'États-Unis' },
  { iso: 'ET', dial: '251', name: 'Éthiopie' },
  { iso: 'FJ', dial: '679', name: 'Fidji' },
  { iso: 'FI', dial: '358', name: 'Finlande' },
  { iso: 'FR', dial: '33', name: 'France' },
  { iso: 'GA', dial: '241', name: 'Gabon' },
  { iso: 'GM', dial: '220', name: 'Gambie' },
  { iso: 'GE', dial: '995', name: 'Géorgie' },
  { iso: 'GH', dial: '233', name: 'Ghana' },
  { iso: 'GI', dial: '350', name: 'Gibraltar' },
  { iso: 'GR', dial: '30', name: 'Grèce' },
  { iso: 'GD', dial: '1473', name: 'Grenade' },
  { iso: 'GL', dial: '299', name: 'Groenland' },
  { iso: 'GP', dial: '590', name: 'Guadeloupe' },
  { iso: 'GU', dial: '1671', name: 'Guam' },
  { iso: 'GT', dial: '502', name: 'Guatemala' },
  { iso: 'GG', dial: '44', name: 'Guernesey' },
  { iso: 'GN', dial: '224', name: 'Guinée' },
  { iso: 'GQ', dial: '240', name: 'Guinée équatoriale' },
  { iso: 'GW', dial: '245', name: 'Guinée-Bissau' },
  { iso: 'GY', dial: '592', name: 'Guyana' },
  { iso: 'GF', dial: '594', name: 'Guyane française' },
  { iso: 'HT', dial: '509', name: 'Haïti' },
  { iso: 'HN', dial: '504', name: 'Honduras' },
  { iso: 'HK', dial: '852', name: 'Hong Kong' },
  { iso: 'HU', dial: '36', name: 'Hongrie' },
  { iso: 'IM', dial: '44', name: 'Île de Man' },
  { iso: 'KY', dial: '1345', name: 'Îles Caïmans' },
  { iso: 'CK', dial: '682', name: 'Îles Cook' },
  { iso: 'FO', dial: '298', name: 'Îles Féroé' },
  { iso: 'FK', dial: '500', name: 'Îles Malouines' },
  { iso: 'MP', dial: '1670', name: 'Îles Mariannes du Nord' },
  { iso: 'MH', dial: '692', name: 'Îles Marshall' },
  { iso: 'SB', dial: '677', name: 'Îles Salomon' },
  { iso: 'TC', dial: '1649', name: 'Îles Turques-et-Caïques' },
  { iso: 'VG', dial: '1284', name: 'Îles Vierges britanniques' },
  { iso: 'VI', dial: '1340', name: 'Îles Vierges des États-Unis' },
  { iso: 'IN', dial: '91', name: 'Inde' },
  { iso: 'ID', dial: '62', name: 'Indonésie' },
  { iso: 'IQ', dial: '964', name: 'Irak' },
  { iso: 'IR', dial: '98', name: 'Iran' },
  { iso: 'IE', dial: '353', name: 'Irlande' },
  { iso: 'IS', dial: '354', name: 'Islande' },
  { iso: 'IL', dial: '972', name: 'Israël' },
  { iso: 'IT', dial: '39', name: 'Italie' },
  { iso: 'JM', dial: '1876', name: 'Jamaïque' },
  { iso: 'JP', dial: '81', name: 'Japon' },
  { iso: 'JE', dial: '44', name: 'Jersey' },
  { iso: 'JO', dial: '962', name: 'Jordanie' },
  { iso: 'KZ', dial: '7', name: 'Kazakhstan' },
  { iso: 'KE', dial: '254', name: 'Kenya' },
  { iso: 'KG', dial: '996', name: 'Kirghizistan' },
  { iso: 'KI', dial: '686', name: 'Kiribati' },
  { iso: 'XK', dial: '383', name: 'Kosovo' },
  { iso: 'KW', dial: '965', name: 'Koweït' },
  { iso: 'LA', dial: '856', name: 'Laos' },
  { iso: 'LS', dial: '266', name: 'Lesotho' },
  { iso: 'LV', dial: '371', name: 'Lettonie' },
  { iso: 'LB', dial: '961', name: 'Liban' },
  { iso: 'LR', dial: '231', name: 'Liberia' },
  { iso: 'LY', dial: '218', name: 'Libye' },
  { iso: 'LI', dial: '423', name: 'Liechtenstein' },
  { iso: 'LT', dial: '370', name: 'Lituanie' },
  { iso: 'LU', dial: '352', name: 'Luxembourg' },
  { iso: 'MO', dial: '853', name: 'Macao' },
  { iso: 'MK', dial: '389', name: 'Macédoine du Nord' },
  { iso: 'MG', dial: '261', name: 'Madagascar' },
  { iso: 'MY', dial: '60', name: 'Malaisie' },
  { iso: 'MW', dial: '265', name: 'Malawi' },
  { iso: 'MV', dial: '960', name: 'Maldives' },
  { iso: 'ML', dial: '223', name: 'Mali' },
  { iso: 'MT', dial: '356', name: 'Malte' },
  { iso: 'MA', dial: '212', name: 'Maroc' },
  { iso: 'MQ', dial: '596', name: 'Martinique' },
  { iso: 'MU', dial: '230', name: 'Maurice' },
  { iso: 'MR', dial: '222', name: 'Mauritanie' },
  { iso: 'YT', dial: '262', name: 'Mayotte' },
  { iso: 'MX', dial: '52', name: 'Mexique' },
  { iso: 'FM', dial: '691', name: 'Micronésie' },
  { iso: 'MD', dial: '373', name: 'Moldavie' },
  { iso: 'MC', dial: '377', name: 'Monaco' },
  { iso: 'MN', dial: '976', name: 'Mongolie' },
  { iso: 'ME', dial: '382', name: 'Monténégro' },
  { iso: 'MS', dial: '1664', name: 'Montserrat' },
  { iso: 'MZ', dial: '258', name: 'Mozambique' },
  { iso: 'MM', dial: '95', name: 'Myanmar' },
  { iso: 'NA', dial: '264', name: 'Namibie' },
  { iso: 'NR', dial: '674', name: 'Nauru' },
  { iso: 'NP', dial: '977', name: 'Népal' },
  { iso: 'NI', dial: '505', name: 'Nicaragua' },
  { iso: 'NE', dial: '227', name: 'Niger' },
  { iso: 'NG', dial: '234', name: 'Nigeria' },
  { iso: 'NU', dial: '683', name: 'Niue' },
  { iso: 'NO', dial: '47', name: 'Norvège' },
  { iso: 'NC', dial: '687', name: 'Nouvelle-Calédonie' },
  { iso: 'NZ', dial: '64', name: 'Nouvelle-Zélande' },
  { iso: 'OM', dial: '968', name: 'Oman' },
  { iso: 'UG', dial: '256', name: 'Ouganda' },
  { iso: 'UZ', dial: '998', name: 'Ouzbékistan' },
  { iso: 'PK', dial: '92', name: 'Pakistan' },
  { iso: 'PW', dial: '680', name: 'Palaos' },
  { iso: 'PS', dial: '970', name: 'Palestine' },
  { iso: 'PA', dial: '507', name: 'Panama' },
  { iso: 'PG', dial: '675', name: 'Papouasie-Nouvelle-Guinée' },
  { iso: 'PY', dial: '595', name: 'Paraguay' },
  { iso: 'NL', dial: '31', name: 'Pays-Bas' },
  { iso: 'PE', dial: '51', name: 'Pérou' },
  { iso: 'PH', dial: '63', name: 'Philippines' },
  { iso: 'PL', dial: '48', name: 'Pologne' },
  { iso: 'PF', dial: '689', name: 'Polynésie française' },
  { iso: 'PR', dial: '1787', name: 'Porto Rico' },
  { iso: 'PT', dial: '351', name: 'Portugal' },
  { iso: 'QA', dial: '974', name: 'Qatar' },
  { iso: 'RE', dial: '262', name: 'La Réunion' },
  { iso: 'RO', dial: '40', name: 'Roumanie' },
  { iso: 'GB', dial: '44', name: 'Royaume-Uni' },
  { iso: 'RU', dial: '7', name: 'Russie' },
  { iso: 'RW', dial: '250', name: 'Rwanda' },
  { iso: 'EH', dial: '212', name: 'Sahara occidental' },
  { iso: 'BL', dial: '590', name: 'Saint-Barthélemy' },
  { iso: 'KN', dial: '1869', name: 'Saint-Christophe-et-Niévès' },
  { iso: 'SM', dial: '378', name: 'Saint-Marin' },
  { iso: 'MF', dial: '590', name: 'Saint-Martin' },
  { iso: 'SX', dial: '1721', name: 'Saint-Martin (Sint Maarten)' },
  { iso: 'PM', dial: '508', name: 'Saint-Pierre-et-Miquelon' },
  { iso: 'VC', dial: '1784', name: 'Saint-Vincent-et-les-Grenadines' },
  { iso: 'SH', dial: '290', name: 'Sainte-Hélène' },
  { iso: 'LC', dial: '1758', name: 'Sainte-Lucie' },
  { iso: 'SV', dial: '503', name: 'Salvador' },
  { iso: 'WS', dial: '685', name: 'Samoa' },
  { iso: 'AS', dial: '1684', name: 'Samoa américaines' },
  { iso: 'ST', dial: '239', name: 'Sao Tomé-et-Principe' },
  { iso: 'SN', dial: '221', name: 'Sénégal' },
  { iso: 'RS', dial: '381', name: 'Serbie' },
  { iso: 'SC', dial: '248', name: 'Seychelles' },
  { iso: 'SL', dial: '232', name: 'Sierra Leone' },
  { iso: 'SG', dial: '65', name: 'Singapour' },
  { iso: 'SK', dial: '421', name: 'Slovaquie' },
  { iso: 'SI', dial: '386', name: 'Slovénie' },
  { iso: 'SO', dial: '252', name: 'Somalie' },
  { iso: 'SD', dial: '249', name: 'Soudan' },
  { iso: 'SS', dial: '211', name: 'Soudan du Sud' },
  { iso: 'LK', dial: '94', name: 'Sri Lanka' },
  { iso: 'SE', dial: '46', name: 'Suède' },
  { iso: 'CH', dial: '41', name: 'Suisse' },
  { iso: 'SR', dial: '597', name: 'Suriname' },
  { iso: 'SY', dial: '963', name: 'Syrie' },
  { iso: 'TJ', dial: '992', name: 'Tadjikistan' },
  { iso: 'TW', dial: '886', name: 'Taïwan' },
  { iso: 'TZ', dial: '255', name: 'Tanzanie' },
  { iso: 'TD', dial: '235', name: 'Tchad' },
  { iso: 'CZ', dial: '420', name: 'Tchéquie' },
  { iso: 'TH', dial: '66', name: 'Thaïlande' },
  { iso: 'TL', dial: '670', name: 'Timor oriental' },
  { iso: 'TG', dial: '228', name: 'Togo' },
  { iso: 'TK', dial: '690', name: 'Tokelau' },
  { iso: 'TO', dial: '676', name: 'Tonga' },
  { iso: 'TT', dial: '1868', name: 'Trinité-et-Tobago' },
  { iso: 'TN', dial: '216', name: 'Tunisie' },
  { iso: 'TM', dial: '993', name: 'Turkménistan' },
  { iso: 'TR', dial: '90', name: 'Turquie' },
  { iso: 'TV', dial: '688', name: 'Tuvalu' },
  { iso: 'UA', dial: '380', name: 'Ukraine' },
  { iso: 'UY', dial: '598', name: 'Uruguay' },
  { iso: 'VU', dial: '678', name: 'Vanuatu' },
  { iso: 'VA', dial: '379', name: 'Vatican' },
  { iso: 'VE', dial: '58', name: 'Venezuela' },
  { iso: 'VN', dial: '84', name: 'Viêt Nam' },
  { iso: 'WF', dial: '681', name: 'Wallis-et-Futuna' },
  { iso: 'YE', dial: '967', name: 'Yémen' },
  { iso: 'ZM', dial: '260', name: 'Zambie' },
  { iso: 'ZW', dial: '263', name: 'Zimbabwe' },
]

/** Where most of our users are; what a phone field starts on. */
export const DEFAULT_COUNTRY_ISO = 'CD'

const BY_ISO = new Map(COUNTRIES.map((c) => [c.iso, c]))

export function countryByIso(iso: string | undefined | null): Country {
  return (iso ? BY_ISO.get(iso.toUpperCase()) : undefined) ?? BY_ISO.get(DEFAULT_COUNTRY_ISO)!
}

/**
 * The country name in the reader's language. French comes from the table; any
 * other locale is translated by the device, which already ships these names.
 */
export function countryName(country: Country, locale: string): string {
  if (locale.toLowerCase().startsWith('fr')) return country.name
  try {
    const display = new Intl.DisplayNames([locale], { type: 'region' })
    return display.of(country.iso) ?? country.name
  } catch {
    // Older engines have no Intl.DisplayNames; the French name and the ISO
    // code beside it still identify the country.
    return country.name
  }
}

/** Matches on name, ISO code and calling code, with or without the "+". */
export function searchCountries(query: string, locale: string): Country[] {
  const needle = query.trim().toLowerCase().replace(/^\+/, '')
  if (!needle) return COUNTRIES
  return COUNTRIES.filter(
    (c) =>
      c.dial.startsWith(needle) ||
      c.iso.toLowerCase().startsWith(needle) ||
      c.name.toLowerCase().includes(needle) ||
      countryName(c, locale).toLowerCase().includes(needle),
  )
}

/**
 * The number as E.164: "+" then country code then national digits, with the
 * trunk "0" dropped. Firebase and our own backend both want this exact shape.
 */
export function toE164(country: Country, nationalNumber: string): string {
  const digits = nationalNumber.replace(/\D/g, '').replace(/^0+/, '')
  return digits ? `+${country.dial}${digits}` : ''
}

/**
 * Splits a stored E.164 number back into a country and the national part, so
 * an existing number can be shown in the picker. The longest matching calling
 * code wins, since "+1" is a prefix of "+1264".
 */
export function fromE164(value: string): { country: Country; nationalNumber: string } {
  const digits = value.replace(/\D/g, '')
  let best: Country | null = null
  for (const country of COUNTRIES) {
    if (!digits.startsWith(country.dial)) continue
    if (!best || country.dial.length > best.dial.length) best = country
  }
  if (!best) return { country: countryByIso(DEFAULT_COUNTRY_ISO), nationalNumber: digits }
  return { country: best, nationalNumber: digits.slice(best.dial.length) }
}
