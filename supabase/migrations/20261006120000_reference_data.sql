-- Shared reference data: currencies and daily exchange rates.
-- Both are readable by any signed-in user and writable only by the backend (service role).

-- Private schema for helpers and trigger functions. Not exposed through the Data API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Keeps updated_at current on every user-owned table.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- currencies
-- Not in the spec's data model: added so SQL (conversions, recurring generation) knows each
-- currency's ISO 4217 minor-unit exponent. The list is the ISO currencies Frankfurter (the
-- exchange-rate provider) publishes rates for.
-- ---------------------------------------------------------------------------
create table public.currencies (
  code text primary key check (code ~ '^[A-Z]{3}$'),
  name text not null,
  exponent smallint not null check (exponent between 0 and 4)
);

comment on table public.currencies is 'ISO 4217 currencies supported by the app, with minor-unit exponents.';
comment on column public.currencies.exponent is 'Number of minor-unit digits: JPY 0, USD 2, KWD 3.';

alter table public.currencies enable row level security;

create policy "Signed-in users can read currencies"
  on public.currencies for select to authenticated
  using (true);

revoke all on public.currencies from anon, authenticated;
grant select on public.currencies to authenticated;

insert into public.currencies (code, name, exponent) values
  ('AED', 'United Arab Emirates Dirham', 2),
  ('AFN', 'Afghan Afghani', 2),
  ('ALL', 'Albanian Lek', 2),
  ('AMD', 'Armenian Dram', 2),
  ('AOA', 'Angolan Kwanza', 2),
  ('ARS', 'Argentine Peso', 2),
  ('AUD', 'Australian Dollar', 2),
  ('AWG', 'Aruban Florin', 2),
  ('AZN', 'Azerbaijani Manat', 2),
  ('BAM', 'Bosnia and Herzegovina Convertible Mark', 2),
  ('BBD', 'Barbadian Dollar', 2),
  ('BDT', 'Bangladeshi Taka', 2),
  ('BHD', 'Bahraini Dinar', 3),
  ('BIF', 'Burundian Franc', 0),
  ('BMD', 'Bermudian Dollar', 2),
  ('BND', 'Brunei Dollar', 2),
  ('BOB', 'Bolivian Boliviano', 2),
  ('BRL', 'Brazilian Real', 2),
  ('BSD', 'Bahamian Dollar', 2),
  ('BTN', 'Bhutanese Ngultrum', 2),
  ('BWP', 'Botswana Pula', 2),
  ('BYN', 'Belarusian Ruble', 2),
  ('BZD', 'Belize Dollar', 2),
  ('CAD', 'Canadian Dollar', 2),
  ('CDF', 'Congolese Franc', 2),
  ('CHF', 'Swiss Franc', 2),
  ('CLP', 'Chilean Peso', 0),
  ('CNY', 'Chinese Renminbi Yuan', 2),
  ('COP', 'Colombian Peso', 2),
  ('CRC', 'Costa Rican Colón', 2),
  ('CUP', 'Cuban Peso', 2),
  ('CVE', 'Cape Verdean Escudo', 2),
  ('CZK', 'Czech Koruna', 2),
  ('DJF', 'Djiboutian Franc', 0),
  ('DKK', 'Danish Krone', 2),
  ('DOP', 'Dominican Peso', 2),
  ('DZD', 'Algerian Dinar', 2),
  ('EGP', 'Egyptian Pound', 2),
  ('ERN', 'Eritrean Nakfa', 2),
  ('ETB', 'Ethiopian Birr', 2),
  ('EUR', 'Euro', 2),
  ('FJD', 'Fijian Dollar', 2),
  ('FKP', 'Falkland Pound', 2),
  ('GBP', 'British Pound', 2),
  ('GEL', 'Georgian Lari', 2),
  ('GHS', 'Ghanaian Cedi', 2),
  ('GIP', 'Gibraltar Pound', 2),
  ('GMD', 'Gambian Dalasi', 2),
  ('GNF', 'Guinean Franc', 0),
  ('GTQ', 'Guatemalan Quetzal', 2),
  ('GYD', 'Guyanese Dollar', 2),
  ('HKD', 'Hong Kong Dollar', 2),
  ('HNL', 'Honduran Lempira', 2),
  ('HTG', 'Haitian Gourde', 2),
  ('HUF', 'Hungarian Forint', 2),
  ('IDR', 'Indonesian Rupiah', 2),
  ('ILS', 'Israeli New Shekel', 2),
  ('INR', 'Indian Rupee', 2),
  ('IQD', 'Iraqi Dinar', 3),
  ('IRR', 'Iranian Rial', 2),
  ('ISK', 'Icelandic Króna', 0),
  ('JMD', 'Jamaican Dollar', 2),
  ('JOD', 'Jordanian Dinar', 3),
  ('JPY', 'Japanese Yen', 0),
  ('KES', 'Kenyan Shilling', 2),
  ('KGS', 'Kyrgyzstani Som', 2),
  ('KHR', 'Cambodian Riel', 2),
  ('KMF', 'Comorian Franc', 0),
  ('KPW', 'North Korean Won', 2),
  ('KRW', 'South Korean Won', 0),
  ('KWD', 'Kuwaiti Dinar', 3),
  ('KYD', 'Cayman Islands Dollar', 2),
  ('KZT', 'Kazakhstani Tenge', 2),
  ('LAK', 'Lao Kip', 2),
  ('LBP', 'Lebanese Pound', 2),
  ('LKR', 'Sri Lankan Rupee', 2),
  ('LRD', 'Liberian Dollar', 2),
  ('LSL', 'Lesotho Loti', 2),
  ('LYD', 'Libyan Dinar', 3),
  ('MAD', 'Moroccan Dirham', 2),
  ('MDL', 'Moldovan Leu', 2),
  ('MGA', 'Malagasy Ariary', 2),
  ('MKD', 'Macedonian Denar', 2),
  ('MMK', 'Myanmar Kyat', 2),
  ('MNT', 'Mongolian Tögrög', 2),
  ('MOP', 'Macanese Pataca', 2),
  ('MRU', 'Mauritanian Ouguiya', 2),
  ('MUR', 'Mauritian Rupee', 2),
  ('MVR', 'Maldivian Rufiyaa', 2),
  ('MWK', 'Malawian Kwacha', 2),
  ('MXN', 'Mexican Peso', 2),
  ('MYR', 'Malaysian Ringgit', 2),
  ('MZN', 'Mozambican Metical', 2),
  ('NAD', 'Namibian Dollar', 2),
  ('NGN', 'Nigerian Naira', 2),
  ('NIO', 'Nicaraguan Córdoba', 2),
  ('NOK', 'Norwegian Krone', 2),
  ('NPR', 'Nepalese Rupee', 2),
  ('NZD', 'New Zealand Dollar', 2),
  ('OMR', 'Omani Rial', 3),
  ('PAB', 'Panamanian Balboa', 2),
  ('PEN', 'Peruvian Sol', 2),
  ('PGK', 'Papua New Guinean Kina', 2),
  ('PHP', 'Philippine Peso', 2),
  ('PKR', 'Pakistani Rupee', 2),
  ('PLN', 'Polish Złoty', 2),
  ('PYG', 'Paraguayan Guaraní', 0),
  ('QAR', 'Qatari Riyal', 2),
  ('RON', 'Romanian Leu', 2),
  ('RSD', 'Serbian Dinar', 2),
  ('RUB', 'Russian Ruble', 2),
  ('RWF', 'Rwandan Franc', 0),
  ('SAR', 'Saudi Riyal', 2),
  ('SBD', 'Solomon Islands Dollar', 2),
  ('SCR', 'Seychellois Rupee', 2),
  ('SDG', 'Sudanese Pound', 2),
  ('SEK', 'Swedish Krona', 2),
  ('SGD', 'Singapore Dollar', 2),
  ('SHP', 'Saint Helenian Pound', 2),
  ('SLE', 'New Leone', 2),
  ('SOS', 'Somali Shilling', 2),
  ('SRD', 'Surinamese Dollar', 2),
  ('SSP', 'South Sudanese Pound', 2),
  ('STN', 'São Tomé and Príncipe Second Dobra', 2),
  ('SVC', 'Salvadoran Colón', 2),
  ('SYP', 'Syrian Pound', 2),
  ('SZL', 'Swazi Lilangeni', 2),
  ('THB', 'Thai Baht', 2),
  ('TJS', 'Tajikistani Somoni', 2),
  ('TMT', 'Turkmenistani Manat', 2),
  ('TND', 'Tunisian Dinar', 3),
  ('TOP', 'Tongan Paʻanga', 2),
  ('TRY', 'Turkish Lira', 2),
  ('TTD', 'Trinidad and Tobago Dollar', 2),
  ('TWD', 'New Taiwan Dollar', 2),
  ('TZS', 'Tanzanian Shilling', 2),
  ('UAH', 'Ukrainian Hryvnia', 2),
  ('UGX', 'Ugandan Shilling', 0),
  ('USD', 'United States Dollar', 2),
  ('UYU', 'Uruguayan Peso', 2),
  ('UZS', 'Uzbekistan Som', 2),
  ('VES', 'Venezuelan Bolívar Soberano', 2),
  ('VND', 'Vietnamese Đồng', 0),
  ('VUV', 'Vanuatu Vatu', 0),
  ('WST', 'Samoan Tala', 2),
  ('XAF', 'Central African CFA Franc', 0),
  ('XCD', 'East Caribbean Dollar', 2),
  ('XCG', 'Caribbean Guilder', 2),
  ('XOF', 'West African CFA Franc', 0),
  ('XPF', 'CFP Franc', 0),
  ('YER', 'Yemeni Rial', 2),
  ('ZAR', 'South African Rand', 2),
  ('ZMW', 'Zambian Kwacha', 2),
  ('ZWG', 'Zimbabwe Gold', 2);

-- ---------------------------------------------------------------------------
-- exchange_rates
-- Rates are stored against a single pivot currency per fetch (whatever the provider returns);
-- cross rates are derived in SQL. Rates are exact numerics and reach the browser as text.
-- ---------------------------------------------------------------------------
create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  base text not null references public.currencies (code),
  quote text not null references public.currencies (code),
  rate numeric not null check (rate > 0),
  constraint exchange_rates_date_base_quote_key unique (date, base, quote),
  constraint exchange_rates_distinct_pair check (base <> quote)
);

comment on table public.exchange_rates is 'Daily reference rates: 1 unit of base = rate units of quote.';

create index exchange_rates_latest_idx on public.exchange_rates (base, quote, date desc);

alter table public.exchange_rates enable row level security;

create policy "Signed-in users can read exchange rates"
  on public.exchange_rates for select to authenticated
  using (true);

revoke all on public.exchange_rates from anon, authenticated;
grant select on public.exchange_rates to authenticated;