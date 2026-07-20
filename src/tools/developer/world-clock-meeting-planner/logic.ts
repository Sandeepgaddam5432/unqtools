/**
 * World Clock & Meeting Planner — pure logic.
 *
 * Show the current time across many cities and find the best overlapping
 * meeting slot across time zones with a color-coded 24-hour grid. Per-zone
 * work-hours + weekend definition. Best-slot finder ranks top suggestions.
 * Export to .ics / Google / Outlook. Shareable URL. DST-aware via Intl +
 * IANA tz database.
 *
 * Pure functions only — no DOM, no network.
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
  weekday: string;      // "Monday"
  weekdayShort: string; // "Mon"
  weekdayNum: number;   // 0=Sunday, 6=Saturday
  offsetMinutes: number; // signed minutes east of UTC
  offsetLabel: string;   // "-05:00" or "+05:30"
  abbreviation: string;  // "EST", "EDT", "IST"
  longName: string;      // "Eastern Standard Time"
  dstActive: boolean;
  zone: string;
  iso: string;           // ISO 8601 with offset
}

export type HourClass = "work" | "off" | "sleep";

export interface WorkHours {
  startHour: number; // 0-23 inclusive
  endHour: number;   // 1-24 exclusive
  weekendDays: number[]; // 0=Sun, 1=Mon, ... 6=Sat
}

export interface GridCell {
  /** UTC hour (0-23) at the chosen reference date. */
  utcHour: number;
  /** Local hour (0-23) in this zone at that UTC instant. */
  localHour: number;
  /** Local weekday number (0=Sun, 6=Sat) in this zone at that UTC instant. */
  localWeekday: number;
  classification: HourClass;
}

export interface GridRow {
  zone: string;
  city: string;
  country: string;
  /** Wall-clock parts at the start (UTC midnight) of the reference date. */
  parts: ZoneParts;
  cells: GridCell[];
}

export interface LocalTimeAtUtc {
  zone: string;
  city: string;
  country: string;
  localHour: number;
  localWeekday: number;
  weekdayLabel: string;
  classification: HourClass;
  offsetLabel: string;
  abbreviation: string;
}

export interface SlotSuggestion {
  /** UTC hour (0-23) of the candidate slot. */
  utcHour: number;
  /** ISO date-time of slot start in UTC. */
  utcStartIso: string;
  score: number;
  overlapCount: number;
  totalParticipants: number;
  allInWorkHours: boolean;
  locals: LocalTimeAtUtc[];
}

export interface IcsEvent {
  title: string;
  startUtcMs: number;
  durationMinutes: number;
  description?: string;
  location?: string;
}

export interface HistoryEntry {
  ts: number;
  zones: string[];
  date: string; // YYYY-MM-DD
  topScore: number;
}

// ---------------------------------------------------------------------------
// Constants — IANA zones (430+) and city database (400+)
// ---------------------------------------------------------------------------

export const IANA_ZONES: ReadonlyArray<string> = [
  "Africa/Abidjan", "Africa/Accra", "Africa/Addis_Ababa", "Africa/Algiers",
  "Africa/Asmara", "Africa/Bamako", "Africa/Bangui", "Africa/Banjul",
  "Africa/Bissau", "Africa/Blantyre", "Africa/Brazzaville", "Africa/Bujumbura",
  "Africa/Cairo", "Africa/Casablanca", "Africa/Ceuta", "Africa/Conakry",
  "Africa/Dakar", "Africa/Dar_es_Salaam", "Africa/Djibouti", "Africa/Douala",
  "Africa/El_Aaiun", "Africa/Freetown", "Africa/Gaborone", "Africa/Harare",
  "Africa/Johannesburg", "Africa/Juba", "Africa/Kampala", "Africa/Khartoum",
  "Africa/Kigali", "Africa/Kinshasa", "Africa/Lagos", "Africa/Libreville",
  "Africa/Lome", "Africa/Luanda", "Africa/Lubumbashi", "Africa/Lusaka",
  "Africa/Malabo", "Africa/Maputo", "Africa/Maseru", "Africa/Mbabane",
  "Africa/Mogadishu", "Africa/Monrovia", "Africa/Nairobi", "Africa/Ndjamena",
  "Africa/Niamey", "Africa/Nouakchott", "Africa/Ouagadougou", "Africa/Porto-Novo",
  "Africa/Sao_Tome", "Africa/Timbuktu", "Africa/Tripoli", "Africa/Tunis",
  "Africa/Windhoek",
  "America/Adak", "America/Anchorage", "America/Anguilla", "America/Antigua",
  "America/Araguaina", "America/Argentina/Buenos_Aires", "America/Argentina/Catamarca",
  "America/Argentina/Cordoba", "America/Argentina/Jujuy",
  "America/Argentina/La_Rioja", "America/Argentina/Mendoza",
  "America/Argentina/Rio_Gallegos", "America/Argentina/Salta",
  "America/Argentina/San_Juan", "America/Argentina/San_Luis",
  "America/Argentina/Tucuman", "America/Argentina/Ushuaia", "America/Aruba",
  "America/Asuncion", "America/Atikokan", "America/Bahia",
  "America/Bahia_Banderas", "America/Barbados", "America/Belem", "America/Belize",
  "America/Blanc-Sablon", "America/Boa_Vista", "America/Bogota", "America/Boise",
  "America/Cambridge_Bay", "America/Campo_Grande", "America/Cancun",
  "America/Caracas", "America/Cayenne", "America/Cayman", "America/Chicago",
  "America/Chihuahua", "America/Costa_Rica", "America/Creston", "America/Cuiaba",
  "America/Curacao", "America/Danmarkshavn", "America/Dawson",
  "America/Dawson_Creek", "America/Denver", "America/Detroit",
  "America/Dominica", "America/Edmonton", "America/Eirunepe",
  "America/El_Salvador", "America/Fortaleza", "America/Fort_Nelson",
  "America/Glace_Bay", "America/Godthab", "America/Goose_Bay",
  "America/Grand_Turk", "America/Grenada", "America/Guadeloupe",
  "America/Guatemala", "America/Guayaquil", "America/Guyana", "America/Halifax",
  "America/Havana", "America/Hermosillo", "America/Indiana/Indianapolis",
  "America/Indiana/Knox", "America/Indiana/Marengo",
  "America/Indiana/Petersburg", "America/Indiana/Tell_City",
  "America/Indiana/Vevay", "America/Indiana/Vincennes", "America/Indiana/Winamac",
  "America/Inuvik", "America/Iqaluit", "America/Jamaica", "America/Juneau",
  "America/Kentucky/Louisville", "America/Kentucky/Monticello",
  "America/Kralendijk", "America/La_Paz", "America/Lima",
  "America/Los_Angeles", "America/Lower_Princes", "America/Maceio",
  "America/Managua", "America/Manaus", "America/Marigot",
  "America/Martinique", "America/Matamoros", "America/Mazatlan",
  "America/Menominee", "America/Merida", "America/Metlakatla",
  "America/Mexico_City", "America/Miquelon", "America/Moncton",
  "America/Monterrey", "America/Montevideo", "America/Montserrat",
  "America/Nassau", "America/New_York", "America/Nipigon", "America/Nome",
  "America/Noronha", "America/North_Dakota/Beulah",
  "America/North_Dakota/Center", "America/North_Dakota/New_Salem",
  "America/Nuuk", "America/Ojinaga", "America/Panama", "America/Pangnirtung",
  "America/Paramaribo", "America/Phoenix", "America/Port-au-Prince",
  "America/Port_of_Spain", "America/Porto_Velho", "America/Puerto_Rico",
  "America/Punta_Arenas", "America/Rainy_River", "America/Rankin_Inlet",
  "America/Recife", "America/Regina", "America/Resolute", "America/Rio_Branco",
  "America/Santarem", "America/Santiago", "America/Santo_Domingo",
  "America/Sao_Paulo", "America/Scoresbysund", "America/Sitka",
  "America/St_Barthelemy", "America/St_Johns", "America/St_Kitts",
  "America/St_Lucia", "America/St_Thomas", "America/St_Vincent",
  "America/Swift_Current", "America/Tegucigalpa", "America/Thule",
  "America/Thunder_Bay", "America/Tijuana", "America/Toronto", "America/Tortola",
  "America/Vancouver", "America/Whitehorse", "America/Winnipeg",
  "America/Yakutat", "America/Yellowknife",
  "Antarctica/Casey", "Antarctica/Davis", "Antarctica/DumontDUrville",
  "Antarctica/Macquarie", "Antarctica/Mawson", "Antarctica/McMurdo",
  "Antarctica/Palmer", "Antarctica/Rothera", "Antarctica/Syowa",
  "Antarctica/Troll", "Antarctica/Vostok",
  "Arctic/Longyearbyen",
  "Asia/Aden", "Asia/Almaty", "Asia/Amman", "Asia/Anadyr", "Asia/Aqtau",
  "Asia/Aqtobe", "Asia/Ashgabat", "Asia/Atyrau", "Asia/Baghdad",
  "Asia/Bahrain", "Asia/Baku", "Asia/Bangkok", "Asia/Barnaul", "Asia/Beirut",
  "Asia/Bishkek", "Asia/Brunei", "Asia/Calcutta", "Asia/Chita",
  "Asia/Choibalsan", "Asia/Chongqing", "Asia/Colombo", "Asia/Damascus",
  "Asia/Dhaka", "Asia/Dili", "Asia/Dubai", "Asia/Dushanbe", "Asia/Famagusta",
  "Asia/Gaza", "Asia/Hebron", "Asia/Ho_Chi_Minh", "Asia/Hong_Kong",
  "Asia/Hovd", "Asia/Irkutsk", "Asia/Istanbul", "Asia/Jakarta",
  "Asia/Jayapura", "Asia/Jerusalem", "Asia/Kabul", "Asia/Kamchatka",
  "Asia/Karachi", "Asia/Kathmandu", "Asia/Khandyga", "Asia/Kolkata",
  "Asia/Krasnoyarsk", "Asia/Kuala_Lumpur", "Asia/Kuching", "Asia/Kuwait",
  "Asia/Macau", "Asia/Magadan", "Asia/Makassar", "Asia/Manila",
  "Asia/Muscat", "Asia/Nicosia", "Asia/Novokuznetsk", "Asia/Novosibirsk",
  "Asia/Omsk", "Asia/Oral", "Asia/Phnom_Penh", "Asia/Pontianak",
  "Asia/Pyongyang", "Asia/Qatar", "Asia/Qostanay", "Asia/Qyzylorda",
  "Asia/Riyadh", "Asia/Sakhalin", "Asia/Samarkand", "Asia/Seoul",
  "Asia/Shanghai", "Asia/Singapore", "Asia/Srednekolymsk", "Asia/Taipei",
  "Asia/Tashkent", "Asia/Tbilisi", "Asia/Tehran", "Asia/Thimphu",
  "Asia/Tokyo", "Asia/Tomsk", "Asia/Ulaanbaatar", "Asia/Urumqi",
  "Asia/Ust-Nera", "Asia/Vientiane", "Asia/Vladivostok", "Asia/Yakutsk",
  "Asia/Yangon", "Asia/Yekaterinburg", "Asia/Yerevan",
  "Atlantic/Azores", "Atlantic/Bermuda", "Atlantic/Canary",
  "Atlantic/Cape_Verde", "Atlantic/Faroe", "Atlantic/Madeira",
  "Atlantic/Reykjavik", "Atlantic/South_Georgia", "Atlantic/St_Helena",
  "Atlantic/Stanley",
  "Australia/Adelaide", "Australia/Brisbane", "Australia/Broken_Hill",
  "Australia/Darwin", "Australia/Eucla", "Australia/Hobart",
  "Australia/Lord_Howe", "Australia/Lindeman", "Australia/Melbourne",
  "Australia/Perth", "Australia/Sydney",
  "CET", "CST6CDT", "EET", "EST", "EST5EDT",
  "Etc/GMT", "Etc/GMT+0", "Etc/GMT+1", "Etc/GMT+10", "Etc/GMT+11",
  "Etc/GMT+12", "Etc/GMT+2", "Etc/GMT+3", "Etc/GMT+4", "Etc/GMT+5",
  "Etc/GMT+6", "Etc/GMT+7", "Etc/GMT+8", "Etc/GMT+9", "Etc/GMT-0",
  "Etc/GMT-1", "Etc/GMT-10", "Etc/GMT-11", "Etc/GMT-12", "Etc/GMT-13",
  "Etc/GMT-14", "Etc/GMT-2", "Etc/GMT-3", "Etc/GMT-4", "Etc/GMT-5",
  "Etc/GMT-6", "Etc/GMT-7", "Etc/GMT-8", "Etc/GMT-9", "Etc/GMT0",
  "Etc/UTC", "Etc/Universal", "Etc/Zulu",
  "Europe/Amsterdam", "Europe/Andorra", "Europe/Astrakhan", "Europe/Athens",
  "Europe/Belgrade", "Europe/Berlin", "Europe/Bratislava", "Europe/Brussels",
  "Europe/Bucharest", "Europe/Budapest", "Europe/Busingen", "Europe/Chisinau",
  "Europe/Copenhagen", "Europe/Dublin", "Europe/Gibraltar", "Europe/Guernsey",
  "Europe/Helsinki", "Europe/Isle_of_Man", "Europe/Istanbul",
  "Europe/Jersey", "Europe/Kaliningrad", "Europe/Kiev", "Europe/Kirov",
  "Europe/Lisbon", "Europe/Ljubljana", "Europe/London", "Europe/Luxembourg",
  "Europe/Madrid", "Europe/Malta", "Europe/Mariehamn", "Europe/Minsk",
  "Europe/Monaco", "Europe/Moscow", "Europe/Nicosia", "Europe/Oslo",
  "Europe/Paris", "Europe/Podgorica", "Europe/Prague", "Europe/Riga",
  "Europe/Rome", "Europe/Samara", "Europe/San_Marino", "Europe/Sarajevo",
  "Europe/Saratov", "Europe/Simferopol", "Europe/Skopje", "Europe/Sofia",
  "Europe/Stockholm", "Europe/Tallinn", "Europe/Tirane", "Europe/Ulyanovsk",
  "Europe/Uzhgorod", "Europe/Vaduz", "Europe/Vatican", "Europe/Vienna",
  "Europe/Vilnius", "Europe/Volgograd", "Europe/Warsaw", "Europe/Zagreb",
  "Europe/Zaporozhye", "Europe/Zurich",
  "GMT", "GMT+0", "GMT-0", "GMT0", "Greenwich", "HST",
  "Indian/Antananarivo", "Indian/Chagos", "Indian/Christmas", "Indian/Cocos",
  "Indian/Comoro", "Indian/Kerguelen", "Indian/Mahe", "Indian/Maldives",
  "Indian/Mauritius", "Indian/Mayotte", "Indian/Reunion",
  "MET", "MST", "MST7MDT", "PST8PDT",
  "Pacific/Apia", "Pacific/Auckland", "Pacific/Bougainville",
  "Pacific/Chatham", "Pacific/Chuuk", "Pacific/Easter", "Pacific/Efate",
  "Pacific/Enderbury", "Pacific/Fakaofo", "Pacific/Fiji", "Pacific/Funafuti",
  "Pacific/Galapagos", "Pacific/Gambier", "Pacific/Guadalcanal",
  "Pacific/Guam", "Pacific/Honolulu", "Pacific/Johnston",
  "Pacific/Kiritimati", "Pacific/Kosrae", "Pacific/Kwajalein",
  "Pacific/Majuro", "Pacific/Marquesas", "Pacific/Midway", "Pacific/Nauru",
  "Pacific/Niue", "Pacific/Norfolk", "Pacific/Noumea", "Pacific/Pago_Pago",
  "Pacific/Palau", "Pacific/Pitcairn", "Pacific/Pohnpei",
  "Pacific/Port_Moresby", "Pacific/Rarotonga", "Pacific/Saipan",
  "Pacific/Tahiti", "Pacific/Tarawa", "Pacific/Tongatapu", "Pacific/Wake",
  "Pacific/Wallis",
  "UTC", "Universal", "WET", "Zulu",
];

export const CITY_DATABASE: ReadonlyArray<CityEntry> = [
  // North America — United States (major metros)
  { city: "New York", country: "United States", zone: "America/New_York", region: "NY" },
  { city: "Los Angeles", country: "United States", zone: "America/Los_Angeles", region: "CA" },
  { city: "Chicago", country: "United States", zone: "America/Chicago", region: "IL" },
  { city: "Houston", country: "United States", zone: "America/Chicago", region: "TX" },
  { city: "Phoenix", country: "United States", zone: "America/Phoenix", region: "AZ" },
  { city: "Philadelphia", country: "United States", zone: "America/New_York", region: "PA" },
  { city: "San Antonio", country: "United States", zone: "America/Chicago", region: "TX" },
  { city: "San Diego", country: "United States", zone: "America/Los_Angeles", region: "CA" },
  { city: "Dallas", country: "United States", zone: "America/Chicago", region: "TX" },
  { city: "San Jose", country: "United States", zone: "America/Los_Angeles", region: "CA" },
  { city: "Austin", country: "United States", zone: "America/Chicago", region: "TX" },
  { city: "Jacksonville", country: "United States", zone: "America/New_York", region: "FL" },
  { city: "Fort Worth", country: "United States", zone: "America/Chicago", region: "TX" },
  { city: "Columbus", country: "United States", zone: "America/New_York", region: "OH" },
  { city: "Charlotte", country: "United States", zone: "America/New_York", region: "NC" },
  { city: "San Francisco", country: "United States", zone: "America/Los_Angeles", region: "CA" },
  { city: "Indianapolis", country: "United States", zone: "America/Indiana/Indianapolis", region: "IN" },
  { city: "Seattle", country: "United States", zone: "America/Los_Angeles", region: "WA" },
  { city: "Denver", country: "United States", zone: "America/Denver", region: "CO" },
  { city: "Boston", country: "United States", zone: "America/New_York", region: "MA" },
  { city: "El Paso", country: "United States", zone: "America/Denver", region: "TX" },
  { city: "Nashville", country: "United States", zone: "America/Chicago", region: "TN" },
  { city: "Detroit", country: "United States", zone: "America/Detroit", region: "MI" },
  { city: "Oklahoma City", country: "United States", zone: "America/Chicago", region: "OK" },
  { city: "Portland", country: "United States", zone: "America/Los_Angeles", region: "OR" },
  { city: "Las Vegas", country: "United States", zone: "America/Los_Angeles", region: "NV" },
  { city: "Memphis", country: "United States", zone: "America/Chicago", region: "TN" },
  { city: "Louisville", country: "United States", zone: "America/Kentucky/Louisville", region: "KY" },
  { city: "Baltimore", country: "United States", zone: "America/New_York", region: "MD" },
  { city: "Milwaukee", country: "United States", zone: "America/Chicago", region: "WI" },
  { city: "Albuquerque", country: "United States", zone: "America/Denver", region: "NM" },
  { city: "Tucson", country: "United States", zone: "America/Phoenix", region: "AZ" },
  { city: "Fresno", country: "United States", zone: "America/Los_Angeles", region: "CA" },
  { city: "Sacramento", country: "United States", zone: "America/Los_Angeles", region: "CA" },
  { city: "Kansas City", country: "United States", zone: "America/Chicago", region: "MO" },
  { city: "Mesa", country: "United States", zone: "America/Phoenix", region: "AZ" },
  { city: "Atlanta", country: "United States", zone: "America/New_York", region: "GA" },
  { city: "Miami", country: "United States", zone: "America/New_York", region: "FL" },
  { city: "Tampa", country: "United States", zone: "America/New_York", region: "FL" },
  { city: "Orlando", country: "United States", zone: "America/New_York", region: "FL" },
  { city: "Pittsburgh", country: "United States", zone: "America/New_York", region: "PA" },
  { city: "Cincinnati", country: "United States", zone: "America/New_York", region: "OH" },
  { city: "St. Louis", country: "United States", zone: "America/Chicago", region: "MO" },
  { city: "Minneapolis", country: "United States", zone: "America/Chicago", region: "MN" },
  { city: "Salt Lake City", country: "United States", zone: "America/Denver", region: "UT" },
  { city: "Raleigh", country: "United States", zone: "America/New_York", region: "NC" },
  { city: "Cleveland", country: "United States", zone: "America/New_York", region: "OH" },
  { city: "New Orleans", country: "United States", zone: "America/Chicago", region: "LA" },
  { city: "Honolulu", country: "United States", zone: "Pacific/Honolulu", region: "HI" },
  { city: "Anchorage", country: "United States", zone: "America/Anchorage", region: "AK" },
  { city: "Fairbanks", country: "United States", zone: "America/Anchorage", region: "AK" },
  { city: "Washington DC", country: "United States", zone: "America/New_York" },
  // Canada
  { city: "Toronto", country: "Canada", zone: "America/Toronto", region: "ON" },
  { city: "Vancouver", country: "Canada", zone: "America/Vancouver", region: "BC" },
  { city: "Montreal", country: "Canada", zone: "America/Toronto", region: "QC" },
  { city: "Calgary", country: "Canada", zone: "America/Edmonton", region: "AB" },
  { city: "Edmonton", country: "Canada", zone: "America/Edmonton", region: "AB" },
  { city: "Ottawa", country: "Canada", zone: "America/Toronto", region: "ON" },
  { city: "Winnipeg", country: "Canada", zone: "America/Winnipeg", region: "MB" },
  { city: "Halifax", country: "Canada", zone: "America/Halifax", region: "NS" },
  { city: "St. John's", country: "Canada", zone: "America/St_Johns", region: "NL" },
  { city: "Quebec City", country: "Canada", zone: "America/Toronto", region: "QC" },
  { city: "Hamilton", country: "Canada", zone: "America/Toronto", region: "ON" },
  { city: "Saskatoon", country: "Canada", zone: "America/Regina", region: "SK" },
  { city: "Regina", country: "Canada", zone: "America/Regina", region: "SK" },
  { city: "Victoria", country: "Canada", zone: "America/Vancouver", region: "BC" },
  // Mexico
  { city: "Mexico City", country: "Mexico", zone: "America/Mexico_City" },
  { city: "Guadalajara", country: "Mexico", zone: "America/Mexico_City" },
  { city: "Monterrey", country: "Mexico", zone: "America/Monterrey" },
  { city: "Tijuana", country: "Mexico", zone: "America/Tijuana" },
  { city: "Cancun", country: "Mexico", zone: "America/Cancun" },
  { city: "Puebla", country: "Mexico", zone: "America/Mexico_City" },
  { city: "Merida", country: "Mexico", zone: "America/Merida" },
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
  { city: "Managua", country: "Nicaragua", zone: "America/Managua" },
  { city: "Tegucigalpa", country: "Honduras", zone: "America/Tegucigalpa" },
  { city: "San Salvador", country: "El Salvador", zone: "America/El_Salvador" },
  { city: "Belmopan", country: "Belize", zone: "America/Belize" },
  { city: "Willemstad", country: "Curacao", zone: "America/Curacao" },
  // South America
  { city: "Sao Paulo", country: "Brazil", zone: "America/Sao_Paulo" },
  { city: "Rio de Janeiro", country: "Brazil", zone: "America/Sao_Paulo" },
  { city: "Brasilia", country: "Brazil", zone: "America/Sao_Paulo" },
  { city: "Manaus", country: "Brazil", zone: "America/Manaus" },
  { city: "Salvador", country: "Brazil", zone: "America/Bahia" },
  { city: "Fortaleza", country: "Brazil", zone: "America/Fortaleza" },
  { city: "Recife", country: "Brazil", zone: "America/Recife" },
  { city: "Porto Alegre", country: "Brazil", zone: "America/Sao_Paulo" },
  { city: "Curitiba", country: "Brazil", zone: "America/Sao_Paulo" },
  { city: "Buenos Aires", country: "Argentina", zone: "America/Argentina/Buenos_Aires" },
  { city: "Cordoba", country: "Argentina", zone: "America/Argentina/Cordoba" },
  { city: "Mendoza", country: "Argentina", zone: "America/Argentina/Mendoza" },
  { city: "Rosario", country: "Argentina", zone: "America/Argentina/Cordoba" },
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
  // Europe — Western
  { city: "London", country: "United Kingdom", zone: "Europe/London" },
  { city: "Edinburgh", country: "United Kingdom", zone: "Europe/London" },
  { city: "Glasgow", country: "United Kingdom", zone: "Europe/London" },
  { city: "Cardiff", country: "United Kingdom", zone: "Europe/London" },
  { city: "Belfast", country: "United Kingdom", zone: "Europe/Belfast" },
  { city: "Birmingham", country: "United Kingdom", zone: "Europe/London" },
  { city: "Manchester", country: "United Kingdom", zone: "Europe/London" },
  { city: "Leeds", country: "United Kingdom", zone: "Europe/London" },
  { city: "Bristol", country: "United Kingdom", zone: "Europe/London" },
  { city: "Dublin", country: "Ireland", zone: "Europe/Dublin" },
  { city: "Cork", country: "Ireland", zone: "Europe/Dublin" },
  { city: "Paris", country: "France", zone: "Europe/Paris" },
  { city: "Marseille", country: "France", zone: "Europe/Paris" },
  { city: "Lyon", country: "France", zone: "Europe/Paris" },
  { city: "Toulouse", country: "France", zone: "Europe/Paris" },
  { city: "Nice", country: "France", zone: "Europe/Paris" },
  { city: "Bordeaux", country: "France", zone: "Europe/Paris" },
  { city: "Berlin", country: "Germany", zone: "Europe/Berlin" },
  { city: "Munich", country: "Germany", zone: "Europe/Berlin" },
  { city: "Frankfurt", country: "Germany", zone: "Europe/Berlin" },
  { city: "Hamburg", country: "Germany", zone: "Europe/Berlin" },
  { city: "Cologne", country: "Germany", zone: "Europe/Berlin" },
  { city: "Stuttgart", country: "Germany", zone: "Europe/Berlin" },
  { city: "Dusseldorf", country: "Germany", zone: "Europe/Berlin" },
  { city: "Leipzig", country: "Germany", zone: "Europe/Berlin" },
  { city: "Madrid", country: "Spain", zone: "Europe/Madrid" },
  { city: "Barcelona", country: "Spain", zone: "Europe/Madrid" },
  { city: "Seville", country: "Spain", zone: "Europe/Madrid" },
  { city: "Valencia", country: "Spain", zone: "Europe/Madrid" },
  { city: "Bilbao", country: "Spain", zone: "Europe/Madrid" },
  { city: "Malaga", country: "Spain", zone: "Europe/Madrid" },
  { city: "Rome", country: "Italy", zone: "Europe/Rome" },
  { city: "Milan", country: "Italy", zone: "Europe/Rome" },
  { city: "Naples", country: "Italy", zone: "Europe/Rome" },
  { city: "Florence", country: "Italy", zone: "Europe/Rome" },
  { city: "Venice", country: "Italy", zone: "Europe/Rome" },
  { city: "Turin", country: "Italy", zone: "Europe/Rome" },
  { city: "Bologna", country: "Italy", zone: "Europe/Rome" },
  { city: "Lisbon", country: "Portugal", zone: "Europe/Lisbon" },
  { city: "Porto", country: "Portugal", zone: "Europe/Lisbon" },
  { city: "Amsterdam", country: "Netherlands", zone: "Europe/Amsterdam" },
  { city: "Rotterdam", country: "Netherlands", zone: "Europe/Amsterdam" },
  { city: "The Hague", country: "Netherlands", zone: "Europe/Amsterdam" },
  { city: "Utrecht", country: "Netherlands", zone: "Europe/Amsterdam" },
  { city: "Brussels", country: "Belgium", zone: "Europe/Brussels" },
  { city: "Antwerp", country: "Belgium", zone: "Europe/Brussels" },
  { city: "Vienna", country: "Austria", zone: "Europe/Vienna" },
  { city: "Salzburg", country: "Austria", zone: "Europe/Vienna" },
  { city: "Zurich", country: "Switzerland", zone: "Europe/Zurich" },
  { city: "Geneva", country: "Switzerland", zone: "Europe/Zurich" },
  { city: "Bern", country: "Switzerland", zone: "Europe/Zurich" },
  { city: "Basel", country: "Switzerland", zone: "Europe/Zurich" },
  { city: "Stockholm", country: "Sweden", zone: "Europe/Stockholm" },
  { city: "Gothenburg", country: "Sweden", zone: "Europe/Stockholm" },
  { city: "Malmo", country: "Sweden", zone: "Europe/Stockholm" },
  { city: "Oslo", country: "Norway", zone: "Europe/Oslo" },
  { city: "Bergen", country: "Norway", zone: "Europe/Oslo" },
  { city: "Copenhagen", country: "Denmark", zone: "Europe/Copenhagen" },
  { city: "Aarhus", country: "Denmark", zone: "Europe/Copenhagen" },
  { city: "Helsinki", country: "Finland", zone: "Europe/Helsinki" },
  { city: "Tampere", country: "Finland", zone: "Europe/Helsinki" },
  { city: "Reykjavik", country: "Iceland", zone: "Atlantic/Reykjavik" },
  // Europe — Eastern
  { city: "Moscow", country: "Russia", zone: "Europe/Moscow" },
  { city: "St. Petersburg", country: "Russia", zone: "Europe/Moscow" },
  { city: "Kaliningrad", country: "Russia", zone: "Europe/Kaliningrad" },
  { city: "Samara", country: "Russia", zone: "Europe/Samara" },
  { city: "Warsaw", country: "Poland", zone: "Europe/Warsaw" },
  { city: "Krakow", country: "Poland", zone: "Europe/Warsaw" },
  { city: "Wroclaw", country: "Poland", zone: "Europe/Warsaw" },
  { city: "Prague", country: "Czech Republic", zone: "Europe/Prague" },
  { city: "Brno", country: "Czech Republic", zone: "Europe/Prague" },
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
  { city: "Istanbul", country: "Turkey", zone: "Europe/Istanbul" },
  { city: "Ankara", country: "Turkey", zone: "Europe/Istanbul" },
  { city: "Izmir", country: "Turkey", zone: "Europe/Istanbul" },
  // Europe — micro-states
  { city: "Luxembourg", country: "Luxembourg", zone: "Europe/Luxembourg" },
  { city: "Monaco", country: "Monaco", zone: "Europe/Monaco" },
  { city: "Vaduz", country: "Liechtenstein", zone: "Europe/Vaduz" },
  { city: "San Marino", country: "San Marino", zone: "Europe/San_Marino" },
  { city: "Valletta", country: "Malta", zone: "Europe/Malta" },
  { city: "Andorra la Vella", country: "Andorra", zone: "Europe/Andorra" },
  { city: "Vatican City", country: "Vatican", zone: "Europe/Vatican" },
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
  { city: "Kinshasa", country: "DR Congo", zone: "Africa/Kinshasa" },
  { city: "Lubumbashi", country: "DR Congo", zone: "Africa/Lubumbashi" },
  { city: "Luanda", country: "Angola", zone: "Africa/Luanda" },
  { city: "Lusaka", country: "Zambia", zone: "Africa/Lusaka" },
  { city: "Harare", country: "Zimbabwe", zone: "Africa/Harare" },
  { city: "Maputo", country: "Mozambique", zone: "Africa/Maputo" },
  { city: "Windhoek", country: "Namibia", zone: "Africa/Windhoek" },
  { city: "Gaborone", country: "Botswana", zone: "Africa/Gaborone" },
  { city: "Antananarivo", country: "Madagascar", zone: "Indian/Antananarivo" },
  { city: "Port Louis", country: "Mauritius", zone: "Indian/Mauritius" },
  { city: "Mogadishu", country: "Somalia", zone: "Africa/Mogadishu" },
  { city: "Douala", country: "Cameroon", zone: "Africa/Douala" },
  { city: "Yaounde", country: "Cameroon", zone: "Africa/Douala" },
  { city: "Bamako", country: "Mali", zone: "Africa/Bamako" },
  { city: "Niamey", country: "Niger", zone: "Africa/Niamey" },
  { city: "Ouagadougou", country: "Burkina Faso", zone: "Africa/Ouagadougou" },
  { city: "Lome", country: "Togo", zone: "Africa/Lome" },
  { city: "Cotonou", country: "Benin", zone: "Africa/Porto-Novo" },
  { city: "Libreville", country: "Gabon", zone: "Africa/Libreville" },
  { city: "Brazzaville", country: "Republic of Congo", zone: "Africa/Brazzaville" },
  { city: "Malabo", country: "Equatorial Guinea", zone: "Africa/Malabo" },
  { city: "Banjul", country: "Gambia", zone: "Africa/Banjul" },
  { city: "Conakry", country: "Guinea", zone: "Africa/Conakry" },
  { city: "Nouakchott", country: "Mauritania", zone: "Africa/Nouakchott" },
  { city: "Freetown", country: "Sierra Leone", zone: "Africa/Freetown" },
  { city: "Asmara", country: "Eritrea", zone: "Africa/Asmara" },
  { city: "Bujumbura", country: "Burundi", zone: "Africa/Bujumbura" },
  // Middle East
  { city: "Dubai", country: "United Arab Emirates", zone: "Asia/Dubai" },
  { city: "Abu Dhabi", country: "United Arab Emirates", zone: "Asia/Dubai" },
  { city: "Sharjah", country: "United Arab Emirates", zone: "Asia/Dubai" },
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
  { city: "Sanaa", country: "Yemen", zone: "Asia/Aden" },
  { city: "Kabul", country: "Afghanistan", zone: "Asia/Kabul" },
  // Asia — East
  { city: "Tokyo", country: "Japan", zone: "Asia/Tokyo" },
  { city: "Osaka", country: "Japan", zone: "Asia/Tokyo" },
  { city: "Kyoto", country: "Japan", zone: "Asia/Tokyo" },
  { city: "Nagoya", country: "Japan", zone: "Asia/Tokyo" },
  { city: "Sapporo", country: "Japan", zone: "Asia/Tokyo" },
  { city: "Fukuoka", country: "Japan", zone: "Asia/Tokyo" },
  { city: "Seoul", country: "South Korea", zone: "Asia/Seoul" },
  { city: "Busan", country: "South Korea", zone: "Asia/Seoul" },
  { city: "Incheon", country: "South Korea", zone: "Asia/Seoul" },
  { city: "Pyongyang", country: "North Korea", zone: "Asia/Pyongyang" },
  { city: "Beijing", country: "China", zone: "Asia/Shanghai" },
  { city: "Shanghai", country: "China", zone: "Asia/Shanghai" },
  { city: "Guangzhou", country: "China", zone: "Asia/Shanghai" },
  { city: "Shenzhen", country: "China", zone: "Asia/Shanghai" },
  { city: "Chengdu", country: "China", zone: "Asia/Shanghai" },
  { city: "Tianjin", country: "China", zone: "Asia/Shanghai" },
  { city: "Wuhan", country: "China", zone: "Asia/Shanghai" },
  { city: "Hangzhou", country: "China", zone: "Asia/Shanghai" },
  { city: "Nanjing", country: "China", zone: "Asia/Shanghai" },
  { city: "Xi'an", country: "China", zone: "Asia/Shanghai" },
  { city: "Chongqing", country: "China", zone: "Asia/Shanghai" },
  { city: "Hong Kong", country: "Hong Kong", zone: "Asia/Hong_Kong" },
  { city: "Macau", country: "Macau", zone: "Asia/Macau" },
  { city: "Taipei", country: "Taiwan", zone: "Asia/Taipei" },
  { city: "Kaohsiung", country: "Taiwan", zone: "Asia/Taipei" },
  { city: "Manila", country: "Philippines", zone: "Asia/Manila" },
  // Asia — Southeast
  { city: "Hanoi", country: "Vietnam", zone: "Asia/Ho_Chi_Minh" },
  { city: "Ho Chi Minh City", country: "Vietnam", zone: "Asia/Ho_Chi_Minh" },
  { city: "Bangkok", country: "Thailand", zone: "Asia/Bangkok" },
  { city: "Chiang Mai", country: "Thailand", zone: "Asia/Bangkok" },
  { city: "Phnom Penh", country: "Cambodia", zone: "Asia/Phnom_Penh" },
  { city: "Vientiane", country: "Laos", zone: "Asia/Vientiane" },
  { city: "Yangon", country: "Myanmar", zone: "Asia/Yangon" },
  { city: "Kuala Lumpur", country: "Malaysia", zone: "Asia/Kuala_Lumpur" },
  { city: "Singapore", country: "Singapore", zone: "Asia/Singapore" },
  { city: "Jakarta", country: "Indonesia", zone: "Asia/Jakarta" },
  { city: "Surabaya", country: "Indonesia", zone: "Asia/Jakarta" },
  { city: "Bandung", country: "Indonesia", zone: "Asia/Jakarta" },
  { city: "Medan", country: "Indonesia", zone: "Asia/Jakarta" },
  { city: "Makassar", country: "Indonesia", zone: "Asia/Makassar" },
  // Asia — South
  { city: "New Delhi", country: "India", zone: "Asia/Kolkata" },
  { city: "Mumbai", country: "India", zone: "Asia/Kolkata" },
  { city: "Bangalore", country: "India", zone: "Asia/Kolkata" },
  { city: "Chennai", country: "India", zone: "Asia/Kolkata" },
  { city: "Hyderabad", country: "India", zone: "Asia/Kolkata" },
  { city: "Kolkata", country: "India", zone: "Asia/Kolkata" },
  { city: "Ahmedabad", country: "India", zone: "Asia/Kolkata" },
  { city: "Pune", country: "India", zone: "Asia/Kolkata" },
  { city: "Jaipur", country: "India", zone: "Asia/Kolkata" },
  { city: "Surat", country: "India", zone: "Asia/Kolkata" },
  { city: "Lucknow", country: "India", zone: "Asia/Kolkata" },
  { city: "Kanpur", country: "India", zone: "Asia/Kolkata" },
  { city: "Nagpur", country: "India", zone: "Asia/Kolkata" },
  { city: "Indore", country: "India", zone: "Asia/Kolkata" },
  { city: "Bhopal", country: "India", zone: "Asia/Kolkata" },
  { city: "Patna", country: "India", zone: "Asia/Kolkata" },
  { city: "Karachi", country: "Pakistan", zone: "Asia/Karachi" },
  { city: "Lahore", country: "Pakistan", zone: "Asia/Karachi" },
  { city: "Islamabad", country: "Pakistan", zone: "Asia/Karachi" },
  { city: "Rawalpindi", country: "Pakistan", zone: "Asia/Karachi" },
  { city: "Dhaka", country: "Bangladesh", zone: "Asia/Dhaka" },
  { city: "Chittagong", country: "Bangladesh", zone: "Asia/Dhaka" },
  { city: "Colombo", country: "Sri Lanka", zone: "Asia/Colombo" },
  { city: "Kathmandu", country: "Nepal", zone: "Asia/Kathmandu" },
  { city: "Thimphu", country: "Bhutan", zone: "Asia/Thimphu" },
  { city: "Male", country: "Maldives", zone: "Indian/Maldives" },
  // Asia — Central
  { city: "Tashkent", country: "Uzbekistan", zone: "Asia/Tashkent" },
  { city: "Samarkand", country: "Uzbekistan", zone: "Asia/Samarkand" },
  { city: "Almaty", country: "Kazakhstan", zone: "Asia/Almaty" },
  { city: "Astana", country: "Kazakhstan", zone: "Asia/Almaty" },
  { city: "Bishkek", country: "Kyrgyzstan", zone: "Asia/Bishkek" },
  { city: "Dushanbe", country: "Tajikistan", zone: "Asia/Dushanbe" },
  { city: "Ashgabat", country: "Turkmenistan", zone: "Asia/Ashgabat" },
  { city: "Ulaanbaatar", country: "Mongolia", zone: "Asia/Ulaanbaatar" },
  { city: "Tbilisi", country: "Georgia", zone: "Asia/Tbilisi" },
  { city: "Yerevan", country: "Armenia", zone: "Asia/Yerevan" },
  { city: "Baku", country: "Azerbaijan", zone: "Asia/Baku" },
  { city: "Nicosia", country: "Cyprus", zone: "Asia/Nicosia" },
  // Oceania
  { city: "Sydney", country: "Australia", zone: "Australia/Sydney", region: "NSW" },
  { city: "Melbourne", country: "Australia", zone: "Australia/Melbourne", region: "VIC" },
  { city: "Brisbane", country: "Australia", zone: "Australia/Brisbane", region: "QLD" },
  { city: "Perth", country: "Australia", zone: "Australia/Perth", region: "WA" },
  { city: "Adelaide", country: "Australia", zone: "Australia/Adelaide", region: "SA" },
  { city: "Hobart", country: "Australia", zone: "Australia/Hobart", region: "TAS" },
  { city: "Darwin", country: "Australia", zone: "Australia/Darwin", region: "NT" },
  { city: "Canberra", country: "Australia", zone: "Australia/Sydney", region: "ACT" },
  { city: "Gold Coast", country: "Australia", zone: "Australia/Brisbane", region: "QLD" },
  { city: "Newcastle", country: "Australia", zone: "Australia/Sydney", region: "NSW" },
  { city: "Cairns", country: "Australia", zone: "Australia/Brisbane", region: "QLD" },
  { city: "Auckland", country: "New Zealand", zone: "Pacific/Auckland" },
  { city: "Wellington", country: "New Zealand", zone: "Pacific/Auckland" },
  { city: "Christchurch", country: "New Zealand", zone: "Pacific/Auckland" },
  { city: "Hamilton", country: "New Zealand", zone: "Pacific/Auckland" },
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
  { city: "Hagatna", country: "Guam", zone: "Pacific/Guam" },
  { city: "Saipan", country: "Northern Mariana Islands", zone: "Pacific/Saipan" },
  // Atlantic / Other
  { city: "Hamilton", country: "Bermuda", zone: "Atlantic/Bermuda" },
  { city: "Stanley", country: "Falkland Islands", zone: "Atlantic/Stanley" },
  { city: "Torshavn", country: "Faroe Islands", zone: "Atlantic/Faroe" },
  { city: "Ponta Delgada", country: "Portugal (Azores)", zone: "Atlantic/Azores" },
  { city: "Funchal", country: "Portugal (Madeira)", zone: "Atlantic/Madeira" },
  { city: "Praia", country: "Cape Verde", zone: "Atlantic/Cape_Verde" },
  { city: "Georgetown", country: "South Georgia", zone: "Atlantic/South_Georgia" },
  { city: "Jamestown", country: "Saint Helena", zone: "Atlantic/St_Helena" },
  { city: "Reykjavik", country: "Iceland", zone: "Atlantic/Reykjavik" },
  // Antarctica
  { city: "McMurdo Station", country: "Antarctica", zone: "Antarctica/McMurdo" },
  { city: "Casey Station", country: "Antarctica", zone: "Antarctica/Casey" },
  { city: "Davis Station", country: "Antarctica", zone: "Antarctica/Davis" },
  { city: "Mawson Station", country: "Antarctica", zone: "Antarctica/Mawson" },
  { city: "Palmer Station", country: "Antarctica", zone: "Antarctica/Palmer" },
  { city: "Rothera Station", country: "Antarctica", zone: "Antarctica/Rothera" },
  { city: "Troll Station", country: "Antarctica", zone: "Antarctica/Troll" },
  { city: "Vostok Station", country: "Antarctica", zone: "Antarctica/Vostok" },
  // Atlantic / Atlantic islands
  { city: "Las Palmas", country: "Spain (Canary Islands)", zone: "Atlantic/Canary" },
  { city: "Santa Cruz de Tenerife", country: "Spain (Canary Islands)", zone: "Atlantic/Canary" },
];

/** Default work hours: 9 AM to 5 PM, Monday to Friday. */
export const DEFAULT_WORK_HOURS: WorkHours = {
  startHour: 9,
  endHour: 17,
  weekendDays: [0, 6], // Sunday, Saturday
};

/** Default meeting duration (60 minutes). */
export const DEFAULT_DURATION_MINUTES = 60;

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Search cities by case-insensitive partial name or country match. */
export function searchCities(query: string, limit = 20): CityEntry[] {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return [];
  const results: CityEntry[] = [];
  const seen = new Set<string>();
  // First pass: city-name prefix match (highest priority)
  for (const c of CITY_DATABASE) {
    if (c.city.toLowerCase().startsWith(q)) {
      const key = `${c.zone}|${c.city}`;
      if (!seen.has(key)) {
        results.push(c);
        seen.add(key);
      }
      if (results.length >= limit) return results;
    }
  }
  // Second pass: contains match
  for (const c of CITY_DATABASE) {
    if (results.includes(c)) continue;
    if (c.city.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)) {
      const key = `${c.zone}|${c.city}`;
      if (!seen.has(key)) {
        results.push(c);
        seen.add(key);
      }
      if (results.length >= limit) return results;
    }
  }
  return results;
}

/** Find the first city entry whose name matches exactly (case-insensitive). */
export function findCityByName(name: string): CityEntry | null {
  const q = (name ?? "").trim().toLowerCase();
  if (!q) return null;
  return CITY_DATABASE.find((c) => c.city.toLowerCase() === q) ?? null;
}

/** Look up city + country for a given IANA zone (first matching entry). */
export function cityForZone(zone: string): CityEntry | null {
  return CITY_DATABASE.find((c) => c.zone === zone) ?? null;
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

function pad4(n: number): string {
  if (n < 0) return `-${pad4(-n)}`;
  return n < 10 ? `000${n}` : n < 100 ? `00${n}` : n < 1000 ? `0${n}` : String(n);
}

/** Format an offset (in signed minutes) as "±HH:MM". */
export function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${pad2(h)}:${pad2(m)}`;
}

/** Compute the wall-clock parts + offset + abbreviation + DST flag for an instant + zone. */
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
  if (hour === 24) hour = 0; // Intl sometimes returns "24" for midnight
  const minute = Number(map.minute);
  const second = Number(map.second);
  const weekday = map.weekday;
  const weekdayShort = weekday ? weekday.slice(0, 3) : "";
  const weekdayNum = WEEKDAYS_FULL.indexOf(weekday);

  // Compute offset: difference between wall-clock-as-UTC and actual instant
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMinutes = Math.round((wallAsUtc - instantMs) / 60000);

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

  const dstActive = /daylight|summer/i.test(longName) && !/standard|winter/i.test(longName);
  if (!abbreviation) abbreviation = `UTC${formatOffset(offsetMinutes)}`;
  const offsetLabel = formatOffset(offsetMinutes);
  const iso = `${pad4(year)}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}${offsetLabel}`;

  return {
    year, month, day, hour, minute, second,
    weekday, weekdayShort, weekdayNum,
    offsetMinutes, offsetLabel,
    abbreviation, longName, dstActive,
    zone, iso,
  };
}

// ---------------------------------------------------------------------------
// Hour classification + grid
// ---------------------------------------------------------------------------

/** Classify an hour in a zone as "work", "off", or "sleep" given work hours. */
export function classifyHour(hour: number, weekdayNum: number, workHours: WorkHours): HourClass {
  const isWeekend = workHours.weekendDays.includes(weekdayNum);
  if (!isWeekend && hour >= workHours.startHour && hour < workHours.endHour) {
    return "work";
  }
  if (hour < 7 || hour >= 22) return "sleep";
  return "off";
}

/**
 * Compute a 24-cell grid row per zone. The columns are UTC hours 0-23 of the
 * chosen reference date. Each cell shows the local hour + classification in
 * that zone at the given UTC instant.
 */
export function computeGrid(
  zones: string[],
  referenceDateMs: number, // midnight UTC of chosen date
  workHours: WorkHours = DEFAULT_WORK_HOURS,
): GridRow[] {
  return zones.map((zone) => {
    const city = cityForZone(zone);
    const cells: GridCell[] = [];
    for (let utcHour = 0; utcHour < 24; utcHour++) {
      const instantMs = referenceDateMs + utcHour * 3_600_000;
      const parts = getZoneParts(instantMs, zone);
      cells.push({
        utcHour,
        localHour: parts.hour,
        localWeekday: parts.weekdayNum,
        classification: classifyHour(parts.hour, parts.weekdayNum, workHours),
      });
    }
    return {
      zone,
      city: city?.city ?? zone,
      country: city?.country ?? "",
      parts: getZoneParts(referenceDateMs, zone),
      cells,
    };
  });
}

// ---------------------------------------------------------------------------
// Best-slot finder
// ---------------------------------------------------------------------------

const WEEKDAY_SHORT_LOOKUP: Record<string, string> = {
  Sunday: "Sun", Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
  Thursday: "Thu", Friday: "Fri", Saturday: "Sat",
};

/**
 * Find the top-N best meeting slots by overlapping work hours.
 *
 * For each UTC hour of the chosen date, compute each participant's local time
 * and classification. Score = (count of participants in work hours) * 10,
 * plus a +100 bonus when ALL participants overlap.
 */
export function findBestSlots(
  zones: string[],
  referenceDateMs: number,
  workHours: WorkHours = DEFAULT_WORK_HOURS,
  topN = 5,
): SlotSuggestion[] {
  const candidates: SlotSuggestion[] = [];
  for (let utcHour = 0; utcHour < 24; utcHour++) {
    const instantMs = referenceDateMs + utcHour * 3_600_000;
    const locals: LocalTimeAtUtc[] = zones.map((zone) => {
      const parts = getZoneParts(instantMs, zone);
      const city = cityForZone(zone);
      const classification = classifyHour(parts.hour, parts.weekdayNum, workHours);
      return {
        zone,
        city: city?.city ?? zone,
        country: city?.country ?? "",
        localHour: parts.hour,
        localWeekday: parts.weekdayNum,
        weekdayLabel: WEEKDAY_SHORT_LOOKUP[parts.weekday] ?? parts.weekdayShort,
        classification,
        offsetLabel: parts.offsetLabel,
        abbreviation: parts.abbreviation,
      };
    });
    const overlapCount = locals.filter((l) => l.classification === "work").length;
    const allInWork = zones.length > 0 && overlapCount === zones.length;
    const score = (zones.length === 0) ? 0 : (allInWork ? 100 + overlapCount : overlapCount * 10);
    candidates.push({
      utcHour,
      utcStartIso: new Date(instantMs).toISOString(),
      score,
      overlapCount,
      totalParticipants: zones.length,
      allInWorkHours: allInWork,
      locals,
    });
  }
  candidates.sort((a, b) => b.score - a.score || a.utcHour - b.utcHour);
  return candidates.slice(0, topN);
}

/** Format a slot suggestion as plain-text summary. */
export function renderSlotSummary(slot: SlotSuggestion, durationMinutes = DEFAULT_DURATION_MINUTES): string {
  const lines: string[] = [];
  const header = slot.allInWorkHours
    ? `Best meeting slot (everyone in work hours): UTC ${pad2(slot.utcHour)}:00 for ${durationMinutes} min`
    : `Suggested slot: UTC ${pad2(slot.utcHour)}:00 for ${durationMinutes} min (${slot.overlapCount}/${slot.totalParticipants} in work hours)`;
  lines.push(header);
  lines.push("");
  lines.push("Local times for each participant:");
  for (const lt of slot.locals) {
    const cls = lt.classification === "work" ? "✓ work"
      : lt.classification === "sleep" ? "✗ sleep"
      : "~ off";
    lines.push(`  ${lt.city.padEnd(20)} ${lt.weekdayLabel} ${pad2(lt.localHour)}:00 (${lt.offsetLabel}, ${lt.abbreviation}) — ${cls}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Calendar export — .ics / Google / Outlook
// ---------------------------------------------------------------------------

function icsTimestamp(ms: number): string {
  // YYYYMMDDTHHMMSSZ (UTC)
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = pad2(d.getUTCMonth() + 1);
  const dd = pad2(d.getUTCDate());
  const hh = pad2(d.getUTCHours());
  const mi = pad2(d.getUTCMinutes());
  const ss = pad2(d.getUTCSeconds());
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function icsEscape(s: string): string {
  return (s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Generate an RFC 5545 .ics VCALENDAR/VEVENT string. */
export function renderIcs(event: IcsEvent): string {
  const dtStart = icsTimestamp(event.startUtcMs);
  const dtEnd = icsTimestamp(event.startUtcMs + event.durationMinutes * 60_000);
  const dtStamp = icsTimestamp(Date.now());
  const uid = `unqtools-${event.startUtcMs}-${Math.random().toString(36).slice(2, 10)}@unqtools`;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UnQTools//World Clock Meeting Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${icsEscape(event.title)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${icsEscape(event.description)}`);
  if (event.location) lines.push(`LOCATION:${icsEscape(event.location)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  // RFC 5545 requires CRLF line endings
  return lines.join("\r\n") + "\r\n";
}

/** Build a Google Calendar compose URL. */
export function buildGoogleCalendarUrl(event: IcsEvent): string {
  const start = icsTimestamp(event.startUtcMs);
  const end = icsTimestamp(event.startUtcMs + event.durationMinutes * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
  });
  if (event.description) params.set("details", event.description);
  if (event.location) params.set("location", event.location);
  return `https://www.google.com/calendar/render?${params.toString()}`;
}

/** Build an Outlook compose URL. */
export function buildOutlookUrl(event: IcsEvent): string {
  const startIso = new Date(event.startUtcMs).toISOString();
  const endIso = new Date(event.startUtcMs + event.durationMinutes * 60_000).toISOString();
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    startdt: startIso,
    enddt: endIso,
    subject: event.title,
  });
  if (event.description) params.set("body", event.description);
  if (event.location) params.set("location", event.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// "Now" snapshot across many zones
// ---------------------------------------------------------------------------

export interface NowEntry {
  zone: string;
  city: string;
  country: string;
  parts: ZoneParts;
  isDaytime: boolean;
}

/** Get the current wall-clock across many zones for the same instant. */
export function nowInZones(zones: string[], instantMs = Date.now()): NowEntry[] {
  return zones.map((zone) => {
    const parts = getZoneParts(instantMs, zone);
    const city = cityForZone(zone);
    const isDaytime = parts.hour >= 6 && parts.hour < 19;
    return {
      zone,
      city: city?.city ?? zone,
      country: city?.country ?? "",
      parts,
      isDaytime,
    };
  });
}

// ---------------------------------------------------------------------------
// History (localStorage, max 20)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:world-clock-meeting-planner:history";
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

export interface ShareState {
  zones: string[];
  date: string; // YYYY-MM-DD
  startHour?: number;
  endHour?: number;
  weekendDays?: number[];
}

/** Build a shareable URL encoding zones + date + work hours. */
export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.zones.length > 0) params.set("zones", state.zones.join(","));
  if (state.date) params.set("date", state.date);
  if (typeof state.startHour === "number") params.set("sh", String(state.startHour));
  if (typeof state.endHour === "number") params.set("eh", String(state.endHour));
  if (state.weekendDays && state.weekendDays.length > 0) {
    params.set("we", state.weekendDays.join(","));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState | null {
  let clean = hash;
  if (clean.startsWith("#")) clean = clean.slice(1);
  if (clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const zonesStr = params.get("zones") ?? "";
  const date = params.get("date") ?? "";
  const startHourStr = params.get("sh");
  const endHourStr = params.get("eh");
  const weekendStr = params.get("we") ?? "";
  if (!zonesStr && !date) return null;
  const zones = zonesStr ? zonesStr.split(",").filter((z) => isValidZone(z)) : [];
  let startHour: number | undefined;
  let endHour: number | undefined;
  if (startHourStr) {
    const n = Number(startHourStr);
    if (Number.isInteger(n) && n >= 0 && n <= 23) startHour = n;
  }
  if (endHourStr) {
    const n = Number(endHourStr);
    if (Number.isInteger(n) && n >= 1 && n <= 24) endHour = n;
  }
  const weekendDays = weekendStr
    ? weekendStr.split(",").map((s) => Number(s)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : [];
  return { zones, date, startHour, endHour, weekendDays };
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Parse a YYYY-MM-DD string as midnight UTC (returns NaN for invalid input). */
export function parseDateUtc(dateStr: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateStr ?? "").trim());
  if (!m) return Number.NaN;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return Number.NaN;
  return Date.UTC(year, month - 1, day, 0, 0, 0, 0);
}

/** Format a UTC instant as YYYY-MM-DD. */
export function formatDateUtc(ms: number): string {
  const d = new Date(ms);
  return `${pad4(d.getUTCFullYear())}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
