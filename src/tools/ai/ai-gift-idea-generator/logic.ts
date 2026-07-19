/**
 * AI Gift Idea Generator — pure logic.
 *
 * Generates personalized, ranked gift ideas from a recipient profile
 * (relationship, age, interests, occasion, budget, and an "avoid" list).
 * Pure functions only — no DOM, no network. The optional LLM call
 * (BYO API key) lives in ui.tsx because it touches the network.
 *
 * Honesty clause: ideas are suggestions, not endorsements. We earn
 * nothing from what you buy and never insert affiliate IDs. Shopping
 * hints are neutral category + search-term pairs — paste them into any
 * retailer you trust.
 */

// ---------- Types ----------

export type RecipientType =
  | "partner"
  | "parent"
  | "friend"
  | "kid"
  | "coworker";

export type Occasion =
  | "birthday"
  | "anniversary"
  | "holiday"
  | "graduation";

export type Interest =
  | "books"
  | "tech"
  | "sports"
  | "cooking"
  | "travel";

export type BudgetTier = "low" | "mid" | "splurge";

export interface RecipientProfile {
  name: string;
  recipient: RecipientType;
  age: number;
  interests: Interest[];
  occasion: Occasion;
  budget: BudgetTier;
  avoid: string[]; // anti-repeat list (lowercased gift names)
  preferExperience: boolean; // toggle experiences vs objects
  diyMode: boolean; // surface DIY-friendly ideas
}

export interface GiftSeed {
  id: string;
  name: string;
  category: string;
  searchTerm: string;
  interests: Interest[];
  recipients: RecipientType[];
  occasions: Occasion[];
  tier: BudgetTier;
  priceLow: number;
  priceHigh: number;
  isExperience: boolean;
  isDiy: boolean;
  why: string;
}

export interface GiftSuggestion {
  id: string;
  name: string;
  category: string;
  searchTerm: string;
  tier: BudgetTier;
  priceLow: number;
  priceHigh: number;
  priceRange: string;
  isExperience: boolean;
  isDiy: boolean;
  why: string;
  score: number;
  matchedInterest: Interest | null;
}

export interface GiftPlan {
  profile: RecipientProfile;
  suggestions: GiftSuggestion[];
  count: number;
  generatedAt: number;
  warnings: string[];
}

export interface HistoryEntry {
  ts: number;
  recipientName: string;
  recipient: RecipientType;
  occasion: Occasion;
  budget: BudgetTier;
  count: number;
}

export interface SavedProfile {
  id: string;
  profile: RecipientProfile;
  savedAt: number;
}

// ---------- Labels ----------

export const RECIPIENT_LABELS: Record<RecipientType, string> = {
  partner: "Partner / Spouse",
  parent: "Parent",
  friend: "Friend",
  kid: "Kid / Teen",
  coworker: "Coworker",
};

export const OCCASION_LABELS: Record<Occasion, string> = {
  birthday: "Birthday",
  anniversary: "Anniversary",
  holiday: "Holiday",
  graduation: "Graduation",
};

export const INTEREST_LABELS: Record<Interest, string> = {
  books: "Books",
  tech: "Tech",
  sports: "Sports",
  cooking: "Cooking",
  travel: "Travel",
};

export const BUDGET_LABELS: Record<BudgetTier, string> = {
  low: "Low (under $25)",
  mid: "Mid ($25–$100)",
  splurge: "Splurge ($100+)",
};

export const INTEREST_PRESETS: string[] = [
  "books", "tech", "sports", "cooking", "travel",
];

export const RECIPIENT_PRESETS: RecipientType[] = [
  "partner", "parent", "friend", "kid", "coworker",
];

export const OCCASION_PRESETS: Occasion[] = [
  "birthday", "anniversary", "holiday", "graduation",
];

export const BUDGET_PRESETS: BudgetTier[] = [
  "low", "mid", "splurge",
];

// ---------- Gift database (140 curated entries) ----------
// Each gift is tagged with one or more interests, recipients, occasions.
// Price ranges are USD.

export const GIFT_DATABASE: GiftSeed[] = [
  // ----- Books -----
  { id: "bk-001", name: "Signed first-edition novel by favorite author", category: "Books", searchTerm: "signed first edition novel", interests: ["books"], recipients: ["partner", "friend"], occasions: ["birthday", "anniversary", "holiday"], tier: "splurge", priceLow: 60, priceHigh: 250, isExperience: false, isDiy: false, why: "A collectible they'll display and re-read — shows you noticed their favorite author." },
  { id: "bk-002", name: "Hardcover bestseller + bookplate", category: "Books", searchTerm: "hardcover bestseller with bookplate", interests: ["books"], recipients: ["parent", "friend", "coworker"], occasions: ["birthday", "holiday", "graduation"], tier: "mid", priceLow: 20, priceHigh: 35, isExperience: false, isDiy: false, why: "A current hit they can discuss with friends; the bookplate makes it theirs." },
  { id: "bk-003", name: "Bookstore gift card ($30)", category: "Books", searchTerm: "independent bookstore gift card 30 dollars", interests: ["books"], recipients: ["friend", "kid", "coworker"], occasions: ["birthday", "graduation", "holiday"], tier: "mid", priceLow: 30, priceHigh: 30, isExperience: false, isDiy: false, why: "Lets them choose — perfect for a reader whose taste you don't want to guess wrong." },
  { id: "bk-004", name: "E-reader (Kindle / Kobo)", category: "Tech", searchTerm: "ereader kindle kobo paperwhite", interests: ["books", "tech"], recipients: ["partner", "parent", "friend", "kid"], occasions: ["birthday", "holiday", "graduation", "anniversary"], tier: "splurge", priceLow: 100, priceHigh: 200, isExperience: false, isDiy: false, why: "Holds an entire library in one device — ideal for a reader who travels or reads at night." },
  { id: "bk-005", name: "Audiobook subscription (3 months)", category: "Books", searchTerm: "audiobook subscription 3 month gift", interests: ["books"], recipients: ["parent", "friend", "coworker"], occasions: ["birthday", "holiday", "graduation"], tier: "mid", priceLow: 30, priceHigh: 45, isExperience: false, isDiy: false, why: "For a reader who commutes or has tired eyes — they listen on their schedule." },
  { id: "bk-006", name: "Personalized story book for kids", category: "Books", searchTerm: "personalized childrens storybook with name", interests: ["books"], recipients: ["kid"], occasions: ["birthday", "holiday", "graduation"], tier: "mid", priceLow: 25, priceHigh: 50, isExperience: false, isDiy: false, why: "They become the hero of their own story — a keepsake they'll outgrow slowly." },
  { id: "bk-007", name: "Illustrated classics box set", category: "Books", searchTerm: "illustrated classics box set", interests: ["books"], recipients: ["kid", "parent"], occasions: ["birthday", "holiday", "graduation"], tier: "splurge", priceLow: 60, priceHigh: 120, isExperience: false, isDiy: false, why: "A shelf-ready collection they'll keep for decades — great shared reading." },
  { id: "bk-008", name: "Leather journal + fountain pen", category: "Books", searchTerm: "leather journal and fountain pen set", interests: ["books"], recipients: ["partner", "parent", "friend", "coworker"], occasions: ["birthday", "anniversary", "graduation", "holiday"], tier: "mid", priceLow: 30, priceHigh: 90, isExperience: false, isDiy: false, why: "An invitation to write — a reader who loves words often secretly wants to write them." },
  { id: "bk-009", name: "Book subscription box (3 months)", category: "Books", searchTerm: "book subscription box 3 month gift", interests: ["books"], recipients: ["partner", "friend", "parent"], occasions: ["birthday", "holiday", "anniversary"], tier: "splurge", priceLow: 60, priceHigh: 120, isExperience: false, isDiy: false, why: "A surprise book at their door every month — the gift that keeps giving." },
  { id: "bk-010", name: "Large-print classic set", category: "Books", searchTerm: "large print classics book set", interests: ["books"], recipients: ["parent"], occasions: ["birthday", "holiday"], tier: "mid", priceLow: 35, priceHigh: 75, isExperience: false, isDiy: false, why: "Easier on aging eyes — a thoughtful touch for older readers who love the classics." },
  { id: "bk-011", name: "Family recipe cookbook (blank, fill-in)", category: "Books", searchTerm: "blank family recipe cookbook fill in", interests: ["books", "cooking"], recipients: ["parent", "partner"], occasions: ["anniversary", "holiday"], tier: "low", priceLow: 15, priceHigh: 30, isExperience: false, isDiy: true, why: "A collaborative keepsake — you write in your recipes together." },
  { id: "bk-012", name: "Business / productivity bestseller", category: "Books", searchTerm: "business productivity bestseller hardcover", interests: ["books"], recipients: ["coworker"], occasions: ["graduation", "holiday", "birthday"], tier: "mid", priceLow: 18, priceHigh: 30, isExperience: false, isDiy: false, why: "Professional, neutral, and useful — a safe, well-regarded gift for a colleague." },

  // ----- Tech -----
  { id: "tc-001", name: "Wireless charging pad", category: "Tech", searchTerm: "wireless charging pad qi", interests: ["tech"], recipients: ["partner", "parent", "friend", "coworker"], occasions: ["birthday", "holiday", "anniversary", "graduation"], tier: "low", priceLow: 15, priceHigh: 25, isExperience: false, isDiy: false, why: "A small everyday upgrade that anyone with a phone will appreciate." },
  { id: "tc-002", name: "Bluetooth earbuds", category: "Tech", searchTerm: "bluetooth wireless earbuds", interests: ["tech", "sports"], recipients: ["partner", "friend", "kid", "coworker"], occasions: ["birthday", "holiday", "graduation"], tier: "mid", priceLow: 30, priceHigh: 90, isExperience: false, isDiy: false, why: "Useful for music, calls, and workouts — universally useful." },
  { id: "tc-003", name: "Smart speaker (Echo / Nest)", category: "Tech", searchTerm: "smart speaker echo nest mini", interests: ["tech"], recipients: ["partner", "parent", "friend"], occasions: ["birthday", "holiday", "anniversary"], tier: "mid", priceLow: 40, priceHigh: 100, isExperience: false, isDiy: false, why: "Hands-free music, timers, weather — a useful addition to any home." },
  { id: "tc-004", name: "Streaming stick (Roku / Fire TV)", category: "Tech", searchTerm: "streaming stick roku fire tv", interests: ["tech"], recipients: ["parent", "friend", "kid"], occasions: ["birthday", "holiday", "graduation"], tier: "low", priceLow: 25, priceHigh: 50, isExperience: false, isDiy: false, why: "Turns any TV into a smart TV — a great upgrade for an older set." },
  { id: "tc-005", name: "Tablet (iPad / Fire HD)", category: "Tech", searchTerm: "tablet ipad fire hd 10", interests: ["tech", "books"], recipients: ["partner", "parent", "kid"], occasions: ["birthday", "holiday", "anniversary", "graduation"], tier: "splurge", priceLow: 100, priceHigh: 400, isExperience: false, isDiy: false, why: "Reads, streams, draws, video-calls — a versatile all-in-one gift." },
  { id: "tc-006", name: "Fitness tracker", category: "Tech", searchTerm: "fitness tracker band fitbit", interests: ["tech", "sports"], recipients: ["partner", "parent", "friend", "kid"], occasions: ["birthday", "holiday", "anniversary", "graduation"], tier: "mid", priceLow: 40, priceHigh: 100, isExperience: false, isDiy: false, why: "Encourages movement and sleep — useful for the sporty or the just-getting-started." },
  { id: "tc-007", name: "Portable power bank (10,000 mAh)", category: "Tech", searchTerm: "portable power bank 10000 mah", interests: ["tech", "travel"], recipients: ["friend", "coworker", "kid"], occasions: ["birthday", "holiday", "graduation"], tier: "low", priceLow: 18, priceHigh: 30, isExperience: false, isDiy: false, why: "Travel-friendly insurance against dead phones — universally appreciated." },
  { id: "tc-008", name: "Mechanical keyboard", category: "Tech", searchTerm: "mechanical keyboard hot swappable", interests: ["tech"], recipients: ["partner", "friend", "coworker"], occasions: ["birthday", "holiday", "graduation"], tier: "splurge", priceLow: 90, priceHigh: 200, isExperience: false, isDiy: false, why: "A typing upgrade they'll feel every day — perfect for a developer or writer." },
  { id: "tc-009", name: "Smart home hub + smart bulb", category: "Tech", searchTerm: "smart home hub and bulb starter kit", interests: ["tech"], recipients: ["partner", "parent"], occasions: ["anniversary", "holiday", "birthday"], tier: "mid", priceLow: 50, priceHigh: 90, isExperience: false, isDiy: false, why: "A starter pack for the connected home — they can expand from here." },
  { id: "tc-010", name: "Noise-cancelling headphones", category: "Tech", searchTerm: "noise cancelling headphones over ear", interests: ["tech", "books", "sports"], recipients: ["partner", "friend", "coworker", "parent"], occasions: ["birthday", "holiday", "anniversary", "graduation"], tier: "splurge", priceLow: 100, priceHigh: 350, isExperience: false, isDiy: false, why: "Focus, travel, and quiet — a transformative gift for anyone in a noisy life." },
  { id: "tc-011", name: "Raspberry Pi starter kit", category: "Tech", searchTerm: "raspberry pi 4 starter kit", interests: ["tech"], recipients: ["kid", "friend"], occasions: ["birthday", "graduation", "holiday"], tier: "mid", priceLow: 60, priceHigh: 100, isExperience: false, isDiy: true, why: "A gateway to coding and electronics — they learn by building." },
  { id: "tc-012", name: "Phone camera lens kit", category: "Tech", searchTerm: "phone camera lens clip kit", interests: ["tech", "travel"], recipients: ["friend", "kid", "partner"], occasions: ["birthday", "holiday", "graduation"], tier: "low", priceLow: 15, priceHigh: 30, isExperience: false, isDiy: false, why: "Adds wide, macro, and fisheye options to the camera they already carry." },

  // ----- Sports -----
  { id: "sp-001", name: "Yoga mat (premium)", category: "Sports", searchTerm: "premium yoga mat non slip", interests: ["sports"], recipients: ["partner", "parent", "friend", "coworker"], occasions: ["birthday", "holiday", "anniversary", "graduation"], tier: "low", priceLow: 25, priceHigh: 70, isExperience: false, isDiy: false, why: "A daily-use upgrade — the grippy, cushioned kind they wouldn't buy themselves." },
  { id: "sp-002", name: "Insulated water bottle (32 oz)", category: "Sports", searchTerm: "insulated water bottle 32oz", interests: ["sports", "travel", "cooking"], recipients: ["partner", "parent", "friend", "kid", "coworker"], occasions: ["birthday", "holiday", "graduation", "anniversary"], tier: "low", priceLow: 20, priceHigh: 40, isExperience: false, isDiy: false, why: "Stays cold all day — practical for gym, hike, office, or bedside." },
  { id: "sp-003", name: "Resistance band set", category: "Sports", searchTerm: "resistance band set with handles", interests: ["sports"], recipients: ["partner", "friend", "parent"], occasions: ["birthday", "holiday", "graduation"], tier: "low", priceLow: 18, priceHigh: 35, isExperience: false, isDiy: false, why: "A home-gym in a bag — travels well and works for any fitness level." },
  { id: "sp-004", name: "Running shoes (gift card for fit)", category: "Sports", searchTerm: "running shoe store gift card", interests: ["sports"], recipients: ["partner", "friend", "kid", "parent"], occasions: ["birthday", "graduation", "holiday"], tier: "splurge", priceLow: 100, priceHigh: 150, isExperience: false, isDiy: false, why: "Shoes are personal — a gift card to a specialty running store ensures correct fit." },
  { id: "sp-005", name: "Trail / National Parks pass", category: "Sports", searchTerm: "national parks annual pass", interests: ["sports", "travel"], recipients: ["partner", "parent", "friend"], occasions: ["birthday", "anniversary", "holiday", "graduation"], tier: "mid", priceLow: 30, priceHigh: 80, isExperience: true, isDiy: false, why: "A year of access — perfect for hikers who crave a new trail each weekend." },
  { id: "sp-006", name: "Foam roller + stretch strap", category: "Sports", searchTerm: "foam roller and stretch strap set", interests: ["sports"], recipients: ["partner", "friend", "parent", "coworker"], occasions: ["birthday", "holiday", "anniversary"], tier: "low", priceLow: 20, priceHigh: 40, isExperience: false, isDiy: false, why: "Recovery gear that prevents injury — a thoughtful touch for anyone active." },
  { id: "sp-007", name: "Climbing gym day pass + lesson", category: "Sports", searchTerm: "climbing gym day pass with lesson", interests: ["sports"], recipients: ["friend", "kid", "partner"], occasions: ["birthday", "graduation", "holiday"], tier: "low", priceLow: 30, priceHigh: 60, isExperience: true, isDiy: false, why: "An experience to share — beginner-friendly and a great confidence builder." },
  { id: "sp-008", name: "Team jersey (their favorite)", category: "Sports", searchTerm: "team jersey favorite sports", interests: ["sports"], recipients: ["partner", "friend", "kid", "parent"], occasions: ["birthday", "holiday", "graduation"], tier: "mid", priceLow: 50, priceHigh: 130, isExperience: false, isDiy: false, why: "Wear-your-pride gift — only safe if you know their team." },
  { id: "sp-009", name: "Bike multi-tool + flat kit", category: "Sports", searchTerm: "bike multitool and flat repair kit", interests: ["sports"], recipients: ["partner", "friend", "kid", "parent"], occasions: ["birthday", "holiday", "graduation"], tier: "low", priceLow: 20, priceHigh: 45, isExperience: false, isDiy: false, why: "Roadside rescue gear for the cyclist who already has the bike." },
  { id: "sp-010", name: "Golf balls (premium dozen)", category: "Sports", searchTerm: "premium golf balls dozen", interests: ["sports"], recipients: ["parent", "friend", "coworker", "partner"], occasions: ["birthday", "holiday", "graduation"], tier: "mid", priceLow: 30, priceHigh: 60, isExperience: false, isDiy: false, why: "Consumable and always welcome — a safe gift for any golfer." },
  { id: "sp-011", name: "Smart jump rope (counter)", category: "Sports", searchTerm: "smart jump rope with counter", interests: ["sports", "tech"], recipients: ["kid", "friend", "partner"], occasions: ["birthday", "holiday", "graduation"], tier: "low", priceLow: 20, priceHigh: 40, isExperience: false, isDiy: false, why: "Compact cardio they can do anywhere — fun counter gamifies the workout." },
  { id: "sp-012", name: "Tennis lesson (private, 1 hr)", category: "Sports", searchTerm: "private tennis lesson gift certificate", interests: ["sports"], recipients: ["partner", "friend", "kid", "parent"], occasions: ["birthday", "graduation", "anniversary"], tier: "mid", priceLow: 60, priceHigh: 100, isExperience: true, isDiy: false, why: "An hour of pro coaching — perfect for someone who's mentioned wanting to improve." },

  // ----- Cooking -----
  { id: "ck-001", name: "Cast iron skillet (10\")", category: "Kitchen", searchTerm: "cast iron skillet 10 inch preseasoned", interests: ["cooking"], recipients: ["partner", "parent", "friend", "coworker"], occasions: ["birthday", "anniversary", "holiday", "graduation"], tier: "mid", priceLow: 25, priceHigh: 60, isExperience: false, isDiy: false, why: "A workhorse pan that lasts a lifetime — they'll reach for it every week." },
  { id: "ck-002", name: "Espresso machine (entry-level)", category: "Kitchen", searchTerm: "entry level espresso machine", interests: ["cooking"], recipients: ["partner", "parent", "friend"], occasions: ["anniversary", "holiday", "birthday"], tier: "splurge", priceLow: 200, priceHigh: 500, isExperience: false, isDiy: false, why: "A daily ritual upgrade — they'll think of you every morning." },
  { id: "ck-003", name: "Knife sharpening stone (dual-grit)", category: "Kitchen", searchTerm: "dual grit whetstone knife sharpener", interests: ["cooking"], recipients: ["partner", "parent", "friend"], occasions: ["birthday", "holiday", "graduation"], tier: "low", priceLow: 20, priceHigh: 40, isExperience: false, isDiy: true, why: "A skill-builder — sharper knives make cooking safer and more pleasant." },
  { id: "ck-004", name: "Specialty coffee beans (3-bag subscription)", category: "Kitchen", searchTerm: "specialty coffee bean subscription gift", interests: ["cooking"], recipients: ["partner", "parent", "friend", "coworker"], occasions: ["birthday", "holiday", "graduation", "anniversary"], tier: "mid", priceLow: 35, priceHigh: 75, isExperience: false, isDiy: false, why: "Fresh-roasted beans from rotating roasters — a gift that keeps brewing." },
  { id: "ck-005", name: "Sous vide circulator", category: "Kitchen", searchTerm: "sous vide immersion circulator", interests: ["cooking", "tech"], recipients: ["partner", "friend", "parent"], occasions: ["birthday", "holiday", "anniversary"], tier: "mid", priceLow: 80, priceHigh: 200, isExperience: false, isDiy: false, why: "Restaurant-quality results at home — perfect for the experimental cook." },
  { id: "ck-006", name: "Cooking class (in-person, 2 hr)", category: "Kitchen", searchTerm: "in person cooking class gift certificate", interests: ["cooking"], recipients: ["partner", "friend", "parent", "kid"], occasions: ["birthday", "anniversary", "holiday", "graduation"], tier: "mid", priceLow: 60, priceHigh: 150, isExperience: true, isDiy: false, why: "An experience to share — they learn a cuisine and you make a memory." },
  { id: "ck-007", name: "Spice sampler set (global)", category: "Kitchen", searchTerm: "global spice sampler set gift", interests: ["cooking"], recipients: ["friend", "parent", "partner", "coworker"], occasions: ["birthday", "holiday", "graduation"], tier: "low", priceLow: 20, priceHigh: 40, isExperience: false, isDiy: false, why: "Small jars of new flavors — invites experimentation without breaking the pantry." },
  { id: "ck-008", name: "Enamel Dutch oven (5 qt)", category: "Kitchen", searchTerm: "enamel dutch oven 5 quart", interests: ["cooking"], recipients: ["partner", "parent", "friend"], occasions: ["anniversary", "holiday", "birthday"], tier: "splurge", priceLow: 90, priceHigh: 350, isExperience: false, isDiy: false, why: "Stews, breads, braises — a stunning centerpiece pot they'll hand down." },
  { id: "ck-009", name: "Pizza steel (baking stone upgrade)", category: "Kitchen", searchTerm: "pizza steel baking stone", interests: ["cooking"], recipients: ["partner", "friend", "parent"], occasions: ["birthday", "holiday", "graduation"], tier: "mid", priceLow: 60, priceHigh: 130, isExperience: false, isDiy: false, why: "Restaurant-style crust at home — the upgrade they didn't know existed." },
  { id: "ck-010", name: "Instant-read thermometer", category: "Kitchen", searchTerm: "instant read meat thermometer", interests: ["cooking"], recipients: ["partner", "parent", "friend", "coworker"], occasions: ["birthday", "holiday", "graduation", "anniversary"], tier: "low", priceLow: 20, priceHigh: 50, isExperience: false, isDiy: false, why: "Takes the guesswork out of meat, bread, and candy — a small, life-changing tool." },
  { id: "ck-011", name: "Stand mixer attachment pack", category: "Kitchen", searchTerm: "stand mixer attachment pack gift", interests: ["cooking"], recipients: ["partner", "parent", "friend"], occasions: ["anniversary", "holiday", "birthday"], tier: "splurge", priceLow: 100, priceHigh: 250, isExperience: false, isDiy: false, why: "Expands a stand mixer they already own — pasta, grinder, or spiralizer." },
  { id: "ck-012", name: "Handmade wooden cutting board", category: "Kitchen", searchTerm: "handmade wooden cutting board end grain", interests: ["cooking"], recipients: ["partner", "parent", "friend", "coworker"], occasions: ["birthday", "holiday", "anniversary", "graduation"], tier: "mid", priceLow: 35, priceHigh: 90, isExperience: false, isDiy: true, why: "A kitchen centerpiece — beautiful, useful, and ages well with use." },

  // ----- Travel -----
  { id: "tr-001", name: "Packing cubes (set of 5)", category: "Travel", searchTerm: "packing cubes set of 5", interests: ["travel"], recipients: ["partner", "parent", "friend", "kid", "coworker"], occasions: ["birthday", "holiday", "graduation", "anniversary"], tier: "low", priceLow: 18, priceHigh: 35, isExperience: false, isDiy: false, why: "A small upgrade that turns chaos into order — they'll never go back." },
  { id: "tr-002", name: "Carry-on backpack (40L)", category: "Travel", searchTerm: "40l carry on travel backpack", interests: ["travel", "tech"], recipients: ["partner", "friend", "kid", "coworker"], occasions: ["birthday", "holiday", "graduation"], tier: "mid", priceLow: 60, priceHigh: 150, isExperience: false, isDiy: false, why: "Carry-on-only travel — a backpack that fits under the seat and saves the bag fee." },
  { id: "tr-003", name: "Neck pillow (memory foam)", category: "Travel", searchTerm: "memory foam neck pillow travel", interests: ["travel"], recipients: ["partner", "parent", "friend", "kid", "coworker"], occasions: ["birthday", "holiday", "graduation"], tier: "low", priceLow: 20, priceHigh: 40, isExperience: false, isDiy: false, why: "Sleep on the plane, arrive human — a small luxury with daily-trip payoff." },
  { id: "tr-004", name: "Scratch-off world map (framed)", category: "Travel", searchTerm: "scratch off world map framed poster", interests: ["travel"], recipients: ["partner", "friend", "kid"], occasions: ["birthday", "anniversary", "holiday", "graduation"], tier: "low", priceLow: 20, priceHigh: 45, isExperience: false, isDiy: false, why: "A visual record of trips past and a wishlist for trips future." },
  { id: "tr-005", name: "Airline gift card ($100)", category: "Travel", searchTerm: "airline gift card 100", interests: ["travel"], recipients: ["partner", "parent", "friend", "kid"], occasions: ["birthday", "anniversary", "holiday", "graduation"], tier: "mid", priceLow: 100, priceHigh: 100, isExperience: false, isDiy: false, why: "A nudge toward their next trip — flexible across dates and routes." },
  { id: "tr-006", name: "Travel adapter (universal)", category: "Travel", searchTerm: "universal travel adapter usb c", interests: ["travel", "tech"], recipients: ["partner", "parent", "friend", "coworker", "kid"], occasions: ["birthday", "holiday", "graduation", "anniversary"], tier: "low", priceLow: 18, priceHigh: 35, isExperience: false, isDiy: false, why: "Works in 150+ countries — they'll never need to buy another adapter." },
  { id: "tr-007", name: "Weekend getaway (Airbnb card + dinner)", category: "Travel", searchTerm: "airbnb gift card plus restaurant voucher", interests: ["travel", "cooking"], recipients: ["partner"], occasions: ["anniversary", "birthday", "holiday"], tier: "splurge", priceLow: 200, priceHigh: 500, isExperience: true, isDiy: false, why: "Time together is the gift — let them pick the place and the restaurant." },
  { id: "tr-008", name: "Packing checklist notebook (custom)", category: "Travel", searchTerm: "travel packing checklist notebook", interests: ["travel", "books"], recipients: ["friend", "parent", "coworker"], occasions: ["birthday", "holiday", "graduation"], tier: "low", priceLow: 12, priceHigh: 25, isExperience: false, isDiy: true, why: "A thoughtful planning tool — every trip starts with a list." },
  { id: "tr-009", name: "Luggage scale (digital)", category: "Travel", searchTerm: "digital luggage scale", interests: ["travel"], recipients: ["partner", "parent", "friend", "coworker"], occasions: ["birthday", "holiday", "graduation"], tier: "low", priceLow: 12, priceHigh: 25, isExperience: false, isDiy: false, why: "Avoid the overweight-bag fee — small, useful, and cheap." },
  { id: "tr-010", name: "Travel journal + photo pockets", category: "Travel", searchTerm: "travel journal with photo sleeves", interests: ["travel", "books"], recipients: ["partner", "friend", "kid", "parent"], occasions: ["birthday", "anniversary", "holiday", "graduation"], tier: "low", priceLow: 18, priceHigh: 35, isExperience: false, isDiy: false, why: "Captures the trip in their own words — far better than phone photos alone." },
  { id: "tr-011", name: "Day pack (16L, packable)", category: "Travel", searchTerm: "packable daypack 16 liter", interests: ["travel", "sports"], recipients: ["partner", "friend", "kid", "parent"], occasions: ["birthday", "holiday", "graduation"], tier: "low", priceLow: 20, priceHigh: 40, isExperience: false, isDiy: false, why: "Folds into a pocket — perfect day-trip bag that disappears when not needed." },
  { id: "tr-012", name: "Museum / attraction annual membership", category: "Travel", searchTerm: "museum annual membership gift", interests: ["travel", "books"], recipients: ["parent", "friend", "kid", "coworker"], occasions: ["birthday", "holiday", "graduation"], tier: "mid", priceLow: 50, priceHigh: 150, isExperience: true, isDiy: false, why: "A year of free admission — perfect for someone who loves exploring their own city." },

  // ----- Cross-interest / Universal -----
  { id: "un-001", name: "Handwritten letter + favorite photo (framed)", category: "Keepsake", searchTerm: "framed photo with handwritten letter", interests: ["books", "travel", "cooking"], recipients: ["partner", "parent", "friend"], occasions: ["anniversary", "birthday", "graduation", "holiday"], tier: "low", priceLow: 5, priceHigh: 25, isExperience: false, isDiy: true, why: "Often the most-loved gift — slow, personal, and irreplaceable." },
  { id: "un-002", name: "Gourmet chocolate box (small-batch)", category: "Food", searchTerm: "small batch gourmet chocolate box", interests: ["cooking", "books"], recipients: ["partner", "parent", "friend", "coworker", "kid"], occasions: ["birthday", "anniversary", "holiday", "graduation"], tier: "low", priceLow: 15, priceHigh: 40, isExperience: false, isDiy: false, why: "Universally welcome — consumable, so it never clutters." },
  { id: "un-003", name: "Charitable donation in their name", category: "Giving", searchTerm: "charitable donation gift card", interests: ["books", "tech", "sports", "cooking", "travel"], recipients: ["parent", "friend", "coworker"], occasions: ["birthday", "holiday", "graduation", "anniversary"], tier: "mid", priceLow: 25, priceHigh: 100, isExperience: true, isDiy: false, why: "For the person who has everything — they pick the cause, you fund it." },
  { id: "un-004", name: "Custom playlist + liner notes", category: "Music", searchTerm: "custom spotify playlist with liner notes", interests: ["books", "travel", "cooking"], recipients: ["partner", "friend", "kid"], occasions: ["birthday", "anniversary", "graduation", "holiday"], tier: "low", priceLow: 0, priceHigh: 0, isExperience: false, isDiy: true, why: "Free, personal, and forever — the mixtape of the streaming age." },
  { id: "un-005", name: "Houseplant (low-light, hardy)", category: "Home", searchTerm: "low light houseplant snake pothos", interests: ["cooking", "books"], recipients: ["partner", "parent", "friend", "coworker"], occasions: ["birthday", "anniversary", "holiday", "graduation"], tier: "low", priceLow: 15, priceHigh: 40, isExperience: false, isDiy: false, why: "Living, growing, low-maintenance — a gentle presence that lasts for years." },
  { id: "un-006", name: "Experience day (escape room, museum, tour)", category: "Experience", searchTerm: "experience day gift card escape room tour", interests: ["tech", "sports", "cooking", "travel", "books"], recipients: ["partner", "friend", "kid", "parent", "coworker"], occasions: ["birthday", "anniversary", "holiday", "graduation"], tier: "mid", priceLow: 30, priceHigh: 100, isExperience: true, isDiy: false, why: "A memory, not a thing — they choose what to do, you fund the day." },
  { id: "un-007", name: "Handwritten coupon book (favors)", category: "Keepsake", searchTerm: "handwritten coupon book favors template", interests: ["books", "cooking", "travel"], recipients: ["partner", "parent", "friend", "kid"], occasions: ["anniversary", "birthday", "holiday", "graduation"], tier: "low", priceLow: 0, priceHigh: 0, isExperience: true, isDiy: true, why: "Homemade, redeemable favors — breakfast in bed, one chore-free day, etc." },
  { id: "un-008", name: "Group-funded big gift (split cost)", category: "Group Gift", searchTerm: "group gift split cost collection", interests: ["tech", "sports", "cooking", "travel", "books"], recipients: ["partner", "parent", "friend", "kid"], occasions: ["birthday", "anniversary", "graduation", "holiday"], tier: "splurge", priceLow: 50, priceHigh: 500, isExperience: false, isDiy: false, why: "Combine budgets to get the big thing they'd never buy solo." },
];

// ---------- Constants ----------

export const HISTORY_MAX = 20;
export const PROFILE_MAX = 20;

export const HONESTY_NOTE =
  "Ideas are suggestions, not endorsements. We earn nothing from what you buy and never insert affiliate IDs. Shopping hints are neutral category + search-term pairs — paste them into any retailer you trust. On-device matching is less nuanced than a BYO-key LLM; review before purchasing.";

export const LLM_KEY_STORAGE = "unqtools:ai-gift-idea-generator:llm-key";

// ---------- Helpers ----------

/** Lowercase + collapse whitespace + trim. */
export function normalizeString(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Parse multi-line / comma-separated list (interests or avoid-list). */
export function parseList(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,;]+/)
    .map((s) => normalizeString(s))
    .filter(Boolean);
}

/** Validate a recipient profile. Returns warnings (empty = OK). */
export function validateProfile(profile: RecipientProfile): string[] {
  const warnings: string[] = [];
  if (!profile.name.trim()) warnings.push("Add a recipient name so you can tell profiles apart.");
  if (profile.age <= 0) warnings.push("Age must be greater than 0.");
  if (profile.age > 120) warnings.push("Age looks too high — double check.");
  if (profile.interests.length === 0) warnings.push("Pick at least one interest for better matches.");
  if (profile.avoid.length > 30) warnings.push("Avoid list is very long — fewer past-gifts means more fresh ideas.");
  return warnings;
}

/** Format a price range. */
export function formatPriceRange(low: number, high: number): string {
  if (low === 0 && high === 0) return "Free";
  if (low === high) return `$${low}`;
  return `$${low}–$${high}`;
}

/** Check if a gift name matches an avoid entry (substring, case-insensitive). */
export function matchesAvoid(giftName: string, avoid: string[]): boolean {
  const n = normalizeString(giftName);
  return avoid.some((a) => n.includes(normalizeString(a)));
}

/** Score a gift seed against a profile. Higher = better fit. */
export function scoreGift(seed: GiftSeed, profile: RecipientProfile): number {
  let score = 0;
  // Tier must match (hard filter returns -1 elsewhere, but we soft-score here)
  if (seed.tier === profile.budget) score += 50;
  else if (profile.budget === "splurge" && seed.tier === "mid") score += 20;
  else if (profile.budget === "low" && seed.tier === "mid") score += 5;
  // Recipient match
  if (seed.recipients.includes(profile.recipient)) score += 30;
  // Occasion match
  if (seed.occasions.includes(profile.occasion)) score += 20;
  // Interest match (per interest — encourages multi-interest overlap)
  let interestMatch = 0;
  for (const interest of profile.interests) {
    if (seed.interests.includes(interest)) interestMatch += 1;
  }
  score += interestMatch * 25;
  // Experience preference
  if (profile.preferExperience && seed.isExperience) score += 15;
  if (profile.preferExperience && !seed.isExperience) score -= 10;
  // DIY mode
  if (profile.diyMode && seed.isDiy) score += 10;
  // Age appropriateness (kids)
  if (profile.recipient === "kid" && profile.age > 0 && profile.age < 13) {
    if (seed.recipients.includes("kid")) score += 10;
  }
  return score;
}

/** Filter + rank gifts for a profile. Always returns at least the matched slice. */
export function generateGifts(profile: RecipientProfile): GiftSuggestion[] {
  const avoid = profile.avoid;
  const scored = GIFT_DATABASE
    .filter((seed) => !matchesAvoid(seed.name, avoid))
    .map((seed) => {
      const score = scoreGift(seed, profile);
      const matchedInterests = seed.interests.filter((i) => profile.interests.includes(i));
      const matchedInterest = matchedInterests[0] ?? null;
      return {
        id: seed.id,
        name: seed.name,
        category: seed.category,
        searchTerm: seed.searchTerm,
        tier: seed.tier,
        priceLow: seed.priceLow,
        priceHigh: seed.priceHigh,
        priceRange: formatPriceRange(seed.priceLow, seed.priceHigh),
        isExperience: seed.isExperience,
        isDiy: seed.isDiy,
        why: seed.why,
        score,
        matchedInterest,
      } satisfies GiftSuggestion;
    })
    // Keep only positive-score matches; if profile is thin, accept score > 0
    .filter((g) => g.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored;
}

/** Generate a full plan, capped at maxResults (default 12). */
export function generatePlan(
  profile: RecipientProfile,
  maxResults = 12,
): GiftPlan {
  const warnings = validateProfile(profile);
  const suggestions = generateGifts(profile).slice(0, maxResults);
  if (suggestions.length < 5) {
    warnings.push(
      `Only ${suggestions.length} strong matches — add interests or relax the budget tier for more ideas.`,
    );
  }
  return {
    profile,
    suggestions,
    count: suggestions.length,
    generatedAt: Date.now(),
    warnings,
  };
}

/** Group suggestions by budget tier. */
export function groupByTier(
  suggestions: GiftSuggestion[],
): Record<BudgetTier, GiftSuggestion[]> {
  const groups: Record<BudgetTier, GiftSuggestion[]> = {
    low: [],
    mid: [],
    splurge: [],
  };
  for (const s of suggestions) groups[s.tier].push(s);
  return groups;
}

/** Build a neutral shopping-search URL (not an affiliate link). */
export function buildShoppingUrl(searchTerm: string): string {
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(searchTerm)}`;
}

// ---------- Renderers ----------

export function renderText(plan: GiftPlan): string {
  const lines: string[] = [];
  lines.push("GIFT IDEA LIST");
  lines.push(`Recipient: ${plan.profile.name} (${RECIPIENT_LABELS[plan.profile.recipient]})`);
  lines.push(`Occasion: ${OCCASION_LABELS[plan.profile.occasion]}`);
  lines.push(`Budget: ${BUDGET_LABELS[plan.profile.budget]}`);
  lines.push(`Interests: ${plan.profile.interests.map((i) => INTEREST_LABELS[i]).join(", ")}`);
  lines.push(`Generated: ${new Date(plan.generatedAt).toLocaleString()}`);
  lines.push("");
  if (plan.warnings.length > 0) {
    lines.push("NOTES:");
    for (const w of plan.warnings) lines.push(`  - ${w}`);
    lines.push("");
  }
  lines.push("SUGGESTIONS:");
  plan.suggestions.forEach((s, i) => {
    lines.push("");
    lines.push(`${i + 1}. ${s.name}  [${s.priceRange}]`);
    lines.push(`   Category: ${s.category}`);
    lines.push(`   Tier: ${BUDGET_LABELS[s.tier]}`);
    if (s.isExperience) lines.push("   Type: Experience");
    else if (s.isDiy) lines.push("   Type: DIY / homemade");
    lines.push(`   Search term: ${s.searchTerm}`);
    lines.push(`   Why this fits: ${s.why}`);
  });
  lines.push("");
  lines.push(HONESTY_NOTE);
  return lines.join("\n");
}

export function renderMarkdown(plan: GiftPlan): string {
  const lines: string[] = [];
  lines.push(`# Gift ideas for ${plan.profile.name}`);
  lines.push("");
  lines.push(`**Recipient:** ${RECIPIENT_LABELS[plan.profile.recipient]}  `);
  lines.push(`**Occasion:** ${OCCASION_LABELS[plan.profile.occasion]}  `);
  lines.push(`**Budget:** ${BUDGET_LABELS[plan.profile.budget]}  `);
  lines.push(`**Interests:** ${plan.profile.interests.map((i) => INTEREST_LABELS[i]).join(", ")}  `);
  lines.push(`**Generated:** ${new Date(plan.generatedAt).toLocaleString()}`);
  lines.push("");
  if (plan.warnings.length > 0) {
    lines.push("> **Notes**");
    for (const w of plan.warnings) lines.push(`> - ${w}`);
    lines.push("");
  }
  lines.push("## Suggestions");
  lines.push("");
  plan.suggestions.forEach((s, i) => {
    const typeBadge = s.isExperience ? " (experience)" : s.isDiy ? " (DIY)" : "";
    lines.push(`${i + 1}. **${s.name}** — ${s.priceRange}${typeBadge}`);
    lines.push(`   - *Category:* ${s.category}`);
    lines.push(`   - *Tier:* ${BUDGET_LABELS[s.tier]}`);
    lines.push(`   - *Search term:* \`${s.searchTerm}\``);
    lines.push(`   - *Why this fits:* ${s.why}`);
  });
  lines.push("");
  lines.push("---");
  lines.push(`*${HONESTY_NOTE}*`);
  return lines.join("\n");
}

export function renderJson(plan: GiftPlan): string {
  return JSON.stringify(plan, null, 2);
}

export function renderCsv(plan: GiftPlan): string {
  const lines = ["rank,name,category,tier,price_low,price_high,price_range,is_experience,is_diy,search_term,why"];
  plan.suggestions.forEach((s, i) => {
    lines.push([
      i + 1,
      escapeCsv(s.name),
      escapeCsv(s.category),
      s.tier,
      s.priceLow,
      s.priceHigh,
      escapeCsv(s.priceRange),
      s.isExperience ? "yes" : "no",
      s.isDiy ? "yes" : "no",
      escapeCsv(s.searchTerm),
      escapeCsv(s.why),
    ].join(","));
  });
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------- History (localStorage) ----------

const HISTORY_KEY = "unqtools:ai-gift-idea-generator:history";

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

// ---------- Saved profiles (localStorage) ----------

const PROFILES_KEY = "unqtools:ai-gift-idea-generator:profiles";

export function loadProfiles(): SavedProfile[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as SavedProfile[];
    return Array.isArray(arr) ? arr.slice(0, PROFILE_MAX) : [];
  } catch {
    return [];
  }
}

export function saveProfile(profile: RecipientProfile): SavedProfile[] {
  const next = [{ id: makeId("profile"), profile, savedAt: Date.now() }, ...loadProfiles()].slice(0, PROFILE_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(PROFILES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function removeProfile(id: string): SavedProfile[] {
  const next = loadProfiles().filter((p) => p.id !== id);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(PROFILES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearProfiles(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(PROFILES_KEY);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export interface ShareState {
  name: string;
  recipient: RecipientType;
  age: number;
  interests: Interest[];
  occasion: Occasion;
  budget: BudgetTier;
  avoid: string[];
  preferExperience: boolean;
  diyMode: boolean;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("name", state.name);
  params.set("recipient", state.recipient);
  params.set("age", String(state.age));
  params.set("interests", state.interests.join(","));
  params.set("occasion", state.occasion);
  params.set("budget", state.budget);
  if (state.avoid.length > 0) params.set("avoid", state.avoid.join(","));
  if (state.preferExperience) params.set("exp", "1");
  if (state.diyMode) params.set("diy", "1");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const name = params.get("name") ?? "";
  const recipient = (params.get("recipient") as RecipientType) ?? "friend";
  const age = Number(params.get("age") ?? "30");
  const interestsStr = params.get("interests") ?? "";
  const validInterests = Object.keys(INTEREST_LABELS) as Interest[];
  const interests = interestsStr
    ? (interestsStr.split(",").filter((i) => validInterests.includes(i as Interest)) as Interest[])
    : [];
  const occasion = (params.get("occasion") as Occasion) ?? "birthday";
  const budget = (params.get("budget") as BudgetTier) ?? "mid";
  const avoidStr = params.get("avoid") ?? "";
  const avoid = avoidStr ? parseList(avoidStr) : [];
  const preferExperience = params.get("exp") === "1";
  const diyMode = params.get("diy") === "1";
  if (!name && interests.length === 0) return null;
  return { name, recipient, age, interests, occasion, budget, avoid, preferExperience, diyMode };
}

// ---------- ID generation ----------

let _idCounter = 0;

export function makeId(prefix = "id"): string {
  _idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${_idCounter.toString(36)}`;
}

// ---------- LLM prompt (BYO-key; the call itself lives in ui.tsx) ----------

export function buildLlmPrompt(profile: RecipientProfile, existing: GiftSuggestion[]): string {
  const lines: string[] = [];
  lines.push("You are a thoughtful gift advisor. Generate 5 fresh gift ideas for this recipient.");
  lines.push(`Name: ${profile.name}`);
  lines.push(`Relationship: ${RECIPIENT_LABELS[profile.recipient]}`);
  lines.push(`Age: ${profile.age}`);
  lines.push(`Interests: ${profile.interests.map((i) => INTEREST_LABELS[i]).join(", ")}`);
  lines.push(`Occasion: ${OCCASION_LABELS[profile.occasion]}`);
  lines.push(`Budget tier: ${BUDGET_LABELS[profile.budget]}`);
  if (profile.avoid.length > 0) {
    lines.push(`Avoid (already gifted or disliked): ${profile.avoid.join(", ")}`);
  }
  lines.push(`Preference: ${profile.preferExperience ? "experiences over objects" : "no preference"}`);
  if (profile.diyMode) lines.push("DIY-friendly ideas preferred.");
  lines.push("");
  lines.push("Already-suggested (do not repeat):");
  for (const s of existing.slice(0, 8)) lines.push(`  - ${s.name}`);
  lines.push("");
  lines.push("For each idea, return: name, category, price range (USD), why it fits, and a neutral search term. No affiliate links. No retailer endorsements.");
  return lines.join("\n");
}

export interface LlmEnhancement {
  suggestions: Array<{
    name: string;
    category: string;
    priceRange: string;
    why: string;
    searchTerm: string;
  }>;
  raw: string;
  model: string;
}

/** Best-effort parse of LLM text output into structured suggestions. */
export function parseLlmResult(raw: string, model: string): LlmEnhancement {
  const suggestions: LlmEnhancement["suggestions"] = [];
  // Try to parse numbered list lines: "1. Name — $X–$Y: why (search: term)"
  const lines = raw.split(/\n+/);
  for (const line of lines) {
    const m = line.match(/^\s*\d+[\.\)]\s*(.+?)\s*(?:[-—:]\s*(.+?))?\s*$/);
    if (!m) continue;
    const name = (m[1] || "").trim();
    if (!name) continue;
    suggestions.push({
      name,
      category: "LLM",
      priceRange: "",
      why: (m[2] || "").trim() || "Generated by LLM.",
      searchTerm: name.toLowerCase(),
    });
    if (suggestions.length >= 12) break;
  }
  return { suggestions, raw, model };
}

export function renderLlmResult(en: LlmEnhancement): string {
  const lines: string[] = [];
  lines.push(`LLM-polished suggestions (model: ${en.model}):`);
  lines.push("");
  en.suggestions.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.name}${s.priceRange ? `  [${s.priceRange}]` : ""}`);
    if (s.why) lines.push(`   Why: ${s.why}`);
    if (s.searchTerm) lines.push(`   Search: ${s.searchTerm}`);
  });
  return lines.join("\n");
}
