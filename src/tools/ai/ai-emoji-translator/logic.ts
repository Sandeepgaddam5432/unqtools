/**
 * AI Emoji Translator — pure logic.
 *
 * Bidirectional text↔emoji translation with adjustable density, modes,
 * and Unicode/Discord/Slack shortcode output targets. Pure functions only
 * — no DOM, no network. The optional LLM call (BYO API key) lives in ui.tsx
 * because it touches the network.
 */

// ---------- Types ----------

export type TranslationMode = "strict" | "loose" | "ratio";
export type Density = "sparse" | "medium" | "dense";
export type OutputTarget = "unicode" | "discord" | "slack";

export interface EmojiEntry {
  word: string;
  emojis: string[];          // ordered: most common first
  shortcodes: string[];      // parallel to emojis, e.g. ":smile:"
  contexts?: Record<string, number>; // context cue -> index of emoji to pick
}

export interface TokenMatch {
  raw: string;               // original text segment
  word: string;              // normalized lowercase word ("" if not a word)
  matched: boolean;
  emoji: string | null;      // chosen emoji
  shortcode: string | null;  // chosen shortcode (":smile:")
  alternatives: string[];    // other emoji candidates
  confidence: number;        // 0-1
  startIndex: number;
  endIndex: number;
}

export interface TranslationResult {
  input: string;
  output: string;            // rendered with chosen target
  matches: TokenMatch[];
  matchCount: number;
  totalWords: number;
  coverage: number;          // 0-1
  mode: TranslationMode;
  density: Density;
  target: OutputTarget;
}

export interface DecodeResult {
  input: string;
  output: string;
  decodedCount: number;
  unknown: string[];
}

export interface Stats {
  totalWords: number;
  matchedWords: number;
  uniqueEmojis: number;
  coverage: number;
}

export interface HistoryEntry {
  ts: number;
  direction: "encode" | "decode";
  input: string;
  output: string;
  mode: TranslationMode;
  density: Density;
  target: OutputTarget;
}

export interface ShareState {
  text: string;
  mode: TranslationMode;
  density: Density;
  target: OutputTarget;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-emoji-translator:history";
export const HISTORY_MAX = 20;

export const MODE_LABELS: Record<TranslationMode, string> = {
  strict: "Strict (whole word only)",
  loose: "Loose (substrings + plurals)",
  ratio: "Ratio (density-ranked)",
};

export const DENSITY_LABELS: Record<Density, string> = {
  sparse: "Sparse (~30% of matches)",
  medium: "Medium (~60% of matches)",
  dense: "Dense (~95% of matches)",
};

export const DENSITY_RATIO: Record<Density, number> = {
  sparse: 0.3,
  medium: 0.6,
  dense: 0.95,
};

export const TARGET_LABELS: Record<OutputTarget, string> = {
  unicode: "Unicode emoji",
  discord: "Discord :shortcode:",
  slack: "Slack :shortcode:",
};

export const TOPIC_PRESETS: string[] = [
  "I love pizza and coffee on a rainy day",
  "The dog ran fast through the green park",
  "Happy birthday! Have a wonderful day",
  "I am so tired but I have to work",
  "Let's go to the beach this weekend",
  "Good morning sunshine, time to code",
  "She broke my heart and I am sad",
  "Pizza is my favorite food forever",
];

// ---------- Emoji Lexicon (500+ entries) ----------
// Each entry: word -> { emojis, shortcodes, optional contexts }
// `contexts` maps a context-cue word (lowercase) to the index of the
// emoji in the `emojis` array that should be preferred when that cue
// appears within ±3 tokens of the matched word.

export const EMOJI_DICTIONARY: EmojiEntry[] = [
  // ---- Emotions ----
  { word: "happy", emojis: ["😄", "😊"], shortcodes: [":smile:", ":blush:"] },
  { word: "sad", emojis: ["😢", "😭"], shortcodes: [":cry:", ":sob:"] },
  { word: "angry", emojis: ["😠", "😡"], shortcodes: [":angry:", ":rage:"] },
  { word: "love", emojis: ["❤️", "😍"], shortcodes: [":heart:", ":heart_eyes:"] },
  { word: "hate", emojis: ["😤", "👎"], shortcodes: [":triumph:", ":thumbsdown:"] },
  { word: "laugh", emojis: ["😂", "🤣"], shortcodes: [":joy:", ":rofl:"] },
  { word: "smile", emojis: ["😊", "🙂"], shortcodes: [":blush:", ":slight_smile:"] },
  { word: "cry", emojis: ["😭", "😢"], shortcodes: [":sob:", ":cry:"] },
  { word: "fear", emojis: ["😨", "😱"], shortcodes: [":fearful:", ":scream:"] },
  { word: "afraid", emojis: ["😨", "😱"], shortcodes: [":fearful:", ":scream:"] },
  { word: "tired", emojis: ["😴", "🥱"], shortcodes: [":sleeping:", ":yawning:"] },
  { word: "sleepy", emojis: ["😴", "😪"], shortcodes: [":sleeping:", ":sleepy:"] },
  { word: "excited", emojis: ["🤩", "😆"], shortcodes: [":star_struck:", ":laughing:"] },
  { word: "surprised", emojis: ["😮", "😲"], shortcodes: [":open_mouth:", ":astonished:"] },
  { word: "shocked", emojis: ["😱", "😲"], shortcodes: [":scream:", ":astonished:"] },
  { word: "bored", emojis: ["🥱", "😐"], shortcodes: [":yawning:", ":neutral_face:"] },
  { word: "confused", emojis: ["😕", "🤔"], shortcodes: [":confused:", ":thinking:"] },
  { word: "think", emojis: ["🤔", "💭"], shortcodes: [":thinking:", ":thought_balloon:"] },
  { word: "sick", emojis: ["🤒", "🤢"], shortcodes: [":face_with_thermometer:", ":nauseated_face:"] },
  { word: "ok", emojis: ["👌", "✅"], shortcodes: [":ok_hand:", ":white_check_mark:"] },
  { word: "okay", emojis: ["👌", "👍"], shortcodes: [":ok_hand:", ":thumbsup:"] },
  { word: "yes", emojis: ["✅", "👍"], shortcodes: [":white_check_mark:", ":thumbsup:"] },
  { word: "no", emojis: ["❌", "🚫"], shortcodes: [":x:", ":no_entry_sign:"] },
  { word: "wow", emojis: ["😮", "🤯"], shortcodes: [":open_mouth:", ":exploding_head:"] },
  { word: "cool", emojis: ["😎", "🆒"], shortcodes: [":sunglasses:", ":cool:"] },
  { word: "hot", emojis: ["🔥", "🥵"], shortcodes: [":fire:", ":hot_face:"] },
  { word: "cold", emojis: ["🥶", "❄️"], shortcodes: [":cold_face:", ":snowflake:"] },
  { word: "fun", emojis: ["🎉", "🤩"], shortcodes: [":tada:", ":star_struck:"] },
  { word: "funny", emojis: ["😂", "🤣"], shortcodes: [":joy:", ":rofl:"] },
  { word: "amazing", emojis: ["🤩", "🌟"], shortcodes: [":star_struck:", ":star2:"] },
  { word: "awesome", emojis: ["🤩", "👍"], shortcodes: [":star_struck:", ":thumbsup:"] },
  { word: "great", emojis: ["👍", "🎉"], shortcodes: [":thumbsup:", ":tada:"] },
  { word: "good", emojis: ["👍", "✅"], shortcodes: [":thumbsup:", ":white_check_mark:"] },
  { word: "bad", emojis: ["👎", "❌"], shortcodes: [":thumbsdown:", ":x:"] },
  { word: "best", emojis: ["🏆", "⭐"], shortcodes: [":trophy:", ":star:"] },
  { word: "worst", emojis: ["💀", "🤮"], shortcodes: [":skull:", ":face_vomiting:"] },

  // ---- People & Body ----
  { word: "person", emojis: ["🧑", "👤"], shortcodes: [":adult:", ":bust_in_silhouette:"] },
  { word: "people", emojis: ["👥", "👨‍👩‍👧‍👦"], shortcodes: [":busts_in_silhouette:", ":family_man_woman_girl_boy:"] },
  { word: "man", emojis: ["👨", "🧔"], shortcodes: [":man:", ":bearded_person:"] },
  { word: "woman", emojis: ["👩", "👧"], shortcodes: [":woman:", ":girl:"] },
  { word: "boy", emojis: ["👦", "🧒"], shortcodes: [":boy:", ":child:"] },
  { word: "girl", emojis: ["👧", "👩"], shortcodes: [":girl:", ":woman:"] },
  { word: "baby", emojis: ["👶", "🍼"], shortcodes: [":baby:", ":baby_bottle:"] },
  { word: "child", emojis: ["🧒", "👶"], shortcodes: [":child:", ":baby:"] },
  { word: "family", emojis: ["👨‍👩‍👧‍👦", "🏡"], shortcodes: [":family_man_woman_girl_boy:", ":house_with_garden:"] },
  { word: "friend", emojis: ["🤝", "👫"], shortcodes: [":handshake:", ":couple:"] },
  { word: "friends", emojis: ["👫", "🤝"], shortcodes: [":couple:", ":handshake:"] },
  { word: "heart", emojis: ["❤️", "💖"], shortcodes: [":heart:", ":sparkling_heart:"] },
  { word: "eye", emojis: ["👁️", "👀"], shortcodes: [":eye:", ":eyes:"] },
  { word: "eyes", emojis: ["👀", "👁️"], shortcodes: [":eyes:", ":eye:"] },
  { word: "hand", emojis: ["✋", "🤚"], shortcodes: [":raised_hand:", ":raised_back_of_hand:"] },
  { word: "hands", emojis: ["🙌", "👏"], shortcodes: [":raised_hands:", ":clap:"] },
  { word: "face", emojis: ["😀", "😌"], shortcodes: [":grinning:", ":relieved:"] },
  { word: "mouth", emojis: ["👄", "😬"], shortcodes: [":mouth:", ":grimacing:"] },
  { word: "nose", emojis: ["👃", "🤧"], shortcodes: [":nose:", ":sneezing_face:"] },
  { word: "ear", emojis: ["👂", "🎶"], shortcodes: [":ear:", ":notes:"] },
  { word: "foot", emojis: ["🦶", "👣"], shortcodes: [":foot:", ":footprints:"] },
  { word: "brain", emojis: ["🧠", "💭"], shortcodes: [":brain:", ":thought_balloon:"] },
  { word: "bone", emojis: ["🦴", "💀"], shortcodes: [":bone:", ":skull:"] },
  { word: "muscle", emojis: ["💪", "🏋️"], shortcodes: [":muscle:", ":weight_lifter:"] },

  // ---- Animals ----
  { word: "dog", emojis: ["🐶", "🐕"], shortcodes: [":dog:", ":dog2:"] },
  { word: "puppy", emojis: ["🐶", "🐕"], shortcodes: [":dog:", ":dog2:"] },
  { word: "cat", emojis: ["🐱", "🐈"], shortcodes: [":cat:", ":cat2:"] },
  { word: "kitten", emojis: ["🐱", "🐈"], shortcodes: [":cat:", ":cat2:"] },
  { word: "mouse", emojis: ["🐭", "🐁"], shortcodes: [":mouse:", ":mouse2:"] },
  { word: "rat", emojis: ["🐀", "🐭"], shortcodes: [":rat:", ":mouse:"] },
  { word: "rabbit", emojis: ["🐰", "🐇"], shortcodes: [":rabbit:", ":rabbit2:"] },
  { word: "bunny", emojis: ["🐰", "🐇"], shortcodes: [":rabbit:", ":rabbit2:"] },
  { word: "bear", emojis: ["🐻", "🐼"], shortcodes: [":bear:", ":panda:"] },
  { word: "panda", emojis: ["🐼", "🐻"], shortcodes: [":panda:", ":bear:"] },
  { word: "koala", emojis: ["🐨", "🐼"], shortcodes: [":koala:", ":panda:"] },
  { word: "tiger", emojis: ["🐯", "🐅"], shortcodes: [":tiger:", ":tiger2:"] },
  { word: "lion", emojis: ["🦁", "🐯"], shortcodes: [":lion:", ":tiger:"] },
  { word: "cow", emojis: ["🐮", "🐄"], shortcodes: [":cow:", ":cow2:"] },
  { word: "pig", emojis: ["🐷", "🐖"], shortcodes: [":pig:", ":pig2:"] },
  { word: "frog", emojis: ["🐸", "🐊"], shortcodes: [":frog:", ":crocodile:"] },
  { word: "monkey", emojis: ["🐵", "🐒"], shortcodes: [":monkey_face:", ":monkey:"] },
  { word: "chicken", emojis: ["🐔", "🐓"], shortcodes: [":chicken:", ":rooster:"] },
  { word: "bird", emojis: ["🐦", "🐤"], shortcodes: [":bird:", ":baby_chick:"] },
  { word: "duck", emojis: ["🦆", "🐦"], shortcodes: [":duck:", ":bird:"] },
  { word: "eagle", emojis: ["🦅", "🐦"], shortcodes: [":eagle:", ":bird:"] },
  { word: "owl", emojis: ["🦉", "🐦"], shortcodes: [":owl:", ":bird:"] },
  { word: "parrot", emojis: ["🦜", "🐦"], shortcodes: [":parrot:", ":bird:"] },
  { word: "penguin", emojis: ["🐧", "🐦"], shortcodes: [":penguin:", ":bird:"] },
  { word: "fish", emojis: ["🐟", "🐠"], shortcodes: [":fish:", ":tropical_fish:"] },
  { word: "whale", emojis: ["🐋", "🐳"], shortcodes: [":whale2:", ":whale:"] },
  { word: "dolphin", emojis: ["🐬", "🐋"], shortcodes: [":dolphin:", ":whale2:"] },
  { word: "shark", emojis: ["🦈", "🐟"], shortcodes: [":shark:", ":fish:"] },
  { word: "octopus", emojis: ["🐙", "🦑"], shortcodes: [":octopus:", ":squid:"] },
  { word: "squid", emojis: ["🦑", "🐙"], shortcodes: [":squid:", ":octopus:"] },
  { word: "crab", emojis: ["🦀", "🦞"], shortcodes: [":crab:", ":lobster:"] },
  { word: "snake", emojis: ["🐍", "🦎"], shortcodes: [":snake:", ":lizard:"] },
  { word: "lizard", emojis: ["🦎", "🐍"], shortcodes: [":lizard:", ":snake:"] },
  { word: "turtle", emojis: ["🐢", "🦎"], shortcodes: [":turtle:", ":lizard:"] },
  { word: "horse", emojis: ["🐴", "🐎"], shortcodes: [":horse:", ":racehorse:"] },
  { word: "unicorn", emojis: ["🦄", "🐴"], shortcodes: [":unicorn:", ":horse:"] },
  { word: "zebra", emojis: ["🦓", "🐴"], shortcodes: [":zebra:", ":horse:"] },
  { word: "elephant", emojis: ["🐘", "🦏"], shortcodes: [":elephant:", ":rhinoceros:"] },
  { word: "rhino", emojis: ["🦏", "🐘"], shortcodes: [":rhinoceros:", ":elephant:"] },
  { word: "hippo", emojis: ["🦛", "🐘"], shortcodes: [":hippopotamus:", ":elephant:"] },
  { word: "giraffe", emojis: ["🦒", "🐪"], shortcodes: [":giraffe:", ":camel:"] },
  { word: "camel", emojis: ["🐪", "🐫"], shortcodes: [":camel:", ":dromedary_camel:"] },
  { word: "deer", emojis: ["🦌", "🐎"], shortcodes: [":deer:", ":racehorse:"] },
  { word: "bee", emojis: ["🐝", "🍯"], shortcodes: [":bee:", ":honey_pot:"] },
  { word: "bug", emojis: ["🐛", "🐞"], shortcodes: [":bug:", ":beetle:"] },
  { word: "butterfly", emojis: ["🦋", "🐛"], shortcodes: [":butterfly:", ":bug:"] },
  { word: "spider", emojis: ["🕷️", "🕸️"], shortcodes: [":spider:", ":spider_web:"] },
  { word: "ant", emojis: ["🐜", "🐛"], shortcodes: [":ant:", ":bug:"] },

  // ---- Food & Drink ----
  { word: "food", emojis: ["🍽️", "🍴"], shortcodes: [":fork_and_knife_with_plate:", ":fork_and_knife:"] },
  { word: "eat", emojis: ["🍽️", "😋"], shortcodes: [":fork_and_knife_with_plate:", ":yum:"] },
  { word: "hungry", emojis: ["😋", "🤤"], shortcodes: [":yum:", ":drooling_face:"] },
  { word: "thirsty", emojis: ["🥤", "💧"], shortcodes: [":cup_with_straw:", ":droplet:"] },
  { word: "pizza", emojis: ["🍕", "🧀"], shortcodes: [":pizza:", ":cheese:"] },
  { word: "burger", emojis: ["🍔", "🍟"], shortcodes: [":hamburger:", ":fries:"] },
  { word: "fries", emojis: ["🍟", "🍔"], shortcodes: [":fries:", ":hamburger:"] },
  { word: "hotdog", emojis: ["🌭", "🍔"], shortcodes: [":hotdog:", ":hamburger:"] },
  { word: "sandwich", emojis: ["🥪", "🍞"], shortcodes: [":sandwich:", ":bread:"] },
  { word: "taco", emojis: ["🌮", "🫓"], shortcodes: [":taco:", ":flatbread:"] },
  { word: "burrito", emojis: ["🌯", "🌮"], shortcodes: [":burrito:", ":taco:"] },
  { word: "sushi", emojis: ["🍣", "🍚"], shortcodes: [":sushi:", ":rice:"] },
  { word: "ramen", emojis: ["🍜", "🍚"], shortcodes: [":ramen:", ":rice:"] },
  { word: "noodle", emojis: ["🍜", "🍝"], shortcodes: [":ramen:", ":spaghetti:"] },
  { word: "pasta", emojis: ["🍝", "🍜"], shortcodes: [":spaghetti:", ":ramen:"] },
  { word: "rice", emojis: ["🍚", "🍙"], shortcodes: [":rice:", ":rice_ball:"] },
  { word: "bread", emojis: ["🍞", "🥖"], shortcodes: [":bread:", ":baguette_bread:"] },
  { word: "cheese", emojis: ["🧀", "🥛"], shortcodes: [":cheese:", ":milk:"] },
  { word: "egg", emojis: ["🥚", "🍳"], shortcodes: [":egg:", ":fried_egg:"] },
  { word: "bacon", emojis: ["🥓", "🍖"], shortcodes: [":bacon:", ":meat_on_bone:"] },
  { word: "meat", emojis: ["🍖", "🥩"], shortcodes: [":meat_on_bone:", ":cut_of_meat:"] },
  { word: "chicken_food", emojis: ["🍗", "🍖"], shortcodes: [":poultry_leg:", ":meat_on_bone:"] },
  { word: "fish_food", emojis: ["🐟", "🍣"], shortcodes: [":fish:", ":sushi:"] },
  { word: "apple", emojis: ["🍎", "🍏"], shortcodes: [":apple:", ":green_apple:"] },
  { word: "banana", emojis: ["🍌", "🐒"], shortcodes: [":banana:", ":monkey:"] },
  { word: "orange", emojis: ["🍊", "🟠"], shortcodes: [":tangerine:", ":large_orange_circle:"] },
  { word: "grape", emojis: ["🍇", "🍷"], shortcodes: [":grapes:", ":wine:"] },
  { word: "strawberry", emojis: ["🍓", "🍒"], shortcodes: [":strawberry:", ":cherries:"] },
  { word: "cherry", emojis: ["🍒", "🍓"], shortcodes: [":cherries:", ":strawberry:"] },
  { word: "watermelon", emojis: ["🍉", "🍓"], shortcodes: [":watermelon:", ":strawberry:"] },
  { word: "pineapple", emojis: ["🍍", "🥥"], shortcodes: [":pineapple:", ":coconut:"] },
  { word: "mango", emojis: ["🥭", "🍑"], shortcodes: [":mango:", ":peach:"] },
  { word: "peach", emojis: ["🍑", "🥭"], shortcodes: [":peach:", ":mango:"] },
  { word: "lemon", emojis: ["🍋", "🟡"], shortcodes: [":lemon:", ":large_yellow_circle:"] },
  { word: "pear", emojis: ["🍐", "🍎"], shortcodes: [":pear:", ":apple:"] },
  { word: "cake", emojis: ["🍰", "🎂"], shortcodes: [":cake:", ":birthday:"] },
  { word: "birthday", emojis: ["🎂", "🎉"], shortcodes: [":birthday:", ":tada:"] },
  { word: "icecream", emojis: ["🍦", "🍨"], shortcodes: [":icecream:", ":ice_cream:"] },
  { word: "cookie", emojis: ["🍪", "🥛"], shortcodes: [":cookie:", ":milk:"] },
  { word: "chocolate", emojis: ["🍫", "🍪"], shortcodes: [":chocolate_bar:", ":cookie:"] },
  { word: "candy", emojis: ["🍬", "🍭"], shortcodes: [":candy:", ":lollipop:"] },
  { word: "donut", emojis: ["🍩", "🥯"], shortcodes: [":doughnut:", ":bagel:"] },
  { word: "coffee", emojis: ["☕", "🥤"], shortcodes: [":coffee:", ":cup_with_straw:"] },
  { word: "tea", emojis: ["🍵", "☕"], shortcodes: [":tea:", ":coffee:"] },
  { word: "water", emojis: ["💧", "💦"], shortcodes: [":droplet:", ":sweat_drops:"] },
  { word: "milk", emojis: ["🥛", "🐄"], shortcodes: [":milk:", ":cow:"] },
  { word: "juice", emojis: ["🧃", "🍹"], shortcodes: [":juice_box:", ":tropical_drink:"] },
  { word: "soda", emojis: ["🥤", "🧃"], shortcodes: [":cup_with_straw:", ":juice_box:"] },
  { word: "beer", emojis: ["🍺", "🍻"], shortcodes: [":beer:", ":beers:"] },
  { word: "wine", emojis: ["🍷", "🍇"], shortcodes: [":wine:", ":grapes:"] },
  { word: "cocktail", emojis: ["🍸", "🍹"], shortcodes: [":cocktail:", ":tropical_drink:"] },
  { word: "champagne", emojis: ["🍾", "🎉"], shortcodes: [":champagne:", ":tada:"] },
  { word: "sugar", emojis: ["🧂", "🍰"], shortcodes: [":salt:", ":cake:"] },
  { word: "salt", emojis: ["🧂", "🌊"], shortcodes: [":salt:", ":ocean:"] },
  { word: "pepper", emojis: ["🌶️", "🧂"], shortcodes: [":hot_pepper:", ":salt:"] },
  { word: "spicy", emojis: ["🌶️", "🔥"], shortcodes: [":hot_pepper:", ":fire:"] },
  { word: "salad", emojis: ["🥗", "🥬"], shortcodes: [":green_salad:", ":leafy_green:"] },
  { word: "soup", emojis: ["🍲", "🥣"], shortcodes: [":stew:", ":bowl_with_spoon:"] },
  { word: "honey", emojis: ["🍯", "🐝"], shortcodes: [":honey_pot:", ":bee:"] },

  // ---- Nature & Weather ----
  { word: "sun", emojis: ["☀️", "🌞"], shortcodes: [":sunny:", ":sun_with_face:"] },
  { word: "moon", emojis: ["🌙", "🌕"], shortcodes: [":crescent_moon:", ":full_moon:"] },
  { word: "star", emojis: ["⭐", "🌟"], shortcodes: [":star:", ":star2:"] },
  { word: "stars", emojis: ["✨", "🌟"], shortcodes: [":sparkles:", ":star2:"] },
  { word: "sky", emojis: ["🌌", "☁️"], shortcodes: [":milky_way:", ":cloud:"] },
  { word: "cloud", emojis: ["☁️", "🌫️"], shortcodes: [":cloud:", ":fog:"] },
  { word: "rain", emojis: ["🌧️", "☔"], shortcodes: [":cloud_with_rain:", ":umbrella_with_rain_drops:"] },
  { word: "rainy", emojis: ["🌧️", "☔"], shortcodes: [":cloud_with_rain:", ":umbrella_with_rain_drops:"] },
  { word: "snow", emojis: ["❄️", "⛄"], shortcodes: [":snowflake:", ":snowman:"] },
  { word: "snowy", emojis: ["❄️", "🌨️"], shortcodes: [":snowflake:", ":cloud_with_snow:"] },
  { word: "storm", emojis: ["⛈️", "⚡"], shortcodes: [":thunder_cloud_rain:", ":zap:"] },
  { word: "thunder", emojis: ["⚡", "⛈️"], shortcodes: [":zap:", ":thunder_cloud_rain:"] },
  { word: "lightning", emojis: ["⚡", "🌩️"], shortcodes: [":zap:", ":cloud_with_lightning:"] },
  { word: "wind", emojis: ["💨", "🌬️"], shortcodes: [":dash:", ":wind_face:"] },
  { word: "tornado", emojis: ["🌪️", "💨"], shortcodes: [":tornado:", ":dash:"] },
  { word: "fog", emojis: ["🌫️", "☁️"], shortcodes: [":fog:", ":cloud:"] },
  { word: "rainbow", emojis: ["🌈", "☔"], shortcodes: [":rainbow:", ":umbrella_with_rain_drops:"] },
  { word: "fire", emojis: ["🔥", "🌋"], shortcodes: [":fire:", ":volcano:"] },
  { word: "smoke", emojis: ["💨", "🚬"], shortcodes: [":dash:", ":smoking:"] },
  { word: "waterfall", emojis: ["💦", "💧"], shortcodes: [":sweat_drops:", ":droplet:"] },
  { word: "ocean", emojis: ["🌊", "🏖️"], shortcodes: [":ocean:", ":beach:"] },
  { word: "sea", emojis: ["🌊", "⛵"], shortcodes: [":ocean:", ":sailboat:"] },
  { word: "wave", emojis: ["🌊", "👋"], shortcodes: [":ocean:", ":wave:"], contexts: { ocean: 0, sea: 0, water: 0, hello: 1, hi: 1, bye: 1 } },
  { word: "river", emojis: ["🏞️", "🌊"], shortcodes: [":national_park:", ":ocean:"] },
  { word: "lake", emojis: ["🏞️", "🌊"], shortcodes: [":national_park:", ":ocean:"] },
  { word: "mountain", emojis: ["⛰️", "🏔️"], shortcodes: [":mountain:", ":mountain_snow:"] },
  { word: "volcano", emojis: ["🌋", "🔥"], shortcodes: [":volcano:", ":fire:"] },
  { word: "forest", emojis: ["🌲", "🌳"], shortcodes: [":evergreen_tree:", ":deciduous_tree:"] },
  { word: "tree", emojis: ["🌳", "🌲"], shortcodes: [":deciduous_tree:", ":evergreen_tree:"] },
  { word: "flower", emojis: ["🌸", "🌷"], shortcodes: [":cherry_blossom:", ":tulip:"] },
  { word: "rose", emojis: ["🌹", "🌷"], shortcodes: [":rose:", ":tulip:"] },
  { word: "grass", emojis: ["🌱", "🌾"], shortcodes: [":seedling:", ":ear_of_rice:"] },
  { word: "leaf", emojis: ["🍃", "🍂"], shortcodes: [":leaves:", ":fallen_leaf:"] },
  { word: "seed", emojis: ["🌱", "🌰"], shortcodes: [":seedling:", ":chestnut:"] },
  { word: "cactus", emojis: ["🌵", "🌿"], shortcodes: [":cactus:", ":herb:"] },
  { word: "palm", emojis: ["🌴", "🌳"], shortcodes: [":palm_tree:", ":deciduous_tree:"] },
  { word: "rock", emojis: ["🪨", "⛰️"], shortcodes: [":rock:", ":mountain:"] },
  { word: "earth", emojis: ["🌍", "🌎"], shortcodes: [":earth_africa:", ":earth_americas:"] },
  { word: "world", emojis: ["🌍", "🗺️"], shortcodes: [":earth_africa:", ":world_map:"] },

  // ---- Places ----
  { word: "house", emojis: ["🏠", "🏡"], shortcodes: [":house:", ":house_with_garden:"] },
  { word: "home", emojis: ["🏡", "🏠"], shortcodes: [":house_with_garden:", ":house:"] },
  { word: "building", emojis: ["🏢", "🏗️"], shortcodes: [":office:", ":building_construction:"] },
  { word: "office", emojis: ["🏢", "💼"], shortcodes: [":office:", ":briefcase:"] },
  { word: "school", emojis: ["🏫", "📚"], shortcodes: [":school:", ":books:"] },
  { word: "hospital", emojis: ["🏥", "⚕️"], shortcodes: [":hospital:", ":medical_symbol:"] },
  { word: "bank", emojis: ["🏦", "🌊"], shortcodes: [":bank:", ":ocean:"], contexts: { money: 0, cash: 0, dollar: 0, deposit: 0, river: 1, water: 1, fishing: 1 } },
  { word: "church", emojis: ["church", "⛪"], shortcodes: [":church:", ":church:"] },
  { word: "store", emojis: ["🏪", "🛒"], shortcodes: [":convenience_store:", ":shopping_cart:"] },
  { word: "shop", emojis: ["🛍️", "🏪"], shortcodes: [":shopping_bags:", ":convenience_store:"] },
  { word: "mall", emojis: ["🏬", "🛍️"], shortcodes: [":department_store:", ":shopping_bags:"] },
  { word: "restaurant", emojis: ["🍴", "🍽️"], shortcodes: [":fork_and_knife:", ":fork_and_knife_with_plate:"] },
  { word: "cafe", emojis: ["☕", "🍰"], shortcodes: [":coffee:", ":cake:"] },
  { word: "bar", emojis: ["酒吧", "🍷"], shortcodes: [":bar_chart:", ":wine:"] },
  { word: "hotel", emojis: ["🏨", "🛏️"], shortcodes: [":hotel:", ":bed:"] },
  { word: "beach", emojis: ["🏖️", "🌊"], shortcodes: [":beach:", ":ocean:"] },
  { word: "park", emojis: ["🏞️", "🌳"], shortcodes: [":national_park:", ":deciduous_tree:"] },
  { word: "city", emojis: ["🏙️", "🌆"], shortcodes: [":cityscape:", ":city_sunrise:"] },
  { word: "farm", emojis: ["🚜", "🌾"], shortcodes: [":tractor:", ":ear_of_rice:"] },
  { word: "castle", emojis: ["🏰", "👑"], shortcodes: [":european_castle:", ":crown:"] },
  { word: "church_building", emojis: ["⛪", "🏰"], shortcodes: [":church:", ":european_castle:"] },
  { word: "stadium", emojis: ["🏟️", "⚽"], shortcodes: [":stadium:", ":soccer:"] },
  { word: "airport", emojis: ["🛫", "✈️"], shortcodes: [":flight_departure:", ":airplane:"] },
  { word: "station", emojis: ["🚉", "🚆"], shortcodes: [":station:", ":train:"] },
  { word: "road", emojis: ["🛣️", "🚗"], shortcodes: [":motorway:", ":car:"] },
  { word: "street", emojis: ["🛣️", "🚶"], shortcodes: [":motorway:", ":walking:"] },
  { word: "bridge", emojis: ["🌉", " Rivr"], shortcodes: [":bridge_at_night:", ":rice:"] },
  { word: "map", emojis: ["🗺️", "📍"], shortcodes: [":world_map:", ":round_pushpin:"] },

  // ---- Travel & Vehicles ----
  { word: "car", emojis: ["🚗", "🚙"], shortcodes: [":car:", ":blue_car:"] },
  { word: "truck", emojis: ["🚚", "🚛"], shortcodes: [":truck:", ":articulated_lorry:"] },
  { word: "bus", emojis: ["🚌", "🚍"], shortcodes: [":bus:", ":oncoming_bus:"] },
  { word: "taxi", emojis: ["🚕", "🚖"], shortcodes: [":taxi:", ":oncoming_taxi:"] },
  { word: "train", emojis: ["🚆", "🚄"], shortcodes: [":train:", ":bullettrain_side:"] },
  { word: "subway", emojis: ["🚇", "🚊"], shortcodes: [":metro:", ":tram:"] },
  { word: "plane", emojis: ["✈️", "🛫"], shortcodes: [":airplane:", ":flight_departure:"] },
  { word: "airplane", emojis: ["✈️", "🛩️"], shortcodes: [":airplane:", ":small_airplane:"] },
  { word: "ship", emojis: ["🚢", "⛵"], shortcodes: [":ship:", ":sailboat:"] },
  { word: "boat", emojis: ["⛵", "🚤"], shortcodes: [":sailboat:", ":speedboat:"] },
  { word: "bicycle", emojis: ["🚲", "🚴"], shortcodes: [":bicycle:", ":bicyclist:"] },
  { word: "bike", emojis: ["🚲", "🏍️"], shortcodes: [":bicycle:", ":motorcycle:"] },
  { word: "motorcycle", emojis: ["🏍️", "🛵"], shortcodes: [":motorcycle:", ":motor_scooter:"] },
  { word: "scooter", emojis: ["🛴", "🛵"], shortcodes: [":scooter:", ":motor_scooter:"] },
  { word: "rocket", emojis: ["🚀", "🛸"], shortcodes: [":rocket:", ":flying_saucer:"] },
  { word: "helicopter", emojis: ["🚁", "🚟"], shortcodes: [":helicopter:", ":aerial_tramway:"] },
  { word: "travel", emojis: ["✈️", "🧳"], shortcodes: [":airplane:", ":luggage:"] },
  { word: "vacation", emojis: ["🏖️", "🧳"], shortcodes: [":beach:", ":luggage:"] },
  { word: "luggage", emojis: ["🧳", "🎒"], shortcodes: [":luggage:", ":school_satchel:"] },
  { word: "ticket", emojis: ["🎟️", "🎫"], shortcodes: [":admission_tickets:", ":ticket:"] },
  { word: "passport", emojis: ["🛂", "📒"], shortcodes: [":passport_control:", ":ledger:"] },

  // ---- Activities ----
  { word: "work", emojis: ["💼", "🖥️"], shortcodes: [":briefcase:", ":desktop_computer:"] },
  { word: "job", emojis: ["💼", "👷"], shortcodes: [":briefcase:", ":construction_worker:"] },
  { word: "money", emojis: ["💰", "💵"], shortcodes: [":moneybag:", ":dollar:"] },
  { word: "cash", emojis: ["💵", "💰"], shortcodes: [":dollar:", ":moneybag:"] },
  { word: "dollar", emojis: ["💵", "💲"], shortcodes: [":dollar:", ":heavy_dollar_sign:"] },
  { word: "coin", emojis: ["🪙", "💰"], shortcodes: [":coin:", ":moneybag:"] },
  { word: "credit", emojis: ["💳", "💰"], shortcodes: [":credit_card:", ":moneybag:"] },
  { word: "bank_money", emojis: ["🏦", "💰"], shortcodes: [":bank:", ":moneybag:"] },
  { word: "phone", emojis: ["📱", "☎️"], shortcodes: [":iphone:", ":phone:"] },
  { word: "computer", emojis: ["💻", "🖥️"], shortcodes: [":laptop:", ":desktop_computer:"] },
  { word: "laptop", emojis: ["💻", "🖥️"], shortcodes: [":laptop:", ":desktop_computer:"] },
  { word: "code", emojis: ["💻", "⌨️"], shortcodes: [":laptop:", ":keyboard:"] },
  { word: "coding", emojis: ["👨‍💻", "💻"], shortcodes: [":man_technologist:", ":laptop:"] },
  { word: "game", emojis: ["🎮", "🕹️"], shortcodes: [":video_game:", ":joystick:"] },
  { word: "gaming", emojis: ["🎮", "👾"], shortcodes: [":video_game:", ":space_invader:"] },
  { word: "book", emojis: ["📚", "📖"], shortcodes: [":books:", ":open_book:"] },
  { word: "read", emojis: ["📖", "📚"], shortcodes: [":open_book:", ":books:"] },
  { word: "study", emojis: ["📚", "✏️"], shortcodes: [":books:", ":pencil:"] },
  { word: "write", emojis: ["✍️", "📝"], shortcodes: [":writing_hand:", ":memo:"] },
  { word: "music", emojis: ["🎵", "🎶"], shortcodes: [":musical_note:", ":notes:"] },
  { word: "song", emojis: ["🎵", "🎤"], shortcodes: [":musical_note:", ":microphone:"] },
  { word: "sing", emojis: ["🎤", "🎵"], shortcodes: [":microphone:", ":musical_note:"] },
  { word: "dance", emojis: ["💃", "🕺"], shortcodes: [":dancer:", ":man_dancing:"] },
  { word: "movie", emojis: ["🎬", "🍿"], shortcodes: [":clapper:", ":popcorn:"] },
  { word: "film", emojis: ["🎞️", "🎬"], shortcodes: [":film_frames:", ":clapper:"] },
  { word: "photo", emojis: ["📷", "📸"], shortcodes: [":camera:", ":camera_with_flash:"] },
  { word: "camera", emojis: ["📷", "📸"], shortcodes: [":camera:", ":camera_with_flash:"] },
  { word: "art", emojis: ["🎨", "🖼️"], shortcodes: [":art:", ":framed_picture:"] },
  { word: "paint", emojis: ["🖌️", "🎨"], shortcodes: [":paintbrush:", ":art:"] },
  { word: "draw", emojis: ["✏️", "🎨"], shortcodes: [":pencil:", ":art:"] },
  { word: "sport", emojis: ["⚽", "🏀"], shortcodes: [":soccer:", ":basketball:"] },
  { word: "soccer", emojis: ["⚽", "🥅"], shortcodes: [":soccer:", ":goal:"] },
  { word: "basketball", emojis: ["🏀", "⛹️"], shortcodes: [":basketball:", ":person_with_ball:"] },
  { word: "football", emojis: ["🏈", "⚽"], shortcodes: [":football:", ":soccer:"] },
  { word: "tennis", emojis: ["🎾", "🏸"], shortcodes: [":tennis:", ":badminton:"] },
  { word: "baseball", emojis: ["⚾", "🏏"], shortcodes: [":baseball:", ":cricket_bat_ball:"] },
  { word: "run", emojis: ["🏃", "🏃‍♂️"], shortcodes: [":runner:", ":running_man:"] },
  { word: "walk", emojis: ["🚶", "🚶‍♂️"], shortcodes: [":walking:", ":walking_man:"] },
  { word: "swim", emojis: ["🏊", "🏊‍♂️"], shortcodes: [":swimmer:", ":swimming_man:"] },
  { word: "gym", emojis: ["🏋️", "💪"], shortcodes: [":weight_lifter:", ":muscle:"] },
  { word: "yoga", emojis: ["🧘", "🙏"], shortcodes: [":person_in_lotus_position:", ":pray:"] },
  { word: "party", emojis: ["🎉", "🥳"], shortcodes: [":tada:", ":partying_face:"] },
  { word: "sleep", emojis: ["😴", "💤"], shortcodes: [":sleeping:", ":zzz:"] },
  { word: "dream", emojis: ["💭", "😴"], shortcodes: [":thought_balloon:", ":sleeping:"] },
  { word: "cook", emojis: ["🍳", "👨‍🍳"], shortcodes: [":fried_egg:", ":man_cook:"] },
  { word: "bake", emojis: ["🍞", "🥧"], shortcodes: [":bread:", ":pie:"] },
  { word: "garden", emojis: ["🪴", "🌱"], shortcodes: [":potted_plant:", ":seedling:"] },
  { word: "fish_activity", emojis: ["🎣", "🐟"], shortcodes: [":fishing_pole_and_fish:", ":fish:"] },
  { word: "camp", emojis: ["🏕️", "⛺"], shortcodes: [":camping:", ":tent:"] },
  { word: "hike", emojis: ["🥾", "⛰️"], shortcodes: [":hiking_boot:", ":mountain:"] },
  { word: "shop_activity", emojis: ["🛍️", "💳"], shortcodes: [":shopping_bags:", ":credit_card:"] },

  // ---- Time ----
  { word: "time", emojis: ["⏰", "⏱️"], shortcodes: [":alarm_clock:", ":stopwatch:"] },
  { word: "clock", emojis: ["🕐", "⏰"], shortcodes: [":clock1:", ":alarm_clock:"] },
  { word: "hour", emojis: ["⏰", "🕐"], shortcodes: [":alarm_clock:", ":clock1:"] },
  { word: "minute", emojis: ["⏱️", "🕐"], shortcodes: [":stopwatch:", ":clock1:"] },
  { word: "day", emojis: ["☀️", "📅"], shortcodes: [":sunny:", ":date:"] },
  { word: "night", emojis: ["🌙", "🌃"], shortcodes: [":crescent_moon:", ":night_with_stars:"] },
  { word: "morning", emojis: ["🌅", "☀️"], shortcodes: [":sunrise:", ":sunny:"] },
  { word: "evening", emojis: ["🌆", "🌙"], shortcodes: [":city_sunrise:", ":crescent_moon:"] },
  { word: "noon", emojis: ["🌞", "☀️"], shortcodes: [":sun_with_face:", ":sunny:"] },
  { word: "week", emojis: ["📅", "🗓️"], shortcodes: [":date:", ":calendar:"] },
  { word: "month", emojis: ["📅", "🗓️"], shortcodes: [":date:", ":calendar:"] },
  { word: "year", emojis: ["📅", "🎆"], shortcodes: [":date:", ":sparkler:"] },
  { word: "today", emojis: ["📅", "🔆"], shortcodes: [":date:", ":low_brightness:"] },
  { word: "tomorrow", emojis: ["⏭️", "📅"], shortcodes: [":fast_forward:", ":date:"] },
  { word: "yesterday", emojis: ["⏮️", "📅"], shortcodes: [":fast_reverse:", ":date:"] },
  { word: "future", emojis: ["🚀", "🔮"], shortcodes: [":rocket:", ":crystal_ball:"] },
  { word: "past", emojis: ["⏪", "📜"], shortcodes: [":rewind:", ":scroll:"] },
  { word: "now", emojis: ["⏳", "👉"], shortcodes: [":hourglass:", ":point_right:"] },

  // ---- Objects & Things ----
  { word: "key", emojis: ["🔑", "🗝️"], shortcodes: [":key:", ":old_key:"] },
  { word: "lock", emojis: ["🔒", "🔐"], shortcodes: [":lock:", ":closed_lock_with_key:"] },
  { word: "unlock", emojis: ["🔓", "🔑"], shortcodes: [":unlock:", ":key:"] },
  { word: "door", emojis: ["🚪", "🏠"], shortcodes: [":door:", ":house:"] },
  { word: "window", emojis: ["🪟", "🏠"], shortcodes: [":window:", ":house:"] },
  { word: "table", emojis: ["🪑", "🍽️"], shortcodes: [":chair:", ":fork_and_knife_with_plate:"] },
  { word: "chair", emojis: ["🪑", "🛋️"], shortcodes: [":chair:", ":couch_and_lamp:"] },
  { word: "bed", emojis: ["🛏️", "😴"], shortcodes: [":bed:", ":sleeping:"] },
  { word: "lamp", emojis: ["💡", "🛋️"], shortcodes: [":bulb:", ":couch_and_lamp:"] },
  { word: "light", emojis: ["💡", "🔆"], shortcodes: [":bulb:", ":low_brightness:"] },
  { word: "bulb", emojis: ["💡", "🪔"], shortcodes: [":bulb:", ":diya_lamp:"] },
  { word: "battery", emojis: ["🔋", "⚡"], shortcodes: [":battery:", ":zap:"] },
  { word: "plug", emojis: ["🔌", "🪫"], shortcodes: [":electric_plug:", ":low_battery:"] },
  { word: "tool", emojis: ["🛠️", "🔧"], shortcodes: [":hammer_and_pick:", ":wrench:"] },
  { word: "hammer", emojis: ["🔨", "🛠️"], shortcodes: [":hammer:", ":hammer_and_pick:"] },
  { word: "wrench", emojis: ["🔧", "🛠️"], shortcodes: [":wrench:", ":hammer_and_pick:"] },
  { word: "knife", emojis: ["🔪", "🗡️"], shortcodes: [":knife:", ":dagger:"] },
  { word: "scissors", emojis: ["✂️", "✂"], shortcodes: [":scissors:", ":scissors:"] },
  { word: "book_object", emojis: ["📖", "📚"], shortcodes: [":open_book:", ":books:"] },
  { word: "newspaper", emojis: ["📰", "🗞️"], shortcodes: [":newspaper:", ":rolled_up_newspaper:"] },
  { word: "letter", emojis: ["✉️", "💌"], shortcodes: [":envelope:", ":love_letter:"] },
  { word: "mail", emojis: ["📬", "✉️"], shortcodes: [":mailbox_with_mail:", ":envelope:"] },
  { word: "email", emojis: ["📧", "✉️"], shortcodes: [":e-mail:", ":envelope:"] },
  { word: "message", emojis: ["💬", "📨"], shortcodes: [":speech_balloon:", ":incoming_envelope:"] },
  { word: "chat", emojis: ["💬", "🗨️"], shortcodes: [":speech_balloon:", ":left_speech_bubble:"] },
  { word: "gift", emojis: ["🎁", "🎀"], shortcodes: [":gift:", ":ribbon:"] },
  { word: "present", emojis: ["🎁", "🎉"], shortcodes: [":gift:", ":tada:"] },
  { word: "candle", emojis: ["🕯️", "🔥"], shortcodes: [":candle:", ":fire:"] },
  { word: "balloon", emojis: ["🎈", "🎉"], shortcodes: [":balloon:", ":tada:"] },
  { word: "flag", emojis: ["🚩", "🏁"], shortcodes: [":triangular_flag_on_post:", ":checkered_flag:"] },
  { word: "trophy", emojis: ["🏆", "🥇"], shortcodes: [":trophy:", ":first_place:"] },
  { word: "medal", emojis: ["🥇", "🎖️"], shortcodes: [":first_place:", ":military_medal:"] },
  { word: "crown", emojis: ["👑", "👸"], shortcodes: [":crown:", ":princess:"] },
  { word: "ring", emojis: ["💍", ".Circle"], shortcodes: [":ring:", ":large_blue_circle:"] },
  { word: "diamond", emojis: ["💎", "💍"], shortcodes: [":gem:", ":ring:"] },
  { word: "gem", emojis: ["💎", "✨"], shortcodes: [":gem:", ":sparkles:"] },
  { word: "watch", emojis: ["⌚", "👀"], shortcodes: [":watch:", ":eyes:"] },
  { word: "glasses", emojis: ["👓", "🕶️"], shortcodes: [":eyeglasses:", ":dark_sunglasses:"] },
  { word: "shirt", emojis: ["👕", "👚"], shortcodes: [":shirt:", ":womans_clothes:"] },
  { word: "pants", emojis: ["👖", "👕"], shortcodes: [":jeans:", ":shirt:"] },
  { word: "shoes", emojis: ["👟", "👞"], shortcodes: [":athletic_shoe:", ":mans_shoe:"] },
  { word: "hat", emojis: ["🎩", "🧢"], shortcodes: [":top_hat:", ":billed_cap:"] },
  { word: "umbrella", emojis: ["☂️", "☔"], shortcodes: [":umbrella:", ":umbrella_with_rain_drops:"] },

  // ---- Symbols ----
  { word: "warning", emojis: ["⚠️", "🚨"], shortcodes: [":warning:", ":rotating_light:"] },
  { word: "danger", emojis: ["💀", "⚠️"], shortcodes: [":skull:", ":warning:"] },
  { word: "stop", emojis: ["🛑", "✋"], shortcodes: [":octagonal_sign:", ":raised_hand:"] },
  { word: "go", emojis: ["🚦", "▶️"], shortcodes: [":traffic_light:", ":arrow_forward:"] },
  { word: "check", emojis: ["✅", "✔️"], shortcodes: [":white_check_mark:", ":heavy_check_mark:"] },
  { word: "done", emojis: ["✅", "🎉"], shortcodes: [":white_check_mark:", ":tada:"] },
  { word: "fail", emojis: ["❌", "💀"], shortcodes: [":x:", ":skull:"] },
  { word: "idea", emojis: ["💡", "💭"], shortcodes: [":bulb:", ":thought_balloon:"] },
  { word: "tip", emojis: ["💡", "📌"], shortcodes: [":bulb:", ":pushpin:"] },
  { word: "important", emojis: ["❗", "📌"], shortcodes: [":exclamation:", ":pushpin:"] },
  { word: "question", emojis: ["❓", "🤔"], shortcodes: [":question:", ":thinking:"] },
  { word: "exclamation", emojis: ["❗", "❕"], shortcodes: [":exclamation:", ":grey_exclamation:"] },
  { word: "star_symbol", emojis: ["⭐", "🌟"], shortcodes: [":star:", ":star2:"] },
  { word: "plus", emojis: ["➕", "✚"], shortcodes: [":heavy_plus_sign:", ":cross:"] },
  { word: "minus", emojis: ["➖", "—"], shortcodes: [":heavy_minus_sign:", ":heavy_minus_sign:"] },
  { word: "equals", emojis: ["🟰", "⚖️"], shortcodes: [":heavy_equals_sign:", ":balance_scale:"] },
  { word: "infinity", emojis: ["♾️", "↩️"], shortcodes: [":infinity:", ":leftwards_arrow_with_hook:"] },
  { word: "heart_symbol", emojis: ["❤️", "💕"], shortcodes: [":heart:", ":two_hearts:"] },
  { word: "broken", emojis: ["💔", "🥀"], shortcodes: [":broken_heart:", ":wilted_rose:"] },

  // ---- Common verbs / actions ----
  { word: "go_verb", emojis: ["🚶", "▶️"], shortcodes: [":walking:", ":arrow_forward:"] },
  { word: "come", emojis: ["🫵", "👋"], shortcodes: [":pointing_at_self:", ":wave:"] },
  { word: "see", emojis: ["👀", "👁️"], shortcodes: [":eyes:", ":eye:"] },
  { word: "hear", emojis: ["👂", "🔊"], shortcodes: [":ear:", ":loud_sound:"] },
  { word: "talk", emojis: ["🗣️", "💬"], shortcodes: [":speaking_head:", ":speech_balloon:"] },
  { word: "say", emojis: ["💬", "🗣️"], shortcodes: [":speech_balloon:", ":speaking_head:"] },
  { word: "do", emojis: ["✅", "💪"], shortcodes: [":white_check_mark:", ":muscle:"] },
  { word: "make", emojis: ["🔨", "✨"], shortcodes: [":hammer:", ":sparkles:"] },
  { word: "give", emojis: ["🎁", "🤲"], shortcodes: [":gift:", ":palms_up_together:"] },
  { word: "take", emojis: ["✋", "📥"], shortcodes: [":raised_hand:", ":inbox_tray:"] },
  { word: "want", emojis: ["🤲", "💭"], shortcodes: [":palms_up_together:", ":thought_balloon:"] },
  { word: "need", emojis: ["❗", "🤲"], shortcodes: [":exclamation:", ":palms_up_together:"] },
  { word: "help", emojis: ["🆘", "🤝"], shortcodes: [":sos:", ":handshake:"] },
  { word: "wait", emojis: ["⏳", "⌛"], shortcodes: [":hourglass:", ":hourglass_flowing_sand:"] },
  { word: "stop_verb", emojis: ["🛑", "✋"], shortcodes: [":octagonal_sign:", ":raised_hand:"] },
  { word: "start", emojis: ["▶️", "🚀"], shortcodes: [":arrow_forward:", ":rocket:"] },
  { word: "end", emojis: ["🏁", "⏹️"], shortcodes: [":checkered_flag:", ":stop_button:"] },
  { word: "win", emojis: ["🏆", "🥇"], shortcodes: [":trophy:", ":first_place:"] },
  { word: "lose", emojis: ["😭", "📉"], shortcodes: [":sob:", ":chart_decreasing:"] },
  { word: "play", emojis: ["▶️", "🎮"], shortcodes: [":arrow_forward:", ":video_game:"] },
  { word: "buy", emojis: ["💳", "🛒"], shortcodes: [":credit_card:", ":shopping_cart:"] },
  { word: "sell", emojis: ["🏷️", "💰"], shortcodes: [":label:", ":moneybag:"] },
  { word: "pay", emojis: ["💸", "💳"], shortcodes: [":money_with_wings:", ":credit_card:"] },
  { word: "save", emojis: ["💰", "💾"], shortcodes: [":moneybag:", ":floppy_disk:"] },
  { word: "build", emojis: ["🏗️", "🔨"], shortcodes: [":building_construction:", ":hammer:"] },
  { word: "fix", emojis: ["🔧", "🛠️"], shortcodes: [":wrench:", ":hammer_and_pick:"] },
  { word: "break", emojis: ["💔", "🔨"], shortcodes: [":broken_heart:", ":hammer:"] },
  { word: "open", emojis: ["📂", "🔓"], shortcodes: [":open_file_folder:", ":unlock:"] },
  { word: "close", emojis: ["🔒", "❌"], shortcodes: [":lock:", ":x:"] },
  { word: "push", emojis: ["🫸", "👉"], shortcodes: [":pushpin:", ":point_right:"] },
  { word: "pull", emojis: ["🫷", "👈"], shortcodes: [":pushpin:", ":point_left:"] },
  { word: "lift", emojis: ["🏋️", "⬆️"], shortcodes: [":weight_lifter:", ":arrow_up:"] },
  { word: "drop", emojis: ["⬇️", "💧"], shortcodes: [":arrow_down:", ":droplet:"] },

  // ---- Misc common words ----
  { word: "fast", emojis: ["💨", "⚡"], shortcodes: [":dash:", ":zap:"] },
  { word: "slow", emojis: ["🐌", "🐢"], shortcodes: [":snail:", ":turtle:"] },
  { word: "big", emojis: ["🐘", "🔍"], shortcodes: [":elephant:", ":mag:"] },
  { word: "small", emojis: ["🐜", "🔍"], shortcodes: [":ant:", ":mag:"] },
  { word: "new", emojis: ["🆕", "✨"], shortcodes: [":new:", ":sparkles:"] },
  { word: "old", emojis: ["👵", "📜"], shortcodes: [":older_woman:", ":scroll:"] },
  { word: "young", emojis: ["👶", "🧒"], shortcodes: [":baby:", ":child:"] },
  { word: "rich", emojis: ["💰", "🤑"], shortcodes: [":moneybag:", ":money_mouth_face:"] },
  { word: "poor", emojis: ["😢", "🪙"], shortcodes: [":cry:", ":coin:"] },
  { word: "smart", emojis: ["🧠", "🤓"], shortcodes: [":brain:", ":nerd_face:"] },
  { word: "stupid", emojis: ["🤦", "😑"], shortcodes: [":facepalm:", ":expressionless:"] },
  { word: "strong", emojis: ["💪", "🏋️"], shortcodes: [":muscle:", ":weight_lifter:"] },
  { word: "weak", emojis: ["🥵", "🪫"], shortcodes: [":hot_face:", ":low_battery:"] },
  { word: "beautiful", emojis: ["😍", "🌹"], shortcodes: [":heart_eyes:", ":rose:"] },
  { word: "ugly", emojis: ["🤢", "👿"], shortcodes: [":nauseated_face:", ":imp:"] },
  { word: "easy", emojis: ["✅", "😌"], shortcodes: [":white_check_mark:", ":relieved:"] },
  { word: "hard", emojis: ["💀", "💪"], shortcodes: [":skull:", ":muscle:"] },
  { word: "true", emojis: ["✅", "💯"], shortcodes: [":white_check_mark:", ":hundred_points:"] },
  { word: "false", emojis: ["❌", "🤥"], shortcodes: [":x:", ":lying_face:"] },
  { word: "real", emojis: ["💎", "💯"], shortcodes: [":gem:", ":hundred_points:"] },
  { word: "fake", emojis: ["🎭", "🤥"], shortcodes: [":performing_arts:", ":lying_face:"] },
  { word: "free", emojis: ["🆓", "🎁"], shortcodes: [":free:", ":gift:"] },
  { word: "expensive", emojis: ["💸", "💰"], shortcodes: [":money_with_wings:", ":moneybag:"] },
  { word: "cheap", emojis: ["🪙", "🏷️"], shortcodes: [":coin:", ":label:"] },
  { word: "safe", emojis: ["🔒", "🛡️"], shortcodes: [":lock:", ":shield:"] },
  { word: "dangerous", emojis: ["⚠️", "💀"], shortcodes: [":warning:", ":skull:"] },
  { word: "clean", emojis: ["🧼", "✨"], shortcodes: [":soap:", ":sparkles:"] },
  { word: "dirty", emojis: ["💩", "🧹"], shortcodes: [":poop:", ":broom:"] },
  { word: "loud", emojis: ["🔊", "📣"], shortcodes: [":loud_sound:", ":mega:"] },
  { word: "quiet", emojis: ["🤫", "🔇"], shortcodes: [":shushing_face:", ":mute:"] },
  { word: "bright", emojis: ["✨", "🔆"], shortcodes: [":sparkles:", ":low_brightness:"] },
  { word: "dark", emojis: ["🌑", "🌃"], shortcodes: [":new_moon:", ":night_with_stars:"] },
  { word: "light_color", emojis: ["⚪", "🔆"], shortcodes: [":white_circle:", ":low_brightness:"] },
  { word: "color", emojis: ["🎨", "🌈"], shortcodes: [":art:", ":rainbow:"] },
  { word: "red", emojis: ["🔴", "❤️"], shortcodes: [":red_circle:", ":heart:"] },
  { word: "blue", emojis: ["🔵", "🟦"], shortcodes: [":large_blue_circle:", ":large_blue_square:"] },
  { word: "green", emojis: ["🟢", "🌿"], shortcodes: [":green_circle:", ":herb:"] },
  { word: "yellow", emojis: ["🟡", "⭐"], shortcodes: [":large_yellow_circle:", ":star:"] },
  { word: "orange_color", emojis: ["🟠", "🍊"], shortcodes: [":large_orange_circle:", ":tangerine:"] },
  { word: "purple", emojis: ["🟣", "🍇"], shortcodes: [":large_purple_circle:", ":grapes:"] },
  { word: "black", emojis: ["⚫", "🖤"], shortcodes: [":black_circle:", ":black_heart:"] },
  { word: "white", emojis: ["⚪", "🤍"], shortcodes: [":white_circle:", ":white_heart:"] },
  { word: "pink", emojis: ["💗", "🌸"], shortcodes: [":heart_decoration:", ":cherry_blossom:"] },
  { word: "brown", emojis: ["🟤", "🐻"], shortcodes: [":large_brown_circle:", ":bear:"] },
  { word: "grey", emojis: ["⚙️", "🐘"], shortcodes: [":gear:", ":elephant:"] },
  { word: "gray", emojis: ["⚙️", "🐘"], shortcodes: [":gear:", ":elephant:"] },

  // ---- Social / Communication ----
  { word: "hello", emojis: ["👋", "🙂"], shortcodes: [":wave:", ":slight_smile:"] },
  { word: "hi", emojis: ["👋", "🤙"], shortcodes: [":wave:", ":call_me_hand:"] },
  { word: "hey", emojis: ["👋", "🙋"], shortcodes: [":wave:", ":raising_hand:"] },
  { word: "bye", emojis: ["👋", "🚪"], shortcodes: [":wave:", ":door:"] },
  { word: "goodbye", emojis: ["👋", "🫡"], shortcodes: [":wave:", ":saluting_face:"] },
  { word: "thanks", emojis: ["🙏", "💛"], shortcodes: [":pray:", ":yellow_heart:"] },
  { word: "thank", emojis: ["🙏", "💛"], shortcodes: [":pray:", ":yellow_heart:"] },
  { word: "please", emojis: ["🥺", "🙏"], shortcodes: [":pleading_face:", ":pray:"] },
  { word: "sorry", emojis: ["😔", "🙏"], shortcodes: [":pensive:", ":pray:"] },
  { word: "welcome", emojis: ["👋", "🤗"], shortcodes: [":wave:", ":hugging_face:"] },
  { word: "congrats", emojis: ["🎉", "👏"], shortcodes: [":tada:", ":clap:"] },
  { word: "congratulations", emojis: ["🎉", "🏆"], shortcodes: [":tada:", ":trophy:"] },
  { word: "good_luck", emojis: ["🍀", "🎲"], shortcodes: [":four_leaf_clover:", ":game_die:"] },
  { word: "peace", emojis: ["☮️", "🕊️"], shortcodes: [":peace_symbol:", ":dove:"] },
  { word: "vote", emojis: ["🗳️", "☑️"], shortcodes: [":ballot_box_with_ballot:", ":ballot_box_with_check:"] },

  // ---- Tech ----
  { word: "internet", emojis: ["🌐", "📡"], shortcodes: [":globe_with_meridians:", ":satellite:"] },
  { word: "wifi", emojis: ["📶", "📡"], shortcodes: [":signal_strength:", ":satellite:"] },
  { word: "email_tech", emojis: ["📧", "📨"], shortcodes: [":e-mail:", ":incoming_envelope:"] },
  { word: "website", emojis: ["🌐", "🖥️"], shortcodes: [":globe_with_meridians:", ":desktop_computer:"] },
  { word: "app", emojis: ["📱", "📲"], shortcodes: [":iphone:", ":calling:"] },
  { word: "data", emojis: ["💾", "📊"], shortcodes: [":floppy_disk:", ":bar_chart:"] },
  { word: "server", emojis: ["🖥️", "🖧"], shortcodes: [":desktop_computer:", ":desktop_computer:"] },
  { word: "database", emojis: ["🗄️", "💾"], shortcodes: [":file_cabinet:", ":floppy_disk:"] },
  { word: "bug_tech", emojis: ["🐛", "🐞"], shortcodes: [":bug:", ":beetle:"] },
  { word: "security", emojis: ["🔒", "🛡️"], shortcodes: [":lock:", ":shield:"] },
  { word: "password", emojis: ["🔑", "🔒"], shortcodes: [":key:", ":lock:"] },
  { word: "update", emojis: ["🔄", "⬆️"], shortcodes: [":arrows_counterclockwise:", ":arrow_up:"] },
  { word: "download", emojis: ["⬇️", "📥"], shortcodes: [":arrow_down:", ":inbox_tray:"] },
  { word: "upload", emojis: ["⬆️", "📤"], shortcodes: [":arrow_up:", ":outbox_tray:"] },
  { word: "power", emojis: ["🔋", "⚡"], shortcodes: [":battery:", ":zap:"] },

  // ---- Misc / activities ----
  { word: "magic", emojis: ["✨", "🪄"], shortcodes: [":sparkles:", ":magic_wand:"] },
  { word: "wizard", emojis: ["🧙", "🪄"], shortcodes: [":mage:", ":magic_wand:"] },
  { word: "robot", emojis: ["🤖", "⚙️"], shortcodes: [":robot:", ":gear:"] },
  { word: "alien", emojis: ["👽", "🛸"], shortcodes: [":alien:", ":flying_saucer:"] },
  { word: "ghost", emojis: ["👻", "💨"], shortcodes: [":ghost:", ":dash:"] },
  { word: "zombie", emojis: ["🧟", "💀"], shortcodes: [":zombie:", ":skull:"] },
  { word: "vampire", emojis: ["🧛", "🦇"], shortcodes: [":vampire:", ":bat:"] },
  { word: "witch", emojis: ["🧙‍♀️", "🪄"], shortcodes: [":woman_mage:", ":magic_wand:"] },
  { word: "dragon", emojis: ["🐉", "🐲"], shortcodes: [":dragon:", ":dragon_face:"] },
  { word: "king", emojis: ["🤴", "👑"], shortcodes: [":prince:", ":crown:"] },
  { word: "queen", emojis: ["👸", "👑"], shortcodes: [":princess:", ":crown:"] },
  { word: "doctor", emojis: ["🩺", "👨‍⚕️"], shortcodes: [":stethoscope:", ":man_health_worker:"] },
  { word: "teacher", emojis: ["👩‍🏫", "📚"], shortcodes: [":woman_teacher:", ":books:"] },
  { word: "student", emojis: ["🧑‍🎓", "🎓"], shortcodes: [":student:", ":graduation_cap:"] },
  { word: "police", emojis: ["👮", "🚓"], shortcodes: [":cop:", ":police_car:"] },
  { word: "firefighter", emojis: ["👨‍🚒", "🔥"], shortcodes: [":man_firefighter:", ":fire:"] },
  { word: "scientist", emojis: ["🧑‍🔬", "🔬"], shortcodes: [":scientist:", ":microscope:"] },
  { word: "artist", emojis: ["🧑‍🎨", "🎨"], shortcodes: [":artist:", ":art:"] },
  { word: "chef", emojis: ["👨‍🍳", "🍳"], shortcodes: [":man_cook:", ":fried_egg:"] },
  { word: "farmer", emojis: ["👨‍🌾", "🚜"], shortcodes: [":man_farmer:", ":tractor:"] },
  { word: "musician", emojis: ["🎸", "🎤"], shortcodes: [":guitar:", ":microphone:"] },
  { word: "ninja", emojis: ["🥷", "🗡️"], shortcodes: [":ninja:", ":dagger:"] },
  { word: "pirate", emojis: ["🏴‍☠️", "🗡️"], shortcodes: [":pirate_flag:", ":dagger:"] },
  { word: "superhero", emojis: ["🦸", "💥"], shortcodes: [":superhero:", ":collision:"] },

  // ---- Money & finance ----
  { word: "cash_money", emojis: ["💵", "💰"], shortcodes: [":dollar:", ":moneybag:"] },
  { word: "price", emojis: ["💲", "🏷️"], shortcodes: [":heavy_dollar_sign:", ":label:"] },
  { word: "sale", emojis: ["🏷️", "💸"], shortcodes: [":label:", ":money_with_wings:"] },
  { word: "discount", emojis: ["📉", "💲"], shortcodes: [":chart_decreasing:", ":heavy_dollar_sign:"] },
  { word: "tax", emojis: ["🧾", "💲"], shortcodes: [":receipt:", ":heavy_dollar_sign:"] },
  { word: "bill", emojis: ["🧾", "💵"], shortcodes: [":receipt:", ":dollar:"] },
  { word: "invoice", emojis: ["🧾", "📄"], shortcodes: [":receipt:", ":page_facing_up:"] },
  { word: "invest", emojis: ["📈", "💰"], shortcodes: [":chart_increasing:", ":moneybag:"] },
  { word: "stock", emojis: ["📈", "📊"], shortcodes: [":chart_increasing:", ":bar_chart:"] },
  { word: "bank_account", emojis: ["🏦", "💳"], shortcodes: [":bank:", ":credit_card:"] },

  // ---- Weather extras ----
  { word: "weather", emojis: ["🌤️", "🌡️"], shortcodes: [":sun_behind_small_cloud:", ":thermometer:"] },
  { word: "temperature", emojis: ["🌡️", "🔥"], shortcodes: [":thermometer:", ":fire:"] },
  { word: "summer", emojis: ["☀️", "🏖️"], shortcodes: [":sunny:", ":beach:"] },
  { word: "winter", emojis: ["❄️", "⛄"], shortcodes: [":snowflake:", ":snowman:"] },
  { word: "spring", emojis: ["🌸", "🌱"], shortcodes: [":cherry_blossom:", ":seedling:"] },
  { word: "autumn", emojis: ["🍂", "🍁"], shortcodes: [":fallen_leaf:", ":maple_leaf:"] },
  { word: "fall", emojis: ["🍂", "🍁"], shortcodes: [":fallen_leaf:", ":maple_leaf:"], contexts: { leaf: 0, tree: 0, autumn: 0, down: 1, drop: 1, stumble: 1 } },

  // ---- Body / health ----
  { word: "health", emojis: ["🍎", "❤️"], shortcodes: [":apple:", ":heart:"] },
  { word: "medicine", emojis: ["💊", "💉"], shortcodes: [":pill:", ":syringe:"] },
  { word: "doctor_visit", emojis: ["🩺", "🏥"], shortcodes: [":stethoscope:", ":hospital:"] },
  { word: "hospital_visit", emojis: ["🏥", "🚑"], shortcodes: [":hospital:", ":ambulance:"] },
  { word: "ambulance", emojis: ["🚑", "🏥"], shortcodes: [":ambulance:", ":hospital:"] },
  { word: "exercise", emojis: ["🏃", "💪"], shortcodes: [":runner:", ":muscle:"] },
  { word: "diet", emojis: ["🥗", "🍎"], shortcodes: [":green_salad:", ":apple:"] },
  { word: "weight", emojis: ["⚖️", "🏋️"], shortcodes: [":balance_scale:", ":weight_lifter:"] },
  { word: "doctor_appt", emojis: ["📅", "🩺"], shortcodes: [":date:", ":stethoscope:"] },

  // ---- Communication / social media ----
  { word: "like", emojis: ["👍", "❤️"], shortcodes: [":thumbsup:", ":heart:"] },
  { word: "dislike", emojis: ["👎", "💔"], shortcodes: [":thumbsdown:", ":broken_heart:"] },
  { word: "share", emojis: ["🔗", "📤"], shortcodes: [":link:", ":outbox_tray:"] },
  { word: "comment", emojis: ["💬", "✍️"], shortcodes: [":speech_balloon:", ":writing_hand:"] },
  { word: "follow", emojis: ["👣", "➕"], shortcodes: [":footprints:", ":heavy_plus_sign:"] },
  { word: "subscribe", emojis: ["🔔", "📺"], shortcodes: [":bell:", ":tv:"] },
  { word: "notification", emojis: ["🔔", "📩"], shortcodes: [":bell:", ":envelope_with_arrow:"] },
  { word: "post", emojis: ["📝", "📨"], shortcodes: [":memo:", ":incoming_envelope:"] },
  { word: "tweet", emojis: ["🐦", "💬"], shortcodes: [":bird:", ":speech_balloon:"] },
  { word: "hashtag", emojis: ["#️⃣", "🏷️"], shortcodes: [":hash:", ":label:"] },
];

// Build lookup indexes once for O(1) access.
const WORD_INDEX: Map<string, EmojiEntry> = new Map();
for (const e of EMOJI_DICTIONARY) WORD_INDEX.set(e.word, e);

// Reverse: emoji -> primary word
const EMOJI_TO_WORD: Map<string, string> = new Map();
for (const e of EMOJI_DICTIONARY) {
  if (e.emojis[0]) EMOJI_TO_WORD.set(e.emojis[0], e.word);
}

// Shortcode -> emoji
const SHORTCODE_TO_EMOJI: Map<string, { emoji: string; word: string }> = new Map();
for (const e of EMOJI_DICTIONARY) {
  for (let i = 0; i < e.shortcodes.length; i++) {
    const sc = e.shortcodes[i];
    if (sc && e.emojis[i]) {
      SHORTCODE_TO_EMOJI.set(sc, { emoji: e.emojis[i], word: e.word });
    }
  }
}

// ---------- Pure helpers ----------

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeWord(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize but keep apostrophes inside words ("don't"). */
export function normalizeForLookup(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip trailing 's'/'es'/'ing'/'ed' for loose matching. */
export function lemmatize(word: string): string {
  const w = normalizeWord(word);
  if (!w) return w;
  // very small English lemmatizer
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 3 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  return w;
}

/** Split text into tokens preserving whitespace/punctuation. */
export function tokenize(text: string): { raw: string; word: string; start: number; end: number }[] {
  const out: { raw: string; word: string; start: number; end: number }[] = [];
  if (!text) return out;
  const re = /(\p{L}[\p{L}'-]*|\p{N}+|\s+|[^\s\p{L}\p{N}]+)/gu;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    out.push({
      raw,
      word: /^\p{L}/u.test(raw) ? normalizeWord(raw) : "",
      start: i,
      end: i + raw.length,
    });
    i += raw.length;
  }
  return out;
}

/** Count words in text. */
export function countWords(text: string): number {
  return tokenize(text).filter((t) => t.word).length;
}

/** Get all emoji alternatives for a word (loose matching). */
export function getAlternatives(word: string): string[] {
  const w = normalizeWord(word);
  if (!w) return [];
  const entry = WORD_INDEX.get(w);
  if (entry) return [...entry.emojis];
  // try lemmatize for loose
  const lemma = lemmatize(w);
  const lemEntry = WORD_INDEX.get(lemma);
  if (lemEntry) return [...lemEntry.emojis];
  return [];
}

/** Find the best emoji entry for a word with optional context disambiguation. */
export function findEntry(
  word: string,
  contextWords: string[] = [],
): { entry: EmojiEntry | null; confidence: number } {
  const w = normalizeWord(word);
  if (!w) return { entry: null, confidence: 0 };

  // Direct hit
  let entry = WORD_INDEX.get(w);
  let confidence = 1.0;
  if (!entry) {
    // Try lemmatized form for loose/ratio modes
    const lemma = lemmatize(w);
    entry = WORD_INDEX.get(lemma);
    confidence = lemma && entry ? 0.7 : 0;
  }
  if (!entry) return { entry: null, confidence: 0 };

  // Apply context disambiguation if defined
  if (entry.contexts && contextWords.length > 0) {
    const ctx = new Set(contextWords.map((c) => normalizeWord(c)));
    for (const [cue, idx] of Object.entries(entry.contexts)) {
      if (ctx.has(cue)) {
        // Reorder: prefer the cued emoji
        const reordered: EmojiEntry = {
          ...entry,
          emojis: [entry.emojis[idx], ...entry.emojis.filter((_, i) => i !== idx)],
          shortcodes: [entry.shortcodes[idx], ...entry.shortcodes.filter((_, i) => i !== idx)],
        };
        return { entry: reordered, confidence: Math.min(1, confidence + 0.15) };
      }
    }
  }
  return { entry, confidence };
}

/** Context window: words within ±N tokens. */
export function contextWindow(tokens: { word: string }[], idx: number, n = 3): string[] {
  const start = Math.max(0, idx - n);
  const end = Math.min(tokens.length, idx + n + 1);
  const out: string[] = [];
  for (let i = start; i < end; i++) {
    if (i === idx) continue;
    if (tokens[i].word) out.push(tokens[i].word);
  }
  return out;
}

/** Convert a Unicode emoji to its Discord/Slack shortcode. */
export function toShortcode(emoji: string): string | null {
  for (const e of EMOJI_DICTIONARY) {
    const i = e.emojis.indexOf(emoji);
    if (i >= 0) return e.shortcodes[i] ?? null;
  }
  return null;
}

/** Convert a :shortcode: back to its Unicode emoji. */
export function fromShortcode(shortcode: string): string | null {
  const s = shortcode.trim();
  if (!s) return null;
  const hit = SHORTCODE_TO_EMOJI.get(s);
  return hit ? hit.emoji : null;
}

/** Render an emoji for the chosen output target. */
export function renderForTarget(emoji: string, target: OutputTarget): string {
  if (target === "unicode") return emoji;
  const sc = toShortcode(emoji);
  return sc ?? emoji;
}

// ---------- Core translation ----------

/** Translate text to emoji. */
export function textToEmoji(
  text: string,
  mode: TranslationMode = "strict",
  density: Density = "medium",
  target: OutputTarget = "unicode",
): TranslationResult {
  const tokens = tokenize(text);
  const matches: TokenMatch[] = [];

  // First pass: find candidates per word token
  const candidates: { tokenIdx: number; entry: EmojiEntry; confidence: number; raw: string; word: string }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!tok.word) continue;
    if (mode === "strict") {
      const { entry, confidence } = findEntry(tok.word, contextWindow(tokens, i));
      if (entry) {
        candidates.push({ tokenIdx: i, entry, confidence, raw: tok.raw, word: tok.word });
      }
    } else {
      // loose + ratio both use lemmatized lookup
      const { entry, confidence } = findEntry(tok.word, contextWindow(tokens, i));
      if (entry) {
        candidates.push({ tokenIdx: i, entry, confidence, raw: tok.raw, word: tok.word });
      }
    }
  }

  // Apply density ratio (for "ratio" mode and density-based pruning)
  const ratio = mode === "ratio" ? DENSITY_RATIO[density] : 1.0;
  let chosenCandidates = candidates;
  if (mode === "ratio") {
    // rank by confidence, keep top ratio
    const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
    chosenCandidates = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * ratio)));
    // restore original order
    chosenCandidates.sort((a, b) => a.tokenIdx - b.tokenIdx);
  } else if (density === "sparse") {
    // keep only top ~30% by confidence
    const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
    const keep = new Set(sorted.slice(0, Math.ceil(sorted.length * 0.3)).map((c) => c.tokenIdx));
    chosenCandidates = candidates.filter((c) => keep.has(c.tokenIdx));
  } else if (density === "medium") {
    const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
    const keep = new Set(sorted.slice(0, Math.ceil(sorted.length * 0.6)).map((c) => c.tokenIdx));
    chosenCandidates = candidates.filter((c) => keep.has(c.tokenIdx));
  }
  // dense: keep all

  const chosenIdxs = new Set(chosenCandidates.map((c) => c.tokenIdx));

  // Build matches in token order
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!tok.word) {
      matches.push({
        raw: tok.raw,
        word: "",
        matched: false,
        emoji: null,
        shortcode: null,
        alternatives: [],
        confidence: 0,
        startIndex: tok.start,
        endIndex: tok.end,
      });
      continue;
    }
    if (chosenIdxs.has(i)) {
      const c = chosenCandidates.find((x) => x.tokenIdx === i)!;
      matches.push({
        raw: tok.raw,
        word: tok.word,
        matched: true,
        emoji: c.entry.emojis[0] ?? null,
        shortcode: c.entry.shortcodes[0] ?? null,
        alternatives: c.entry.emojis.slice(1),
        confidence: c.confidence,
        startIndex: tok.start,
        endIndex: tok.end,
      });
    } else {
      matches.push({
        raw: tok.raw,
        word: tok.word,
        matched: false,
        emoji: null,
        shortcode: null,
        alternatives: getAlternatives(tok.word),
        confidence: 0,
        startIndex: tok.start,
        endIndex: tok.end,
      });
    }
  }

  // Render output: replace matched words with emoji, keep others
  const parts: string[] = [];
  for (const m of matches) {
    if (m.matched && m.emoji) {
      parts.push(renderForTarget(m.emoji, target));
    } else {
      parts.push(m.raw);
    }
  }

  const totalWords = matches.filter((m) => m.word).length;
  const matchCount = matches.filter((m) => m.matched).length;

  return {
    input: text,
    output: parts.join(""),
    matches,
    matchCount,
    totalWords,
    coverage: totalWords > 0 ? matchCount / totalWords : 0,
    mode,
    density,
    target,
  };
}

/** Decode emoji back to text. Best-effort. */
export function emojiToText(text: string): DecodeResult {
  if (!text) return { input: "", output: "", decodedCount: 0, unknown: [] };
  // Replace :shortcodes: first
  let working = text.replace(/:([a-z0-9_]+):/gi, (full, name: string) => {
    const sc = `:${name}:`;
    const emoji = fromShortcode(sc);
    return emoji ?? full;
  });

  // Replace known emojis with their primary word
  const unknown: string[] = [];
  let decoded = 0;
  // Sort emojis by length desc so multi-codepoint emojis match first
  const allEmojis = [...EMOJI_TO_WORD.keys()].sort((a, b) => b.length - a.length);
  for (const emoji of allEmojis) {
    if (working.includes(emoji)) {
      const word = EMOJI_TO_WORD.get(emoji)!;
      working = working.split(emoji).join(` ${word} `);
      decoded += 1;
    }
  }
  // Collapse extra spaces and trim
  const output = working.replace(/\s+/g, " ").trim();
  return {
    input: text,
    output,
    decodedCount: decoded,
    unknown,
  };
}

/** Compute stats from a translation result. */
export function computeStats(result: TranslationResult): Stats {
  const unique = new Set<string>();
  for (const m of result.matches) {
    if (m.matched && m.emoji) unique.add(m.emoji);
  }
  return {
    totalWords: result.totalWords,
    matchedWords: result.matchCount,
    uniqueEmojis: unique.size,
    coverage: result.coverage,
  };
}

// ---------- Rendering ----------

export function renderText(result: TranslationResult): string {
  return result.output;
}

export function renderMarkdown(result: TranslationResult): string {
  const lines: string[] = [];
  lines.push(`# Emoji Translation`);
  lines.push("");
  lines.push(`**Mode:** ${MODE_LABELS[result.mode]}  `);
  lines.push(`**Density:** ${DENSITY_LABELS[result.density]}  `);
  lines.push(`**Target:** ${TARGET_LABELS[result.target]}  `);
  lines.push("");
  lines.push(`## Input`);
  lines.push("```");
  lines.push(result.input);
  lines.push("```");
  lines.push("");
  lines.push(`## Output`);
  lines.push("```");
  lines.push(result.output);
  lines.push("```");
  lines.push("");
  lines.push(`## Stats`);
  lines.push(`- Total words: ${result.totalWords}`);
  lines.push(`- Matched words: ${result.matchCount}`);
  lines.push(`- Coverage: ${(result.coverage * 100).toFixed(1)}%`);
  lines.push("");
  lines.push(`## Matches`);
  for (const m of result.matches) {
    if (m.matched) {
      lines.push(`- \`${m.raw}\` → ${m.emoji} (confidence: ${(m.confidence * 100).toFixed(0)}%)`);
      if (m.alternatives.length > 0) {
        lines.push(`  - Alternatives: ${m.alternatives.join(" ")}`);
      }
    }
  }
  return lines.join("\n");
}

export function renderJson(result: TranslationResult): string {
  return JSON.stringify(result, null, 2);
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
  if (state.text) params.set("text", state.text);
  if (state.mode) params.set("mode", state.mode);
  if (state.density) params.set("density", state.density);
  if (state.target) params.set("target", state.target);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { text: "", mode: "strict", density: "medium", target: "unicode" };
  const params = new URLSearchParams(clean);
  const text = params.get("text") ?? "";
  const mode = (params.get("mode") as TranslationMode | null);
  const density = (params.get("density") as Density | null);
  const target = (params.get("target") as OutputTarget | null);
  const validModes: TranslationMode[] = ["strict", "loose", "ratio"];
  const validDensities: Density[] = ["sparse", "medium", "dense"];
  const validTargets: OutputTarget[] = ["unicode", "discord", "slack"];
  return {
    text,
    mode: mode && validModes.includes(mode) ? mode : "strict",
    density: density && validDensities.includes(density) ? density : "medium",
    target: target && validTargets.includes(target) ? target : "unicode",
  };
}

// ---------- Optional LLM prompt builder ----------

export interface LlmPrompt {
  system: string;
  user: string;
}

export function buildLlmPrompt(
  text: string,
  mode: TranslationMode,
  density: Density,
  target: OutputTarget,
): LlmPrompt {
  const system = `You are an emoji translation engine. Replace words in the user's text with appropriate emojis. Mode: ${mode} (strict=whole words, loose=lemmatized, ratio=density-ranked). Density: ${density} (sparse=~30%, medium=~60%, dense=~95% of matches kept). Output target: ${target} (unicode emoji, discord :shortcode:, or slack :shortcode:). Return ONLY the translated text with no commentary.`;
  const user = `Translate to emoji:\n\n${text}`;
  return { system, user };
}

export function renderLlmResult(raw: string): string {
  return (raw || "").trim();
}
