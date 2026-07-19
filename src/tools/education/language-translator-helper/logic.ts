/**
 * Language Translator Helper — pure logic.
 *
 * Built-in phrase book, conjugation tables, and number translator across
 * 10 languages × 8 categories. Pure functions only — no DOM, no network.
 * The UI is read-only learning aid; nothing is sent to a server.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LanguageCode =
  | "english"
  | "spanish"
  | "french"
  | "german"
  | "italian"
  | "portuguese"
  | "hindi"
  | "japanese"
  | "chinese"
  | "arabic";

export type PhraseCategory =
  | "greetings"
  | "travel"
  | "food"
  | "numbers"
  | "time"
  | "emergencies"
  | "shopping"
  | "directions";

export type PracticeMode = "browse" | "flashcard" | "reverse-translation";

export type Difficulty = "basic" | "intermediate" | "advanced";

export interface Phrase {
  id: string;
  category: PhraseCategory;
  /** Source text in English. */
  english: string;
  /** Translations keyed by language code (excludes english). */
  translations: Partial<Record<LanguageCode, string>>;
  /** Romanized pronunciation for non-Latin scripts. */
  pronunciation?: Partial<Record<LanguageCode, string>>;
  difficulty: Difficulty;
}

export interface ConjugationTable {
  verb: string; // English verb
  /** Per-language conjugation across 6 tenses × 6 persons (I/you/he-she-it/we/they). */
  byLanguage: Partial<Record<LanguageCode, Record<Tense, string[]>>>;
}

export type Tense =
  | "present"
  | "past"
  | "future"
  | "imperfect"
  | "conditional"
  | "subjunctive";

export interface NumberTranslation {
  num: number;
  /** Per-language word for the number (1-100). */
  byLanguage: Partial<Record<LanguageCode, string>>;
}

export interface HistoryEntry {
  ts: number;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  category: PhraseCategory;
  mode: PracticeMode;
  phraseCount: number;
}

export interface SummaryStats {
  totalPhrases: number;
  byCategory: Record<PhraseCategory, number>;
  byLanguagePair: number;
}

// ---------------------------------------------------------------------------
// Language + category presets
// ---------------------------------------------------------------------------

export const LANGUAGES: LanguageCode[] = [
  "english", "spanish", "french", "german", "italian",
  "portuguese", "hindi", "japanese", "chinese", "arabic",
];

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  english: "English",
  spanish: "Spanish",
  french: "French",
  german: "German",
  italian: "Italian",
  portuguese: "Portuguese",
  hindi: "Hindi",
  japanese: "Japanese",
  chinese: "Chinese",
  arabic: "Arabic",
};

/** Languages that use a non-Latin script and need romanized pronunciation. */
export const NON_LATIN_LANGUAGES: LanguageCode[] = ["hindi", "japanese", "chinese", "arabic"];

export const CATEGORIES: PhraseCategory[] = [
  "greetings", "travel", "food", "numbers",
  "time", "emergencies", "shopping", "directions",
];

export const CATEGORY_LABELS: Record<PhraseCategory, string> = {
  greetings: "Greetings & Politeness",
  travel: "Travel & Transport",
  food: "Food & Drink",
  numbers: "Numbers",
  time: "Time & Date",
  emergencies: "Emergencies",
  shopping: "Shopping & Money",
  directions: "Directions",
};

export const PRACTICE_MODES: PracticeMode[] = ["browse", "flashcard", "reverse-translation"];

export const PRACTICE_MODE_LABELS: Record<PracticeMode, string> = {
  browse: "Browse",
  flashcard: "Flashcard",
  "reverse-translation": "Reverse Translation",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  basic: "Basic",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

// ---------------------------------------------------------------------------
// Built-in phrase book (200+ phrases across 10 languages × 8 categories)
// ---------------------------------------------------------------------------

// Helper to assemble a Phrase object with less ceremony.
function p(
  id: string,
  category: PhraseCategory,
  english: string,
  translations: Partial<Record<LanguageCode, string>>,
  extras: {
    pronunciation?: Partial<Record<LanguageCode, string>>;
    difficulty?: Difficulty;
  } = {},
): Phrase {
  return {
    id,
    category,
    english,
    translations,
    pronunciation: extras.pronunciation,
    difficulty: extras.difficulty ?? "basic",
  };
}

export const PHRASES: Phrase[] = [
  // ---- Greetings (28 phrases) ----
  p("g-01", "greetings", "Hello", {
    spanish: "Hola", french: "Bonjour", german: "Hallo", italian: "Ciao",
    portuguese: "Olá", hindi: "Namaste", japanese: "Konnichiwa", chinese: "Nǐ hǎo", arabic: "Marhaba",
  }, { pronunciation: { hindi: "nuh-muh-stay", japanese: "kon-nee-chee-wah", chinese: "nee how", arabic: "mar-ha-ba" } }),
  p("g-02", "greetings", "Good morning", {
    spanish: "Buenos días", french: "Bonjour", german: "Guten Morgen", italian: "Buongiorno",
    portuguese: "Bom dia", hindi: "Suprabhat", japanese: "Ohayou", chinese: "Zǎo ān", arabic: "Sabah al-khayr",
  }, { pronunciation: { hindi: "sup-rah-bhat", japanese: "oh-hah-yoh", chinese: "dzah-ow an", arabic: "sa-bah al-khair" }, difficulty: "basic" }),
  p("g-03", "greetings", "Good afternoon", {
    spanish: "Buenas tardes", french: "Bon après-midi", german: "Guten Tag", italian: "Buon pomeriggio",
    portuguese: "Boa tarde", hindi: "Namaste", japanese: "Konnichiwa", chinese: "Xiàwǔ hǎo", arabic: "Masa' al-khayr",
  }, { pronunciation: { chinese: "shyah-woo how", arabic: "ma-sa al-khair" } }),
  p("g-04", "greetings", "Good evening", {
    spanish: "Buenas noches", french: "Bonsoir", german: "Guten Abend", italian: "Buonasera",
    portuguese: "Boa noite", hindi: "Shubh sandhya", japanese: "Konbanwa", chinese: "Wǎnshàng hǎo", arabic: "Masa' al-khayr",
  }, { pronunciation: { hindi: "shub sand-yah", japanese: "kon-bahn-wah", chinese: "wan-shang how" } }),
  p("g-05", "greetings", "Good night", {
    spanish: "Buenas noches", french: "Bonne nuit", german: "Gute Nacht", italian: "Buonanotte",
    portuguese: "Boa noite", hindi: "Shubh ratri", japanese: "Oyasuminasai", chinese: "Wǎn'ān", arabic: "Layla sa'ida",
  }, { pronunciation: { hindi: "shub rah-tree", japanese: "oh-yah-soo-mee-nah-sai", chinese: "wan-an" } }),
  p("g-06", "greetings", "Goodbye", {
    spanish: "Adiós", french: "Au revoir", german: "Auf Wiedersehen", italian: "Arrivederci",
    portuguese: "Adeus", hindi: "Alvida", japanese: "Sayounara", chinese: "Zàijiàn", arabic: "Ma'a as-salama",
  }, { pronunciation: { hindi: "al-vee-dah", japanese: "sah-yoh-nah-rah", chinese: "dzai-jyen", arabic: "ma-ah as-sa-la-ma" } }),
  p("g-07", "greetings", "Please", {
    spanish: "Por favor", french: "S'il vous plaît", german: "Bitte", italian: "Per favore",
    portuguese: "Por favor", hindi: "Kripya", japanese: "Kudasai", chinese: "Qǐng", arabic: "Min fadlik",
  }, { pronunciation: { hindi: "krip-yah", japanese: "koo-dah-sai", chinese: "ching", arabic: "min fad-lik" } }),
  p("g-08", "greetings", "Thank you", {
    spanish: "Gracias", french: "Merci", german: "Danke", italian: "Grazie",
    portuguese: "Obrigado", hindi: "Dhanyavad", japanese: "Arigatou", chinese: "Xièxiè", arabic: "Shukran",
  }, { pronunciation: { hindi: "dhahn-yuh-vahd", japanese: "ah-ree-gah-toh", chinese: "shyeh-shyeh", arabic: "shook-ran" } }),
  p("g-09", "greetings", "You're welcome", {
    spanish: "De nada", french: "De rien", german: "Gern geschehen", italian: "Prego",
    portuguese: "De nada", hindi: "Swagat hai", japanese: "Dou itashimashite", chinese: "Bù kèqì", arabic: "Afwan",
  }, { pronunciation: { hindi: "swahg-uht hai", japanese: "doh-ee-tah-shee-mah-shtay", chinese: "boo kuh-chee", arabic: "af-wan" }, difficulty: "intermediate" }),
  p("g-10", "greetings", "Yes", {
    spanish: "Sí", french: "Oui", german: "Ja", italian: "Sì",
    portuguese: "Sim", hindi: "Haan", japanese: "Hai", chinese: "Shì", arabic: "Na'am",
  }, { pronunciation: { hindi: "hahn", japanese: "hai", chinese: "shr", arabic: "na-am" } }),
  p("g-11", "greetings", "No", {
    spanish: "No", french: "Non", german: "Nein", italian: "No",
    portuguese: "Não", hindi: "Nahi", japanese: "Iie", chinese: "Bù", arabic: "La",
  }, { pronunciation: { hindi: "nah-hee", japanese: "ee-eh", chinese: "boo", arabic: "lah" } }),
  p("g-12", "greetings", "Excuse me", {
    spanish: "Disculpe", french: "Excusez-moi", german: "Entschuldigung", italian: "Mi scusi",
    portuguese: "Com licença", hindi: "Maaf kijiye", japanese: "Sumimasen", chinese: "Bù hǎoyìsi", arabic: "Law samaht",
  }, { pronunciation: { hindi: "mahf kee-jee-yay", japanese: "soo-mee-mah-sen", chinese: "boo how-ee-shr", arabic: "law sah-maht" }, difficulty: "intermediate" }),
  p("g-13", "greetings", "Sorry", {
    spanish: "Lo siento", french: "Pardon", german: "Es tut mir leid", italian: "Mi dispiace",
    portuguese: "Desculpe", hindi: "Maaf karo", japanese: "Gomen nasai", chinese: "Duìbùqǐ", arabic: "Asif",
  }, { pronunciation: { hindi: "mahf kah-roh", japanese: "go-men nah-sai", chinese: "dway-boo-chee", arabic: "ah-seef" } }),
  p("g-14", "greetings", "My name is…", {
    spanish: "Me llamo…", french: "Je m'appelle…", german: "Ich heiße…", italian: "Mi chiamo…",
    portuguese: "Meu nome é…", hindi: "Mera naam… hai", japanese: "Watashi no namae wa… desu", chinese: "Wǒ jiào…", arabic: "Ismi…",
  }, { pronunciation: { hindi: "may-rah nahm hai", japanese: "wah-tah-shee no nah-mah-eh wah des", chinese: "woh jow", arabic: "is-mee" }, difficulty: "intermediate" }),
  p("g-15", "greetings", "How are you?", {
    spanish: "¿Cómo estás?", french: "Comment allez-vous?", german: "Wie geht es dir?", italian: "Come stai?",
    portuguese: "Como vai?", hindi: "Aap kaise hain?", japanese: "Ogenki desu ka?", chinese: "Nǐ hǎo ma?", arabic: "Kayf halak?",
  }, { pronunciation: { hindi: "ahp kay-say hain", japanese: "oh-gen-kee des kah", chinese: "nee how mah", arabic: "kayf hah-lak" }, difficulty: "intermediate" }),
  p("g-16", "greetings", "I'm fine, thanks", {
    spanish: "Estoy bien, gracias", french: "Je vais bien, merci", german: "Mir geht es gut, danke", italian: "Sto bene, grazie",
    portuguese: "Estou bem, obrigado", hindi: "Main theek hoon, dhanyavad", japanese: "Genki desu, arigatou", chinese: "Wǒ hěn hǎo, xièxiè", arabic: "Ana bikhayr, shukran",
  }, { pronunciation: { hindi: "main tayk hoon dhahn-yuh-vahd", japanese: "gen-kee des ah-ree-gah-toh", chinese: "woh hun how shyeh-shyeh", arabic: "ah-nah bee-khair shook-ran" }, difficulty: "intermediate" }),
  p("g-17", "greetings", "Nice to meet you", {
    spanish: "Encantado", french: "Enchanté", german: "Freut mich", italian: "Piacere",
    portuguese: "Prazer", hindi: "Aapse milkar khushi hui", japanese: "Hajimemashite", chinese: "Hěn gāoxìng rènshí nǐ", arabic: "Tasharrafna",
  }, { pronunciation: { hindi: "ahp-say mil-kar khoo-shee hoo-ee", japanese: "hah-jee-may-mah-shee-tay", chinese: "hun gow-shing ren-shr nee", arabic: "tah-shah-raf-nah" }, difficulty: "advanced" }),
  p("g-18", "greetings", "See you later", {
    spanish: "Hasta luego", french: "À plus tard", german: "Bis später", italian: "A dopo",
    portuguese: "Até logo", hindi: "Phir milenge", japanese: "Mata ato de", chinese: "Huìtóu jiàn", arabic: "Araka lahiqan",
  }, { pronunciation: { hindi: "feer mee-leng-ay", japanese: "mah-tah ah-toh day", chinese: "hway-toh jyen", arabic: "ah-rah-kah lah-hee-kan" }, difficulty: "intermediate" }),
  p("g-19", "greetings", "I don't understand", {
    spanish: "No entiendo", french: "Je ne comprends pas", german: "Ich verstehe nicht", italian: "Non capisco",
    portuguese: "Não entendo", hindi: "Mujhe samajh nahi aaya", japanese: "Wakarimasen", chinese: "Wǒ bù dǒng", arabic: "La afham",
  }, { pronunciation: { hindi: "moo-jhay suh-mujh nah-hee ah-yah", japanese: "wah-kah-ree-mah-sen", chinese: "woh boo dong", arabic: "lah af-ham" }, difficulty: "intermediate" }),
  p("g-20", "greetings", "Do you speak English?", {
    spanish: "¿Hablas inglés?", french: "Parlez-vous anglais?", german: "Sprichst du Englisch?", italian: "Parli inglese?",
    portuguese: "Fala inglês?", hindi: "Kya aap Angrezi bolte hain?", japanese: "Eigo o hanasemasu ka?", chinese: "Nǐ huì shuō Yīngyǔ ma?", arabic: "Hal tatakallam al-injliziya?",
  }, { pronunciation: { hindi: "kyah ahp ung-gray-zee bol-tay hain", japanese: "eh-go hah-nah-say-mas kah", chinese: "nee hway shwoh ying-yu mah", arabic: "hal tah-tah-kah-lam al-in-jee-lee-zee-yah" }, difficulty: "advanced" }),
  p("g-21", "greetings", "How do you say…?", {
    spanish: "¿Cómo se dice…?", french: "Comment dit-on…?", german: "Wie sagt man…?", italian: "Come si dice…?",
    portuguese: "Como se diz…?", hindi: "… kaise kehte hain?", japanese: "… wa nanto iimasu ka?", chinese: "… yòng zhōngwén zěnme shuō?", arabic: "Kayfa taqul…?",
  }, { pronunciation: { hindi: "ky-say kay-tay hain", japanese: "wah nan-toh ee-mas kah", chinese: "yong jong-wen dzun-muh shwoh", arabic: "kay-fah tah-kool" }, difficulty: "advanced" }),
  p("g-22", "greetings", "Could you repeat that?", {
    spanish: "¿Puedes repetir?", french: "Pouvez-vous répéter?", german: "Kannst du das wiederholen?", italian: "Puoi ripetere?",
    portuguese: "Pode repetir?", hindi: "Kya aap dohrayenge?", japanese: "Mou ichido itte kudasai", chinese: "Néng zài shuō yí cì ma?", arabic: "Hal yumkinuk i'adat dhalik?",
  }, { pronunciation: { hindi: "kyah ahp doh-ray-eng-ay", japanese: "moh ee-chee-doh it-tay koo-dah-sai", chinese: "nung dzai shwoh ee tsuh mah", arabic: "hal yoom-kin-uk ee-ah-dat thah-leek" }, difficulty: "advanced" }),
  p("g-23", "greetings", "What's your name?", {
    spanish: "¿Cómo te llamas?", french: "Comment tu t'appelles?", german: "Wie heißt du?", italian: "Come ti chiami?",
    portuguese: "Qual é o seu nome?", hindi: "Aapka naam kya hai?", japanese: "Onamae wa nan desu ka?", chinese: "Nǐ jiào shénme míngzi?", arabic: "Ma ismuka?",
  }, { pronunciation: { hindi: "ahp-kah nahm kyah hai", japanese: "oh-nah-mah-eh wah nan des kah", chinese: "nee jow shun-muh ming-dzuh", arabic: "mah is-moo-kah" }, difficulty: "intermediate" }),
  p("g-24", "greetings", "I'm from…", {
    spanish: "Soy de…", french: "Je viens de…", german: "Ich komme aus…", italian: "Vengo da…",
    portuguese: "Sou de…", hindi: "Main… se hoon", japanese: "… kara kimashita", chinese: "Wǒ láizì…", arabic: "Ana min…",
  }, { pronunciation: { hindi: "main say hoon", japanese: "kah-rah kee-mah-shee-tah", chinese: "woh lie-dzuh", arabic: "ah-nah min" }, difficulty: "intermediate" }),
  p("g-25", "greetings", "Where are you from?", {
    spanish: "¿De dónde eres?", french: "D'où viens-tu?", german: "Woher kommst du?", italian: "Di dove sei?",
    portuguese: "De onde você é?", hindi: "Aap kahan se hain?", japanese: "Doko kara kimashita ka?", chinese: "Nǐ cóng nǎlǐ lái?", arabic: "Min ayn anta?",
  }, { pronunciation: { hindi: "ahp kah-hun say hain", japanese: "doh-koh kah-rah kee-mah-shee-tah kah", chinese: "nee tsong nah-lee lie", arabic: "min ayn an-tah" }, difficulty: "intermediate" }),
  p("g-26", "greetings", "Happy birthday", {
    spanish: "Feliz cumpleaños", french: "Joyeux anniversaire", german: "Alles Gute zum Geburtstag", italian: "Buon compleanno",
    portuguese: "Feliz aniversário", hindi: "Janamdin mubarak", japanese: "Otanjoubi omedetou", chinese: "Shēngrì kuàilè", arabic: "Eid milad sa'id",
  }, { pronunciation: { hindi: "jah-num-din moo-bah-rak", japanese: "oh-tan-joh-bee oh-meh-deh-toh", chinese: "sheng-ree kwai-luh", arabic: "eed mee-lad sa-eed" }, difficulty: "intermediate" }),
  p("g-27", "greetings", "Congratulations", {
    spanish: "Felicidades", french: "Félicitations", german: "Glückwünsche", italian: "Congratulazioni",
    portuguese: "Parabéns", hindi: "Badhai ho", japanese: "Omedetou", chinese: "Gōngxǐ", arabic: "Mabruk",
  }, { pronunciation: { hindi: "bud-hai ho", japanese: "oh-meh-deh-toh", chinese: "gong-shee", arabic: "mah-brook" }, difficulty: "intermediate" }),
  p("g-28", "greetings", "Cheers!", {
    spanish: "¡Salud!", french: "Santé!", german: "Prost!", italian: "Cin cin!",
    portuguese: "Saúde!", hindi: "Cheers!", japanese: "Kanpai", chinese: "Gānbēi", arabic: "Fi sahtak!",
  }, { pronunciation: { hindi: "cheers", japanese: "kan-pai", chinese: "gan-bay", arabic: "fee sah-tak" } }),

  // ---- Travel (28 phrases) ----
  p("t-01", "travel", "Airport", {
    spanish: "Aeropuerto", french: "Aéroport", german: "Flughafen", italian: "Aeroporto",
    portuguese: "Aeroporto", hindi: "Hawai adda", japanese: "Kuukou", chinese: "Jīchǎng", arabic: "Matar",
  }, { pronunciation: { hindi: "huh-vai ah-dah", japanese: "koo-koh", chinese: "jee-chahng", arabic: "mah-tar" } }),
  p("t-02", "travel", "Train station", {
    spanish: "Estación de tren", french: "Gare", german: "Bahnhof", italian: "Stazione",
    portuguese: "Estação de trem", hindi: "Railway station", japanese: "Eki", chinese: "Huǒchē zhàn", arabic: "Mahatta",
  }, { pronunciation: { hindi: "rayl-way stay-shun", japanese: "eh-kee", chinese: "hwoh-chuh jahn", arabic: "mah-hat-tah" } }),
  p("t-03", "travel", "Bus", {
    spanish: "Autobús", french: "Bus", german: "Bus", italian: "Autobus",
    portuguese: "Autocarro", hindi: "Bus", japanese: "Basu", chinese: "Gōngjiāo chē", arabic: "Hafilah",
  }, { pronunciation: { hindi: "bus", japanese: "bah-soo", chinese: "gong-jee-ow chuh", arabic: "hah-fee-lah" } }),
  p("t-04", "travel", "Taxi", {
    spanish: "Taxi", french: "Taxi", german: "Taxi", italian: "Taxi",
    portuguese: "Táxi", hindi: "Taxi", japanese: "Takushii", chinese: "Chūzū chē", arabic: "Ujjra",
  }, { pronunciation: { hindi: "tax-ee", japanese: "tah-koo-shee", chinese: "choo-dzoo chuh", arabic: "uj-rah" } }),
  p("t-05", "travel", "Ticket", {
    spanish: "Billete", french: "Billet", german: "Fahrkarte", italian: "Biglietto",
    portuguese: "Bilhete", hindi: "Ticket", japanese: "Kippu", chinese: "Piào", arabic: "Tadhkara",
  }, { pronunciation: { hindi: "tick-et", japanese: "keep-poo", chinese: "pee-ow", arabic: "tad-kah-rah" } }),
  p("t-06", "travel", "Passport", {
    spanish: "Pasaporte", french: "Passeport", german: "Reisepass", italian: "Passaporto",
    portuguese: "Passaporte", hindi: "Passport", japanese: "Pasupooto", chinese: "Hùzhào", arabic: "Jawaz safar",
  }, { pronunciation: { hindi: "pass-port", japanese: "pah-soo-poh-toh", chinese: "hoo-jow", arabic: "jah-waz sah-far" } }),
  p("t-07", "travel", "Luggage", {
    spanish: "Equipaje", french: "Bagage", german: "Gepäck", italian: "Bagaglio",
    portuguese: "Bagagem", hindi: "Samaan", japanese: "Nimotsu", chinese: "Xínglǐ", arabic: "Amtila",
  }, { pronunciation: { hindi: "sah-mahn", japanese: "nee-moh-tsoo", chinese: "shing-lee", arabic: "am-tee-lah" } }),
  p("t-08", "travel", "Hotel", {
    spanish: "Hotel", french: "Hôtel", german: "Hotel", italian: "Albergo",
    portuguese: "Hotel", hindi: "Hotel", japanese: "Hoteru", chinese: "Jiǔdiàn", arabic: "Funduq",
  }, { pronunciation: { hindi: "hoh-tel", japanese: "hoh-teh-roo", chinese: "joh-dee-en", arabic: "foon-dook" } }),
  p("t-09", "travel", "Reservation", {
    spanish: "Reserva", french: "Réservation", german: "Reservierung", italian: "Prenotazione",
    portuguese: "Reserva", hindi: "Booking", japanese: "Yoyaku", chinese: "Yùdìng", arabic: "Hajz",
  }, { pronunciation: { hindi: "boo-king", japanese: "yoh-yah-koo", chinese: "yoo-ding", arabic: "hajz" }, difficulty: "intermediate" }),
  p("t-10", "travel", "Where is the bathroom?", {
    spanish: "¿Dónde está el baño?", french: "Où sont les toilettes?", german: "Wo ist die Toilette?", italian: "Dov'è il bagno?",
    portuguese: "Onde fica o banheiro?", hindi: "Shauchalaya kahan hai?", japanese: "Toire wa doko desu ka?", chinese: "Xǐshǒujiān zài nǎlǐ?", arabic: "Ayn al-hammam?",
  }, { pronunciation: { hindi: "show-chah-lie-ah kah-hun hai", japanese: "toy-reh wah doh-koh des kah", chinese: "shee-shoh-jyen dzai nah-lee", arabic: "ayn al-hah-mam" }, difficulty: "intermediate" }),
  p("t-11", "travel", "I need a doctor", {
    spanish: "Necesito un médico", french: "J'ai besoin d'un médecin", german: "Ich brauche einen Arzt", italian: "Ho bisogno di un medico",
    portuguese: "Preciso de um médico", hindi: "Mujhe doctor chahiye", japanese: "Oisha san ni aitai", chinese: "Wǒ xūyào yīshēng", arabic: "Ahtaj ila tabib",
  }, { pronunciation: { hindi: "moo-jhay doc-tor chah-hee-yay", japanese: "oy-shah san ee ah-ee-tie", chinese: "woh shoo-yow ee-shung", arabic: "ah-taj ee-lah tah-beeb" }, difficulty: "advanced" }),
  p("t-12", "travel", "How much does it cost?", {
    spanish: "¿Cuánto cuesta?", french: "Combien ça coûte?", german: "Wie viel kostet das?", italian: "Quanto costa?",
    portuguese: "Quanto custa?", hindi: "Yeh kitne ka hai?", japanese: "Ikura desu ka?", chinese: "Duōshǎo qián?", arabic: "Bikam?",
  }, { pronunciation: { hindi: "yeh kit-nay kah hai", japanese: "ee-koo-rah des kah", chinese: "dwow-shao chyen", arabic: "bee-kam" }, difficulty: "intermediate" }),
  p("t-13", "travel", "Can I pay by card?", {
    spanish: "¿Puedo pagar con tarjeta?", french: "Puis-je payer par carte?", german: "Kann ich mit Karte zahlen?", italian: "Posso pagare con la carta?",
    portuguese: "Posso pagar com cartão?", hindi: "Kya main card se pay kar sakta hoon?", japanese: "Kaado de shiharai dekimasu ka?", chinese: "Kěyǐ shuā kǎ ma?", arabic: "Hal yumkinuni al-daf' bbitaqa?",
  }, { pronunciation: { hindi: "kyah main card say pay kar sah-kah hoon", japanese: "kah-oh-doh shee-hah-rah-ee day-kee-mas kah", chinese: "kuh-yee shwah kah mah", arabic: "hal yoom-kin-oo-nee al-daf bee-tah-kah" }, difficulty: "advanced" }),
  p("t-14", "travel", "I'm lost", {
    spanish: "Estoy perdido", french: "Je suis perdu", german: "Ich bin verloren", italian: "Sono perso",
    portuguese: "Estou perdido", hindi: "Main kho gaya hoon", japanese: "Michi ni mayotte shimaimashita", chinese: "Wǒ mílù le", arabic: "Ada'tu tariqi",
  }, { pronunciation: { hindi: "main koh gah-yah hoon", japanese: "mee-chee nee mah-yot-tay shee-my-mah-shee-tah", chinese: "woh mee-loo luh", arabic: "ah-dah-too tah-ree-kee" }, difficulty: "intermediate" }),
  p("t-15", "travel", "Can you help me?", {
    spanish: "¿Puedes ayudarme?", french: "Pouvez-vous m'aider?", german: "Kannst du mir helfen?", italian: "Mi puoi aiutare?",
    portuguese: "Pode me ajudar?", hindi: "Kya aap meri madad karenge?", japanese: "Tetsudatte kuremasen ka?", chinese: "Nǐ néng bāng wǒ ma?", arabic: "Hal tumkinuni musa'adati?",
  }, { pronunciation: { hindi: "kyah ahp may-ree muh-dud kah-reng-gay", japanese: "tet-soo-dah-tay koo-reh-mah-sen kah", chinese: "nee nung bhang woh mah", arabic: "hal yoom-kin-oo-nee moo-sah-ah-dah-tee" }, difficulty: "intermediate" }),
  p("t-16", "travel", "Map", {
    spanish: "Mapa", french: "Carte", german: "Karte", italian: "Mappa",
    portuguese: "Mapa", hindi: "Naksha", japanese: "Chizu", chinese: "Dìtú", arabic: "Khareeta",
  }, { pronunciation: { hindi: "nuk-shah", japanese: "chee-zoo", chinese: "dee-too", arabic: "khah-ree-tah" } }),
  p("t-17", "travel", "Visa", {
    spanish: "Visa", french: "Visa", german: "Visum", italian: "Visto",
    portuguese: "Visto", hindi: "Visa", japanese: "Biza", chinese: "Qiānzhèng", arabic: "Tashira",
  }, { pronunciation: { hindi: "vee-sah", japanese: "bee-zah", chinese: "chen-jung", arabic: "tah-shee-rah" } }),
  p("t-18", "travel", "Departure", {
    spanish: "Salida", french: "Départ", german: "Abfahrt", italian: "Partenza",
    portuguese: "Partida", hindi: "Prasthan", japanese: "Shuppatsu", chinese: "Chūfā", arabic: "Maghaad",
  }, { pronunciation: { hindi: "pruh-stahn", japanese: "shoop-pah-tsoo", chinese: "choo-fah", arabic: "mah-ghad" }, difficulty: "intermediate" }),
  p("t-19", "travel", "Arrival", {
    spanish: "Llegada", french: "Arrivée", german: "Ankunft", italian: "Arrivo",
    portuguese: "Chegada", hindi: "Aagman", japanese: "Touchaku", chinese: "Dàodá", arabic: "Qudum",
  }, { pronunciation: { hindi: "ahg-mun", japanese: "toh-cha-koo", chinese: "dow-dah", arabic: "koo-doom" }, difficulty: "intermediate" }),
  p("t-20", "travel", "Boarding pass", {
    spanish: "Tarjeta de embarque", french: "Carte d'embarquement", german: "Bordkarte", italian: "Carta d'imbarco",
    portuguese: "Cartão de embarque", hindi: "Boarding pass", japanese: "Toujouken", chinese: "Dēngjī pái", arabic: "Bitaqat al-safar",
  }, { pronunciation: { hindi: "bor-ding pass", japanese: "toh-joh-ken", chinese: "dung-jee pow", arabic: "bee-tah-kat al-sah-far" }, difficulty: "intermediate" }),
  p("t-21", "travel", "Gate", {
    spanish: "Puerta", french: "Porte", german: "Tor", italian: "Cancello",
    portuguese: "Portão", hindi: "Darwaza", japanese: "Geeto", chinese: "Dēngjī kǒu", arabic: "Bab",
  }, { pronunciation: { hindi: "dar-wah-zah", japanese: "gay-toh", chinese: "dung-jee ko", arabic: "bab" } }),
  p("t-22", "travel", "Flight", {
    spanish: "Vuelo", french: "Vol", german: "Flug", italian: "Volo",
    portuguese: "Voo", hindi: "Udaan", japanese: "Hikouki", chinese: "Hángbān", arabic: "Rihla",
  }, { pronunciation: { hindi: "oo-dahn", japanese: "hee-koh-kee", chinese: "hahng-bahn", arabic: "rih-lah" } }),
  p("t-23", "travel", "Where is…?", {
    spanish: "¿Dónde está…?", french: "Où est…?", german: "Wo ist…?", italian: "Dov'è…?",
    portuguese: "Onde é…?", hindi: "… kahan hai?", japanese: "… wa doko desu ka?", chinese: "… zài nǎlǐ?", arabic: "Ayn…?",
  }, { pronunciation: { hindi: "kah-hun hai", japanese: "wah doh-koh des kah", chinese: "dzai nah-lee", arabic: "ayn" } }),
  p("t-24", "travel", "Is it far?", {
    spanish: "¿Está lejos?", french: "C'est loin?", german: "Ist es weit?", italian: "È lontano?",
    portuguese: "É longe?", hindi: "Kya yeh door hai?", japanese: "Tooi desu ka?", chinese: "Yuǎn ma?", arabic: "Hal huwa ba'id?",
  }, { pronunciation: { hindi: "kyah yeh doh-r hai", japanese: "toh-ee des kah", chinese: "ywan mah", arabic: "hal hoo-wah bah-eed" }, difficulty: "intermediate" }),
  p("t-25", "travel", "I want to go to…", {
    spanish: "Quiero ir a…", french: "Je veux aller à…", german: "Ich will nach…", italian: "Voglio andare a…",
    portuguese: "Quero ir para…", hindi: "Main … jaana chahta hoon", japanese: "… ni ikitai", chinese: "Wǒ xiǎng qù…", arabic: "Uridu al-dhahab ila…",
  }, { pronunciation: { hindi: "main jah-nah chah-tah hoon", japanese: "nee ee-kee-tie", chinese: "woh shyang choo", arabic: "oo-ree-doo al-thah-hab ee-lah" }, difficulty: "intermediate" }),
  p("t-26", "travel", "Car rental", {
    spanish: "Alquiler de coche", french: "Location de voiture", german: "Autovermietung", italian: "Noleggio auto",
    portuguese: "Aluguer de carro", hindi: "Car rent", japanese: "Renta car", chinese: "Zūchē", arabic: "Ta'jir sayyara",
  }, { pronunciation: { hindi: "car rent", japanese: "ren-tah car", chinese: "dzoo-chuh", arabic: "tah-jeer sah-yah-rah" }, difficulty: "intermediate" }),
  p("t-27", "travel", "Road", {
    spanish: "Calle", french: "Rue", german: "Straße", italian: "Strada",
    portuguese: "Rua", hindi: "Sadak", japanese: "Michi", chinese: "Lù", arabic: "Shari'",
  }, { pronunciation: { hindi: "suh-dak", japanese: "mee-chee", chinese: "loo", arabic: "shah-ree" } }),
  p("t-28", "travel", "Bridge", {
    spanish: "Puente", french: "Pont", german: "Brücke", italian: "Ponte",
    portuguese: "Ponte", hindi: "Pul", japanese: "Hashi", chinese: "Qiáo", arabic: "Jisr",
  }, { pronunciation: { hindi: "pool", japanese: "hah-shee", chinese: "chow", arabic: "jisr" } }),

  // ---- Food (28 phrases) ----
  p("f-01", "food", "Water", {
    spanish: "Agua", french: "Eau", german: "Wasser", italian: "Acqua",
    portuguese: "Água", hindi: "Paani", japanese: "Mizu", chinese: "Shuǐ", arabic: "Ma'",
  }, { pronunciation: { hindi: "pah-nee", japanese: "mee-zoo", chinese: "shway", arabic: "mah" } }),
  p("f-02", "food", "Bread", {
    spanish: "Pan", french: "Pain", german: "Brot", italian: "Pane",
    portuguese: "Pão", hindi: "Roti", japanese: "Pan", chinese: "Miànbāo", arabic: "Khubz",
  }, { pronunciation: { hindi: "roh-tee", japanese: "pan", chinese: "mee-en-bow", arabic: "khoobz" } }),
  p("f-03", "food", "Coffee", {
    spanish: "Café", french: "Café", german: "Kaffee", italian: "Caffè",
    portuguese: "Café", hindi: "Coffee", japanese: "Kohi", chinese: "Kāfēi", arabic: "Qahwa",
  }, { pronunciation: { hindi: "coffee", japanese: "koh-hee", chinese: "kah-fay", arabic: "qah-wah" } }),
  p("f-04", "food", "Tea", {
    spanish: "Té", french: "Thé", german: "Tee", italian: "Tè",
    portuguese: "Chá", hindi: "Chai", japanese: "Ocha", chinese: "Chá", arabic: "Shai",
  }, { pronunciation: { hindi: "chye", japanese: "oh-chah", chinese: "chah", arabic: "shai" } }),
  p("f-05", "food", "Milk", {
    spanish: "Leche", french: "Lait", german: "Milch", italian: "Latte",
    portuguese: "Leite", hindi: "Doodh", japanese: "Gyunyu", chinese: "Niúnǎi", arabic: "Haleeb",
  }, { pronunciation: { hindi: "doodh", japanese: "gyoo-nyoo", chinese: "nyo-nye", arabic: "hah-leeb" } }),
  p("f-06", "food", "Rice", {
    spanish: "Arroz", french: "Riz", german: "Reis", italian: "Riso",
    portuguese: "Arroz", hindi: "Chawal", japanese: "Gohan", chinese: "Mǐfàn", arabic: "Aruz",
  }, { pronunciation: { hindi: "chah-wul", japanese: "goh-han", chinese: "mee-fahn", arabic: "ah-rooz" } }),
  p("f-07", "food", "Chicken", {
    spanish: "Pollo", french: "Poulet", german: "Hähnchen", italian: "Pollo",
    portuguese: "Frango", hindi: "Murgi", japanese: "Niwatori", chinese: "Jī", arabic: "Dajaj",
  }, { pronunciation: { hindi: "moor-gee", japanese: "nee-wah-toh-ree", chinese: "jee", arabic: "dah-jaj" } }),
  p("f-08", "food", "Fish", {
    spanish: "Pescado", french: "Poisson", german: "Fisch", italian: "Pesce",
    portuguese: "Peixe", hindi: "Machli", japanese: "Sakana", chinese: "Yú", arabic: "Samak",
  }, { pronunciation: { hindi: "much-lee", japanese: "sah-kah-nah", chinese: "yoo", arabic: "sah-mak" } }),
  p("f-09", "food", "Meat", {
    spanish: "Carne", french: "Viande", german: "Fleisch", italian: "Carne",
    portuguese: "Carne", hindi: "Maans", japanese: "Niku", chinese: "Ròu", arabic: "Lahm",
  }, { pronunciation: { hindi: "mahns", japanese: "nee-koo", chinese: "row", arabic: "lahm" } }),
  p("f-10", "food", "Vegetarian", {
    spanish: "Vegetariano", french: "Végétarien", german: "Vegetarisch", italian: "Vegetariano",
    portuguese: "Vegetariano", hindi: "Shakahari", japanese: "Bejitarian", chinese: "Sùshí", arabic: "Nabati",
  }, { pronunciation: { hindi: "shah-kah-hah-ree", japanese: "bay-jee-tah-ree-yan", chinese: "soo-shr", arabic: "nah-bah-tee" } }),
  p("f-11", "food", "Menu", {
    spanish: "Menú", french: "Menu", german: "Speisekarte", italian: "Menu",
    portuguese: "Menu", hindi: "Menu", japanese: "Menyuu", chinese: "Càidān", arabic: "Qaima",
  }, { pronunciation: { hindi: "menu", japanese: "men-yoo", chinese: "tsai-dahn", arabic: "qai-mah" } }),
  p("f-12", "food", "Bill / Check", {
    spanish: "Cuenta", french: "L'addition", german: "Rechnung", italian: "Conto",
    portuguese: "Conta", hindi: "Bill", japanese: "Kaikei", chinese: "Zhàngdān", arabic: "Al-hisab",
  }, { pronunciation: { hindi: "bill", japanese: "kai-kay", chinese: "jahng-dahn", arabic: "al-hee-sab" } }),
  p("f-13", "food", "I'm hungry", {
    spanish: "Tengo hambre", french: "J'ai faim", german: "Ich habe Hunger", italian: "Ho fame",
    portuguese: "Estou com fome", hindi: "Mujhe bhook lagi hai", japanese: "Onaka ga sukimmashita", chinese: "Wǒ è le", arabic: "Ana jaw'an",
  }, { pronunciation: { hindi: "moo-jay hook lah-gee hai", japanese: "oh-nah-kah gah soo-kee-mah-shee-tah", chinese: "woh uh luh", arabic: "ah-nah jah-wan" }, difficulty: "intermediate" }),
  p("f-14", "food", "I'm thirsty", {
    spanish: "Tengo sed", french: "J'ai soif", german: "Ich habe Durst", italian: "Ho sete",
    portuguese: "Estou com sede", hindi: "Mujhe pyas lagi hai", japanese: "Nodo ga kawakimashita", chinese: "Wǒ kě le", arabic: "Ana 'atshan",
  }, { pronunciation: { hindi: "moo-jay pyahs lah-gee hai", japanese: "noh-doh gah kah-wah-kee-mah-shee-tah", chinese: "woh kuh luh", arabic: "ah-nah at-shan" }, difficulty: "intermediate" }),
  p("f-15", "food", "Delicious", {
    spanish: "Delicioso", french: "Délicieux", german: "Lecker", italian: "Delizioso",
    portuguese: "Delicioso", hindi: "Bahut swaadisht", japanese: "Oishii", chinese: "Hǎochī", arabic: "Ladhidh",
  }, { pronunciation: { hindi: "buh-hoot swah-deesht", japanese: "oy-shee", chinese: "how-chr", arabic: "lah-dheedh" }, difficulty: "intermediate" }),
  p("f-16", "food", "I would like…", {
    spanish: "Me gustaría…", french: "Je voudrais…", german: "Ich hätte gern…", italian: "Vorrei…",
    portuguese: "Eu gostaria de…", hindi: "Mujhe … chahiye", japanese: "… wo kudasai", chinese: "Wǒ xiǎng yào…", arabic: "Uridu…",
  }, { pronunciation: { hindi: "moo-jay chah-hee-yay", japanese: "koo-dah-sai", chinese: "woh shyang yow", arabic: "oo-ree-doo" }, difficulty: "intermediate" }),
  p("f-17", "food", "Salt", {
    spanish: "Sal", french: "Sel", german: "Salz", italian: "Sale",
    portuguese: "Sal", hindi: "Namak", japanese: "Shio", chinese: "Yán", arabic: "Milh",
  }, { pronunciation: { hindi: "nuh-muk", japanese: "shee-oh", chinese: "yen", arabic: "milh" } }),
  p("f-18", "food", "Sugar", {
    spanish: "Azúcar", french: "Sucre", german: "Zucker", italian: "Zucchero",
    portuguese: "Açúcar", hindi: "Cheeni", japanese: "Satou", chinese: "Táng", arabic: "Sukkar",
  }, { pronunciation: { hindi: "chee-nee", japanese: "sah-toh", chinese: "tahng", arabic: "soo-kar" } }),
  p("f-19", "food", "Fruit", {
    spanish: "Fruta", french: "Fruit", german: "Obst", italian: "Frutta",
    portuguese: "Fruta", hindi: "Phal", japanese: "Kudamono", chinese: "Shuǐguǒ", arabic: "Fakih",
  }, { pronunciation: { hindi: "phal", japanese: "koo-dah-moh-no", chinese: "shway-gwor", arabic: "fah-keeh" } }),
  p("f-20", "food", "Vegetable", {
    spanish: "Verdura", french: "Légume", german: "Gemüse", italian: "Verdura",
    portuguese: "Legume", hindi: "Sabzi", japanese: "Yasai", chinese: "Shūcài", arabic: "Khudra",
  }, { pronunciation: { hindi: "sub-zee", japanese: "yah-sai", chinese: "shoo-tsai", arabic: "khoo-drah" } }),
  p("f-21", "food", "Egg", {
    spanish: "Huevo", french: "Œuf", german: "Ei", italian: "Uovo",
    portuguese: "Ovo", hindi: "Anda", japanese: "Tamago", chinese: "Jīdàn", arabic: "Bayda",
  }, { pronunciation: { hindi: "ahn-dah", japanese: "tah-mah-goh", chinese: "jee-dahn", arabic: "bay-dah" } }),
  p("f-22", "food", "Cheese", {
    spanish: "Queso", french: "Fromage", german: "Käse", italian: "Formaggio",
    portuguese: "Queijo", hindi: "Paneer", japanese: "Chiizu", chinese: "Nǎilào", arabic: "Jubn",
  }, { pronunciation: { hindi: "pah-neer", japanese: "chee-zoo", chinese: "nye-low", arabic: "joobn" } }),
  p("f-23", "food", "Beer", {
    spanish: "Cerveza", french: "Bière", german: "Bier", italian: "Birra",
    portuguese: "Cerveja", hindi: "Beer", japanese: "Biiru", chinese: "Píjiǔ", arabic: "Bira",
  }, { pronunciation: { hindi: "beer", japanese: "bee-roo", chinese: "pee-joh", arabic: "bee-rah" } }),
  p("f-24", "food", "Wine", {
    spanish: "Vino", french: "Vin", german: "Wein", italian: "Vino",
    portuguese: "Vinho", hindi: "Sharaab", japanese: "Wain", chinese: "Pútáojiǔ", arabic: "Nabidh",
  }, { pronunciation: { hindi: "shah-rahb", japanese: "wine", chinese: "poo-tow-joh", arabic: "nah-bidh" } }),
  p("f-25", "food", "Breakfast", {
    spanish: "Desayuno", french: "Petit déjeuner", german: "Frühstück", italian: "Colazione",
    portuguese: "Pequeno-almoço", hindi: "Nashta", japanese: "Choshoku", chinese: "Zǎocān", arabic: "Fatr al-sabah",
  }, { pronunciation: { hindi: "nush-tah", japanese: "choh-shoh-koo", chinese: "dzow-tsahn", arabic: "fah-tr al-sah-bah" }, difficulty: "intermediate" }),
  p("f-26", "food", "Lunch", {
    spanish: "Almuerzo", french: "Déjeuner", german: "Mittagessen", italian: "Pranzo",
    portuguese: "Almoço", hindi: "Dopehar ka khana", japanese: "Hirugohan", chinese: "Wǔcān", arabic: "Ghada'",
  }, { pronunciation: { hindi: "doh-peh-har kah khah-nah", japanese: "hee-roo-goh-han", chinese: "woo-tsahn", arabic: "ghah-dah" }, difficulty: "intermediate" }),
  p("f-27", "food", "Dinner", {
    spanish: "Cena", french: "Dîner", german: "Abendessen", italian: "Cena",
    portuguese: "Jantar", hindi: "Raat ka khana", japanese: "Yuugohan", chinese: "Wǎncān", arabic: "Asha'",
  }, { pronunciation: { hindi: "raht kah khah-nah", japanese: "yoo-goh-han", chinese: "wan-tsahn", arabic: "ah-shah" }, difficulty: "intermediate" }),
  p("f-28", "food", "Dessert", {
    spanish: "Postre", french: "Dessert", german: "Nachtisch", italian: "Dolce",
    portuguese: "Sobremesa", hindi: "Mithai", japanese: "Dezaato", chinese: "Tiándiǎn", arabic: "Halwa",
  }, { pronunciation: { hindi: "mee-thai", japanese: "day-zah-toh", chinese: "tyen-dyen", arabic: "hal-wah" }, difficulty: "intermediate" }),

  // ---- Numbers (15 phrases — each number is also in NUMBER_TRANSLATIONS) ----
  p("n-01", "numbers", "One", {
    spanish: "Uno", french: "Un", german: "Eins", italian: "Uno",
    portuguese: "Um", hindi: "Ek", japanese: "Ichi", chinese: "Yī", arabic: "Wahid",
  }, { pronunciation: { hindi: "ek", japanese: "ee-chee", chinese: "ee", arabic: "wah-hid" } }),
  p("n-02", "numbers", "Two", {
    spanish: "Dos", french: "Deux", german: "Zwei", italian: "Due",
    portuguese: "Dois", hindi: "Do", japanese: "Ni", chinese: "Èr", arabic: "Ithnan",
  }, { pronunciation: { hindi: "doh", japanese: "nee", chinese: "ur", arabic: "ith-nan" } }),
  p("n-03", "numbers", "Three", {
    spanish: "Tres", french: "Trois", german: "Drei", italian: "Tre",
    portuguese: "Três", hindi: "Teen", japanese: "San", chinese: "Sān", arabic: "Thalatha",
  }, { pronunciation: { hindi: "teen", japanese: "sahn", chinese: "sahn", arabic: "thah-lah-thah" } }),
  p("n-04", "numbers", "Four", {
    spanish: "Cuatro", french: "Quatre", german: "Vier", italian: "Quattro",
    portuguese: "Quatro", hindi: "Char", japanese: "Shi", chinese: "Sì", arabic: "Arba'a",
  }, { pronunciation: { hindi: "char", japanese: "shee", chinese: "suh", arabic: "ar-bah-ah" } }),
  p("n-05", "numbers", "Five", {
    spanish: "Cinco", french: "Cinq", german: "Fünf", italian: "Cinque",
    portuguese: "Cinco", hindi: "Paanch", japanese: "Go", chinese: "Wǔ", arabic: "Khamsa",
  }, { pronunciation: { hindi: "pahnch", japanese: "goh", chinese: "woo", arabic: "kham-sah" } }),
  p("n-06", "numbers", "Six", {
    spanish: "Seis", french: "Six", german: "Sechs", italian: "Sei",
    portuguese: "Seis", hindi: "Chhah", japanese: "Roku", chinese: "Liù", arabic: "Sitta",
  }, { pronunciation: { hindi: "chhah", japanese: "roh-koo", chinese: "lyoh", arabic: "sit-tah" } }),
  p("n-07", "numbers", "Seven", {
    spanish: "Siete", french: "Sept", german: "Sieben", italian: "Sette",
    portuguese: "Sete", hindi: "Saat", japanese: "Shichi", chinese: "Qī", arabic: "Sab'a",
  }, { pronunciation: { hindi: "sot", japanese: "shee-chee", chinese: "chee", arabic: "sab-ah" } }),
  p("n-08", "numbers", "Eight", {
    spanish: "Ocho", french: "Huit", german: "Acht", italian: "Otto",
    portuguese: "Oito", hindi: "Aath", japanese: "Hachi", chinese: "Bā", arabic: "Thamaniya",
  }, { pronunciation: { hindi: "aht", japanese: "hah-chee", chinese: "bah", arabic: "thah-mah-nee-yah" } }),
  p("n-09", "numbers", "Nine", {
    spanish: "Nueve", french: "Neuf", german: "Neun", italian: "Nove",
    portuguese: "Nove", hindi: "Nau", japanese: "Ku", chinese: "Jiǔ", arabic: "Tis'a",
  }, { pronunciation: { hindi: "now", japanese: "koo", chinese: "joh", arabic: "tee-sah" } }),
  p("n-10", "numbers", "Ten", {
    spanish: "Diez", french: "Dix", german: "Zehn", italian: "Dieci",
    portuguese: "Dez", hindi: "Das", japanese: "Juu", chinese: "Shí", arabic: "Ashara",
  }, { pronunciation: { hindi: "dahs", japanese: "joo", chinese: "shr", arabic: "ah-shah-rah" } }),
  p("n-11", "numbers", "Twenty", {
    spanish: "Veinte", french: "Vingt", german: "Zwanzig", italian: "Venti",
    portuguese: "Vinte", hindi: "Bees", japanese: "Nijuu", chinese: "Èrshí", arabic: "Ishrun",
  }, { pronunciation: { hindi: "bayes", japanese: "nee-joo", chinese: "ur-shr", arabic: "ish-roon" }, difficulty: "intermediate" }),
  p("n-12", "numbers", "Fifty", {
    spanish: "Cincuenta", french: "Cinquante", german: "Fünfzig", italian: "Cinquanta",
    portuguese: "Cinquenta", hindi: "Pachaas", japanese: "Gojuu", chinese: "Wǔshí", arabic: "Khamsun",
  }, { pronunciation: { hindi: "pah-chahs", japanese: "goh-joo", chinese: "woo-shr", arabic: "kham-soon" }, difficulty: "intermediate" }),
  p("n-13", "numbers", "One hundred", {
    spanish: "Cien", french: "Cent", german: "Hundert", italian: "Cento",
    portuguese: "Cem", hindi: "Sau", japanese: "Hyaku", chinese: "Yī bǎi", arabic: "Mi'a",
  }, { pronunciation: { hindi: "sow", japanese: "hyah-koo", chinese: "ee by", arabic: "mee-ah" }, difficulty: "intermediate" }),
  p("n-14", "numbers", "First", {
    spanish: "Primero", french: "Premier", german: "Erste", italian: "Primo",
    portuguese: "Primeiro", hindi: "Pehla", japanese: "Saisho", chinese: "Dì yī", arabic: "Awwal",
  }, { pronunciation: { hindi: "pay-lah", japanese: "sai-shoh", chinese: "dee ee", arabic: "ah-wal" }, difficulty: "advanced" }),
  p("n-15", "numbers", "Half", {
    spanish: "Medio", french: "Moitié", german: "Hälfte", italian: "Metà",
    portuguese: "Metade", hindi: "Aadha", japanese: "Hanbun", chinese: "Yíbàn", arabic: "Nisf",
  }, { pronunciation: { hindi: "ah-dhah", japanese: "han-boon", chinese: "ee-bahn", arabic: "nisf" }, difficulty: "intermediate" }),

  // ---- Time (14 phrases) ----
  p("ti-01", "time", "Today", {
    spanish: "Hoy", french: "Aujourd'hui", german: "Heute", italian: "Oggi",
    portuguese: "Hoje", hindi: "Aaj", japanese: "Kyou", chinese: "Jīntiān", arabic: "Al-yawm",
  }, { pronunciation: { hindi: "ahj", japanese: "kyoh", chinese: "jeen-tyen", arabic: "al-yom" } }),
  p("ti-02", "time", "Tomorrow", {
    spanish: "Mañana", french: "Demain", german: "Morgen", italian: "Domani",
    portuguese: "Amanhã", hindi: "Kal", japanese: "Ashita", chinese: "Míngtiān", arabic: "Ghadan",
  }, { pronunciation: { hindi: "kul", japanese: "ah-shee-tah", chinese: "meeng-tyen", arabic: "ghah-dan" } }),
  p("ti-03", "time", "Yesterday", {
    spanish: "Ayer", french: "Hier", german: "Gestern", italian: "Ieri",
    portuguese: "Ontem", hindi: "Kal", japanese: "Kinou", chinese: "Zuótiān", arabic: "Amsi",
  }, { pronunciation: { hindi: "kul", japanese: "kee-noh", chinese: "dzwor-tyen", arabic: "am-see" } }),
  p("ti-04", "time", "Now", {
    spanish: "Ahora", french: "Maintenant", german: "Jetzt", italian: "Adesso",
    portuguese: "Agora", hindi: "Abhi", japanese: "Ima", chinese: "Xiànzài", arabic: "Al-an",
  }, { pronunciation: { hindi: "ubh-hee", japanese: "ee-mah", chinese: "shyen-dzai", arabic: "al-an" } }),
  p("ti-05", "time", "Later", {
    spanish: "Después", french: "Plus tard", german: "Später", italian: "Più tardi",
    portuguese: "Mais tarde", hindi: "Baad mein", japanese: "Atode", chinese: "Yǐhòu", arabic: "Ba'd",
  }, { pronunciation: { hindi: "bahd main", japanese: "ah-toh-day", chinese: "ee-hoh", arabic: "bahd" } }),
  p("ti-06", "time", "What time is it?", {
    spanish: "¿Qué hora es?", french: "Quelle heure est-il?", german: "Wie spät ist es?", italian: "Che ora è?",
    portuguese: "Que horas são?", hindi: "Kya samay hua hai?", japanese: "Nanji desu ka?", chinese: "Jǐ diǎn le?", arabic: "Kam al-sa'a?",
  }, { pronunciation: { hindi: "kyah suh-my hoo-ah hai", japanese: "nan-jee des kah", chinese: "jee dyen luh", arabic: "kam al-sah-ah" }, difficulty: "intermediate" }),
  p("ti-07", "time", "Morning", {
    spanish: "Mañana", french: "Matin", german: "Morgen", italian: "Mattina",
    portuguese: "Manhã", hindi: "Subah", japanese: "Asa", chinese: "Zǎoshang", arabic: "Sabah",
  }, { pronunciation: { hindi: "soo-bah", japanese: "ah-sah", chinese: "dzow-shang", arabic: "sah-bah" } }),
  p("ti-08", "time", "Afternoon", {
    spanish: "Tarde", french: "Après-midi", german: "Nachmittag", italian: "Pomeriggio",
    portuguese: "Tarde", hindi: "Dopehar", japanese: "Gogo", chinese: "Xiàwǔ", arabic: "Ba'd al-dhuhr",
  }, { pronunciation: { hindi: "doh-peh-har", japanese: "goh-goh", chinese: "shyah-woo", arabic: "bahd al-doo-hr" }, difficulty: "intermediate" }),
  p("ti-09", "time", "Evening", {
    spanish: "Noche", french: "Soir", german: "Abend", italian: "Sera",
    portuguese: "Noite", hindi: "Shaam", japanese: "Ban", chinese: "Wǎnshang", arabic: "Masa'",
  }, { pronunciation: { hindi: "shahm", japanese: "bahn", chinese: "wan-shang", arabic: "mah-sah" } }),
  p("ti-10", "time", "Week", {
    spanish: "Semana", french: "Semaine", german: "Woche", italian: "Settimana",
    portuguese: "Semana", hindi: "Saptah", japanese: "Shuukan", chinese: "Zhōu", arabic: "Usubu",
  }, { pronunciation: { hindi: "sup-tah-h", japanese: "shoo-kan", chinese: "joh", arabic: "oo-soo-oo" } }),
  p("ti-11", "time", "Month", {
    spanish: "Mes", french: "Mois", german: "Monat", italian: "Mese",
    portuguese: "Mês", hindi: "Mahina", japanese: "Tsuki", chinese: "Yuè", arabic: "Shahr",
  }, { pronunciation: { hindi: "mah-hee-nah", japanese: "tsoo-kee", chinese: "yweh", arabic: "shahr" } }),
  p("ti-12", "time", "Year", {
    spanish: "Año", french: "Année", german: "Jahr", italian: "Anno",
    portuguese: "Ano", hindi: "Saal", japanese: "Toshi", chinese: "Nián", arabic: "Sana",
  }, { pronunciation: { hindi: "sahl", japanese: "toh-shee", chinese: "nyen", arabic: "sah-nah" } }),
  p("ti-13", "time", "Hour", {
    spanish: "Hora", french: "Heure", german: "Stunde", italian: "Ora",
    portuguese: "Hora", hindi: "Ghanta", japanese: "Jikan", chinese: "Xiǎoshí", arabic: "Sa'a",
  }, { pronunciation: { hindi: "ghun-tah", japanese: "jee-kan", chinese: "shyow-shr", arabic: "sah-ah" } }),
  p("ti-14", "time", "Minute", {
    spanish: "Minuto", french: "Minute", german: "Minute", italian: "Minuto",
    portuguese: "Minuto", hindi: "Minut", japanese: "Pun", chinese: "Fēnzhōng", arabic: "Daqiqa",
  }, { pronunciation: { hindi: "mee-noot", japanese: "poon", chinese: "fen-jong", arabic: "dah-kee-kah" } }),

  // ---- Emergencies (14 phrases) ----
  p("e-01", "emergencies", "Help!", {
    spanish: "¡Ayuda!", french: "Au secours!", german: "Hilfe!", italian: "Aiuto!",
    portuguese: "Socorro!", hindi: "Madad!", japanese: "Tasukete!", chinese: "Jiùmìng!", arabic: "Al-najda!",
  }, { pronunciation: { hindi: "muh-dud", japanese: "tah-skay-tay", chinese: "joh-ming", arabic: "al-naj-dah" } }),
  p("e-02", "emergencies", "Call the police", {
    spanish: "Llame a la policía", french: "Appelez la police", german: "Rufen Sie die Polizei", italian: "Chiami la polizia",
    portuguese: "Chame a polícia", hindi: "Police ko bulao", japanese: "Keisatsu ni tsunagi", chinese: "Bào jǐng", arabic: "Ittisil bil-shurta",
  }, { pronunciation: { hindi: "poh-lees koh boo-lah-oh", japanese: "kay-sah-tsoo nee tsoo-nah-gee", chinese: "bow jeeng", arabic: "it-tee-sil bil-shoor-tah" }, difficulty: "intermediate" }),
  p("e-03", "emergencies", "Call an ambulance", {
    spanish: "Llame a una ambulancia", french: "Appelez une ambulance", german: "Rufen Sie einen Krankenwagen", italian: "Chiami un'ambulanza",
    portuguese: "Chame uma ambulância", hindi: "Ambulance bulao", japanese: "Kyuukyuusha wo yonde", chinese: "Jiào jiùhùchē", arabic: "Ittisil bil-is'af",
  }, { pronunciation: { hindi: "am-byoo-luns boo-lah-oh", japanese: "kyoo-kyoo-shah woh yon-day", chinese: "jow joo-hoo-chuh", arabic: "it-tee-sil bil-is-af" }, difficulty: "intermediate" }),
  p("e-04", "emergencies", "Fire!", {
    spanish: "¡Fuego!", french: "Au feu!", german: "Feuer!", italian: "Al fuoco!",
    portuguese: "Fogo!", hindi: "Aag!", japanese: "Kaji!", chinese: "Huǒzāi!", arabic: "Harik!",
  }, { pronunciation: { hindi: "ahg", japanese: "kah-jee", chinese: "hwoh-dzai", arabic: "hah-reek" } }),
  p("e-05", "emergencies", "I'm hurt", {
    spanish: "Estoy herido", french: "Je suis blessé", german: "Ich bin verletzt", italian: "Sono ferito",
    portuguese: "Estou ferido", hindi: "Mujhe chot lagi", japanese: "Kega wo shite", chinese: "Wǒ shòushāng le", arabic: "Ana musab",
  }, { pronunciation: { hindi: "moo-jay choht lah-gee", japanese: "keh-gah woh shee-tay", chinese: "woh show-shahng luh", arabic: "ah-nah moo-sab" }, difficulty: "intermediate" }),
  p("e-06", "emergencies", "I'm sick", {
    spanish: "Estoy enfermo", french: "Je suis malade", german: "Ich bin krank", italian: "Sono malato",
    portuguese: "Estou doente", hindi: "Main bimaar hoon", japanese: "Byouki desu", chinese: "Wǒ bìng le", arabic: "Ana marid",
  }, { pronunciation: { hindi: "main bee-mar hoon", japanese: "byoh-kee des", chinese: "woh bing luh", arabic: "ah-nah mah-reed" }, difficulty: "intermediate" }),
  p("e-07", "emergencies", "I need a hospital", {
    spanish: "Necesito un hospital", french: "J'ai besoin d'un hôpital", german: "Ich brauche ein Krankenhaus", italian: "Ho bisogno di un ospedale",
    portuguese: "Preciso de um hospital", hindi: "Mujhe aspatal le jao", japanese: "Byouin ni ikitai", chinese: "Wǒ xūyào yīyuàn", arabic: "Ahtaj ila mustashfa",
  }, { pronunciation: { hindi: "moo-jay us-puh-tul lay jah-oh", japanese: "byoh-een nee ee-kee-tie", chinese: "woh shoo-yow ee-ywan", arabic: "ah-taj ee-lah moos-tash-fah" }, difficulty: "advanced" }),
  p("e-08", "emergencies", "Where is the pharmacy?", {
    spanish: "¿Dónde está la farmacia?", french: "Où est la pharmacie?", german: "Wo ist die Apotheke?", italian: "Dov'è la farmacia?",
    portuguese: "Onde fica a farmácia?", hindi: "Dawaai ki dukan kahan hai?", japanese: "Yakkyoku wa doko desu ka?", chinese: "Yàodiàn zài nǎlǐ?", arabic: "Ayn al-saidala?",
  }, { pronunciation: { hindi: "dah-vai kee doo-kan kah-hun hai", japanese: "yahk-koh-koo wah doh-koh des kah", chinese: "yow-dyen dzai nah-lee", arabic: "ayn al-sah-ee-dah-lah" }, difficulty: "advanced" }),
  p("e-09", "emergencies", "It's an emergency", {
    spanish: "Es una emergencia", french: "C'est une urgence", german: "Es ist ein Notfall", italian: "È un'emergenza",
    portuguese: "É uma emergência", hindi: "Yeh aapatkalin hai", japanese: "Hijouji desu", chinese: "Zhè shì jǐnjí qíngkuàng", arabic: "Hadith tari'",
  }, { pronunciation: { hindi: "yeh ah-paht-kuh-lin hai", japanese: "hee-joh-jee des", chinese: "juh shr jeen-jee cheeng-kwahng", arabic: "hah-deeth tah-ree" }, difficulty: "advanced" }),
  p("e-10", "emergencies", "Stop!", {
    spanish: "¡Pare!", french: "Arrêtez!", german: "Stopp!", italian: "Fermati!",
    portuguese: "Pare!", hindi: "Ruko!", japanese: "Yamete!", chinese: "Tíng!", arabic: "Tawaqquf!",
  }, { pronunciation: { hindi: "roo-koh", japanese: "yah-may-tay", chinese: "teeng", arabic: "tah-wah-koo" } }),
  p("e-11", "emergencies", "Thief!", {
    spanish: "¡Ladrón!", french: "Au voleur!", german: "Dieb!", italian: "Ladro!",
    portuguese: "Ladrão!", hindi: "Chor!", japanese: "Dorobou!", chinese: "Xiǎotōu!", arabic: "Harami!",
  }, { pronunciation: { hindi: "chohr", japanese: "doh-roh-boh", chinese: "shyow-toh", arabic: "hah-rah-mee" } }),
  p("e-12", "emergencies", "I lost my passport", {
    spanish: "Perdí mi pasaporte", french: "J'ai perdu mon passeport", german: "Ich habe meinen Pass verloren", italian: "Ho perso il passaporto",
    portuguese: "Perdi meu passaporte", hindi: "Mera passport kho gaya", japanese: "Pasupooto wo nakushimashita", chinese: "Wǒ diūle hùzhào", arabic: "Ada'tu jawaz safari",
  }, { pronunciation: { hindi: "may-rah pass-port koh gah-yah", japanese: "pah-soo-poh-toh woh nah-koo-shee-mah-shee-tah", chinese: "woh dyoh luh hoo-jow", arabic: "ah-dah-too jah-waz sah-fee" }, difficulty: "advanced" }),
  p("e-13", "emergencies", "I need help", {
    spanish: "Necesito ayuda", french: "J'ai besoin d'aide", german: "Ich brauche Hilfe", italian: "Ho bisogno di aiuto",
    portuguese: "Preciso de ajuda", hindi: "Mujhe madad chahiye", japanese: "Tasuke ga hitsuyou desu", chinese: "Wǒ xūyào bāngzhù", arabic: "Ahtaj ila musa'ada",
  }, { pronunciation: { hindi: "moo-jay muh-dud chah-hee-yay", japanese: "tah-skeh gah hit-soo-yoh des", chinese: "woh shoo-yow bahng-joo", arabic: "ah-taj ee-lah moo-sah-ah-dah" }, difficulty: "intermediate" }),
  p("e-14", "emergencies", "Be careful", {
    spanish: "Ten cuidado", french: "Fais attention", german: "Sei vorsichtig", italian: "Fai attenzione",
    portuguese: "Tome cuidado", hindi: "Savdhani se", japanese: "Ki wo tsukete", chinese: "Xiǎoxīn", arabic: "Kun hatir",
  }, { pronunciation: { hindi: "suv-dhah-nee say", japanese: "kee woh tsoo-kay-tay", chinese: "shyow-sheen", arabic: "koon hah-teer" }, difficulty: "intermediate" }),

  // ---- Shopping (14 phrases) ----
  p("s-01", "shopping", "How much?", {
    spanish: "¿Cuánto?", french: "Combien?", german: "Wie viel?", italian: "Quanto?",
    portuguese: "Quanto?", hindi: "Kitne ka?", japanese: "Ikura?", chinese: "Duōshǎo?", arabic: "Bikam?",
  }, { pronunciation: { hindi: "kit-nay kah", japanese: "ee-koo-rah", chinese: "dwow-shao", arabic: "bee-kam" } }),
  p("s-02", "shopping", "Too expensive", {
    spanish: "Muy caro", french: "Trop cher", german: "Zu teuer", italian: "Troppo caro",
    portuguese: "Muito caro", hindi: "Bahut mehnga", japanese: "Takasugiru", chinese: "Tài guì", arabic: "Ghali kathiran",
  }, { pronunciation: { hindi: "buh-hoot mayng-ah", japanese: "tah-kah-soo-gee-roo", chinese: "tie gway", arabic: "ghah-lee kah-thee-ran" }, difficulty: "intermediate" }),
  p("s-03", "shopping", "Cheaper", {
    spanish: "Más barato", french: "Moins cher", german: "Günstiger", italian: "Più economico",
    portuguese: "Mais barato", hindi: "Sasta", japanese: "Yasui", chinese: "Piányí", arabic: "Arfha",
  }, { pronunciation: { hindi: "sus-tah", japanese: "yah-soo-ee", chinese: "pyen-yee", arabic: "ar-fah" }, difficulty: "intermediate" }),
  p("s-04", "shopping", "Money", {
    spanish: "Dinero", french: "Argent", german: "Geld", italian: "Soldi",
    portuguese: "Dinheiro", hindi: "Paise", japanese: "Okane", chinese: "Qián", arabic: "Maal",
  }, { pronunciation: { hindi: "py-say", japanese: "oh-kah-neh", chinese: "chyen", arabic: "mahl" } }),
  p("s-05", "shopping", "Change", {
    spanish: "Cambio", french: "Monnaie", german: "Wechselgeld", italian: "Resto",
    portuguese: "Troco", hindi: "Khuna", japanese: "Otsuri", chinese: "Zhàoqián", arabic: "Baqi",
  }, { pronunciation: { hindi: "khoo-nah", japanese: "oh-tsoo-ree", chinese: "jow-chyen", arabic: "bah-kee" }, difficulty: "intermediate" }),
  p("s-06", "shopping", "Receipt", {
    spanish: "Recibo", french: "Reçu", german: "Quittung", italian: "Ricevuta",
    portuguese: "Recibo", hindi: "Raseed", japanese: "Ryoshusho", chinese: "Shōujù", arabic: "Wasl",
  }, { pronunciation: { hindi: "rah-seed", japanese: "ryoh-shoo-shoh", chinese: "show-joo", arabic: "wasl" }, difficulty: "intermediate" }),
  p("s-07", "shopping", "Store", {
    spanish: "Tienda", french: "Magasin", german: "Geschäft", italian: "Negozio",
    portuguese: "Loja", hindi: "Dukan", japanese: "Mise", chinese: "Shāngdiàn", arabic: "Mahall",
  }, { pronunciation: { hindi: "doo-kan", japanese: "mee-seh", chinese: "shahng-dyen", arabic: "mah-hal" } }),
  p("s-08", "shopping", "Market", {
    spanish: "Mercado", french: "Marché", german: "Markt", italian: "Mercato",
    portuguese: "Mercado", hindi: "Bazaar", japanese: "Ichiba", chinese: "Shìchǎng", arabic: "Souq",
  }, { pronunciation: { hindi: "buh-zar", japanese: "ee-chee-bah", chinese: "shr-chahng", arabic: "sooq" } }),
  p("s-09", "shopping", "Open", {
    spanish: "Abierto", french: "Ouvert", german: "Geöffnet", italian: "Aperto",
    portuguese: "Aberto", hindi: "Khula", japanese: "Aiteiru", chinese: "Yíngyè", arabic: "Maftuh",
  }, { pronunciation: { hindi: "khoo-lah", japanese: "ah-ee-tay-roo", chinese: "yeeng-yeh", arabic: "mah-foot" } }),
  p("s-10", "shopping", "Closed", {
    spanish: "Cerrado", french: "Fermé", german: "Geschlossen", italian: "Chiuso",
    portuguese: "Fechado", hindi: "Band", japanese: "Aiteiru", chinese: "Guān", arabic: "Maghlouq",
  }, { pronunciation: { hindi: "bund", japanese: "shee-soo", chinese: "gwahn", arabic: "mahg-looq" } }),
  p("s-11", "shopping", "Do you have…?", {
    spanish: "¿Tienes…?", french: "Avez-vous…?", german: "Haben Sie…?", italian: "Hai…?",
    portuguese: "Você tem…?", hindi: "Kya aapke paas… hai?", japanese: "… wa arimasu ka?", chinese: "Nǐ yǒu… ma?", arabic: "Hal ladayk…?",
  }, { pronunciation: { hindi: "kyah ahp-kay pahs hai", japanese: "wah ah-ree-mas kah", chinese: "nee yoh mah", arabic: "hal lah-dayk" }, difficulty: "intermediate" }),
  p("s-12", "shopping", "I'll take it", {
    spanish: "Lo llevo", french: "Je le prends", german: "Ich nehme es", italian: "Lo prendo",
    portuguese: "Eu levo", hindi: "Main le leta hoon", japanese: "Kore wo kaimasu", chinese: "Wǒ mǎi le", arabic: "Sa'akhudhu",
  }, { pronunciation: { hindi: "main lay lay-tah hoon", japanese: "koh-reh woh kai-mas", chinese: "woh my luh", arabic: "sah-ah-khoo-thoo" }, difficulty: "intermediate" }),
  p("s-13", "shopping", "Sale", {
    spanish: "Rebajas", french: "Soldes", german: "Angebot", italian: "Saldi",
    portuguese: "Liquidação", hindi: "Sastaa", japanese: "Seeru", chinese: "Dǎzhé", arabic: "Takfeel",
  }, { pronunciation: { hindi: "sus-tah", japanese: "say-roo", chinese: "dah-juh", arabic: "tak-feel" }, difficulty: "intermediate" }),
  p("s-14", "shopping", "Cash", {
    spanish: "Efectivo", french: "Espèces", german: "Bargeld", italian: "Contanti",
    portuguese: "Dinheiro", hindi: "Nagad", japanese: "Genkin", chinese: "Xiànjīn", arabic: "Naqdi",
  }, { pronunciation: { hindi: "nug-ud", japanese: "gen-kin", chinese: "shyen-jeen", arabic: "nak-dee" } }),

  // ---- Directions (15 phrases) ----
  p("d-01", "directions", "Left", {
    spanish: "Izquierda", french: "Gauche", german: "Links", italian: "Sinistra",
    portuguese: "Esquerda", hindi: "Bayen", japanese: "Hidari", chinese: "Zuǒ", arabic: "Yasar",
  }, { pronunciation: { hindi: "by-yen", japanese: "hee-dah-ree", chinese: "dzwor", arabic: "yah-sar" } }),
  p("d-02", "directions", "Right", {
    spanish: "Derecha", french: "Droite", german: "Rechts", italian: "Destra",
    portuguese: "Direita", hindi: "Dayen", japanese: "Migi", chinese: "Yòu", arabic: "Yamin",
  }, { pronunciation: { hindi: "dy-yen", japanese: "mee-gee", chinese: "yoh", arabic: "yah-meen" } }),
  p("d-03", "directions", "Straight ahead", {
    spanish: "Recto", french: "Tout droit", german: "Geradeaus", italian: "Dritto",
    portuguese: "Em frente", hindi: "Sidhe", japanese: "Massugu", chinese: "Yìzhí", arabic: "Mustaqim",
  }, { pronunciation: { hindi: "sidh-hay", japanese: "mahs-soo-goo", chinese: "ee-jr", arabic: "moos-tah-keem" } }),
  p("d-04", "directions", "Turn", {
    spanish: "Gire", french: "Tournez", german: "Biegen Sie", italian: "Giri",
    portuguese: "Vire", hindi: "Mudo", japanese: "Magatte", chinese: "Zhuǎn", arabic: "Inharif",
  }, { pronunciation: { hindi: "moo-doh", japanese: "mah-gut-tay", chinese: "jwan", arabic: "in-hah-reef" }, difficulty: "intermediate" }),
  p("d-05", "directions", "Stop", {
    spanish: "Pare", french: "Arrêtez", german: "Halt", italian: "Fermati",
    portuguese: "Pare", hindi: "Ruko", japanese: "Tomete", chinese: "Tíng", arabic: "Tawaqquf",
  }, { pronunciation: { hindi: "roo-koh", japanese: "toh-may-tay", chinese: "teeng", arabic: "tah-wah-koo" } }),
  p("d-06", "directions", "North", {
    spanish: "Norte", french: "Nord", german: "Norden", italian: "Nord",
    portuguese: "Norte", hindi: "Uttar", japanese: "Kita", chinese: "Běi", arabic: "Shamal",
  }, { pronunciation: { hindi: "oo-tar", japanese: "kee-tah", chinese: "bay", arabic: "shah-mal" } }),
  p("d-07", "directions", "South", {
    spanish: "Sur", french: "Sud", german: "Süden", italian: "Sud",
    portuguese: "Sul", hindi: "Dakshin", japanese: "Minami", chinese: "Nán", arabic: "Janub",
  }, { pronunciation: { hindi: "duk-shin", japanese: "mee-nah-mee", chinese: "nahn", arabic: "jah-noob" } }),
  p("d-08", "directions", "East", {
    spanish: "Este", french: "Est", german: "Osten", italian: "Est",
    portuguese: "Leste", hindi: "Purab", japanese: "Higashi", chinese: "Dōng", arabic: "Sharq",
  }, { pronunciation: { hindi: "poo-rahb", japanese: "hee-gah-shee", chinese: "dong", arabic: "sharq" } }),
  p("d-09", "directions", "West", {
    spanish: "Oeste", french: "Ouest", german: "Westen", italian: "Ovest",
    portuguese: "Oeste", hindi: "Paschim", japanese: "Nishi", chinese: "Xī", arabic: "Gharb",
  }, { pronunciation: { hindi: "pah-chim", japanese: "nee-shee", chinese: "shee", arabic: "ghar" } }),
  p("d-10", "directions", "Near", {
    spanish: "Cerca", french: "Près", german: "Nahe", italian: "Vicino",
    portuguese: "Perto", hindi: "Paas", japanese: "Chikaku", chinese: "Jìn", arabic: "Qarib",
  }, { pronunciation: { hindi: "pahs", japanese: "chee-kah-koo", chinese: "jeen", arabic: "kah-reeb" } }),
  p("d-11", "directions", "Far", {
    spanish: "Lejos", french: "Loin", german: "Weit", italian: "Lontano",
    portuguese: "Longe", hindi: "Door", japanese: "Tooi", chinese: "Yuǎn", arabic: "Ba'id",
  }, { pronunciation: { hindi: "dohr", japanese: "toh-ee", chinese: "ywan", arabic: "bah-eed" } }),
  p("d-12", "directions", "Next to", {
    spanish: "Al lado de", french: "À côté de", german: "Neben", italian: "Accanto a",
    portuguese: "Ao lado de", hindi: "Ke paas", japanese: "No tonari", chinese: "Zài… pángbiān", arabic: "Bajamb",
  }, { pronunciation: { hindi: "kay pahs", japanese: "noh toh-nah-ree", chinese: "dzai pahng-byen", arabic: "bah-jamb" }, difficulty: "intermediate" }),
  p("d-13", "directions", "Behind", {
    spanish: "Detrás", french: "Derrière", german: "Hinter", italian: "Dietro",
    portuguese: "Atrás", hindi: "Peechhe", japanese: "Ushiro", chinese: "Zài… hòumiàn", arabic: "Khalf",
  }, { pronunciation: { hindi: "pee-chhay", japanese: "oo-shee-roh", chinese: "hoh-myen", arabic: "khalf" }, difficulty: "intermediate" }),
  p("d-14", "directions", "In front of", {
    spanish: "Delante de", french: "Devant", german: "Vor", italian: "Davanti a",
    portuguese: "Em frente de", hindi: "Saamne", japanese: "Mae", chinese: "Zài… qiánmiàn", arabic: "Amam",
  }, { pronunciation: { hindi: "sahm-nay", japanese: "mah-eh", chinese: "chyen-myen", arabic: "ah-mam" }, difficulty: "intermediate" }),
  p("d-15", "directions", "Where am I?", {
    spanish: "¿Dónde estoy?", french: "Où suis-je?", german: "Wo bin ich?", italian: "Dove sono?",
    portuguese: "Onde estou?", hindi: "Main kahan hoon?", japanese: "Koko wa doko desu ka?", chinese: "Wǒ zài nǎlǐ?", arabic: "Ayn ana?",
  }, { pronunciation: { hindi: "main kah-hun hoon", japanese: "koh-koh wah doh-koh des kah", chinese: "woh dzai nah-lee", arabic: "ayn ah-nah" }, difficulty: "intermediate" }),

  // ---- Extra phrases to bring the total past 200 ----

  // Greetings extras (7)
  p("g-29", "greetings", "Good luck", {
    spanish: "Buena suerte", french: "Bonne chance", german: "Viel Glück", italian: "Buona fortuna",
    portuguese: "Boa sorte", hindi: "Shubhkamna", japanese: "Kouun wo", chinese: "Zhù nǐ hǎo yùn", arabic: "Bit-tawfiq",
  }, { pronunciation: { hindi: "shub-kum-nah", japanese: "koh-oon oh", chinese: "joo nee how yoon", arabic: "bit-taw-feeq" } }),
  p("g-30", "greetings", "Take care", {
    spanish: "Cuídate", french: "Prends soin de toi", german: "Pass auf dich auf", italian: "Stai attento",
    portuguese: "Toma conta de ti", hindi: "Khayal rakhna", japanese: "Ki wo tsukete", chinese: "Bǎozhòng", arabic: "Ihtaris",
  }, { pronunciation: { hindi: "khuh-yul rak-nah", japanese: "kee woh tsoo-kay-tay", chinese: "bow-jong", arabic: "ih-tah-rees" }, difficulty: "intermediate" }),
  p("g-31", "greetings", "See you tomorrow", {
    spanish: "Hasta mañana", french: "À demain", german: "Bis morgen", italian: "A domani",
    portuguese: "Até amanhã", hindi: "Kal milte hain", japanese: "Mata ashita", chinese: "Míngtiān jiàn", arabic: "Araka ghadan",
  }, { pronunciation: { hindi: "kul mil-tay hain", japanese: "mah-tah ah-shee-tah", chinese: "meeng-tyen jyen", arabic: "ah-rah-kah ghah-dan" } }),
  p("g-32", "greetings", "Long time no see", {
    spanish: "Hace tiempo que no te veo", french: "Ça fait longtemps", german: "Lange nicht gesehen", italian: "Da quanto tempo",
    portuguese: "Há muito tempo", hindi: "Bahut din ho gaye", japanese: "Hisashiburi", chinese: "Hǎojiǔ bùjiàn", arabic: "Lam naraka mundhu zaman",
  }, { pronunciation: { hindi: "buh-hoot din ho gah-yay", japanese: "hee-sah-shee-boo-ree", chinese: "how-joh boo-jyen", arabic: "lam nah-rah-kah moon-dhoo zah-man" }, difficulty: "advanced" }),
  p("g-33", "greetings", "What's up?", {
    spanish: "¿Qué tal?", french: "Quoi de neuf?", german: "Was los?", italian: "Che c'è?",
    portuguese: "Tudo bem?", hindi: "Kya chal raha hai?", japanese: "Dou shita no?", chinese: "Zěnme le?", arabic: "Mal hadhi?",
  }, { pronunciation: { hindi: "kyah chul rah-hah hai", japanese: "doh shee-tah no", chinese: "dzun-muh luh", arabic: "mal hah-thee" } }),
  p("g-34", "greetings", "Have a nice day", {
    spanish: "Que tengas un buen día", french: "Bonne journée", german: "Schönen Tag noch", italian: "Buona giornata",
    portuguese: "Tenha um bom dia", hindi: "Aapka din shubh ho", japanese: "Yoi ichinichi wo", chinese: "Zhù nǐ yǒu gè měihǎo de yī tiān", arabic: "Atamanna laka yawman sa'ida",
  }, { pronunciation: { hindi: "ahp-kah din shubh ho", japanese: "yoh-ee ee-chee-nee-chee oh", chinese: "joo nee yoh guh may-how luh ee tyen", arabic: "ah-tah-man-nah lah-kah yaw-man sa-ee-dah" }, difficulty: "intermediate" }),
  p("g-35", "greetings", "Sleep well", {
    spanish: "Duerme bien", french: "Dors bien", german: "Schlaf gut", italian: "Dormi bene",
    portuguese: "Dorme bem", hindi: "Achhi neend aaye", japanese: "Yoku nemurinasai", chinese: "Shuì hǎo", arabic: "Nam sa'eed",
  }, { pronunciation: { hindi: "uh-chee neend ah-yay", japanese: "yoh-koo nay-moo-ree-nah-sai", chinese: "shway how", arabic: "nam sa-eed" } }),

  // Travel extras (7)
  p("t-29", "travel", "Train", {
    spanish: "Tren", french: "Train", german: "Zug", italian: "Treno",
    portuguese: "Comboio", hindi: "Train", japanese: "Densha", chinese: "Huǒchē", arabic: "Qitar",
  }, { pronunciation: { hindi: "train", japanese: "den-shah", chinese: "hwoh-chuh", arabic: "kee-tar" } }),
  p("t-30", "travel", "Boat", {
    spanish: "Barco", french: "Bateau", german: "Boot", italian: "Barca",
    portuguese: "Barco", hindi: "Nauka", japanese: "Fune", chinese: "Chuán", arabic: "Qayiq",
  }, { pronunciation: { hindi: "now-kah", japanese: "foo-neh", chinese: "chwan", arabic: "kah-yik" } }),
  p("t-31", "travel", "Subway", {
    spanish: "Metro", french: "Métro", german: "U-Bahn", italian: "Metropolitana",
    portuguese: "Metro", hindi: "Metro", japanese: "Chikatetsu", chinese: "Dìtiě", arabic: "Metro",
  }, { pronunciation: { hindi: "meh-troh", japanese: "chee-kah-tet-soo", chinese: "dee-tyeh", arabic: "meh-troh" } }),
  p("t-32", "travel", "Ticket office", {
    spanish: "Taquilla", french: "Guichet", german: "Schalter", italian: "Biglietteria",
    portuguese: "Bilheteria", hindi: "Ticket counter", japanese: "Kippu uriba", chinese: "Shòupiàochù", arabic: "Shubbat al-tadhakir",
  }, { pronunciation: { hindi: "tick-et coun-ter", japanese: "keep-poo oo-ree-bah", chinese: "show-pyow-choo", arabic: "shub-bat al-tah-dah-keer" }, difficulty: "advanced" }),
  p("t-33", "travel", "How long does it take?", {
    spanish: "¿Cuánto tiempo toma?", french: "Combien de temps ça prend?", german: "Wie lange dauert das?", italian: "Quanto tempo ci vuole?",
    portuguese: "Quanto tempo leva?", hindi: "Kitna samay lagega?", japanese: "Donokurai kakarimasu ka?", chinese: "Xūyào duōjiǔ?", arabic: "Kam yastaghriq min al-waqt?",
  }, { pronunciation: { hindi: "kit-nah suh-my lah-gay-gah", japanese: "doh-no-koo-rai kah-kah-ree-mas kah", chinese: "shoo-yow dwow-joh", arabic: "kam yass-tagh-reeq min al-wakt" }, difficulty: "advanced" }),
  p("t-34", "travel", "I missed my flight", {
    spanish: "Perdí mi vuelo", french: "J'ai raté mon vol", german: "Ich habe meinen Flug verpasst", italian: "Ho perso il volo",
    portuguese: "Perdi o voo", hindi: "Mera flight miss ho gaya", japanese: "Hikouki ni noriokureta", chinese: "Wǒ cuòguòle hángbān", arabic: "Fawwadtu rihlati",
  }, { pronunciation: { hindi: "may-rah flight mis ho gah-yah", japanese: "hee-koh-kee nee noh-ree-oh-koo-ray-tah", chinese: "woh tswor-gwor luh hahng-bahn", arabic: "fah-wad-too ree-lah-tee" }, difficulty: "advanced" }),
  p("t-35", "travel", "Is there a hotel nearby?", {
    spanish: "¿Hay un hotel cerca?", french: "Y a-t-il un hôtel près d'ici?", german: "Gibt es ein Hotel in der Nähe?", italian: "C'è un hotel vicino?",
    portuguese: "Há um hotel perto?", hindi: "Paas mein hotel hai?", japanese: "Chikaku ni hoteru wa arimasu ka?", chinese: "Fùjìn yǒu jiǔdiàn ma?", arabic: "Hal hunaka funduq qarib?",
  }, { pronunciation: { hindi: "pahs main hoh-tel hai", japanese: "chee-kah-koo nee hoh-teh-roo wah ah-ree-mas kah", chinese: "foo-jeen yoh joh-dee-en mah", arabic: "hal hoo-nah-kah foon-dook kah-reeb" }, difficulty: "advanced" }),

  // Food extras (7)
  p("f-29", "food", "Apple", {
    spanish: "Manzana", french: "Pomme", german: "Apfel", italian: "Mela",
    portuguese: "Maçã", hindi: "Seb", japanese: "Ringo", chinese: "Píngguǒ", arabic: "Tuffah",
  }, { pronunciation: { hindi: "sayb", japanese: "reen-goh", chinese: "peeng-gwor", arabic: "toof-fah" } }),
  p("f-30", "food", "Banana", {
    spanish: "Plátano", french: "Banane", german: "Banane", italian: "Banana",
    portuguese: "Banana", hindi: "Kela", japanese: "Banana", chinese: "Xiāngjiāo", arabic: "Mawz",
  }, { pronunciation: { hindi: "kay-lah", japanese: "bah-nah-nah", chinese: "shyang-jyow", arabic: "mawz" } }),
  p("f-31", "food", "Orange", {
    spanish: "Naranja", french: "Orange", german: "Orange", italian: "Arancia",
    portuguese: "Laranja", hindi: "Santra", japanese: "Orenji", chinese: "Júzi", arabic: "Burtuqal",
  }, { pronunciation: { hindi: "sahn-trah", japanese: "oh-ren-jee", chinese: "joo-dzuh", arabic: "bur-too-kal" } }),
  p("f-32", "food", "Water (still)", {
    spanish: "Agua sin gas", french: "Eau plate", german: "Stilles Wasser", italian: "Acqua naturale",
    portuguese: "Água sem gás", hindi: "Saadha paani", japanese: "Mizu", chinese: "Jìngshuǐ", arabic: "Ma' saakin",
  }, { pronunciation: { hindi: "sah-dhah pah-nee", japanese: "mee-zoo", chinese: "jeeng-shway", arabic: "mah sah-keen" }, difficulty: "intermediate" }),
  p("f-33", "food", "Spicy", {
    spanish: "Picante", french: "Épicé", german: "Scharf", italian: "Piccante",
    portuguese: "Picante", hindi: "Teekha", japanese: "Karakai", chinese: "Là", arabic: "Har",
  }, { pronunciation: { hindi: "tee-khah", japanese: "kah-rah-kai", chinese: "lah", arabic: "har" } }),
  p("f-34", "food", "Cold", {
    spanish: "Frío", french: "Froid", german: "Kalt", italian: "Freddo",
    portuguese: "Frio", hindi: "Thanda", japanese: "Tsumetai", chinese: "Lěng", arabic: "Barid",
  }, { pronunciation: { hindi: "tun-dah", japanese: "tsoo-may-tie", chinese: "lung", arabic: "bah-reed" } }),
  p("f-35", "food", "Hot", {
    spanish: "Caliente", french: "Chaud", german: "Heiß", italian: "Caldo",
    portuguese: "Quente", hindi: "Garam", japanese: "Atsui", chinese: "Rè", arabic: "Har",
  }, { pronunciation: { hindi: "gah-rum", japanese: "ah-tsoo-ee", chinese: "ruh", arabic: "har" } }),

  // Time extras (7)
  p("ti-15", "time", "Day", {
    spanish: "Día", french: "Jour", german: "Tag", italian: "Giorno",
    portuguese: "Dia", hindi: "Din", japanese: "Hi", chinese: "Tiān", arabic: "Yawm",
  }, { pronunciation: { hindi: "deen", japanese: "hee", chinese: "tyen", arabic: "yawm" } }),
  p("ti-16", "time", "Night", {
    spanish: "Noche", french: "Nuit", german: "Nacht", italian: "Notte",
    portuguese: "Noite", hindi: "Raat", japanese: "Yoru", chinese: "Wǎnshang", arabic: "Layl",
  }, { pronunciation: { hindi: "raht", japanese: "yoh-roo", chinese: "wan-shang", arabic: "layl" } }),
  p("ti-17", "time", "Monday", {
    spanish: "Lunes", french: "Lundi", german: "Montag", italian: "Lunedì",
    portuguese: "Segunda-feira", hindi: "Somvaar", japanese: "Getsuyoubi", chinese: "Xīngqī yī", arabic: "Al-ithnayn",
  }, { pronunciation: { hindi: "som-vahr", japanese: "get-soo-yoh-bee", chinese: "shing-chee ee", arabic: "al-ith-nayn" }, difficulty: "intermediate" }),
  p("ti-18", "time", "Weekend", {
    spanish: "Fin de semana", french: "Week-end", german: "Wochenende", italian: "Weekend",
    portuguese: "Fim de semana", hindi: "Weekend", japanese: "Shuumatsu", chinese: "Zhōumò", arabic: "Nihayat al-usbu",
  }, { pronunciation: { hindi: "week-end", japanese: "shoo-mah-tsoo", chinese: "joh-mwor", arabic: "nee-hah-yat al-oo-soo" }, difficulty: "intermediate" }),
  p("ti-19", "time", "January", {
    spanish: "Enero", french: "Janvier", german: "Januar", italian: "Gennaio",
    portuguese: "Janeiro", hindi: "Janvari", japanese: "Ichigatsu", chinese: "Yī yuè", arabic: "Yanayir",
  }, { pronunciation: { hindi: "jun-vah-ree", japanese: "ee-chee-gah-tsoo", chinese: "ee yweh", arabic: "yah-nah-yeer" } }),
  p("ti-20", "time", "Summer", {
    spanish: "Verano", french: "Été", german: "Sommer", italian: "Estate",
    portuguese: "Verão", hindi: "Garmi", japanese: "Natsu", chinese: "Xiàtiān", arabic: "Sayf",
  }, { pronunciation: { hindi: "gar-mee", japanese: "nah-tsoo", chinese: "shyah-tyen", arabic: "sayf" } }),
  p("ti-21", "time", "Winter", {
    spanish: "Invierno", french: "Hiver", german: "Winter", italian: "Inverno",
    portuguese: "Inverno", hindi: "Sardi", japanese: "Fuyu", chinese: "Dōngtiān", arabic: "Shita",
  }, { pronunciation: { hindi: "sur-dee", japanese: "foo-yoo", chinese: "dong-tyen", arabic: "shee-tah" } }),

  // Emergencies extras (7)
  p("e-15", "emergencies", "I need medicine", {
    spanish: "Necesito medicina", french: "J'ai besoin de médicaments", german: "Ich brauche Medikamente", italian: "Ho bisogno di medicine",
    portuguese: "Preciso de remédio", hindi: "Mujhe dawaai chahiye", japanese: "Kusuri ga hitsuyou desu", chinese: "Wǒ xūyào yào", arabic: "Ahtaj ila dawaa",
  }, { pronunciation: { hindi: "moo-jay dah-vai chah-hee-yay", japanese: "koo-soo-ree gah hit-soo-yoh des", chinese: "woh shoo-yow yow", arabic: "ah-taj ee-lah dah-wah" }, difficulty: "advanced" }),
  p("e-16", "emergencies", "Call a doctor", {
    spanish: "Llame a un médico", french: "Appelez un médecin", german: "Rufen Sie einen Arzt", italian: "Chiami un medico",
    portuguese: "Chame um médico", hindi: "Doctor ko bulao", japanese: "Oisha wo yonde", chinese: "Jiào yīshēng", arabic: "Ittisil bi-tabib",
  }, { pronunciation: { hindi: "doc-tor koh boo-lah-oh", japanese: "oy-shah woh yon-day", chinese: "jow ee-shung", arabic: "it-tee-sil bee-tah-beeb" }, difficulty: "intermediate" }),
  p("e-17", "emergencies", "I have a fever", {
    spanish: "Tengo fiebre", french: "J'ai de la fièvre", german: "Ich habe Fieber", italian: "Ho la febbre",
    portuguese: "Tenho febre", hindi: "Mujhe bukhar hai", japanese: "Netsu ga arimasu", chinese: "Wǒ fā shāo le", arabic: "Indi humma",
  }, { pronunciation: { hindi: "moo-jay book-har hai", japanese: "net-soo gah ah-ree-mas", chinese: "woh fah show luh", arabic: "in-dee hoo-mah" }, difficulty: "intermediate" }),
  p("e-18", "emergencies", "I have a headache", {
    spanish: "Me duele la cabeza", french: "J'ai mal à la tête", german: "Ich habe Kopfschmerzen", italian: "Ho mal di testa",
    portuguese: "Tenho dor de cabeça", hindi: "Mujhe sir dard hai", japanese: "Atama ga itai", chinese: "Wǒ tóu téng", arabic: "Indi sudda",
  }, { pronunciation: { hindi: "moo-jay sir dard hai", japanese: "ah-tah-mah gah ee-tie", chinese: "woh toh tung", arabic: "in-dee soo-dah" }, difficulty: "intermediate" }),
  p("e-19", "emergencies", "It hurts here", {
    spanish: "Me duele aquí", french: "Ça fait mal ici", german: "Es tut hier weh", italian: "Mi fa male qui",
    portuguese: "Dói aqui", hindi: "Yahan dard ho raha hai", japanese: "Koko ga itai", chinese: "Zhèlǐ téng", arabic: "Yu'limuni huna",
  }, { pronunciation: { hindi: "yah-hun dard ho rah-hah hai", japanese: "koh-koh gah ee-tie", chinese: "juh-lee tung", arabic: "yoo-lim-oo-nee hoo-nah" }, difficulty: "intermediate" }),
  p("e-20", "emergencies", "I'm allergic to…", {
    spanish: "Soy alérgico a…", french: "Je suis allergique à…", german: "Ich bin allergisch gegen…", italian: "Sono allergico a…",
    portuguese: "Sou alérgico a…", hindi: "Mujhe … se allergy hai", japanese: "… ni arerugii ga arimasu", chinese: "Wǒ duì… guòmǐn", arabic: "Ana hasasi li…",
  }, { pronunciation: { hindi: "moo-jay say al-ler-jee hai", japanese: "nee ah-reh-roo-gee gah ah-ree-mas", chinese: "woh dway gwor-meen", arabic: "ah-nah hah-sah-see lee" }, difficulty: "advanced" }),
  p("e-21", "emergencies", "Calm down", {
    spanish: "Cálmate", french: "Calme-toi", german: "Beruhige dich", italian: "Calmati",
    portuguese: "Acalma-te", hindi: "Shaant ho jao", japanese: "Ochitsuite", chinese: "Lěngjìng", arabic: "Hadhi'",
  }, { pronunciation: { hindi: "shahn ho jah-oh", japanese: "oh-chee-tsoo-ee-tay", chinese: "lung-jeeng", arabic: "hah-dee" }, difficulty: "intermediate" }),

  // Shopping extras (7)
  p("s-15", "shopping", "Credit card", {
    spanish: "Tarjeta de crédito", french: "Carte de crédit", german: "Kreditkarte", italian: "Carta di credito",
    portuguese: "Cartão de crédito", hindi: "Credit card", japanese: "Kurejitto kaado", chinese: "Xìnyòng kǎ", arabic: "Bitaqat i'timan",
  }, { pronunciation: { hindi: "cred-it card", japanese: "koo-reh-jit-toh kah-oh-doh", chinese: "sheen-yong kah", arabic: "bee-tah-kat it-ee-man" } }),
  p("s-16", "shopping", "Cash machine / ATM", {
    spanish: "Cajero", french: "Distributeur", german: "Geldautomat", italian: "Bancomat",
    portuguese: "Multibanco", hindi: "ATM", japanese: "ATM", chinese: "ATM", arabic: "Sarraf aali",
  }, { pronunciation: { hindi: "ay-tee-em", japanese: "ay-tee-em", chinese: "ay-tee-em", arabic: "sah-raf ah-lee" } }),
  p("s-17", "shopping", "Discount", {
    spanish: "Descuento", french: "Remise", german: "Rabatt", italian: "Sconto",
    portuguese: "Desconto", hindi: "Chhoot", japanese: "Waribiki", chinese: "Zhékòu", arabic: "Khasm",
  }, { pronunciation: { hindi: "chhoot", japanese: "wah-ree-bee-kee", chinese: "juh-koh", arabic: "khahsm" } }),
  p("s-18", "shopping", "Size", {
    spanish: "Talla", french: "Taille", german: "Größe", italian: "Taglia",
    portuguese: "Tamanho", hindi: "Size", japanese: "Saizu", chinese: "Chǐcùn", arabic: "Hajm",
  }, { pronunciation: { hindi: "size", japanese: "sai-zoo", chinese: "chr-tsun", arabic: "hajm" } }),
  p("s-19", "shopping", "Color", {
    spanish: "Color", french: "Couleur", german: "Farbe", italian: "Colore",
    portuguese: "Cor", hindi: "Rang", japanese: "Iro", chinese: "Yánsè", arabic: "Lawn",
  }, { pronunciation: { hindi: "rung", japanese: "ee-roh", chinese: "yen-suh", arabic: "lawn" } }),
  p("s-20", "shopping", "Do you accept cards?", {
    spanish: "¿Aceptan tarjetas?", french: "Acceptez-vous les cartes?", german: "Akzeptieren Sie Karten?", italian: "Accettate carte?",
    portuguese: "Aceitam cartões?", hindi: "Kya aap card accept karte hain?", japanese: "Kaado wa tsukaemasu ka?", chinese: "Nǐmen jiēshòu xìnyòng kǎ ma?", arabic: "Hal taqbulun al-bituqat?",
  }, { pronunciation: { hindi: "kyah ahp card ac-cept kar-tay hain", japanese: "kah-oh-doh wah tsoo-kay-mas kah", chinese: "nee-men jay-show sheen-yong kah mah", arabic: "hal tah-koo-loon al-bee-tah-kat" }, difficulty: "advanced" }),
  p("s-21", "shopping", "Can I try it on?", {
    spanish: "¿Puedo probármelo?", french: "Puis-je l'essayer?", german: "Kann ich es anprobieren?", italian: "Posso provarlo?",
    portuguese: "Posso experimentar?", hindi: "Kya main ise try kar sakta hoon?", japanese: "Shichaku dekimasu ka?", chinese: "Wǒ kěyǐ shìchuān ma?", arabic: "Hal yumkinuni tajribatuhu?",
  }, { pronunciation: { hindi: "kyah main ee-say try kar sah-kah hoon", japanese: "shee-chah-koo day-kee-mas kah", chinese: "woh kuh-yee shr-chwan mah", arabic: "hal yoom-kin-oo-nee tah-jree-bah-too-hoo" }, difficulty: "advanced" }),

  // Directions extras (7)
  p("d-16", "directions", "Intersection", {
    spanish: "Intersección", french: "Carrefour", german: "Kreuzung", italian: "Incrocio",
    portuguese: "Cruzamento", hindi: "Chauraha", japanese: "Kousaten", chinese: "Lùkǒu", arabic: "Tafaqut",
  }, { pronunciation: { hindi: "chow-rah-hah", japanese: "koh-sah-ten", chinese: "loo-ko", arabic: "tah-fah-koot" }, difficulty: "intermediate" }),
  p("d-17", "directions", "Block (street)", {
    spanish: "Cuadra", french: "Pâté de maisons", german: "Häuserblock", italian: "Isolato",
    portuguese: "Quarteirão", hindi: "Block", japanese: "Burokku", chinese: "Jiēqū", arabic: "Qita'a",
  }, { pronunciation: { hindi: "block", japanese: "boo-rok-koo", chinese: "jyeh-choo", arabic: "kee-tah-ah" }, difficulty: "intermediate" }),
  p("d-18", "directions", "Map", {
    spanish: "Mapa", french: "Plan", german: "Karte", italian: "Piantina",
    portuguese: "Mapa", hindi: "Naksha", japanese: "Chizu", chinese: "Dìtú", arabic: "Khareeta",
  }, { pronunciation: { hindi: "nuk-shah", japanese: "chee-zoo", chinese: "dee-too", arabic: "khah-ree-tah" } }),
  p("d-19", "directions", "GPS", {
    spanish: "GPS", french: "GPS", german: "GPS", italian: "GPS",
    portuguese: "GPS", hindi: "GPS", japanese: "GPS", chinese: "GPS", arabic: "GPS",
  }, { pronunciation: { hindi: "GPS", japanese: "GPS", chinese: "GPS", arabic: "GPS" } }),
  p("d-20", "directions", "How do I get to…?", {
    spanish: "¿Cómo llego a…?", french: "Comment vais-je à…?", german: "Wie komme ich zu…?", italian: "Come arrivo a…?",
    portuguese: "Como chego a…?", hindi: "Main … kaise pahunchu?", japanese: "… e wa dou ikeba ii desu ka?", chinese: "Wǒ zěnme qù…?", arabic: "Kayfa adhhab ila…?",
  }, { pronunciation: { hindi: "main ky-say puh-noon-choo", japanese: "eh wah doh ee-key-bah ee des kah", chinese: "woh dzun-muh choo", arabic: "kay-fah adh-hab ee-lah" }, difficulty: "advanced" }),
  p("d-21", "directions", "Cross the street", {
    spanish: "Cruza la calle", french: "Traversez la rue", german: "Überqueren Sie die Straße", italian: "Attraversa la strada",
    portuguese: "Atravesse a rua", hindi: "Sadak paar karo", japanese: "Michi wo watatte", chinese: "Guò mǎlù", arabic: "Ubur al-shari'",
  }, { pronunciation: { hindi: "suh-dak pahr kah-roh", japanese: "mee-chee woh wah-taht-tay", chinese: "gwor mah-loo", arabic: "oo-bur al-shah-ree" }, difficulty: "intermediate" }),
  p("d-22", "directions", "Go straight for two blocks", {
    spanish: "Ve recto dos cuadras", french: "Allez tout droit deux pâtés", german: "Gehen Sie zwei Blocks geradeaus", italian: "Vai dritto per due isolati",
    portuguese: "Vá em frente dois quarteirões", hindi: "Do block sidhe jao", japanese: "Niburokku massugu itte", chinese: "Zhí zǒu liǎng gè jiēqū", arabic: "Imsh mustaqiman liqita'ayn",
  }, { pronunciation: { hindi: "doh block sidh-hay jah-oh", japanese: "nee-boo-rok-koo mahs-soo-goo it-tay", chinese: "jr dzoh lyang guh jyeh-choo", arabic: "im-shee moos-tah-kee-man lee-kee-tah-dayn" }, difficulty: "advanced" }),
];

// ---------------------------------------------------------------------------
// Conjugation tables (10 verbs × 6 tenses × 10 languages = 600 entries)
// We ship full conjugation for English + key verbs in major languages.
// Each tense array is 6 entries: [I, you, he/she/it, we, you-plural, they].
// ---------------------------------------------------------------------------

export const CONJUGATION_VERBS: string[] = [
  "to be", "to have", "to go", "to do", "to make",
  "to see", "to come", "to want", "to eat", "to speak",
];

export const TENSES: Tense[] = [
  "present", "past", "future", "imperfect", "conditional", "subjunctive",
];

export const TENSE_LABELS: Record<Tense, string> = {
  present: "Present",
  past: "Past (Simple)",
  future: "Future",
  imperfect: "Imperfect",
  conditional: "Conditional",
  subjunctive: "Subjunctive",
};

export const PRONOUNS = ["I", "you", "he/she/it", "we", "you (pl)", "they"];

function conjugation(
  verb: string,
  byLanguage: Partial<Record<LanguageCode, Partial<Record<Tense, string[]>>>>,
): ConjugationTable {
  // Normalize the partial into a fully-typed shape.
  const out: ConjugationTable = { verb, byLanguage: {} };
  for (const lang of Object.keys(byLanguage) as LanguageCode[]) {
    const tenses = byLanguage[lang]!;
    const filled: Record<Tense, string[]> = {
      present: tenses.present ?? ["—", "—", "—", "—", "—", "—"],
      past: tenses.past ?? ["—", "—", "—", "—", "—", "—"],
      future: tenses.future ?? ["—", "—", "—", "—", "—", "—"],
      imperfect: tenses.imperfect ?? ["—", "—", "—", "—", "—", "—"],
      conditional: tenses.conditional ?? ["—", "—", "—", "—", "—", "—"],
      subjunctive: tenses.subjunctive ?? ["—", "—", "—", "—", "—", "—"],
    };
    out.byLanguage[lang] = filled;
  }
  return out;
}

export const CONJUGATIONS: ConjugationTable[] = [
  conjugation("to be", {
    english: {
      present: ["am", "are", "is", "are", "are", "are"],
      past: ["was", "were", "was", "were", "were", "were"],
      future: ["will be", "will be", "will be", "will be", "will be", "will be"],
      imperfect: ["was being", "were being", "was being", "were being", "were being", "were being"],
      conditional: ["would be", "would be", "would be", "would be", "would be", "would be"],
      subjunctive: ["were", "were", "were", "were", "were", "were"],
    },
    spanish: {
      present: ["soy", "eres", "es", "somos", "sois", "son"],
      past: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"],
      future: ["seré", "serás", "será", "seremos", "seréis", "serán"],
      imperfect: ["era", "eras", "era", "éramos", "erais", "eran"],
      conditional: ["sería", "serías", "sería", "seríamos", "seríais", "serían"],
      subjunctive: ["sea", "seas", "sea", "seamos", "seáis", "sean"],
    },
    french: {
      present: ["suis", "es", "est", "sommes", "êtes", "sont"],
      past: ["fus", "fus", "fut", "fûmes", "fûtes", "furent"],
      future: ["serai", "seras", "sera", "serons", "serez", "seront"],
      imperfect: ["étais", "étais", "était", "étions", "étiez", "étaient"],
      conditional: ["serais", "serais", "serait", "serions", "seriez", "seraient"],
      subjunctive: ["sois", "sois", "soit", "soyons", "soyez", "soient"],
    },
    german: {
      present: ["bin", "bist", "ist", "sind", "seid", "sind"],
      past: ["war", "warst", "war", "waren", "wart", "waren"],
      future: ["werde sein", "wirst sein", "wird sein", "werden sein", "werdet sein", "werden sein"],
      imperfect: ["war", "warst", "war", "waren", "wart", "waren"],
      conditional: ["wäre", "wärest", "wäre", "wären", "wäret", "wären"],
      subjunctive: ["sei", "seiest", "sei", "seien", "seiet", "seien"],
    },
    italian: {
      present: ["sono", "sei", "è", "siamo", "siete", "sono"],
      past: ["fui", "fosti", "fu", "fummo", "foste", "furono"],
      future: ["sarò", "sarai", "sarà", "saremo", "sarete", "saranno"],
      imperfect: ["ero", "eri", "era", "eravamo", "eravate", "erano"],
      conditional: ["sarei", "saresti", "sarebbe", "saremmo", "sareste", "sarebbero"],
      subjunctive: ["sia", "sia", "sia", "siamo", "siate", "siano"],
    },
    portuguese: {
      present: ["sou", "és", "é", "somos", "sois", "são"],
      past: ["fui", "foste", "foi", "fomos", "fostes", "foram"],
      future: ["serei", "serás", "será", "seremos", "sereis", "serão"],
      imperfect: ["era", "eras", "era", "éramos", "éreis", "eram"],
      conditional: ["seria", "serias", "seria", "seríamos", "seríeis", "seriam"],
      subjunctive: ["seja", "sejas", "seja", "sejamos", "sejais", "sejam"],
    },
  }),
  conjugation("to have", {
    english: {
      present: ["have", "have", "has", "have", "have", "have"],
      past: ["had", "had", "had", "had", "had", "had"],
      future: ["will have", "will have", "will have", "will have", "will have", "will have"],
      imperfect: ["was having", "were having", "was having", "were having", "were having", "were having"],
      conditional: ["would have", "would have", "would have", "would have", "would have", "would have"],
      subjunctive: ["have", "have", "have", "have", "have", "have"],
    },
    spanish: {
      present: ["tengo", "tienes", "tiene", "tenemos", "tenéis", "tienen"],
      past: ["tuve", "tuviste", "tuvo", "tuvimos", "tuvisteis", "tuvieron"],
      future: ["tendré", "tendrás", "tendrá", "tendremos", "tendréis", "tendrán"],
      imperfect: ["tenía", "tenías", "tenía", "teníamos", "teníais", "tenían"],
      conditional: ["tendría", "tendrías", "tendría", "tendríamos", "tendríais", "tendrían"],
      subjunctive: ["tenga", "tengas", "tenga", "tengamos", "tengáis", "tengan"],
    },
    french: {
      present: ["ai", "as", "a", "avons", "avez", "ont"],
      past: ["eus", "eus", "eut", "eûmes", "eûtes", "eurent"],
      future: ["aurai", "auras", "aura", "aurons", "aurez", "auront"],
      imperfect: ["avais", "avais", "avait", "avions", "aviez", "avaient"],
      conditional: ["aurais", "aurais", "aurait", "aurions", "auriez", "auraient"],
      subjunctive: ["aie", "aies", "ait", "ayons", "ayez", "aient"],
    },
    german: {
      present: ["habe", "hast", "hat", "haben", "habt", "haben"],
      past: ["hatte", "hattest", "hatte", "hatten", "hattet", "hatten"],
      future: ["werde haben", "wirst haben", "wird haben", "werden haben", "werdet haben", "werden haben"],
      imperfect: ["hatte", "hattest", "hatte", "hatten", "hattet", "hatten"],
      conditional: ["hätte", "hättest", "hätte", "hätten", "hättet", "hätten"],
      subjunctive: ["habe", "habest", "habe", "haben", "habet", "haben"],
    },
  }),
  conjugation("to go", {
    english: {
      present: ["go", "go", "goes", "go", "go", "go"],
      past: ["went", "went", "went", "went", "went", "went"],
      future: ["will go", "will go", "will go", "will go", "will go", "will go"],
      imperfect: ["was going", "were going", "was going", "were going", "were going", "were going"],
      conditional: ["would go", "would go", "would go", "would go", "would go", "would go"],
      subjunctive: ["go", "go", "go", "go", "go", "go"],
    },
    spanish: {
      present: ["voy", "vas", "va", "vamos", "vais", "van"],
      past: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"],
      future: ["iré", "irás", "irá", "iremos", "iréis", "irán"],
      imperfect: ["iba", "ibas", "iba", "íbamos", "ibais", "iban"],
      conditional: ["iría", "irías", "iría", "iríamos", "iríais", "irían"],
      subjunctive: ["vaya", "vayas", "vaya", "vayamos", "vayáis", "vayan"],
    },
    french: {
      present: ["vais", "vas", "va", "allons", "allez", "vont"],
      past: ["allai", "allas", "alla", "allâmes", "allâtes", "allèrent"],
      future: ["irai", "iras", "ira", "irons", "irez", "iront"],
      imperfect: ["allais", "allais", "allait", "allions", "alliez", "allaient"],
      conditional: ["irais", "irais", "irait", "irions", "iriez", "iraient"],
      subjunctive: ["aille", "ailles", "aille", "allions", "alliez", "aillent"],
    },
    german: {
      present: ["gehe", "gehst", "geht", "gehen", "geht", "gehen"],
      past: ["ging", "gingst", "ging", "gingen", "gingt", "gingen"],
      future: ["werde gehen", "wirst gehen", "wird gehen", "werden gehen", "werdet gehen", "werden gehen"],
      imperfect: ["ging", "gingst", "ging", "gingen", "gingt", "gingen"],
      conditional: ["ginge", "gingest", "ginge", "gingen", "ginget", "gingen"],
      subjunctive: ["gehe", "gehest", "gehe", "gehen", "gehet", "gehen"],
    },
  }),
  conjugation("to do", {
    english: {
      present: ["do", "do", "does", "do", "do", "do"],
      past: ["did", "did", "did", "did", "did", "did"],
      future: ["will do", "will do", "will do", "will do", "will do", "will do"],
      imperfect: ["was doing", "were doing", "was doing", "were doing", "were doing", "were doing"],
      conditional: ["would do", "would do", "would do", "would do", "would do", "would do"],
      subjunctive: ["do", "do", "do", "do", "do", "do"],
    },
    spanish: {
      present: ["hago", "haces", "hace", "hacemos", "hacéis", "hacen"],
      past: ["hice", "hiciste", "hizo", "hicimos", "hicisteis", "hicieron"],
      future: ["haré", "harás", "hará", "haremos", "haréis", "harán"],
      imperfect: ["hacía", "hacías", "hacía", "hacíamos", "hacíais", "hacían"],
      conditional: ["haría", "harías", "haría", "haríamos", "haríais", "harían"],
      subjunctive: ["haga", "hagas", "haga", "hagamos", "hagáis", "hagan"],
    },
    french: {
      present: ["fais", "fais", "fait", "faisons", "faites", "font"],
      past: ["fis", "fis", "fit", "fîmes", "fîtes", "firent"],
      future: ["ferai", "feras", "fera", "ferons", "ferez", "feront"],
      imperfect: ["faisais", "faisais", "faisait", "faisions", "faisiez", "faisaient"],
      conditional: ["ferais", "ferais", "ferait", "ferions", "feriez", "feraient"],
      subjunctive: ["fasse", "fasses", "fasse", "fassions", "fassiez", "fassent"],
    },
  }),
  conjugation("to make", {
    english: {
      present: ["make", "make", "makes", "make", "make", "make"],
      past: ["made", "made", "made", "made", "made", "made"],
      future: ["will make", "will make", "will make", "will make", "will make", "will make"],
      imperfect: ["was making", "were making", "was making", "were making", "were making", "were making"],
      conditional: ["would make", "would make", "would make", "would make", "would make", "would make"],
      subjunctive: ["make", "make", "make", "make", "make", "make"],
    },
    spanish: {
      present: ["hago", "haces", "hace", "hacemos", "hacéis", "hacen"],
      past: ["hice", "hiciste", "hizo", "hicimos", "hicisteis", "hicieron"],
      future: ["haré", "harás", "hará", "haremos", "haréis", "harán"],
      imperfect: ["hacía", "hacías", "hacía", "hacíamos", "hacíais", "hacían"],
      conditional: ["haría", "harías", "haría", "haríamos", "haríais", "harían"],
      subjunctive: ["haga", "hagas", "haga", "hagamos", "hagáis", "hagan"],
    },
    italian: {
      present: ["faccio", "fai", "fa", "facciamo", "fate", "fanno"],
      past: ["feci", "facesti", "fece", "facemmo", "faceste", "fecero"],
      future: ["farò", "farai", "farà", "faremo", "farete", "faranno"],
      imperfect: ["facevo", "facevi", "faceva", "facevamo", "facevate", "facevano"],
      conditional: ["farei", "faresti", "farebbe", "faremmo", "fareste", "farebbero"],
      subjunctive: ["faccia", "faccia", "faccia", "facciamo", "facciate", "facciano"],
    },
  }),
  conjugation("to see", {
    english: {
      present: ["see", "see", "sees", "see", "see", "see"],
      past: ["saw", "saw", "saw", "saw", "saw", "saw"],
      future: ["will see", "will see", "will see", "will see", "will see", "will see"],
      imperfect: ["was seeing", "were seeing", "was seeing", "were seeing", "were seeing", "were seeing"],
      conditional: ["would see", "would see", "would see", "would see", "would see", "would see"],
      subjunctive: ["see", "see", "see", "see", "see", "see"],
    },
    spanish: {
      present: ["veo", "ves", "ve", "vemos", "veis", "ven"],
      past: ["vi", "viste", "vio", "vimos", "visteis", "vieron"],
      future: ["veré", "verás", "verá", "veremos", "veréis", "verán"],
      imperfect: ["veía", "veías", "veía", "veíamos", "veíais", "veían"],
      conditional: ["vería", "verías", "vería", "veríamos", "veríais", "verían"],
      subjunctive: ["vea", "veas", "vea", "veamos", "veáis", "vean"],
    },
    french: {
      present: ["vois", "vois", "voit", "voyons", "voyez", "voient"],
      past: ["vis", "vis", "vit", "vîmes", "vîtes", "virent"],
      future: ["verrai", "verras", "verra", "verrons", "verrez", "verront"],
      imperfect: ["voyais", "voyais", "voyait", "voyions", "voyiez", "voyaient"],
      conditional: ["verrais", "verrais", "verrait", "verrions", "verriez", "verraient"],
      subjunctive: ["voie", "voies", "voie", "voyions", "voyiez", "voient"],
    },
  }),
  conjugation("to come", {
    english: {
      present: ["come", "come", "comes", "come", "come", "come"],
      past: ["came", "came", "came", "came", "came", "came"],
      future: ["will come", "will come", "will come", "will come", "will come", "will come"],
      imperfect: ["was coming", "were coming", "was coming", "were coming", "were coming", "were coming"],
      conditional: ["would come", "would come", "would come", "would come", "would come", "would come"],
      subjunctive: ["come", "come", "come", "come", "come", "come"],
    },
    spanish: {
      present: ["vengo", "vienes", "viene", "venimos", "venís", "vienen"],
      past: ["vine", "viniste", "vino", "vinimos", "vinisteis", "vinieron"],
      future: ["vendré", "vendrás", "vendrá", "vendremos", "vendréis", "vendrán"],
      imperfect: ["venía", "venías", "venía", "veníamos", "veníais", "venían"],
      conditional: ["vendría", "vendrías", "vendría", "vendríamos", "vendríais", "vendrían"],
      subjunctive: ["venga", "vengas", "venga", "vengamos", "vengáis", "vengan"],
    },
    french: {
      present: ["viens", "viens", "vient", "venons", "venez", "viennent"],
      past: ["vins", "vins", "vint", "vînmes", "vîntes", "vinrent"],
      future: ["viendrai", "viendras", "viendra", "viendrons", "viendrez", "viendront"],
      imperfect: ["venais", "venais", "venait", "venions", "veniez", "venaient"],
      conditional: ["viendrais", "viendrais", "viendrait", "viendrions", "viendriez", "viendraient"],
      subjunctive: ["vienne", "viennes", "vienne", "venions", "veniez", "viennent"],
    },
  }),
  conjugation("to want", {
    english: {
      present: ["want", "want", "wants", "want", "want", "want"],
      past: ["wanted", "wanted", "wanted", "wanted", "wanted", "wanted"],
      future: ["will want", "will want", "will want", "will want", "will want", "will want"],
      imperfect: ["was wanting", "were wanting", "was wanting", "were wanting", "were wanting", "were wanting"],
      conditional: ["would want", "would want", "would want", "would want", "would want", "would want"],
      subjunctive: ["want", "want", "want", "want", "want", "want"],
    },
    spanish: {
      present: ["quiero", "quieres", "quiere", "queremos", "queréis", "quieren"],
      past: ["quise", "quisiste", "quiso", "quisimos", "quisisteis", "quisieron"],
      future: ["querré", "querrás", "querrá", "querremos", "querréis", "querrán"],
      imperfect: ["quería", "querías", "quería", "queríamos", "queríais", "querían"],
      conditional: ["querría", "querrías", "querría", "querríamos", "querríais", "querrían"],
      subjunctive: ["quiera", "quieras", "quiera", "queramos", "queráis", "quieran"],
    },
    french: {
      present: ["veux", "veux", "veut", "voulons", "voulez", "veulent"],
      past: ["voulus", "voulus", "voulut", "voulûmes", "voulûtes", "voulurent"],
      future: ["voudrai", "voudras", "voudra", "voudrons", "voudrez", "voudront"],
      imperfect: ["voulais", "voulais", "voulait", "voulions", "vouliez", "voulaient"],
      conditional: ["voudrais", "voudrais", "voudrait", "voudrions", "voudriez", "voudraient"],
      subjunctive: ["veuille", "veuilles", "veuille", "voulions", "vouliez", "veuillent"],
    },
  }),
  conjugation("to eat", {
    english: {
      present: ["eat", "eat", "eats", "eat", "eat", "eat"],
      past: ["ate", "ate", "ate", "ate", "ate", "ate"],
      future: ["will eat", "will eat", "will eat", "will eat", "will eat", "will eat"],
      imperfect: ["was eating", "were eating", "was eating", "were eating", "were eating", "were eating"],
      conditional: ["would eat", "would eat", "would eat", "would eat", "would eat", "would eat"],
      subjunctive: ["eat", "eat", "eat", "eat", "eat", "eat"],
    },
    spanish: {
      present: ["como", "comes", "come", "comemos", "coméis", "comen"],
      past: ["comí", "comiste", "comió", "comimos", "comisteis", "comieron"],
      future: ["comeré", "comerás", "comerá", "comeremos", "comeréis", "comerán"],
      imperfect: ["comía", "comías", "comía", "comíamos", "comíais", "comían"],
      conditional: ["comería", "comerías", "comería", "comeríamos", "comeríais", "comerían"],
      subjunctive: ["coma", "comas", "coma", "comamos", "comáis", "coman"],
    },
    french: {
      present: ["mange", "manges", "mange", "mangeons", "mangez", "mangent"],
      past: ["mangeai", "mangeas", "mangea", "mangeâmes", "mangeâtes", "mangèrent"],
      future: ["mangerai", "mangeras", "mangera", "mangerons", "mangerez", "mangeront"],
      imperfect: ["mangeais", "mangeais", "mangeait", "mangions", "mangiez", "mangeaient"],
      conditional: ["mangerais", "mangerais", "mangerait", "mangerions", "mangeriez", "mangeraient"],
      subjunctive: ["mange", "manges", "mange", "mangions", "mangiez", "mangent"],
    },
  }),
  conjugation("to speak", {
    english: {
      present: ["speak", "speak", "speaks", "speak", "speak", "speak"],
      past: ["spoke", "spoke", "spoke", "spoke", "spoke", "spoke"],
      future: ["will speak", "will speak", "will speak", "will speak", "will speak", "will speak"],
      imperfect: ["was speaking", "were speaking", "was speaking", "were speaking", "were speaking", "were speaking"],
      conditional: ["would speak", "would speak", "would speak", "would speak", "would speak", "would speak"],
      subjunctive: ["speak", "speak", "speak", "speak", "speak", "speak"],
    },
    spanish: {
      present: ["hablo", "hablas", "habla", "hablamos", "habláis", "hablan"],
      past: ["hablé", "hablaste", "habló", "hablamos", "hablasteis", "hablaron"],
      future: ["hablaré", "hablarás", "hablará", "hablaremos", "hablaréis", "hablarán"],
      imperfect: ["hablaba", "hablabas", "hablaba", "hablábamos", "hablabais", "hablaban"],
      conditional: ["hablaría", "hablarías", "hablaría", "hablaríamos", "hablaríais", "hablarían"],
      subjunctive: ["hable", "hables", "hable", "hablemos", "habléis", "hablen"],
    },
    french: {
      present: ["parle", "parles", "parle", "parlons", "parlez", "parlent"],
      past: ["parlai", "parlas", "parla", "parlâmes", "parlâtes", "parlèrent"],
      future: ["parlerai", "parleras", "parlera", "parlerons", "parlerez", "parleront"],
      imperfect: ["parlais", "parlais", "parlait", "parlions", "parliez", "parlaient"],
      conditional: ["parlerais", "parlerais", "parlerait", "parlerions", "parleriez", "parleraient"],
      subjunctive: ["parle", "parles", "parle", "parlions", "parliez", "parlent"],
    },
  }),
];

// ---------------------------------------------------------------------------
// Number translator (1-100) — generated from per-language digit/teens words.
// ---------------------------------------------------------------------------

const NUMBER_WORDS: Record<LanguageCode, {
  units: string[]; // 0-9
  teens: string[]; // 10-19
  tens: string[];  // 20,30,...,90 (index 2-9)
  hundred: string;
}> = {
  english: {
    units: ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"],
    teens: ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"],
    tens: ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"],
    hundred: "one hundred",
  },
  spanish: {
    units: ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"],
    teens: ["diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"],
    tens: ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"],
    hundred: "cien",
  },
  french: {
    units: ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"],
    teens: ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"],
    tens: ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingts", "quatre-vingt-dix"],
    hundred: "cent",
  },
  german: {
    units: ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun"],
    teens: ["zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"],
    tens: ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"],
    hundred: "einhundert",
  },
  italian: {
    units: ["zero", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove"],
    teens: ["dieci", "undici", "dodici", "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove"],
    tens: ["", "", "venti", "trenta", "quaranta", "cinquanta", "sessanta", "settanta", "ottanta", "novanta"],
    hundred: "cento",
  },
  portuguese: {
    units: ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"],
    teens: ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"],
    tens: ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"],
    hundred: "cem",
  },
  hindi: {
    units: ["shunya", "ek", "do", "teen", "char", "paanch", "chhah", "saat", "aath", "nau"],
    teens: ["das", "gyarah", "barah", "terah", "chaudah", "pandrah", "solah", "satrah", "atharah", "unnis"],
    tens: ["", "", "bees", "tees", "chaalees", "pachaas", "saath", "sattar", "assi", "nabbe"],
    hundred: "sau",
  },
  japanese: {
    units: ["zero", "ichi", "ni", "san", "yon", "go", "roku", "nana", "hachi", "kyuu"],
    teens: ["juu", "juu-ichi", "juu-ni", "juu-san", "juu-yon", "juu-go", "juu-roku", "juu-nana", "juu-hachi", "juu-kyuu"],
    tens: ["", "", "nijuu", "sanjuu", "yonjuu", "gojuu", "rokujuu", "nanajuu", "hachijuu", "kyuujuu"],
    hundred: "hyaku",
  },
  chinese: {
    units: ["líng", "yī", "èr", "sān", "sì", "wǔ", "liù", "qī", "bā", "jiǔ"],
    teens: ["shí", "shíyī", "shíèr", "shísān", "shísì", "shíwǔ", "shíliù", "shíqī", "shíbā", "shíjiǔ"],
    tens: ["", "", "èrshí", "sānshí", "sìshí", "wǔshí", "liùshí", "qīshí", "bāshí", "jiǔshí"],
    hundred: "yī bǎi",
  },
  arabic: {
    units: ["sifr", "wahid", "ithnan", "thalatha", "arba'a", "khamsa", "sitta", "sab'a", "thamaniya", "tis'a"],
    teens: ["ashara", "ahada ashar", "ithna ashar", "thalatha ashar", "arba'a ashar", "khamsa ashar", "sitta ashar", "sab'a ashar", "thamaniya ashar", "tis'a ashar"],
    tens: ["", "", "ishrun", "thalathun", "arba'un", "khamsun", "sittun", "sab'un", "thamanun", "tis'un"],
    hundred: "mi'a",
  },
};

/** Translate a number 0-100 into words for the given language. */
export function translateNumber(num: number, lang: LanguageCode): string {
  if (!Number.isInteger(num) || num < 0 || num > 100) return "";
  const dict = NUMBER_WORDS[lang];
  if (num === 100) return dict.hundred;
  if (num < 10) return dict.units[num];
  if (num < 20) return dict.teens[num - 10];
  const tens = Math.floor(num / 10);
  const units = num % 10;
  if (units === 0) return dict.tens[tens];
  // For most languages: "twenty-one" style; for Japanese/Chinese: "nijuu-ichi".
  if (lang === "japanese" || lang === "chinese") {
    return `${dict.tens[tens]}-${dict.units[units]}`;
  }
  if (lang === "german") {
    // German reverses order: "einundzwanzig".
    return `${dict.units[units]}und${dict.tens[tens]}`;
  }
  return `${dict.tens[tens]}-${dict.units[units]}`;
}

/** Build the full number-translation table (1-100) for all languages. */
export function buildNumberTable(): NumberTranslation[] {
  const out: NumberTranslation[] = [];
  for (let n = 1; n <= 100; n++) {
    const byLanguage: Partial<Record<LanguageCode, string>> = {};
    for (const lang of LANGUAGES) {
      byLanguage[lang] = translateNumber(n, lang);
    }
    out.push({ num: n, byLanguage });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Translate a phrase from source → target.
 * If source is english, look up the english phrase and return its target
 * translation. If source ≠ english, do a reverse lookup (find the phrase
 * whose source-language translation matches, then return english/target).
 */
export function lookupTranslation(
  source: LanguageCode,
  target: LanguageCode,
  query: string,
): { phrase: Phrase; result: string; pronunciation?: string } | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  for (const phrase of PHRASES) {
    if (source === "english") {
      if (phrase.english.toLowerCase() !== q) continue;
      const result = target === "english"
        ? phrase.english
        : phrase.translations[target];
      if (!result) continue;
      const pron = target !== "english" ? phrase.pronunciation?.[target] : undefined;
      return { phrase, result, pronunciation: pron };
    }
    // Source is non-English — match against translations[source].
    const srcVal = phrase.translations[source];
    if (!srcVal || srcVal.toLowerCase() !== q) continue;
    const result = target === "english"
      ? phrase.english
      : phrase.translations[target] ?? phrase.english;
    const pron = target !== "english" ? phrase.pronunciation?.[target] : undefined;
    return { phrase, result, pronunciation: pron };
  }
  return null;
}

/** Reverse translation: target → source. */
export function lookupReverse(
  source: LanguageCode,
  target: LanguageCode,
  query: string,
): { phrase: Phrase; result: string; pronunciation?: string } | null {
  return lookupTranslation(target, source, query);
}

/** Filter phrases by category and language pair (target must have a translation). */
export function filterPhrases(
  category: PhraseCategory | "",
  source: LanguageCode,
  target: LanguageCode,
  search: string = "",
): Phrase[] {
  const q = search.trim().toLowerCase();
  return PHRASES.filter((p) => {
    if (category && p.category !== category) return false;
    // If neither source nor target is english, ensure we have both translations
    // OR a translation+english fallback.
    if (source !== "english" && !p.translations[source]) return false;
    if (target !== "english" && !p.translations[target]) return false;
    if (q) {
      const english = p.english.toLowerCase();
      const srcTxt = source === "english" ? english : (p.translations[source] ?? "").toLowerCase();
      const tgtTxt = target === "english" ? english : (p.translations[target] ?? "").toLowerCase();
      if (!english.includes(q) && !srcTxt.includes(q) && !tgtTxt.includes(q)) return false;
    }
    return true;
  });
}

/** Get a phrase's translation in a given language (or fallback to english). */
export function getPhraseText(phrase: Phrase, lang: LanguageCode): string {
  if (lang === "english") return phrase.english;
  return phrase.translations[lang] ?? phrase.english;
}

/** Get a phrase's pronunciation (romanized) in a given language. */
export function getPhrasePronunciation(phrase: Phrase, lang: LanguageCode): string | undefined {
  if (lang === "english") return undefined;
  return phrase.pronunciation?.[lang];
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

export function computeStats(
  filtered: Phrase[],
  source: LanguageCode,
  target: LanguageCode,
): SummaryStats {
  const byCategory = {} as Record<PhraseCategory, number>;
  for (const c of CATEGORIES) byCategory[c] = 0;
  for (const p of filtered) byCategory[p.category] += 1;
  return {
    totalPhrases: filtered.length,
    byCategory,
    byLanguagePair: filtered.length,
  };
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

/** Render a phrasebook as plain text. */
export function renderText(
  filtered: Phrase[],
  source: LanguageCode,
  target: LanguageCode,
): string {
  const lines: string[] = [];
  lines.push("Language Translator Helper — Phrasebook");
  lines.push("========================================");
  lines.push(`Source: ${LANGUAGE_LABELS[source]} → Target: ${LANGUAGE_LABELS[target]}`);
  lines.push(`Phrases: ${filtered.length}`);
  lines.push("");
  let currentCategory: PhraseCategory | null = null;
  for (const phrase of filtered) {
    if (phrase.category !== currentCategory) {
      currentCategory = phrase.category;
      lines.push("");
      lines.push(`## ${CATEGORY_LABELS[currentCategory]}`);
    }
    const src = getPhraseText(phrase, source);
    const tgt = getPhraseText(phrase, target);
    const pron = getPhrasePronunciation(phrase, target);
    lines.push(`- ${src} → ${tgt}${pron ? ` (${pron})` : ""}`);
  }
  return lines.join("\n");
}

/** Render a phrasebook as CSV. */
export function renderCsv(filtered: Phrase[], source: LanguageCode, target: LanguageCode): string {
  const lines = ["category,source,target,pronunciation,difficulty"];
  for (const phrase of filtered) {
    const src = getPhraseText(phrase, source);
    const tgt = getPhraseText(phrase, target);
    const pron = getPhrasePronunciation(phrase, target) ?? "";
    lines.push([
      CATEGORY_LABELS[phrase.category],
      escapeCsv(src),
      escapeCsv(tgt),
      escapeCsv(pron),
      phrase.difficulty,
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:language-translator-helper:history";
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
// Shareable URL
// ---------------------------------------------------------------------------

export interface ShareState {
  source: LanguageCode;
  target: LanguageCode;
  category: PhraseCategory | "";
  mode: PracticeMode;
  search: string;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("src", state.source);
  params.set("tgt", state.target);
  if (state.category) params.set("cat", state.category);
  if (state.mode !== "browse") params.set("mode", state.mode);
  if (state.search) params.set("q", state.search);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const defaults: ShareState = {
    source: "english",
    target: "spanish",
    category: "",
    mode: "browse",
    search: "",
  };
  if (!clean) return defaults;
  const params = new URLSearchParams(clean);
  const validLangs = LANGUAGES;
  const validCats = CATEGORIES;
  const validModes = PRACTICE_MODES;
  const src = params.get("src");
  const tgt = params.get("tgt");
  const cat = params.get("cat");
  const mode = params.get("mode");
  return {
    source: src && validLangs.includes(src as LanguageCode) ? (src as LanguageCode) : defaults.source,
    target: tgt && validLangs.includes(tgt as LanguageCode) ? (tgt as LanguageCode) : defaults.target,
    category: cat && validCats.includes(cat as PhraseCategory) ? (cat as PhraseCategory) : defaults.category,
    mode: mode && validModes.includes(mode as PracticeMode) ? (mode as PracticeMode) : defaults.mode,
    search: params.get("q") ?? defaults.search,
  };
}

// ---------------------------------------------------------------------------
// Flashcard deck builder
// ---------------------------------------------------------------------------

export interface Flashcard {
  front: string; // source text
  back: string;  // target text
  pronunciation?: string;
  category: PhraseCategory;
}

/** Build a flashcard deck from the filtered phrase list. */
export function buildFlashcards(
  filtered: Phrase[],
  source: LanguageCode,
  target: LanguageCode,
): Flashcard[] {
  return filtered.map((p) => ({
    front: getPhraseText(p, source),
    back: getPhraseText(p, target),
    pronunciation: getPhrasePronunciation(p, target),
    category: p.category,
  }));
}

/** Shuffle a flashcard deck (Fisher-Yates). */
export function shuffleCards(cards: Flashcard[], rng: () => number = Math.random): Flashcard[] {
  const out = cards.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
