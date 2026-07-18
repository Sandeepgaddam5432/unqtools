/**
 * Locale Keyword Researcher — pure logic.
 *
 * Translate base keywords across 10 languages, apply locale spelling
 * variants, attach localized modifiers, and generate Google search URLs
 * per locale. Pure functions only — no DOM, no network.
 */

export interface LocaleTarget {
  language: string; // ISO 639-1
  country: string; // ISO 3166-1 alpha-2
  locale: string; // e.g. "en-US"
}

export interface KeywordVariant {
  locale: string;
  baseKeyword: string;
  translatedBase: string;
  modifier: string;
  translatedModifier: string;
  combinedKeyword: string;
  googleUrl: string;
  currency: string;
  untranslatableWords: string[];
}

export interface LocaleReport {
  locale: LocaleTarget;
  translatedBase: string;
  currency: string;
  variants: KeywordVariant[];
  untranslatableWords: string[];
}

export interface LocalePreset {
  locale: string;
  label: string;
}

/** Built-in translation table — 50+ words × 10 languages. */
export const TRANSLATIONS: Record<string, Record<string, string>> = {
  // English base
  buy:        { en: "buy",        de: "kaufen",   fr: "acheter",  es: "comprar",  it: "comprare", ja: "買う",       ko: "구매",   zh: "购买", pt: "comprar",  ru: "купить" },
  sell:       { en: "sell",       de: "verkaufen",fr: "vendre",   es: "vender",   it: "vendere",  ja: "売る",       ko: "판매",   zh: "出售", pt: "vender",   ru: "продать" },
  price:      { en: "price",      de: "preis",    fr: "prix",     es: "precio",   it: "prezzo",   ja: "価格",       ko: "가격",   zh: "价格", pt: "preço",    ru: "цена" },
  cheap:      { en: "cheap",      de: "günstig",  fr: "pas cher", es: "barato",   it: "economico",ja: "安い",       ko: "저렴한", zh: "便宜", pt: "barato",   ru: "дешево" },
  best:       { en: "best",       de: "beste",    fr: "meilleur", es: "mejor",    it: "migliore", ja: "最高",       ko: "최고",   zh: "最好", pt: "melhor",   ru: "лучший" },
  online:     { en: "online",     de: "online",   fr: "en ligne", es: "en línea", it: "online",   ja: "オンライン", ko: "온라인", zh: "在线", pt: "online",   ru: "онлайн" },
  "near me":  { en: "near me",    de: "in der nähe", fr: "près de moi", es: "cerca de mí", it: "vicino a me", ja: "近く", ko: "근처", zh: "附近", pt: "perto de mim", ru: "рядом" },
  store:      { en: "store",      de: "laden",    fr: "magasin",  es: "tienda",   it: "negozio",  ja: "店舗",       ko: "매장",   zh: "商店", pt: "loja",     ru: "магазин" },
  shop:       { en: "shop",       de: "einkaufen",fr: "magasin",  es: "comprar",  it: "negozio",  ja: "ショップ",   ko: "샵",     zh: "购物", pt: "loja",     ru: "магазин" },
  delivery:   { en: "delivery",   de: "lieferung",fr: "livraison",es: "entrega",  it: "consegna", ja: "配達",       ko: "배송",   zh: "送货", pt: "entrega",  ru: "доставка" },
  "free shipping": { en: "free shipping", de: "kostenloser versand", fr: "livraison gratuite", es: "envío gratis", it: "spedizione gratuita", ja: "送料無料", ko: "무료 배송", zh: "免费送货", pt: "frete grátis", ru: "бесплатная доставка" },
  reviews:    { en: "reviews",    de: "bewertungen", fr: "avis",  es: "reseñas",  it: "recensioni",ja: "レビュー",   ko: "리뷰",   zh: "评论", pt: "avaliações", ru: "отзывы" },
  top:        { en: "top",        de: "top",      fr: "top",      es: "top",      it: "top",      ja: "トップ",     ko: "탑",     zh: "顶级", pt: "top",      ru: "топ" },
  sale:       { en: "sale",       de: "verkauf",  fr: "solde",    es: "venta",    it: "vendita",  ja: "セール",     ko: "세일",   zh: "促销", pt: "promoção", ru: "распродажа" },
  discount:   { en: "discount",   de: "rabatt",   fr: "remise",   es: "descuento",it: "sconto",   ja: "割引",       ko: "할인",   zh: "折扣", pt: "desconto", ru: "скидка" },
  shoes:      { en: "shoes",      de: "schuhe",   fr: "chaussures",es: "zapatos", it: "scarpe",   ja: "靴",         ko: "신발",   zh: "鞋子", pt: "sapatos",  ru: "обувь" },
  shirt:      { en: "shirt",      de: "hemd",     fr: "chemise",  es: "camisa",   it: "camicia",  ja: "シャツ",     ko: "셔츠",   zh: "衬衫", pt: "camisa",   ru: "рубашка" },
  phone:      { en: "phone",      de: "handy",    fr: "téléphone",es: "teléfono", it: "telefono", ja: "電話",       ko: "전화",   zh: "手机", pt: "telefone", ru: "телефон" },
  laptop:     { en: "laptop",     de: "laptop",   fr: "ordinateur portable", es: "portátil", it: "portatile", ja: "ノートパソコン", ko: "노트북", zh: "笔记本", pt: "notebook", ru: "ноутбук" },
  watch:      { en: "watch",      de: "uhr",      fr: "montre",   es: "reloj",    it: "orologio", ja: "時計",       ko: "시계",   zh: "手表", pt: "relógio",  ru: "часы" },
  bag:        { en: "bag",        de: "tasche",   fr: "sac",      es: "bolsa",    it: "borsa",    ja: "バッグ",     ko: "가방",   zh: "包",   pt: "bolsa",    ru: "сумка" },
  jacket:     { en: "jacket",     de: "jacke",    fr: "veste",    es: "chaqueta", it: "giacca",   ja: "ジャケット", ko: "재킷",   zh: "夹克", pt: "casaco",   ru: "куртка" },
  headphones: { en: "headphones", de: "kopfhörer",fr: "casque",   es: "auriculares", it: "cuffie", ja: "ヘッドホン", ko: "헤드폰", zh: "耳机", pt: "fones",    ru: "наушники" },
  camera:     { en: "camera",     de: "kamera",   fr: "appareil photo", es: "cámara", it: "fotocamera", ja: "カメラ", ko: "카메라", zh: "相机", pt: "câmera",  ru: "камера" },
  book:       { en: "book",       de: "buch",     fr: "livre",    es: "libro",    it: "libro",    ja: "本",         ko: "책",     zh: "书",   pt: "livro",    ru: "книга" },
  gift:       { en: "gift",       de: "geschenk", fr: "cadeau",   es: "regalo",   it: "regalo",   ja: "贈り物",     ko: "선물",   zh: "礼物", pt: "presente", ru: "подарок" },
  furniture:  { en: "furniture",  de: "möbel",    fr: "meubles",  es: "muebles",  it: "mobili",   ja: "家具",       ko: "가구",   zh: "家具", pt: "móveis",   ru: "мебель" },
  food:       { en: "food",       de: "essen",    fr: "nourriture", es: "comida", it: "cibo",     ja: "食べ物",     ko: "음식",   zh: "食物", pt: "comida",   ru: "еда" },
  coffee:     { en: "coffee",     de: "kaffee",   fr: "café",     es: "café",     it: "caffè",    ja: "コーヒー",   ko: "커피",   zh: "咖啡", pt: "café",     ru: "кофе" },
  toy:        { en: "toy",        de: "spielzeug",fr: "jouet",    es: "juguete",  it: "giocattolo",ja: "おもちゃ",   ko: "장난감", zh: "玩具", pt: "brinquedo",ru: "игрушка" },
  perfume:    { en: "perfume",    de: "parfüm",   fr: "parfum",   es: "perfume",  it: "profumo",  ja: "香水",       ko: "향수",   zh: "香水", pt: "perfume",  ru: "парфюм" },
  cosmetics:  { en: "cosmetics",  de: "kosmetik", fr: "cosmétiques", es: "cosméticos", it: "cosmetici", ja: "化粧品", ko: "화장품", zh: "化妆品", pt: "cosméticos", ru: "косметика" },
  jewelry:    { en: "jewelry",    de: "schmuck",  fr: "bijoux",   es: "joyería",  it: "gioielli", ja: "宝石",       ko: "주얼리", zh: "珠宝", pt: "joias",    ru: "ювелирные изделия" },
  glasses:    { en: "glasses",    de: "brille",   fr: "lunettes", es: "gafas",    it: "occhiali", ja: "メガネ",     ko: "안경",   zh: "眼镜", pt: "óculos",   ru: "очки" },
  wallet:     { en: "wallet",     de: "geldbeutel", fr: "portefeuille", es: "cartera", it: "portafoglio", ja: "財布", ko: "지갑", zh: "钱包", pt: "carteira", ru: "кошелек" },
  dress:      { en: "dress",      de: "kleid",    fr: "robe",     es: "vestido",  it: "vestito",  ja: "ドレス",     ko: "드레스", zh: "连衣裙", pt: "vestido", ru: "платье" },
  pants:      { en: "pants",      de: "hose",     fr: "pantalon", es: "pantalón", it: "pantaloni",ja: "ズボン",     ko: "바지",   zh: "裤子", pt: "calça",    ru: "брюки" },
  boots:      { en: "boots",      de: "stiefel",  fr: "bottes",   es: "botas",    it: "stivali",  ja: "ブーツ",     ko: "부츠",   zh: "靴子", pt: "botas",    ru: "ботинки" },
  sofa:       { en: "sofa",       de: "sofa",     fr: "canapé",   es: "sofá",     it: "divano",   ja: "ソファ",     ko: "소파",   zh: "沙发", pt: "sofá",     ru: "диван" },
  lamp:       { en: "lamp",       de: "lampe",    fr: "lampe",    es: "lámpara",  it: "lampada",  ja: "ランプ",     ko: "램프",   zh: "灯",   pt: "lâmpada",  ru: "лампа" },
  kitchen:    { en: "kitchen",    de: "küche",    fr: "cuisine",  es: "cocina",   it: "cucina",   ja: "キッチン",   ko: "주방",   zh: "厨房", pt: "cozinha",  ru: "кухня" },
  car:        { en: "car",        de: "auto",     fr: "voiture",  es: "coche",    it: "auto",     ja: "車",         ko: "자동차", zh: "汽车", pt: "carro",    ru: "машина" },
  bike:       { en: "bike",       de: "fahrrad",  fr: "vélo",     es: "bicicleta",it: "bicicletta",ja: "自転車",     ko: "자전거", zh: "自行车", pt: "bicicleta", ru: "велосипед" },
  travel:     { en: "travel",     de: "reisen",   fr: "voyager",  es: "viajar",   it: "viaggiare",ja: "旅行",       ko: "여행",   zh: "旅行", pt: "viajar",   ru: "путешествия" },
  hotel:      { en: "hotel",      de: "hotel",    fr: "hôtel",    es: "hotel",    it: "hotel",    ja: "ホテル",     ko: "호텔",   zh: "酒店", pt: "hotel",    ru: "отель" },
  flight:     { en: "flight",     de: "flug",     fr: "vol",      es: "vuelo",    it: "volo",     ja: "フライト",   ko: "항공편", zh: "航班", pt: "voo",      ru: "рейс" },
  ticket:     { en: "ticket",     de: "ticket",   fr: "billet",   es: "billete",  it: "biglietto",ja: "チケット",   ko: "티켓",   zh: "票",   pt: "ingresso",ru: "билет" },
  software:   { en: "software",   de: "software", fr: "logiciel", es: "software", it: "software", ja: "ソフトウェア", ko: "소프트웨어", zh: "软件", pt: "software", ru: "программное обеспечение" },
  game:       { en: "game",       de: "spiel",    fr: "jeu",      es: "juego",    it: "gioco",    ja: "ゲーム",     ko: "게임",   zh: "游戏", pt: "jogo",     ru: "игра" },
  music:      { en: "music",      de: "musik",    fr: "musique",  es: "música",   it: "musica",   ja: "音楽",       ko: "음악",   zh: "音乐", pt: "música",   ru: "музыка" },
  organic:    { en: "organic",    de: "bio",      fr: "bio",      es: "orgánico", it: "bio",      ja: "オーガニック",ko: "유기농", zh: "有机", pt: "orgânico", ru: "органический" },
  premium:    { en: "premium",    de: "premium",  fr: "premium",  es: "premium",  it: "premium",  ja: "プレミアム", ko: "프리미엄", zh: "高级", pt: "premium",  ru: "премиум" },
};

/** List of supported language codes. */
export const SUPPORTED_LANGUAGES = ["en", "de", "fr", "es", "it", "ja", "ko", "zh", "pt", "ru"];

/** Locale-specific spelling variants (e.g. en-US vs en-GB). */
export const SPELLING_VARIANTS: Record<string, Record<string, string>> = {
  "en-US": { colour: "color", catalogue: "catalog", centre: "center", flavour: "flavor", behaviour: "behavior" },
  "en-GB": { color: "colour", catalog: "catalogue", center: "centre", flavor: "flavour", behavior: "behaviour" },
  "en-AU": { color: "colour", catalog: "catalogue", center: "centre", flavor: "flavour", behavior: "behaviour" },
  "en-CA": { color: "colour", catalog: "catalogue", center: "centre", flavor: "flavour", behavior: "behaviour" },
};

/** Locale-specific currency mapping (15+ currencies). */
export const LOCALE_CURRENCY: Record<string, string> = {
  "en-US": "USD",
  "en-GB": "GBP",
  "en-AU": "AUD",
  "en-CA": "CAD",
  "en-NZ": "NZD",
  "en-IN": "INR",
  "en-ZA": "ZAR",
  "de-DE": "EUR",
  "de-AT": "EUR",
  "de-CH": "CHF",
  "fr-FR": "EUR",
  "fr-CA": "CAD",
  "es-ES": "EUR",
  "es-MX": "MXN",
  "it-IT": "EUR",
  "ja-JP": "JPY",
  "ko-KR": "KRW",
  "zh-CN": "CNY",
  "zh-TW": "TWD",
  "pt-BR": "BRL",
  "pt-PT": "EUR",
  "ru-RU": "RUB",
};

/** Google search domain per country code. */
export const GOOGLE_DOMAIN_BY_CC: Record<string, string> = {
  US: "google.com",
  GB: "google.co.uk",
  AU: "google.com.au",
  CA: "google.ca",
  NZ: "google.co.nz",
  IN: "google.co.in",
  ZA: "google.co.za",
  DE: "google.de",
  AT: "google.at",
  CH: "google.ch",
  FR: "google.fr",
  ES: "google.es",
  MX: "google.com.mx",
  IT: "google.it",
  JP: "google.co.jp",
  KR: "google.co.kr",
  CN: "google.cn",
  TW: "google.com.tw",
  BR: "google.com.br",
  PT: "google.pt",
  RU: "google.ru",
};

/** Locale presets — 12 locales. */
export const LOCALE_PRESETS: LocalePreset[] = [
  { locale: "en-US", label: "English (United States)" },
  { locale: "en-GB", label: "English (United Kingdom)" },
  { locale: "de-DE", label: "German (Germany)" },
  { locale: "fr-FR", label: "French (France)" },
  { locale: "es-ES", label: "Spanish (Spain)" },
  { locale: "it-IT", label: "Italian (Italy)" },
  { locale: "ja-JP", label: "Japanese (Japan)" },
  { locale: "ko-KR", label: "Korean (South Korea)" },
  { locale: "zh-CN", label: "Chinese (China)" },
  { locale: "pt-BR", label: "Portuguese (Brazil)" },
  { locale: "ru-RU", label: "Russian (Russia)" },
  { locale: "hi-IN", label: "Hindi (India)" },
];

/** Normalize text — collapse whitespace, trim. */
export function normalizeText(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Normalize a single word (lowercase). */
export function normalizeWord(s: string): string {
  return (s || "").toLowerCase().trim();
}

/** Parse target locales (one per line as 'Language-Country'). */
export function parseLocales(input: string): LocaleTarget[] {
  if (!input) return [];
  const out: LocaleTarget[] = [];
  const seen = new Set<string>();
  for (const line of input.split(/[\n,;]+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf("-");
    if (idx < 0) continue;
    const language = trimmed.slice(0, idx).trim().toLowerCase();
    const country = trimmed.slice(idx + 1).trim().toUpperCase();
    if (!/^[a-z]{2}$/.test(language) || !/^[A-Z]{2}$/.test(country)) continue;
    const locale = `${language}-${country}`;
    if (seen.has(locale)) continue;
    seen.add(locale);
    out.push({ language, country, locale });
  }
  return out;
}

/** Parse modifiers (comma-separated). */
export function parseModifiers(input: string): string[] {
  if (!input) return [];
  const out: string[] = [];
  for (const piece of input.split(/[,\n]+/)) {
    const m = normalizeWord(piece);
    if (m && !out.includes(m)) out.push(m);
  }
  return out;
}

/** Validate locale format ('xx-XX'). */
export function isValidLocale(locale: string): boolean {
  return /^[a-z]{2}-[A-Z]{2}$/.test(locale || "");
}

/** Detect language from locale (first 2 chars). */
export function detectLanguage(locale: string): string {
  return (locale || "").slice(0, 2).toLowerCase();
}

/** Detect country from locale (last 2 chars). */
export function detectCountry(locale: string): string {
  return (locale || "").slice(-2).toUpperCase();
}

/** Lookup currency for a locale. */
export function lookupCurrency(locale: string): string {
  return LOCALE_CURRENCY[locale] ?? "USD";
}

/** Lookup Google domain for a country code. */
export function lookupGoogleDomain(countryCode: string): string {
  return GOOGLE_DOMAIN_BY_CC[(countryCode || "").toUpperCase()] ?? "google.com";
}

/** Apply locale-specific spelling variants to a word. */
export function applySpellingVariant(word: string, locale: string): string {
  const variants = SPELLING_VARIANTS[locale];
  if (!variants) return word;
  const lower = word.toLowerCase();
  return variants[lower] ?? word;
}

/** Translate a single word using the built-in table. Returns null if not found. */
export function translateWord(word: string, language: string): string | null {
  const w = normalizeWord(word);
  const lang = (language || "").toLowerCase();
  if (!w || !lang) return null;
  // Handle multi-word phrases like "free shipping", "near me"
  if (TRANSLATIONS[w] && TRANSLATIONS[w][lang]) {
    return TRANSLATIONS[w][lang];
  }
  return null;
}

/** Translate a base keyword word-by-word. Returns translated string + untranslatable words. */
export function translateBaseKeyword(
  keyword: string,
  language: string,
  locale: string,
): { translated: string; untranslatable: string[] } {
  const words = normalizeText(keyword).split(/\s+/).filter(Boolean);
  const out: string[] = [];
  const untranslatable: string[] = [];
  for (const w of words) {
    const translated = translateWord(w, language);
    if (translated) {
      out.push(applySpellingVariant(translated, locale));
    } else {
      // Apply locale spelling variant to untranslatable words too (e.g. color → colour for en-GB)
      out.push(applySpellingVariant(w, locale));
      untranslatable.push(w);
    }
  }
  return { translated: out.join(" "), untranslatable };
}

/** Combine base keyword with modifier. */
export function combineKeyword(base: string, modifier: string): string {
  const b = normalizeText(base);
  const m = normalizeText(modifier);
  if (!b) return m;
  if (!m) return b;
  return `${b} ${m}`;
}

/** Build a Google search URL for a keyword using a locale-specific Google domain. */
export function buildGoogleUrl(keyword: string, countryCode: string): string {
  const domain = lookupGoogleDomain(countryCode);
  return `https://www.${domain}/search?q=${encodeURIComponent(keyword)}`;
}

/** Generate all keyword variants for a single locale. */
export function generateForLocale(
  baseKeyword: string,
  locale: LocaleTarget,
  modifiers: string[],
): LocaleReport {
  const { translated, untranslatable: baseUntrans } = translateBaseKeyword(
    baseKeyword,
    locale.language,
    locale.locale,
  );
  const variants: KeywordVariant[] = [];
  const allUntrans = new Set<string>(baseUntrans);

  for (const mod of modifiers) {
    const modTrans = translateBaseKeyword(mod, locale.language, locale.locale);
    modTrans.untranslatable.forEach((w) => allUntrans.add(w));
    const combined = combineKeyword(translated, modTrans.translated);
    variants.push({
      locale: locale.locale,
      baseKeyword,
      translatedBase: translated,
      modifier: mod,
      translatedModifier: modTrans.translated,
      combinedKeyword: combined,
      googleUrl: buildGoogleUrl(combined, locale.country),
      currency: lookupCurrency(locale.locale),
      untranslatableWords: modTrans.untranslatable,
    });
  }
  // If no modifiers, still produce a variant for the base keyword alone
  if (modifiers.length === 0) {
    variants.push({
      locale: locale.locale,
      baseKeyword,
      translatedBase: translated,
      modifier: "",
      translatedModifier: "",
      combinedKeyword: translated,
      googleUrl: buildGoogleUrl(translated, locale.country),
      currency: lookupCurrency(locale.locale),
      untranslatableWords: [],
    });
  }

  return {
    locale,
    translatedBase: translated,
    currency: lookupCurrency(locale.locale),
    variants,
    untranslatableWords: Array.from(allUntrans),
  };
}

/** Generate reports for all locales. */
export function generateAllReports(
  baseKeyword: string,
  locales: LocaleTarget[],
  modifiers: string[],
): LocaleReport[] {
  return locales.map((l) => generateForLocale(baseKeyword, l, modifiers));
}

/** Flatten reports to keyword variants (for filter/render). */
export function flattenVariants(reports: LocaleReport[]): KeywordVariant[] {
  const out: KeywordVariant[] = [];
  for (const r of reports) out.push(...r.variants);
  return out;
}

/** Filter variants by locale. */
export function filterByLocale(variants: KeywordVariant[], locale: string): KeywordVariant[] {
  const q = normalizeText(locale).toLowerCase();
  if (!q) return variants;
  return variants.filter((v) => v.locale.toLowerCase().includes(q));
}

/** Compute summary stats. */
export interface ResearchStats {
  totalLocales: number;
  totalVariants: number;
  totalUntranslatable: number;
  currencies: string[];
}

export function computeStats(reports: LocaleReport[]): ResearchStats {
  const allVariants = flattenVariants(reports);
  const currencies = new Set<string>();
  const allUntrans = new Set<string>();
  for (const r of reports) {
    currencies.add(r.currency);
    r.untranslatableWords.forEach((w) => allUntrans.add(w));
  }
  return {
    totalLocales: reports.length,
    totalVariants: allVariants.length,
    totalUntranslatable: allUntrans.size,
    currencies: Array.from(currencies).sort(),
  };
}

/** Render text report. */
export function renderText(
  baseKeyword: string,
  reports: LocaleReport[],
): string {
  const lines: string[] = [];
  lines.push(`Locale Keyword Research`);
  lines.push(`========================`);
  lines.push(`Base keyword: ${baseKeyword}`);
  lines.push(`Locales: ${reports.length}`);
  lines.push(``);
  for (const r of reports) {
    lines.push(`[${r.locale.locale}] ${r.locale.language}-${r.locale.country} · currency: ${r.currency}`);
    lines.push(`  Translated base: ${r.translatedBase}`);
    if (r.untranslatableWords.length > 0) {
      lines.push(`  Untranslatable: ${r.untranslatableWords.join(", ")}`);
    }
    for (const v of r.variants) {
      lines.push(`    - ${v.combinedKeyword}`);
      lines.push(`      ${v.googleUrl}`);
    }
    lines.push(``);
  }
  return lines.join("\n").trim();
}

/** Render CSV report. */
export function renderCsv(reports: LocaleReport[]): string {
  const lines = ["locale,base,modifier,translated_keyword,google_url,currency"];
  for (const r of reports) {
    for (const v of r.variants) {
      lines.push([
        v.locale,
        escapeCsv(v.baseKeyword),
        escapeCsv(v.modifier),
        escapeCsv(v.combinedKeyword),
        escapeCsv(v.googleUrl),
        v.currency,
      ].join(","));
    }
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:locale-keyword-researcher:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  baseKeyword: string;
  locales: string[];
  totalVariants: number;
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

// ---- Shareable URL ----

export function buildShareUrl(
  baseKeyword: string,
  localesText: string,
  modifiersText: string,
): string {
  const params = new URLSearchParams();
  if (baseKeyword) params.set("kw", baseKeyword);
  if (localesText) params.set("locales", localesText);
  if (modifiersText) params.set("mods", modifiersText);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): {
  baseKeyword: string;
  localesText: string;
  modifiersText: string;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { baseKeyword: "", localesText: "", modifiersText: "" };
  const params = new URLSearchParams(clean);
  return {
    baseKeyword: params.get("kw") ?? "",
    localesText: params.get("locales") ?? "",
    modifiersText: params.get("mods") ?? "",
  };
}
