/**
 * AI Multi-Language Translator — pure logic.
 *
 * Capabilities:
 *   - Built-in phrasebook: 100+ common phrases × 10 languages (en, es, fr, de,
 *     it, pt, ru, ja, zh, ar). Phrases keyed by English canonical.
 *   - Auto-detect source language via script heuristics.
 *   - Translate text: scan for known phrases, substitute, fall back to TM or
 *     pass through verbatim.
 *   - Translation memory (localStorage) — per-device store of approved pairs.
 *   - Swap source/target.
 *   - Batch mode (one phrase per line).
 *   - Custom glossary / do-not-translate list.
 *   - Transliteration (Cyrillic → Latin, Arabic → Latin, basic).
 *   - RTL detection.
 *   - Local history (max 20) + shareable URL.
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API
 * key) lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type LanguageCode = "en" | "es" | "fr" | "de" | "it" | "pt" | "ru" | "ja" | "zh" | "ar";

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
  rtl: boolean;
  script: "latin" | "cyrillic" | "cjk" | "arabic";
}

export interface PhraseEntry {
  key: string;       // English canonical
  category: string;
  translations: Record<LanguageCode, string>;
}

export interface TranslationMatch {
  start: number;
  end: number;
  original: string;
  translated: string;
  source: "dictionary" | "memory" | "passthrough";
}

export interface TranslationResult {
  source: LanguageCode;
  target: LanguageCode;
  original: string;
  translated: string;
  matches: TranslationMatch[];
  detected: LanguageCode;
  detectedConfidence: number;
  passthroughCount: number;
  dictionaryHits: number;
  memoryHits: number;
  rtl: boolean;
}

export interface TranslationMemoryEntry {
  source: LanguageCode;
  target: LanguageCode;
  sourceText: string;
  targetText: string;
  ts: number;
}

export interface HistoryEntry {
  ts: number;
  source: LanguageCode;
  target: LanguageCode;
  sourceText: string;
  targetText: string;
  method: "dictionary" | "llm";
}

export interface ShareState {
  source: LanguageCode | "auto";
  target: LanguageCode;
  text: string;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-multi-language-translator:history";
export const HISTORY_MAX = 20;
export const TM_KEY = "unqtools:ai-multi-language-translator:memory";
export const GLOSSARY_KEY = "unqtools:ai-multi-language-translator:glossary";

export const LANGUAGES: LanguageInfo[] = [
  { code: "en", name: "English", nativeName: "English", rtl: false, script: "latin" },
  { code: "es", name: "Spanish", nativeName: "Español", rtl: false, script: "latin" },
  { code: "fr", name: "French", nativeName: "Français", rtl: false, script: "latin" },
  { code: "de", name: "German", nativeName: "Deutsch", rtl: false, script: "latin" },
  { code: "it", name: "Italian", nativeName: "Italiano", rtl: false, script: "latin" },
  { code: "pt", name: "Portuguese", nativeName: "Português", rtl: false, script: "latin" },
  { code: "ru", name: "Russian", nativeName: "Русский", rtl: false, script: "cyrillic" },
  { code: "ja", name: "Japanese", nativeName: "日本語", rtl: false, script: "cjk" },
  { code: "zh", name: "Chinese", nativeName: "中文", rtl: false, script: "cjk" },
  { code: "ar", name: "Arabic", nativeName: "العربية", rtl: true, script: "arabic" },
];

export const LANGUAGE_LABELS: Record<LanguageCode, string> = LANGUAGES.reduce(
  (acc, l) => { acc[l.code] = l.name; return acc; },
  {} as Record<LanguageCode, string>,
);

export const RTL_LANGUAGES: LanguageCode[] = LANGUAGES.filter((l) => l.rtl).map((l) => l.code);

export const SAMPLE_PHRASES: { lang: LanguageCode; text: string }[] = [
  { lang: "en", text: "Hello. How are you? Thank you. Goodbye." },
  { lang: "es", text: "Hola. ¿Cómo estás? Gracias. Adiós." },
  { lang: "fr", text: "Bonjour. Comment allez-vous? Merci. Au revoir." },
  { lang: "de", text: "Hallo. Wie geht es dir? Danke. Auf Wiedersehen." },
  { lang: "it", text: "Ciao. Come stai? Grazie. Arrivederci." },
  { lang: "pt", text: "Olá. Como vai? Obrigado. Adeus." },
  { lang: "ru", text: "Привет. Как дела? Спасибо. До свидания." },
  { lang: "ja", text: "こんにちは。お元気ですか。ありがとう。さようなら。" },
  { lang: "zh", text: "你好。你好吗？谢谢。再见。" },
  { lang: "ar", text: "مرحبا. كيف حالك؟ شكرا. وداعا." },
];

export const HONESTY_NOTES: string[] = [
  "The built-in phrasebook covers 100+ common phrases per language — for novel sentences, fall back to BYO-key LLM.",
  "Auto-detect uses script heuristics and is approximate; always verify the source language.",
  "Translation memory is per-device and stored in localStorage — clear it anytime.",
  "On-device translation is not always at DeepL level — stated per pair.",
  "Cyrillic and Arabic transliteration is basic (ISO 9 / ALA-LC approximation).",
];

// ---------- Phrasebook (100+ phrases × 10 languages) ----------

export const PHRASEBOOK: PhraseEntry[] = [
  // ----- Greetings (10) -----
  {
    key: "hello",
    category: "Greetings",
    translations: {
      en: "Hello", es: "Hola", fr: "Bonjour", de: "Hallo", it: "Ciao",
      pt: "Olá", ru: "Привет", ja: "こんにちは", zh: "你好", ar: "مرحبا",
    },
  },
  {
    key: "hi",
    category: "Greetings",
    translations: {
      en: "Hi", es: "Hola", fr: "Salut", de: "Hi", it: "Ciao",
      pt: "Oi", ru: "Привет", ja: "やあ", zh: "嗨", ar: "أهلا",
    },
  },
  {
    key: "good morning",
    category: "Greetings",
    translations: {
      en: "Good morning", es: "Buenos días", fr: "Bonjour", de: "Guten Morgen", it: "Buongiorno",
      pt: "Bom dia", ru: "Доброе утро", ja: "おはようございます", zh: "早上好", ar: "صباح الخير",
    },
  },
  {
    key: "good afternoon",
    category: "Greetings",
    translations: {
      en: "Good afternoon", es: "Buenas tardes", fr: "Bon après-midi", de: "Guten Tag", it: "Buon pomeriggio",
      pt: "Boa tarde", ru: "Добрый день", ja: "こんにちは", zh: "下午好", ar: "مساء الخير",
    },
  },
  {
    key: "good evening",
    category: "Greetings",
    translations: {
      en: "Good evening", es: "Buenas noches", fr: "Bonsoir", de: "Guten Abend", it: "Buonasera",
      pt: "Boa noite", ru: "Добрый вечер", ja: "こんばんは", zh: "晚上好", ar: "مساء الخير",
    },
  },
  {
    key: "good night",
    category: "Greetings",
    translations: {
      en: "Good night", es: "Buenas noches", fr: "Bonne nuit", de: "Gute Nacht", it: "Buonanotte",
      pt: "Boa noite", ru: "Спокойной ночи", ja: "おやすみなさい", zh: "晚安", ar: "تصبح على خير",
    },
  },
  {
    key: "welcome",
    category: "Greetings",
    translations: {
      en: "Welcome", es: "Bienvenido", fr: "Bienvenue", de: "Willkommen", it: "Benvenuto",
      pt: "Bem-vindo", ru: "Добро пожаловать", ja: "ようこそ", zh: "欢迎", ar: "أهلا وسهلا",
    },
  },
  {
    key: "goodbye",
    category: "Greetings",
    translations: {
      en: "Goodbye", es: "Adiós", fr: "Au revoir", de: "Auf Wiedersehen", it: "Arrivederci",
      pt: "Adeus", ru: "До свидания", ja: "さようなら", zh: "再见", ar: "وداعا",
    },
  },
  {
    key: "see you later",
    category: "Greetings",
    translations: {
      en: "See you later", es: "Hasta luego", fr: "À plus tard", de: "Bis später", it: "A dopo",
      pt: "Até logo", ru: "Увидимся", ja: "また後で", zh: "回头见", ar: "أراك لاحقا",
    },
  },
  {
    key: "see you tomorrow",
    category: "Greetings",
    translations: {
      en: "See you tomorrow", es: "Hasta mañana", fr: "À demain", de: "Bis morgen", it: "A domani",
      pt: "Até amanhã", ru: "До завтра", ja: "また明日", zh: "明天见", ar: "أراك غدا",
    },
  },
  // ----- Polite (10) -----
  {
    key: "please",
    category: "Polite",
    translations: {
      en: "Please", es: "Por favor", fr: "S'il vous plaît", de: "Bitte", it: "Per favore",
      pt: "Por favor", ru: "Пожалуйста", ja: "お願いします", zh: "请", ar: "من فضلك",
    },
  },
  {
    key: "thank you",
    category: "Polite",
    translations: {
      en: "Thank you", es: "Gracias", fr: "Merci", de: "Danke", it: "Grazie",
      pt: "Obrigado", ru: "Спасибо", ja: "ありがとう", zh: "谢谢", ar: "شكرا",
    },
  },
  {
    key: "you're welcome",
    category: "Polite",
    translations: {
      en: "You're welcome", es: "De nada", fr: "De rien", de: "Gern geschehen", it: "Prego",
      pt: "De nada", ru: "Пожалуйста", ja: "どういたしまして", zh: "不客气", ar: "عفوا",
    },
  },
  {
    key: "excuse me",
    category: "Polite",
    translations: {
      en: "Excuse me", es: "Disculpe", fr: "Excusez-moi", de: "Entschuldigung", it: "Mi scusi",
      pt: "Com licença", ru: "Извините", ja: "すみません", zh: "打扰一下", ar: "عذرا",
    },
  },
  {
    key: "sorry",
    category: "Polite",
    translations: {
      en: "Sorry", es: "Lo siento", fr: "Désolé", de: "Es tut mir leid", it: "Mi dispiace",
      pt: "Desculpe", ru: "Извините", ja: "ごめんなさい", zh: "对不起", ar: "آسف",
    },
  },
  {
    key: "yes",
    category: "Polite",
    translations: {
      en: "Yes", es: "Sí", fr: "Oui", de: "Ja", it: "Sì",
      pt: "Sim", ru: "Да", ja: "はい", zh: "是", ar: "نعم",
    },
  },
  {
    key: "no",
    category: "Polite",
    translations: {
      en: "No", es: "No", fr: "Non", de: "Nein", it: "No",
      pt: "Não", ru: "Нет", ja: "いいえ", zh: "不", ar: "لا",
    },
  },
  {
    key: "maybe",
    category: "Polite",
    translations: {
      en: "Maybe", es: "Quizás", fr: "Peut-être", de: "Vielleicht", it: "Forse",
      pt: "Talvez", ru: "Может быть", ja: "たぶん", zh: "也许", ar: "ربما",
    },
  },
  {
    key: "of course",
    category: "Polite",
    translations: {
      en: "Of course", es: "Por supuesto", fr: "Bien sûr", de: "Natürlich", it: "Certo",
      pt: "Claro", ru: "Конечно", ja: "もちろん", zh: "当然", ar: "بالطبع",
    },
  },
  {
    key: "no problem",
    category: "Polite",
    translations: {
      en: "No problem", es: "No hay problema", fr: "Pas de problème", de: "Kein Problem", it: "Nessun problema",
      pt: "Sem problema", ru: "Без проблем", ja: "問題ない", zh: "没问题", ar: "لا مشكلة",
    },
  },
  // ----- Introductions (8) -----
  {
    key: "my name is",
    category: "Introductions",
    translations: {
      en: "My name is", es: "Mi nombre es", fr: "Je m'appelle", de: "Ich heiße", it: "Mi chiamo",
      pt: "Meu nome é", ru: "Меня зовут", ja: "私の名前は", zh: "我叫", ar: "اسمي",
    },
  },
  {
    key: "what is your name",
    category: "Introductions",
    translations: {
      en: "What is your name?", es: "¿Cómo te llamas?", fr: "Comment vous appelez-vous?", de: "Wie heißen Sie?", it: "Come ti chiami?",
      pt: "Qual é o seu nome?", ru: "Как вас зовут?", ja: "お名前は何ですか?", zh: "你叫什么名字?", ar: "ما اسمك?",
    },
  },
  {
    key: "i am from",
    category: "Introductions",
    translations: {
      en: "I am from", es: "Soy de", fr: "Je viens de", de: "Ich komme aus", it: "Vengo da",
      pt: "Eu sou de", ru: "Я из", ja: "私は〜から来ました", zh: "我来自", ar: "أنا من",
    },
  },
  {
    key: "nice to meet you",
    category: "Introductions",
    translations: {
      en: "Nice to meet you", es: "Encantado de conocerte", fr: "Enchanté", de: "Schön, Sie kennenzulernen", it: "Piacere di conoscerti",
      pt: "Prazer em conhecê-lo", ru: "Приятно познакомиться", ja: "お会いできて嬉しいです", zh: "很高兴认识你", ar: "تشرفنا",
    },
  },
  {
    key: "how are you",
    category: "Introductions",
    translations: {
      en: "How are you?", es: "¿Cómo estás?", fr: "Comment allez-vous?", de: "Wie geht es dir?", it: "Come stai?",
      pt: "Como vai?", ru: "Как дела?", ja: "お元気ですか?", zh: "你好吗?", ar: "كيف حالك?",
    },
  },
  {
    key: "i am fine",
    category: "Introductions",
    translations: {
      en: "I am fine", es: "Estoy bien", fr: "Je vais bien", de: "Mir geht es gut", it: "Sto bene",
      pt: "Estou bem", ru: "Я в порядке", ja: "元気です", zh: "我很好", ar: "أنا بخير",
    },
  },
  {
    key: "i don't understand",
    category: "Introductions",
    translations: {
      en: "I don't understand", es: "No entiendo", fr: "Je ne comprends pas", de: "Ich verstehe nicht", it: "Non capisco",
      pt: "Não entendo", ru: "Я не понимаю", ja: "わかりません", zh: "我不明白", ar: "لا أفهم",
    },
  },
  {
    key: "do you speak english",
    category: "Introductions",
    translations: {
      en: "Do you speak English?", es: "¿Hablas inglés?", fr: "Parlez-vous anglais?", de: "Sprechen Sie Englisch?", it: "Parla inglese?",
      pt: "Você fala inglês?", ru: "Вы говорите по-английски?", ja: "英語を話せますか?", zh: "你会说英语吗?", ar: "هل تتكلم الإنجليزية?",
    },
  },
  // ----- Travel (12) -----
  {
    key: "where is",
    category: "Travel",
    translations: {
      en: "Where is", es: "¿Dónde está", fr: "Où est", de: "Wo ist", it: "Dov'è",
      pt: "Onde fica", ru: "Где", ja: "〜はどこですか", zh: "在哪里", ar: "أين",
    },
  },
  {
    key: "how do i get to",
    category: "Travel",
    translations: {
      en: "How do I get to", es: "¿Cómo llego a", fr: "Comment vais-je à", de: "Wie komme ich zum", it: "Come arrivo a",
      pt: "Como chego ao", ru: "Как добраться до", ja: "〜への行き方を教えてください", zh: "怎么去", ar: "كيف أصل إلى",
    },
  },
  {
    key: "airport",
    category: "Travel",
    translations: {
      en: "Airport", es: "Aeropuerto", fr: "Aéroport", de: "Flughafen", it: "Aeroporto",
      pt: "Aeroporto", ru: "Аэропорт", ja: "空港", zh: "机场", ar: "مطار",
    },
  },
  {
    key: "train station",
    category: "Travel",
    translations: {
      en: "Train station", es: "Estación de tren", fr: "Gare", de: "Bahnhof", it: "Stazione ferroviaria",
      pt: "Estação de trem", ru: "Вокзал", ja: "駅", zh: "火车站", ar: "محطة القطار",
    },
  },
  {
    key: "bus",
    category: "Travel",
    translations: {
      en: "Bus", es: "Autobús", fr: "Bus", de: "Bus", it: "Autobus",
      pt: "Ônibus", ru: "Автобус", ja: "バス", zh: "公交车", ar: "حافلة",
    },
  },
  {
    key: "taxi",
    category: "Travel",
    translations: {
      en: "Taxi", es: "Taxi", fr: "Taxi", de: "Taxi", it: "Taxi",
      pt: "Táxi", ru: "Такси", ja: "タクシー", zh: "出租车", ar: "سيارة أجرة",
    },
  },
  {
    key: "hotel",
    category: "Travel",
    translations: {
      en: "Hotel", es: "Hotel", fr: "Hôtel", de: "Hotel", it: "Hotel",
      pt: "Hotel", ru: "Отель", ja: "ホテル", zh: "酒店", ar: "فندق",
    },
  },
  {
    key: "restaurant",
    category: "Travel",
    translations: {
      en: "Restaurant", es: "Restaurante", fr: "Restaurant", de: "Restaurant", it: "Ristorante",
      pt: "Restaurante", ru: "Ресторан", ja: "レストラン", zh: "餐厅", ar: "مطعم",
    },
  },
  {
    key: "bathroom",
    category: "Travel",
    translations: {
      en: "Bathroom", es: "Baño", fr: "Toilettes", de: "Badezimmer", it: "Bagno",
      pt: "Banheiro", ru: "Туалет", ja: "トイレ", zh: "洗手间", ar: "حمام",
    },
  },
  {
    key: "ticket",
    category: "Travel",
    translations: {
      en: "Ticket", es: "Billete", fr: "Billet", de: "Fahrkarte", it: "Biglietto",
      pt: "Bilhete", ru: "Билет", ja: "切符", zh: "票", ar: "تذكرة",
    },
  },
  {
    key: "passport",
    category: "Travel",
    translations: {
      en: "Passport", es: "Pasaporte", fr: "Passeport", de: "Reisepass", it: "Passaporto",
      pt: "Passaporte", ru: "Паспорт", ja: "パスポート", zh: "护照", ar: "جواز سفر",
    },
  },
  {
    key: "luggage",
    category: "Travel",
    translations: {
      en: "Luggage", es: "Equipaje", fr: "Bagages", de: "Gepäck", it: "Bagaglio",
      pt: "Bagagem", ru: "Багаж", ja: "荷物", zh: "行李", ar: "أمتعة",
    },
  },
  // ----- Numbers / questions (10) -----
  {
    key: "one",
    category: "Numbers",
    translations: {
      en: "One", es: "Uno", fr: "Un", de: "Eins", it: "Uno",
      pt: "Um", ru: "Один", ja: "一", zh: "一", ar: "واحد",
    },
  },
  {
    key: "two",
    category: "Numbers",
    translations: {
      en: "Two", es: "Dos", fr: "Deux", de: "Zwei", it: "Due",
      pt: "Dois", ru: "Два", ja: "二", zh: "二", ar: "اثنان",
    },
  },
  {
    key: "three",
    category: "Numbers",
    translations: {
      en: "Three", es: "Tres", fr: "Trois", de: "Drei", it: "Tre",
      pt: "Três", ru: "Три", ja: "三", zh: "三", ar: "ثلاثة",
    },
  },
  {
    key: "four",
    category: "Numbers",
    translations: {
      en: "Four", es: "Cuatro", fr: "Quatre", de: "Vier", it: "Quattro",
      pt: "Quatro", ru: "Четыре", ja: "四", zh: "四", ar: "أربعة",
    },
  },
  {
    key: "five",
    category: "Numbers",
    translations: {
      en: "Five", es: "Cinco", fr: "Cinq", de: "Fünf", it: "Cinque",
      pt: "Cinco", ru: "Пять", ja: "五", zh: "五", ar: "خمسة",
    },
  },
  {
    key: "today",
    category: "Numbers",
    translations: {
      en: "Today", es: "Hoy", fr: "Aujourd'hui", de: "Heute", it: "Oggi",
      pt: "Hoje", ru: "Сегодня", ja: "今日", zh: "今天", ar: "اليوم",
    },
  },
  {
    key: "tomorrow",
    category: "Numbers",
    translations: {
      en: "Tomorrow", es: "Mañana", fr: "Demain", de: "Morgen", it: "Domani",
      pt: "Amanhã", ru: "Завтра", ja: "明日", zh: "明天", ar: "غدا",
    },
  },
  {
    key: "yesterday",
    category: "Numbers",
    translations: {
      en: "Yesterday", es: "Ayer", fr: "Hier", de: "Gestern", it: "Ieri",
      pt: "Ontem", ru: "Вчера", ja: "昨日", zh: "昨天", ar: "أمس",
    },
  },
  {
    key: "what time is it",
    category: "Numbers",
    translations: {
      en: "What time is it?", es: "¿Qué hora es?", fr: "Quelle heure est-il?", de: "Wie spät ist es?", it: "Che ore sono?",
      pt: "Que horas são?", ru: "Который час?", ja: "今何時ですか?", zh: "现在几点?", ar: "كم الساعة?",
    },
  },
  {
    key: "how much",
    category: "Numbers",
    translations: {
      en: "How much", es: "Cuánto", fr: "Combien", de: "Wie viel", it: "Quanto",
      pt: "Quanto", ru: "Сколько", ja: "いくら", zh: "多少", ar: "كم",
    },
  },
  // ----- Food / dining (10) -----
  {
    key: "menu",
    category: "Food",
    translations: {
      en: "Menu", es: "Menú", fr: "Menu", de: "Speisekarte", it: "Menu",
      pt: "Cardápio", ru: "Меню", ja: "メニュー", zh: "菜单", ar: "قائمة الطعام",
    },
  },
  {
    key: "water",
    category: "Food",
    translations: {
      en: "Water", es: "Agua", fr: "Eau", de: "Wasser", it: "Acqua",
      pt: "Água", ru: "Вода", ja: "水", zh: "水", ar: "ماء",
    },
  },
  {
    key: "bill",
    category: "Food",
    translations: {
      en: "Bill", es: "Cuenta", fr: "Addition", de: "Rechnung", it: "Conto",
      pt: "Conta", ru: "Счёт", ja: "会計", zh: "账单", ar: "فاتورة",
    },
  },
  {
    key: "check please",
    category: "Food",
    translations: {
      en: "Check, please", es: "La cuenta, por favor", fr: "L'addition, s'il vous plaît", de: "Die Rechnung, bitte", it: "Il conto, per favore",
      pt: "A conta, por favor", ru: "Счёт, пожалуйста", ja: "お会計をお願いします", zh: "请结账", ar: "الحساب من فضلك",
    },
  },
  {
    key: "delicious",
    category: "Food",
    translations: {
      en: "Delicious", es: "Delicioso", fr: "Délicieux", de: "Köstlich", it: "Delizioso",
      pt: "Delicioso", ru: "Вкусно", ja: "美味しい", zh: "美味", ar: "لذيذ",
    },
  },
  {
    key: "i am hungry",
    category: "Food",
    translations: {
      en: "I am hungry", es: "Tengo hambre", fr: "J'ai faim", de: "Ich habe Hunger", it: "Ho fame",
      pt: "Estou com fome", ru: "Я голоден", ja: "お腹がすきました", zh: "我饿了", ar: "أنا جائع",
    },
  },
  {
    key: "i am thirsty",
    category: "Food",
    translations: {
      en: "I am thirsty", es: "Tengo sed", fr: "J'ai soif", de: "Ich habe Durst", it: "Ho sete",
      pt: "Estou com sede", ru: "Я хочу пить", ja: "喉が渇きました", zh: "我渴了", ar: "أنا عطشان",
    },
  },
  {
    key: "breakfast",
    category: "Food",
    translations: {
      en: "Breakfast", es: "Desayuno", fr: "Petit-déjeuner", de: "Frühstück", it: "Colazione",
      pt: "Café da manhã", ru: "Завтрак", ja: "朝食", zh: "早餐", ar: "فطور",
    },
  },
  {
    key: "lunch",
    category: "Food",
    translations: {
      en: "Lunch", es: "Almuerzo", fr: "Déjeuner", de: "Mittagessen", it: "Pranzo",
      pt: "Almoço", ru: "Обед", ja: "昼食", zh: "午餐", ar: "غداء",
    },
  },
  {
    key: "dinner",
    category: "Food",
    translations: {
      en: "Dinner", es: "Cena", fr: "Dîner", de: "Abendessen", it: "Cena",
      pt: "Jantar", ru: "Ужин", ja: "夕食", zh: "晚餐", ar: "عشاء",
    },
  },
  // ----- Shopping (8) -----
  {
    key: "how much does it cost",
    category: "Shopping",
    translations: {
      en: "How much does it cost?", es: "¿Cuánto cuesta?", fr: "Combien ça coûte?", de: "Wie viel kostet das?", it: "Quanto costa?",
      pt: "Quanto custa?", ru: "Сколько это стоит?", ja: "いくらですか?", zh: "多少钱?", ar: "كم هذا?",
    },
  },
  {
    key: "do you accept credit cards",
    category: "Shopping",
    translations: {
      en: "Do you accept credit cards?", es: "¿Aceptan tarjetas de crédito?", fr: "Acceptez-vous les cartes de crédit?", de: "Akzeptieren Sie Kreditkarten?", it: "Accettate carte di credito?",
      pt: "Vocês aceitam cartão de crédito?", ru: "Вы принимаете кредитные карты?", ja: "クレジットカードは使えますか?", zh: "你们接受信用卡吗?", ar: "هل تقبلون بطاقات الائتمان?",
    },
  },
  {
    key: "too expensive",
    category: "Shopping",
    translations: {
      en: "Too expensive", es: "Muy caro", fr: "Trop cher", de: "Zu teuer", it: "Troppo caro",
      pt: "Muito caro", ru: "Слишком дорого", ja: "高すぎます", zh: "太贵了", ar: "غالي جدا",
    },
  },
  {
    key: "cheaper",
    category: "Shopping",
    translations: {
      en: "Cheaper", es: "Más barato", fr: "Moins cher", de: "Günstiger", it: "Più economico",
      pt: "Mais barato", ru: "Дешевле", ja: "もっと安く", zh: "便宜点", ar: "أرخص",
    },
  },
  {
    key: "i will buy it",
    category: "Shopping",
    translations: {
      en: "I will buy it", es: "Lo compraré", fr: "Je l'achète", de: "Ich nehme es", it: "Lo compro",
      pt: "Eu compro", ru: "Я куплю это", ja: "買います", zh: "我买了", ar: "سأشتريه",
    },
  },
  {
    key: "receipt",
    category: "Shopping",
    translations: {
      en: "Receipt", es: "Recibo", fr: "Reçu", de: "Quittung", it: "Ricevuta",
      pt: "Recibo", ru: "Чек", ja: "レシート", zh: "收据", ar: "إيصال",
    },
  },
  {
    key: "store",
    category: "Shopping",
    translations: {
      en: "Store", es: "Tienda", fr: "Magasin", de: "Geschäft", it: "Negozio",
      pt: "Loja", ru: "Магазин", ja: "店", zh: "商店", ar: "متجر",
    },
  },
  {
    key: "market",
    category: "Shopping",
    translations: {
      en: "Market", es: "Mercado", fr: "Marché", de: "Markt", it: "Mercato",
      pt: "Mercado", ru: "Рынок", ja: "市場", zh: "市场", ar: "سوق",
    },
  },
  // ----- Emergencies (8) -----
  {
    key: "help",
    category: "Emergencies",
    translations: {
      en: "Help", es: "Ayuda", fr: "Aide", de: "Hilfe", it: "Aiuto",
      pt: "Ajuda", ru: "Помогите", ja: "助けて", zh: "救命", ar: "ساعدني",
    },
  },
  {
    key: "doctor",
    category: "Emergencies",
    translations: {
      en: "Doctor", es: "Doctor", fr: "Docteur", de: "Arzt", it: "Dottore",
      pt: "Médico", ru: "Врач", ja: "医者", zh: "医生", ar: "طبيب",
    },
  },
  {
    key: "hospital",
    category: "Emergencies",
    translations: {
      en: "Hospital", es: "Hospital", fr: "Hôpital", de: "Krankenhaus", it: "Ospedale",
      pt: "Hospital", ru: "Больница", ja: "病院", zh: "医院", ar: "مستشفى",
    },
  },
  {
    key: "police",
    category: "Emergencies",
    translations: {
      en: "Police", es: "Policía", fr: "Police", de: "Polizei", it: "Polizia",
      pt: "Polícia", ru: "Полиция", ja: "警察", zh: "警察", ar: "شرطة",
    },
  },
  {
    key: "fire",
    category: "Emergencies",
    translations: {
      en: "Fire", es: "Fuego", fr: "Feu", de: "Feuer", it: "Fuoco",
      pt: "Fogo", ru: "Пожар", ja: "火事", zh: "火灾", ar: "حريق",
    },
  },
  {
    key: "i am lost",
    category: "Emergencies",
    translations: {
      en: "I am lost", es: "Estoy perdido", fr: "Je suis perdu", de: "Ich habe mich verlaufen", it: "Mi sono perso",
      pt: "Estou perdido", ru: "Я заблудился", ja: "迷子です", zh: "我迷路了", ar: "أنا ضائع",
    },
  },
  {
    key: "call ambulance",
    category: "Emergencies",
    translations: {
      en: "Call an ambulance", es: "Llame a una ambulancia", fr: "Appelez une ambulance", de: "Rufen Sie einen Krankenwagen", it: "Chiami un'ambulanza",
      pt: "Chame uma ambulância", ru: "Вызовите скорую", ja: "救急車を呼んでください", zh: "请叫救护车", ar: "اتصل بالإسعاف",
    },
  },
  {
    key: "emergency",
    category: "Emergencies",
    translations: {
      en: "Emergency", es: "Emergencia", fr: "Urgence", de: "Notfall", it: "Emergenza",
      pt: "Emergência", ru: "Чрезвычайная ситуация", ja: "緊急", zh: "紧急", ar: "طوارئ",
    },
  },
  // ----- Common adjectives (10) -----
  {
    key: "open",
    category: "Common",
    translations: {
      en: "Open", es: "Abierto", fr: "Ouvert", de: "Geöffnet", it: "Aperto",
      pt: "Aberto", ru: "Открыто", ja: "開いてる", zh: "营业", ar: "مفتوح",
    },
  },
  {
    key: "closed",
    category: "Common",
    translations: {
      en: "Closed", es: "Cerrado", fr: "Fermé", de: "Geschlossen", it: "Chiuso",
      pt: "Fechado", ru: "Закрыто", ja: "閉まってる", zh: "关门", ar: "مغلق",
    },
  },
  {
    key: "free",
    category: "Common",
    translations: {
      en: "Free", es: "Gratis", fr: "Gratuit", de: "Kostenlos", it: "Gratuito",
      pt: "Grátis", ru: "Бесплатно", ja: "無料", zh: "免费", ar: "مجاني",
    },
  },
  {
    key: "busy",
    category: "Common",
    translations: {
      en: "Busy", es: "Ocupado", fr: "Occupé", de: "Beschäftigt", it: "Occupato",
      pt: "Ocupado", ru: "Занято", ja: "忙しい", zh: "忙", ar: "مشغول",
    },
  },
  {
    key: "hot",
    category: "Common",
    translations: {
      en: "Hot", es: "Caliente", fr: "Chaud", de: "Heiß", it: "Caldo",
      pt: "Quente", ru: "Горячо", ja: "熱い", zh: "热", ar: "حار",
    },
  },
  {
    key: "cold",
    category: "Common",
    translations: {
      en: "Cold", es: "Frío", fr: "Froid", de: "Kalt", it: "Freddo",
      pt: "Frio", ru: "Холодно", ja: "冷たい", zh: "冷", ar: "بارد",
    },
  },
  {
    key: "big",
    category: "Common",
    translations: {
      en: "Big", es: "Grande", fr: "Grand", de: "Groß", it: "Grande",
      pt: "Grande", ru: "Большой", ja: "大きい", zh: "大", ar: "كبير",
    },
  },
  {
    key: "small",
    category: "Common",
    translations: {
      en: "Small", es: "Pequeño", fr: "Petit", de: "Klein", it: "Piccolo",
      pt: "Pequeno", ru: "Маленький", ja: "小さい", zh: "小", ar: "صغير",
    },
  },
  {
    key: "good",
    category: "Common",
    translations: {
      en: "Good", es: "Bueno", fr: "Bon", de: "Gut", it: "Buono",
      pt: "Bom", ru: "Хорошо", ja: "良い", zh: "好", ar: "جيد",
    },
  },
  {
    key: "bad",
    category: "Common",
    translations: {
      en: "Bad", es: "Malo", fr: "Mauvais", de: "Schlecht", it: "Cattivo",
      pt: "Mau", ru: "Плохо", ja: "悪い", zh: "坏", ar: "سيء",
    },
  },
  // ----- Question words (6) -----
  {
    key: "where",
    category: "Questions",
    translations: {
      en: "Where", es: "Dónde", fr: "Où", de: "Wo", it: "Dove",
      pt: "Onde", ru: "Где", ja: "どこ", zh: "哪里", ar: "أين",
    },
  },
  {
    key: "when",
    category: "Questions",
    translations: {
      en: "When", es: "Cuándo", fr: "Quand", de: "Wann", it: "Quando",
      pt: "Quando", ru: "Когда", ja: "いつ", zh: "什么时候", ar: "متى",
    },
  },
  {
    key: "who",
    category: "Questions",
    translations: {
      en: "Who", es: "Quién", fr: "Qui", de: "Wer", it: "Chi",
      pt: "Quem", ru: "Кто", ja: "誰", zh: "谁", ar: "من",
    },
  },
  {
    key: "why",
    category: "Questions",
    translations: {
      en: "Why", es: "Por qué", fr: "Pourquoi", de: "Warum", it: "Perché",
      pt: "Por que", ru: "Почему", ja: "なぜ", zh: "为什么", ar: "لماذا",
    },
  },
  {
    key: "how",
    category: "Questions",
    translations: {
      en: "How", es: "Cómo", fr: "Comment", de: "Wie", it: "Come",
      pt: "Como", ru: "Как", ja: "どう", zh: "怎么", ar: "كيف",
    },
  },
  {
    key: "what",
    category: "Questions",
    translations: {
      en: "What", es: "Qué", fr: "Quoi", de: "Was", it: "Cosa",
      pt: "O que", ru: "Что", ja: "何", zh: "什么", ar: "ماذا",
    },
  },
  // ----- Time (8) -----
  {
    key: "now",
    category: "Time",
    translations: {
      en: "Now", es: "Ahora", fr: "Maintenant", de: "Jetzt", it: "Adesso",
      pt: "Agora", ru: "Сейчас", ja: "今", zh: "现在", ar: "الآن",
    },
  },
  {
    key: "later",
    category: "Time",
    translations: {
      en: "Later", es: "Después", fr: "Plus tard", de: "Später", it: "Più tardi",
      pt: "Depois", ru: "Позже", ja: "後で", zh: "以后", ar: "لاحقا",
    },
  },
  {
    key: "week",
    category: "Time",
    translations: {
      en: "Week", es: "Semana", fr: "Semaine", de: "Woche", it: "Settimana",
      pt: "Semana", ru: "Неделя", ja: "週", zh: "周", ar: "أسبوع",
    },
  },
  {
    key: "month",
    category: "Time",
    translations: {
      en: "Month", es: "Mes", fr: "Mois", de: "Monat", it: "Mese",
      pt: "Mês", ru: "Месяц", ja: "月", zh: "月", ar: "شهر",
    },
  },
  {
    key: "year",
    category: "Time",
    translations: {
      en: "Year", es: "Año", fr: "Année", de: "Jahr", it: "Anno",
      pt: "Ano", ru: "Год", ja: "年", zh: "年", ar: "سنة",
    },
  },
  {
    key: "morning",
    category: "Time",
    translations: {
      en: "Morning", es: "Mañana", fr: "Matin", de: "Morgen", it: "Mattina",
      pt: "Manhã", ru: "Утро", ja: "朝", zh: "早晨", ar: "صباح",
    },
  },
  {
    key: "afternoon",
    category: "Time",
    translations: {
      en: "Afternoon", es: "Tarde", fr: "Après-midi", de: "Nachmittag", it: "Pomeriggio",
      pt: "Tarde", ru: "День", ja: "午後", zh: "下午", ar: "بعد الظهر",
    },
  },
  {
    key: "night",
    category: "Time",
    translations: {
      en: "Night", es: "Noche", fr: "Nuit", de: "Nacht", it: "Notte",
      pt: "Noite", ru: "Ночь", ja: "夜", zh: "夜晚", ar: "ليل",
    },
  },
  // ----- More common (10) -----
  {
    key: "i love you",
    category: "Common",
    translations: {
      en: "I love you", es: "Te quiero", fr: "Je t'aime", de: "Ich liebe dich", it: "Ti amo",
      pt: "Eu te amo", ru: "Я тебя люблю", ja: "愛してる", zh: "我爱你", ar: "أحبك",
    },
  },
  {
    key: "happy birthday",
    category: "Common",
    translations: {
      en: "Happy birthday", es: "Feliz cumpleaños", fr: "Joyeux anniversaire", de: "Alles Gute zum Geburtstag", it: "Buon compleanno",
      pt: "Feliz aniversário", ru: "С днём рождения", ja: "お誕生日おめでとう", zh: "生日快乐", ar: "عيد ميلاد سعيد",
    },
  },
  {
    key: "congratulations",
    category: "Common",
    translations: {
      en: "Congratulations", es: "Felicidades", fr: "Félicitations", de: "Herzlichen Glückwunsch", it: "Congratulazioni",
      pt: "Parabéns", ru: "Поздравляю", ja: "おめでとうございます", zh: "恭喜", ar: "تهانينا",
    },
  },
  {
    key: "cheers",
    category: "Common",
    translations: {
      en: "Cheers", es: "Salud", fr: "Santé", de: "Prost", it: "Cin cin",
      pt: "Saúde", ru: "Будем", ja: "乾杯", zh: "干杯", ar: "في صحتك",
    },
  },
  {
    key: "bless you",
    category: "Common",
    translations: {
      en: "Bless you", es: "Salud", fr: "À vos souhaits", de: "Gesundheit", it: "Salute",
      pt: "Saúde", ru: "Будь здоров", ja: "お大事に", zh: "保重", ar: "يرحمك الله",
    },
  },
  {
    key: "happy new year",
    category: "Common",
    translations: {
      en: "Happy New Year", es: "Feliz año nuevo", fr: "Bonne année", de: "Frohes neues Jahr", it: "Buon anno",
      pt: "Feliz ano novo", ru: "С новым годом", ja: "明けましておめでとう", zh: "新年快乐", ar: "كل عام وأنتم بخير",
    },
  },
  {
    key: "merry christmas",
    category: "Common",
    translations: {
      en: "Merry Christmas", es: "Feliz Navidad", fr: "Joyeux Noël", de: "Frohe Weihnachten", it: "Buon Natale",
      pt: "Feliz Natal", ru: "С рождеством", ja: "メリークリスマス", zh: "圣诞快乐", ar: "كريسماس سعيد",
    },
  },
  {
    key: "good luck",
    category: "Common",
    translations: {
      en: "Good luck", es: "Buena suerte", fr: "Bonne chance", de: "Viel Glück", it: "Buona fortuna",
      pt: "Boa sorte", ru: "Удачи", ja: "幸運を祈ります", zh: "祝你好运", ar: "حظا سعيدا",
    },
  },
  {
    key: "take care",
    category: "Common",
    translations: {
      en: "Take care", es: "Cuídate", fr: "Prends soin de toi", de: "Pass auf dich auf", it: "Stai attento",
      pt: "Tome cuidado", ru: "Береги себя", ja: "お元気で", zh: "保重", ar: "اعتنِ بنفسك",
    },
  },
  {
    key: "have a nice day",
    category: "Common",
    translations: {
      en: "Have a nice day", es: "Que tengas un buen día", fr: "Bonne journée", de: "Schönen Tag noch", it: "Buona giornata",
      pt: "Tenha um bom dia", ru: "Хорошего дня", ja: "良い一日を", zh: "祝你一天愉快", ar: "أتمنى لك يوما سعيدا",
    },
  },
];

/** Get phrase count by category. */
export function getPhraseCount(): number {
  return PHRASEBOOK.length;
}

/** Get categories list. */
export function getCategories(): string[] {
  return [...new Set(PHRASEBOOK.map((p) => p.category))];
}

// ---------- Language detection ----------

/** Detect the language of a text via script heuristics. */
export function detectLanguage(text: string): { lang: LanguageCode; confidence: number } {
  if (!text || !text.trim()) return { lang: "en", confidence: 0 };
  const t = text.trim();
  // Arabic script
  if (/[\u0600-\u06FF]/.test(t)) return { lang: "ar", confidence: 0.95 };
  // Cyrillic
  if (/[\u0400-\u04FF]/.test(t)) return { lang: "ru", confidence: 0.95 };
  // Hiragana/Katakana → Japanese
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(t)) return { lang: "ja", confidence: 0.95 };
  // Han → Chinese (default, since Japanese uses Han too but we already detected kana above)
  if (/[\u4E00-\u9FFF]/.test(t)) return { lang: "zh", confidence: 0.85 };
  // Latin script — score by diacritics/keywords.
  const lower = t.toLowerCase();
  const scores: Record<LanguageCode, number> = { en: 0, es: 0, fr: 0, de: 0, it: 0, pt: 0, ru: 0, ja: 0, zh: 0, ar: 0 };
  // Diacritic markers — chosen for maximum discrimination between languages.
  if (/[ñ¿¡]/.test(lower)) scores.es += 2;           // uniquely Spanish (ñ)
  if (/[ãõâêô]/.test(lower)) scores.pt += 2;          // uniquely Portuguese (ã, õ, circumflex)
  if (/[àâçéèêëîïûùÿœæ]/.test(lower)) scores.fr += 2; // uniquely French (ç, à, â, etc.)
  if (/[äöüß]/.test(lower)) scores.de += 2;           // uniquely German (umlauts + ß)
  if (/[ìò]/.test(lower)) scores.it += 2;             // Italian grave accents (ì is rare elsewhere)
  // Common word markers — strip trailing punctuation so "Hola," matches "hola".
  const stripped = lower.split(/\s+/).map((w) => w.replace(/[.,!?;:¿¡""']+$/g, "").replace(/^[¿¡""']+/g, ""));
  const has = (arr: string[]) => arr.some((w) => stripped.includes(w));
  if (has(["el", "la", "los", "las", "de", "y", "que", "hola", "gracias", "adiós"])) scores.es += 1;
  if (has(["le", "la", "les", "de", "et", "que", "bonjour", "merci", "au"])) scores.fr += 1;
  if (has(["der", "die", "das", "und", "dass", "hallo", "danke", "auf"])) scores.de += 1;
  if (has(["il", "lo", "la", "i", "gli", "ciao", "grazie", "arrivederci"])) scores.it += 1;
  if (has(["o", "a", "os", "as", "de", "e", "olá", "obrigado", "adeus"])) scores.pt += 1;
  if (has(["the", "and", "of", "to", "hello", "thanks", "goodbye"])) scores.en += 1;
  // Pick highest score; default English.
  let best: LanguageCode = "en";
  let bestScore = scores.en;
  for (const code of Object.keys(scores) as LanguageCode[]) {
    if (scores[code] > bestScore) {
      best = code;
      bestScore = scores[code];
    }
  }
  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  const confidence = Math.min(0.95, 0.3 + bestScore / total);
  return { lang: best, confidence };
}

// ---------- Translation memory (localStorage) ----------

export function loadTranslationMemory(): TranslationMemoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(TM_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as TranslationMemoryEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function addToTranslationMemory(entry: Omit<TranslationMemoryEntry, "ts">): TranslationMemoryEntry[] {
  const next = loadTranslationMemory().filter(
    (e) => !(e.source === entry.source && e.target === entry.target && e.sourceText.toLowerCase() === entry.sourceText.toLowerCase()),
  );
  next.unshift({ ...entry, ts: Date.now() });
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(TM_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearTranslationMemory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(TM_KEY);
  } catch {
    // ignore
  }
}

/** Lookup a phrase in TM (case-insensitive). */
export function lookupTranslationMemory(
  source: LanguageCode,
  target: LanguageCode,
  sourceText: string,
): TranslationMemoryEntry | null {
  const memory = loadTranslationMemory();
  const lower = sourceText.toLowerCase();
  for (const e of memory) {
    if (e.source === source && e.target === target && e.sourceText.toLowerCase() === lower) {
      return e;
    }
  }
  return null;
}

// ---------- Glossary (do-not-translate list) ----------

export function loadGlossary(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(GLOSSARY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveGlossary(terms: string[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(GLOSSARY_KEY, JSON.stringify(terms));
  } catch {
    // ignore
  }
}

export function clearGlossary(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(GLOSSARY_KEY);
  } catch {
    // ignore
  }
}

// ---------- Translation engine ----------

interface PhraseHit {
  start: number;
  end: number;
  entry: PhraseEntry;
  original: string;
}

/** Find all phrase hits in text for a source language. Longest match first. */
export function findPhraseHits(text: string, source: LanguageCode): PhraseHit[] {
  if (!text) return [];
  // Build list of (phrase, entry) for this source language, sort longest first.
  const pairs: { phrase: string; entry: PhraseEntry }[] = [];
  for (const entry of PHRASEBOOK) {
    const phrase = entry.translations[source];
    if (!phrase) continue;
    pairs.push({ phrase, entry });
  }
  pairs.sort((a, b) => b.phrase.length - a.phrase.length);
  const hits: PhraseHit[] = [];
  const consumed: boolean[] = new Array(text.length).fill(false);
  const lower = text.toLowerCase();
  for (const { phrase, entry } of pairs) {
    const lowerPhrase = phrase.toLowerCase();
    // Strip trailing punctuation for matching (e.g. "?", "!", ".").
    const matchPhrase = lowerPhrase.replace(/[.?!,;:]+$/, "");
    const displayPhrase = lowerPhrase;
    if (!matchPhrase) continue;
    let idx = 0;
    while (idx < lower.length) {
      const at = lower.indexOf(matchPhrase, idx);
      if (at < 0) break;
      const end = at + matchPhrase.length;
      // Check no overlap with already-consumed positions.
      let overlap = false;
      for (let i = at; i < end; i++) {
        if (consumed[i]) { overlap = true; break; }
      }
      // Extend end to include trailing punctuation if it matches the display phrase.
      let extendedEnd = end;
      while (extendedEnd < text.length && /[.?!,;:]/.test(text[extendedEnd]) && displayPhrase.length > matchPhrase.length) {
        // Only include the punctuation if it's in the original phrase.
        const expectedChar = displayPhrase[extendedEnd - at];
        if (text[extendedEnd].toLowerCase() === expectedChar) {
          extendedEnd++;
        } else {
          break;
        }
      }
      if (!overlap) {
        for (let i = at; i < end; i++) consumed[i] = true;
        hits.push({
          start: at,
          end: extendedEnd,
          entry,
          original: text.slice(at, extendedEnd),
        });
      }
      idx = end;
    }
  }
  hits.sort((a, b) => a.start - b.start);
  return hits;
}

/** Translate text from source to target using phrasebook + TM. */
export function translateText(
  text: string,
  source: LanguageCode | "auto",
  target: LanguageCode,
  glossary: string[] = [],
): TranslationResult {
  const detected = source === "auto" ? detectLanguage(text) : { lang: source, confidence: 1 };
  const src = detected.lang;
  if (!text || !text.trim()) {
    return {
      source: src,
      target,
      original: text,
      translated: "",
      matches: [],
      detected: src,
      detectedConfidence: detected.confidence,
      passthroughCount: 0,
      dictionaryHits: 0,
      memoryHits: 0,
      rtl: RTL_LANGUAGES.includes(target),
    };
  }
  // If source === target, just return text.
  if (src === target) {
    return {
      source: src,
      target,
      original: text,
      translated: text,
      matches: [{ start: 0, end: text.length, original: text, translated: text, source: "passthrough" }],
      detected: src,
      detectedConfidence: detected.confidence,
      passthroughCount: 1,
      dictionaryHits: 0,
      memoryHits: 0,
      rtl: RTL_LANGUAGES.includes(target),
    };
  }
  const hits = findPhraseHits(text, src);
  const matches: TranslationMatch[] = [];
  let out = "";
  let cursor = 0;
  let dictHits = 0;
  let memHits = 0;
  let passCount = 0;
  // Process the text: for each hit, emit the gap (passthrough) then the translation.
  for (const hit of hits) {
    if (hit.start > cursor) {
      const gap = text.slice(cursor, hit.start);
      out += translateGap(gap, src, target, glossary);
      matches.push({ start: cursor, end: hit.start, original: gap, translated: gap, source: "passthrough" });
      passCount++;
    }
    // Check glossary do-not-translate.
    const originalPhrase = hit.original.toLowerCase().replace(/[.?!,;:]+$/, "");
    if (glossary.some((g) => g.toLowerCase() === originalPhrase)) {
      out += hit.original;
      matches.push({ start: hit.start, end: hit.end, original: hit.original, translated: hit.original, source: "passthrough" });
      passCount++;
    } else {
      // Try TM first.
      const tm = lookupTranslationMemory(src, target, hit.original);
      if (tm) {
        out += tm.targetText;
        matches.push({ start: hit.start, end: hit.end, original: hit.original, translated: tm.targetText, source: "memory" });
        memHits++;
      } else {
        const translated = hit.entry.translations[target];
        out += translated;
        matches.push({ start: hit.start, end: hit.end, original: hit.original, translated, source: "dictionary" });
        dictHits++;
      }
    }
    cursor = hit.end;
  }
  // Trailing gap.
  if (cursor < text.length) {
    const gap = text.slice(cursor);
    out += translateGap(gap, src, target, glossary);
    matches.push({ start: cursor, end: text.length, original: gap, translated: gap, source: "passthrough" });
    passCount++;
  }
  // If no hits at all, the whole text is passthrough — try TM for the whole string.
  if (hits.length === 0) {
    const tm = lookupTranslationMemory(src, target, text);
    if (tm) {
      out = tm.targetText;
      matches.length = 0;
      matches.push({ start: 0, end: text.length, original: text, translated: tm.targetText, source: "memory" });
      memHits = 1;
      passCount = 0;
    }
  }
  return {
    source: src,
    target,
    original: text,
    translated: out,
    matches,
    detected: src,
    detectedConfidence: detected.confidence,
    passthroughCount: passCount,
    dictionaryHits: dictHits,
    memoryHits: memHits,
    rtl: RTL_LANGUAGES.includes(target),
  };
}

/** Translate a gap (whitespace, punctuation, unknown text). Pass through unchanged. */
function translateGap(gap: string, _src: LanguageCode, _target: LanguageCode, _glossary: string[]): string {
  return gap;
}

/** Swap source and target languages. */
export function swapLanguages(source: LanguageCode | "auto", target: LanguageCode): {
  source: LanguageCode | "auto";
  target: LanguageCode;
} {
  if (source === "auto") {
    return { source: target, target: "en" };
  }
  return { source: target, target: source };
}

// ---------- Batch mode ----------

/** Translate multiple lines at once. */
export function translateBatch(
  lines: string[],
  source: LanguageCode | "auto",
  target: LanguageCode,
  glossary: string[] = [],
): TranslationResult[] {
  return lines.map((line) => translateText(line, source, target, glossary));
}

/** Split text into lines (trim trailing newline). */
export function splitLines(text: string): string[] {
  if (!text) return [];
  return text.replace(/\r\n/g, "\n").split("\n");
}

// ---------- Transliteration ----------

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

const ARABIC_TO_LATIN: Record<string, string> = {
  ا: "a", ب: "b", ت: "t", ث: "th", ج: "j", ح: "h", خ: "kh", د: "d",
  ذ: "dh", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t",
  ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m",
  ن: "n", ه: "h", و: "w", ي: "y", ة: "a", ى: "a", ء: "",
};

/** Transliterate Cyrillic or Arabic text to Latin script. */
export function transliterate(text: string, lang: LanguageCode): string {
  if (!text) return "";
  if (lang === "ru") {
    let out = "";
    for (const ch of text) {
      const lower = ch.toLowerCase();
      const tr = CYRILLIC_TO_LATIN[lower];
      if (tr !== undefined) {
        out += ch === lower ? tr : tr.charAt(0).toUpperCase() + tr.slice(1);
      } else {
        out += ch;
      }
    }
    return out;
  }
  if (lang === "ar") {
    let out = "";
    for (const ch of text) {
      const tr = ARABIC_TO_LATIN[ch];
      out += tr !== undefined ? tr : ch;
    }
    return out;
  }
  return text;
}

/** Check if a language is RTL. */
export function isRtl(lang: LanguageCode): boolean {
  return RTL_LANGUAGES.includes(lang);
}

// ---------- Character / word counting ----------

export function countChars(text: string): number {
  return text ? text.length : 0;
}

export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  // For CJK, count characters as words.
  if (/[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
    const cjk = text.match(/[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/g);
    const nonCjk = text.replace(/[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/g, " ").trim().split(/\s+/).filter(Boolean);
    return (cjk?.length ?? 0) + nonCjk.length;
  }
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ---------- Rendering ----------

/** Render translation as a side-by-side markdown table. */
export function renderMarkdownTable(results: TranslationResult[]): string {
  const lines: string[] = ["| Source | Target | Method |", "| --- | --- | --- |"];
  for (const r of results) {
    const method = r.memoryHits > 0 ? "memory" : r.dictionaryHits > 0 ? "dictionary" : "passthrough";
    lines.push(`| ${r.original.replace(/\|/g, "\\|")} | ${r.translated.replace(/\|/g, "\\|")} | ${method} |`);
  }
  return lines.join("\n");
}

/** Render translation as plain text (target only). */
export function renderPlainText(results: TranslationResult[]): string {
  return results.map((r) => r.translated).join("\n");
}

// ---------- LLM helpers ----------

/** Build a prompt for an optional LLM translation. */
export function buildLlmPrompt(
  text: string,
  source: LanguageCode | "auto",
  target: LanguageCode,
): string {
  const srcLabel = source === "auto" ? "auto-detect" : LANGUAGE_LABELS[source];
  return [
    `Translate the following text from ${srcLabel} to ${LANGUAGE_LABELS[target]}.`,
    `Preserve formatting, line breaks, and any HTML/markup.`,
    `If the source is already in ${LANGUAGE_LABELS[target]}, return it unchanged.`,
    `Output only the translation — no commentary, no quotes.`,
    "",
    "TEXT:",
    text,
  ].join("\n");
}

/** Render an LLM response for display. */
export function renderLlmResult(raw: string): string {
  return (raw || "").trim();
}

// ---------- History (localStorage) ----------

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

// ---------- Shareable URL ----------

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("src", state.source);
  params.set("tgt", state.target);
  if (state.text) params.set("text", state.text);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const validLangs = LANGUAGES.map((l) => l.code);
  if (!clean) return { source: "auto", target: "en", text: "" };
  const params = new URLSearchParams(clean);
  const srcRaw = params.get("src") ?? "auto";
  const source: LanguageCode | "auto" = srcRaw === "auto" ? "auto" : (validLangs.includes(srcRaw as LanguageCode) ? srcRaw as LanguageCode : "auto");
  const tgtRaw = params.get("tgt") ?? "en";
  const target: LanguageCode = validLangs.includes(tgtRaw as LanguageCode) ? tgtRaw as LanguageCode : "en";
  const text = params.get("text") ?? "";
  return { source, target, text };
}
