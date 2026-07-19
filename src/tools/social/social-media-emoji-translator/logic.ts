/**
 * Social Media Emoji Translator — pure logic.
 *
 * Translate text to emojis and back. Built-in 1000+ word dictionary,
 * 50+ phrase mappings, 10+ emoji-art templates, ZWJ combinations.
 * Pure functions only — no DOM, no network.
 */

// ---- Types ----

export type TranslationMode =
  | "text-to-emoji"
  | "emoji-to-text"
  | "emoji-art"
  | "mixed";

export type EmojiDensity =
  | "sparse"
  | "medium"
  | "dense"
  | "ultra-dense";

export type EmojiTone =
  | "happy"
  | "sad"
  | "excited"
  | "angry"
  | "love"
  | "neutral";

export type EmojiCategory =
  | "smileys"
  | "gestures"
  | "animals"
  | "food"
  | "activities"
  | "travel"
  | "objects"
  | "symbols"
  | "nature"
  | "other";

export interface TranslationStats {
  totalWords: number;
  totalEmojis: number;
  coveragePct: number;
  avgEmojisPerWord: number;
}

export interface CoverageReport {
  covered: string[];
  uncovered: string[];
  coveragePct: number;
}

export interface WordSuggestion {
  word: string;
  emoji: string | null;
  alternatives: string[];
}

export interface TranslationResult {
  mode: TranslationMode;
  output: string;
  original: string | null;
  stats: TranslationStats;
  coverage: CoverageReport;
  tone: EmojiTone;
  categoryCounts: Record<EmojiCategory, number>;
  suggestions: WordSuggestion[];
}

export interface HistoryEntry {
  ts: number;
  mode: TranslationMode;
  density: EmojiDensity;
  inputPreview: string;
  outputPreview: string;
}

export interface ZwjCombo {
  name: string;
  components: string[];
  result: string;
}

// ---- Constants ----

export const TRANSLATION_MODES: TranslationMode[] = [
  "text-to-emoji",
  "emoji-to-text",
  "emoji-art",
  "mixed",
];

export const MODE_LABELS: Record<TranslationMode, string> = {
  "text-to-emoji": "Text → Emoji",
  "emoji-to-text": "Emoji → Text",
  "emoji-art": "Emoji Art",
  "mixed": "Mixed (text + emoji)",
};

export const DENSITY_OPTIONS: EmojiDensity[] = [
  "sparse",
  "medium",
  "dense",
  "ultra-dense",
];

export const DENSITY_LABELS: Record<EmojiDensity, string> = {
  "sparse": "Sparse (1 per sentence)",
  "medium": "Medium (1 per phrase)",
  "dense": "Dense (1 per word)",
  "ultra-dense": "Ultra-dense (multiple per word)",
};

export const TONE_LABELS: Record<EmojiTone, string> = {
  happy: "Happy 😊",
  sad: "Sad 😢",
  excited: "Excited 🤩",
  angry: "Angry 😡",
  love: "Loving 😍",
  neutral: "Neutral 😐",
};

export const CATEGORY_LABELS: Record<EmojiCategory, string> = {
  smileys: "Smileys & Faces",
  gestures: "Gestures & People",
  animals: "Animals",
  food: "Food & Drink",
  activities: "Activities",
  travel: "Travel & Places",
  objects: "Objects",
  symbols: "Symbols",
  nature: "Nature & Weather",
  other: "Other",
};

// ---- Word-to-Emoji dictionary (1000+ entries) ----

export const WORD_EMOJI_DICT: Record<string, string> = {
  // Smileys & emotions (~70)
  happy: "😊", joy: "😄", joyful: "😄", smile: "😊", smiling: "😊",
  laugh: "😂", laughing: "😂", lol: "😂", haha: "😂", lmao: "🤣",
  grin: "😁", grinning: "😁", smirk: "😏", wink: "😉", winking: "😉",
  sad: "😢", sadness: "😢", unhappy: "😟", cry: "😭", crying: "😭",
  tears: "😭", tear: "💧", sob: "😭", disappointed: "😞",
  angry: "😡", anger: "😡", mad: "😠", furious: "🤬", rage: "🤬",
  love: "❤️", loved: "❤️", loving: "😍", adore: "🥰", adoration: "🥰",
  heart: "❤️", hearts: "💖", hearted: "💕", crush: "😍",
  excited: "🤩", thrilled: "🤩", yay: "🎉", woohoo: "🥳",
  cool: "😎", awesome: "😎", rad: "😎", chill: "😌",
  shocked: "😱", shock: "😱", surprise: "😲", surprised: "😲", wow: "😮",
  confused: "😕", puzzled: "🤔", thinking: "🤔", wonder: "🤔",
  sleepy: "😴", sleep: "😴", sleeping: "😴", tired: "🥱", yawn: "🥱",
  sick: "🤒", ill: "🤒", dizzy: "💫", nauseous: "🤢", vomit: "🤮",
  kiss: "💋", kissing: "😘", smooch: "😘", mwah: "💋",
  hug: "🤗", hugs: "🤗", cuddle: "🤗",
  wave: "👋", waving: "👋", hi: "👋", hello: "👋", bye: "👋", goodbye: "👋",
  ok: "👌", okay: "👌", yes: "✅", no: "❌", maybe: "🤷",
  please: "🙏", thanks: "🙏", thank: "🙏", sorry: "😔",
  clap: "👏", clapping: "👏", applause: "👏", bravo: "👏",
  thumbsup: "👍", thumbs_up: "👍", like: "👍", approve: "👍",
  thumbsdown: "👎", thumbs_down: "👎", dislike: "👎", disapprove: "👎",
  peace: "✌️", victory: "✌️", win: "🏆",
 muscle: "💪", strong: "💪", powerful: "💪",
  // People & body (~70)
  person: "🧑", people: "👥", human: "🧑", man: "👨", men: "👨",
  woman: "👩", women: "👩", boy: "👦", girl: "👧", child: "🧒",
  children: "👧", baby: "👶", kid: "🧒", infant: "👶",
  family: "👪", parents: "👨‍👩‍👦", mother: "👩", mom: "👩", mum: "👩",
  father: "👨", dad: "👨", parent: "🧑", sibling: "🧑", brother: "👨",
  sister: "👩", friend: "🧑‍🤝‍🧑", friends: "🧑‍🤝‍🧑", buddy: "🤝",
  teacher: "👩‍🏫", student: "🧑‍🎓", doctor: "👨‍⚕️", nurse: "👩‍⚕️",
  king: "🤴", queen: "👸", prince: "🤴", princess: "👸",
  superhero: "🦸", villain: "🦹", ghost: "👻", zombie: "🧟", alien: "👽",
  robot: "🤖", clown: "🤡", fairy: "🧚", wizard: "🧙", witch: "🧙‍♀️",
  bride: "👰", groom: "🤵", graduate: "🧑‍🎓", farmer: "🧑‍🌾",
  chef: "🧑‍🍳", cook: "🧑‍🍳", singer: "🧑‍🎤", artist: "🧑‍🎨",
  pilot: "🧑‍✈️", astronaut: "🧑‍🚀", scientist: "🧑‍🔬", engineer: "🧑‍🔧",
  eye: "👁️", eyes: "👀", ear: "👂", nose: "👃", mouth: "👄",
  lip: "👄", lips: "👄", tongue: "👅", tooth: "🦷", teeth: "🦷",
  hand: "✋", hands: "🙌", finger: "👆", thumb: "👍", fist: "✊",
  arm: "💪", leg: "🦵", foot: "🦶", feet: "👣", brain: "🧠",
  heart_organ: "🫀", lungs: "🫁", bone: "🦴", skin: "🤚", hair: "💇",
  face: "😀", head: "🗣️", body: "🧍", shoulder: "🤷",
  // Animals (~80)
  animal: "🐾", animals: "🐾", cat: "🐱", cats: "🐱", kitten: "🐈",
  dog: "🐶", dogs: "🐶", puppy: "🐕", wolf: "🐺", fox: "🦊",
  bear: "🐻", panda: "🐼", polar_bear: "🐻‍❄️", koala: "🐨",
  lion: "🦁", tiger: "🐯", tigers: "🐯", leopard: "🐆", cheetah: "🐆",
  cow: "🐮", cattle: "🐄", bull: "🐂", ox: "🐂", buffalo: "🐃",
  pig: "🐷", pigs: "🐷", piglet: "🐖", hog: "🐖",
  sheep: "🐑", lamb: "🐑", goat: "🐐", ram: "🐏",
  horse: "🐴", horses: "🐎", pony: "🐴", donkey: "🫏",
  chicken: "🐔", rooster: "🐓", hen: "🐔", chick: "🐤", duck: "🦆",
  goose: "🦢", swan: "🦢", bird: "🐦", birds: "🐦", eagle: "🦅",
  owl: "🦉", parrot: "🦜", peacock: "🦚", penguin: "🐧", dove: "🕊️",
  rabbit: "🐰", bunny: "🐇", hare: "🐇", mouse: "🐭", mice: "🐭",
  rat: "🐀", hamster: "🐹", squirrel: "🐿️", hedgehog: "🦔", bat: "🦇",
  fish: "🐟", fishes: "🐟", fishing: "🎣", tropical_fish: "🐠", blowfish: "🐡",
  shark: "🦈", octopus: "🐙", squid: "🦑", shrimp: "🦐", lobster: "🦞",
  crab: "🦀", dolphin: "🐬", whale: "🐳", whales: "🐋", orca: "🐳",
  seal: "🦭", turtle: "🐢", tortoise: "🐢", snake: "🐍", serpent: "🐍",
  lizard: "🦎", chameleon: "🦎", crocodile: "🐊", alligator: "🐊",
  frog: "🐸", toad: "🐸", snail: "🐌", bug: "🐛", insect: "🐛",
  ant: "🐜", bee: "🐝", honeybee: "🐝", wasp: "🐝", beetle: "🪲",
  butterfly: "🦋", moth: "🦋", spider: "🕷️", scorpion: "🦂", mosquito: "🦟",
  fly: "🪰", housefly: "🪰", worm: "🪱", microbe: "🦠", dinosaur: "🦖", trex: "🦖",
  sauropod: "🦕", dragon: "🐉", unicorn: "🦄", zebra: "🦓", giraffe: "🦒",
  elephant: "🐘", mammoth: "🦣", rhino: "🦏", hippo: "🦛", monkey: "🐵",
  monkey_face: "🐵", gorilla: "🦍", orangutan: "🦧", kangaroo: "🦘", camel: "🐫",
  llama: "🦙", alpaca: "🦙", deer: "🦌", moose: "🫎", turkey: "🦃",
  // Food & drink (~110)
  food: "🍴", meal: "🍽️", eat: "🍽️", eating: "🍽️", hungry: "😋",
  apple: "🍎", apples: "🍎", banana: "🍌", bananas: "🍌", orange: "🍊",
  orange_fruit: "🍊", tangerine: "🍊", lemon: "🍋", lime: "🍋", grapefruit: "🍊",
  grapes: "🍇", watermelon: "🍉", melon: "🍈", cantaloupe: "🍈",
  strawberry: "🍓", strawberries: "🍓", blueberry: "🫐", berries: "🫐",
  cherry: "🍒", cherries: "🍒", peach: "🍑", peach_fruit: "🍑", apricot: "🍑",
  pineapple: "🍍", mango: "🥭", coconut: "🥥", kiwi: "🥝", pear: "🍐",
  avocado: "🥑", tomato: "🍅", tomatoes: "🍅", eggplant: "🍆", cucumber: "🥒",
  pepper: "🌶️", chili: "🌶️", chili_pepper: "🌶️", pepper_fruit: "🫑",
  onion: "🧅", garlic: "🧄", mushroom: "🍄", mushroom_plant: "🍄", carrot: "🥕",
  potato: "🥔", sweet_potato: "🍠", corn: "🌽", maize: "🌽", broccoli: "🥦",
  lettuce: "🥬", cabbage: "🥬", leafy: "🥬", salad: "🥗", greens: "🥬",
  bread: "🍞", loaf: "🍞", bagel: "🥯", pretzel: "🥨", croissant: "🥐",
  baguette: "🥖", pancake: "🥞", waffle: "🧇", cheese: "🧀", cheesewheel: "🧀",
  egg: "🥚", eggs: "🥚", fried_egg: "🍳", omelet: "🍳", omelette: "🍳",
  bacon: "🥓", ham: "🍖", meat: "🍖", steak: "🥩", beef: "🥩",
  poultry: "🍗", chicken_meat: "🍗", turkey_meat: "🦃", drumstick: "🍖",
  hamburger: "🍔", burger: "🍔", cheeseburger: "🍔", fries: "🍟", french_fries: "🍟",
  pizza: "🍕", slice: "🍕", hotdog: "🌭", hot_dog: "🌭", sandwich: "🥪",
  taco: "🌮", tacos: "🌮", burrito: "🌯", wrap: "🌯", falafel: "🧆",
  kebab: "🥙", gyro: "🥙", stuffed: "🥙", rice: "🍚", rice_bowl: "🍚",
  curry: "🍛", ramen: "🍜", noodles: "🍜", noodle: "🍜", spaghetti: "🍝",
  pasta: "🍝", macaroni: "🍝", lasagna: "🍲", soup: "🍲", stew: "🍲",
  pot_food: "🥘", paella: "🥘", seafood: "🦞", sushi: "🍣", sashimi: "🍣",
  bento: "🍱", canned: "🥫", beans: "🫘", icecream: "🍦", ice_cream: "🍦",
  soft_serve: "🍦", sundae: "🍨", icecream_sundae: "🍨", donut: "🍩", doughnut: "🍩",
  cookie: "🍪", biscuit: "🍪", cookie_biscuit: "🍪", birthday_cake: "🎂", cake: "🎂",
  shortcake: "🍰", pie: "🥧", pumpkin_pie: "🥧", chocolate: "🍫", choc: "🍫",
  candy: "🍬", sweet: "🍬", sweets: "🍬", lollipop: "🍭", caramel: "🍮",
  custard: "🍮", pudding: "🍮", honey: "🍯", jam: "🍯", butter: "🧈",
  salt: "🧂", pepper_season: "🧂", seasoning: "🧂",
  coffee: "☕", espresso: "☕", latte: "☕", cappuccino: "☕", mocha: "☕",
  tea: "🍵", green_tea: "🍵", matcha: "🍵", drink: "🥤", beverage: "🥤",
  juice: "🧃", fruit_juice: "🧃", smoothie: "🥤", milk: "🥛", dairy: "🥛",
  baby_bottle: "🍼", formula: "🍼", beer: "🍺", ale: "🍺", lager: "🍺",
  beers: "🍻", cheers: "🍻", wine: "🍷", red_wine: "🍷", champagne: "🍾",
  bubbly: "🍾", cocktail: "🍸", martini: "🍸", margarita: "🍹", tropical_drink: "🍹",
  tiki: "🍹", whiskey: "🥃", scotch: "🥃", bourbon: "🥃", sake: "🍶",
  champagne_pop: "🍾", bottle: "🍾", glass: "🥃", cup: "☕",
  water: "💧", drop: "💧", droplet: "💧", thirst: "💧", thirsty: "🥤",
  // Activities & sports (~70)
  sports: "⚽", game: "🎮", games: "🎮", play: "🎮", playing: "🎮",
  soccer: "⚽", football: "🏈", futbol: "⚽", basketball: "🏀", bball: "🏀",
  baseball: "⚾", softball: "🥎", tennis: "🎾", racket: "🎾", volleyball: "🏐",
  bowling: "🎳", bowling_ball: "🎳", cricket: "🏏", hockey: "🏒", ice_hockey: "🏒",
  field_hockey: "🏑", lacrosse: "🥍", ping_pong: "🏓", table_tennis: "🏓", badminton: "🏸",
  boxing: "🥊", boxing_glove: "🥊", martial_arts: "🥋", karate: "🥋", judo: "🥋",
  golf: "⛳", golfer: "🏌️", frisbee: "🥏", archery: "🏹", bow_arrow: "🏹",
  fishing_activity: "🎣", rowing: "🚣", swimming: "🏊", swim: "🏊", diver: "🤿",
  surfing: "🏄", surf: "🏄", sailboat_race: "⛵", water_polo: "🤽", water_ski: "🤽",
  weightlifting: "🏋️", weights: "🏋️", gym: "🏋️", workout: "🏋️", exercise: "🤸",
  cycling: "🚴", bike: "🚴", bicycle: "🚲", mountain_bike: "🚵", bmx: "🚴",
  running: "🏃", run: "🏃", runner: "🏃", jog: "🏃", jogging: "🏃",
  walking: "🚶", walk: "🚶", hiking: "🥾", hiker: "🧗", climb: "🧗",
  climbing: "🧗", mountain_climbing: "🧗", skiing: "⛷️", snowboard: "🏂",
  snowboarding: "🏂", skating: "⛸️", ice_skate: "⛸️", sledding: "🛷", sled: "🛷",
  dancing: "💃", dance: "💃", dancer: "💃", party: "🎉", partying: "🥳",
  celebration: "🎊", celebrate: "🎊", confetti: "🎊", concert: "🎤", music: "🎵",
  song: "🎵", sing: "🎤", singing: "🎤", microphone: "🎤", mic: "🎤",
  guitar: "🎸", piano: "🎹", drums: "🥁", violin: "🎻", trumpet: "🎺",
  saxophone: "🎷", accordion: "🪗", flute: "🪈", headphones: "🎧", earphones: "🎧",
  art: "🎨", painting: "🎨", paint: "🎨", draw: "✏️", drawing: "✏️",
  photograph: "📷", photo: "📷", camera: "📷", film: "🎞️", movie: "🎬",
  cinema: "🎬", theater: "🎭", theatre: "🎭", ticket: "🎫", concert_ticket: "🎫",
  gaming: "🎮", video_game: "🎮", joystick: "🎮", controller: "🎮", dice: "🎲",
  puzzle: "🧩", jigsaw: "🧩", chess: "♟️", poker: "🃏", cards: "🃏",
  magic: "✨", magical: "🪄", spell: "🪄", wand: "🪄", circus: "🎪",
  // Travel & places (~90)
  travel: "✈️", trip: "🧳", journey: "🧭", vacation: "🏝️", holiday: "🏖️",
  flight: "✈️", fly_travel: "✈️", flying: "✈️", airplane: "✈️", plane: "✈️",
  jet: "🛩️", small_plane: "🛩️", rocket: "🚀", spaceship: "🚀", launch: "🚀",
  helicopter: "🚁", chopper: "🚁", airport: "🛫", departure: "🛫", arrival: "🛬",
  car: "🚗", automobile: "🚗", vehicle: "🚗", sedan: "🚗", taxi: "🚕",
  cab: "🚕", uber: "🚕", sports_car: "🏎️", racecar: "🏎️", convertible: "🚗",
  suv: "🚙", jeep: "🚙", truck: "🚚", pickup: "🛻", lorry: "🚛",
  bus: "🚌", minibus: "🚐", van: "🚐", ambulance: "🚑", fire_truck: "🚒",
  fire_engine: "🚒", police_car: "🚓", patrol: "🚓", tractor: "🚜", harvester: "🚜",
  motorcycle: "🏍️", motorbike: "🏍️", scooter: "🛵", moped: "🛵", bicycle_vehicle: "🚲",
  train: "🚆", trains: "🚆", locomotive: "🚂", steam_train: "🚂", bullet_train: "🚅",
  subway: "🚇", metro: "🚇", tram: "🚊", trolley: "🚊", monorail: "🚝",
  light_rail: "🚈", cable_car: "🚠", gondola: "🚠", mountain_railway: "🚞", funicular: "🚞",
  ship: "🚢", boat: "⛵", sailboat: "⛵", yacht: "🛥️", ferry: "⛴️",
  cruise: "🛳️", canoe: "🛶", kayak: "🛶", rowboat: "🚣", ferry_boat: "⛴️",
  city: "🏙️", downtown: "🏙️", metropolis: "🏙️", skyscraper: "🏢", office: "🏢",
  office_building: "🏢", building: "🏢", buildings: "🏙️", house: "🏠", home: "🏠",
  house_with_garden: "🏡", cottage: "🏡", cabin: "🏡", hut: "🛖", tent: "⛺",
  camping: "⛺", camp: "🏕️", castle: "🏰", palace: "🏰", fortress: "🏰",
  stadium: "🏟️", arena: "🏟️", park: "🏞️", garden: "🌻", beach: "🏖️",
  beach_umbrella: "⛱️", desert: "🏜️", island: "🏝️", volcano: "🌋", mountain: "⛰️",
  mountains: "🏔️", snowy_mountain: "🏔️", hill: "⛰️", forest: "🌲", woods: "🌳",
  tree: "🌳", trees: "🌲", palm_tree: "🌴", palm: "🌴", cactus: "🌵",
  river: "🏞️", lake: "🏞️", ocean: "🌊", sea: "🌊", wave_ocean: "🌊",
  waves: "🌊", waterfall: "💧", sunrise: "🌅", sunset: "🌇", sunrise_mountains: "🌄",
  night: "🌙", stars: "✨", starry: "🌌", milky_way: "🌌", shooting_star: "🌠",
  map: "🗺️", globe: "🌍", world: "🌍", earth: "🌍", earth_africa: "🌍",
  earth_americas: "🌎", earth_asia: "🌏", compass: "🧭", location: "📍", pin: "📍",
  flag: "🚩", finish_line: "🏁", checkered: "🏁",
  // Objects (~110)
  phone: "📱", mobile: "📱", smartphone: "📱", cellphone: "📱", telephone: "☎️",
  call: "📞", calling: "📞", ringing: "📲", receiver: "📞",
  laptop: "💻", notebook: "💻", computer: "🖥️", desktop: "🖥️", monitor: "🖥️",
  keyboard: "⌨️", mouse_pointer: "🖱️", trackpad: "🖱️", printer: "🖨️", scanner: "🖨️",
  camera_object: "📷", video_camera: "📹", camcorder: "📹", movie_camera: "🎥", film_camera: "🎥",
  tv: "📺", television: "📺", television_set: "📺", screen: "🖥️", display: "🖥️",
  radio: "📻", stereo: "🔊", speaker: "🔊", loudspeaker: "📢", megaphone: "📢",
  bell: "🔔", ring_bell: "🔔", doorbell: "🚪", alarm: "⏰", alarm_clock: "⏰",
  clock: "🕐", watch: "⌚", wristwatch: "⌚", hourglass: "⏳", timer: "⏲️",
  stopwatch: "⏱️", calendar: "📅", calendar_pad: "📅", date: "📅", schedule: "📅",
  tear_off: "📆", spiral_calendar: "🗓️", notebook_object: "📓", notebook_paper: "📔", journal: "📔",
  diary: "📔", ledger: "📒", folder: "📁", file_folder: "📁", open_folder: "📂",
  file: "📄", document: "📄", page: "📄", pages: "📃", scroll: "📜",
  page_curl: "📃", receipt: "🧾", invoice: "🧾", list: "📝", memo: "📝",
  pencil: "✏️", pen: "🖊️", pen_write: "🖊️", fountain_pen: "🖋️", paintbrush: "🖌️",
  crayon: "🖍️", marker: "🖊️", brush: "🖌️", briefcase: "💼", suitcase: "🧳",
  luggage: "🧳", bag: "👜", handbag: "👜", purse: "👛", wallet: "👛",
  backpack: "🎒", school_bag: "🎒", satchel: "🎒", shopping_bag: "🛍️", shopping: "🛍️",
  shopping_cart: "🛒", cart: "🛒", basket: "🧺", hamper: "🧺",
  bulb: "💡", lightbulb: "💡", light: "💡", idea: "💡", flashlight: "🔦",
  candle: "🕯️", wax: "🕯️", lantern: "🏮", lamp: "🪔", diya: "🪔",
  book: "📖", books: "📚", reading: "📖", read: "📖", textbook: "📚",
  open_book: "📖", closed_book: "📕", blue_book: "📘", green_book: "📗", orange_book: "📙",
  newspaper: "📰", news: "📰", magazine: "📰", article: "📰",
  money: "💵", cash: "💵", dollar: "💵", dollars: "💵", currency: "💰",
  euro: "💶", pound: "💷", yen: "💴", coin: "🪙", coins: "🪙",
  moneybag: "💰", bag_money: "💰", credit_card: "💳", card: "💳", bank: "🏦",
  atm: "🏧", chart: "📊", graph: "📈", pie_chart: "🥧", bar_chart: "📊",
  growth: "📈", increase: "📈", decline: "📉", decrease: "📉", analytics: "📊",
  key: "🔑", keys: "🔑", key_lock: "🔑", lock: "🔒", locked: "🔒",
  unlock: "🔓", unlocked: "🔓", safe: "🛅", password: "🔑", pin_code: "🔑",
  tool: "🛠️", tools: "🛠️", hammer: "🔨", axe: "🪓", hatchet: "🪓",
  pick: "⛏️", pickaxe: "⛏️", wrench: "🔧", spanner: "🔧", screwdriver: "🪛",
  nut_bolt: "🔩", bolt: "🔩", screw: "🪛", gear: "⚙️", cog: "⚙️",
  brick: "🧱", bricks: "🧱", construction: "🏗️", crane: "🏗️", building_site: "🏗️",
  scale: "⚖️", balance: "⚖️", justice: "⚖️", weight: "⚖️", measure: "📏",
  ruler: "📏", straightedge: "📏", triangle_ruler: "📐", set_square: "📐", scissors: "✂️",
  cut: "✂️", cutting: "✂️", clip: "📎", paperclip: "📎", binder: "📎",
  pushpin: "📌", pin_thumb: "📌", pin_board: "📍", link: "🔗", chain: "🔗",
  paperclip_linked: "🖇️", folder_clip: "🖇️",
  // Symbols, abstract, time (~80)
  time: "⏰", hour: "🕐", minute: "⏱️", second: "⏲️", day: "🌞",
  week: "🗓️", month: "📅", year: "📆", today: "📅", tomorrow: "➡️📅",
  yesterday: "⬅️📅", now: "📍", past: "⬅️", future: "➡️", present: "📍",
  morning: "🌅", afternoon: "☀️", evening: "🌆", night_time: "🌙", midnight: "🕛",
  noon: "🕛", dawn: "🌅", dusk: "🌆", weekend: "🎉", weekday: "📅",
  monday: "🕗", tuesday: "🕘", wednesday: "🕙", thursday: "🕚", friday: "🕚",
  saturday: "🎉", sunday: "☀️",
  january: "❄️", february: "💝", march: "🌱", april: "🌸",
  may: "🌷", june: "☀️", july: "🎆", august: "🌻", september: "🍂",
  october: "🎃", november: "🦃", december: "🎄",
  spring: "🌷", summer: "☀️", autumn: "🍂", fall: "🍂", winter: "❄️",
  birthday: "🎂", anniversary: "💍", wedding: "💒", ceremony: "🎉", festival: "🎉",
  holiday_time: "🎄", christmas: "🎄", xmas: "🎄", newyear: "🎉", new_year: "🎉",
  halloween: "🎃", thanksgiving: "🦃", valentine: "💝", valentines: "💝", easter: "🐰",
  firework: "🎆", fireworks: "🎆", sparkler: "✨", sparkles: "✨", sparkle: "✨",
  shine: "✨", shining: "✨", glow: "🌟", glow_star: "🌟", star: "⭐",
  star_struck: "🤩", superstar: "🌟", famous: "🌟", celebrity: "🌟",
  question: "❓", what: "❓", why: "❓", when: "❓", where: "❓", who: "❓", how: "❓",
  exclamation: "❗", wow_emoji: "❗", alert: "⚠️", warning: "⚠️", caution: "⚠️",
  danger: "⛔", stop: "🛑", halt: "✋", end: "🏁", finish: "🏁",
  start: "🟢", go: "🟢", begin: "▶️", play_button: "▶️", pause: "⏸️",
  rewind: "⏪", fast_forward: "⏩", skip: "⏭️", record: "⏺️", stop_button: "⏹️",
  info: "ℹ️", information: "ℹ️", tip: "💡", hint: "💡", suggestion: "💡",
  recycle: "♻️", recycling: "♻️", eco: "🌱", green: "🌿", sustainable: "♻️",
  bio: "♻️", organic: "🌱", vegan: "🌱", vegetarian: "🥕",
  male: "♂️", female: "♀️", gender: "⚧", trans: "⚧", male_female: "⚥",
  check: "✅", checked: "✅", done: "✅", complete: "✅", completed: "✅", finished: "✅",
  cross: "❌", wrong: "❌", incorrect: "❌", error: "❌", fail: "❌", failed: "❌",
  retry: "🔄", refresh: "🔄", reload: "🔄", restart: "🔄", redo: "🔄",
  undo: "↩️", back: "🔙", return: "↩️", reverse: "↩️",
  arrow_up: "⬆️", arrow_down: "⬇️", arrow_left: "⬅️", arrow_right: "➡️",
  up: "⬆️", down: "⬇️", left: "⬅️", right: "➡️", forward: "➡️",
  infinity: "♾️", unlimited: "♾️", forever: "♾️", eternal: "♾️",
  // Weather & nature (~60)
  weather: "🌤️", sunny: "☀️", sun: "☀️", sunshine: "☀️", sunlight: "☀️",
  cloudy: "☁️", cloud: "☁️", clouds: "☁️", overcast: "☁️", partly_cloudy: "⛅",
  rain: "🌧️", rainy: "🌧️", raining: "🌧️", rainfall: "🌧️", showers: "🌧️",
  thunderstorm: "⛈️", storm: "⛈️", thunder: "⛈️", lightning: "⚡", thunderbolt: "⚡",
  snow: "❄️", snowy: "❄️", snowing: "🌨️", snowflake: "❄️", blizzard: "🌨️",
  fog: "🌫️", foggy: "🌫️", mist: "🌫️", misty: "🌫️", haze: "🌫️",
  wind: "💨", windy: "💨", breeze: "💨", gust: "💨", blow: "💨",
  rainbow: "🌈", rainbow_colors: "🌈", prism: "🌈",
  umbrella: "☂️", umbrella_rain: "☔", parasol: "⛱️", raincoat: "🧥",
  cold: "🥶", freezing: "🥶", frigid: "🥶", chill_weather: "🥶", chill_cold: "🥶",
  hot: "🥵", heat: "🥵", boiling: "🥵", scorching: "🥵", warm: "🌡️",
  temperature: "🌡️", thermometer: "🌡️", fever: "🤒", degrees: "🌡️",
  flower: "🌸", flowers: "🌸", blossom: "🌸", bloom: "🌷", blooming: "🌷",
  rose_flower: "🌹", rose: "🌹", tulip: "🌷", sunflower: "🌻", daisy: "🌼",
  bouquet: "💐", flowers_bunch: "💐", wreath: "💐", grass: "🌱", grass_blade: "🌱",
  seedling: "🌱", sprout: "🌱", plant: "🪴", potted_plant: "🪴", sapling: "🌱",
  leaf: "🍃", leaves: "🍃", shamrock: "☘️", clover: "☘️", four_leaf: "🍀", luck: "🍀", lucky: "🍀",
  herb: "🌿", herb_plant: "🌿", fern: "🌿", branches: "🌿", wood: "🪵", log: "🪵",
  mushroom_nature: "🍄", toadstool: "🍄", shell: "🐚", seashell: "🐚", spider_web: "🕸️",
  // Tech & internet (~50)
  internet: "🌐", web: "🌐", online: "🌐", website: "🌐", browser: "🌐",
  email: "📧", mail: "📧", mailbox: "📫", inbox: "📥", outbox: "📤",
  message: "💬", messages: "💬", chat: "💬", texting: "💬", text: "💬",
  envelope: "✉️", letter: "✉️", postcard: "📮", postal: "📮",
  send: "📤", sent: "📤", receive: "📥", received: "📥", delivered: "✅",
  wifi: "📶", wireless: "📶", signal: "📶", connection: "🔗", connected: "🔗",
  bluetooth: "🔵", wireless_signal: "📡", satellite: "📡",
  battery: "🔋", charged: "🔋", charging: "🔌", plug: "🔌", power: "🔌",
  electricity: "⚡", energy: "⚡", electric: "⚡", current: "⚡", voltage: "⚡",
  cloud_computing: "☁️", cloud_storage: "☁️", backup: "💾", save_data: "💾", disk: "💾",
  hard_drive: "💾", storage: "💾", memory: "💾", ram_memory: "💾", data: "💾",
  code: "💻", coding: "💻", programming: "💻", developer: "👨‍💻", dev: "👨‍💻",
  programmer: "👩‍💻", software: "💻", app: "📱", application: "📱", mobile_app: "📱",
  download: "⬇️", download_data: "📥", upload: "⬆️", upload_data: "📤",
  link_url: "🔗", hyperlink: "🔗", url: "🔗", domain: "🌐",
  security: "🔒", secure: "🔒", privacy: "🔒", protected: "🔒", encrypted: "🔒",
  login: "🔑", signin: "🔑", signin_form: "🔑", logout: "👋", signout: "👋",
  // Verbs & actions (~80)
  go_verb: "🚶", come: "🫶", arrive: "🛬", leave: "👋", depart: "🛫",
  see: "👀", look: "👀", watch_verb: "👀", observe: "👀", view: "👀",
  listen: "👂", hear: "👂", sound: "🔊", listen_music: "🎧",
  speak: "🗣️", talk: "🗣️", say: "🗣️", tell: "🗣️", told: "🗣️",
  write: "✍️", written: "📝", type: "⌨️", typing: "⌨️", typed: "⌨️",
  read_verb: "📖", reads: "📖", studied: "📚", study: "📚", studies: "📚",
  learn: "🧠", learning: "🧠", taught: "📚", teach: "👩‍🏫", teaching: "👩‍🏫",
  think_verb: "🤔", thoughts: "💭", mind: "🧠", remember: "🧠", memory_verb: "🧠",
  forget: "😶", forgotten: "😶", forgot: "😶", lost_memory: "😶",
  know: "💡", knew: "💡", understood: "💡", understand: "💡", knowledge: "💡",
  believe: "🙏", faith: "🙏", trust: "🤝", hope: "🙏", wish: "🌟",
  want: "🙏", need: "🙏", desire: "😍", crave: "😋",
  like_verb: "👍", liked: "👍", enjoy: "😊", enjoyed: "😊",
  dislike_verb: "👎", hated: "👎", hate: "😡", detest: "👎",
  eat_verb: "🍽️", ate: "🍽️", eaten: "🍽️", dining: "🍽️", dine: "🍽️",
  drink_verb: "🥤", drank: "🥤", sipped: "🥤", sip: "🥤", gulp: "🥤",
  sleep_verb: "😴", slept: "😴", asleep: "😴", woke: "⏰", wake: "⏰",
  wake_up: "⏰", dream: "💭", dreamed: "💭", nightmare: "😱",
  work: "💼", working: "💼", worker: "👷", job: "💼", career: "📈",
  office_work: "🏢", meeting: "🗓️", appointment: "📅",
  build: "🏗️", built: "🏗️", building_verb: "🏗️", create: "✨", created: "✨",
  make: "🔨", made: "🔨", construct: "🏗️", assemble: "🔧", fix: "🔧",
  repair: "🔧", fixed: "🔧", broke: "💔", broken: "💔", shattered: "💔",
  give: "🎁", gave: "🎁", gift: "🎁", present_gift: "🎁", donate: "🤲",
  take: "✋", took: "✋", taken: "✋", grab: "✋", hold: "✋",
  buy: "🛒", bought: "🛒", purchase: "🛒", purchased: "🛒", shopping_verb: "🛍️",
  sell: "🏷️", sold: "🏷️", sale: "🏷️", sales: "🏷️", discount: "🏷️",
  pay: "💳", paid: "💳", payment: "💳", transaction: "💳", transfer: "💸",
  send_verb: "📤", sent_verb: "📤", receive_verb: "📥", received_verb: "📥",
  // Adjectives (~80)
  good: "👍", great: "👍", excellent: "🌟", amazing: "🤩", fantastic: "🤩",
  wonderful: "😍", marvelous: "😍", brilliant: "✨", perfect: "💯", ideal: "💎",
  best: "🏆", better: "📈", worst: "📉", worse: "📉",
  bad: "👎", terrible: "👎", awful: "😖", horrible: "😱", poor: "😢",
  big: "🐘", huge: "🐋", giant: "🦣", enormous: "🏔️", massive: "🏔️",
  small: "🐜", tiny: "🦟", little: "👶", mini: "🤏", miniature: "🤏",
  fast: "⚡", quick: "⚡", rapid: "⚡", swift: "⚡", speedy: "🏎️",
  slow: "🐌", sluggish: "🐌", leisurely: "🐢", gradual: "📈",
  heavy: "🏋️", weight_measure: "⚖️", light_weight: "🪶", feather: "🪶", airy: "🪶",
  hard: "🪨", solid: "🪨", firm: "🪨", stiff: "🪵", soft: "🧸", fluffy: "☁️",
  smooth: "🛢️", rough: "🪨", bumpy: "🪨", uneven: "🪨",
  new: "🆕", fresh: "🌿", recent: "📅", modern: "🏙️", latest: "🆕",
  old: "👴", ancient: "🏛️", vintage: "📻", antique: "🏺", classic: "🏛️",
  young: "👶", youthful: "🧒", junior: "🧒",
  beautiful: "😍", pretty: "🌸", gorgeous: "🌟", stunning: "🤩", lovely: "💕",
  ugly: "🤢", hideous: "🤮", unattractive: "🤢", plain: "😐",
  clean: "🧼", washed: "🧼", spotless: "✨", pure: "💎", fresh_clean: "🧼",
  dirty: "🧹", messy: "🧹", filthy: "🤢", stained: "🤮", grimy: "🤢",
  bright: "💡", brilliant_color: "✨", glowing: "🌟", luminous: "🌟", shining_verb: "✨",
  dark: "🌑", dim: "🌑", gloomy: "☁️", shadowy: "🌑", black: "🖤",
  empty: "📭", vacant: "📭", hollow: "🕳️", blank: "⬜", bare: "⬜",
  full: "🈵", filled: "🈵", packed: "🈵", complete_adj: "✅", whole: "💯",
  strong_adj: "💪", powerful_adj: "💪", mighty: "💪", forceful: "💪", tough: "🪨",
  weak: "🥀", frail: "🥀", fragile: "🥀", delicate: "🥀", feeble: "🥀",
  rich: "💰", wealthy: "💰", affluent: "💰", prosperous: "📈", luxurious: "💎",
  poor_adj: "🪙", broke_adj: "💸", penniless: "🪙", impoverished: "🪙",
  smart: "🧠", intelligent: "🧠", clever: "🧠", genius: "💡", wise: "🦉",
  stupid: "🤪", dumb: "🤪", foolish: "🤡", silly: "🤪", dumb_adj: "🤪",
  brave: "🦁", courageous: "🦁", fearless: "🦁", bold: "🦁", heroic: "🦸",
  scared: "😱", afraid: "😱", fearful: "😱", terrified: "😱", anxious: "😰",
  // Common words (~50)
  the: "", a: "", an: "", of: "", to: "", in: "", on: "", at: "",
  is: "", are: "", was: "", were: "", be: "", been: "", being: "",
  have: "", has: "", had: "", do: "", does: "", did: "",
  will: "", would: "", can: "", could: "", should: "", shall: "", might: "", must: "",
  this: "", that: "", these: "", those: "",
  i: "🙋", you: "👉", he: "👨", she: "👩", it: "🤖", we: "👥", they: "👥",
  me: "🙋", my: "🙋", mine: "🙋", your: "👉", yours: "👉", his: "👨", her: "👩", its: "🤖", our: "👥", their: "👥",
  who_pronoun: "🧑", what_pronoun: "❓", when_pronoun: "❓", where_pronoun: "❓", why_pronoun: "❓", how_pronoun: "❓",
  // Numbers & colors (~50)
  one: "1️⃣", two: "2️⃣", three: "3️⃣", four: "4️⃣", five: "5️⃣",
  six: "6️⃣", seven: "7️⃣", eight: "8️⃣", nine: "9️⃣", ten: "🔟",
  zero: "0️⃣", eleven: "1️⃣1️⃣", twelve: "1️⃣2️⃣", twenty: "2️⃣0️⃣", hundred: "💯", thousand: "🧮", million: "💰",
  first: "🥇", second_ordinal: "🥈", third: "🥉", last: "🔚", next: "➡️", previous: "⬅️",
  red: "🔴", blue: "🔵", green_color: "🟢", yellow: "🟡", orange_color: "🟠",
  purple: "🟣", pink: "🩷", brown: "🟤", black_color: "⚫", white: "⚪", gray: "🔘", grey: "🔘",
  // Family & relationships (~40)
  family_rel: "👪", parents_rel: "👨‍👩", mother_rel: "👩‍🍼", father_rel: "👨‍🍼", son: "👦", daughter: "👧",
  husband: "👨", wife: "👩", spouse: "💍", partner: "💑", couple: "👩‍❤️‍👨", engaged: "💍",
  aunt: "👩", uncle: "👨", cousin: "🧑", niece: "👧", nephew: "👦", grandmother: "👵", grandfather: "👴",
  granddaughter: "👧", grandson: "👦", stepmother: "👩", stepfather: "👨", stepsister: "👧", stepbrother: "👦",
  mother_in_law: "👩", father_in_law: "👨", sister_in_law: "👩", brother_in_law: "👨",
  dating: "💑", date_romantic: "💕", relationship: "💞", marriage: "💍", married: "💍", divorce: "💔", separated: "💔",
  // Verbs continued (~30)
  dream_verb: "💭", imagine: "💭", imagine_verb: "💭", wish_verb: "🌟", desire_verb: "😍",
  travel_verb: "✈️", explore: "🧭", discover: "🔍", found: "🔍", search: "🔍", searched: "🔍",
  help: "🤝", helped: "🤝", assist: "🤝", aid: "🤝", support: "🤝", guide: "🧭", lead: "🧭", follow: "👣",
  fight: "🥊", fought: "🥊", battle: "⚔️", war: "⚔️", peace_dove: "🕊️", peaceful: "🕊️",
  play_verb: "🎮", played: "🎮", game_verb: "🎲", gaming_verb: "🎮", win_verb: "🏆", won: "🏆", lose: "😞", lost_verb: "😭",
};

// Build reverse emoji-to-word lookup (first word wins)
export const EMOJI_WORD_DICT: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [word, emoji] of Object.entries(WORD_EMOJI_DICT)) {
    if (!emoji) continue;
    if (!(emoji in out)) out[emoji] = word.replace(/_/g, " ");
  }
  return out;
})();

// ---- Phrase-to-emoji dictionary (50+ entries) ----

export const PHRASE_EMOJI_DICT: Record<string, string> = {
  "good morning": "☀️🌅",
  "good night": "🌙😴",
  "good evening": "🌆",
  "good afternoon": "☀️",
  "happy birthday": "🎉🎂",
  "happy new year": "🎉🎊",
  "merry christmas": "🎄🎁",
  "happy holidays": "🎄✨",
  "thank you": "🙏",
  "thanks a lot": "🙏💯",
  "i love you": "❤️😍",
  "i miss you": "🥺💕",
  "i am happy": "😊",
  "i am sad": "😢",
  "i am angry": "😡",
  "i am tired": "😴",
  "i am hungry": "😋",
  "i am excited": "🤩",
  "i am sick": "🤒",
  "see you later": "👋",
  "see you soon": "👋",
  "take care": "🤗",
  "have a good day": "☀️",
  "have fun": "🎉",
  "good luck": "🍀",
  "well done": "👏",
  "great job": "👍",
  "happy valentine": "💝",
  "trick or treat": "🎃👻",
  "happy easter": "🐰🥚",
  "happy thanksgiving": "🦃",
  "get well soon": "💐🤒",
  "congratulations": "🎉👏",
  "congrats": "🎉",
  "happy anniversary": "💍",
  "best wishes": "🌟",
  "thinking of you": "💭❤️",
  "you are awesome": "😎",
  "you are the best": "🏆",
  "what time is it": "🕐❓",
  "let's go": "🚀",
  "lets go": "🚀",
  "happy halloween": "🎃",
  "feel better": "💐",
  "welcome back": "👋",
  "welcome home": "🏠",
  "goodbye": "👋",
  "happy weekend": "🎉",
  "i love this": "😍",
  "i hate this": "👎",
  "i am sorry": "😔",
  "i am sorry ": "🙏",
  "my bad": "😅",
  "no problem": "👌",
  "no worries": "😌",
  "sounds good": "👍",
  "that is great": "🎉",
  "what a surprise": "😲",
  "oh my god": "😱",
  "oh my": "😮",
  "lol funny": "😂",
  "very funny": "🤣",
  "shut up": "🤫",
  "be quiet": "🤫",
  "calm down": "😌",
  "good job": "👏",
  "way to go": "🎉",
  "you rock": "🤘",
  "high five": "🙌",
  "hug me": "🤗",
  "kiss me": "😘",
  "call me": "📞",
  "text me": "💬",
  "follow me": "👣",
  "let's eat": "🍽️",
  "let's play": "🎮",
  "time to sleep": "😴",
  "time to work": "💼",
  "time to go": "🚶",
};

// ---- Emoji Art templates (10+ multi-line) ----

export const EMOJI_ART_TEMPLATES: Record<string, string[]> = {
  heart: [
    "  ❤️❤️❤️❤️  ❤️❤️❤️❤️  ",
    "❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️",
    "❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️",
    "❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️❤️",
    "  ❤️❤️❤️❤️❤️❤️❤️❤️❤️  ",
    "    ❤️❤️❤️❤️❤️❤️❤️    ",
    "      ❤️❤️❤️❤️❤️      ",
    "        ❤️❤️❤️        ",
    "          ❤️          ",
  ],
  "christmas-tree": [
    "          🌟          ",
    "         🎄          ",
    "        🎄🎄🎄        ",
    "       🎄🎄🎄🎄🎄       ",
    "      🎄🎄🎄🎄🎄🎄🎄      ",
    "     🎄🎄🎄🎄🎄🎄🎄🎄🎄     ",
    "    🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄    ",
    "   🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄   ",
    "        🟫🟫🟫        ",
    "        🟫🟫🟫        ",
  ],
  cat: [
    "🐱🐱🐱  🐱🐱🐱",
    "🐱    🐱    🐱",
    "🐱    🐱    🐱",
    "🐱🐱🐱🐱🐱🐱🐱",
    "🐱    👀    🐱",
    "🐱    👅    🐱",
    "🐱🐱🐱🐱🐱🐱🐱",
    "      🐱        ",
    "    🐱🐱🐱      ",
  ],
  dog: [
    "🐶        🐶",
    "  🐶🐶🐶🐶🐶🐶",
    "  🐶    👀    🐶",
    "  🐶    👅    🐶",
    "  🐶🐶🐶🐶🐶🐶",
  ],
  rose: [
    "    🌹    ",
    "    🌹    ",
    "    🌹    ",
    "    🌿    ",
    "    🌿    ",
    "  🌿🌿🌿  ",
  ],
  sword: [
    "          ⚔️",
    "          ⚔️",
    "          ⚔️",
    "          ⚔️",
    "          ⚔️",
    "          ⚔️",
    "         ⚔️⚔️",
    "       ⚔️⚔️⚔️⚔️",
  ],
  house: [
    "    🏠🏠🏠🏠    ",
    "  🏠🏠🏠🏠🏠🏠🏠  ",
    "🏠🏠🏠🏠🏠🏠🏠🏠🏠",
    "🏠🏠🏠🏠🏠🏠🏠🏠🏠",
    "🏠 🚪 🏠 🪟 🏠",
  ],
  tree: [
    "      🌳      ",
    "    🌳🌳🌳🌳    ",
    "   🌳🌳🌳🌳🌳🌳   ",
    "  🌳🌳🌳🌳🌳🌳🌳🌳  ",
    " 🌳🌳🌳🌳🌳🌳🌳🌳🌳 ",
    "     🟫🟫     ",
    "     🟫🟫     ",
  ],
  star: [
    "      ⭐      ",
    "      ⭐      ",
    "⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐",
    "  ⭐⭐⭐⭐⭐⭐⭐⭐⭐",
    "    ⭐⭐⭐⭐⭐⭐⭐",
    "   ⭐⭐⭐  ⭐⭐⭐",
  ],
  smile: [
    "😀😀😀😀😀😀😀",
    "😀          😀",
    "😀  👀    👀  😀",
    "😀          😀",
    "😀    👅    😀",
    "😀          😀",
    "😀😀😀😀😀😀😀",
  ],
  boat: [
    "         ⛵",
    "        ⛵⛵",
    "       ⛵⛵⛵",
    "      ⛵⛵⛵⛵",
    "🌊🌊🌊🌊🌊🌊🌊🌊",
  ],
  flower: [
    "    🌸🌸🌸    ",
    "  🌸🌸🌸🌸🌸  ",
    "🌸🌸🌸🌸🌸🌸🌸",
    "  🌸🌸🌸🌸🌸  ",
    "    🌸🌸🌸    ",
    "      🌿      ",
    "      🌿      ",
  ],
};

// ---- ZWJ combinations (~15) ----

export const ZWJ_SEQUENCES: ZwjCombo[] = [
  { name: "heart on fire", components: ["❤️", "🔥"], result: "❤️‍🔥" },
  { name: "farmer", components: ["🧑", "🌾"], result: "🧑‍🌾" },
  { name: "rainbow flag", components: ["🏳️", "🌈"], result: "🏳️‍🌈" },
  { name: "kiss", components: ["👩", "❤️", "💋", "👨"], result: "👩‍❤️‍💋‍👨" },
  { name: "couple with heart", components: ["👩", "❤️", "👨"], result: "👩‍❤️‍👨" },
  { name: "people holding hands", components: ["🧑", "🤝", "🧑"], result: "🧑‍🤝‍🧑" },
  { name: "family man woman boy", components: ["👨", "👩", "👦"], result: "👨‍👩‍👦" },
  { name: "man cooking", components: ["👨", "🍳"], result: "👨‍🍳" },
  { name: "woman scientist", components: ["👩", "🔬"], result: "👩‍🔬" },
  { name: "man pilot", components: ["👨", "✈️"], result: "👨‍✈️" },
  { name: "man astronaut", components: ["👨", "🚀"], result: "👨‍🚀" },
  { name: "man fire fighter", components: ["👨", "🚒"], result: "👨‍🚒" },
  { name: "woman dancing", components: ["👩", "💃"], result: "💃" },
  { name: "person facepalming", components: ["🧑", "🤦"], result: "🤦" },
  { name: "person shrugging", components: ["🧑", "🤷"], result: "🤷" },
  { name: "mage", components: ["🧑", "🔮"], result: "🧙" },
  { name: "elf", components: ["🧑", "🧝"], result: "🧝" },
  { name: "vampire", components: ["🧑", "🧛"], result: "🧛" },
  { name: "merperson", components: ["🧑", "🧜"], result: "🧜" },
  { name: "fairy", components: ["🧑", "🧚"], result: "🧚" },
];

// ---- Tone mapping ----

export const EMOJI_TONE_MAP: Record<EmojiTone, string[]> = {
  love: ["❤️", "💖", "💕", "💗", "💓", "💞", "💘", "💝", "😍", "🥰", "😘", "💑", "💏", "💜", "🧡", "💛", "💚", "💙", "🤍", "🖤", "💟", "💌"],
  happy: ["😊", "😄", "😁", "🙂", "😉", "😎", "🤗", "😌", "😇", "😺", "😸", "👍", "💪", "🎉", "🌟", "✨", "☀️", "🌸", "🌈"],
  sad: ["😢", "😭", "😞", "😔", "😟", "😕", "💔", "🥀", "💧", "😿", "😦", "😩", "🥺"],
  excited: ["🤩", "🥳", "😆", "😃", "😻", "🎊", "🎉", "✨", "🌟", "⭐", "🔥", "💫", "💥"],
  angry: ["😡", "😠", "🤬", "👿", "😾", "🔥", "⚡", "💥", "⚔️", "🥊"],
  neutral: ["😐", "😶", "😑", "🤔", "🤷", "🙃", "😴", "💤"],
};

// Reverse map: emoji → tone
const EMOJI_TO_TONE: Record<string, EmojiTone> = (() => {
  const out: Record<string, EmojiTone> = {};
  (Object.entries(EMOJI_TONE_MAP) as [EmojiTone, string[]][]).forEach(([tone, emojis]) => {
    for (const e of emojis) if (!(e in out)) out[e] = tone;
  });
  return out;
})();

// ---- Density helpers ----

export const DENSITY_RATIOS: Record<EmojiDensity, number> = {
  sparse: 0.125, // 1/8 words
  medium: 0.333, // 1/3 words
  dense: 1.0, // every word
  "ultra-dense": 2.0, // 2 emojis per word
};

// ---- Functions ----

/** Normalize text — lowercase + collapse whitespace, keep punctuation. */
export function normalizeText(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Tokenize input into words (lowercase, no punctuation). */
export function parseInput(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .split(/[^a-z0-9'_\s]+/i)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Split text into sentences. */
export function splitSentences(text: string): string[] {
  return (text || "")
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Lookup a single word. Returns null if no mapping. */
export function lookupWord(word: string): string | null {
  const w = word.toLowerCase().trim();
  if (!w) return null;
  const e = WORD_EMOJI_DICT[w];
  return e || null;
}

/** Lookup a phrase (multi-word). Returns null if no mapping. */
export function lookupPhrase(phrase: string): string | null {
  const p = phrase.toLowerCase().trim();
  if (!p) return null;
  const e = PHRASE_EMOJI_DICT[p];
  return e || null;
}

/** Find phrases in the text (longest-first matching). Returns array of {start, end, phrase, emoji}. */
export function findPhrases(text: string): Array<{ start: number; end: number; phrase: string; emoji: string }> {
  const lower = text.toLowerCase();
  // Sort phrases by length descending so longer phrases win
  const sorted = Object.keys(PHRASE_EMOJI_DICT).sort((a, b) => b.length - a.length);
  const found: Array<{ start: number; end: number; phrase: string; emoji: string }> = [];
  const used: Array<[number, number]> = [];
  for (const phrase of sorted) {
    let idx = 0;
    while ((idx = lower.indexOf(phrase, idx)) !== -1) {
      const end = idx + phrase.length;
      // Skip if overlaps with already-found phrase
      const overlaps = used.some(([s, e]) => idx < e && end > s);
      if (!overlaps) {
        found.push({ start: idx, end, phrase, emoji: PHRASE_EMOJI_DICT[phrase] });
        used.push([idx, end]);
      }
      idx = end;
    }
  }
  found.sort((a, b) => a.start - b.start);
  return found;
}

/** Suggest similar emojis for a word without direct mapping. */
export function suggestEmojis(word: string): string[] {
  const w = word.toLowerCase().trim();
  if (!w) return [];
  // Find words sharing prefix (3+ chars) or substring
  const suggestions: string[] = [];
  const seen = new Set<string>();
  for (const [dictWord, emoji] of Object.entries(WORD_EMOJI_DICT)) {
    if (!emoji) continue;
    if (seen.has(emoji)) continue;
    // Match if dictWord starts with same 3+ chars or contains w
    if ((w.length >= 3 && dictWord.startsWith(w.slice(0, 3))) ||
        (dictWord.length >= 3 && w.startsWith(dictWord.slice(0, 3)))) {
      suggestions.push(emoji);
      seen.add(emoji);
      if (suggestions.length >= 5) break;
    }
  }
  return suggestions;
}

/** Get alternative emojis for a word (multiple emojis per word). */
export function getAlternativeEmojis(word: string): string[] {
  const w = word.toLowerCase().trim();
  if (!w) return [];
  const out: string[] = [];
  const primary = lookupWord(w);
  if (primary) out.push(primary);
  for (const s of suggestEmojis(w)) {
    if (!out.includes(s)) out.push(s);
    if (out.length >= 5) break;
  }
  return out;
}

/** Apply density — returns indices of word positions to translate. */
export function applyDensity(wordCount: number, density: EmojiDensity): number[] {
  if (wordCount <= 0) return [];
  const ratio = DENSITY_RATIOS[density];
  const idxs: number[] = [];
  if (density === "ultra-dense") {
    // every word, plus duplicates for some
    for (let i = 0; i < wordCount; i++) {
      idxs.push(i);
      if (i % 3 === 0) idxs.push(i); // duplicate
    }
    return idxs;
  }
  if (density === "sparse") {
    // 1 per sentence — but we don't have sentence info, so every ~8th word
    const step = Math.max(1, Math.round(1 / ratio));
    for (let i = 0; i < wordCount; i += step) idxs.push(i);
    return idxs;
  }
  if (density === "medium") {
    // 1 per phrase — approximate every 3rd word
    const step = Math.max(1, Math.round(1 / ratio));
    for (let i = 0; i < wordCount; i += step) idxs.push(i);
    return idxs;
  }
  // dense — every word
  for (let i = 0; i < wordCount; i++) idxs.push(i);
  return idxs;
}

/** Translate text to emoji (phrase-priority, density-aware). */
export function translateTextToEmoji(
  text: string,
  density: EmojiDensity,
  preserveOriginal: boolean,
): TranslationResult {
  const normalized = normalizeText(text);
  if (!normalized) {
    return emptyResult("text-to-emoji", preserveOriginal ? normalized : null);
  }
  // Find phrases first
  const phrases = findPhrases(normalized);
  // Tokenize words
  const words = parseInput(normalized);
  // Determine word positions to translate (by density)
  const translateIdx = new Set(applyDensity(words.length, density));
  // Build output: walk through original text, replacing phrases + selected words
  let out = "";
  let i = 0;
  const coveredWords: string[] = [];
  const uncoveredWords: string[] = [];
  const allEmojis: string[] = [];
  const suggestions: WordSuggestion[] = [];
  const consumedChars: boolean[] = new Array(normalized.length).fill(false);

  // First handle phrases — mark them and add their emojis
  const phraseEmojis: Array<{ start: number; end: number; emoji: string; phrase: string }> = [];
  for (const p of phrases) {
    phraseEmojis.push({ start: p.start, end: p.end, emoji: p.emoji, phrase: p.phrase });
    for (let c = p.start; c < p.end; c++) consumedChars[c] = true;
    allEmojis.push(p.emoji);
    coveredWords.push(...p.phrase.split(/\s+/).filter(Boolean));
  }

  // Build the output — interleave original + emojis
  let wordIdx = 0;
  for (let c = 0; c < normalized.length; c++) {
    // Check if a phrase starts here FIRST (before consumed check)
    const ph = phraseEmojis.find((p) => p.start === c);
    if (ph) {
      out += ph.emoji + " ";
      c = ph.end - 1;
      // advance wordIdx by phrase word count
      wordIdx += ph.phrase.split(/\s+/).filter(Boolean).length;
      continue;
    }
    if (consumedChars[c]) {
      // inside a phrase (mid-phrase char) — skip
      continue;
    }
    // Word boundary: if this is start of a word and density says translate
    const ch = normalized[c];
    if (/[a-z0-9]/i.test(ch) && (c === 0 || !/[a-z0-9]/i.test(normalized[c - 1]))) {
      // Start of a word — capture word
      let end = c;
      while (end < normalized.length && /[a-z0-9'_]/i.test(normalized[end])) end++;
      const word = normalized.slice(c, end).toLowerCase();
      const shouldTranslate = translateIdx.has(wordIdx);
      if (shouldTranslate) {
        const emoji = lookupWord(word);
        if (emoji) {
          if (density === "ultra-dense") {
            out += emoji + " " + word + " " + emoji + " ";
          } else {
            out += emoji + " ";
          }
          coveredWords.push(word);
          allEmojis.push(emoji);
        } else {
          // No direct mapping — keep word, suggest
          out += word + " ";
          uncoveredWords.push(word);
          const alts = getAlternativeEmojis(word);
          if (alts.length > 0) {
            suggestions.push({ word, emoji: null, alternatives: alts });
          }
        }
      } else {
        out += word + " ";
        if (lookupWord(word)) {
          coveredWords.push(word);
        } else {
          uncoveredWords.push(word);
        }
      }
      c = end - 1;
      wordIdx++;
    } else if (!/\s/.test(ch)) {
      out += ch;
    } else if (out && !out.endsWith(" ")) {
      out += " ";
    }
  }

  const finalOutput = out.replace(/\s+/g, " ").trim();
  const stats = computeStats(words, allEmojis);
  const coverage = coverageReport(coveredWords, uncoveredWords);
  const tone = detectTone(allEmojis);
  const categoryCounts = countByCategory(allEmojis);

  return {
    mode: "text-to-emoji",
    output: finalOutput,
    original: preserveOriginal ? normalized : null,
    stats,
    coverage,
    tone,
    categoryCounts,
    suggestions,
  };
}

/** Translate emoji to text (reverse lookup). */
export function translateEmojiToText(text: string): TranslationResult {
  if (!text) return emptyResult("emoji-to-text", null);
  // Scan for known emojis in EMOJI_WORD_DICT
  // Need to handle multi-codepoint emojis (with ZWJ, skin tones, variation selectors)
  const allEmojis: string[] = [];
  const words: string[] = [];
  // Build a regex matching any known emoji (longest first)
  const sortedEmojis = Object.keys(EMOJI_WORD_DICT).sort((a, b) => b.length - a.length);
  const escaped = sortedEmojis.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Also include EMOJI_ART characters that might be present
  const pattern = new RegExp(`(${escaped.join("|")})`, "gu");
  let out = text;
  const coveredWords: string[] = [];
  let match: RegExpExecArray | null;
  const consumedRanges: Array<[number, number]> = [];
  while ((match = pattern.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    // Skip if overlaps
    if (consumedRanges.some(([s, e]) => start < e && end > s)) continue;
    consumedRanges.push([start, end]);
    const emoji = match[0];
    const word = EMOJI_WORD_DICT[emoji] || "";
    if (word) {
      allEmojis.push(emoji);
      words.push(word);
      coveredWords.push(word);
    }
  }
  // Replace emojis with words in the original text
  // Sort consumed ranges by start descending so replacements don't shift indices
  consumedRanges.sort((a, b) => b[0] - a[0]);
  let result = text;
  for (const [start, end] of consumedRanges) {
    const emoji = result.slice(start, end);
    const word = EMOJI_WORD_DICT[emoji] || emoji;
    result = result.slice(0, start) + word + result.slice(end);
  }

  const stats: TranslationStats = {
    totalWords: words.length,
    totalEmojis: allEmojis.length,
    coveragePct: allEmojis.length > 0 ? 100 : 0,
    avgEmojisPerWord: words.length > 0 ? allEmojis.length / words.length : 0,
  };
  const coverage: CoverageReport = {
    covered: coveredWords,
    uncovered: [],
    coveragePct: 100,
  };
  const tone = detectTone(allEmojis);
  const categoryCounts = countByCategory(allEmojis);
  return {
    mode: "emoji-to-text",
    output: result.trim(),
    original: text,
    stats,
    coverage,
    tone,
    categoryCounts,
    suggestions: [],
  };
}

/** Generate emoji art for a given name. Returns empty string if not found. */
export function generateEmojiArt(name: string): string {
  if (!name) return "";
  const key = name.toLowerCase().trim().replace(/\s+/g, "-");
  const art = EMOJI_ART_TEMPLATES[key];
  return art ? art.join("\n") : "";
}

/** Generate mixed text + emoji output. */
export function generateMixed(
  text: string,
  density: EmojiDensity,
): TranslationResult {
  const base = translateTextToEmoji(text, density, true);
  // In mixed mode, output is original + emoji side-by-side per translated word
  const normalized = normalizeText(text);
  if (!normalized) return emptyResult("mixed", null);
  // Simpler: word-by-word, append emoji where translation available
  const words = parseInput(normalized);
  const translateIdx = new Set(applyDensity(words.length, density));
  let out = "";
  const coveredWords: string[] = [];
  const uncoveredWords: string[] = [];
  const allEmojis: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (translateIdx.has(i)) {
      const e = lookupWord(w);
      if (e) {
        out += `${w}${e} `;
        coveredWords.push(w);
        allEmojis.push(e);
      } else {
        out += `${w} `;
        uncoveredWords.push(w);
      }
    } else {
      out += `${w} `;
      if (lookupWord(w)) coveredWords.push(w);
      else uncoveredWords.push(w);
    }
  }
  const stats = computeStats(words, allEmojis);
  const coverage = coverageReport(coveredWords, uncoveredWords);
  const tone = detectTone(allEmojis);
  const categoryCounts = countByCategory(allEmojis);
  return {
    mode: "mixed",
    output: out.trim(),
    original: base.original,
    stats,
    coverage,
    tone,
    categoryCounts,
    suggestions: base.suggestions,
  };
}

/** Compute summary stats. */
export function computeStats(words: string[], emojis: string[]): TranslationStats {
  const totalWords = words.length;
  const totalEmojis = emojis.length;
  const coveragePct = totalWords > 0
    ? Math.min(100, Math.round((totalEmojis / totalWords) * 100))
    : 0;
  const avgEmojisPerWord = totalWords > 0 ? totalEmojis / totalWords : 0;
  return { totalWords, totalEmojis, coveragePct, avgEmojisPerWord };
}

/** Build coverage report from covered/uncovered word lists (dedup). */
export function coverageReport(
  covered: string[],
  uncovered: string[],
): CoverageReport {
  const coveredSet = new Set(covered.map((w) => w.toLowerCase()));
  const uncoveredSet = new Set(uncovered.map((w) => w.toLowerCase()));
  // Remove words that appear in both (covered wins)
  for (const w of coveredSet) uncoveredSet.delete(w);
  const total = coveredSet.size + uncoveredSet.size;
  const coveragePct = total > 0
    ? Math.round((coveredSet.size / total) * 100)
    : 0;
  return {
    covered: Array.from(coveredSet).sort(),
    uncovered: Array.from(uncoveredSet).sort(),
    coveragePct,
  };
}

/** Count emojis per category (by reverse mapping). */
export function countByCategory(emojis: string[]): Record<EmojiCategory, number> {
  const out: Record<EmojiCategory, number> = {
    smileys: 0,
    gestures: 0,
    animals: 0,
    food: 0,
    activities: 0,
    travel: 0,
    objects: 0,
    symbols: 0,
    nature: 0,
    other: 0,
  };
  for (const e of emojis) {
    if (!e) continue;
    const cat = categorizeEmoji(e);
    out[cat] += 1;
  }
  return out;
}

/** Categorize an emoji by matching against WORD_EMOJI_DICT + tone maps. */
export function categorizeEmoji(emoji: string): EmojiCategory {
  // Check tone maps for smileys
  if (EMOJI_TONE_MAP.happy.includes(emoji) ||
      EMOJI_TONE_MAP.sad.includes(emoji) ||
      EMOJI_TONE_MAP.excited.includes(emoji) ||
      EMOJI_TONE_MAP.angry.includes(emoji) ||
      EMOJI_TONE_MAP.neutral.includes(emoji)) return "smileys";
  if (EMOJI_TONE_MAP.love.includes(emoji)) return "symbols";
  // Find which word maps to this emoji, then guess category from word
  const word = EMOJI_WORD_DICT[emoji];
  if (word) {
    // Heuristic checks on the word
    const w = word.toLowerCase();
    if (["cat","dog","bird","fish","horse","cow","pig","sheep","chicken","rabbit","mouse","rat","bear","panda","lion","tiger","monkey","elephant","zebra","giraffe","rhino","hippo","dolphin","whale","shark","octopus","crab","lobster","shrimp","snake","lizard","frog","bee","butterfly","spider","ant","bug","insect","dinosaur","dragon","unicorn","fox","wolf","kangaroo","camel","llama","deer","moose","turkey","goose","swan","eagle","owl","parrot","penguin","dove","seal","turtle","tortoise","squirrel","hedgehog","bat","hamster","sauropod","trex","mammoth","orangutan","gorilla"].some((k) => w.includes(k))) return "animals";
    if (["apple","banana","orange","grape","watermelon","strawberry","cherry","peach","pineapple","mango","coconut","kiwi","pear","avocado","tomato","eggplant","pepper","onion","garlic","mushroom","carrot","potato","corn","broccoli","lettuce","bread","cheese","egg","bacon","ham","steak","beef","chicken","burger","pizza","taco","burrito","rice","curry","ramen","noodle","pasta","soup","sushi","bento","icecream","donut","cookie","cake","pie","chocolate","candy","lollipop","honey","coffee","tea","juice","milk","beer","wine","cocktail","champagne","whiskey","sake","water","drink","eat","food"].some((k) => w.includes(k))) return "food";
    if (["soccer","football","basketball","baseball","tennis","volleyball","bowling","cricket","hockey","ping","badminton","boxing","martial","golf","archery","fishing","rowing","swimming","surfing","sailing","cycling","running","walking","hiking","climbing","skiing","skating","dancing","party","celebration","music","song","guitar","piano","drums","violin","trumpet","saxophone","flute","art","paint","draw","camera","film","movie","cinema","theater","ticket","gaming","video","joystick","dice","puzzle","chess","poker","magic","circus"].some((k) => w.includes(k))) return "activities";
    if (["car","truck","bus","van","motorcycle","scooter","bicycle","train","subway","tram","boat","ship","sailboat","yacht","ferry","canoe","kayak","airplane","plane","jet","rocket","helicopter","airport","city","skyscraper","house","home","cottage","tent","castle","stadium","park","beach","desert","island","volcano","mountain","forest","river","lake","ocean","sea","wave","globe","earth","compass","map","location","flag"].some((k) => w.includes(k))) return "travel";
    if (["phone","laptop","computer","monitor","keyboard","mouse","printer","camera","video","tv","radio","speaker","bell","clock","watch","hourglass","timer","calendar","notebook","folder","file","document","scroll","pencil","pen","brush","briefcase","suitcase","bag","handbag","purse","wallet","backpack","cart","basket","bulb","candle","book","newspaper","money","dollar","euro","pound","yen","coin","credit","bank","atm","chart","key","lock","tool","hammer","wrench","screwdriver","bolt","gear","brick","construction","scale","ruler","scissors","clip","pin","link"].some((k) => w.includes(k))) return "objects";
    if (["flower","rose","tulip","sunflower","daisy","bouquet","grass","seedling","plant","leaf","clover","herb","wood","tree","palm","cactus","sun","cloud","rain","storm","snow","fog","wind","rainbow","umbrella","weather","sunny","cloudy","rainy","snowy","windy","cold","hot","warm","temperature","thunder","lightning","wave","water","drop"].some((k) => w.includes(k))) return "nature";
    if (["heart","love","star","sparkle","shine","glow","fire","lightning","rainbow","infinity","peace","victory","win","luck","recycle","check","cross","error","arrow","up","down","left","right"].some((k) => w.includes(k))) return "symbols";
    if (["wave","hi","hello","bye","ok","yes","no","please","thanks","sorry","clap","thumbs","peace","muscle","hand","foot","fist","arm","leg","face","head","shoulder","hug","kiss","person","people","man","woman","boy","girl","child","baby","family","mother","father","friend","teacher","doctor","nurse","king","queen","superhero","ghost","robot","clown","fairy","wizard","witch","bride","groom","graduate","farmer","chef","singer","artist","pilot","astronaut","scientist","engineer","eye","ear","nose","mouth","lip","tongue","tooth"].some((k) => w.includes(k))) return "gestures";
  }
  return "other";
}

/** Detect emoji tone by majority. */
export function detectTone(emojis: string[]): EmojiTone {
  if (emojis.length === 0) return "neutral";
  const counts: Record<EmojiTone, number> = {
    happy: 0, sad: 0, excited: 0, angry: 0, love: 0, neutral: 0,
  };
  for (const e of emojis) {
    const t = EMOJI_TO_TONE[e];
    if (t) counts[t] += 1;
  }
  // Find max
  let maxTone: EmojiTone = "neutral";
  let maxCount = 0;
  (Object.entries(counts) as [EmojiTone, number][]).forEach(([tone, count]) => {
    if (count > maxCount) {
      maxCount = count;
      maxTone = tone;
    }
  });
  return maxCount > 0 ? maxTone : "neutral";
}

/** Generate a ZWJ combination by name. Returns null if not found. */
export function generateZwjSequence(name: string): string | null {
  if (!name) return null;
  const n = name.toLowerCase().trim();
  const combo = ZWJ_SEQUENCES.find((z) => z.name === n);
  return combo ? combo.result : null;
}

/** Find ZWJ combo by components. */
export function findZwjByComponents(components: string[]): ZwjCombo | null {
  if (!components || components.length === 0) return null;
  return ZWJ_SEQUENCES.find((z) =>
    z.components.length === components.length &&
    z.components.every((c, i) => c === components[i]),
  ) || null;
}

/** Render translation result as text. */
export function renderText(result: TranslationResult): string {
  if (!result) return "";
  const parts: string[] = [];
  if (result.original) {
    parts.push(`Original: ${result.original}`);
    parts.push("");
  }
  parts.push(`Output: ${result.output}`);
  parts.push("");
  parts.push(`--- Stats ---`);
  parts.push(`Total words: ${result.stats.totalWords}`);
  parts.push(`Total emojis: ${result.stats.totalEmojis}`);
  parts.push(`Coverage: ${result.stats.coveragePct}%`);
  parts.push(`Avg emojis/word: ${result.stats.avgEmojisPerWord.toFixed(2)}`);
  parts.push(`Tone: ${result.tone}`);
  parts.push("");
  parts.push(`--- Categories ---`);
  for (const [cat, count] of Object.entries(result.categoryCounts)) {
    if (count > 0) parts.push(`${cat}: ${count}`);
  }
  if (result.coverage.uncovered.length > 0) {
    parts.push("");
    parts.push(`--- Uncovered words (${result.coverage.uncovered.length}) ---`);
    parts.push(result.coverage.uncovered.join(", "));
  }
  if (result.suggestions.length > 0) {
    parts.push("");
    parts.push(`--- Suggestions ---`);
    for (const s of result.suggestions) {
      parts.push(`${s.word}: ${s.alternatives.join(" ")}`);
    }
  }
  return parts.join("\n");
}

/** Render translation result as CSV (word, emoji, alternatives). */
export function renderCsv(result: TranslationResult): string {
  const lines = ["word,emoji,alternative_emojis"];
  const original = result.original || "";
  const words = parseInput(original);
  for (const w of words) {
    const primary = lookupWord(w);
    const alts = getAlternativeEmojis(w).filter((e) => e !== primary);
    lines.push([
      escapeCsv(w),
      primary ? escapeCsv(primary) : "",
      escapeCsv(alts.join(" ")),
    ].join(","));
  }
  return lines.join("\n");
}

/** Build empty result. */
function emptyResult(mode: TranslationMode, original: string | null): TranslationResult {
  return {
    mode,
    output: "",
    original,
    stats: { totalWords: 0, totalEmojis: 0, coveragePct: 0, avgEmojisPerWord: 0 },
    coverage: { covered: [], uncovered: [], coveragePct: 0 },
    tone: "neutral",
    categoryCounts: {
      smileys: 0, gestures: 0, animals: 0, food: 0, activities: 0,
      travel: 0, objects: 0, symbols: 0, nature: 0, other: 0,
    },
    suggestions: [],
  };
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:social-media-emoji-translator:history";
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

// ---- Shareable URL ----

export function buildShareUrl(
  input: string,
  mode: TranslationMode,
  density: EmojiDensity,
  preserveOriginal: boolean,
): string {
  const params = new URLSearchParams();
  if (input) params.set("input", input);
  params.set("mode", mode);
  params.set("density", density);
  params.set("keep", preserveOriginal ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): {
  input: string;
  mode: TranslationMode;
  density: EmojiDensity;
  preserveOriginal: boolean;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { input: "", mode: "text-to-emoji", density: "medium", preserveOriginal: true };
  const params = new URLSearchParams(clean);
  const input = params.get("input") ?? "";
  const modeStr = params.get("mode") ?? "text-to-emoji";
  const densityStr = params.get("density") ?? "medium";
  const keepStr = params.get("keep") ?? "1";
  const mode: TranslationMode = (TRANSLATION_MODES as string[]).includes(modeStr)
    ? modeStr as TranslationMode
    : "text-to-emoji";
  const density: EmojiDensity = (DENSITY_OPTIONS as string[]).includes(densityStr)
    ? densityStr as EmojiDensity
    : "medium";
  const preserveOriginal = keepStr === "1";
  return { input, mode, density, preserveOriginal };
}
