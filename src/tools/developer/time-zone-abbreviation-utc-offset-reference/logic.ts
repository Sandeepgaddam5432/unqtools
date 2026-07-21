/**
 * Time Zone Abbreviation & UTC Offset Reference — pure logic.
 *
 * A searchable reference of 200+ time zone abbreviations mapped to their
 * IANA zone equivalents, with UTC offsets and DST status computed live via
 * Intl.DateTimeFormat. Resolves ambiguous abbreviations (CST, IST, BST,
 * AMT, …) by listing every candidate zone.
 *
 * Pure functions only — no DOM, no network. Live offsets are computed via
 * Intl.DateTimeFormat which uses the host's bundled IANA tz database.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ZoneEntry {
  /** Abbreviation, e.g. "EST", "CST", "JST". Case-sensitive uppercase. */
  abbr: string;
  /** Full human-readable name, e.g. "Eastern Standard Time (North America)". */
  fullName: string;
  /** IANA zone identifier, e.g. "America/New_York". */
  ianaZone: string;
  /** Geographic region for grouping, e.g. "North America". */
  region: string;
  /** Example city within this zone, e.g. "New York". */
  exampleCity: string;
  /** Optional disambiguation note. */
  notes?: string;
}

export interface ZoneWithOffset extends ZoneEntry {
  /** Standard (winter) UTC offset in minutes east of UTC. */
  standardOffsetMinutes: number;
  /** DST (summer) UTC offset in minutes east of UTC (equals standard if no DST). */
  dstOffsetMinutes: number;
  /** Whether this zone observes DST. */
  observesDst: boolean;
  /** Current UTC offset for the given reference Date, in minutes. */
  currentOffsetMinutes: number;
  /** Whether DST is currently active for the given reference Date. */
  dstActive: boolean;
  /** Formatted standard offset, e.g. "+05:30" or "-03:00". */
  standardOffsetStr: string;
  /** Formatted DST offset, e.g. "+06:30". */
  dstOffsetStr: string;
  /** Formatted current offset. */
  currentOffsetStr: string;
  /** Live local time string in this zone at the reference Date. */
  currentTimeStr: string;
  /** Live local date string in this zone at the reference Date. */
  currentDateStr: string;
}

export type SearchField = "abbr" | "fullName" | "ianaZone" | "exampleCity" | "offset";

export interface SearchParams {
  query: string;
  /** Defaults to "any" if omitted. */
  field?: SearchField | "any";
  /** Optional offset filter (minutes). If set, only zones with this standard OR dst offset are returned. */
  offsetMinutes?: number | null;
  /** Limit number of results. */
  limit?: number;
}

export interface SearchResult {
  rows: ZoneWithOffset[];
  total: number;
  /** Distinct abbreviations matched. */
  distinctAbbrs: string[];
  /** Whether the query matched an ambiguous abbreviation (>1 zone). */
  ambiguous: boolean;
}

export interface HistoryEntry {
  ts: number;
  query: string;
  field: SearchField | "any";
  matchCount: number;
}

export interface AmbiguityInfo {
  abbr: string;
  candidates: ZoneEntry[];
  /** Distinct regions among candidates. */
  regions: string[];
  /** Distinct standard offsets among candidates (in minutes). */
  distinctOffsets: number[];
}

// ---------------------------------------------------------------------------
// Constants & option catalogs
// ---------------------------------------------------------------------------

export const SEARCH_FIELDS: ReadonlyArray<{ value: SearchField | "any"; label: string }> = [
  { value: "any", label: "Any field" },
  { value: "abbr", label: "Abbreviation" },
  { value: "fullName", label: "Full name" },
  { value: "ianaZone", label: "IANA id" },
  { value: "exampleCity", label: "City" },
  { value: "offset", label: "UTC offset (e.g. +5:30)" },
];

/**
 * Master list of 200+ abbreviation → IANA zone mappings.
 * Ambiguous abbreviations appear multiple times (once per candidate zone).
 */
export const ZONE_ENTRIES: ReadonlyArray<ZoneEntry> = [
  // --- A ---
  { abbr: "ACT", fullName: "Acre Time", ianaZone: "America/Rio_Branco", region: "South America", exampleCity: "Rio Branco" },
  { abbr: "ACT", fullName: "Australian Central Time", ianaZone: "Australia/Darwin", region: "Australia", exampleCity: "Darwin", notes: "Same abbr as Acre Time." },
  { abbr: "ADT", fullName: "Atlantic Daylight Time", ianaZone: "America/Halifax", region: "North America", exampleCity: "Halifax" },
  { abbr: "AET", fullName: "Australian Eastern Time", ianaZone: "Australia/Sydney", region: "Australia", exampleCity: "Sydney" },
  { abbr: "AFT", fullName: "Afghanistan Time", ianaZone: "Asia/Kabul", region: "Asia", exampleCity: "Kabul" },
  { abbr: "AKDT", fullName: "Alaska Daylight Time", ianaZone: "America/Anchorage", region: "North America", exampleCity: "Anchorage" },
  { abbr: "AKST", fullName: "Alaska Standard Time", ianaZone: "America/Anchorage", region: "North America", exampleCity: "Anchorage" },
  { abbr: "ALMT", fullName: "Alma-Ata Time", ianaZone: "Asia/Almaty", region: "Asia", exampleCity: "Almaty" },
  { abbr: "AMST", fullName: "Amazon Summer Time", ianaZone: "America/Santarem", region: "South America", exampleCity: "Santarem" },
  { abbr: "AMT", fullName: "Amazon Time", ianaZone: "America/Manaus", region: "South America", exampleCity: "Manaus", notes: "Same abbr as Armenia Time." },
  { abbr: "AMT", fullName: "Armenia Time", ianaZone: "Asia/Yerevan", region: "Asia", exampleCity: "Yerevan", notes: "Same abbr as Amazon Time." },
  { abbr: "ANAT", fullName: "Anadyr Time", ianaZone: "Asia/Anadyr", region: "Asia", exampleCity: "Anadyr" },
  { abbr: "AQT", fullName: "Aqtobe Time", ianaZone: "Asia/Aqtobe", region: "Asia", exampleCity: "Aqtobe" },
  { abbr: "ART", fullName: "Argentina Time", ianaZone: "America/Argentina/Buenos_Aires", region: "South America", exampleCity: "Buenos Aires" },
  { abbr: "AST", fullName: "Atlantic Standard Time", ianaZone: "America/Halifax", region: "North America", exampleCity: "Halifax", notes: "Same abbr as Arabia Standard Time." },
  { abbr: "AST", fullName: "Arabia Standard Time", ianaZone: "Asia/Riyadh", region: "Asia", exampleCity: "Riyadh", notes: "Same abbr as Atlantic Standard Time." },
  { abbr: "AWST", fullName: "Australian Western Standard Time", ianaZone: "Australia/Perth", region: "Australia", exampleCity: "Perth" },
  { abbr: "AZOST", fullName: "Azores Summer Time", ianaZone: "Atlantic/Azores", region: "Atlantic", exampleCity: "Ponta Delgada" },
  { abbr: "AZOT", fullName: "Azores Time", ianaZone: "Atlantic/Azores", region: "Atlantic", exampleCity: "Ponta Delgada" },
  { abbr: "AZT", fullName: "Azerbaijan Time", ianaZone: "Asia/Baku", region: "Asia", exampleCity: "Baku" },

  // --- B ---
  { abbr: "BDT", fullName: "Bangladesh Standard Time", ianaZone: "Asia/Dhaka", region: "Asia", exampleCity: "Dhaka" },
  { abbr: "BNT", fullName: "Brunei Darussalam Time", ianaZone: "Asia/Brunei", region: "Asia", exampleCity: "Bandar Seri Begawan" },
  { abbr: "BOT", fullName: "Bolivia Time", ianaZone: "America/La_Paz", region: "South America", exampleCity: "La Paz" },
  { abbr: "BRST", fullName: "Brasília Summer Time", ianaZone: "America/Sao_Paulo", region: "South America", exampleCity: "São Paulo" },
  { abbr: "BRT", fullName: "Brasília Time", ianaZone: "America/Sao_Paulo", region: "South America", exampleCity: "São Paulo" },
  { abbr: "BST", fullName: "British Summer Time", ianaZone: "Europe/London", region: "Europe", exampleCity: "London", notes: "Same abbr as Bougainville & Bangladesh." },
  { abbr: "BST", fullName: "Bougainville Standard Time", ianaZone: "Pacific/Bougainville", region: "Pacific", exampleCity: "Buka", notes: "Same abbr as British & Bangladesh." },
  { abbr: "BST", fullName: "Bangladesh Standard Time", ianaZone: "Asia/Dhaka", region: "Asia", exampleCity: "Dhaka", notes: "Same abbr as British & Bougainville." },
  { abbr: "BTT", fullName: "Bhutan Time", ianaZone: "Asia/Thimphu", region: "Asia", exampleCity: "Thimphu" },

  // --- C ---
  { abbr: "CAT", fullName: "Central Africa Time", ianaZone: "Africa/Harare", region: "Africa", exampleCity: "Harare" },
  { abbr: "CCT", fullName: "Cocos Islands Time", ianaZone: "Indian/Cocos", region: "Indian", exampleCity: "West Island" },
  { abbr: "CDT", fullName: "Central Daylight Time", ianaZone: "America/Chicago", region: "North America", exampleCity: "Chicago", notes: "Same abbr as Cuba Daylight Time." },
  { abbr: "CDT", fullName: "Cuba Daylight Time", ianaZone: "America/Havana", region: "Caribbean", exampleCity: "Havana", notes: "Same abbr as Central Daylight Time." },
  { abbr: "CEST", fullName: "Central European Summer Time", ianaZone: "Europe/Paris", region: "Europe", exampleCity: "Paris" },
  { abbr: "CET", fullName: "Central European Time", ianaZone: "Europe/Paris", region: "Europe", exampleCity: "Paris" },
  { abbr: "CHADT", fullName: "Chatham Island Daylight Time", ianaZone: "Pacific/Chatham", region: "Pacific", exampleCity: "Waitangi" },
  { abbr: "CHAST", fullName: "Chatham Island Standard Time", ianaZone: "Pacific/Chatham", region: "Pacific", exampleCity: "Waitangi" },
  { abbr: "CHOT", fullName: "Choibalsan Time", ianaZone: "Asia/Choibalsan", region: "Asia", exampleCity: "Choibalsan" },
  { abbr: "CHST", fullName: "Chuuk Time", ianaZone: "Pacific/Chuuk", region: "Pacific", exampleCity: "Weno" },
  { abbr: "CHUT", fullName: "Chuuk Time", ianaZone: "Pacific/Chuuk", region: "Pacific", exampleCity: "Weno" },
  { abbr: "CIT", fullName: "Central Indonesia Time", ianaZone: "Asia/Makassar", region: "Asia", exampleCity: "Makassar" },
  { abbr: "CKT", fullName: "Cook Island Time", ianaZone: "Pacific/Rarotonga", region: "Pacific", exampleCity: "Rarotonga" },
  { abbr: "CLST", fullName: "Chile Summer Time", ianaZone: "America/Santiago", region: "South America", exampleCity: "Santiago" },
  { abbr: "CLT", fullName: "Chile Standard Time", ianaZone: "America/Santiago", region: "South America", exampleCity: "Santiago" },
  { abbr: "COT", fullName: "Colombia Time", ianaZone: "America/Bogota", region: "South America", exampleCity: "Bogotá" },
  { abbr: "CST", fullName: "Central Standard Time (North America)", ianaZone: "America/Chicago", region: "North America", exampleCity: "Chicago", notes: "Same abbr as China & Cuba Standard Time." },
  { abbr: "CST", fullName: "China Standard Time", ianaZone: "Asia/Shanghai", region: "Asia", exampleCity: "Shanghai", notes: "Same abbr as Central & Cuba Standard Time." },
  { abbr: "CST", fullName: "Cuba Standard Time", ianaZone: "America/Havana", region: "Caribbean", exampleCity: "Havana", notes: "Same abbr as Central & China Standard Time." },
  { abbr: "CT", fullName: "China Time", ianaZone: "Asia/Shanghai", region: "Asia", exampleCity: "Beijing" },
  { abbr: "CVT", fullName: "Cape Verde Time", ianaZone: "Atlantic/Cape_Verde", region: "Atlantic", exampleCity: "Praia" },
  { abbr: "CXT", fullName: "Christmas Island Time", ianaZone: "Indian/Christmas", region: "Indian", exampleCity: "Flying Fish Cove" },

  // --- D ---
  { abbr: "DAVT", fullName: "Davis Time", ianaZone: "Antarctica/Davis", region: "Antarctica", exampleCity: "Davis Station" },
  { abbr: "DDUT", fullName: "Dumont d'Urville Time", ianaZone: "Antarctica/DumontDUrville", region: "Antarctica", exampleCity: "Dumont d'Urville Station" },
  { abbr: "DFT", fullName: "AIX-specific Time (obsolete)", ianaZone: "Africa/Juba", region: "Africa", exampleCity: "Juba" },

  // --- E ---
  { abbr: "EAT", fullName: "East Africa Time", ianaZone: "Africa/Nairobi", region: "Africa", exampleCity: "Nairobi" },
  { abbr: "ECT", fullName: "Ecuador Time", ianaZone: "America/Guayaquil", region: "South America", exampleCity: "Guayaquil" },
  { abbr: "EDT", fullName: "Eastern Daylight Time", ianaZone: "America/New_York", region: "North America", exampleCity: "New York" },
  { abbr: "EEST", fullName: "Eastern European Summer Time", ianaZone: "Europe/Athens", region: "Europe", exampleCity: "Athens" },
  { abbr: "EET", fullName: "Eastern European Time", ianaZone: "Europe/Athens", region: "Europe", exampleCity: "Athens" },
  { abbr: "EGST", fullName: "Eastern Greenland Summer Time", ianaZone: "America/Scoresbysund", region: "North America", exampleCity: "Ittoqqortoormiit" },
  { abbr: "EGT", fullName: "Eastern Greenland Time", ianaZone: "America/Scoresbysund", region: "North America", exampleCity: "Ittoqqortoormiit" },
  { abbr: "EST", fullName: "Eastern Standard Time (North America)", ianaZone: "America/New_York", region: "North America", exampleCity: "New York" },
  { abbr: "ET", fullName: "Eastern Time (North America)", ianaZone: "America/New_York", region: "North America", exampleCity: "New York" },

  // --- F ---
  { abbr: "FET", fullName: "Further-Eastern European Time", ianaZone: "Europe/Kaliningrad", region: "Europe", exampleCity: "Kaliningrad" },
  { abbr: "FJT", fullName: "Fiji Time", ianaZone: "Pacific/Fiji", region: "Pacific", exampleCity: "Suva" },
  { abbr: "FKST", fullName: "Falkland Islands Summer Time", ianaZone: "Atlantic/Stanley", region: "Atlantic", exampleCity: "Stanley" },
  { abbr: "FKT", fullName: "Falkland Islands Time", ianaZone: "Atlantic/Stanley", region: "Atlantic", exampleCity: "Stanley" },
  { abbr: "FNT", fullName: "Fernando de Noronha Time", ianaZone: "America/Noronha", region: "South America", exampleCity: "Fernando de Noronha" },

  // --- G ---
  { abbr: "GALT", fullName: "Galapagos Time", ianaZone: "Pacific/Galapagos", region: "Pacific", exampleCity: "Puerto Baquerizo Moreno" },
  { abbr: "GAMT", fullName: "Gambier Time", ianaZone: "Pacific/Gambier", region: "Pacific", exampleCity: "Gambier" },
  { abbr: "GET", fullName: "Georgia Standard Time", ianaZone: "Asia/Tbilisi", region: "Asia", exampleCity: "Tbilisi" },
  { abbr: "GFT", fullName: "French Guiana Time", ianaZone: "America/Cayenne", region: "South America", exampleCity: "Cayenne" },
  { abbr: "GILT", fullName: "Gilbert Island Time", ianaZone: "Pacific/Tarawa", region: "Pacific", exampleCity: "Tarawa" },
  { abbr: "GMT", fullName: "Greenwich Mean Time", ianaZone: "Etc/GMT", region: "Universal", exampleCity: "London (winter)" },
  { abbr: "GST", fullName: "Gulf Standard Time", ianaZone: "Asia/Dubai", region: "Asia", exampleCity: "Dubai", notes: "Same abbr as South Georgia Time." },
  { abbr: "GST", fullName: "South Georgia Time", ianaZone: "Atlantic/South_Georgia", region: "Atlantic", exampleCity: "Grytviken", notes: "Same abbr as Gulf Standard Time." },
  { abbr: "GYT", fullName: "Guyana Time", ianaZone: "America/Guyana", region: "South America", exampleCity: "Georgetown" },

  // --- H ---
  { abbr: "HADT", fullName: "Hawaii-Aleutian Daylight Time", ianaZone: "America/Adak", region: "North America", exampleCity: "Adak" },
  { abbr: "HAST", fullName: "Hawaii-Aleutian Standard Time", ianaZone: "Pacific/Honolulu", region: "Pacific", exampleCity: "Honolulu" },
  { abbr: "HKT", fullName: "Hong Kong Time", ianaZone: "Asia/Hong_Kong", region: "Asia", exampleCity: "Hong Kong" },
  { abbr: "HMT", fullName: "Heard and McDonald Islands Time", ianaZone: "Indian/Kerguelen", region: "Indian", exampleCity: "Heard Island" },
  { abbr: "HOVT", fullName: "Hovd Time", ianaZone: "Asia/Hovd", region: "Asia", exampleCity: "Hovd" },
  { abbr: "HST", fullName: "Hawaii-Aleutian Standard Time", ianaZone: "Pacific/Honolulu", region: "Pacific", exampleCity: "Honolulu" },

  // --- I ---
  { abbr: "ICT", fullName: "Indochina Time", ianaZone: "Asia/Bangkok", region: "Asia", exampleCity: "Bangkok" },
  { abbr: "IDT", fullName: "Israel Daylight Time", ianaZone: "Asia/Jerusalem", region: "Asia", exampleCity: "Jerusalem" },
  { abbr: "IOT", fullName: "Indian Chagos Time", ianaZone: "Indian/Chagos", region: "Indian", exampleCity: "Diego Garcia" },
  { abbr: "IRDT", fullName: "Iran Daylight Time", ianaZone: "Asia/Tehran", region: "Asia", exampleCity: "Tehran" },
  { abbr: "IRKT", fullName: "Irkutsk Time", ianaZone: "Asia/Irkutsk", region: "Asia", exampleCity: "Irkutsk" },
  { abbr: "IRST", fullName: "Iran Standard Time", ianaZone: "Asia/Tehran", region: "Asia", exampleCity: "Tehran" },
  { abbr: "IST", fullName: "India Standard Time", ianaZone: "Asia/Kolkata", region: "Asia", exampleCity: "New Delhi", notes: "Same abbr as Irish & Israel Standard Time." },
  { abbr: "IST", fullName: "Irish Standard Time", ianaZone: "Europe/Dublin", region: "Europe", exampleCity: "Dublin", notes: "Same abbr as India & Israel Standard Time." },
  { abbr: "IST", fullName: "Israel Standard Time", ianaZone: "Asia/Jerusalem", region: "Asia", exampleCity: "Jerusalem", notes: "Same abbr as India & Irish Standard Time." },

  // --- J ---
  { abbr: "JST", fullName: "Japan Standard Time", ianaZone: "Asia/Tokyo", region: "Asia", exampleCity: "Tokyo" },

  // --- K ---
  { abbr: "KGT", fullName: "Kyrgyzstan Time", ianaZone: "Asia/Bishkek", region: "Asia", exampleCity: "Bishkek" },
  { abbr: "KOST", fullName: "Kosrae Time", ianaZone: "Pacific/Kosrae", region: "Pacific", exampleCity: "Tofol" },
  { abbr: "KRAT", fullName: "Krasnoyarsk Time", ianaZone: "Asia/Krasnoyarsk", region: "Asia", exampleCity: "Krasnoyarsk" },
  { abbr: "KST", fullName: "Korea Standard Time", ianaZone: "Asia/Seoul", region: "Asia", exampleCity: "Seoul" },

  // --- L ---
  { abbr: "LHDT", fullName: "Lord Howe Daylight Time", ianaZone: "Australia/Lord_Howe", region: "Australia", exampleCity: "Lord Howe Island" },
  { abbr: "LHST", fullName: "Lord Howe Standard Time", ianaZone: "Australia/Lord_Howe", region: "Australia", exampleCity: "Lord Howe Island" },
  { abbr: "LINT", fullName: "Line Islands Time", ianaZone: "Pacific/Kiritimati", region: "Pacific", exampleCity: "Kiritimati" },

  // --- M ---
  { abbr: "MAGT", fullName: "Magadan Time", ianaZone: "Asia/Magadan", region: "Asia", exampleCity: "Magadan" },
  { abbr: "MART", fullName: "Marquesas Time", ianaZone: "Pacific/Marquesas", region: "Pacific", exampleCity: "Taiohae" },
  { abbr: "MAWT", fullName: "Mawson Time", ianaZone: "Antarctica/Mawson", region: "Antarctica", exampleCity: "Mawson Station" },
  { abbr: "MDT", fullName: "Mountain Daylight Time", ianaZone: "America/Denver", region: "North America", exampleCity: "Denver" },
  { abbr: "MHT", fullName: "Marshall Islands Time", ianaZone: "Pacific/Majuro", region: "Pacific", exampleCity: "Majuro" },
  { abbr: "MMT", fullName: "Myanmar Time", ianaZone: "Asia/Yangon", region: "Asia", exampleCity: "Yangon" },
  { abbr: "MSK", fullName: "Moscow Standard Time", ianaZone: "Europe/Moscow", region: "Europe", exampleCity: "Moscow" },
  { abbr: "MST", fullName: "Mountain Standard Time (North America)", ianaZone: "America/Denver", region: "North America", exampleCity: "Denver" },
  { abbr: "MUT", fullName: "Mauritius Time", ianaZone: "Indian/Mauritius", region: "Indian", exampleCity: "Port Louis" },
  { abbr: "MVT", fullName: "Maldives Time", ianaZone: "Indian/Maldives", region: "Indian", exampleCity: "Malé" },
  { abbr: "MYT", fullName: "Malaysia Time", ianaZone: "Asia/Kuala_Lumpur", region: "Asia", exampleCity: "Kuala Lumpur" },

  // --- N ---
  { abbr: "NCT", fullName: "New Caledonia Time", ianaZone: "Pacific/Noumea", region: "Pacific", exampleCity: "Nouméa" },
  { abbr: "NDT", fullName: "Newfoundland Daylight Time", ianaZone: "America/St_Johns", region: "North America", exampleCity: "St. John's" },
  { abbr: "NFT", fullName: "Norfolk Island Time", ianaZone: "Pacific/Norfolk", region: "Pacific", exampleCity: "Kingston" },
  { abbr: "NOVT", fullName: "Novosibirsk Time", ianaZone: "Asia/Novosibirsk", region: "Asia", exampleCity: "Novosibirsk" },
  { abbr: "NPT", fullName: "Nepal Time", ianaZone: "Asia/Kathmandu", region: "Asia", exampleCity: "Kathmandu" },
  { abbr: "NST", fullName: "Newfoundland Standard Time", ianaZone: "America/St_Johns", region: "North America", exampleCity: "St. John's" },
  { abbr: "NT", fullName: "Newfoundland Time", ianaZone: "America/St_Johns", region: "North America", exampleCity: "St. John's" },
  { abbr: "NUT", fullName: "Niue Time", ianaZone: "Pacific/Niue", region: "Pacific", exampleCity: "Alofi" },
  { abbr: "NZDT", fullName: "New Zealand Daylight Time", ianaZone: "Pacific/Auckland", region: "Pacific", exampleCity: "Auckland" },
  { abbr: "NZST", fullName: "New Zealand Standard Time", ianaZone: "Pacific/Auckland", region: "Pacific", exampleCity: "Auckland" },

  // --- O ---
  { abbr: "OMST", fullName: "Omsk Time", ianaZone: "Asia/Omsk", region: "Asia", exampleCity: "Omsk" },
  { abbr: "ORAT", fullName: "Oral Time", ianaZone: "Asia/Oral", region: "Asia", exampleCity: "Oral" },

  // --- P ---
  { abbr: "PDT", fullName: "Pacific Daylight Time", ianaZone: "America/Los_Angeles", region: "North America", exampleCity: "Los Angeles" },
  { abbr: "PET", fullName: "Peru Time", ianaZone: "America/Lima", region: "South America", exampleCity: "Lima" },
  { abbr: "PETT", fullName: "Kamchatka Time", ianaZone: "Asia/Kamchatka", region: "Asia", exampleCity: "Petropavlovsk-Kamchatsky" },
  { abbr: "PGT", fullName: "Papua New Guinea Time", ianaZone: "Pacific/Port_Moresby", region: "Pacific", exampleCity: "Port Moresby" },
  { abbr: "PHOT", fullName: "Phoenix Island Time", ianaZone: "Pacific/Enderbury", region: "Pacific", exampleCity: "Enderbury" },
  { abbr: "PHT", fullName: "Philippine Time", ianaZone: "Asia/Manila", region: "Asia", exampleCity: "Manila" },
  { abbr: "PKT", fullName: "Pakistan Standard Time", ianaZone: "Asia/Karachi", region: "Asia", exampleCity: "Karachi" },
  { abbr: "PMDT", fullName: "Saint Pierre and Miquelon Daylight Time", ianaZone: "America/Miquelon", region: "North America", exampleCity: "Saint-Pierre" },
  { abbr: "PMST", fullName: "Saint Pierre and Miquelon Standard Time", ianaZone: "America/Miquelon", region: "North America", exampleCity: "Saint-Pierre" },
  { abbr: "PONT", fullName: "Pohnpei Standard Time", ianaZone: "Pacific/Pohnpei", region: "Pacific", exampleCity: "Kolonia" },
  { abbr: "PST", fullName: "Pacific Standard Time (North America)", ianaZone: "America/Los_Angeles", region: "North America", exampleCity: "Los Angeles", notes: "Same abbr as Philippine Standard Time." },
  { abbr: "PST", fullName: "Philippine Standard Time", ianaZone: "Asia/Manila", region: "Asia", exampleCity: "Manila", notes: "Same abbr as Pacific Standard Time." },
  { abbr: "PT", fullName: "Pacific Time (North America)", ianaZone: "America/Los_Angeles", region: "North America", exampleCity: "Los Angeles" },
  { abbr: "PYST", fullName: "Paraguay Summer Time", ianaZone: "America/Asuncion", region: "South America", exampleCity: "Asunción" },
  { abbr: "PYT", fullName: "Paraguay Time", ianaZone: "America/Asuncion", region: "South America", exampleCity: "Asunción" },

  // --- R ---
  { abbr: "RET", fullName: "Reunion Time", ianaZone: "Indian/Reunion", region: "Indian", exampleCity: "Saint-Denis" },
  { abbr: "ROTT", fullName: "Rothera Time", ianaZone: "Antarctica/Rothera", region: "Antarctica", exampleCity: "Rothera Station" },

  // --- S ---
  { abbr: "SAKT", fullName: "Sakhalin Time", ianaZone: "Asia/Sakhalin", region: "Asia", exampleCity: "Yuzhno-Sakhalinsk" },
  { abbr: "SAMT", fullName: "Samara Time", ianaZone: "Europe/Samara", region: "Europe", exampleCity: "Samara" },
  { abbr: "SAST", fullName: "South African Standard Time", ianaZone: "Africa/Johannesburg", region: "Africa", exampleCity: "Johannesburg" },
  { abbr: "SBT", fullName: "Solomon Islands Time", ianaZone: "Pacific/Guadalcanal", region: "Pacific", exampleCity: "Honiara" },
  { abbr: "SCT", fullName: "Seychelles Time", ianaZone: "Indian/Mahe", region: "Indian", exampleCity: "Victoria" },
  { abbr: "SGT", fullName: "Singapore Time", ianaZone: "Asia/Singapore", region: "Asia", exampleCity: "Singapore" },
  { abbr: "SRT", fullName: "Suriname Time", ianaZone: "America/Paramaribo", region: "South America", exampleCity: "Paramaribo" },
  { abbr: "SST", fullName: "Samoa Standard Time", ianaZone: "Pacific/Pago_Pago", region: "Pacific", exampleCity: "Pago Pago" },
  { abbr: "SYOT", fullName: "Syowa Time", ianaZone: "Antarctica/Syowa", region: "Antarctica", exampleCity: "Syowa Station" },

  // --- T ---
  { abbr: "TAHT", fullName: "Tahiti Time", ianaZone: "Pacific/Tahiti", region: "Pacific", exampleCity: "Papeete" },
  { abbr: "TFT", fullName: "French Southern and Antarctic Time", ianaZone: "Indian/Kerguelen", region: "Indian", exampleCity: "Port-aux-Français" },
  { abbr: "TJT", fullName: "Tajikistan Time", ianaZone: "Asia/Dushanbe", region: "Asia", exampleCity: "Dushanbe" },
  { abbr: "TKT", fullName: "Tokelau Time", ianaZone: "Pacific/Fakaofo", region: "Pacific", exampleCity: "Fakaofo" },
  { abbr: "TLT", fullName: "East Timor Time", ianaZone: "Asia/Dili", region: "Asia", exampleCity: "Dili" },
  { abbr: "TMT", fullName: "Turkmenistan Time", ianaZone: "Asia/Ashgabat", region: "Asia", exampleCity: "Ashgabat" },
  { abbr: "TOT", fullName: "Tonga Time", ianaZone: "Pacific/Tongatapu", region: "Pacific", exampleCity: "Nuku'alofa" },
  { abbr: "TRT", fullName: "Turkey Time", ianaZone: "Europe/Istanbul", region: "Europe", exampleCity: "Istanbul" },
  { abbr: "TVT", fullName: "Tuvalu Time", ianaZone: "Pacific/Funafuti", region: "Pacific", exampleCity: "Funafuti" },

  // --- U ---
  { abbr: "ULAT", fullName: "Ulaanbaatar Time", ianaZone: "Asia/Ulaanbaatar", region: "Asia", exampleCity: "Ulaanbaatar" },
  { abbr: "UTC", fullName: "Coordinated Universal Time", ianaZone: "Etc/UTC", region: "Universal", exampleCity: "(universal)" },
  { abbr: "UYST", fullName: "Uruguay Summer Time", ianaZone: "America/Montevideo", region: "South America", exampleCity: "Montevideo" },
  { abbr: "UYT", fullName: "Uruguay Time", ianaZone: "America/Montevideo", region: "South America", exampleCity: "Montevideo" },
  { abbr: "UZT", fullName: "Uzbekistan Time", ianaZone: "Asia/Tashkent", region: "Asia", exampleCity: "Tashkent" },

  // --- V ---
  { abbr: "VET", fullName: "Venezuelan Time", ianaZone: "America/Caracas", region: "South America", exampleCity: "Caracas" },
  { abbr: "VLAT", fullName: "Vladivostok Time", ianaZone: "Asia/Vladivostok", region: "Asia", exampleCity: "Vladivostok" },
  { abbr: "VOLT", fullName: "Volgograd Time", ianaZone: "Europe/Volgograd", region: "Europe", exampleCity: "Volgograd" },
  { abbr: "VOST", fullName: "Vostok Time", ianaZone: "Antarctica/Vostok", region: "Antarctica", exampleCity: "Vostok Station" },
  { abbr: "VUT", fullName: "Vanuatu Time", ianaZone: "Pacific/Efate", region: "Pacific", exampleCity: "Port Vila" },

  // --- W ---
  { abbr: "WAKT", fullName: "Wake Island Time", ianaZone: "Pacific/Wake", region: "Pacific", exampleCity: "Wake Island" },
  { abbr: "WAST", fullName: "West Africa Summer Time", ianaZone: "Africa/Windhoek", region: "Africa", exampleCity: "Windhoek" },
  { abbr: "WAT", fullName: "West Africa Time", ianaZone: "Africa/Lagos", region: "Africa", exampleCity: "Lagos" },
  { abbr: "WEST", fullName: "Western European Summer Time", ianaZone: "Europe/Lisbon", region: "Europe", exampleCity: "Lisbon" },
  { abbr: "WET", fullName: "Western European Time", ianaZone: "Europe/Lisbon", region: "Europe", exampleCity: "Lisbon" },
  { abbr: "WFT", fullName: "Wallis and Futuna Time", ianaZone: "Pacific/Wallis", region: "Pacific", exampleCity: "Mata-Utu" },
  { abbr: "WGT", fullName: "Western Greenland Time", ianaZone: "America/Nuuk", region: "North America", exampleCity: "Nuuk" },
  { abbr: "WIB", fullName: "Western Indonesia Time", ianaZone: "Asia/Jakarta", region: "Asia", exampleCity: "Jakarta" },
  { abbr: "WIT", fullName: "Eastern Indonesia Time", ianaZone: "Asia/Jayapura", region: "Asia", exampleCity: "Jayapura" },
  { abbr: "WISTA", fullName: "Central Indonesia Time", ianaZone: "Asia/Makassar", region: "Asia", exampleCity: "Makassar" },

  // --- Y ---
  { abbr: "YAKT", fullName: "Yakutsk Time", ianaZone: "Asia/Yakutsk", region: "Asia", exampleCity: "Yakutsk" },
  { abbr: "YEKT", fullName: "Yekaterinburg Time", ianaZone: "Asia/Yekaterinburg", region: "Asia", exampleCity: "Yekaterinburg" },

  // --- Common synonyms / aliases / informal abbreviations ---
  { abbr: "Z", fullName: "Zulu Time (UTC)", ianaZone: "Etc/UTC", region: "Universal", exampleCity: "(universal)" },
  { abbr: "WIB", fullName: "Western Indonesian Time", ianaZone: "Asia/Jakarta", region: "Asia", exampleCity: "Jakarta" },
  { abbr: "AEST", fullName: "Australian Eastern Standard Time", ianaZone: "Australia/Sydney", region: "Australia", exampleCity: "Sydney" },
  { abbr: "AEDT", fullName: "Australian Eastern Daylight Time", ianaZone: "Australia/Sydney", region: "Australia", exampleCity: "Sydney" },
  { abbr: "ACST", fullName: "Australian Central Standard Time", ianaZone: "Australia/Adelaide", region: "Australia", exampleCity: "Adelaide" },
  { abbr: "ACDT", fullName: "Australian Central Daylight Time", ianaZone: "Australia/Adelaide", region: "Australia", exampleCity: "Adelaide" },
  { abbr: "AWDT", fullName: "Australian Western Daylight Time (rare)", ianaZone: "Australia/Perth", region: "Australia", exampleCity: "Perth" },
  { abbr: "WAT", fullName: "West Africa Time", ianaZone: "Africa/Casablanca", region: "Africa", exampleCity: "Casablanca" },
  { abbr: "CAT", fullName: "Central Africa Time", ianaZone: "Africa/Maputo", region: "Africa", exampleCity: "Maputo" },
  { abbr: "EAT", fullName: "East Africa Time", ianaZone: "Africa/Addis_Ababa", region: "Africa", exampleCity: "Addis Ababa" },
  { abbr: "SAST", fullName: "South African Standard Time", ianaZone: "Africa/Maputo", region: "Africa", exampleCity: "Maputo" },
  { abbr: "CEST", fullName: "Central European Summer Time", ianaZone: "Europe/Berlin", region: "Europe", exampleCity: "Berlin" },
  { abbr: "CET", fullName: "Central European Time", ianaZone: "Europe/Berlin", region: "Europe", exampleCity: "Berlin" },
  { abbr: "EEST", fullName: "Eastern European Summer Time", ianaZone: "Europe/Helsinki", region: "Europe", exampleCity: "Helsinki" },
  { abbr: "EET", fullName: "Eastern European Time", ianaZone: "Europe/Helsinki", region: "Europe", exampleCity: "Helsinki" },
  { abbr: "WEST", fullName: "Western European Summer Time", ianaZone: "Atlantic/Canary", region: "Atlantic", exampleCity: "Las Palmas" },
  { abbr: "WET", fullName: "Western European Time", ianaZone: "Atlantic/Canary", region: "Atlantic", exampleCity: "Las Palmas" },
  { abbr: "AKST", fullName: "Alaska Standard Time", ianaZone: "America/Juneau", region: "North America", exampleCity: "Juneau" },
  { abbr: "AKDT", fullName: "Alaska Daylight Time", ianaZone: "America/Juneau", region: "North America", exampleCity: "Juneau" },
  { abbr: "HAST", fullName: "Hawaii-Aleutian Standard Time", ianaZone: "America/Adak", region: "North America", exampleCity: "Adak" },
  { abbr: "MDT", fullName: "Mountain Daylight Time", ianaZone: "America/Boise", region: "North America", exampleCity: "Boise" },
  { abbr: "MST", fullName: "Mountain Standard Time", ianaZone: "America/Phoenix", region: "North America", exampleCity: "Phoenix" },
  { abbr: "PDT", fullName: "Pacific Daylight Time", ianaZone: "America/Vancouver", region: "North America", exampleCity: "Vancouver" },
  { abbr: "PST", fullName: "Pacific Standard Time", ianaZone: "America/Vancouver", region: "North America", exampleCity: "Vancouver" },
  { abbr: "EST", fullName: "Eastern Standard Time", ianaZone: "America/Toronto", region: "North America", exampleCity: "Toronto" },
  { abbr: "EDT", fullName: "Eastern Daylight Time", ianaZone: "America/Toronto", region: "North America", exampleCity: "Toronto" },
  { abbr: "CST", fullName: "Central Standard Time", ianaZone: "America/Winnipeg", region: "North America", exampleCity: "Winnipeg" },
  { abbr: "CDT", fullName: "Central Daylight Time", ianaZone: "America/Winnipeg", region: "North America", exampleCity: "Winnipeg" },
  { abbr: "BRST", fullName: "Brasília Summer Time", ianaZone: "America/Sao_Paulo", region: "South America", exampleCity: "São Paulo" },
  { abbr: "BRT", fullName: "Brasília Time", ianaZone: "America/Sao_Paulo", region: "South America", exampleCity: "São Paulo" },
  { abbr: "ART", fullName: "Argentina Time", ianaZone: "America/Argentina/Cordoba", region: "South America", exampleCity: "Córdoba" },
  { abbr: "CLT", fullName: "Chile Standard Time", ianaZone: "America/Punta_Arenas", region: "South America", exampleCity: "Punta Arenas" },
  { abbr: "COT", fullName: "Colombia Time", ianaZone: "America/Bogota", region: "South America", exampleCity: "Bogotá" },
  { abbr: "PET", fullName: "Peru Time", ianaZone: "America/Lima", region: "South America", exampleCity: "Lima" },
  { abbr: "VET", fullName: "Venezuelan Time", ianaZone: "America/Caracas", region: "South America", exampleCity: "Caracas" },
  { abbr: "GST", fullName: "Gulf Standard Time", ianaZone: "Asia/Muscat", region: "Asia", exampleCity: "Muscat" },
  { abbr: "AST", fullName: "Arabia Standard Time", ianaZone: "Asia/Baghdad", region: "Asia", exampleCity: "Baghdad" },
  { abbr: "IRST", fullName: "Iran Standard Time", ianaZone: "Asia/Tehran", region: "Asia", exampleCity: "Tehran" },
  { abbr: "PKT", fullName: "Pakistan Standard Time", ianaZone: "Asia/Karachi", region: "Asia", exampleCity: "Karachi" },
  { abbr: "IST", fullName: "India Standard Time", ianaZone: "Asia/Calcutta", region: "Asia", exampleCity: "Kolkata" },
  { abbr: "NPT", fullName: "Nepal Time", ianaZone: "Asia/Kathmandu", region: "Asia", exampleCity: "Kathmandu" },
  { abbr: "BDT", fullName: "Bangladesh Standard Time", ianaZone: "Asia/Dhaka", region: "Asia", exampleCity: "Dhaka" },
  { abbr: "MMT", fullName: "Myanmar Time", ianaZone: "Asia/Rangoon", region: "Asia", exampleCity: "Yangon" },
  { abbr: "ICT", fullName: "Indochina Time", ianaZone: "Asia/Ho_Chi_Minh", region: "Asia", exampleCity: "Ho Chi Minh City" },
  { abbr: "PHT", fullName: "Philippine Time", ianaZone: "Asia/Manila", region: "Asia", exampleCity: "Manila" },
  { abbr: "CST", fullName: "China Standard Time", ianaZone: "Asia/Hong_Kong", region: "Asia", exampleCity: "Hong Kong" },
  { abbr: "JST", fullName: "Japan Standard Time", ianaZone: "Asia/Tokyo", region: "Asia", exampleCity: "Tokyo" },
  { abbr: "KST", fullName: "Korea Standard Time", ianaZone: "Asia/Pyongyang", region: "Asia", exampleCity: "Pyongyang" },
  { abbr: "WIB", fullName: "Western Indonesia Time", ianaZone: "Asia/Pontianak", region: "Asia", exampleCity: "Pontianak" },
  { abbr: "WITA", fullName: "Central Indonesia Time", ianaZone: "Asia/Makassar", region: "Asia", exampleCity: "Denpasar" },
  { abbr: "WIT", fullName: "Eastern Indonesia Time", ianaZone: "Asia/Jayapura", region: "Asia", exampleCity: "Jayapura" },
  { abbr: "AWST", fullName: "Australian Western Standard Time", ianaZone: "Australia/Perth", region: "Australia", exampleCity: "Perth" },
  { abbr: "NZST", fullName: "New Zealand Standard Time", ianaZone: "Pacific/Auckland", region: "Pacific", exampleCity: "Auckland" },
  { abbr: "NZDT", fullName: "New Zealand Daylight Time", ianaZone: "Pacific/Auckland", region: "Pacific", exampleCity: "Auckland" },
  { abbr: "FJT", fullName: "Fiji Time", ianaZone: "Pacific/Fiji", region: "Pacific", exampleCity: "Suva" },
  { abbr: "GILT", fullName: "Gilbert Island Time", ianaZone: "Pacific/Tarawa", region: "Pacific", exampleCity: "Tarawa" },
  { abbr: "MHT", fullName: "Marshall Islands Time", ianaZone: "Pacific/Kwajalein", region: "Pacific", exampleCity: "Kwajalein" },
  { abbr: "SBT", fullName: "Solomon Islands Time", ianaZone: "Pacific/Guadalcanal", region: "Pacific", exampleCity: "Honiara" },
  { abbr: "VUT", fullName: "Vanuatu Time", ianaZone: "Pacific/Efate", region: "Pacific", exampleCity: "Port Vila" },
  { abbr: "NFT", fullName: "Norfolk Island Time", ianaZone: "Pacific/Norfolk", region: "Pacific", exampleCity: "Kingston" },
  { abbr: "CHAST", fullName: "Chatham Island Standard Time", ianaZone: "Pacific/Chatham", region: "Pacific", exampleCity: "Waitangi" },
  { abbr: "TKT", fullName: "Tokelau Time", ianaZone: "Pacific/Fakaofo", region: "Pacific", exampleCity: "Fakaofo" },
  { abbr: "WAKT", fullName: "Wake Island Time", ianaZone: "Pacific/Wake", region: "Pacific", exampleCity: "Wake Island" },
  { abbr: "LINT", fullName: "Line Islands Time", ianaZone: "Pacific/Kiritimati", region: "Pacific", exampleCity: "Kiritimati" },
  { abbr: "SST", fullName: "Samoa Standard Time", ianaZone: "Pacific/Midway", region: "Pacific", exampleCity: "Midway Atoll" },
  { abbr: "HST", fullName: "Hawaii Standard Time", ianaZone: "Pacific/Honolulu", region: "Pacific", exampleCity: "Honolulu" },
  { abbr: "AKST", fullName: "Alaska Standard Time", ianaZone: "America/Nome", region: "North America", exampleCity: "Nome" },
];

// ---------------------------------------------------------------------------
// Intl.DateTimeFormat offset computation
// ---------------------------------------------------------------------------

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getZoneParts(date: Date, ianaZone: string): DateParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: ianaZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type === "year") map.year = parseInt(p.value, 10);
    else if (p.type === "month") map.month = parseInt(p.value, 10);
    else if (p.type === "day") map.day = parseInt(p.value, 10);
    else if (p.type === "hour") {
      // Handle "24" edge case from hour12: false in some engines.
      map.hour = parseInt(p.value, 10) === 24 ? 0 : parseInt(p.value, 10);
    }
    else if (p.type === "minute") map.minute = parseInt(p.value, 10);
    else if (p.type === "second") map.second = parseInt(p.value, 10);
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second,
  };
}

/**
 * Compute the UTC offset (in minutes east of UTC) for an IANA zone at a
 * specific instant. Negative = west of UTC. Returned value is always an
 * integer (multiple of 60, 30, 45, or other tz-defined granularity).
 */
export function getOffsetMinutes(ianaZone: string, date: Date = new Date()): number {
  const zone = getZoneParts(date, ianaZone);
  const utc = getZoneParts(date, "Etc/UTC");
  const zoneMs = Date.UTC(zone.year, zone.month - 1, zone.day, zone.hour, zone.minute, zone.second);
  const utcMs = Date.UTC(utc.year, utc.month - 1, utc.day, utc.hour, utc.minute, utc.second);
  return Math.round((zoneMs - utcMs) / 60_000);
}

/**
 * Compute the standard (winter) offset and DST (summer) offset for an IANA
 * zone, using the year of the given reference date. Returns both offsets in
 * minutes; observesDst is true iff the two differ.
 */
export function getStandardAndDstOffsets(
  ianaZone: string,
  date: Date = new Date(),
): { standardOffsetMinutes: number; dstOffsetMinutes: number; observesDst: boolean } {
  const year = getZoneParts(date, ianaZone).year;
  // Sample one date in northern-hemisphere winter and one in summer.
  const winter = new Date(Date.UTC(year, 0, 15, 12, 0, 0));
  const summer = new Date(Date.UTC(year, 6, 15, 12, 0, 0));
  const wOff = getOffsetMinutes(ianaZone, winter);
  const sOff = getOffsetMinutes(ianaZone, summer);
  // The smaller offset (more negative) is the standard offset in the northern
  // hemisphere, but in the southern hemisphere DST happens in their summer
  // (June-July). Either way, DST adds to standard, so standard = min, dst = max.
  const standardOffsetMinutes = Math.min(wOff, sOff);
  const dstOffsetMinutes = Math.max(wOff, sOff);
  const observesDst = dstOffsetMinutes !== standardOffsetMinutes;
  return { standardOffsetMinutes, dstOffsetMinutes, observesDst };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format an offset in minutes as "+HH:MM" / "-HH:MM". */
export function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Parse a textual offset like "+5:30", "-03:00", "UTC+5:30", "GMT-7" → minutes. Returns null if invalid. */
export function parseOffset(s: string): number | null {
  const t = (s ?? "").trim().toUpperCase().replace(/^(UTC|GMT|Z)\s*/, "");
  if (t === "" || t === "Z") return 0;
  const m = /^([+-]?)(\d{1,2})(?::(\d{2}))?$/.exec(t);
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const h = parseInt(m[2], 10);
  const min = m[3] ? parseInt(m[3], 10) : 0;
  if (h > 14 || min > 59) return null;
  return sign * (h * 60 + min);
}

/** Format the local date+time in a zone at a given instant, ISO-like "YYYY-MM-DD HH:MM:SS". */
export function formatZoneTime(ianaZone: string, date: Date = new Date()): string {
  const p = getZoneParts(date, ianaZone);
  const yStr = String(p.year).padStart(4, "0");
  const mStr = String(p.month).padStart(2, "0");
  const dStr = String(p.day).padStart(2, "0");
  const hStr = String(p.hour).padStart(2, "0");
  const miStr = String(p.minute).padStart(2, "0");
  const sStr = String(p.second).padStart(2, "0");
  return `${yStr}-${mStr}-${dStr} ${hStr}:${miStr}:${sStr}`;
}

/** Format the local date only in a zone at a given instant, "YYYY-MM-DD". */
export function formatZoneDate(ianaZone: string, date: Date = new Date()): string {
  const p = getZoneParts(date, ianaZone);
  return `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Enrich zones with live offsets
// ---------------------------------------------------------------------------

/** Compute the full ZoneWithOffset for a ZoneEntry at a given instant. */
export function enrichZone(entry: ZoneEntry, date: Date = new Date()): ZoneWithOffset {
  const { standardOffsetMinutes, dstOffsetMinutes, observesDst } = getStandardAndDstOffsets(entry.ianaZone, date);
  const currentOffsetMinutes = getOffsetMinutes(entry.ianaZone, date);
  const dstActive = observesDst && currentOffsetMinutes !== standardOffsetMinutes;
  return {
    ...entry,
    standardOffsetMinutes,
    dstOffsetMinutes,
    observesDst,
    currentOffsetMinutes,
    dstActive,
    standardOffsetStr: formatOffset(standardOffsetMinutes),
    dstOffsetStr: formatOffset(dstOffsetMinutes),
    currentOffsetStr: formatOffset(currentOffsetMinutes),
    currentTimeStr: formatZoneTime(entry.ianaZone, date),
    currentDateStr: formatZoneDate(entry.ianaZone, date),
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

function entryMatchesQuery(entry: ZoneEntry, q: string, field: SearchField | "any"): boolean {
  if (field === "any") {
    return (
      entry.abbr.toUpperCase().includes(q) ||
      entry.fullName.toLowerCase().includes(q) ||
      entry.ianaZone.toLowerCase().includes(q) ||
      entry.exampleCity.toLowerCase().includes(q) ||
      entry.region.toLowerCase().includes(q)
    );
  }
  if (field === "abbr") return entry.abbr.toUpperCase().includes(q);
  if (field === "fullName") return entry.fullName.toLowerCase().includes(q);
  if (field === "ianaZone") return entry.ianaZone.toLowerCase().includes(q);
  if (field === "exampleCity") return entry.exampleCity.toLowerCase().includes(q);
  return false;
}

/**
 * Search the zone database. When `field === "offset"`, the query is parsed
 * as a numeric UTC offset (e.g. "+5:30") and matched against each zone's
 * standard OR dst offset.
 */
export function search(params: SearchParams, date: Date = new Date()): SearchResult {
  const qRaw = (params.query ?? "").trim();
  const field: SearchField | "any" = params.field ?? "any";
  const limit = params.limit ?? 1000;
  // Offset field handling.
  if (field === "offset") {
    const offsetMin = parseOffset(qRaw);
    if (offsetMin === null) {
      return { rows: [], total: 0, distinctAbbrs: [], ambiguous: false };
    }
    const matching: ZoneWithOffset[] = [];
    const seenZones = new Set<string>();
    for (const entry of ZONE_ENTRIES) {
      if (seenZones.has(entry.ianaZone)) continue;
      seenZones.add(entry.ianaZone);
      const enriched = enrichZone(entry, date);
      if (enriched.standardOffsetMinutes === offsetMin || enriched.dstOffsetMinutes === offsetMin) {
        matching.push(enriched);
      }
    }
    matching.sort((a, b) => a.standardOffsetMinutes - b.standardOffsetMinutes || a.abbr.localeCompare(b.abbr));
    const distinctAbbrs = Array.from(new Set(matching.map((m) => m.abbr))).sort();
    return {
      rows: matching.slice(0, limit),
      total: matching.length,
      distinctAbbrs,
      ambiguous: false,
    };
  }

  const qUpper = qRaw.toUpperCase();
  const qLower = qRaw.toLowerCase();
  const q = field === "abbr" ? qUpper : qLower;

  // Exact-match on abbreviation first (case-insensitive): if the query equals
  // an abbreviation, return ALL zones with that abbreviation (disambiguation).
  let baseMatches: ZoneEntry[];
  if ((field === "any" || field === "abbr") && qRaw.length > 0) {
    const exactAbbr = ZONE_ENTRIES.filter((e) => e.abbr.toUpperCase() === qUpper);
    if (exactAbbr.length > 0) {
      baseMatches = exactAbbr;
    } else {
      baseMatches = ZONE_ENTRIES.filter((e) => entryMatchesQuery(e, q, field));
    }
  } else {
    baseMatches = ZONE_ENTRIES.filter((e) => entryMatchesQuery(e, q, field));
  }

  // Deduplicate by IANA zone id (prefer first occurrence).
  const seenZones = new Set<string>();
  const deduped: ZoneEntry[] = [];
  for (const e of baseMatches) {
    if (!seenZones.has(e.ianaZone)) {
      seenZones.add(e.ianaZone);
      deduped.push(e);
    }
  }

  let withOffsets = deduped.map((e) => enrichZone(e, date));

  // Optional offset filter (numeric minutes) for non-"offset" field searches.
  if (params.offsetMinutes !== null && params.offsetMinutes !== undefined) {
    const target = params.offsetMinutes;
    withOffsets = withOffsets.filter(
      (z) => z.standardOffsetMinutes === target || z.dstOffsetMinutes === target,
    );
  }

  withOffsets.sort((a, b) => {
    if (a.abbr !== b.abbr) return a.abbr.localeCompare(b.abbr);
    return a.standardOffsetMinutes - b.standardOffsetMinutes;
  });

  const distinctAbbrs = Array.from(new Set(withOffsets.map((m) => m.abbr))).sort();
  const ambiguous = distinctAbbrs.length === 1 && withOffsets.length > 1;

  return {
    rows: withOffsets.slice(0, limit),
    total: withOffsets.length,
    distinctAbbrs,
    ambiguous,
  };
}

// ---------------------------------------------------------------------------
// Disambiguation helpers
// ---------------------------------------------------------------------------

/** Get all candidate zones for a given abbreviation (case-insensitive). */
export function disambiguate(abbr: string): AmbiguityInfo | null {
  const a = abbr.trim().toUpperCase();
  if (!a) return null;
  const candidates = ZONE_ENTRIES.filter((e) => e.abbr.toUpperCase() === a);
  if (candidates.length === 0) return null;
  const seenZones = new Set<string>();
  const uniqueCandidates: ZoneEntry[] = [];
  for (const c of candidates) {
    if (!seenZones.has(c.ianaZone)) {
      seenZones.add(c.ianaZone);
      uniqueCandidates.push(c);
    }
  }
  return {
    abbr: a,
    candidates: uniqueCandidates,
    regions: Array.from(new Set(uniqueCandidates.map((c) => c.region))),
    distinctOffsets: [], // Offsets are computed at runtime; left empty here.
  };
}

/** List all known abbreviations (distinct, sorted). */
export function allAbbreviations(): string[] {
  const set = new Set<string>();
  for (const e of ZONE_ENTRIES) set.add(e.abbr);
  return Array.from(set).sort();
}

/** List all known IANA zones covered (distinct, sorted). */
export function allIanaZones(): string[] {
  const set = new Set<string>();
  for (const e of ZONE_ENTRIES) set.add(e.ianaZone);
  return Array.from(set).sort();
}

/** List all regions (distinct, sorted). */
export function allRegions(): string[] {
  const set = new Set<string>();
  for (const e of ZONE_ENTRIES) set.add(e.region);
  return Array.from(set).sort();
}

/** Commonly-cited ambiguous abbreviations (those with 2+ candidate zones). */
export function ambiguousAbbreviations(): { abbr: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const e of ZONE_ENTRIES) {
    counts[e.abbr] = (counts[e.abbr] ?? 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, c]) => c >= 2)
    .map(([abbr, count]) => ({ abbr, count }))
    .sort((a, b) => b.count - a.count || a.abbr.localeCompare(b.abbr));
}

// ---------------------------------------------------------------------------
// "Now in this zone" — instant readout
// ---------------------------------------------------------------------------

export interface NowInZone {
  ianaZone: string;
  abbr: string;
  dateStr: string;
  timeStr: string;
  offsetStr: string;
  dstActive: boolean;
}

export function nowInZone(ianaZone: string, date: Date = new Date()): NowInZone | null {
  // Find a matching entry to grab a friendly abbreviation.
  const entry = ZONE_ENTRIES.find((e) => e.ianaZone === ianaZone);
  const offset = getOffsetMinutes(ianaZone, date);
  const { observesDst, standardOffsetMinutes } = getStandardAndDstOffsets(ianaZone, date);
  const dstActive = observesDst && offset !== standardOffsetMinutes;
  return {
    ianaZone,
    abbr: entry?.abbr ?? "",
    dateStr: formatZoneDate(ianaZone, date),
    timeStr: formatZoneTime(ianaZone, date),
    offsetStr: formatOffset(offset),
    dstActive,
  };
}

// ---------------------------------------------------------------------------
// Recently changed zones (manual reference list, indicative)
// ---------------------------------------------------------------------------

export const RECENTLY_CHANGED_ZONES: ReadonlyArray<{ ianaZone: string; change: string; year: number }> = [
  { ianaZone: "America/Ciudad_Juarez", change: "Split from America/Ojinaga; Mountain Time with US DST rules.", year: 2022 },
  { ianaZone: "Pacific/Kanton", change: "Renamed from Pacific/Enderbury; UTC+13.", year: 2022 },
  { ianaZone: "Asia/Qostanay", change: "Split from Asia/Qyzylorda for distinct Qostanay timezone rules.", year: 2022 },
  { ianaZone: "Asia/Gaza", change: "Palestinian Authority ended permanent DST; reverted to standard DST rules.", year: 2022 },
  { ianaZone: "Asia/Hebron", change: "Same as Gaza: Palestinian Authority reverted DST changes.", year: 2022 },
  { ianaZone: "Asia/Tehran", change: "Iran abolished DST from 2022-09-22; stays at UTC+3:30 year-round.", year: 2022 },
  { ianaZone: "Pacific/Chatham", change: "Chatham Islands observes DST UTC+13:45 / standard UTC+12:45.", year: 2023 },
  { ianaZone: "America/Nuuk", change: "Greenland (Nuuk) switched to permanent DST (UTC-2) from 2023-03-25.", year: 2023 },
  { ianaZone: "America/Mexico_City", change: "Most of Mexico abolished DST from 2022-10-30 (except border municipalities).", year: 2022 },
  { ianaZone: "Asia/Pyongyang", change: "North Korea reverted to UTC+9 (KST) from 2018-05-05.", year: 2018 },
];

// ---------------------------------------------------------------------------
// History (localStorage, max 20)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:time-zone-abbreviation-utc-offset-reference:history";
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

export function buildShareUrl(query: string, field: SearchField | "any", offsetMinutes: number | null): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (field !== "any") params.set("f", field);
  if (offsetMinutes !== null) params.set("off", String(offsetMinutes));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ShareParams {
  query: string;
  field: SearchField | "any";
  offsetMinutes: number | null;
}

export function parseShareUrl(hash: string): ShareParams {
  let clean = hash;
  if (clean.startsWith("#")) clean = clean.slice(1);
  if (clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) return { query: "", field: "any", offsetMinutes: null };
  const params = new URLSearchParams(clean);
  const validFields: (SearchField | "any")[] = ["any", "abbr", "fullName", "ianaZone", "exampleCity", "offset"];
  const fStr = params.get("f");
  const field: SearchField | "any" = fStr && validFields.includes(fStr as SearchField | "any")
    ? (fStr as SearchField | "any")
    : "any";
  const offStr = params.get("off");
  let offsetMinutes: number | null = null;
  if (offStr) {
    const n = parseInt(offStr, 10);
    if (!Number.isNaN(n)) offsetMinutes = n;
  }
  return {
    query: params.get("q") ?? "",
    field,
    offsetMinutes,
  };
}
