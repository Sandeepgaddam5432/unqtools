/**
 * Emoji Picker & Keyboard — pure logic.
 *
 * Browse, search, and copy emojis from a 600+ built-in database. Pure
 * functions only — no DOM, no network.
 */

// ---- Types ----

export type EmojiCategory =
  | "smileys"
  | "gestures"
  | "animals"
  | "food"
  | "activities"
  | "travel"
  | "objects"
  | "symbols"
  | "flags";

export type SkinTone =
  | "none"
  | "light"
  | "medium-light"
  | "medium"
  | "medium-dark"
  | "dark";

export interface EmojiEntry {
  char: string;
  name: string;
  keywords: string[];
  category: EmojiCategory;
  skinToneSupport: boolean;
}

export interface ZwjCombo {
  name: string;
  components: string[]; // input emoji chars (in order)
  result: string; // resulting compound emoji char
}

export interface EmojiStats {
  total: number;
  byCategory: Record<EmojiCategory, number>;
}

// ---- Constants ----

export const CATEGORIES: EmojiCategory[] = [
  "smileys",
  "gestures",
  "animals",
  "food",
  "activities",
  "travel",
  "objects",
  "symbols",
  "flags",
];

export const CATEGORY_LABELS: Record<EmojiCategory, string> = {
  smileys: "Smileys & Faces",
  gestures: "Gestures & People",
  animals: "Animals & Nature",
  food: "Food & Drink",
  activities: "Activities",
  travel: "Travel & Places",
  objects: "Objects",
  symbols: "Symbols",
  flags: "Flags",
};

export const SKIN_TONES: SkinTone[] = [
  "none",
  "light",
  "medium-light",
  "medium",
  "medium-dark",
  "dark",
];

export const SKIN_TONE_LABELS: Record<SkinTone, string> = {
  "none": "Default",
  "light": "Light",
  "medium-light": "Medium-Light",
  "medium": "Medium",
  "medium-dark": "Medium-Dark",
  "dark": "Dark",
};

export const SKIN_TONE_MODIFIERS: Record<Exclude<SkinTone, "none">, string> = {
  "light": "\u{1F3FB}",
  "medium-light": "\u{1F3FC}",
  "medium": "\u{1F3FD}",
  "medium-dark": "\u{1F3FE}",
  "dark": "\u{1F3FF}",
};

export const SKIN_TONE_SWATCH: Record<SkinTone, string> = {
  "none": "#facc15",
  "light": "#f5d6a8",
  "medium-light": "#e0a96d",
  "medium": "#b8763e",
  "medium-dark": "#8d4d20",
  "dark": "#5a2d10",
};

// ---- Emoji database (600+ entries) ----
// Each entry: { char, name, keywords, category, skinToneSupport }

function e(
  char: string,
  name: string,
  keywords: string[],
  category: EmojiCategory,
  skinToneSupport = false,
): EmojiEntry {
  return { char, name, keywords, category, skinToneSupport };
}

export const EMOJI_DB: EmojiEntry[] = [
  // ---- Smileys & Faces ----
  e("😀", "grinning face", ["happy", "smile", "joy"], "smileys"),
  e("😃", "grinning face with big eyes", ["happy", "joy"], "smileys"),
  e("😄", "grinning face with smiling eyes", ["happy", "joy"], "smileys"),
  e("😁", "beaming face with smiling eyes", ["happy", "smile"], "smileys"),
  e("😆", "grinning squinting face", ["laugh", "happy"], "smileys"),
  e("😅", "grinning face with sweat", ["nervous", "phew"], "smileys"),
  e("🤣", "rolling on the floor laughing", ["rofl", "laugh"], "smileys"),
  e("😂", "face with tears of joy", ["lol", "laugh"], "smileys"),
  e("🙂", "slightly smiling face", ["smile", "happy"], "smileys"),
  e("🙃", "upside-down face", ["sarcasm"], "smileys"),
  e("😉", "winking face", ["wink", "flirt"], "smileys"),
  e("😊", "smiling face with smiling eyes", ["blush", "happy"], "smileys"),
  e("😇", "smiling face with halo", ["angel", "innocent"], "smileys"),
  e("🥰", "smiling face with hearts", ["love", "adore"], "smileys"),
  e("😍", "smiling face with heart-eyes", ["love", "crush"], "smileys"),
  e("🤩", "star-struck", ["excited", "fan"], "smileys"),
  e("😘", "face blowing a kiss", ["love", "flirt"], "smileys"),
  e("😗", "kissing face", ["kiss"], "smileys"),
  e("😚", "kissing face with closed eyes", ["kiss"], "smileys"),
  e("😙", "kissing face with smiling eyes", ["kiss"], "smileys"),
  e("🥲", "smiling face with tear", ["touched"], "smileys"),
  e("😋", "face savoring food", ["yummy", "delicious"], "smileys"),
  e("😛", "face with tongue", ["cheeky"], "smileys"),
  e("😜", "winking face with tongue", ["prank"], "smileys"),
  e("🤪", "zany face", ["crazy"], "smileys"),
  e("😝", "squinting face with tongue", ["prank"], "smileys"),
  e("🤑", "money-mouth face", ["rich", "money"], "smileys"),
  e("🤗", "hugging face", ["hug", "thanks"], "smileys"),
  e("🤭", "face with hand over mouth", ["oops", "shy"], "smileys"),
  e("🤫", "shushing face", ["quiet", "secret"], "smileys"),
  e("🤔", "thinking face", ["think", "hmm"], "smileys"),
  e("🤐", "zipper-mouth face", ["secret", "quiet"], "smileys"),
  e("🤨", "face with raised eyebrow", ["skeptical", "suspicious"], "smileys"),
  e("😐", "neutral face", ["meh", "indifferent"], "smileys"),
  e("😑", "expressionless face", ["blank"], "smileys"),
  e("😶", "face without mouth", ["mute"], "smileys"),
  e("😏", "smirking face", ["smug", "smirk"], "smileys"),
  e("😒", "unamused face", ["annoyed", "bored"], "smileys"),
  e("🙄", "face with rolling eyes", ["eyeroll", "annoyed"], "smileys"),
  e("😬", "grimacing face", ["awkward"], "smileys"),
  e("😮\u200d💨", "face exhaling", ["relief"], "smileys"),
  e("🤥", "lying face", ["lie", "pinocchio"], "smileys"),
  e("😌", "relieved face", ["phew", "peaceful"], "smileys"),
  e("😔", "pensive face", ["sad", "thoughtful"], "smileys"),
  e("😪", "sleepy face", ["tired", "sleep"], "smileys"),
  e("🤤", "drooling face", ["hungry"], "smileys"),
  e("😴", "sleeping face", ["sleep", "snore"], "smileys"),
  e("😷", "face with medical mask", ["sick", "covid"], "smileys"),
  e("🤒", "face with thermometer", ["sick", "fever"], "smileys"),
  e("🤕", "face with head-bandage", ["hurt", "injured"], "smileys"),
  e("🤢", "nauseated face", ["sick", "green"], "smileys"),
  e("🤮", "face vomiting", ["sick", "puke"], "smileys"),
  e("🤧", "sneezing face", ["sick", "achoo"], "smileys"),
  e("🥵", "hot face", ["heat", "warm"], "smileys"),
  e("🥶", "cold face", ["freezing", "cold"], "smileys"),
  e("🥴", "woozy face", ["drunk", "dizzy"], "smileys"),
  e("😵", "face with crossed-out eyes", ["dizzy", "dead"], "smileys"),
  e("🤯", "exploding head", ["mind blown", "shocked"], "smileys"),
  e("🤠", "cowboy hat face", ["cowboy", "western"], "smileys"),
  e("🥳", "partying face", ["party", "celebrate"], "smileys"),
  e("🥸", "disguised face", ["disguise", "fake"], "smileys"),
  e("😎", "smiling face with sunglasses", ["cool", "swag"], "smileys"),
  e("🤓", "nerd face", ["geek", "smart"], "smileys"),
  e("🧐", "face with monocle", ["skeptical"], "smileys"),
  e("🥺", "pleading face", ["beg", "cute"], "smileys"),
  e("😭", "loudly crying face", ["sad", "cry", "sob"], "smileys"),
  e("😠", "angry face", ["mad", "angry"], "smileys"),
  e("😡", "pouting face", ["rage", "furious"], "smileys"),
  e("🤬", "face with symbols on mouth", ["swear", "curse"], "smileys"),
  e("😈", "smiling face with horns", ["devil", "mischief"], "smileys"),
  e("👿", "angry face with horns", ["devil", "angry"], "smileys"),
  e("💀", "skull", ["dead", "death"], "smileys"),
  e("☠️", "skull and crossbones", ["pirate", "poison"], "smileys"),
  e("💩", "pile of poo", ["poop", "crap"], "smileys"),
  e("🤡", "clown face", ["clown", "creepy"], "smileys"),
  e("👹", "ogre", ["monster"], "smileys"),
  e("👺", "goblin", ["monster", "mask"], "smileys"),
  e("👻", "ghost", ["spooky", "halloween"], "smileys"),
  e("👽", "alien", ["ufo", "space"], "smileys"),
  e("👾", "alien monster", ["game", "retro"], "smileys"),
  e("🤖", "robot", ["ai", "bot"], "smileys"),
  e("😺", "grinning cat", ["cat", "happy"], "smileys"),
  e("😸", "grinning cat with smiling eyes", ["cat", "happy"], "smileys"),
  e("😹", "cat with tears of joy", ["cat", "laugh"], "smileys"),
  e("😻", "smiling cat with heart-eyes", ["cat", "love"], "smileys"),
  e("😼", "cat with wry smile", ["cat", "smirk"], "smileys"),
  e("😽", "kissing cat", ["cat", "kiss"], "smileys"),
  e("🙀", "weary cat", ["cat", "shock"], "smileys"),
  e("😿", "crying cat", ["cat", "sad"], "smileys"),
  e("😾", "pouting cat", ["cat", "mad"], "smileys"),

  // ---- Gestures & People ----
  e("👋", "waving hand", ["hi", "hello", "bye"], "gestures", true),
  e("🤚", "raised back of hand", ["stop"], "gestures", true),
  e("🖐️", "hand with fingers splayed", ["hand"], "gestures", true),
  e("✋", "raised hand", ["stop", "hi"], "gestures", true),
  e("🖖", "vulcan salute", ["spock"], "gestures", true),
  e("👌", "OK hand", ["ok", "okay"], "gestures", true),
  e("🤌", "pinched fingers", ["italian", "chef"], "gestures", true),
  e("🤏", "pinching hand", ["small", "tiny"], "gestures", true),
  e("✌️", "victory hand", ["peace", "victory"], "gestures", true),
  e("🤞", "crossed fingers", ["luck", "hope"], "gestures", true),
  e("🤟", "love-you gesture", ["ily", "love"], "gestures", true),
  e("🤘", "sign of the horns", ["rock", "metal"], "gestures", true),
  e("🤙", "call me hand", ["shaka"], "gestures", true),
  e("👈", "backhand index pointing left", ["point", "left"], "gestures", true),
  e("👉", "backhand index pointing right", ["point", "right"], "gestures", true),
  e("👆", "backhand index pointing up", ["point", "up"], "gestures", true),
  e("🖕", "middle finger", ["rude"], "gestures", true),
  e("👇", "backhand index pointing down", ["point", "down"], "gestures", true),
  e("☝️", "index pointing up", ["one", "point"], "gestures", true),
  e("👍", "thumbs up", ["yes", "like", "good"], "gestures", true),
  e("👎", "thumbs down", ["no", "dislike", "bad"], "gestures", true),
  e("✊", "raised fist", ["power", "fight"], "gestures", true),
  e("👊", "oncoming fist", ["punch", "hit"], "gestures", true),
  e("🤛", "left-facing fist", ["fist"], "gestures", true),
  e("🤜", "right-facing fist", ["fist"], "gestures", true),
  e("👏", "clapping hands", ["clap", "applause"], "gestures", true),
  e("🙌", "raising hands", ["yay", "praise"], "gestures", true),
  e("👐", "open hands", ["hug", "open"], "gestures", true),
  e("🤲", "palms up together", ["pray", "please"], "gestures", true),
  e("🤝", "handshake", ["deal", "agreement"], "gestures"),
  e("🙏", "folded hands", ["pray", "thanks"], "gestures", true),
  e("✍️", "writing hand", ["write", "pen"], "gestures", true),
  e("💅", "nail polish", ["nails", "manicure"], "gestures", true),
  e("🤳", "selfie", ["selfie", "photo"], "gestures", true),
  e("💪", "flexed biceps", ["strong", "muscle"], "gestures", true),
  e("🦾", "mechanical arm", ["prosthetic", "robot"], "gestures"),
  e("🦿", "mechanical leg", ["prosthetic", "robot"], "gestures"),
  e("🦵", "leg", ["leg"], "gestures", true),
  e("🦶", "foot", ["foot"], "gestures", true),
  e("👂", "ear", ["ear", "hear"], "gestures", true),
  e("👃", "nose", ["nose", "smell"], "gestures", true),
  e("🧠", "brain", ["smart", "mind"], "gestures"),
  e("🫀", "anatomical heart", ["heart", "organ"], "gestures"),
  e("🫁", "lungs", ["breathe", "organ"], "gestures"),
  e("🦷", "tooth", ["tooth", "dentist"], "gestures"),
  e("🦴", "bone", ["bone", "skeleton"], "gestures"),
  e("👀", "eyes", ["eyes", "look"], "gestures"),
  e("👁️", "eye", ["eye", "look"], "gestures"),
  e("👅", "tongue", ["tongue", "taste"], "gestures"),
  e("👄", "mouth", ["mouth", "lips"], "gestures"),
  e("👶", "baby", ["baby", "infant"], "gestures", true),
  e("🧒", "child", ["kid", "child"], "gestures", true),
  e("👦", "boy", ["boy", "kid"], "gestures", true),
  e("👧", "girl", ["girl", "kid"], "gestures", true),
  e("🧑", "person", ["person", "adult"], "gestures", true),
  e("👱", "blond person", ["blonde", "hair"], "gestures", true),
  e("👨", "man", ["man", "male"], "gestures", true),
  e("🧔", "bearded person", ["beard"], "gestures", true),
  e("👩", "woman", ["woman", "female"], "gestures", true),
  e("🧓", "older person", ["old", "elder"], "gestures", true),
  e("👴", "old man", ["old", "elder"], "gestures", true),
  e("👵", "old woman", ["old", "elder"], "gestures", true),
  e("🙇", "person bowing", ["bow", "sorry"], "gestures", true),
  e("🤦", "person facepalming", ["facepalm"], "gestures", true),
  e("🤷", "person shrugging", ["shrug", "idk"], "gestures", true),
  e("💬", "speech balloon", ["talk", "chat"], "gestures"),
  e("💭", "thought balloon", ["think"], "gestures"),
  e("🕳️", "hole", ["hole"], "gestures"),
  e("🕴️", "man in suit levitating", ["business"], "gestures"),

  // ---- Animals & Nature ----
  e("🐶", "dog face", ["dog", "puppy"], "animals"),
  e("🐱", "cat face", ["cat", "kitty"], "animals"),
  e("🐭", "mouse face", ["mouse"], "animals"),
  e("🐹", "hamster face", ["hamster"], "animals"),
  e("🐰", "rabbit face", ["bunny", "rabbit"], "animals"),
  e("🦊", "fox face", ["fox"], "animals"),
  e("🐻", "bear face", ["bear"], "animals"),
  e("🐼", "panda face", ["panda"], "animals"),
  e("🐻\u200d❄️", "polar bear", ["polar", "bear"], "animals"),
  e("🐨", "koala", ["koala", "australia"], "animals"),
  e("🐯", "tiger face", ["tiger"], "animals"),
  e("🦁", "lion face", ["lion"], "animals"),
  e("🐮", "cow face", ["cow"], "animals"),
  e("🐷", "pig face", ["pig"], "animals"),
  e("🐸", "frog face", ["frog"], "animals"),
  e("🐵", "monkey face", ["monkey"], "animals"),
  e("🙈", "see-no-evil monkey", ["monkey"], "animals"),
  e("🙉", "hear-no-evil monkey", ["monkey"], "animals"),
  e("🙊", "speak-no-evil monkey", ["monkey"], "animals"),
  e("🐒", "monkey", ["monkey"], "animals"),
  e("🐔", "chicken", ["chicken"], "animals"),
  e("🐧", "penguin", ["penguin"], "animals"),
  e("🐦", "bird", ["bird"], "animals"),
  e("🐤", "baby chick", ["chick"], "animals"),
  e("🦆", "duck", ["duck"], "animals"),
  e("🦅", "eagle", ["eagle"], "animals"),
  e("🦉", "owl", ["owl"], "animals"),
  e("🦇", "bat", ["bat"], "animals"),
  e("🐺", "wolf face", ["wolf"], "animals"),
  e("🐗", "boar", ["boar"], "animals"),
  e("🐴", "horse face", ["horse"], "animals"),
  e("🦄", "unicorn", ["unicorn"], "animals"),
  e("🐝", "honeybee", ["bee", "bug"], "animals"),
  e("🐛", "bug", ["bug", "worm"], "animals"),
  e("🦋", "butterfly", ["butterfly"], "animals"),
  e("🐌", "snail", ["snail"], "animals"),
  e("🐞", "lady beetle", ["ladybug"], "animals"),
  e("🐜", "ant", ["ant"], "animals"),
  e("🦗", "cricket", ["cricket"], "animals"),
  e("🕷️", "spider", ["spider"], "animals"),
  e("🦂", "scorpion", ["scorpion"], "animals"),
  e("🐢", "turtle", ["turtle"], "animals"),
  e("🐍", "snake", ["snake"], "animals"),
  e("🦕", "sauropod", ["dinosaur"], "animals"),
  e("🦖", "t-rex", ["dinosaur"], "animals"),
  e("🐙", "octopus", ["octopus"], "animals"),
  e("🦑", "squid", ["squid"], "animals"),
  e("🦐", "shrimp", ["shrimp"], "animals"),
  e("🦞", "lobster", ["lobster"], "animals"),
  e("🦀", "crab", ["crab"], "animals"),
  e("🐡", "blowfish", ["puffer"], "animals"),
  e("🐠", "tropical fish", ["fish"], "animals"),
  e("🐟", "fish", ["fish"], "animals"),
  e("🐬", "dolphin", ["dolphin"], "animals"),
  e("🐳", "spouting whale", ["whale"], "animals"),
  e("🐋", "whale", ["whale"], "animals"),
  e("🦈", "shark", ["shark"], "animals"),
  e("🐊", "crocodile", ["crocodile"], "animals"),
  e("🐅", "tiger", ["tiger"], "animals"),
  e("🐆", "leopard", ["leopard"], "animals"),
  e("🦓", "zebra", ["zebra"], "animals"),
  e("🦍", "gorilla", ["gorilla"], "animals"),
  e("🦧", "orangutan", ["orangutan"], "animals"),
  e("🐘", "elephant", ["elephant"], "animals"),
  e("🦛", "hippopotamus", ["hippo"], "animals"),
  e("🦏", "rhinoceros", ["rhino"], "animals"),
  e("🐪", "camel", ["camel"], "animals"),
  e("🐫", "two-hump camel", ["camel"], "animals"),
  e("🦒", "giraffe", ["giraffe"], "animals"),
  e("🦘", "kangaroo", ["kangaroo"], "animals"),
  e("🦬", "bison", ["bison"], "animals"),
  e("🐃", "water buffalo", ["buffalo"], "animals"),
  e("🐂", "ox", ["ox"], "animals"),
  e("🐄", "cow", ["cow"], "animals"),
  e("🐎", "horse", ["horse"], "animals"),
  e("🐖", "pig", ["pig"], "animals"),
  e("🐏", "ram", ["ram"], "animals"),
  e("🐑", "ewe", ["sheep"], "animals"),
  e("🐐", "goat", ["goat"], "animals"),
  e("🦌", "deer", ["deer"], "animals"),
  e("🐕", "dog", ["dog"], "animals"),
  e("🐩", "poodle", ["poodle"], "animals"),
  e("🐕\u200d🦺", "service dog", ["dog"], "animals"),
  e("🐈", "cat", ["cat"], "animals"),
  e("🐓", "rooster", ["rooster"], "animals"),
  e("🦃", "turkey", ["turkey"], "animals"),
  e("🦚", "peacock", ["peacock"], "animals"),
  e("🦜", "parrot", ["parrot"], "animals"),
  e("🦢", "swan", ["swan"], "animals"),
  e("🦩", "flamingo", ["flamingo"], "animals"),
  e("🕊️", "dove", ["peace"], "animals"),
  e("🐇", "rabbit", ["rabbit"], "animals"),
  e("🦝", "raccoon", ["raccoon"], "animals"),
  e("🦨", "skunk", ["skunk"], "animals"),
  e("🦡", "badger", ["badger"], "animals"),
  e("🦫", "beaver", ["beaver"], "animals"),
  e("🦦", "otter", ["otter"], "animals"),
  e("🦥", "sloth", ["sloth"], "animals"),
  e("🐁", "mouse", ["mouse"], "animals"),
  e("🐀", "rat", ["rat"], "animals"),
  e("🐿️", "chipmunk", ["squirrel"], "animals"),
  e("🦔", "hedgehog", ["hedgehog"], "animals"),
  e("🐉", "dragon", ["dragon"], "animals"),
  e("🐲", "dragon face", ["dragon"], "animals"),
  e("🌵", "cactus", ["cactus", "desert"], "animals"),
  e("🎄", "Christmas tree", ["christmas", "tree"], "animals"),
  e("🌲", "evergreen tree", ["tree"], "animals"),
  e("🌳", "deciduous tree", ["tree"], "animals"),
  e("🌴", "palm tree", ["palm", "tropical"], "animals"),
  e("🍀", "shamrock", ["luck", "clover"], "animals"),
  e("🌿", "herb", ["herb", "plant"], "animals"),
  e("☘️", "shamrock", ["clover"], "animals"),
  e("🍁", "maple leaf", ["leaf", "canada"], "animals"),
  e("🍂", "fallen leaf", ["leaf", "autumn"], "animals"),
  e("🍃", "leaf fluttering in wind", ["leaf", "wind"], "animals"),
  e("🍄", "mushroom", ["mushroom"], "animals"),
  e("🌾", "sheaf of rice", ["rice", "grain"], "animals"),
  e("🌷", "tulip", ["tulip", "flower"], "animals"),
  e("🌹", "rose", ["rose", "love", "flower"], "animals"),
  e("🥀", "wilted flower", ["flower", "sad"], "animals"),
  e("🌺", "hibiscus", ["hibiscus", "flower"], "animals"),
  e("🌸", "cherry blossom", ["sakura", "flower"], "animals"),
  e("🌼", "daisy", ["daisy", "flower"], "animals"),
  e("🌻", "sunflower", ["sunflower"], "animals"),
  e("💐", "bouquet", ["flowers"], "animals"),
  e("🌱", "seedling", ["plant", "grow"], "animals"),

  // ---- Food & Drink ----
  e("🍏", "green apple", ["apple", "fruit"], "food"),
  e("🍎", "red apple", ["apple", "fruit"], "food"),
  e("🍐", "pear", ["pear", "fruit"], "food"),
  e("🍊", "tangerine", ["orange", "fruit"], "food"),
  e("🍋", "lemon", ["lemon", "fruit"], "food"),
  e("🍌", "banana", ["banana", "fruit"], "food"),
  e("🍉", "watermelon", ["watermelon", "fruit"], "food"),
  e("🍇", "grapes", ["grapes", "fruit"], "food"),
  e("🍓", "strawberry", ["strawberry", "fruit"], "food"),
  e("🫐", "blueberries", ["blueberry", "fruit"], "food"),
  e("🍈", "melon", ["melon", "fruit"], "food"),
  e("🍒", "cherries", ["cherry", "fruit"], "food"),
  e("🍑", "peach", ["peach", "fruit"], "food"),
  e("🥭", "mango", ["mango", "fruit"], "food"),
  e("🍍", "pineapple", ["pineapple", "fruit"], "food"),
  e("🥥", "coconut", ["coconut", "fruit"], "food"),
  e("🥝", "kiwi fruit", ["kiwi", "fruit"], "food"),
  e("🍅", "tomato", ["tomato"], "food"),
  e("🍆", "eggplant", ["eggplant", "aubergine"], "food"),
  e("🥑", "avocado", ["avocado"], "food"),
  e("🥦", "broccoli", ["broccoli", "veg"], "food"),
  e("🥬", "leafy green", ["lettuce", "veg"], "food"),
  e("🥒", "cucumber", ["cucumber", "veg"], "food"),
  e("🌶️", "hot pepper", ["chili", "spicy"], "food"),
  e("🫑", "bell pepper", ["pepper", "veg"], "food"),
  e("🌽", "ear of corn", ["corn", "maize"], "food"),
  e("🥕", "carrot", ["carrot", "veg"], "food"),
  e("🧄", "garlic", ["garlic"], "food"),
  e("🧅", "onion", ["onion"], "food"),
  e("🥔", "potato", ["potato"], "food"),
  e("🍠", "roasted sweet potato", ["sweet potato"], "food"),
  e("🥐", "croissant", ["croissant", "bread"], "food"),
  e("🥯", "bagel", ["bagel", "bread"], "food"),
  e("🍞", "bread", ["bread", "loaf"], "food"),
  e("🥖", "baguette bread", ["baguette", "bread"], "food"),
  e("🫓", "flatbread", ["bread", "naan"], "food"),
  e("🧀", "cheese wedge", ["cheese"], "food"),
  e("🥚", "egg", ["egg"], "food"),
  e("🍳", "cooking", ["egg", "frying"], "food"),
  e("🧈", "butter", ["butter"], "food"),
  e("🥞", "pancakes", ["pancakes", "breakfast"], "food"),
  e("🧇", "waffle", ["waffle", "breakfast"], "food"),
  e("🥓", "bacon", ["bacon"], "food"),
  e("🥩", "cut of meat", ["steak", "meat"], "food"),
  e("🍗", "poultry leg", ["chicken", "drumstick"], "food"),
  e("🍖", "meat on bone", ["meat"], "food"),
  e("🌭", "hot dog", ["hotdog", "sausage"], "food"),
  e("🍔", "hamburger", ["burger"], "food"),
  e("🍟", "french fries", ["fries"], "food"),
  e("🍕", "pizza", ["pizza"], "food"),
  e("🫔", "tamale", ["tamale"], "food"),
  e("🌮", "taco", ["taco"], "food"),
  e("🌯", "burrito", ["burrito"], "food"),
  e("🥙", "stuffed flatbread", ["pita", "gyro"], "food"),
  e("🧆", "falafel", ["falafel"], "food"),
  e("🥗", "green salad", ["salad", "healthy"], "food"),
  e("🥘", "shallow pan of food", ["paella"], "food"),
  e("🫕", "fondue", ["fondue", "cheese"], "food"),
  e("🥫", "canned food", ["can"], "food"),
  e("🍝", "spaghetti", ["pasta"], "food"),
  e("🍜", "steaming bowl", ["ramen", "noodles"], "food"),
  e("🍲", "pot of food", ["stew"], "food"),
  e("🍛", "curry rice", ["curry"], "food"),
  e("🍣", "sushi", ["sushi"], "food"),
  e("🍱", "bento box", ["bento"], "food"),
  e("🥟", "dumpling", ["dumpling"], "food"),
  e("🦪", "oyster", ["oyster"], "food"),
  e("🍤", "fried shrimp", ["shrimp", "tempura"], "food"),
  e("🍙", "rice ball", ["onigiri", "rice"], "food"),
  e("🍚", "cooked rice", ["rice"], "food"),
  e("🍘", "rice cracker", ["cracker"], "food"),
  e("🍥", "fish cake with swirl", ["narutomaki"], "food"),
  e("🥠", "fortune cookie", ["cookie", "fortune"], "food"),
  e("🥮", "moon cake", ["mooncake"], "food"),
  e("🍢", "oden", ["oden", "skewer"], "food"),
  e("🍡", "dango", ["dango", "dessert"], "food"),
  e("🍧", "shaved ice", ["ice", "dessert"], "food"),
  e("🍨", "ice cream", ["icecream"], "food"),
  e("🍦", "soft ice cream", ["icecream", "cone"], "food"),
  e("🥧", "pie", ["pie"], "food"),
  e("🧁", "cupcake", ["cupcake"], "food"),
  e("🍰", "shortcake", ["cake", "dessert"], "food"),
  e("🎂", "birthday cake", ["cake", "birthday"], "food"),
  e("🍮", "custard", ["pudding"], "food"),
  e("🍭", "lollipop", ["lollipop", "candy"], "food"),
  e("🍬", "candy", ["candy", "sweet"], "food"),
  e("🍫", "chocolate bar", ["chocolate"], "food"),
  e("🍯", "honey pot", ["honey"], "food"),
  e("🍪", "cookie", ["cookie"], "food"),
  e("🌰", "chestnut", ["chestnut"], "food"),
  e("🥜", "peanuts", ["peanut"], "food"),
  e("🍿", "popcorn", ["popcorn", "movie"], "food"),
  e("🧂", "salt", ["salt"], "food"),
  e("🥛", "glass of milk", ["milk"], "food"),
  e("☕", "hot beverage", ["coffee", "tea"], "food"),
  e("🫖", "teapot", ["tea"], "food"),
  e("🍵", "teacup without handle", ["tea", "matcha"], "food"),
  e("🧃", "beverage box", ["juice"], "food"),
  e("🥤", "cup with straw", ["soda", "drink"], "food"),
  e("🧋", "bubble tea", ["boba", "milk tea"], "food"),
  e("🍺", "beer mug", ["beer"], "food"),
  e("🍻", "clinking beer mugs", ["beer", "cheers"], "food"),
  e("🥂", "clinking glasses", ["champagne", "cheers"], "food"),
  e("🍷", "wine glass", ["wine"], "food"),
  e("🥃", "tumbler glass", ["whisky", "bourbon"], "food"),
  e("🍸", "cocktail glass", ["martini"], "food"),
  e("🍹", "tropical drink", ["cocktail"], "food"),
  e("🍾", "bottle with popping cork", ["champagne", "celebrate"], "food"),
  e("🧉", "mate", ["yerba mate"], "food"),
  e("🥢", "chopsticks", ["chopsticks"], "food"),
  e("🍽️", "fork and knife with plate", ["plate", "dining"], "food"),
  e("🍴", "fork and knife", ["dining"], "food"),
  e("🥄", "spoon", ["spoon"], "food"),

  // ---- Activities ----
  e("⚽", "soccer ball", ["football", "soccer"], "activities"),
  e("🏀", "basketball", ["basketball"], "activities"),
  e("🏈", "american football", ["football"], "activities"),
  e("⚾", "baseball", ["baseball"], "activities"),
  e("🥎", "softball", ["softball"], "activities"),
  e("🎾", "tennis", ["tennis"], "activities"),
  e("🏐", "volleyball", ["volleyball"], "activities"),
  e("🏉", "rugby football", ["rugby"], "activities"),
  e("🥏", "flying disc", ["frisbee"], "activities"),
  e("🎱", "pool 8 ball", ["pool", "billiards"], "activities"),
  e("🏓", "ping pong", ["table tennis"], "activities"),
  e("🏸", "badminton", ["badminton"], "activities"),
  e("🥅", "goal net", ["goal"], "activities"),
  e("🏒", "ice hockey", ["hockey"], "activities"),
  e("🏑", "field hockey", ["hockey"], "activities"),
  e("🥍", "lacrosse", ["lacrosse"], "activities"),
  e("🏏", "cricket game", ["cricket"], "activities"),
  e("🪃", "boomerang", ["boomerang"], "activities"),
  e("🥊", "boxing glove", ["boxing"], "activities"),
  e("🥋", "martial arts uniform", ["karate", "judo"], "activities"),
  e("⛳", "flag in hole", ["golf"], "activities"),
  e("⛸️", "ice skate", ["skating"], "activities"),
  e("🎣", "fishing pole", ["fishing"], "activities"),
  e("🤿", "diving mask", ["diving"], "activities"),
  e("🎽", "running shirt", ["running"], "activities"),
  e("🎿", "skis", ["skiing"], "activities"),
  e("🛷", "sled", ["sled"], "activities"),
  e("🥌", "curling stone", ["curling"], "activities"),
  e("🎯", "bullseye", ["target", "dart"], "activities"),
  e("🪀", "yo-yo", ["yoyo"], "activities"),
  e("🪁", "kite", ["kite"], "activities"),
  e("🔫", "water pistol", ["gun", "water"], "activities"),
  e("🔮", "crystal ball", ["fortune", "magic"], "activities"),
  e("🎮", "video game", ["gaming", "controller"], "activities"),
  e("🕹️", "joystick", ["game", "arcade"], "activities"),
  e("🎰", "slot machine", ["casino", "gamble"], "activities"),
  e("🎲", "game die", ["dice"], "activities"),
  e("🧩", "puzzle piece", ["puzzle"], "activities"),
  e("🃏", "joker", ["card"], "activities"),
  e("🀄", "mahjong red dragon", ["mahjong"], "activities"),
  e("🎴", "flower playing cards", ["cards"], "activities"),
  e("🎭", "performing arts", ["theater", "drama"], "activities"),
  e("🖼️", "framed picture", ["art", "painting"], "activities"),
  e("🎨", "artist palette", ["art", "paint"], "activities"),
  e("🧵", "thread", ["sewing"], "activities"),
  e("🧶", "yarn", ["knitting"], "activities"),
  e("🎼", "musical score", ["music"], "activities"),
  e("🎤", "microphone", ["mic", "karaoke"], "activities"),
  e("🎧", "headphone", ["music", "audio"], "activities"),
  e("🎷", "saxophone", ["sax", "music"], "activities"),
  e("🎸", "guitar", ["guitar", "music"], "activities"),
  e("🎹", "musical keyboard", ["piano", "music"], "activities"),
  e("🎺", "trumpet", ["trumpet", "music"], "activities"),
  e("🎻", "violin", ["violin", "music"], "activities"),
  e("🪕", "banjo", ["banjo", "music"], "activities"),
  e("🥁", "drum", ["drum", "music"], "activities"),
  e("🪘", "long drum", ["drum"], "activities"),
  e("🏆", "trophy", ["win", "award"], "activities"),
  e("🥇", "1st place medal", ["gold", "first"], "activities"),
  e("🥈", "2nd place medal", ["silver", "second"], "activities"),
  e("🥉", "3rd place medal", ["bronze", "third"], "activities"),
  e("🎟️", "admission tickets", ["ticket"], "activities"),
  e("🎫", "ticket", ["ticket"], "activities"),
  e("🎪", "circus tent", ["circus"], "activities"),
  e("🤹", "person juggling", ["juggle"], "activities", true),
  e("🎬", "clapper board", ["film", "movie"], "activities"),
  e("🎳", "bowling", ["bowling"], "activities"),
  e("🪩", "mirror ball", ["disco"], "activities"),
  e("🪅", "piñata", ["party"], "activities"),
  e("🪄", "magic wand", ["magic"], "activities"),

  // ---- Travel & Places ----
  e("🚗", "automobile", ["car"], "travel"),
  e("🚕", "taxi", ["cab"], "travel"),
  e("🚙", "sport utility vehicle", ["suv", "car"], "travel"),
  e("🚌", "bus", ["bus"], "travel"),
  e("🚎", "trolleybus", ["bus"], "travel"),
  e("🏎️", "racing car", ["race"], "travel"),
  e("🚓", "police car", ["police"], "travel"),
  e("🚑", "ambulance", ["medical"], "travel"),
  e("🚒", "fire engine", ["fire"], "travel"),
  e("🚐", "minibus", ["van"], "travel"),
  e("🛻", "pickup truck", ["truck"], "travel"),
  e("🚚", "delivery truck", ["truck"], "travel"),
  e("🚛", "articulated lorry", ["truck"], "travel"),
  e("🚜", "tractor", ["farm"], "travel"),
  e("🏍️", "motorcycle", ["motorbike"], "travel"),
  e("🛵", "motor scooter", ["scooter"], "travel"),
  e("🦽", "manual wheelchair", ["wheelchair"], "travel"),
  e("🦼", "motorized wheelchair", ["wheelchair"], "travel"),
  e("🛺", "auto rickshaw", ["tuk tuk"], "travel"),
  e("🚲", "bicycle", ["bike"], "travel"),
  e("🛴", "kick scooter", ["scooter"], "travel"),
  e("🛹", "skateboard", ["skate"], "travel"),
  e("🛼", "roller skate", ["skate"], "travel"),
  e("🚏", "bus stop", ["bus"], "travel"),
  e("🛣️", "motorway", ["road", "highway"], "travel"),
  e("🛤️", "railway track", ["train"], "travel"),
  e("🛢️", "oil drum", ["oil"], "travel"),
  e("⛽", "fuel pump", ["gas", "fuel"], "travel"),
  e("🚨", "police car light", ["siren"], "travel"),
  e("🚥", "horizontal traffic light", ["traffic"], "travel"),
  e("🚦", "vertical traffic light", ["traffic"], "travel"),
  e("🛑", "stop sign", ["stop"], "travel"),
  e("🚧", "construction", ["barrier"], "travel"),
  e("⚓", "anchor", ["ship"], "travel"),
  e("⛵", "sailboat", ["boat"], "travel"),
  e("🛶", "canoe", ["boat"], "travel"),
  e("🚤", "speedboat", ["boat"], "travel"),
  e("🛳️", "passenger ship", ["ship"], "travel"),
  e("⛴️", "ferry", ["boat"], "travel"),
  e("🛥️", "motor boat", ["boat"], "travel"),
  e("🚢", "ship", ["ship"], "travel"),
  e("✈️", "airplane", ["plane", "fly"], "travel"),
  e("🛩️", "small airplane", ["plane"], "travel"),
  e("🛫", "airplane departure", ["takeoff"], "travel"),
  e("🛬", "airplane arrival", ["landing"], "travel"),
  e("🪂", "parachute", ["parachute"], "travel"),
  e("💺", "seat", ["chair"], "travel"),
  e("🚁", "helicopter", ["heli"], "travel"),
  e("🚟", "suspension railway", ["train"], "travel"),
  e("🚠", "mountain cableway", ["cable"], "travel"),
  e("🚡", "aerial tramway", ["tram"], "travel"),
  e("🛰️", "satellite", ["space"], "travel"),
  e("🚀", "rocket", ["space", "launch"], "travel"),
  e("🛸", "flying saucer", ["ufo"], "travel"),
  e("🛎️", "bellhop bell", ["hotel"], "travel"),
  e("🧳", "luggage", ["suitcase"], "travel"),
  e("🌍", "globe showing Europe-Africa", ["earth", "world"], "travel"),
  e("🌎", "globe showing Americas", ["earth", "world"], "travel"),
  e("🌏", "globe showing Asia-Australia", ["earth", "world"], "travel"),
  e("🌐", "globe with meridians", ["world", "internet"], "travel"),
  e("🗺️", "world map", ["map"], "travel"),
  e("🏔️", "snow-capped mountain", ["mountain"], "travel"),
  e("⛰️", "mountain", ["mountain"], "travel"),
  e("🌋", "volcano", ["volcano"], "travel"),
  e("🗻", "mount fuji", ["fuji"], "travel"),
  e("🏕️", "camping", ["tent", "camp"], "travel"),
  e("🏖️", "beach with umbrella", ["beach"], "travel"),
  e("🏜️", "desert", ["desert"], "travel"),
  e("🏝️", "desert island", ["island"], "travel"),
  e("🏞️", "national park", ["park"], "travel"),
  e("🏟️", "stadium", ["stadium"], "travel"),
  e("🏛️", "classical building", ["building"], "travel"),
  e("🏗️", "building construction", ["construction"], "travel"),
  e("🧱", "brick", ["brick"], "travel"),
  e("🪨", "rock", ["rock", "stone"], "travel"),
  e("🪵", "wood", ["log", "wood"], "travel"),
  e("🛖", "hut", ["hut"], "travel"),
  e("🏘️", "houses", ["houses"], "travel"),
  e("🏚️", "derelict house", ["abandoned"], "travel"),
  e("🏠", "house", ["home"], "travel"),
  e("🏡", "house with garden", ["home"], "travel"),
  e("🏢", "office building", ["office"], "travel"),
  e("🏣", "Japanese post office", ["post"], "travel"),
  e("🏤", "post office", ["post"], "travel"),
  e("🏥", "hospital", ["medical"], "travel"),
  e("🏦", "bank", ["bank"], "travel"),
  e("🏨", "hotel", ["hotel"], "travel"),
  e("🏩", "love hotel", ["hotel"], "travel"),
  e("🏪", "convenience store", ["store"], "travel"),
  e("🏫", "school", ["school"], "travel"),
  e("🏬", "department store", ["store"], "travel"),
  e("🏭", "factory", ["factory"], "travel"),
  e("🏯", "Japanese castle", ["castle"], "travel"),
  e("🏰", "castle", ["castle"], "travel"),
  e("💒", "wedding", ["love"], "travel"),
  e("🗼", "Tokyo tower", ["tower"], "travel"),
  e("🗽", "Statue of Liberty", ["liberty"], "travel"),
  e("⛪", "church", ["church"], "travel"),
  e("🕌", "mosque", ["mosque"], "travel"),
  e("🛕", "hindu temple", ["temple"], "travel"),
  e("🕍", "synagogue", ["synagogue"], "travel"),
  e("⛩️", "shinto shrine", ["shrine"], "travel"),
  e("🕋", "kaaba", ["mecca"], "travel"),
  e("⛲", "fountain", ["water"], "travel"),
  e("⛺", "tent", ["camp"], "travel"),
  e("🌁", "foggy", ["fog"], "travel"),
  e("🌃", "night with stars", ["night"], "travel"),
  e("🏙️", "cityscape", ["city"], "travel"),
  e("🌄", "sunrise over mountains", ["sunrise"], "travel"),
  e("🌅", "sunrise", ["sunrise"], "travel"),
  e("🌆", "cityscape at dusk", ["dusk"], "travel"),
  e("🌇", "sunset", ["sunset"], "travel"),
  e("🌉", "bridge at night", ["bridge"], "travel"),

  // ---- Objects ----
  e("⌚", "watch", ["watch", "time"], "objects"),
  e("📱", "mobile phone", ["phone"], "objects"),
  e("📲", "mobile phone with arrow", ["phone"], "objects"),
  e("💻", "laptop", ["computer"], "objects"),
  e("⌨️", "keyboard", ["typing"], "objects"),
  e("🖥️", "desktop computer", ["computer"], "objects"),
  e("🖨️", "printer", ["printer"], "objects"),
  e("🖱️", "computer mouse", ["mouse"], "objects"),
  e("🖲️", "trackball", ["mouse"], "objects"),
  e("🗜️", "clamp", ["clamp"], "objects"),
  e("💾", "floppy disk", ["save", "retro"], "objects"),
  e("💿", "optical disk", ["cd"], "objects"),
  e("📀", "dvd", ["dvd"], "objects"),
  e("📼", "videocassette", ["vhs"], "objects"),
  e("📷", "camera", ["photo"], "objects"),
  e("📸", "camera with flash", ["photo"], "objects"),
  e("📹", "video camera", ["video"], "objects"),
  e("🎥", "movie camera", ["film"], "objects"),
  e("📽️", "film projector", ["film"], "objects"),
  e("🎞️", "film frames", ["film"], "objects"),
  e("☎️", "telephone", ["phone"], "objects"),
  e("📞", "telephone receiver", ["phone"], "objects"),
  e("📟", "pager", ["pager"], "objects"),
  e("📠", "fax machine", ["fax"], "objects"),
  e("📺", "television", ["tv"], "objects"),
  e("📻", "radio", ["radio"], "objects"),
  e("🎙️", "studio microphone", ["mic"], "objects"),
  e("🎚️", "level slider", ["audio"], "objects"),
  e("🎛️", "control knobs", ["audio"], "objects"),
  e("🧭", "compass", ["compass"], "objects"),
  e("⏱️", "stopwatch", ["timer"], "objects"),
  e("⏲️", "timer clock", ["timer"], "objects"),
  e("⏰", "alarm clock", ["alarm"], "objects"),
  e("🕰️", "mantelpiece clock", ["clock"], "objects"),
  e("⌛", "hourglass done", ["time"], "objects"),
  e("⏳", "hourglass not done", ["time"], "objects"),
  e("📡", "satellite antenna", ["satellite"], "objects"),
  e("🔋", "battery", ["power"], "objects"),
  e("🔌", "electric plug", ["power"], "objects"),
  e("💡", "light bulb", ["idea"], "objects"),
  e("🔦", "flashlight", ["light"], "objects"),
  e("🕯️", "candle", ["light"], "objects"),
  e("🪔", "diya lamp", ["lamp"], "objects"),
  e("🧯", "fire extinguisher", ["fire"], "objects"),
  e("💸", "money with wings", ["money", "cash"], "objects"),
  e("💵", "dollar banknote", ["money"], "objects"),
  e("💴", "yen banknote", ["money"], "objects"),
  e("💶", "euro banknote", ["money"], "objects"),
  e("💷", "pound banknote", ["money"], "objects"),
  e("💰", "money bag", ["money", "cash"], "objects"),
  e("💳", "credit card", ["card"], "objects"),
  e("💎", "gem stone", ["diamond", "jewel"], "objects"),
  e("⚖️", "balance scale", ["justice"], "objects"),
  e("🪜", "ladder", ["ladder"], "objects"),
  e("🧰", "toolbox", ["tools"], "objects"),
  e("🪛", "screwdriver", ["tool"], "objects"),
  e("🔧", "wrench", ["tool"], "objects"),
  e("🔨", "hammer", ["tool"], "objects"),
  e("⚒️", "hammer and pick", ["tools"], "objects"),
  e("🛠️", "hammer and wrench", ["tools"], "objects"),
  e("⛏️", "pick", ["tool"], "objects"),
  e("🪚", "carpentry saw", ["tool"], "objects"),
  e("🔩", "nut and bolt", ["tool"], "objects"),
  e("⚙️", "gear", ["settings"], "objects"),
  e("🪤", "mouse trap", ["trap"], "objects"),
  e("⛓️", "chains", ["chain"], "objects"),
  e("🧲", "magnet", ["magnet"], "objects"),
  e("💣", "bomb", ["explosion"], "objects"),
  e("🧨", "firecracker", ["explosion"], "objects"),
  e("🪓", "axe", ["tool"], "objects"),
  e("🔪", "kitchen knife", ["knife"], "objects"),
  e("🗡️", "dagger", ["knife"], "objects"),
  e("⚔️", "crossed swords", ["swords"], "objects"),
  e("🛡️", "shield", ["shield"], "objects"),
  e("🚬", "cigarette", ["smoke"], "objects"),
  e("⚰️", "coffin", ["death"], "objects"),
  e("🪦", "headstone", ["grave"], "objects"),
  e("⚱️", "funeral urn", ["urn"], "objects"),
  e("🏺", "amphora", ["vase"], "objects"),
  e("📿", "prayer beads", ["beads"], "objects"),
  e("🧿", "nazar amulet", ["amulet"], "objects"),
  e("💈", "barber pole", ["barber"], "objects"),
  e("⚗️", "alembic", ["chemistry"], "objects"),
  e("🔭", "telescope", ["stars"], "objects"),
  e("🔬", "microscope", ["science"], "objects"),
  e("🩹", "adhesive bandage", ["bandage"], "objects"),
  e("🩺", "stethoscope", ["doctor"], "objects"),
  e("💊", "pill", ["medicine"], "objects"),
  e("💉", "syringe", ["shot"], "objects"),
  e("🩸", "drop of blood", ["blood"], "objects"),
  e("🧬", "dna", ["biology"], "objects"),
  e("🧫", "petri dish", ["science"], "objects"),
  e("🧪", "test tube", ["science"], "objects"),
  e("🌡️", "thermometer", ["temperature"], "objects"),
  e("🧹", "broom", ["sweep"], "objects"),
  e("🧺", "basket", ["laundry"], "objects"),
  e("🧻", "roll of paper", ["toilet"], "objects"),
  e("🚽", "toilet", ["bathroom"], "objects"),
  e("🚰", "potable water", ["water"], "objects"),
  e("🚿", "shower", ["bath"], "objects"),
  e("🛁", "bathtub", ["bath"], "objects"),
  e("🛀", "person taking bath", ["bath"], "objects"),
  e("🧼", "soap", ["clean"], "objects"),
  e("🪒", "razor", ["shave"], "objects"),
  e("🧽", "sponge", ["clean"], "objects"),
  e("🧴", "lotion bottle", ["lotion"], "objects"),
  e("🗝️", "old key", ["key"], "objects"),
  e("🚪", "door", ["door"], "objects"),
  e("🪑", "chair", ["chair"], "objects"),
  e("🛋️", "couch and lamp", ["sofa"], "objects"),
  e("🛏️", "bed", ["bed"], "objects"),
  e("🛌", "person in bed", ["sleep"], "objects"),
  e("🧸", "teddy bear", ["toy"], "objects"),
  e("🛍️", "shopping bags", ["shopping"], "objects"),
  e("🎁", "wrapped gift", ["gift", "present"], "objects"),
  e("🎈", "balloon", ["party"], "objects"),
  e("🎏", "carp streamer", ["flag"], "objects"),
  e("🎀", "ribbon", ["bow"], "objects"),
  e("🎊", "confetti ball", ["party"], "objects"),
  e("🎉", "party popper", ["party", "celebrate"], "objects"),
  e("📮", "postbox", ["mail"], "objects"),
  e("📭", "open mailbox empty", ["mail"], "objects"),
  e("📬", "open mailbox raised", ["mail"], "objects"),
  e("📧", "email", ["mail"], "objects"),
  e("📩", "envelope with arrow", ["mail"], "objects"),
  e("📨", "incoming envelope", ["mail"], "objects"),
  e("📯", "postal horn", ["mail"], "objects"),
  e("📜", "scroll", ["paper"], "objects"),
  e("📃", "page with curl", ["paper"], "objects"),
  e("📄", "page facing up", ["paper"], "objects"),
  e("📑", "bookmark tabs", ["paper"], "objects"),
  e("🧾", "receipt", ["paper"], "objects"),
  e("📊", "bar chart", ["chart"], "objects"),
  e("📈", "chart increasing", ["chart"], "objects"),
  e("📉", "chart decreasing", ["chart"], "objects"),
  e("📋", "clipboard", ["paper"], "objects"),
  e("📌", "pushpin", ["pin"], "objects"),
  e("📍", "round pushpin", ["pin"], "objects"),
  e("📎", "paperclip", ["clip"], "objects"),
  e("🖇️", "linked paperclips", ["clip"], "objects"),
  e("📏", "straight ruler", ["ruler"], "objects"),
  e("📐", "triangular ruler", ["ruler"], "objects"),
  e("✂️", "scissors", ["cut"], "objects"),
  e("🗃️", "card file box", ["box"], "objects"),
  e("🗄️", "file cabinet", ["cabinet"], "objects"),
  e("🗑️", "wastebasket", ["trash"], "objects"),
  e("🔒", "locked", ["lock"], "objects"),
  e("🔓", "unlocked", ["lock"], "objects"),
  e("🔏", "locked with pen", ["lock"], "objects"),
  e("🔐", "locked with key", ["lock"], "objects"),

  // ---- Symbols ----
  e("❤️", "red heart", ["love", "heart"], "symbols"),
  e("🧡", "orange heart", ["love", "heart"], "symbols"),
  e("💛", "yellow heart", ["love", "heart"], "symbols"),
  e("💚", "green heart", ["love", "heart"], "symbols"),
  e("💙", "blue heart", ["love", "heart"], "symbols"),
  e("💜", "purple heart", ["love", "heart"], "symbols"),
  e("🤎", "brown heart", ["love", "heart"], "symbols"),
  e("🖤", "black heart", ["love", "heart"], "symbols"),
  e("🤍", "white heart", ["love", "heart"], "symbols"),
  e("❤️\u200d🔥", "heart on fire", ["love", "fire"], "symbols"),
  e("❤️\u200d🩹", "mending heart", ["love", "heal"], "symbols"),
  e("💔", "broken heart", ["sad", "heartbreak"], "symbols"),
  e("❣️", "heart exclamation", ["love"], "symbols"),
  e("💕", "two hearts", ["love"], "symbols"),
  e("💞", "revolving hearts", ["love"], "symbols"),
  e("💓", "beating heart", ["love"], "symbols"),
  e("💗", "growing heart", ["love"], "symbols"),
  e("💖", "sparkling heart", ["love"], "symbols"),
  e("💘", "heart with arrow", ["love", "cupid"], "symbols"),
  e("💝", "heart with ribbon", ["love", "gift"], "symbols"),
  e("💟", "heart decoration", ["love"], "symbols"),
  e("♥️", "heart suit", ["love", "card"], "symbols"),
  e("💤", "zzz", ["sleep"], "symbols"),
  e("💢", "anger symbol", ["angry"], "symbols"),
  e("💥", "collision", ["boom", "explosion"], "symbols"),
  e("💫", "dizzy", ["star"], "symbols"),
  e("💦", "sweat droplets", ["water"], "symbols"),
  e("💨", "dashing away", ["wind", "fast"], "symbols"),
  e("🌀", "cyclone", ["spin", "swirl"], "symbols"),
  e("🌟", "glowing star", ["star"], "symbols"),
  e("⭐", "star", ["star"], "symbols"),
  e("✨", "sparkles", ["shine"], "symbols"),
  e("⚡", "high voltage", ["lightning", "energy"], "symbols"),
  e("☄️", "comet", ["space"], "symbols"),
  e("🔥", "fire", ["hot", "flame"], "symbols"),
  e("🌪️", "tornado", ["storm"], "symbols"),
  e("🌈", "rainbow", ["rainbow", "colors"], "symbols"),
  e("☀️", "sun", ["sun", "weather"], "symbols"),
  e("⛅", "sun behind cloud", ["weather"], "symbols"),
  e("☁️", "cloud", ["weather"], "symbols"),
  e("🌧️", "cloud with rain", ["rain"], "symbols"),
  e("⛈️", "cloud with lightning and rain", ["storm"], "symbols"),
  e("🌩️", "cloud with lightning", ["storm"], "symbols"),
  e("🌨️", "cloud with snow", ["snow"], "symbols"),
  e("❄️", "snowflake", ["cold", "snow"], "symbols"),
  e("☃️", "snowman", ["snow"], "symbols"),
  e("⛄", "snowman without snow", ["snow"], "symbols"),
  e("🌬️", "wind face", ["wind"], "symbols"),
  e("💧", "droplet", ["water"], "symbols"),
  e("🌊", "water wave", ["wave", "ocean"], "symbols"),
  e("✅", "check mark button", ["ok", "yes"], "symbols"),
  e("☑️", "check box with check", ["check"], "symbols"),
  e("✔️", "check mark", ["check"], "symbols"),
  e("❌", "cross mark", ["no", "x"], "symbols"),
  e("❎", "cross mark button", ["no"], "symbols"),
  e("➕", "plus", ["add", "math"], "symbols"),
  e("➖", "minus", ["subtract", "math"], "symbols"),
  e("➗", "divide", ["math"], "symbols"),
  e("✖️", "multiply", ["math"], "symbols"),
  e("🟰", "heavy equals", ["math"], "symbols"),
  e("∞", "infinity", ["math"], "symbols"),
  e("‼️", "double exclamation", ["bang"], "symbols"),
  e("⁉️", "exclamation question", ["what"], "symbols"),
  e("❓", "question mark", ["what"], "symbols"),
  e("❔", "white question", ["what"], "symbols"),
  e("❕", "white exclamation", ["bang"], "symbols"),
  e("❗", "exclamation mark", ["bang"], "symbols"),
  e("〰️", "wavy dash", ["wave"], "symbols"),
  e("💱", "currency exchange", ["money"], "symbols"),
  e("💲", "heavy dollar sign", ["money"], "symbols"),
  e("♻️", "recycling symbol", ["recycle"], "symbols"),
  e("⚜️", "fleur-de-lis", ["symbol"], "symbols"),
  e("🔱", "trident emblem", ["trident"], "symbols"),
  e("📛", "name badge", ["name"], "symbols"),
  e("🔰", "Japanese symbol for beginner", ["beginner"], "symbols"),
  e("⭕", "hollow red circle", ["ok"], "symbols"),
  e("🔴", "red circle", ["red"], "symbols"),
  e("🟠", "orange circle", ["orange"], "symbols"),
  e("🟡", "yellow circle", ["yellow"], "symbols"),
  e("🟢", "green circle", ["green"], "symbols"),
  e("🔵", "blue circle", ["blue"], "symbols"),
  e("🟣", "purple circle", ["purple"], "symbols"),
  e("🟤", "brown circle", ["brown"], "symbols"),
  e("⚫", "black circle", ["black"], "symbols"),
  e("⚪", "white circle", ["white"], "symbols"),
  e("🟥", "red square", ["red"], "symbols"),
  e("🟧", "orange square", ["orange"], "symbols"),
  e("🟨", "yellow square", ["yellow"], "symbols"),
  e("🟩", "green square", ["green"], "symbols"),
  e("🟦", "blue square", ["blue"], "symbols"),
  e("🟪", "purple square", ["purple"], "symbols"),
  e("🟫", "brown square", ["brown"], "symbols"),
  e("⬛", "black large square", ["black"], "symbols"),
  e("⬜", "white large square", ["white"], "symbols"),
  e("◼️", "black medium square", ["black"], "symbols"),
  e("◻️", "white medium square", ["white"], "symbols"),
  e("🔶", "large orange diamond", ["diamond"], "symbols"),
  e("🔷", "large blue diamond", ["diamond"], "symbols"),
  e("🔸", "small orange diamond", ["diamond"], "symbols"),
  e("🔹", "small blue diamond", ["diamond"], "symbols"),
  e("🔺", "red triangle pointed up", ["triangle"], "symbols"),
  e("🔻", "red triangle pointed down", ["triangle"], "symbols"),
  e("💠", "diamond with a dot", ["diamond"], "symbols"),
  e("🔘", "radio button", ["radio"], "symbols"),
  e("🔳", "white square button", ["button"], "symbols"),
  e("🔲", "black square button", ["button"], "symbols"),
  e("🚫", "prohibited", ["no", "ban"], "symbols"),
  e("🆗", "OK button", ["ok"], "symbols"),
  e("🆒", "COOL button", ["cool"], "symbols"),
  e("🆕", "NEW button", ["new"], "symbols"),
  e("🆓", "FREE button", ["free"], "symbols"),
  e("🔝", "TOP button", ["top"], "symbols"),
  e("🔜", "SOON button", ["soon"], "symbols"),
  e("🔚", "END button", ["end"], "symbols"),
  e("🔙", "BACK button", ["back"], "symbols"),
  e("ℹ️", "information", ["info"], "symbols"),
  e("🔤", "input latin letters", ["abc"], "symbols"),
  e("🔡", "input latin lowercase", ["abc"], "symbols"),
  e("🔠", "input latin uppercase", ["abc"], "symbols"),
  e("🆎", "AB button", ["blood"], "symbols"),
  e("🆑", "CL button", ["cl"], "symbols"),
  e("🅾️", "O button", ["o"], "symbols"),
  e("🅰️", "A button", ["a"], "symbols"),
  e("🆘", "SOS button", ["help"], "symbols"),
  e("⛔", "no entry", ["stop"], "symbols"),
  e("🚷", "no pedestrians", ["no"], "symbols"),
  e("🚭", "no smoking", ["no"], "symbols"),
  e("🔞", "no one under eighteen", ["18"], "symbols"),
  e("📵", "no mobile phones", ["no"], "symbols"),
  e("🚯", "no littering", ["no"], "symbols"),
  e("🚳", "no bicycles", ["no"], "symbols"),
  e("🚱", "non-potable water", ["no"], "symbols"),
  e("⚠️", "warning", ["warn"], "symbols"),
  e("🚸", "children crossing", ["children"], "symbols"),
  e("Ⓜ️", "circled M", ["m"], "symbols"),
  e("🅿️", "P button", ["parking"], "symbols"),
  e("🈳", "vacancy", ["vacant"], "symbols"),
  e("🈵", "fullness", ["full"], "symbols"),
  e("🈶", "not free of charge", ["paid"], "symbols"),
  e("🈚", "free of charge", ["free"], "symbols"),
  e("🈸", "application", ["apply"], "symbols"),
  e("🈺", "open for business", ["open"], "symbols"),
  e("🈹", "discount", ["sale"], "symbols"),
  e("♋", "Cancer", ["zodiac"], "symbols"),
  e("♌", "Leo", ["zodiac"], "symbols"),
  e("♍", "Virgo", ["zodiac"], "symbols"),
  e("♎", "Libra", ["zodiac"], "symbols"),
  e("♏", "Scorpius", ["zodiac"], "symbols"),
  e("♐", "Sagittarius", ["zodiac"], "symbols"),
  e("♑", "Capricorn", ["zodiac"], "symbols"),
  e("♒", "Aquarius", ["zodiac"], "symbols"),
  e("♓", "Pisces", ["zodiac"], "symbols"),
  e("♈", "Aries", ["zodiac"], "symbols"),
  e("♉", "Taurus", ["zodiac"], "symbols"),
  e("♊", "Gemini", ["zodiac"], "symbols"),
  e("⛎", "Ophiuchus", ["zodiac"], "symbols"),

  // ---- Flags ----
  e("🏳️", "white flag", ["flag", "surrender"], "flags"),
  e("🏴", "black flag", ["flag"], "flags"),
  e("🏁", "chequered flag", ["flag", "race"], "flags"),
  e("🚩", "triangular flag", ["flag"], "flags"),
  e("🏳️\u200d🌈", "rainbow flag", ["pride", "rainbow"], "flags"),
  e("🏴\u200d☠️", "pirate flag", ["pirate", "skull"], "flags"),
  e("🏳️\u200d⚧️", "transgender flag", ["trans", "pride"], "flags"),
  e("🇺🇸", "United States", ["usa", "america"], "flags"),
  e("🇬🇧", "United Kingdom", ["uk", "britain"], "flags"),
  e("🇨🇦", "Canada", ["canada"], "flags"),
  e("🇲🇽", "Mexico", ["mexico"], "flags"),
  e("🇧🇷", "Brazil", ["brazil"], "flags"),
  e("🇦🇷", "Argentina", ["argentina"], "flags"),
  e("🇨🇱", "Chile", ["chile"], "flags"),
  e("🇨🇴", "Colombia", ["colombia"], "flags"),
  e("🇵🇪", "Peru", ["peru"], "flags"),
  e("🇻🇪", "Venezuela", ["venezuela"], "flags"),
  e("🇩🇪", "Germany", ["germany"], "flags"),
  e("🇫🇷", "France", ["france"], "flags"),
  e("🇮🇹", "Italy", ["italy"], "flags"),
  e("🇪🇸", "Spain", ["spain"], "flags"),
  e("🇵🇹", "Portugal", ["portugal"], "flags"),
  e("🇳🇱", "Netherlands", ["netherlands"], "flags"),
  e("🇧🇪", "Belgium", ["belgium"], "flags"),
  e("🇨🇭", "Switzerland", ["swiss"], "flags"),
  e("🇦🇹", "Austria", ["austria"], "flags"),
  e("🇸🇪", "Sweden", ["sweden"], "flags"),
  e("🇳🇴", "Norway", ["norway"], "flags"),
  e("🇩🇰", "Denmark", ["denmark"], "flags"),
  e("🇫🇮", "Finland", ["finland"], "flags"),
  e("🇮🇸", "Iceland", ["iceland"], "flags"),
  e("🇮🇪", "Ireland", ["ireland"], "flags"),
  e("🇵🇱", "Poland", ["poland"], "flags"),
  e("🇨🇿", "Czechia", ["czech"], "flags"),
  e("🇭🇺", "Hungary", ["hungary"], "flags"),
  e("🇬🇷", "Greece", ["greece"], "flags"),
  e("🇹🇷", "Turkey", ["turkey"], "flags"),
  e("🇷🇺", "Russia", ["russia"], "flags"),
  e("🇺🇦", "Ukraine", ["ukraine"], "flags"),
  e("🇮🇱", "Israel", ["israel"], "flags"),
  e("🇸🇦", "Saudi Arabia", ["saudi"], "flags"),
  e("🇦🇪", "United Arab Emirates", ["uae"], "flags"),
  e("🇪🇬", "Egypt", ["egypt"], "flags"),
  e("🇿🇦", "South Africa", ["south africa"], "flags"),
  e("🇳🇬", "Nigeria", ["nigeria"], "flags"),
  e("🇰🇪", "Kenya", ["kenya"], "flags"),
  e("🇮🇳", "India", ["india"], "flags"),
  e("🇵🇰", "Pakistan", ["pakistan"], "flags"),
  e("🇧🇩", "Bangladesh", ["bangladesh"], "flags"),
  e("🇱🇰", "Sri Lanka", ["sri lanka"], "flags"),
  e("🇨🇳", "China", ["china"], "flags"),
  e("🇯🇵", "Japan", ["japan"], "flags"),
  e("🇰🇷", "South Korea", ["korea"], "flags"),
  e("🇰🇵", "North Korea", ["korea"], "flags"),
  e("🇹🇼", "Taiwan", ["taiwan"], "flags"),
  e("🇭🇰", "Hong Kong", ["hong kong"], "flags"),
  e("🇸🇬", "Singapore", ["singapore"], "flags"),
  e("🇲🇾", "Malaysia", ["malaysia"], "flags"),
  e("🇹🇭", "Thailand", ["thailand"], "flags"),
  e("🇻🇳", "Vietnam", ["vietnam"], "flags"),
  e("🇵🇭", "Philippines", ["philippines"], "flags"),
  e("🇮🇩", "Indonesia", ["indonesia"], "flags"),
  e("🇦🇺", "Australia", ["australia"], "flags"),
  e("🇳🇿", "New Zealand", ["new zealand"], "flags"),
];

// ---- Top 100 frequently used emoji presets (chars only) ----

export const TOP_EMOJIS: string[] = [
  "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😉",
  "😊", "😇", "🥰", "😍", "🤩", "😘", "😋", "😛", "😜", "🤪",
  "🤔", "🤨", "😐", "😑", "😶", "🙄", "😏", "😒", "😞", "😔",
  "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢",
  "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱",
  "😨", "😰", "😥", "😓", "🤗", "🤫", "🤭", "🤓", "🧐", "🥱",
  "😺", "😸", "😻", "😼", "😽", "🙀", "😿", "😾", "👍", "👎",
  "👏", "🙌", "🙏", "👋", "🤙", "💪", "🤝", "✌️", "🤞", "🤟",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "❣️",
  "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💯", "🔥", "✨",
];

// ---- ZWJ combinations (known compound sequences) ----

export const ZWJ_COMBINATIONS: ZwjCombo[] = [
  { name: "heart on fire", components: ["❤️", "🔥"], result: "❤️\u200d🔥" },
  { name: "mending heart", components: ["❤️", "🩹"], result: "❤️\u200d🩹" },
  { name: "couple with heart (M-W)", components: ["👨", "❤️", "👩"], result: "👨\u200d❤️\u200d👩" },
  { name: "couple with heart (M-M)", components: ["👨", "❤️", "👨"], result: "👨\u200d❤️\u200d👨" },
  { name: "couple with heart (W-W)", components: ["👩", "❤️", "👩"], result: "👩\u200d❤️\u200d👩" },
  { name: "kiss (M-W)", components: ["👨", "❤️", "💋", "👩"], result: "👨\u200d❤️\u200d💋\u200d👩" },
  { name: "family (M-W-B)", components: ["👨", "👩", "👦"], result: "👨\u200d👩\u200d👦" },
  { name: "family (M-M-G)", components: ["👨", "👨", "👧"], result: "👨\u200d👨\u200d👧" },
  { name: "family (W-W-B)", components: ["👩", "👩", "👦"], result: "👩\u200d👩\u200d👦" },
  { name: "rainbow flag", components: ["🏳️", "🌈"], result: "🏳️\u200d🌈" },
  { name: "pirate flag", components: ["🏴", "☠️"], result: "🏴\u200d☠️" },
  { name: "polar bear", components: ["🐻", "❄️"], result: "🐻\u200d❄️" },
  { name: "service dog", components: ["🐕", "🦺"], result: "🐕\u200d🦺" },
  { name: "eye in speech bubble", components: ["👁️", "🗨️"], result: "👁️\u200d🗨️" },
  { name: "face exhaling", components: ["😮", "💨"], result: "😮\u200d💨" },
  { name: "transgender flag", components: ["🏳️", "⚧️"], result: "🏳️\u200d⚧️" },
  { name: "black flag on pole", components: ["🏴", "🚩"], result: "🏴\u200d🚩" },
];

// ---- Helpers ----

/** Normalize a search query. */
export function normalizeQuery(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Search emojis by name or keyword (case-insensitive, partial match). */
export function searchEmojis(
  query: string,
  opts?: { category?: EmojiCategory | ""; limit?: number },
): EmojiEntry[] {
  const q = normalizeQuery(query);
  let list = EMOJI_DB;
  if (opts?.category) list = list.filter((em) => em.category === opts.category);
  if (!q) return opts?.limit ? list.slice(0, opts.limit) : list;
  const results = list.filter((em) => {
    if (em.name.toLowerCase().includes(q)) return true;
    return em.keywords.some((k) => k.toLowerCase().includes(q));
  });
  return opts?.limit ? results.slice(0, opts.limit) : results;
}

/** Filter emojis by category. */
export function filterByCategory(category: EmojiCategory): EmojiEntry[] {
  return EMOJI_DB.filter((em) => em.category === category);
}

/** Apply a skin tone modifier to an emoji (if supported). */
export function applySkinTone(entry: EmojiEntry, tone: SkinTone): string {
  if (tone === "none" || !entry.skinToneSupport) return entry.char;
  const modifier = SKIN_TONE_MODIFIERS[tone];
  // For single-codepoint emojis, just append the modifier.
  // For ZWJ sequences with skin tone support, append after first codepoint.
  if (entry.char.includes("\u200d")) {
    const parts = entry.char.split("\u200d");
    parts[0] = parts[0] + modifier;
    return parts.join("\u200d");
  }
  return entry.char + modifier;
}

/** Find all skin tone variations of an emoji (returns base + 5 modified chars). */
export function findVariations(entry: EmojiEntry): string[] {
  if (!entry.skinToneSupport) return [entry.char];
  const tones: Exclude<SkinTone, "none">[] = [
    "light",
    "medium-light",
    "medium",
    "medium-dark",
    "dark",
  ];
  return [entry.char, ...tones.map((t) => applySkinTone(entry, t))];
}

/** Find related emojis (sharing any keyword, excluding self). */
export function findRelated(entry: EmojiEntry, limit = 10): EmojiEntry[] {
  const kw = new Set(entry.keywords.map((k) => k.toLowerCase()));
  return EMOJI_DB.filter(
    (em) =>
      em.char !== entry.char &&
      em.keywords.some((k) => kw.has(k.toLowerCase())),
  ).slice(0, limit);
}

/** Group a list of emojis by category. */
export function groupByCategory(
  entries: EmojiEntry[],
): Record<EmojiCategory, EmojiEntry[]> {
  const out: Record<EmojiCategory, EmojiEntry[]> = {
    smileys: [],
    gestures: [],
    animals: [],
    food: [],
    activities: [],
    travel: [],
    objects: [],
    symbols: [],
    flags: [],
  };
  for (const em of entries) {
    out[em.category].push(em);
  }
  return out;
}

/** Count emojis per category. */
export function countByCategory(
  entries: EmojiEntry[],
): Record<EmojiCategory, number> {
  const grouped = groupByCategory(entries);
  const out: Record<EmojiCategory, number> = {
    smileys: 0,
    gestures: 0,
    animals: 0,
    food: 0,
    activities: 0,
    travel: 0,
    objects: 0,
    symbols: 0,
    flags: 0,
  };
  for (const c of CATEGORIES) out[c] = grouped[c].length;
  return out;
}

/** Compute summary stats. */
export function computeStats(entries: EmojiEntry[]): EmojiStats {
  return {
    total: entries.length,
    byCategory: countByCategory(entries),
  };
}

/** Format an emoji for display: "😀 grinning face". */
export function formatEmoji(entry: EmojiEntry): string {
  return `${entry.char} ${entry.name}`;
}

/** Render a list of emojis as text (one per line). */
export function renderText(entries: EmojiEntry[]): string {
  return entries.map(formatEmoji).join("\n");
}

/** Render a list of emojis as CSV. */
export function renderCsv(entries: EmojiEntry[]): string {
  const lines = ["char,name,category,keywords,skin_tone_support"];
  for (const em of entries) {
    lines.push([
      escapeCsv(em.char),
      escapeCsv(em.name),
      em.category,
      escapeCsv(em.keywords.join(" ")),
      em.skinToneSupport ? "yes" : "no",
    ].join(","));
  }
  return lines.join("\n");
}

/** Split a CSV row, respecting quoted values. */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(current); current = "";
    } else { current += ch; }
  }
  out.push(current);
  return out;
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Pure helper for clipboard: returns the input string (UI performs actual copy). */
export function copyText(s: string): string {
  return s;
}

/** Find ZWJ combinations whose components are all in the supplied emoji list. */
export function findCombinations(emojiChars: string[]): ZwjCombo[] {
  if (!emojiChars.length) return [];
  const set = new Set(emojiChars);
  return ZWJ_COMBINATIONS.filter((c) =>
    c.components.every((cp) => set.has(cp)),
  );
}

/** Find an emoji entry by its character. */
export function findByChar(char: string): EmojiEntry | undefined {
  return EMOJI_DB.find((em) => em.char === char);
}

// ---- Recently used (localStorage, max 50) ----

const RECENT_KEY = "unqtools:emoji-picker:recent";
const RECENT_MAX = 50;

export function loadRecent(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? arr.slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function saveRecent(char: string): string[] {
  const prev = loadRecent().filter((c) => c !== char);
  const next = [char, ...prev].slice(0, RECENT_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearRecent(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // ignore
  }
}

// ---- History (localStorage, max 20 — recently copied emojis) ----

const HISTORY_KEY = "unqtools:emoji-picker:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  char: string;
  name: string;
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
  query: string,
  category: EmojiCategory | "",
  tone: SkinTone,
): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category) params.set("cat", category);
  if (tone !== "none") params.set("tone", tone);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(
  hash: string,
): { query: string; category: EmojiCategory | ""; tone: SkinTone } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { query: "", category: "", tone: "none" };
  const params = new URLSearchParams(clean);
  const query = params.get("q") ?? "";
  const catStr = params.get("cat") ?? "";
  const toneStr = params.get("tone") ?? "none";
  const validCats = CATEGORIES as readonly string[];
  const category: EmojiCategory | "" =
    catStr && validCats.includes(catStr) ? (catStr as EmojiCategory) : "";
  const validTones = SKIN_TONES as readonly string[];
  const tone: SkinTone = validTones.includes(toneStr) ? (toneStr as SkinTone) : "none";
  return { query, category, tone };
}
