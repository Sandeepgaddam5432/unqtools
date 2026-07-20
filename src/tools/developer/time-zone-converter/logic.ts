/**
 * Time Zone Converter — pure logic.
 *
 * Convert a date/time from one IANA time zone to many others, DST-aware for
 * any past/future date (incl. historical rule changes). Detects
 * spring-forward gaps and fall-back overlaps. Shows UTC offset, zone
 * abbreviation (IST/PST/etc.) and DST-active flag. Half-hour and 45-minute
 * zone support. Difference summary. Live "now" mode. Shareable URL.
 *
 * Pure functions only — no DOM, no network. Uses the browser's built-in
 * Intl.DateTimeFormat + IANA tz database.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CityEntry {
  city: string;
  country: string;
  zone: string;
  region?: string;
}

export interface ZoneParts {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hour: number;  // 0-23
  minute: number; // 0-59
  second: number; // 0-59
  weekday: string; // "Monday"
  weekdayShort: string; // "Mon"
  offsetMinutes: number; // signed minutes east of UTC (e.g. -300 for EST, 330 for IST)
  offsetLabel: string; // "-05:00" or "+05:30"
  abbreviation: string; // "EST", "EDT", "IST", "PST" etc.
  longName: string; // "Eastern Standard Time"
  dstActive: boolean;
  zone: string; // IANA id, echoed back
  iso: string; // ISO 8601 with offset, e.g. "2025-01-15T13:45:00-05:00"
}

export type Ambiguity = "unique" | "gap" | "overlap";

export interface ConversionResult {
  ok: true;
  source: ZoneParts;
  targets: ZoneParts[];
  differences: DifferenceEntry[];
  sourceInstantMs: number;
  ambiguity: Ambiguity;
  ambiguityMessage: string | null;
}

export type ConversionError = { ok: false; error: string };

export type ConvertOutcome = ConversionResult | ConversionError;

export interface DifferenceEntry {
  zone: string;
  /** Signed minutes that the target is AHEAD of the source (negative = behind). */
  diffMinutes: number;
  label: string; // "9h 30m ahead" / "3h behind" / "same time"
}

export interface NowSnapshot {
  instantMs: number;
  iso: string;
  utc: string;
  zone: string;
  parts: ZoneParts;
}

export interface HistoryEntry {
  ts: number;
  sourceZone: string;
  targetZones: string[];
  instantMs: number;
  iso: string;
}

// ---------------------------------------------------------------------------
// Constants — IANA zone list (430+ zones) + city database (200+ cities)
// ---------------------------------------------------------------------------

export const IANA_ZONES: ReadonlyArray<string> = [
  "Africa/Abidjan", "Africa/Accra", "Africa/Addis_Ababa", "Africa/Algiers",
  "Africa/Asmara", "Africa/Asmera", "Africa/Bamako", "Africa/Bangui",
  "Africa/Banjul", "Africa/Bissau", "Africa/Blantyre", "Africa/Brazzaville",
  "Africa/Bujumbura", "Africa/Cairo", "Africa/Casablanca", "Africa/Ceuta",
  "Africa/Conakry", "Africa/Dakar", "Africa/Dar_es_Salaam", "Africa/Djibouti",
  "Africa/Douala", "Africa/El_Aaiun", "Africa/Freetown", "Africa/Gaborone",
  "Africa/Harare", "Africa/Johannesburg", "Africa/Juba", "Africa/Kampala",
  "Africa/Khartoum", "Africa/Kigali", "Africa/Kinshasa", "Africa/Lagos",
  "Africa/Libreville", "Africa/Lome", "Africa/Luanda", "Africa/Lubumbashi",
  "Africa/Lusaka", "Africa/Malabo", "Africa/Maputo", "Africa/Maseru",
  "Africa/Mbabane", "Africa/Mogadishu", "Africa/Monrovia", "Africa/Nairobi",
  "Africa/Ndjamena", "Africa/Niamey", "Africa/Nouakchott", "Africa/Ouagadougou",
  "Africa/Porto-Novo", "Africa/Sao_Tome", "Africa/Timbuktu", "Africa/Tripoli",
  "Africa/Tunis", "Africa/Windhoek",
  "America/Adak", "America/Anchorage", "America/Anguilla", "America/Antigua",
  "America/Araguaina", "America/Argentina/Buenos_Aires", "America/Argentina/Catamarca",
  "America/Argentina/ComodRivadavia", "America/Argentina/Cordoba",
  "America/Argentina/Jujuy", "America/Argentina/La_Rioja",
  "America/Argentina/Mendoza", "America/Argentina/Rio_Gallegos",
  "America/Argentina/Salta", "America/Argentina/San_Juan",
  "America/Argentina/San_Luis", "America/Argentina/Tucuman",
  "America/Argentina/Ushuaia", "America/Aruba", "America/Asuncion",
  "America/Atikokan", "America/Atka", "America/Bahia", "America/Bahia_Banderas",
  "America/Barbados", "America/Belem", "America/Belize", "America/Blanc-Sablon",
  "America/Boa_Vista", "America/Bogota", "America/Boise", "America/Buenos_Aires",
  "America/Cambridge_Bay", "America/Campo_Grande", "America/Cancun",
  "America/Caracas", "America/Catamarca", "America/Cayenne", "America/Cayman",
  "America/Chicago", "America/Chihuahua", "America/Coral_Harbour",
  "America/Cordoba", "America/Costa_Rica", "America/Creston", "America/Cuiaba",
  "America/Curacao", "America/Danmarkshavn", "America/Dawson",
  "America/Dawson_Creek", "America/Denver", "America/Detroit",
  "America/Dominica", "America/Edmonton", "America/Eirunepe", "America/El_Salvador",
  "America/Ensenada", "America/Fortaleza", "America/Fort_Nelson", "America/Fort_Wayne",
  "America/Glace_Bay", "America/Godthab", "America/Goose_Bay", "America/Grand_Turk",
  "America/Grenada", "America/Guadeloupe", "America/Guatemala", "America/Guayaquil",
  "America/Guyana", "America/Halifax", "America/Havana", "America/Hermosillo",
  "America/Indiana/Indianapolis", "America/Indiana/Knox", "America/Indiana/Marengo",
  "America/Indiana/Petersburg", "America/Indiana/Tell_City", "America/Indiana/Vevay",
  "America/Indiana/Vincennes", "America/Indiana/Winamac", "America/Indianapolis",
  "America/Inuvik", "America/Iqaluit", "America/Jamaica", "America/Jujuy",
  "America/Juneau", "America/Kentucky/Louisville", "America/Kentucky/Monticello",
  "America/Knox_IN", "America/Kralendijk", "America/La_Paz", "America/Lima",
  "America/Los_Angeles", "America/Louisville", "America/Lower_Princes",
  "America/Maceio", "America/Managua", "America/Manaus", "America/Marigot",
  "America/Martinique", "America/Matamoros", "America/Mazatlan", "America/Mendoza",
  "America/Menominee", "America/Merida", "America/Metlakatla", "America/Mexico_City",
  "America/Miquelon", "America/Moncton", "America/Monterrey", "America/Montevideo",
  "America/Montreal", "America/Montserrat", "America/Nassau", "America/New_York",
  "America/Nipigon", "America/Nome", "America/Noronha", "America/North_Dakota/Beulah",
  "America/North_Dakota/Center", "America/North_Dakota/New_Salem",
  "America/Nuuk", "America/Ojinaga", "America/Panama", "America/Pangnirtung",
  "America/Paramaribo", "America/Phoenix", "America/Port-au-Prince",
  "America/Porto_Acre", "America/Port_of_Spain", "America/Porto_Velho",
  "America/Puerto_Rico", "America/Punta_Arenas", "America/Rainy_River",
  "America/Rankin_Inlet", "America/Recife", "America/Regina", "America/Resolute",
  "America/Rio_Branco", "America/Rosario", "America/Santa_Isabel",
  "America/Santarem", "America/Santiago", "America/Santo_Domingo",
  "America/Sao_Paulo", "America/Scoresbysund", "America/Shiprock",
  "America/Sitka", "America/St_Barthelemy", "America/St_Johns",
  "America/St_Kitts", "America/St_Lucia", "America/St_Thomas", "America/St_Vincent",
  "America/Swift_Current", "America/Tegucigalpa", "America/Thule",
  "America/Thunder_Bay", "America/Tijuana", "America/Toronto", "America/Tortola",
  "America/Vancouver", "America/Virgin", "America/Whitehorse", "America/Winnipeg",
  "America/Yakutat", "America/Yellowknife",
  "Antarctica/Casey", "Antarctica/Davis", "Antarctica/DumontDUrville",
  "Antarctica/Macquarie", "Antarctica/Mawson", "Antarctica/McMurdo",
  "Antarctica/Palmer", "Antarctica/Rothera", "Antarctica/South_Pole",
  "Antarctica/Syowa", "Antarctica/Troll", "Antarctica/Vostok",
  "Arctic/Longyearbyen",
  "Asia/Aden", "Asia/Almaty", "Asia/Amman", "Asia/Anadyr", "Asia/Aqtau",
  "Asia/Aqtobe", "Asia/Ashgabat", "Asia/Ashkhabad", "Asia/Atyrau", "Asia/Baghdad",
  "Asia/Bahrain", "Asia/Baku", "Asia/Bangkok", "Asia/Barnaul", "Asia/Beirut",
  "Asia/Bishkek", "Asia/Brunei", "Asia/Calcutta", "Asia/Chita", "Asia/Choibalsan",
  "Asia/Chongqing", "Asia/Chungking", "Asia/Colombo", "Asia/Dacca", "Asia/Damascus",
  "Asia/Dhaka", "Asia/Dili", "Asia/Dubai", "Asia/Dushanbe", "Asia/Famagusta",
  "Asia/Gaza", "Asia/Harbin", "Asia/Hebron", "Asia/Ho_Chi_Minh", "Asia/Hong_Kong",
  "Asia/Hovd", "Asia/Irkutsk", "Asia/Istanbul", "Asia/Jakarta", "Asia/Jayapura",
  "Asia/Jerusalem", "Asia/Kabul", "Asia/Kamchatka", "Asia/Karachi", "Asia/Kashgar",
  "Asia/Kathmandu", "Asia/Katmandu", "Asia/Khandyga", "Asia/Kolkata",
  "Asia/Krasnoyarsk", "Asia/Kuala_Lumpur", "Asia/Kuching", "Asia/Kuwait",
  "Asia/Macao", "Asia/Macau", "Asia/Magadan", "Asia/Makassar", "Asia/Manila",
  "Asia/Muscat", "Asia/Nicosia", "Asia/Novokuznetsk", "Asia/Novosibirsk",
  "Asia/Omsk", "Asia/Oral", "Asia/Phnom_Penh", "Asia/Pontianak", "Asia/Pyongyang",
  "Asia/Qatar", "Asia/Qostanay", "Asia/Qyzylorda", "Asia/Rangoon", "Asia/Riyadh",
  "Asia/Saigon", "Asia/Sakhalin", "Asia/Samarkand", "Asia/Seoul", "Asia/Shanghai",
  "Asia/Singapore", "Asia/Srednekolymsk", "Asia/Taipei", "Asia/Tashkent",
  "Asia/Tbilisi", "Asia/Tehran", "Asia/Tel_Aviv", "Asia/Thimbu", "Asia/Thimphu",
  "Asia/Tokyo", "Asia/Tomsk", "Asia/Ujung_Pandang", "Asia/Ulaanbaatar",
  "Asia/Ulan_Bator", "Asia/Urumqi", "Asia/Ust-Nera", "Asia/Vientiane",
  "Asia/Vladivostok", "Asia/Yakutsk", "Asia/Yangon", "Asia/Yekaterinburg",
  "Asia/Yerevan",
  "Atlantic/Azores", "Atlantic/Bermuda", "Atlantic/Canary", "Atlantic/Cape_Verde",
  "Atlantic/Faeroe", "Atlantic/Faroe", "Atlantic/Jan_Mayen", "Atlantic/Madeira",
  "Atlantic/Reykjavik", "Atlantic/South_Georgia", "Atlantic/St_Helena",
  "Atlantic/Stanley",
  "Australia/ACT", "Australia/Adelaide", "Australia/Brisbane",
  "Australia/Broken_Hill", "Australia/Canberra", "Australia/Currie",
  "Australia/Darwin", "Australia/Eucla", "Australia/Hobart", "Australia/LHI",
  "Australia/Lindeman", "Australia/Lord_Howe", "Australia/Melbourne",
  "Australia/NSW", "Australia/North", "Australia/Perth", "Australia/Queensland",
  "Australia/South", "Australia/Sydney", "Australia/Tasmania", "Australia/Victoria",
  "Australia/West", "Australia/Yancowinna",
  "Brazil/Acre", "Brazil/DeNoronha", "Brazil/East", "Brazil/West",
  "CET", "CST6CDT",
  "Canada/Atlantic", "Canada/Central", "Canada/Eastern", "Canada/Mountain",
  "Canada/Newfoundland", "Canada/Pacific", "Canada/Saskatchewan", "Canada/Yukon",
  "Chile/Continental", "Chile/EasterIsland",
  "Cuba", "EET", "EST", "EST5EDT", "Egypt", "Eire", "Etc/GMT", "Etc/GMT+0",
  "Etc/GMT+1", "Etc/GMT+10", "Etc/GMT+11", "Etc/GMT+12", "Etc/GMT+2",
  "Etc/GMT+3", "Etc/GMT+4", "Etc/GMT+5", "Etc/GMT+6", "Etc/GMT+7", "Etc/GMT+8",
  "Etc/GMT+9", "Etc/GMT-0", "Etc/GMT-1", "Etc/GMT-10", "Etc/GMT-11",
  "Etc/GMT-12", "Etc/GMT-13", "Etc/GMT-14", "Etc/GMT-2", "Etc/GMT-3",
  "Etc/GMT-4", "Etc/GMT-5", "Etc/GMT-6", "Etc/GMT-7", "Etc/GMT-8", "Etc/GMT-9",
  "Etc/GMT0", "Etc/Greenwich", "Etc/UCT", "Etc/UTC", "Etc/Universal", "Etc/Zulu",
  "Europe/Amsterdam", "Europe/Andorra", "Europe/Astrakhan", "Europe/Athens",
  "Europe/Belfast", "Europe/Belgrade", "Europe/Berlin", "Europe/Bratislava",
  "Europe/Brussels", "Europe/Bucharest", "Europe/Budapest", "Europe/Busingen",
  "Europe/Chisinau", "Europe/Copenhagen", "Europe/Dublin", "Europe/Gibraltar",
  "Europe/Guernsey", "Europe/Helsinki", "Europe/Isle_of_Man", "Europe/Istanbul",
  "Europe/Jersey", "Europe/Kaliningrad", "Europe/Kiev", "Europe/Kirov",
  "Europe/Lisbon", "Europe/Ljubljana", "Europe/London", "Europe/Luxembourg",
  "Europe/Madrid", "Europe/Malta", "Europe/Mariehamn", "Europe/Minsk",
  "Europe/Monaco", "Europe/Moscow", "Europe/Nicosia", "Europe/Oslo",
  "Europe/Paris", "Europe/Podgorica", "Europe/Prague", "Europe/Riga",
  "Europe/Rome", "Europe/Samara", "Europe/San_Marino", "Europe/Sarajevo",
  "Europe/Saratov", "Europe/Simferopol", "Europe/Skopje", "Europe/Sofia",
  "Europe/Stockholm", "Europe/Tallinn", "Europe/Tirane", "Europe/Tiraspol",
  "Europe/Ulyanovsk", "Europe/Uzhgorod", "Europe/Vaduz", "Europe/Vatican",
  "Europe/Vienna", "Europe/Vilnius", "Europe/Volgograd", "Europe/Warsaw",
  "Europe/Zagreb", "Europe/Zaporozhye", "Europe/Zurich",
  "Factory", "GB", "GB-Eire", "GMT", "GMT+0", "GMT-0", "GMT0", "Greenwich",
  "HST", "Hongkong", "Iceland", "Indian/Antananarivo", "Indian/Chagos",
  "Indian/Christmas", "Indian/Cocos", "Indian/Comoro", "Indian/Kerguelen",
  "Indian/Mahe", "Indian/Maldives", "Indian/Mauritius", "Indian/Mayotte",
  "Indian/Reunion", "Iran", "Israel", "Jamaica", "Japan", "Kwajalein", "Libya",
  "MET", "MST", "MST7MDT", "Mexico/BajaNorte", "Mexico/BajaSur", "Mexico/General",
  "NZ", "NZ-CHAT", "Navajo", "PRC", "PST8PDT", "Pacific/Apia", "Pacific/Auckland",
  "Pacific/Bougainville", "Pacific/Chatham", "Pacific/Chuuk", "Pacific/Easter",
  "Pacific/Efate", "Pacific/Enderbury", "Pacific/Fakaofo", "Pacific/Fiji",
  "Pacific/Funafuti", "Pacific/Galapagos", "Pacific/Gambier", "Pacific/Guadalcanal",
  "Pacific/Guam", "Pacific/Honolulu", "Pacific/Johnston", "Pacific/Kiritimati",
  "Pacific/Kosrae", "Pacific/Kwajalein", "Pacific/Majuro", "Pacific/Marquesas",
  "Pacific/Midway", "Pacific/Nauru", "Pacific/Niue", "Pacific/Norfolk",
  "Pacific/Noumea", "Pacific/Pago_Pago", "Pacific/Palau", "Pacific/Pitcairn",
  "Pacific/Pohnpei", "Pacific/Ponape", "Pacific/Port_Moresby", "Pacific/Rarotonga",
  "Pacific/Saipan", "Pacific/Samoa", "Pacific/Tahiti", "Pacific/Tarawa",
  "Pacific/Tongatapu", "Pacific/Truk", "Pacific/Wake", "Pacific/Wallis",
  "Pacific/Yap", "Poland", "Portugal", "ROC", "ROK", "Singapore", "Turkey",
  "UCT", "US/Alaska", "US/Aleutian", "US/Arizona", "US/Central", "US/East-Indiana",
  "US/Eastern", "US/Hawaii", "US/Indiana-Starke", "US/Michigan", "US/Mountain",
  "US/Pacific", "US/Pacific-New", "US/Samoa", "UTC", "Universal", "W-SU", "WET",
  "Zulu",
];

export const CITY_DATABASE: ReadonlyArray<CityEntry> = [
  // North America
  { city: "New York", country: "United States", zone: "America/New_York", region: "NY" },
  { city: "Los Angeles", country: "United States", zone: "America/Los_Angeles", region: "CA" },
  { city: "Chicago", country: "United States", zone: "America/Chicago", region: "IL" },
  { city: "Denver", country: "United States", zone: "America/Denver", region: "CO" },
  { city: "Houston", country: "United States", zone: "America/Chicago", region: "TX" },
  { city: "Phoenix", country: "United States", zone: "America/Phoenix", region: "AZ" },
  { city: "Philadelphia", country: "United States", zone: "America/New_York", region: "PA" },
  { city: "San Antonio", country: "United States", zone: "America/Chicago", region: "TX" },
  { city: "San Diego", country: "United States", zone: "America/Los_Angeles", region: "CA" },
  { city: "Dallas", country: "United States", zone: "America/Chicago", region: "TX" },
  { city: "San Francisco", country: "United States", zone: "America/Los_Angeles", region: "CA" },
  { city: "Seattle", country: "United States", zone: "America/Los_Angeles", region: "WA" },
  { city: "Boston", country: "United States", zone: "America/New_York", region: "MA" },
  { city: "Atlanta", country: "United States", zone: "America/New_York", region: "GA" },
  { city: "Miami", country: "United States", zone: "America/New_York", region: "FL" },
  { city: "Detroit", country: "United States", zone: "America/Detroit", region: "MI" },
  { city: "Washington DC", country: "United States", zone: "America/New_York" },
  { city: "Las Vegas", country: "United States", zone: "America/Los_Angeles", region: "NV" },
  { city: "Portland", country: "United States", zone: "America/Los_Angeles", region: "OR" },
  { city: "Salt Lake City", country: "United States", zone: "America/Denver", region: "UT" },
  { city: "Honolulu", country: "United States", zone: "Pacific/Honolulu", region: "HI" },
  { city: "Anchorage", country: "United States", zone: "America/Anchorage", region: "AK" },
  { city: "Minneapolis", country: "United States", zone: "America/Chicago", region: "MN" },
  { city: "Toronto", country: "Canada", zone: "America/Toronto", region: "ON" },
  { city: "Vancouver", country: "Canada", zone: "America/Vancouver", region: "BC" },
  { city: "Montreal", country: "Canada", zone: "America/Toronto", region: "QC" },
  { city: "Calgary", country: "Canada", zone: "America/Edmonton", region: "AB" },
  { city: "Edmonton", country: "Canada", zone: "America/Edmonton", region: "AB" },
  { city: "Ottawa", country: "Canada", zone: "America/Toronto", region: "ON" },
  { city: "Winnipeg", country: "Canada", zone: "America/Winnipeg", region: "MB" },
  { city: "Halifax", country: "Canada", zone: "America/Halifax", region: "NS" },
  { city: "St. John's", country: "Canada", zone: "America/St_Johns", region: "NL" },
  { city: "Mexico City", country: "Mexico", zone: "America/Mexico_City" },
  { city: "Guadalajara", country: "Mexico", zone: "America/Mexico_City" },
  { city: "Monterrey", country: "Mexico", zone: "America/Monterrey" },
  { city: "Tijuana", country: "Mexico", zone: "America/Tijuana" },
  { city: "Cancun", country: "Mexico", zone: "America/Cancun" },
  // Central America & Caribbean
  { city: "Guatemala City", country: "Guatemala", zone: "America/Guatemala" },
  { city: "San Jose", country: "Costa Rica", zone: "America/Costa_Rica" },
  { city: "Panama City", country: "Panama", zone: "America/Panama" },
  { city: "Havana", country: "Cuba", zone: "America/Havana" },
  { city: "Santo Domingo", country: "Dominican Republic", zone: "America/Santo_Domingo" },
  { city: "San Juan", country: "Puerto Rico", zone: "America/Puerto_Rico" },
  { city: "Port-au-Prince", country: "Haiti", zone: "America/Port-au-Prince" },
  { city: "Kingston", country: "Jamaica", zone: "America/Jamaica" },
  { city: "Nassau", country: "Bahamas", zone: "America/Nassau" },
  { city: "Bridgetown", country: "Barbados", zone: "America/Barbados" },
  { city: "Port of Spain", country: "Trinidad and Tobago", zone: "America/Port_of_Spain" },
  // South America
  { city: "Sao Paulo", country: "Brazil", zone: "America/Sao_Paulo" },
  { city: "Rio de Janeiro", country: "Brazil", zone: "America/Sao_Paulo" },
  { city: "Brasilia", country: "Brazil", zone: "America/Sao_Paulo" },
  { city: "Manaus", country: "Brazil", zone: "America/Manaus" },
  { city: "Buenos Aires", country: "Argentina", zone: "America/Argentina/Buenos_Aires" },
  { city: "Cordoba", country: "Argentina", zone: "America/Argentina/Cordoba" },
  { city: "Mendoza", country: "Argentina", zone: "America/Argentina/Mendoza" },
  { city: "Santiago", country: "Chile", zone: "America/Santiago" },
  { city: "Lima", country: "Peru", zone: "America/Lima" },
  { city: "Bogota", country: "Colombia", zone: "America/Bogota" },
  { city: "Quito", country: "Ecuador", zone: "America/Guayaquil" },
  { city: "Caracas", country: "Venezuela", zone: "America/Caracas" },
  { city: "Montevideo", country: "Uruguay", zone: "America/Montevideo" },
  { city: "Asuncion", country: "Paraguay", zone: "America/Asuncion" },
  { city: "La Paz", country: "Bolivia", zone: "America/La_Paz" },
  { city: "Sucre", country: "Bolivia", zone: "America/La_Paz" },
  { city: "Georgetown", country: "Guyana", zone: "America/Guyana" },
  { city: "Paramaribo", country: "Suriname", zone: "America/Paramaribo" },
  { city: "Cayenne", country: "French Guiana", zone: "America/Cayenne" },
  { city: "Stanley", country: "Falkland Islands", zone: "Atlantic/Stanley" },
  // Europe
  { city: "London", country: "United Kingdom", zone: "Europe/London" },
  { city: "Edinburgh", country: "United Kingdom", zone: "Europe/London" },
  { city: "Glasgow", country: "United Kingdom", zone: "Europe/London" },
  { city: "Cardiff", country: "United Kingdom", zone: "Europe/London" },
  { city: "Belfast", country: "United Kingdom", zone: "Europe/Belfast" },
  { city: "Dublin", country: "Ireland", zone: "Europe/Dublin" },
  { city: "Paris", country: "France", zone: "Europe/Paris" },
  { city: "Marseille", country: "France", zone: "Europe/Paris" },
  { city: "Lyon", country: "France", zone: "Europe/Paris" },
  { city: "Berlin", country: "Germany", zone: "Europe/Berlin" },
  { city: "Munich", country: "Germany", zone: "Europe/Berlin" },
  { city: "Frankfurt", country: "Germany", zone: "Europe/Berlin" },
  { city: "Hamburg", country: "Germany", zone: "Europe/Berlin" },
  { city: "Cologne", country: "Germany", zone: "Europe/Berlin" },
  { city: "Madrid", country: "Spain", zone: "Europe/Madrid" },
  { city: "Barcelona", country: "Spain", zone: "Europe/Madrid" },
  { city: "Seville", country: "Spain", zone: "Europe/Madrid" },
  { city: "Rome", country: "Italy", zone: "Europe/Rome" },
  { city: "Milan", country: "Italy", zone: "Europe/Rome" },
  { city: "Naples", country: "Italy", zone: "Europe/Rome" },
  { city: "Florence", country: "Italy", zone: "Europe/Rome" },
  { city: "Venice", country: "Italy", zone: "Europe/Rome" },
  { city: "Lisbon", country: "Portugal", zone: "Europe/Lisbon" },
  { city: "Porto", country: "Portugal", zone: "Europe/Lisbon" },
  { city: "Amsterdam", country: "Netherlands", zone: "Europe/Amsterdam" },
  { city: "Rotterdam", country: "Netherlands", zone: "Europe/Amsterdam" },
  { city: "Brussels", country: "Belgium", zone: "Europe/Brussels" },
  { city: "Vienna", country: "Austria", zone: "Europe/Vienna" },
  { city: "Zurich", country: "Switzerland", zone: "Europe/Zurich" },
  { city: "Geneva", country: "Switzerland", zone: "Europe/Zurich" },
  { city: "Bern", country: "Switzerland", zone: "Europe/Zurich" },
  { city: "Stockholm", country: "Sweden", zone: "Europe/Stockholm" },
  { city: "Gothenburg", country: "Sweden", zone: "Europe/Stockholm" },
  { city: "Oslo", country: "Norway", zone: "Europe/Oslo" },
  { city: "Copenhagen", country: "Denmark", zone: "Europe/Copenhagen" },
  { city: "Helsinki", country: "Finland", zone: "Europe/Helsinki" },
  { city: "Reykjavik", country: "Iceland", zone: "Atlantic/Reykjavik" },
  { city: "Moscow", country: "Russia", zone: "Europe/Moscow" },
  { city: "St. Petersburg", country: "Russia", zone: "Europe/Moscow" },
  { city: "Kaliningrad", country: "Russia", zone: "Europe/Kaliningrad" },
  { city: "Warsaw", country: "Poland", zone: "Europe/Warsaw" },
  { city: "Prague", country: "Czech Republic", zone: "Europe/Prague" },
  { city: "Bratislava", country: "Slovakia", zone: "Europe/Bratislava" },
  { city: "Budapest", country: "Hungary", zone: "Europe/Budapest" },
  { city: "Bucharest", country: "Romania", zone: "Europe/Bucharest" },
  { city: "Sofia", country: "Bulgaria", zone: "Europe/Sofia" },
  { city: "Athens", country: "Greece", zone: "Europe/Athens" },
  { city: "Thessaloniki", country: "Greece", zone: "Europe/Athens" },
  { city: "Belgrade", country: "Serbia", zone: "Europe/Belgrade" },
  { city: "Zagreb", country: "Croatia", zone: "Europe/Zagreb" },
  { city: "Ljubljana", country: "Slovenia", zone: "Europe/Ljubljana" },
  { city: "Sarajevo", country: "Bosnia and Herzegovina", zone: "Europe/Sarajevo" },
  { city: "Skopje", country: "North Macedonia", zone: "Europe/Skopje" },
  { city: "Tirana", country: "Albania", zone: "Europe/Tirane" },
  { city: "Vilnius", country: "Lithuania", zone: "Europe/Vilnius" },
  { city: "Riga", country: "Latvia", zone: "Europe/Riga" },
  { city: "Tallinn", country: "Estonia", zone: "Europe/Tallinn" },
  { city: "Minsk", country: "Belarus", zone: "Europe/Minsk" },
  { city: "Kyiv", country: "Ukraine", zone: "Europe/Kiev" },
  { city: "Lviv", country: "Ukraine", zone: "Europe/Kiev" },
  { city: "Chisinau", country: "Moldova", zone: "Europe/Chisinau" },
  { city: "Tbilisi", country: "Georgia", zone: "Asia/Tbilisi" },
  { city: "Yerevan", country: "Armenia", zone: "Asia/Yerevan" },
  { city: "Baku", country: "Azerbaijan", zone: "Asia/Baku" },
  { city: "Istanbul", country: "Turkey", zone: "Europe/Istanbul" },
  { city: "Ankara", country: "Turkey", zone: "Europe/Istanbul" },
  { city: "Nicosia", country: "Cyprus", zone: "Asia/Nicosia" },
  { city: "Luxembourg", country: "Luxembourg", zone: "Europe/Luxembourg" },
  { city: "Monaco", country: "Monaco", zone: "Europe/Monaco" },
  { city: "Vaduz", country: "Liechtenstein", zone: "Europe/Vaduz" },
  { city: "San Marino", country: "San Marino", zone: "Europe/San_Marino" },
  { city: "Valletta", country: "Malta", zone: "Europe/Malta" },
  { city: "Andorra la Vella", country: "Andorra", zone: "Europe/Andorra" },
  // Africa
  { city: "Cairo", country: "Egypt", zone: "Africa/Cairo" },
  { city: "Alexandria", country: "Egypt", zone: "Africa/Cairo" },
  { city: "Lagos", country: "Nigeria", zone: "Africa/Lagos" },
  { city: "Nairobi", country: "Kenya", zone: "Africa/Nairobi" },
  { city: "Johannesburg", country: "South Africa", zone: "Africa/Johannesburg" },
  { city: "Cape Town", country: "South Africa", zone: "Africa/Johannesburg" },
  { city: "Durban", country: "South Africa", zone: "Africa/Johannesburg" },
  { city: "Pretoria", country: "South Africa", zone: "Africa/Johannesburg" },
  { city: "Casablanca", country: "Morocco", zone: "Africa/Casablanca" },
  { city: "Rabat", country: "Morocco", zone: "Africa/Casablanca" },
  { city: "Algiers", country: "Algeria", zone: "Africa/Algiers" },
  { city: "Tunis", country: "Tunisia", zone: "Africa/Tunis" },
  { city: "Tripoli", country: "Libya", zone: "Africa/Tripoli" },
  { city: "Accra", country: "Ghana", zone: "Africa/Accra" },
  { city: "Dakar", country: "Senegal", zone: "Africa/Dakar" },
  { city: "Abidjan", country: "Cote d'Ivoire", zone: "Africa/Abidjan" },
  { city: "Addis Ababa", country: "Ethiopia", zone: "Africa/Addis_Ababa" },
  { city: "Khartoum", country: "Sudan", zone: "Africa/Khartoum" },
  { city: "Dar es Salaam", country: "Tanzania", zone: "Africa/Dar_es_Salaam" },
  { city: "Kampala", country: "Uganda", zone: "Africa/Kampala" },
  { city: "Kigali", country: "Rwanda", zone: "Africa/Kigali" },
  { city: "Bujumbura", country: "Burundi", zone: "Africa/Bujumbura" },
  { city: "Kinshasa", country: "DR Congo", zone: "Africa/Kinshasa" },
  { city: "Lubumbashi", country: "DR Congo", zone: "Africa/Lubumbashi" },
  { city: "Brazzaville", country: "Republic of Congo", zone: "Africa/Brazzaville" },
  { city: "Luanda", country: "Angola", zone: "Africa/Luanda" },
  { city: "Lusaka", country: "Zambia", zone: "Africa/Lusaka" },
  { city: "Harare", country: "Zimbabwe", zone: "Africa/Harare" },
  { city: "Maputo", country: "Mozambique", zone: "Africa/Maputo" },
  { city: "Windhoek", country: "Namibia", zone: "Africa/Windhoek" },
  { city: "Gaborone", country: "Botswana", zone: "Africa/Gaborone" },
  { city: "Maseru", country: "Lesotho", zone: "Africa/Maseru" },
  { city: "Mbabane", country: "Eswatini", zone: "Africa/Mbabane" },
  { city: "Antananarivo", country: "Madagascar", zone: "Indian/Antananarivo" },
  { city: "Port Louis", country: "Mauritius", zone: "Indian/Mauritius" },
  { city: "Reunion", country: "Reunion", zone: "Indian/Reunion" },
  { city: "Mogadishu", country: "Somalia", zone: "Africa/Mogadishu" },
  { city: "Asmara", country: "Eritrea", zone: "Africa/Asmara" },
  { city: "Djibouti", country: "Djibouti", zone: "Africa/Djibouti" },
  // Middle East
  { city: "Dubai", country: "United Arab Emirates", zone: "Asia/Dubai" },
  { city: "Abu Dhabi", country: "United Arab Emirates", zone: "Asia/Dubai" },
  { city: "Doha", country: "Qatar", zone: "Asia/Qatar" },
  { city: "Riyadh", country: "Saudi Arabia", zone: "Asia/Riyadh" },
  { city: "Jeddah", country: "Saudi Arabia", zone: "Asia/Riyadh" },
  { city: "Mecca", country: "Saudi Arabia", zone: "Asia/Riyadh" },
  { city: "Kuwait City", country: "Kuwait", zone: "Asia/Kuwait" },
  { city: "Manama", country: "Bahrain", zone: "Asia/Bahrain" },
  { city: "Muscat", country: "Oman", zone: "Asia/Muscat" },
  { city: "Tehran", country: "Iran", zone: "Asia/Tehran" },
  { city: "Baghdad", country: "Iraq", zone: "Asia/Baghdad" },
  { city: "Amman", country: "Jordan", zone: "Asia/Amman" },
  { city: "Beirut", country: "Lebanon", zone: "Asia/Beirut" },
  { city: "Damascus", country: "Syria", zone: "Asia/Damascus" },
  { city: "Jerusalem", country: "Israel", zone: "Asia/Jerusalem" },
  { city: "Tel Aviv", country: "Israel", zone: "Asia/Jerusalem" },
  { city: "Gaza", country: "Palestine", zone: "Asia/Gaza" },
  { city: "Hebron", country: "Palestine", zone: "Asia/Hebron" },
  { city: "Sanaa", country: "Yemen", zone: "Asia/Aden" },
  // Asia
  { city: "Tokyo", country: "Japan", zone: "Asia/Tokyo" },
  { city: "Osaka", country: "Japan", zone: "Asia/Tokyo" },
  { city: "Kyoto", country: "Japan", zone: "Asia/Tokyo" },
  { city: "Nagoya", country: "Japan", zone: "Asia/Tokyo" },
  { city: "Sapporo", country: "Japan", zone: "Asia/Tokyo" },
  { city: "Seoul", country: "South Korea", zone: "Asia/Seoul" },
  { city: "Busan", country: "South Korea", zone: "Asia/Seoul" },
  { city: "Pyongyang", country: "North Korea", zone: "Asia/Pyongyang" },
  { city: "Beijing", country: "China", zone: "Asia/Shanghai" },
  { city: "Shanghai", country: "China", zone: "Asia/Shanghai" },
  { city: "Guangzhou", country: "China", zone: "Asia/Shanghai" },
  { city: "Shenzhen", country: "China", zone: "Asia/Shanghai" },
  { city: "Chengdu", country: "China", zone: "Asia/Shanghai" },
  { city: "Hong Kong", country: "Hong Kong", zone: "Asia/Hong_Kong" },
  { city: "Macau", country: "Macau", zone: "Asia/Macau" },
  { city: "Taipei", country: "Taiwan", zone: "Asia/Taipei" },
  { city: "Kaohsiung", country: "Taiwan", zone: "Asia/Taipei" },
  { city: "Manila", country: "Philippines", zone: "Asia/Manila" },
  { city: "Hanoi", country: "Vietnam", zone: "Asia/Ho_Chi_Minh" },
  { city: "Ho Chi Minh City", country: "Vietnam", zone: "Asia/Ho_Chi_Minh" },
  { city: "Bangkok", country: "Thailand", zone: "Asia/Bangkok" },
  { city: "Phnom Penh", country: "Cambodia", zone: "Asia/Phnom_Penh" },
  { city: "Vientiane", country: "Laos", zone: "Asia/Vientiane" },
  { city: "Yangon", country: "Myanmar", zone: "Asia/Yangon" },
  { city: "Kuala Lumpur", country: "Malaysia", zone: "Asia/Kuala_Lumpur" },
  { city: "Singapore", country: "Singapore", zone: "Asia/Singapore" },
  { city: "Jakarta", country: "Indonesia", zone: "Asia/Jakarta" },
  { city: "Bali", country: "Indonesia", zone: "Asia/Makassar" },
  { city: "Surabaya", country: "Indonesia", zone: "Asia/Jakarta" },
  { city: "Bandung", country: "Indonesia", zone: "Asia/Jakarta" },
  { city: "New Delhi", country: "India", zone: "Asia/Kolkata" },
  { city: "Mumbai", country: "India", zone: "Asia/Kolkata" },
  { city: "Bangalore", country: "India", zone: "Asia/Kolkata" },
  { city: "Chennai", country: "India", zone: "Asia/Kolkata" },
  { city: "Hyderabad", country: "India", zone: "Asia/Kolkata" },
  { city: "Kolkata", country: "India", zone: "Asia/Kolkata" },
  { city: "Ahmedabad", country: "India", zone: "Asia/Kolkata" },
  { city: "Pune", country: "India", zone: "Asia/Kolkata" },
  { city: "Karachi", country: "Pakistan", zone: "Asia/Karachi" },
  { city: "Lahore", country: "Pakistan", zone: "Asia/Karachi" },
  { city: "Islamabad", country: "Pakistan", zone: "Asia/Karachi" },
  { city: "Dhaka", country: "Bangladesh", zone: "Asia/Dhaka" },
  { city: "Chittagong", country: "Bangladesh", zone: "Asia/Dhaka" },
  { city: "Colombo", country: "Sri Lanka", zone: "Asia/Colombo" },
  { city: "Kathmandu", country: "Nepal", zone: "Asia/Kathmandu" },
  { city: "Thimphu", country: "Bhutan", zone: "Asia/Thimphu" },
  { city: "Male", country: "Maldives", zone: "Indian/Maldives" },
  { city: "Kabul", country: "Afghanistan", zone: "Asia/Kabul" },
  { city: "Tashkent", country: "Uzbekistan", zone: "Asia/Tashkent" },
  { city: "Almaty", country: "Kazakhstan", zone: "Asia/Almaty" },
  { city: "Astana", country: "Kazakhstan", zone: "Asia/Almaty" },
  { city: "Bishkek", country: "Kyrgyzstan", zone: "Asia/Bishkek" },
  { city: "Dushanbe", country: "Tajikistan", zone: "Asia/Dushanbe" },
  { city: "Ashgabat", country: "Turkmenistan", zone: "Asia/Ashgabat" },
  { city: "Ulaanbaatar", country: "Mongolia", zone: "Asia/Ulaanbaatar" },
  // Oceania
  { city: "Sydney", country: "Australia", zone: "Australia/Sydney", region: "NSW" },
  { city: "Melbourne", country: "Australia", zone: "Australia/Melbourne", region: "VIC" },
  { city: "Brisbane", country: "Australia", zone: "Australia/Brisbane", region: "QLD" },
  { city: "Perth", country: "Australia", zone: "Australia/Perth", region: "WA" },
  { city: "Adelaide", country: "Australia", zone: "Australia/Adelaide", region: "SA" },
  { city: "Hobart", country: "Australia", zone: "Australia/Hobart", region: "TAS" },
  { city: "Darwin", country: "Australia", zone: "Australia/Darwin", region: "NT" },
  { city: "Canberra", country: "Australia", zone: "Australia/Sydney", region: "ACT" },
  { city: "Auckland", country: "New Zealand", zone: "Pacific/Auckland" },
  { city: "Wellington", country: "New Zealand", zone: "Pacific/Auckland" },
  { city: "Christchurch", country: "New Zealand", zone: "Pacific/Auckland" },
  { city: "Suva", country: "Fiji", zone: "Pacific/Fiji" },
  { city: "Port Moresby", country: "Papua New Guinea", zone: "Pacific/Port_Moresby" },
  { city: "Honiara", country: "Solomon Islands", zone: "Pacific/Guadalcanal" },
  { city: "Apia", country: "Samoa", zone: "Pacific/Apia" },
  { city: "Nuku'alofa", country: "Tonga", zone: "Pacific/Tongatapu" },
  { city: "Funafuti", country: "Tuvalu", zone: "Pacific/Funafuti" },
  { city: "Tarawa", country: "Kiribati", zone: "Pacific/Tarawa" },
  { city: "Majuro", country: "Marshall Islands", zone: "Pacific/Majuro" },
  { city: "Palikir", country: "Micronesia", zone: "Pacific/Pohnpei" },
  { city: "Yaren", country: "Nauru", zone: "Pacific/Nauru" },
  { city: "Koror", country: "Palau", zone: "Pacific/Palau" },
  { city: "Noumea", country: "New Caledonia", zone: "Pacific/Noumea" },
  { city: "Papeete", country: "French Polynesia", zone: "Pacific/Tahiti" },
  { city: "Guam", country: "Guam", zone: "Pacific/Guam" },
  { city: "Saipan", country: "Northern Mariana Islands", zone: "Pacific/Saipan" },
  // Atlantic / Other
  { city: "Bermuda", country: "Bermuda", zone: "Atlantic/Bermuda" },
  { city: "Stanley", country: "Falkland Islands", zone: "Atlantic/Stanley" },
  { city: "Tórshavn", country: "Faroe Islands", zone: "Atlantic/Faroe" },
  { city: "Ponta Delgada", country: "Portugal (Azores)", zone: "Atlantic/Azores" },
  { city: "Funchal", country: "Portugal (Madeira)", zone: "Atlantic/Madeira" },
  { city: "Praia", country: "Cape Verde", zone: "Atlantic/Cape_Verde" },
  { city: "Georgetown", country: "South Georgia", zone: "Atlantic/South_Georgia" },
  { city: "Jamestown", country: "Saint Helena", zone: "Atlantic/St_Helena" },
  // Antarctica
  { city: "McMurdo Station", country: "Antarctica", zone: "Antarctica/McMurdo" },
  { city: "Casey Station", country: "Antarctica", zone: "Antarctica/Casey" },
  { city: "Davis Station", country: "Antarctica", zone: "Antarctica/Davis" },
  { city: "Mawson Station", country: "Antarctica", zone: "Antarctica/Mawson" },
  { city: "Palmer Station", country: "Antarctica", zone: "Antarctica/Palmer" },
  { city: "Rothera Station", country: "Antarctica", zone: "Antarctica/Rothera" },
  { city: "Troll Station", country: "Antarctica", zone: "Antarctica/Troll" },
  { city: "Vostok Station", country: "Antarctica", zone: "Antarctica/Vostok" },
];

// ---------------------------------------------------------------------------
// Zone lookup helpers
// ---------------------------------------------------------------------------

/** Find a city entry by case-insensitive partial name match. */
export function searchCities(query: string, limit = 20): CityEntry[] {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return [];
  const results: CityEntry[] = [];
  const seenZones = new Set<string>();
  // First pass: city-name prefix match (highest priority)
  for (const c of CITY_DATABASE) {
    if (c.city.toLowerCase().startsWith(q)) {
      if (!seenZones.has(c.zone + "|" + c.city)) {
        results.push(c);
        seenZones.add(c.zone + "|" + c.city);
      }
      if (results.length >= limit) return results;
    }
  }
  // Second pass: contains match
  for (const c of CITY_DATABASE) {
    if (results.includes(c)) continue;
    if (c.city.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)) {
      if (!seenZones.has(c.zone + "|" + c.city)) {
        results.push(c);
        seenZones.add(c.zone + "|" + c.city);
      }
      if (results.length >= limit) return results;
    }
  }
  return results;
}

/** Find the first city entry whose city name matches exactly (case-insensitive). */
export function findCityByName(name: string): CityEntry | null {
  const q = (name ?? "").trim().toLowerCase();
  if (!q) return null;
  return CITY_DATABASE.find((c) => c.city.toLowerCase() === q) ?? null;
}

/** Search IANA zones by case-insensitive substring. */
export function searchZones(query: string, limit = 50): string[] {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return [];
  const out: string[] = [];
  for (const z of IANA_ZONES) {
    if (z.toLowerCase().includes(q)) {
      out.push(z);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** Check if an IANA zone id is valid (in our bundled list). */
export function isValidZone(zone: string): boolean {
  return IANA_ZONES.includes(zone);
}

// ---------------------------------------------------------------------------
// Zone formatting — wall-clock parts + offset + abbreviation + DST flag
// ---------------------------------------------------------------------------

const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Format an offset (in signed minutes) as "±HH:MM". */
export function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${pad2(h)}:${pad2(m)}`;
}

/** Compute the wall-clock parts and offset for a given instant + zone. */
export function getZoneParts(instantMs: number, zone: string): ZoneParts {
  const date = new Date(instantMs);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    weekday: "long", hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  let hour = Number(map.hour);
  // Intl can return "24" for midnight in some environments — normalise
  if (hour === 24) hour = 0;
  const minute = Number(map.minute);
  const second = Number(map.second);
  const weekday = map.weekday;
  const weekdayShort = weekday ? weekday.slice(0, 3) : "";

  // Compute offset: the difference between the wall-clock-as-UTC and the actual instant
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMinutes = Math.round((wallAsUtc - instantMs) / 60000);

  // Long name + short name (abbreviation) for DST detection
  let longName = zone;
  let abbreviation = "";
  try {
    const longFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "long",
    }).formatToParts(date);
    for (const p of longFmt) {
      if (p.type === "timeZoneName") { longName = p.value; break; }
    }
  } catch {
    // fall through
  }
  try {
    const shortFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "short",
    }).formatToParts(date);
    for (const p of shortFmt) {
      if (p.type === "timeZoneName") { abbreviation = p.value; break; }
    }
  } catch {
    // fall through
  }

  // DST detection: long name contains "Daylight" or "Summer" (locale-dependent)
  const dstActive = /daylight|summer/i.test(longName) && !/standard|winter/i.test(longName);

  if (!abbreviation) {
    // Synthesise a fallback abbreviation from the offset
    abbreviation = `UTC${formatOffset(offsetMinutes)}`;
  }

  const offsetLabel = formatOffset(offsetMinutes);
  const iso = `${pad4(year)}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}${offsetLabel}`;

  return {
    year, month, day, hour, minute, second,
    weekday, weekdayShort,
    offsetMinutes, offsetLabel,
    abbreviation, longName, dstActive,
    zone,
    iso,
  };
}

function pad4(n: number): string {
  if (n < 0) return `-${pad4(-n)}`;
  return n < 10 ? `000${n}` : n < 100 ? `00${n}` : n < 1000 ? `0${n}` : String(n);
}

// ---------------------------------------------------------------------------
// Ambiguity detection — spring-forward gaps and fall-back overlaps
// ---------------------------------------------------------------------------

export interface AmbiguityResult {
  ambiguity: Ambiguity;
  /** The resolved instant (ms) — for overlap, this is the DST (earlier) interpretation. */
  instantMs: number;
  /** Offset (minutes) at the chosen instant. */
  offsetMinutes: number;
  /** Offset (minutes) at the alternate instant (for overlap: the standard-time one). */
  alternateOffsetMinutes: number | null;
  message: string | null;
}

/**
 * Resolve a wall-clock time in a given zone to a UTC instant, detecting
 * spring-forward gaps and fall-back overlaps.
 */
export function resolveLocalTime(
  zone: string,
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  second: number,
): AmbiguityResult {
  // Step 1: Pretend the wall-clock is UTC.
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute, second, 0);

  // Step 2: Find the offset at that instant.
  const probe = getZoneParts(asIfUtc, zone);
  const offset1 = probe.offsetMinutes;

  // Step 3: Apply offset to get the candidate UTC instant.
  const candidate = asIfUtc - offset1 * 60_000;

  // Step 4: Verify the wall-clock at the candidate matches the input.
  const check = getZoneParts(candidate, zone);
  const matches = check.year === year && check.month === month && check.day === day &&
    check.hour === hour && check.minute === minute && check.second === second;

  if (matches) {
    // Check if there's another instant one hour later that ALSO matches (overlap).
    const altCandidate = candidate + 3_600_000;
    const altCheck = getZoneParts(altCandidate, zone);
    const altMatches = altCheck.year === year && altCheck.month === month && altCheck.day === day &&
      altCheck.hour === hour && altCheck.minute === minute && altCheck.second === second;
    if (altMatches) {
      // Overlap: this wall-clock time exists twice. Use the DST (earlier) interpretation.
      return {
        ambiguity: "overlap",
        instantMs: candidate,
        offsetMinutes: offset1,
        alternateOffsetMinutes: altCheck.offsetMinutes,
        message: `This local time occurs twice during fall-back. Using the DST (earlier) interpretation (${probe.abbreviation}, UTC${formatOffset(offset1)}). The same wall-clock also occurs at UTC${formatOffset(altCheck.offsetMinutes)} standard time.`,
      };
    }
    return {
      ambiguity: "unique",
      instantMs: candidate,
      offsetMinutes: offset1,
      alternateOffsetMinutes: null,
      message: null,
    };
  }

  // The wall-clock doesn't exist — spring-forward gap.
  // Probe the offset on the other side of the gap to report both offsets.
  const before = getZoneParts(candidate - 3_600_000, zone);
  const after = getZoneParts(candidate + 3_600_000, zone);
  return {
    ambiguity: "gap",
    instantMs: candidate,
    offsetMinutes: after.offsetMinutes,
    alternateOffsetMinutes: before.offsetMinutes,
    message: `This local time does not exist — clocks jump from UTC${formatOffset(before.offsetMinutes)} to UTC${formatOffset(after.offsetMinutes)} (spring-forward). The tool resolves to ${check.iso} using the post-transition offset.`,
  };
}

// ---------------------------------------------------------------------------
// Conversion: source zone → many targets
// ---------------------------------------------------------------------------

export interface ConvertInput {
  sourceZone: string;
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  targetZones: string[];
}

/** Convert a wall-clock time in sourceZone → UTC instant → many target zones. */
export function convertTime(input: ConvertInput): ConvertOutcome {
  if (!input.sourceZone || !isValidZone(input.sourceZone)) {
    return { ok: false, error: `Unknown source zone: ${input.sourceZone}` };
  }
  for (const tz of input.targetZones) {
    if (!isValidZone(tz)) {
      return { ok: false, error: `Unknown target zone: ${tz}` };
    }
  }

  const resolved = resolveLocalTime(
    input.sourceZone,
    input.year, input.month, input.day,
    input.hour, input.minute, input.second,
  );

  const source = getZoneParts(resolved.instantMs, input.sourceZone);
  const targets = input.targetZones.map((tz) => getZoneParts(resolved.instantMs, tz));
  const differences = input.targetZones.map((tz) => {
    const tparts = getZoneParts(resolved.instantMs, tz);
    const diff = tparts.offsetMinutes - source.offsetMinutes;
    return {
      zone: tz,
      diffMinutes: diff,
      label: formatDifference(diff),
    };
  });

  return {
    ok: true,
    source,
    targets,
    differences,
    sourceInstantMs: resolved.instantMs,
    ambiguity: resolved.ambiguity,
    ambiguityMessage: resolved.message,
  };
}

/** Format a minute difference as "9h 30m ahead" / "3h behind" / "same time". */
export function formatDifference(diffMinutes: number): string {
  if (diffMinutes === 0) return "same time";
  const sign = diffMinutes > 0 ? "ahead" : "behind";
  const abs = Math.abs(diffMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  let phrase: string;
  if (h === 0) phrase = `${m}m`;
  else if (m === 0) phrase = `${h}h`;
  else phrase = `${h}h ${m}m`;
  return `${phrase} ${sign}`;
}

// ---------------------------------------------------------------------------
// "Now" snapshot
// ---------------------------------------------------------------------------

/** Get the current time in a given zone. */
export function nowInZone(zone: string): NowSnapshot {
  const instantMs = Date.now();
  const parts = getZoneParts(instantMs, zone);
  const date = new Date(instantMs);
  return {
    instantMs,
    iso: date.toISOString(),
    utc: date.toUTCString(),
    zone,
    parts,
  };
}

// ---------------------------------------------------------------------------
// History (localStorage, max 20)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:time-zone-converter:history";
const HISTORY_MAX = 20;

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable URL (fragment-encoded, never sent to server)
// ---------------------------------------------------------------------------

export function buildShareUrl(input: ConvertInput): string {
  const params = new URLSearchParams();
  params.set("src", input.sourceZone);
  params.set("dt", `${pad4(input.year)}-${pad2(input.month)}-${pad2(input.day)}T${pad2(input.hour)}:${pad2(input.minute)}:${pad2(input.second)}`);
  if (input.targetZones.length > 0) params.set("targets", input.targetZones.join(","));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { sourceZone: string; year: number; month: number; day: number; hour: number; minute: number; second: number; targetZones: string[] } | null {
  let clean = hash;
  if (clean.startsWith("#")) clean = clean.slice(1);
  if (clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const src = params.get("src");
  const dt = params.get("dt");
  const targetsStr = params.get("targets") ?? "";
  if (!src || !dt) return null;
  if (!isValidZone(src)) return null;
  // Parse ISO-like "YYYY-MM-DDTHH:MM:SS"
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(dt);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6]);
  const targetZones = targetsStr
    ? targetsStr.split(",").filter((z) => isValidZone(z))
    : [];
  return { sourceZone: src, year, month, day, hour, minute, second, targetZones };
}
