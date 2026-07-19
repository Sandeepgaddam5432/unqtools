/**
 * Geography Quiz Maker — pure logic.
 *
 * Built-in country database + question generator, distractor generator,
 * answer validator, score calculator, renderers (text/HTML/CSV),
 * history (localStorage), shareable URL. Pure functions only.
 */

export type Continent =
  | "africa"
  | "asia"
  | "europe"
  | "north-america"
  | "south-america"
  | "oceania"
  | "antarctica";

export type Topic =
  | "capitals"
  | "currencies"
  | "languages"
  | "continents"
  | "populations"
  | "flags-description";

export type Region =
  | "world"
  | "africa"
  | "asia"
  | "europe"
  | "north-america"
  | "south-america"
  | "oceania"
  | "antarctica";

export type Difficulty = "easy" | "medium" | "hard";

export type QuestionType = "multiple-choice" | "type-answer";

export interface Country {
  code: string;
  name: string;
  capital: string;
  currency: string;
  language: string;
  continent: Continent;
  population: number; // millions
  flagDesc: string;
  fame: 1 | 2 | 3;
}

export const TOPIC_LABELS: Record<Topic, string> = {
  "capitals": "Capitals",
  "currencies": "Currencies",
  "languages": "Languages",
  "continents": "Continents",
  "populations": "Populations",
  "flags-description": "Flag Descriptions",
};

export const REGION_LABELS: Record<Region, string> = {
  "world": "World (all continents)",
  "africa": "Africa",
  "asia": "Asia",
  "europe": "Europe",
  "north-america": "North America",
  "south-america": "South America",
  "oceania": "Oceania",
  "antarctica": "Antarctica",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  "easy": "Easy (well-known)",
  "medium": "Medium (mid-fame)",
  "hard": "Hard (obscure)",
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  "multiple-choice": "Multiple choice",
  "type-answer": "Type answer",
};

export const CONTINENT_LABELS: Record<Continent, string> = {
  "africa": "Africa",
  "asia": "Asia",
  "europe": "Europe",
  "north-america": "North America",
  "south-america": "South America",
  "oceania": "Oceania",
  "antarctica": "Antarctica",
};

// ---------------- Country database ----------------
// 150+ countries spanning all 6 inhabited continents.
// Population in millions (approximate). Fame: 1=well-known, 3=obscure.

export const COUNTRY_DB: Country[] = [
  // ---- Africa (33) ----
  { code: "DZ", name: "Algeria", capital: "Algiers", currency: "DZD", language: "Arabic", continent: "africa", population: 44, flagDesc: "Green and white vertical bands with a red crescent and star", fame: 2 },
  { code: "AO", name: "Angola", capital: "Luanda", currency: "AOA", language: "Portuguese", continent: "africa", population: 33, flagDesc: "Two horizontal bands of red and black with a yellow emblem", fame: 3 },
  { code: "BJ", name: "Benin", capital: "Porto-Novo", currency: "XOF", language: "French", continent: "africa", population: 12, flagDesc: "Green vertical band; yellow and red horizontal bands", fame: 3 },
  { code: "BW", name: "Botswana", capital: "Gaborone", currency: "BWP", language: "English", continent: "africa", population: 2, flagDesc: "Light blue with a black horizontal stripe through the center", fame: 2 },
  { code: "BF", name: "Burkina Faso", capital: "Ouagadougou", currency: "XOF", language: "French", continent: "africa", population: 21, flagDesc: "Red, green, and yellow horizontal bands with a yellow star", fame: 3 },
  { code: "CM", name: "Cameroon", capital: "Yaoundé", currency: "XAF", language: "French", continent: "africa", population: 26, flagDesc: "Green, red, and yellow vertical bands with a yellow star", fame: 2 },
  { code: "TD", name: "Chad", capital: "N'Djamena", currency: "XAF", language: "French", continent: "africa", population: 16, flagDesc: "Blue, yellow, and red vertical bands", fame: 3 },
  { code: "EG", name: "Egypt", capital: "Cairo", currency: "EGP", language: "Arabic", continent: "africa", population: 102, flagDesc: "Red, white, and black horizontal bands with a gold eagle", fame: 1 },
  { code: "ET", name: "Ethiopia", capital: "Addis Ababa", currency: "ETB", language: "Amharic", continent: "africa", population: 115, flagDesc: "Green, yellow, and red horizontal bands with a blue disc and star", fame: 1 },
  { code: "GA", name: "Gabon", capital: "Libreville", currency: "XAF", language: "French", continent: "africa", population: 2, flagDesc: "Green, yellow, and blue horizontal bands", fame: 3 },
  { code: "GM", name: "Gambia", capital: "Banjul", currency: "GMD", language: "English", continent: "africa", population: 2, flagDesc: "Red, blue, and green horizontal bands separated by white", fame: 3 },
  { code: "GH", name: "Ghana", capital: "Accra", currency: "GHS", language: "English", continent: "africa", population: 31, flagDesc: "Red, yellow, and green horizontal bands with a black star", fame: 2 },
  { code: "KE", name: "Kenya", capital: "Nairobi", currency: "KES", language: "Swahili", continent: "africa", population: 53, flagDesc: "Black, red, and green horizontal bands with a Maasai shield", fame: 1 },
  { code: "LR", name: "Liberia", capital: "Monrovia", currency: "LRD", language: "English", continent: "africa", population: 5, flagDesc: "Red and white stripes with a blue canton and white star", fame: 2 },
  { code: "LY", name: "Libya", capital: "Tripoli", currency: "LYD", language: "Arabic", continent: "africa", population: 7, flagDesc: "Red, black, and green horizontal bands with crescent and star", fame: 2 },
  { code: "MG", name: "Madagascar", capital: "Antananarivo", currency: "MGA", language: "Malagasy", continent: "africa", population: 27, flagDesc: "White vertical band; red and green horizontal bands", fame: 2 },
  { code: "MW", name: "Malawi", capital: "Lilongwe", currency: "MWK", language: "English", continent: "africa", population: 19, flagDesc: "Black, red, and green horizontal bands with a red sun", fame: 3 },
  { code: "ML", name: "Mali", capital: "Bamako", currency: "XOF", language: "French", continent: "africa", population: 20, flagDesc: "Green, yellow, and red vertical bands", fame: 3 },
  { code: "MA", name: "Morocco", capital: "Rabat", currency: "MAD", language: "Arabic", continent: "africa", population: 37, flagDesc: "Red field with a green five-point star", fame: 1 },
  { code: "MZ", name: "Mozambique", capital: "Maputo", currency: "MZN", language: "Portuguese", continent: "africa", population: 31, flagDesc: "Teal, black, yellow, and green bands with a rifle and book", fame: 3 },
  { code: "NA", name: "Namibia", capital: "Windhoek", currency: "NAD", language: "English", continent: "africa", population: 2, flagDesc: "Blue band with sun; red, white, and green diagonal bands", fame: 2 },
  { code: "NE", name: "Niger", capital: "Niamey", currency: "XOF", language: "French", continent: "africa", population: 24, flagDesc: "Orange, white, and green horizontal bands with an orange disc", fame: 3 },
  { code: "NG", name: "Nigeria", capital: "Abuja", currency: "NGN", language: "English", continent: "africa", population: 211, flagDesc: "Green, white, and green vertical bands", fame: 1 },
  { code: "RW", name: "Rwanda", capital: "Kigali", currency: "RWF", language: "Kinyarwanda", continent: "africa", population: 13, flagDesc: "Blue, yellow, and green horizontal bands with a sun", fame: 2 },
  { code: "SN", name: "Senegal", capital: "Dakar", currency: "XOF", language: "French", continent: "africa", population: 16, flagDesc: "Green, yellow, and red vertical bands with a green star", fame: 2 },
  { code: "SO", name: "Somalia", capital: "Mogadishu", currency: "SOS", language: "Somali", continent: "africa", population: 16, flagDesc: "Light blue field with a white five-point star", fame: 2 },
  { code: "ZA", name: "South Africa", capital: "Pretoria", currency: "ZAR", language: "English", continent: "africa", population: 60, flagDesc: "Red, white, and green Y-shape on blue and black fields", fame: 1 },
  { code: "SD", name: "Sudan", capital: "Khartoum", currency: "SDG", language: "Arabic", continent: "africa", population: 44, flagDesc: "Red, white, and black horizontal bands with a green triangle", fame: 2 },
  { code: "TZ", name: "Tanzania", capital: "Dodoma", currency: "TZS", language: "Swahili", continent: "africa", population: 60, flagDesc: "Diagonal green, yellow, black, and blue bands", fame: 2 },
  { code: "TN", name: "Tunisia", capital: "Tunis", currency: "TND", language: "Arabic", continent: "africa", population: 12, flagDesc: "Red field with a white disc, crescent, and star", fame: 2 },
  { code: "UG", name: "Uganda", capital: "Kampala", currency: "UGX", language: "English", continent: "africa", population: 46, flagDesc: "Black, yellow, and red horizontal bands with a grey crowned crane", fame: 2 },
  { code: "ZM", name: "Zambia", capital: "Lusaka", currency: "ZMW", language: "English", continent: "africa", population: 18, flagDesc: "Green field with orange eagle and red, black, orange vertical bands", fame: 3 },
  { code: "ZW", name: "Zimbabwe", capital: "Harare", currency: "ZWL", language: "English", continent: "africa", population: 15, flagDesc: "Green, yellow, red, black, and red horizontal bands with a soapstone bird", fame: 2 },

  // ---- Asia (35) ----
  { code: "AF", name: "Afghanistan", capital: "Kabul", currency: "AFN", language: "Dari", continent: "asia", population: 39, flagDesc: "Black, red, and green vertical bands with the national emblem", fame: 1 },
  { code: "AM", name: "Armenia", capital: "Yerevan", currency: "AMD", language: "Armenian", continent: "asia", population: 3, flagDesc: "Red, blue, and orange horizontal bands", fame: 3 },
  { code: "AZ", name: "Azerbaijan", capital: "Baku", currency: "AZN", language: "Azerbaijani", continent: "asia", population: 10, flagDesc: "Blue, red, and green horizontal bands with a white crescent and star", fame: 3 },
  { code: "BH", name: "Bahrain", capital: "Manama", currency: "BHD", language: "Arabic", continent: "asia", population: 1, flagDesc: "White and red bands separated by a serrated edge", fame: 3 },
  { code: "BD", name: "Bangladesh", capital: "Dhaka", currency: "BDT", language: "Bengali", continent: "asia", population: 166, flagDesc: "Green field with a red disc offset toward the hoist", fame: 2 },
  { code: "BT", name: "Bhutan", capital: "Thimphu", currency: "BTN", language: "Dzongkha", continent: "asia", population: 1, flagDesc: "Yellow and orange diagonal bands with a white dragon", fame: 3 },
  { code: "BN", name: "Brunei", capital: "Bandar Seri Begawan", currency: "BND", language: "Malay", continent: "asia", population: 1, flagDesc: "Yellow field with diagonal black and white bands and a crest", fame: 3 },
  { code: "KH", name: "Cambodia", capital: "Phnom Penh", currency: "KHR", language: "Khmer", continent: "asia", population: 16, flagDesc: "Blue, red, and blue horizontal bands with Angkor Wat in white", fame: 2 },
  { code: "CN", name: "China", capital: "Beijing", currency: "CNY", language: "Mandarin", continent: "asia", population: 1412, flagDesc: "Red field with five yellow stars in the canton", fame: 1 },
  { code: "CY", name: "Cyprus", capital: "Nicosia", currency: "EUR", language: "Greek", continent: "asia", population: 1, flagDesc: "White field with a copper silhouette of the island and two olive branches", fame: 2 },
  { code: "GE", name: "Georgia", capital: "Tbilisi", currency: "GEL", language: "Georgian", continent: "asia", population: 4, flagDesc: "White field with a red cross and four small red crosses", fame: 3 },
  { code: "IN", name: "India", capital: "New Delhi", currency: "INR", language: "Hindi", continent: "asia", population: 1380, flagDesc: "Saffron, white, and green horizontal bands with a blue chakra", fame: 1 },
  { code: "ID", name: "Indonesia", capital: "Jakarta", currency: "IDR", language: "Indonesian", continent: "asia", population: 273, flagDesc: "Red and white horizontal bands", fame: 1 },
  { code: "IR", name: "Iran", capital: "Tehran", currency: "IRR", language: "Persian", continent: "asia", population: 84, flagDesc: "Green, white, and red horizontal bands with a red emblem", fame: 1 },
  { code: "IQ", name: "Iraq", capital: "Baghdad", currency: "IQD", language: "Arabic", continent: "asia", population: 40, flagDesc: "Red, white, and black horizontal bands with green Arabic text", fame: 1 },
  { code: "IL", name: "Israel", capital: "Jerusalem", currency: "ILS", language: "Hebrew", continent: "asia", population: 9, flagDesc: "White field with two blue horizontal bands and a blue Star of David", fame: 1 },
  { code: "JP", name: "Japan", capital: "Tokyo", currency: "JPY", language: "Japanese", continent: "asia", population: 126, flagDesc: "White field with a large red disc in the center", fame: 1 },
  { code: "JO", name: "Jordan", capital: "Amman", currency: "JOD", language: "Arabic", continent: "asia", population: 10, flagDesc: "Black, white, and green horizontal bands with a red chevron and star", fame: 2 },
  { code: "KZ", name: "Kazakhstan", capital: "Astana", currency: "KZT", language: "Kazakh", continent: "asia", population: 19, flagDesc: "Light blue field with a yellow sun and eagle and a national pattern", fame: 3 },
  { code: "KW", name: "Kuwait", capital: "Kuwait City", currency: "KWD", language: "Arabic", continent: "asia", population: 4, flagDesc: "Green, white, and red horizontal bands with a black trapezoid", fame: 2 },
  { code: "KG", name: "Kyrgyzstan", capital: "Bishkek", currency: "KGS", language: "Kyrgyz", continent: "asia", population: 6, flagDesc: "Red field with a yellow sun and a yurt-style tympanum", fame: 3 },
  { code: "LA", name: "Laos", capital: "Vientiane", currency: "LAK", language: "Lao", continent: "asia", population: 7, flagDesc: "Red, blue, and red horizontal bands with a white disc", fame: 3 },
  { code: "LB", name: "Lebanon", capital: "Beirut", currency: "LBP", language: "Arabic", continent: "asia", population: 7, flagDesc: "Red, white, and red horizontal bands with a green cedar", fame: 2 },
  { code: "MY", name: "Malaysia", capital: "Kuala Lumpur", currency: "MYR", language: "Malay", continent: "asia", population: 32, flagDesc: "Red and white stripes with a blue canton, crescent, and 14-point star", fame: 2 },
  { code: "MV", name: "Maldives", capital: "Malé", currency: "MVR", language: "Dhivehi", continent: "asia", population: 1, flagDesc: "Red field with a green rectangle and white crescent", fame: 3 },
  { code: "MN", name: "Mongolia", capital: "Ulaanbaatar", currency: "MNT", language: "Mongolian", continent: "asia", population: 3, flagDesc: "Red, blue, and red vertical bands with the Soyombo symbol", fame: 2 },
  { code: "MM", name: "Myanmar", capital: "Naypyidaw", currency: "MMK", language: "Burmese", continent: "asia", population: 54, flagDesc: "Yellow, green, and red horizontal bands with a large white star", fame: 2 },
  { code: "NP", name: "Nepal", capital: "Kathmandu", currency: "NPR", language: "Nepali", continent: "asia", population: 29, flagDesc: "Two stacked red pennons with blue borders and a white moon and sun", fame: 2 },
  { code: "KP", name: "North Korea", capital: "Pyongyang", currency: "KPW", language: "Korean", continent: "asia", population: 26, flagDesc: "Blue, white, and red horizontal bands with a red star in a white disc", fame: 1 },
  { code: "OM", name: "Oman", capital: "Muscat", currency: "OMR", language: "Arabic", continent: "asia", population: 5, flagDesc: "White, red, and green horizontal bands with a national emblem", fame: 3 },
  { code: "PK", name: "Pakistan", capital: "Islamabad", currency: "PKR", language: "Urdu", continent: "asia", population: 220, flagDesc: "Green and white vertical bands with a white crescent and star", fame: 1 },
  { code: "PH", name: "Philippines", capital: "Manila", currency: "PHP", language: "Filipino", continent: "asia", population: 109, flagDesc: "Blue, red, and white with a yellow sun and three stars", fame: 2 },
  { code: "QA", name: "Qatar", capital: "Doha", currency: "QAR", language: "Arabic", continent: "asia", population: 3, flagDesc: "White and maroon bands separated by a serrated edge", fame: 2 },
  { code: "SA", name: "Saudi Arabia", capital: "Riyadh", currency: "SAR", language: "Arabic", continent: "asia", population: 35, flagDesc: "Green field with white Arabic shahada and a sword", fame: 1 },
  { code: "SG", name: "Singapore", capital: "Singapore", currency: "SGD", language: "English", continent: "asia", population: 6, flagDesc: "Red and white horizontal bands with a white crescent and five stars", fame: 1 },
  { code: "KR", name: "South Korea", capital: "Seoul", currency: "KRW", language: "Korean", continent: "asia", population: 51, flagDesc: "White field with a red and blue taegeuk and four black trigrams", fame: 1 },
  { code: "LK", name: "Sri Lanka", capital: "Sri Jayawardenepura Kotte", currency: "LKR", language: "Sinhala", continent: "asia", population: 21, flagDesc: "Green, orange, and yellow fields with a lion holding a sword", fame: 2 },
  { code: "SY", name: "Syria", capital: "Damascus", currency: "SYP", language: "Arabic", continent: "asia", population: 17, flagDesc: "Red, white, and black horizontal bands with two green stars", fame: 2 },
  { code: "TH", name: "Thailand", capital: "Bangkok", currency: "THB", language: "Thai", continent: "asia", population: 70, flagDesc: "Red, white, blue, white, and red horizontal bands", fame: 1 },
  { code: "TR", name: "Turkey", capital: "Ankara", currency: "TRY", language: "Turkish", continent: "asia", population: 84, flagDesc: "Red field with a white crescent and star", fame: 1 },
  { code: "AE", name: "United Arab Emirates", capital: "Abu Dhabi", currency: "AED", language: "Arabic", continent: "asia", population: 10, flagDesc: "Red, green, white, and black horizontal bands", fame: 1 },
  { code: "UZ", name: "Uzbekistan", capital: "Tashkent", currency: "UZS", language: "Uzbek", continent: "asia", population: 34, flagDesc: "Blue, white, and green horizontal bands with red fimbriation and crescent", fame: 3 },
  { code: "VN", name: "Vietnam", capital: "Hanoi", currency: "VND", language: "Vietnamese", continent: "asia", population: 97, flagDesc: "Red field with a large yellow five-point star", fame: 1 },
  { code: "YE", name: "Yemen", capital: "Sana'a", currency: "YER", language: "Arabic", continent: "asia", population: 30, flagDesc: "Red, white, and black horizontal bands", fame: 2 },

  // ---- Europe (38) ----
  { code: "AL", name: "Albania", capital: "Tirana", currency: "ALL", language: "Albanian", continent: "europe", population: 3, flagDesc: "Red field with a black double-headed eagle", fame: 3 },
  { code: "AD", name: "Andorra", capital: "Andorra la Vella", currency: "EUR", language: "Catalan", continent: "europe", population: 0, flagDesc: "Blue, yellow, and red vertical bands with a coat of arms", fame: 3 },
  { code: "AT", name: "Austria", capital: "Vienna", currency: "EUR", language: "German", continent: "europe", population: 9, flagDesc: "Red, white, and red horizontal bands", fame: 2 },
  { code: "BY", name: "Belarus", capital: "Minsk", currency: "BYN", language: "Belarusian", continent: "europe", population: 9, flagDesc: "Red and green horizontal bands with a white-red pattern", fame: 3 },
  { code: "BE", name: "Belgium", capital: "Brussels", currency: "EUR", language: "Dutch", continent: "europe", population: 11, flagDesc: "Black, yellow, and red vertical bands", fame: 1 },
  { code: "BA", name: "Bosnia and Herzegovina", capital: "Sarajevo", currency: "BAM", language: "Bosnian", continent: "europe", population: 3, flagDesc: "Blue field with a yellow triangle and white stars", fame: 3 },
  { code: "BG", name: "Bulgaria", capital: "Sofia", currency: "BGN", language: "Bulgarian", continent: "europe", population: 7, flagDesc: "White, green, and red horizontal bands", fame: 2 },
  { code: "HR", name: "Croatia", capital: "Zagreb", currency: "EUR", language: "Croatian", continent: "europe", population: 4, flagDesc: "Red, white, and blue horizontal bands with a checkerboard shield", fame: 2 },
  { code: "CZ", name: "Czech Republic", capital: "Prague", currency: "CZK", language: "Czech", continent: "europe", population: 11, flagDesc: "White and red horizontal bands with a blue triangle at the hoist", fame: 2 },
  { code: "DK", name: "Denmark", capital: "Copenhagen", currency: "DKK", language: "Danish", continent: "europe", population: 6, flagDesc: "Red field with a white Scandinavian cross", fame: 1 },
  { code: "EE", name: "Estonia", capital: "Tallinn", currency: "EUR", language: "Estonian", continent: "europe", population: 1, flagDesc: "Blue, black, and white horizontal bands", fame: 3 },
  { code: "FI", name: "Finland", capital: "Helsinki", currency: "EUR", language: "Finnish", continent: "europe", population: 5, flagDesc: "White field with a blue Scandinavian cross", fame: 1 },
  { code: "FR", name: "France", capital: "Paris", currency: "EUR", language: "French", continent: "europe", population: 67, flagDesc: "Blue, white, and red vertical bands", fame: 1 },
  { code: "DE", name: "Germany", capital: "Berlin", currency: "EUR", language: "German", continent: "europe", population: 83, flagDesc: "Black, red, and gold horizontal bands", fame: 1 },
  { code: "GR", name: "Greece", capital: "Athens", currency: "EUR", language: "Greek", continent: "europe", population: 11, flagDesc: "Blue and white horizontal bands with a white cross in the canton", fame: 1 },
  { code: "HU", name: "Hungary", capital: "Budapest", currency: "HUF", language: "Hungarian", continent: "europe", population: 10, flagDesc: "Red, white, and green horizontal bands", fame: 2 },
  { code: "IS", name: "Iceland", capital: "Reykjavik", currency: "ISK", language: "Icelandic", continent: "europe", population: 0, flagDesc: "Blue field with a white-edged red Scandinavian cross", fame: 1 },
  { code: "IE", name: "Ireland", capital: "Dublin", currency: "EUR", language: "English", continent: "europe", population: 5, flagDesc: "Green, white, and orange vertical bands", fame: 1 },
  { code: "IT", name: "Italy", capital: "Rome", currency: "EUR", language: "Italian", continent: "europe", population: 60, flagDesc: "Green, white, and red vertical bands", fame: 1 },
  { code: "XK", name: "Kosovo", capital: "Pristina", currency: "EUR", language: "Albanian", continent: "europe", population: 2, flagDesc: "Blue field with a yellow map of Kosovo and six white stars", fame: 3 },
  { code: "LV", name: "Latvia", capital: "Riga", currency: "EUR", language: "Latvian", continent: "europe", population: 2, flagDesc: "Maroon and white horizontal bands (maroon on top, narrow white)", fame: 3 },
  { code: "LI", name: "Liechtenstein", capital: "Vaduz", currency: "CHF", language: "German", continent: "europe", population: 0, flagDesc: "Blue and red horizontal bands with a gold crown", fame: 3 },
  { code: "LT", name: "Lithuania", capital: "Vilnius", currency: "EUR", language: "Lithuanian", continent: "europe", population: 3, flagDesc: "Yellow, green, and red horizontal bands", fame: 3 },
  { code: "LU", name: "Luxembourg", capital: "Luxembourg", currency: "EUR", language: "Luxembourgish", continent: "europe", population: 1, flagDesc: "Red, white, and light blue horizontal bands", fame: 3 },
  { code: "MT", name: "Malta", capital: "Valletta", currency: "EUR", language: "Maltese", continent: "europe", population: 1, flagDesc: "White and red vertical bands with a George Cross in the canton", fame: 3 },
  { code: "MD", name: "Moldova", capital: "Chisinau", currency: "MDL", language: "Romanian", continent: "europe", population: 3, flagDesc: "Blue, yellow, and red vertical bands with a national coat of arms", fame: 3 },
  { code: "MC", name: "Monaco", capital: "Monaco", currency: "EUR", language: "French", continent: "europe", population: 0, flagDesc: "Red and white horizontal bands", fame: 3 },
  { code: "ME", name: "Montenegro", capital: "Podgorica", currency: "EUR", language: "Montenegrin", continent: "europe", population: 1, flagDesc: "Red field with a gold border and the national coat of arms", fame: 3 },
  { code: "NL", name: "Netherlands", capital: "Amsterdam", currency: "EUR", language: "Dutch", continent: "europe", population: 17, flagDesc: "Red, white, and blue horizontal bands", fame: 1 },
  { code: "MK", name: "North Macedonia", capital: "Skopje", currency: "MKD", language: "Macedonian", continent: "europe", population: 2, flagDesc: "Red field with a yellow sun and eight rays", fame: 3 },
  { code: "NO", name: "Norway", capital: "Oslo", currency: "NOK", language: "Norwegian", continent: "europe", population: 5, flagDesc: "Red field with a blue Scandinavian cross fimbriated white", fame: 1 },
  { code: "PL", name: "Poland", capital: "Warsaw", currency: "PLN", language: "Polish", continent: "europe", population: 38, flagDesc: "White and red horizontal bands", fame: 1 },
  { code: "PT", name: "Portugal", capital: "Lisbon", currency: "EUR", language: "Portuguese", continent: "europe", population: 10, flagDesc: "Green and red vertical bands with an armillary sphere and shield", fame: 1 },
  { code: "RO", name: "Romania", capital: "Bucharest", currency: "RON", language: "Romanian", continent: "europe", population: 19, flagDesc: "Blue, yellow, and red vertical bands", fame: 2 },
  { code: "RU", name: "Russia", capital: "Moscow", currency: "RUB", language: "Russian", continent: "europe", population: 144, flagDesc: "White, blue, and red horizontal bands", fame: 1 },
  { code: "SM", name: "San Marino", capital: "San Marino", currency: "EUR", language: "Italian", continent: "europe", population: 0, flagDesc: "White and blue horizontal bands with a coat of arms", fame: 3 },
  { code: "RS", name: "Serbia", capital: "Belgrade", currency: "RSD", language: "Serbian", continent: "europe", population: 7, flagDesc: "Red, blue, and white horizontal bands with a shield", fame: 3 },
  { code: "SK", name: "Slovakia", capital: "Bratislava", currency: "EUR", language: "Slovak", continent: "europe", population: 5, flagDesc: "White, blue, and red horizontal bands with a shield", fame: 3 },
  { code: "SI", name: "Slovenia", capital: "Ljubljana", currency: "EUR", language: "Slovenian", continent: "europe", population: 2, flagDesc: "White, blue, and red horizontal bands with a coat of arms", fame: 3 },
  { code: "ES", name: "Spain", capital: "Madrid", currency: "EUR", language: "Spanish", continent: "europe", population: 47, flagDesc: "Red, yellow, and red horizontal bands with a coat of arms", fame: 1 },
  { code: "SE", name: "Sweden", capital: "Stockholm", currency: "SEK", language: "Swedish", continent: "europe", population: 10, flagDesc: "Blue field with a yellow Scandinavian cross", fame: 1 },
  { code: "CH", name: "Switzerland", capital: "Bern", currency: "CHF", language: "German", continent: "europe", population: 9, flagDesc: "Red square field with a white cross", fame: 1 },
  { code: "UA", name: "Ukraine", capital: "Kyiv", currency: "UAH", language: "Ukrainian", continent: "europe", population: 44, flagDesc: "Blue and yellow horizontal bands", fame: 1 },
  { code: "GB", name: "United Kingdom", capital: "London", currency: "GBP", language: "English", continent: "europe", population: 67, flagDesc: "Blue field with red and white crosses of St George, St Andrew, and St Patrick", fame: 1 },
  { code: "VA", name: "Vatican City", capital: "Vatican City", currency: "EUR", language: "Italian", continent: "europe", population: 0, flagDesc: "Yellow and white vertical bands with papal keys and tiara", fame: 2 },

  // ---- North America (23) ----
  { code: "AG", name: "Antigua and Barbuda", capital: "Saint John's", currency: "XCD", language: "English", continent: "north-america", population: 0, flagDesc: "Red, blue, and white with a rising sun and black V-shape", fame: 3 },
  { code: "BS", name: "Bahamas", capital: "Nassau", currency: "BSD", language: "English", continent: "north-america", population: 0, flagDesc: "Blue, yellow, and blue horizontal bands with a black triangle", fame: 2 },
  { code: "BB", name: "Barbados", capital: "Bridgetown", currency: "BBD", language: "English", continent: "north-america", population: 0, flagDesc: "Blue, yellow, and blue vertical bands with a black trident", fame: 2 },
  { code: "BZ", name: "Belize", capital: "Belmopan", currency: "BZD", language: "English", continent: "north-america", population: 0, flagDesc: "Blue, red, and blue horizontal bands with a white disc and coat of arms", fame: 3 },
  { code: "CA", name: "Canada", capital: "Ottawa", currency: "CAD", language: "English", continent: "north-america", population: 38, flagDesc: "Red and white vertical bands with a red maple leaf", fame: 1 },
  { code: "CR", name: "Costa Rica", capital: "San José", currency: "CRC", language: "Spanish", continent: "north-america", population: 5, flagDesc: "Blue, white, red, white, and blue horizontal bands", fame: 2 },
  { code: "CU", name: "Cuba", capital: "Havana", currency: "CUP", language: "Spanish", continent: "north-america", population: 11, flagDesc: "Blue and white stripes with a red triangle and white star", fame: 1 },
  { code: "DM", name: "Dominica", capital: "Roseau", currency: "XCD", language: "English", continent: "north-america", population: 0, flagDesc: "Green field with a cross of yellow, black, and white and a sisserou parrot", fame: 3 },
  { code: "DO", name: "Dominican Republic", capital: "Santo Domingo", currency: "DOP", language: "Spanish", continent: "north-america", population: 11, flagDesc: "Blue and red quarters with a white cross and coat of arms", fame: 2 },
  { code: "SV", name: "El Salvador", capital: "San Salvador", currency: "USD", language: "Spanish", continent: "north-america", population: 6, flagDesc: "Blue, white, and blue horizontal bands with a coat of arms", fame: 2 },
  { code: "GD", name: "Grenada", capital: "Saint George's", currency: "XCD", language: "English", continent: "north-america", population: 0, flagDesc: "Red, yellow, and green with a nutmeg and six stars", fame: 3 },
  { code: "GT", name: "Guatemala", capital: "Guatemala City", currency: "GTQ", language: "Spanish", continent: "north-america", population: 17, flagDesc: "Light blue, white, and light blue vertical bands with a coat of arms", fame: 2 },
  { code: "HT", name: "Haiti", capital: "Port-au-Prince", currency: "HTG", language: "French", continent: "north-america", population: 11, flagDesc: "Blue and red horizontal bands with a white square and coat of arms", fame: 2 },
  { code: "HN", name: "Honduras", capital: "Tegucigalpa", currency: "HNL", language: "Spanish", continent: "north-america", population: 10, flagDesc: "Blue, white, and blue horizontal bands with five blue stars", fame: 3 },
  { code: "JM", name: "Jamaica", capital: "Kingston", currency: "JMD", language: "English", continent: "north-america", population: 3, flagDesc: "Green, yellow, and green with a black saltire (diagonal cross)", fame: 1 },
  { code: "MX", name: "Mexico", capital: "Mexico City", currency: "MXN", language: "Spanish", continent: "north-america", population: 126, flagDesc: "Green, white, and red vertical bands with a coat of arms", fame: 1 },
  { code: "NI", name: "Nicaragua", capital: "Managua", currency: "NIO", language: "Spanish", continent: "north-america", population: 7, flagDesc: "Blue, white, and blue horizontal bands with a coat of arms", fame: 3 },
  { code: "PA", name: "Panama", capital: "Panama City", currency: "USD", language: "Spanish", continent: "north-america", population: 4, flagDesc: "White field with red and blue quarters and two stars", fame: 2 },
  { code: "KN", name: "Saint Kitts and Nevis", capital: "Basseterre", currency: "XCD", language: "English", continent: "north-america", population: 0, flagDesc: "Green, yellow, red, and black with two white stars on a diagonal", fame: 3 },
  { code: "LC", name: "Saint Lucia", capital: "Castries", currency: "XCD", language: "English", continent: "north-america", population: 0, flagDesc: "Blue field with a yellow, black, and white triangle", fame: 3 },
  { code: "VC", name: "Saint Vincent and the Grenadines", capital: "Kingstown", currency: "XCD", language: "English", continent: "north-america", population: 0, flagDesc: "Blue, yellow, and green vertical bands with three green diamonds", fame: 3 },
  { code: "TT", name: "Trinidad and Tobago", capital: "Port of Spain", currency: "TTD", language: "English", continent: "north-america", population: 1, flagDesc: "Red field with a black diagonal stripe edged in white", fame: 2 },
  { code: "US", name: "United States", capital: "Washington, D.C.", currency: "USD", language: "English", continent: "north-america", population: 331, flagDesc: "13 red and white stripes with a blue canton of 50 white stars", fame: 1 },

  // ---- South America (12) ----
  { code: "AR", name: "Argentina", capital: "Buenos Aires", currency: "ARS", language: "Spanish", continent: "south-america", population: 45, flagDesc: "Light blue, white, and light blue horizontal bands with a sun", fame: 1 },
  { code: "BO", name: "Bolivia", capital: "Sucre", currency: "BOB", language: "Spanish", continent: "south-america", population: 12, flagDesc: "Red, yellow, and green horizontal bands with a coat of arms", fame: 2 },
  { code: "BR", name: "Brazil", capital: "Brasília", currency: "BRL", language: "Portuguese", continent: "south-america", population: 213, flagDesc: "Green field with a yellow rhombus and a blue celestial sphere", fame: 1 },
  { code: "CL", name: "Chile", capital: "Santiago", currency: "CLP", language: "Spanish", continent: "south-america", population: 19, flagDesc: "White and red horizontal bands with a blue canton and white star", fame: 1 },
  { code: "CO", name: "Colombia", capital: "Bogotá", currency: "COP", language: "Spanish", continent: "south-america", population: 51, flagDesc: "Yellow, blue, and red horizontal bands (yellow is wider)", fame: 2 },
  { code: "EC", name: "Ecuador", capital: "Quito", currency: "USD", language: "Spanish", continent: "south-america", population: 18, flagDesc: "Yellow, blue, and red horizontal bands with a coat of arms", fame: 2 },
  { code: "GY", name: "Guyana", capital: "Georgetown", currency: "GYD", language: "English", continent: "south-america", population: 1, flagDesc: "Green field with a red triangle edged in black and yellow", fame: 3 },
  { code: "PY", name: "Paraguay", capital: "Asunción", currency: "PYG", language: "Spanish", continent: "south-america", population: 7, flagDesc: "Red, white, and blue horizontal bands with a coat of arms", fame: 3 },
  { code: "PE", name: "Peru", capital: "Lima", currency: "PEN", language: "Spanish", continent: "south-america", population: 33, flagDesc: "Red, white, and red vertical bands with a coat of arms", fame: 1 },
  { code: "SR", name: "Suriname", capital: "Paramaribo", currency: "SRD", language: "Dutch", continent: "south-america", population: 1, flagDesc: "Green, white, red, white, and green horizontal bands with a yellow star", fame: 3 },
  { code: "UY", name: "Uruguay", capital: "Montevideo", currency: "UYU", language: "Spanish", continent: "south-america", population: 3, flagDesc: "White field with nine blue and white stripes and a sun", fame: 2 },
  { code: "VE", name: "Venezuela", capital: "Caracas", currency: "VES", language: "Spanish", continent: "south-america", population: 28, flagDesc: "Yellow, blue, and red horizontal bands with eight stars in an arc", fame: 1 },

  // ---- Oceania (14) ----
  { code: "AU", name: "Australia", capital: "Canberra", currency: "AUD", language: "English", continent: "oceania", population: 26, flagDesc: "Blue field with Union Jack, Commonwealth Star, and Southern Cross", fame: 1 },
  { code: "FJ", name: "Fiji", capital: "Suva", currency: "FJD", language: "English", continent: "oceania", population: 1, flagDesc: "Light blue field with Union Jack and a shield", fame: 2 },
  { code: "KI", name: "Kiribati", capital: "Tarawa", currency: "AUD", language: "English", continent: "oceania", population: 0, flagDesc: "Red field with a yellow frigatebird over a rising sun on blue and white waves", fame: 3 },
  { code: "MH", name: "Marshall Islands", capital: "Majuro", currency: "USD", language: "English", continent: "oceania", population: 0, flagDesc: "Blue field with a stylized orange and white sunrise and a star", fame: 3 },
  { code: "FM", name: "Micronesia", capital: "Palikir", currency: "USD", language: "English", continent: "oceania", population: 0, flagDesc: "Light blue field with four white five-point stars", fame: 3 },
  { code: "NR", name: "Nauru", capital: "Yaren", currency: "AUD", language: "Nauruan", continent: "oceania", population: 0, flagDesc: "Blue field with a yellow horizontal stripe and a white star", fame: 3 },
  { code: "NZ", name: "New Zealand", capital: "Wellington", currency: "NZD", language: "English", continent: "oceania", population: 5, flagDesc: "Blue field with Union Jack and four red stars (Southern Cross)", fame: 1 },
  { code: "PW", name: "Palau", capital: "Ngerulmud", currency: "USD", language: "English", continent: "oceania", population: 0, flagDesc: "Light blue field with a yellow full disc offset toward the hoist", fame: 3 },
  { code: "PG", name: "Papua New Guinea", capital: "Port Moresby", currency: "PGK", language: "English", continent: "oceania", population: 9, flagDesc: "Red and black diagonal halves with a yellow bird of paradise and Southern Cross", fame: 3 },
  { code: "WS", name: "Samoa", capital: "Apia", currency: "WST", language: "Samoan", continent: "oceania", population: 0, flagDesc: "Red and blue field with a white canton of five white stars (Southern Cross)", fame: 3 },
  { code: "SB", name: "Solomon Islands", capital: "Honiara", currency: "SBD", language: "English", continent: "oceania", population: 1, flagDesc: "Blue, yellow, and green with five white stars", fame: 3 },
  { code: "TO", name: "Tonga", capital: "Nuku'alofa", currency: "TOP", language: "Tongan", continent: "oceania", population: 0, flagDesc: "Red field with a white canton and a red cross", fame: 3 },
  { code: "TV", name: "Tuvalu", capital: "Funafuti", currency: "AUD", language: "Tuvaluan", continent: "oceania", population: 0, flagDesc: "Light blue field with Union Jack and nine yellow stars", fame: 3 },
  { code: "VU", name: "Vanuatu", capital: "Port Vila", currency: "VUV", language: "Bislama", continent: "oceania", population: 0, flagDesc: "Red, black, and green horizontal bands with a yellow Y-shape and emblem", fame: 3 },
];

// ---------------- Filtering / lookup ----------------

export function filterByRegion(countries: Country[], region: Region): Country[] {
  if (region === "world") return [...countries];
  return countries.filter((c) => c.continent === region);
}

export function filterByDifficulty(countries: Country[], difficulty: Difficulty): Country[] {
  if (difficulty === "easy") return countries.filter((c) => c.fame === 1);
  if (difficulty === "medium") return countries.filter((c) => c.fame <= 2);
  return [...countries]; // hard = all
}

export function searchCountries(countries: Country[], query: string): Country[] {
  if (!query) return [...countries];
  const q = query.toLowerCase().trim();
  return countries.filter((c) =>
    c.name.toLowerCase().includes(q)
    || c.capital.toLowerCase().includes(q)
    || c.continent.includes(q)
    || c.language.toLowerCase().includes(q)
    || c.currency.toLowerCase().includes(q),
  );
}

export function getCountryByCode(code: string): Country | undefined {
  return COUNTRY_DB.find((c) => c.code === code.toUpperCase());
}

export function getCountryByName(name: string): Country | undefined {
  const n = name.toLowerCase().trim();
  return COUNTRY_DB.find((c) => c.name.toLowerCase() === n);
}

// ---------------- Random / shuffle ----------------

/** Mulberry32 seeded PRNG for deterministic question generation. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleWith<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function shuffle<T>(arr: T[]): T[] {
  return shuffleWith(arr, Math.random);
}

// ---------------- Question generation ----------------

export function getQuestionPrompt(country: Country, topic: Topic): string {
  switch (topic) {
    case "capitals": return `What is the capital of ${country.name}?`;
    case "currencies": return `What currency is used in ${country.name}?`;
    case "languages": return `What is the official language of ${country.name}?`;
    case "continents": return `On which continent is ${country.name} located?`;
    case "populations": return `What is the approximate population of ${country.name}?`;
    case "flags-description": return `Which country's flag is: "${country.flagDesc}"?`;
  }
}

export function getAnswer(country: Country, topic: Topic): string {
  if (topic === "flags-description") return country.name;
  switch (topic) {
    case "capitals": return country.capital;
    case "currencies": return country.currency;
    case "languages": return country.language;
    case "continents": return CONTINENT_LABELS[country.continent];
    case "populations": return `${country.population} million`;
  }
}

export interface QuizQuestion {
  id: string;
  country: Country;
  topic: Topic;
  prompt: string;
  answer: string;
  options: string[];
  correctIndex: number;
  type: QuestionType;
}

/** Generate multiple-choice distractor answers for a country + topic. */
export function generateDistractors(
  correct: Country,
  pool: Country[],
  count: number,
  topic: Topic,
  rng: () => number = Math.random,
): string[] {
  // For continents topic, distractors are other continent names.
  if (topic === "continents") {
    const allContinentNames = Object.values(CONTINENT_LABELS);
    const correctName = CONTINENT_LABELS[correct.continent];
    const others = allContinentNames.filter((n) => n !== correctName);
    return shuffleWith(others, rng).slice(0, count);
  }

  // For other topics: pick other countries' answers (deduped).
  const correctAns = getAnswer(correct, topic);
  const others = pool.filter((c) => c.code !== correct.code);
  const shuffled = shuffleWith(others, rng);
  const out: string[] = [];
  for (const c of shuffled) {
    if (out.length >= count) break;
    const ans = getAnswer(c, topic);
    if (ans !== correctAns && !out.includes(ans)) out.push(ans);
  }
  return out;
}

export function generateQuestion(
  country: Country,
  topic: Topic,
  pool: Country[],
  type: QuestionType,
  rng: () => number = Math.random,
): QuizQuestion {
  const prompt = getQuestionPrompt(country, topic);
  const answer = getAnswer(country, topic);

  if (type === "type-answer") {
    return {
      id: `q-${country.code}-${topic}`,
      country,
      topic,
      prompt,
      answer,
      options: [],
      correctIndex: -1,
      type,
    };
  }

  const distractors = generateDistractors(country, pool, 3, topic, rng);
  const allOptions = [answer, ...distractors];
  const shuffled = shuffleWith(allOptions, rng);
  const correctIndex = shuffled.indexOf(answer);
  return {
    id: `q-${country.code}-${topic}`,
    country,
    topic,
    prompt,
    answer,
    options: shuffled,
    correctIndex,
    type,
  };
}

export interface GenerateQuizParams {
  topic: Topic;
  region: Region;
  count: number;
  difficulty: Difficulty;
  type: QuestionType;
  seed?: number;
}

export function generateQuiz(params: GenerateQuizParams): QuizQuestion[] {
  const { topic, region, count, difficulty, type } = params;
  const rng = params.seed !== undefined ? mulberry32(params.seed) : Math.random;
  const filtered = filterByDifficulty(filterByRegion(COUNTRY_DB, region), difficulty);
  if (filtered.length === 0) return [];
  const shuffled = shuffleWith(filtered, rng);
  const n = Math.max(1, Math.min(count, shuffled.length));
  const selected = shuffled.slice(0, n);
  return selected.map((c) => generateQuestion(c, topic, filtered, type, rng));
}

// ---------------- Answer validation ----------------

/** Normalize an answer for fuzzy matching. */
export function normalizeAnswer(s: string): string {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[.,;:!?]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\bst\b\.?/g, "saint")
    .replace(/&/g, "and");
}

/** Validate a user-supplied answer against the correct answer (case-insensitive, fuzzy). */
export function validateAnswer(userAnswer: string, correctAnswer: string): boolean {
  const u = normalizeAnswer(userAnswer);
  const c = normalizeAnswer(correctAnswer);
  if (!u) return false;
  if (u === c) return true;
  // Strip all non-alphanumeric for a final compare
  const ua = u.replace(/[^a-z0-9 ]/g, "");
  const ca = c.replace(/[^a-z0-9 ]/g, "");
  return ua === ca;
}

// ---------------- Scoring ----------------

export interface QuizResult {
  correct: number;
  total: number;
  percentage: number;
  byRegion: Record<string, { correct: number; total: number }>;
}

/** Compute score given questions and user answers (MC: index, type: string). */
export function computeScore(
  questions: QuizQuestion[],
  userAnswers: (string | number)[],
): QuizResult {
  let correct = 0;
  const byRegion: Record<string, { correct: number; total: number }> = {};
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const ua = userAnswers[i];
    const region = q.country.continent;
    if (!byRegion[region]) byRegion[region] = { correct: 0, total: 0 };
    byRegion[region].total += 1;
    let isCorrect = false;
    if (q.type === "multiple-choice") {
      isCorrect = typeof ua === "number" && ua === q.correctIndex;
    } else {
      isCorrect = typeof ua === "string" && validateAnswer(ua, q.answer);
    }
    if (isCorrect) {
      correct += 1;
      byRegion[region].correct += 1;
    }
  }
  const total = questions.length;
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { correct, total, percentage, byRegion };
}

// ---------------- Summary stats ----------------

export interface QuizSummaryStats {
  total: number;
  correct: number;
  accuracy: number;
  hardestRegion: string | null;
  hardestAccuracy: number | null;
}

export function computeSummaryStats(result: QuizResult): QuizSummaryStats {
  const { correct, total, byRegion } = result;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  let hardestRegion: string | null = null;
  let hardestAcc: number | null = null;
  for (const [region, { correct: rc, total: rt }] of Object.entries(byRegion)) {
    if (rt === 0) continue;
    const acc = (rc / rt) * 100;
    if (hardestAcc === null || acc < hardestAcc) {
      hardestAcc = acc;
      hardestRegion = region;
    }
  }
  return {
    total,
    correct,
    accuracy,
    hardestRegion,
    hardestAccuracy: hardestAcc === null ? null : Math.round(hardestAcc),
  };
}

// ---------------- Renderers ----------------

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function renderText(questions: QuizQuestion[]): string {
  if (questions.length === 0) return "(no questions)";
  const lines: string[] = [];
  questions.forEach((q, i) => {
    lines.push(`Q${i + 1}. ${q.prompt}`);
    if (q.type === "multiple-choice") {
      q.options.forEach((opt, j) => {
        lines.push(`   ${String.fromCharCode(65 + j)}) ${opt}`);
      });
    }
    lines.push(`Answer: ${q.answer}`);
    lines.push("");
  });
  return lines.join("\n").trimEnd();
}

export function renderHtml(questions: QuizQuestion[], title: string = "Geography Quiz"): string {
  const items = questions.map((q, i) => {
    const opts = q.type === "multiple-choice"
      ? q.options.map((opt, j) => `      <li>${String.fromCharCode(65 + j)}) ${escapeHtml(opt)}</li>`).join("\n")
      : "      <li>(type your answer)</li>";
    return [
      `  <div class="question" style="margin: 16px 0; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px;">`,
      `    <div class="prompt" style="font-weight: 600;">${i + 1}. ${escapeHtml(q.prompt)}</div>`,
      `    <ul style="margin: 8px 0 8px 20px; padding: 0; list-style: none;">`,
      opts,
      `    </ul>`,
      `    <div class="answer" style="margin-top: 8px; font-size: 13px; color: #718096;"><em>Answer: ${escapeHtml(q.answer)}</em></div>`,
      `  </div>`,
    ].join("\n");
  }).join("\n");
  return [
    `<!DOCTYPE html>`,
    `<html lang="en">`,
    `<head>`,
    `<meta charset="utf-8">`,
    `<title>${escapeHtml(title)}</title>`,
    `<style>`,
    `body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 720px; margin: 24px auto; padding: 0 16px; color: #1a202c; }`,
    `h1 { font-size: 24px; margin-bottom: 8px; }`,
    `@media print { body { margin: 0; } }`,
    `</style>`,
    `</head>`,
    `<body>`,
    `<h1>${escapeHtml(title)}</h1>`,
    `<div class="quiz">`,
    items,
    `</div>`,
    `</body>`,
    `</html>`,
  ].join("\n");
}

export function renderCsv(questions: QuizQuestion[]): string {
  const header = "question,correct_answer,option_a,option_b,option_c,option_d,type,continent";
  if (questions.length === 0) return header;
  const lines = [header];
  for (const q of questions) {
    const opts = q.type === "multiple-choice" ? q.options : [];
    while (opts.length < 4) opts.push("");
    lines.push([
      escapeCsv(q.prompt),
      escapeCsv(q.answer),
      escapeCsv(opts[0] ?? ""),
      escapeCsv(opts[1] ?? ""),
      escapeCsv(opts[2] ?? ""),
      escapeCsv(opts[3] ?? ""),
      q.type,
      q.country.continent,
    ].join(","));
  }
  return lines.join("\n");
}

// ---------------- Flag description reference ----------------

export function getFlagDescriptions(countries: Country[]): { name: string; flagDesc: string; continent: Continent }[] {
  return countries.map((c) => ({
    name: c.name,
    flagDesc: c.flagDesc,
    continent: c.continent,
  }));
}

// ---------------- History (localStorage) ----------------

const HISTORY_KEY = "unqtools:geography-quiz:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  topic: Topic;
  region: Region;
  difficulty: Difficulty;
  type: QuestionType;
  total: number;
  correct: number;
  percentage: number;
}

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

// ---------------- Shareable URL ----------------

export interface ShareParams {
  topic: Topic;
  region: Region;
  count: number;
  difficulty: Difficulty;
  type: QuestionType;
}

export function buildShareUrl(p: ShareParams): string {
  const params = new URLSearchParams();
  params.set("topic", p.topic);
  params.set("region", p.region);
  params.set("count", String(p.count));
  params.set("difficulty", p.difficulty);
  params.set("type", p.type);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareParams> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const validTopics: Topic[] = ["capitals", "currencies", "languages", "continents", "populations", "flags-description"];
  const validRegions: Region[] = ["world", "africa", "asia", "europe", "north-america", "south-america", "oceania", "antarctica"];
  const validDifficulties: Difficulty[] = ["easy", "medium", "hard"];
  const validTypes: QuestionType[] = ["multiple-choice", "type-answer"];
  const out: Partial<ShareParams> = {};
  const t = params.get("topic") as Topic | null;
  if (t && validTopics.includes(t)) out.topic = t;
  const r = params.get("region") as Region | null;
  if (r && validRegions.includes(r)) out.region = r;
  const d = params.get("difficulty") as Difficulty | null;
  if (d && validDifficulties.includes(d)) out.difficulty = d;
  const ty = params.get("type") as QuestionType | null;
  if (ty && validTypes.includes(ty)) out.type = ty;
  const c = parseInt(params.get("count") ?? "", 10);
  if (!Number.isNaN(c) && c > 0) out.count = c;
  return out;
}
