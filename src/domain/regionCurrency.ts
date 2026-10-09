// Default base currency for first run, picked from the browser locale's region (spec section 8).
// Only currencies the app supports are listed; anything else falls back to USD.

const REGION_CURRENCY: Readonly<Record<string, string>> = {
  AE: 'AED', AF: 'AFN', AL: 'ALL', AM: 'AMD', AO: 'AOA', AR: 'ARS', AU: 'AUD', AW: 'AWG',
  AZ: 'AZN', BA: 'BAM', BB: 'BBD', BD: 'BDT', BH: 'BHD', BI: 'BIF', BM: 'BMD', BN: 'BND',
  BO: 'BOB', BR: 'BRL', BS: 'BSD', BT: 'BTN', BW: 'BWP', BY: 'BYN', BZ: 'BZD', CA: 'CAD',
  CD: 'CDF', CH: 'CHF', LI: 'CHF', CL: 'CLP', CN: 'CNY', CO: 'COP', CR: 'CRC', CU: 'CUP',
  CV: 'CVE', CZ: 'CZK', DJ: 'DJF', DK: 'DKK', FO: 'DKK', GL: 'DKK', DO: 'DOP', DZ: 'DZD',
  EG: 'EGP', ER: 'ERN', ET: 'ETB', FJ: 'FJD', FK: 'FKP', GB: 'GBP', GG: 'GBP', IM: 'GBP',
  JE: 'GBP', GE: 'GEL', GH: 'GHS', GI: 'GIP', GM: 'GMD', GN: 'GNF', GT: 'GTQ', GY: 'GYD',
  HK: 'HKD', HN: 'HNL', HT: 'HTG', HU: 'HUF', ID: 'IDR', IL: 'ILS', PS: 'ILS', IN: 'INR',
  IQ: 'IQD', IR: 'IRR', IS: 'ISK', JM: 'JMD', JO: 'JOD', JP: 'JPY', KE: 'KES', KG: 'KGS',
  KH: 'KHR', KM: 'KMF', KP: 'KPW', KR: 'KRW', KW: 'KWD', KY: 'KYD', KZ: 'KZT', LA: 'LAK',
  LB: 'LBP', LK: 'LKR', LR: 'LRD', LS: 'LSL', LY: 'LYD', MA: 'MAD', EH: 'MAD', MD: 'MDL',
  MG: 'MGA', MK: 'MKD', MM: 'MMK', MN: 'MNT', MO: 'MOP', MR: 'MRU', MU: 'MUR', MV: 'MVR',
  MW: 'MWK', MX: 'MXN', MY: 'MYR', MZ: 'MZN', NA: 'NAD', NG: 'NGN', NI: 'NIO', NO: 'NOK',
  SJ: 'NOK', NP: 'NPR', NZ: 'NZD', CK: 'NZD', NU: 'NZD', PN: 'NZD', TK: 'NZD', OM: 'OMR',
  PE: 'PEN', PG: 'PGK', PH: 'PHP', PK: 'PKR', PL: 'PLN', PY: 'PYG', QA: 'QAR', RO: 'RON',
  RS: 'RSD', RU: 'RUB', RW: 'RWF', SA: 'SAR', SB: 'SBD', SC: 'SCR', SD: 'SDG', SE: 'SEK',
  SG: 'SGD', SH: 'SHP', SL: 'SLE', SO: 'SOS', SR: 'SRD', SS: 'SSP', ST: 'STN', SY: 'SYP',
  SZ: 'SZL', TH: 'THB', TJ: 'TJS', TM: 'TMT', TN: 'TND', TO: 'TOP', TR: 'TRY', TT: 'TTD',
  TW: 'TWD', TZ: 'TZS', UA: 'UAH', UG: 'UGX', UY: 'UYU', UZ: 'UZS', VE: 'VES', VN: 'VND',
  VU: 'VUV', WS: 'WST', YE: 'YER', ZA: 'ZAR', ZM: 'ZMW', ZW: 'ZWG',
  // Australian dollar territories and states
  CX: 'AUD', CC: 'AUD', NF: 'AUD', KI: 'AUD', NR: 'AUD', TV: 'AUD',
  // US dollar users
  US: 'USD', EC: 'USD', SV: 'USD', PA: 'USD', PR: 'USD', GU: 'USD', VI: 'USD', AS: 'USD',
  MP: 'USD', TL: 'USD', FM: 'USD', MH: 'USD', PW: 'USD', BQ: 'USD', TC: 'USD', VG: 'USD',
  // Euro area (Bulgaria joined in 2026) and euro users
  AT: 'EUR', BE: 'EUR', BG: 'EUR', CY: 'EUR', DE: 'EUR', EE: 'EUR', ES: 'EUR', FI: 'EUR',
  FR: 'EUR', GR: 'EUR', HR: 'EUR', IE: 'EUR', IT: 'EUR', LT: 'EUR', LU: 'EUR', LV: 'EUR',
  MT: 'EUR', NL: 'EUR', PT: 'EUR', SI: 'EUR', SK: 'EUR', AD: 'EUR', MC: 'EUR', SM: 'EUR',
  VA: 'EUR', ME: 'EUR', XK: 'EUR', GF: 'EUR', GP: 'EUR', MQ: 'EUR', RE: 'EUR', YT: 'EUR',
  PM: 'EUR', BL: 'EUR', MF: 'EUR', AX: 'EUR',
  // CFA francs, CFP franc, East Caribbean dollar, Caribbean guilder
  CM: 'XAF', CF: 'XAF', TD: 'XAF', CG: 'XAF', GQ: 'XAF', GA: 'XAF',
  BJ: 'XOF', BF: 'XOF', CI: 'XOF', GW: 'XOF', ML: 'XOF', NE: 'XOF', SN: 'XOF', TG: 'XOF',
  PF: 'XPF', NC: 'XPF', WF: 'XPF',
  AG: 'XCD', DM: 'XCD', GD: 'XCD', KN: 'XCD', LC: 'XCD', VC: 'XCD', AI: 'XCD', MS: 'XCD',
  CW: 'XCG', SX: 'XCG',
};

export const FALLBACK_CURRENCY = 'USD';

/** Region subtag (e.g. "IN") from a BCP 47 locale, adding the likely region when missing. */
export function regionFromLocale(locale: string): string | undefined {
  try {
    return new Intl.Locale(locale).maximize().region;
  } catch {
    return undefined;
  }
}

/**
 * Picks the default base currency for a locale, limited to the currencies the app supports.
 * `supported` is the list loaded from the database.
 */
export function defaultCurrencyForLocale(locale: string, supported: ReadonlySet<string>): string {
  const region = regionFromLocale(locale);
  const candidate = region ? REGION_CURRENCY[region] : undefined;
  if (candidate && supported.has(candidate)) return candidate;
  return supported.has(FALLBACK_CURRENCY) ? FALLBACK_CURRENCY : ([...supported][0] ?? FALLBACK_CURRENCY);
}
