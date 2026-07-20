/**
 * AI Travel Itinerary Planner — pure logic.
 *
 * Builds a day-by-day travel itinerary (activities, meals, timing,
 * transit gaps) from destination, duration, pace, budget, trip type,
 * and interests. Five trip-type templates: city break, beach,
 * adventure, cultural, foodie. Realistic timing with travel-gap
 * awareness and opening-hours notes. Map-ready stop list with .ics
 * calendar / Markdown / text export. Pure-JS engine — no DOM, no
 * network. The optional LLM call (BYO API key) lives in ui.tsx
 * because it touches the network.
 *
 * Pure functions only.
 */

// ---------- Types ----------

export type TripType = "city-break" | "beach" | "adventure" | "cultural" | "foodie";

export type Pace = "relaxed" | "balanced" | "packed";

export type Budget = "budget" | "mid-range" | "luxury";

export type Interest =
  | "history" | "art" | "nature" | "nightlife" | "shopping"
  | "family" | "photography" | "wellness" | "architecture" | "local-life";

export type StopKind = "activity" | "meal" | "transit" | "rest";

export interface ItineraryInput {
  destination: string;
  days: number;
  pace: Pace;
  budget: Budget;
  tripType: TripType;
  interests: Interest[];
  startDate?: string; // ISO yyyy-mm-dd
  travelers?: number;
}

export interface Stop {
  id: string;
  name: string;
  kind: StopKind;
  startTime: string;    // HH:MM (24h)
  endTime: string;      // HH:MM (24h)
  durationMin: number;
  location: string;
  notes: string;
  mapQuery: string;     // query string for maps
  openingHours?: string;
  costEstimate?: number; // local currency units, per person
  verifyNote?: string;
}

export interface DayPlan {
  dayIndex: number;     // 1-based
  date?: string;        // ISO yyyy-mm-dd
  city: string;
  stops: Stop[];
  totalCostEstimate: number;
  paceNote: string;
  walkingDistanceKm: number;
}

export interface ItineraryStats {
  totalStops: number;
  totalActivities: number;
  totalMeals: number;
  totalCost: number;
  avgStopsPerDay: number;
  estimatedCostPerDay: number;
}

export interface ItineraryResult {
  id: string;
  input: ItineraryInput;
  cities: string[];
  days: DayPlan[];
  stats: ItineraryStats;
  localTips: string[];
  generatedAt: number;
  verifyNote: string;
}

export interface HistoryEntry {
  ts: number;
  destination: string;
  days: number;
  tripType: TripType;
  pace: Pace;
  budget: Budget;
  stopCount: number;
}

export interface ShareState {
  destination: string;
  days: number;
  pace: Pace;
  budget: Budget;
  tripType: TripType;
  interests: Interest[];
  startDate?: string;
  travelers?: number;
}

export interface LlmRequestBody {
  model: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  temperature: number;
  max_tokens: number;
}

// ---------- Labels ----------

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
  "city-break": "City Break",
  beach: "Beach",
  adventure: "Adventure",
  cultural: "Cultural",
  foodie: "Foodie",
};

export const PACE_LABELS: Record<Pace, string> = {
  relaxed: "Relaxed",
  balanced: "Balanced",
  packed: "Packed",
};

export const BUDGET_LABELS: Record<Budget, string> = {
  budget: "Budget",
  "mid-range": "Mid-range",
  luxury: "Luxury",
};

export const INTEREST_LABELS: Record<Interest, string> = {
  history: "History",
  art: "Art & Museums",
  nature: "Nature & Outdoors",
  nightlife: "Nightlife",
  shopping: "Shopping",
  family: "Family-friendly",
  photography: "Photography",
  wellness: "Wellness & Spa",
  architecture: "Architecture",
  "local-life": "Local life",
};

export const SAMPLE_DESTINATIONS: string[] = [
  "Paris",
  "Tokyo",
  "Barcelona",
  "New York",
  "Bangkok",
  "Rome",
  "Lisbon",
  "Reykjavik",
  "Marrakech",
  "Kyoto",
  "Mexico City",
  "Cape Town",
];

// ---------- Input normalization ----------

export function normalizeDestination(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim().slice(0, 120);
}

export function clampDays(n: number): number {
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(30, Math.floor(n)));
}

export function normalizeTravelers(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(20, Math.floor(n));
}

const VALID_INTERESTS: Interest[] = [
  "history", "art", "nature", "nightlife", "shopping",
  "family", "photography", "wellness", "architecture", "local-life",
];

export function normalizeInterests(arr: unknown): Interest[] {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<Interest>();
  for (const v of arr) {
    if (typeof v === "string" && (VALID_INTERESTS as string[]).includes(v)) {
      seen.add(v as Interest);
    }
  }
  return Array.from(seen);
}

export function parseInterestText(s: string): Interest[] {
  const lower = (s || "").toLowerCase();
  const out: Interest[] = [];
  for (const k of VALID_INTERESTS) {
    const label = INTEREST_LABELS[k].toLowerCase();
    if (lower.includes(label) || lower.includes(k)) {
      out.push(k);
    }
  }
  return out;
}

/** Parse multi-city destinations like "Paris -> Lyon" or "Paris to Lyon". */
export function parseCities(destination: string): string[] {
  const d = normalizeDestination(destination);
  if (!d) return [];
  const parts = d
    .split(/\s*(?:->|→|to|then|and then)\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [d];
  // Dedupe case-insensitively
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

// ---------- Time helpers ----------

export function timeToMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return 0;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  return h * 60 + min;
}

export function minutesToTime(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function addMinutes(hhmm: string, mins: number): string {
  return minutesToTime(timeToMinutes(hhmm) + mins);
}

/** Add `days` to an ISO yyyy-mm-dd date, returning ISO yyyy-mm-dd. */
export function addDays(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

// ---------- Travel-time + cost heuristics ----------

/** Estimate travel gap (minutes) between two stops, given pace. */
export function estimateTravelGap(pace: Pace, withinCity = true): number {
  const base = withinCity ? 15 : 60;
  const mult = pace === "packed" ? 0.7 : pace === "relaxed" ? 1.4 : 1;
  return Math.round(base * mult);
}

/** Estimate per-person cost (in local units) for a stop, given budget. */
export function estimateCost(
  kind: StopKind,
  baseCost: number,
  budget: Budget,
): number {
  const mult = budget === "budget" ? 0.6 : budget === "luxury" ? 2.0 : 1;
  if (kind === "meal") return Math.round(baseCost * mult);
  if (kind === "activity") return Math.round(baseCost * mult);
  return 0;
}

/** Pace-driven activity duration multiplier. */
export function paceDurationFactor(pace: Pace): number {
  return pace === "packed" ? 0.75 : pace === "relaxed" ? 1.3 : 1;
}

/** Pace-driven maximum stops per day. */
export function maxStopsPerDay(pace: Pace): number {
  return pace === "packed" ? 8 : pace === "relaxed" ? 4 : 6;
}

// ---------- Templates ----------

interface ActivityTemplate {
  id: string;
  tripTypes: TripType[];
  interests?: Interest[];
  name: string;
  baseDurationMin: number;
  openingHours: string;
  baseCost: number;
  notes: string;
  mapKind: string; // what to search in maps
}

interface MealTemplate {
  id: string;
  slot: "breakfast" | "lunch" | "dinner";
  tripTypes: TripType[];
  name: string;
  baseDurationMin: number;
  baseCost: number;
  notes: string;
}

const ACTIVITIES: ActivityTemplate[] = [
  // City break
  { id: "cb-museum", tripTypes: ["city-break", "cultural"], interests: ["art", "history"], name: "Major art or history museum", baseDurationMin: 120, openingHours: "10:00-18:00, closed Mon", baseCost: 18, notes: "Buy tickets online to skip queues; allow extra time for the highlight gallery.", mapKind: "museum" },
  { id: "cb-oldtown", tripTypes: ["city-break", "cultural"], interests: ["history", "architecture", "photography"], name: "Old town walking tour", baseDurationMin: 150, openingHours: "Always (self-guided)", baseCost: 0, notes: "Wear comfortable shoes; download an offline map first.", mapKind: "old town" },
  { id: "cb-landmark", tripTypes: ["city-break"], interests: ["photography", "architecture"], name: "Iconic landmark / viewpoint", baseDurationMin: 90, openingHours: "08:00-22:00", baseCost: 25, notes: "Go at golden hour for the best light and thinner crowds.", mapKind: "landmark viewpoint" },
  { id: "cb-market", tripTypes: ["city-break", "foodie"], interests: ["local-life", "shopping"], name: "Central food market", baseDurationMin: 75, openingHours: "08:00-15:00, closed Sun", baseCost: 12, notes: "Bring cash; try the regional specialty at the busiest stall.", mapKind: "food market" },
  // Beach
  { id: "be-beach", tripTypes: ["beach"], interests: ["nature", "wellness", "family"], name: "Beach time + swim", baseDurationMin: 240, openingHours: "Always (lifeguard 09:00-18:00)", baseCost: 8, notes: "Reapply sunscreen hourly; check the local flag-warning system.", mapKind: "main beach" },
  { id: "be-snorkel", tripTypes: ["beach", "adventure"], interests: ["nature", "family"], name: "Snorkel or boat tour", baseDurationMin: 180, openingHours: "09:00-17:00", baseCost: 55, notes: "Bring a refillable water bottle; sea conditions vary — confirm the morning of.", mapKind: "snorkel tour" },
  { id: "be-sunset", tripTypes: ["beach"], interests: ["photography"], name: "Sunset viewpoint", baseDurationMin: 60, openingHours: "Always", baseCost: 0, notes: "Arrive 30 min before local sunset time.", mapKind: "sunset viewpoint" },
  // Adventure
  { id: "ad-hike", tripTypes: ["adventure"], interests: ["nature", "photography", "wellness"], name: "Half-day guided hike", baseDurationMin: 240, openingHours: "07:00-15:00", baseCost: 45, notes: "Carry 2L water per person; tell someone your route.", mapKind: "trailhead" },
  { id: "ad-kayak", tripTypes: ["adventure"], interests: ["nature", "family"], name: "Kayak / paddle rental", baseDurationMin: 150, openingHours: "09:00-18:00", baseCost: 30, notes: "Wear a PFD at all times; check wind forecast before launching.", mapKind: "kayak rental" },
  { id: "ad-climb", tripTypes: ["adventure"], interests: ["nature", "wellness"], name: "Climbing or via ferrata session", baseDurationMin: 240, openingHours: "08:00-16:00", baseCost: 70, notes: "Beginners must use a guide; book ahead in peak season.", mapKind: "climbing center" },
  // Cultural
  { id: "cu-temple", tripTypes: ["cultural"], interests: ["history", "architecture"], name: "Historic temple / cathedral visit", baseDurationMin: 90, openingHours: "07:00-19:00", baseCost: 10, notes: "Dress modestly (covered shoulders and knees); silence phones.", mapKind: "temple" },
  { id: "cu-show", tripTypes: ["cultural"], interests: ["art"], name: "Local performance / concert", baseDurationMin: 120, openingHours: "19:30-22:00", baseCost: 35, notes: "Book same-day rush tickets if available.", mapKind: "concert hall" },
  { id: "cu-workshop", tripTypes: ["cultural", "foodie"], interests: ["local-life", "art"], name: "Craft or cooking workshop", baseDurationMin: 180, openingHours: "10:00-17:00", baseCost: 50, notes: "Take home what you make; confirm materials are included.", mapKind: "workshop studio" },
  // Foodie
  { id: "fo-tour", tripTypes: ["foodie"], interests: ["local-life"], name: "Guided food tour", baseDurationMin: 180, openingHours: "11:00-15:00 / 17:00-21:00", baseCost: 70, notes: "Come hungry; tours cover 5-6 stops. Mention allergies when booking.", mapKind: "food tour meeting point" },
  { id: "fo-class", tripTypes: ["foodie"], interests: ["local-life"], name: "Hands-on cooking class", baseDurationMin: 180, openingHours: "10:00-13:00 / 17:00-20:00", baseCost: 65, notes: "Aprons provided; bring a container for leftovers.", mapKind: "cooking school" },
  { id: "fo-vineyard", tripTypes: ["foodie", "adventure"], interests: ["nature"], name: "Vineyard / brewery visit + tasting", baseDurationMin: 150, openingHours: "11:00-19:00", baseCost: 40, notes: "Designate a non-drinking driver or book a return transfer.", mapKind: "vineyard" },
];

const MEALS: MealTemplate[] = [
  { id: "breakfast-cafe", slot: "breakfast", tripTypes: ["city-break", "cultural", "foodie"], name: "Local café breakfast", baseDurationMin: 45, baseCost: 12, notes: "Order the regional pastry + a coffee for an authentic start." },
  { id: "breakfast-hotel", slot: "breakfast", tripTypes: ["beach", "adventure"], name: "Hotel / guesthouse breakfast", baseDurationMin: 45, baseCost: 10, notes: "Fuel up early — adventure days burn calories." },
  { id: "lunch-casual", slot: "lunch", tripTypes: ["city-break", "beach", "adventure", "cultural", "foodie"], name: "Casual lunch at a local eatery", baseDurationMin: 60, baseCost: 18, notes: "Lunch menus are often 30-40% cheaper than dinner." },
  { id: "lunch-picnic", slot: "lunch", tripTypes: ["adventure", "beach"], name: "Picnic lunch (market-sourced)", baseDurationMin: 45, baseCost: 10, notes: "Grab bread, cheese, fruit from a market; eat at a scenic spot." },
  { id: "dinner-fine", slot: "dinner", tripTypes: ["foodie", "cultural", "city-break"], name: "Sit-down dinner at a regional restaurant", baseDurationMin: 90, baseCost: 40, notes: "Reserve ahead for popular spots; locals eat later in many countries." },
  { id: "dinner-casual", slot: "dinner", tripTypes: ["beach", "adventure"], name: "Casual dinner at a beachside / trailhead spot", baseDurationMin: 75, baseCost: 25, notes: "Try the daily catch / chef's special." },
];

const REST_TEMPLATES = [
  { id: "rest-cafe", name: "Coffee / people-watching break", baseDurationMin: 30, notes: "Recharge and re-plan; review tomorrow's bookings." },
  { id: "rest-park", name: "Park bench / scenic rest", baseDurationMin: 30, notes: "Let the kids run; stretch your legs." },
];

// ---------- Pool selection ----------

export function filterActivities(
  tripType: TripType,
  interests: Interest[],
  excludeIds: string[] = [],
): ActivityTemplate[] {
  const exclude = new Set(excludeIds);
  const pool = ACTIVITIES.filter(
    (a) => a.tripTypes.includes(tripType) && !exclude.has(a.id),
  );
  if (interests.length === 0) return pool;
  // Prefer activities that match at least one interest; keep the rest as fallback.
  const scored = pool
    .map((a) => ({
      a,
      score: (a.interests ?? []).filter((i) => interests.includes(i)).length,
    }))
    .sort((x, y) => y.score - x.score);
  const matched = scored.filter((s) => s.score > 0).map((s) => s.a);
  const fallback = scored.filter((s) => s.score === 0).map((s) => s.a);
  return matched.length > 0 ? matched : fallback;
}

export function pickMeal(slot: "breakfast" | "lunch" | "dinner", tripType: TripType): MealTemplate {
  const candidates = MEALS.filter((m) => m.slot === slot && m.tripTypes.includes(tripType));
  const pool = candidates.length > 0 ? candidates : MEALS.filter((m) => m.slot === slot);
  return pool[0] ?? MEALS[0];
}

// Deterministic PRNG so tests are stable.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromInput(input: ItineraryInput): number {
  const s = `${input.destination}|${input.days}|${input.pace}|${input.budget}|${input.tripType}|${input.interests.join(",")}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickN<T>(arr: T[], n: number, rng: () => number): T[] {
  const copy = arr.slice();
  const out: T[] = [];
  while (out.length < n && copy.length > 0) {
    const i = Math.floor(rng() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

// ---------- Stop + day generation ----------

let stopCounter = 0;
function nextStopId(prefix: string): string {
  stopCounter += 1;
  return `${prefix}-${stopCounter}`;
}

export function buildStop(
  kind: StopKind,
  name: string,
  startTime: string,
  durationMin: number,
  city: string,
  notes: string,
  mapKind: string,
  opts: { openingHours?: string; costEstimate?: number; verifyNote?: string } = {},
): Stop {
  return {
    id: nextStopId(kind),
    name,
    kind,
    startTime,
    endTime: addMinutes(startTime, durationMin),
    durationMin,
    location: city,
    notes,
    mapQuery: `${name}, ${city} ${mapKind}`.trim(),
    openingHours: opts.openingHours,
    costEstimate: opts.costEstimate,
    verifyNote: opts.verifyNote,
  };
}

export function buildTransitStop(
  startTime: string,
  durationMin: number,
  fromCity: string,
  toCity: string,
): Stop {
  return {
    id: nextStopId("transit"),
    name: `Transit: ${fromCity} → ${toCity}`,
    kind: "transit",
    startTime,
    endTime: addMinutes(startTime, durationMin),
    durationMin,
    location: `${fromCity} → ${toCity}`,
    notes: "Allow buffer for delays; keep tickets offline-accessible.",
    mapQuery: `${fromCity} to ${toCity} transit`,
  };
}

/** Build a single day's plan from a template pool + meal slots. */
export function buildDay(
  dayIndex: number,
  city: string,
  date: string | undefined,
  tripType: TripType,
  pace: Pace,
  budget: Budget,
  interests: Interest[],
  travelers: number,
  rng: () => number,
  excludeActivityIds: string[] = [],
): DayPlan {
  const stops: Stop[] = [];
  let cursor = 9 * 60; // 09:00 start
  const maxStops = maxStopsPerDay(pace);
  const durFactor = paceDurationFactor(pace);
  const tPerPerson = (c: number) => c * travelers;

  // Breakfast
  const bk = pickMeal("breakfast", tripType);
  const bkDur = Math.round(bk.baseDurationMin * durFactor);
  stops.push(buildStop(
    "meal", bk.name, minutesToTime(cursor), bkDur, city, bk.notes, "breakfast",
    { costEstimate: tPerPerson(estimateCost("meal", bk.baseCost, budget)) },
  ));
  cursor += bkDur + estimateTravelGap(pace);

  // Activities + lunch + afternoon activity + dinner
  const activityPool = filterActivities(tripType, interests, excludeActivityIds);
  const activitySlots = Math.max(1, maxStops - 3); // 3 meal slots
  const morningCount = Math.max(1, Math.ceil(activitySlots / 2));
  const afternoonCount = Math.max(0, activitySlots - morningCount);
  const morningActs = pickN(activityPool, morningCount, rng);
  const afternoonActs = pickN(
    activityPool.filter((a) => !morningActs.includes(a)),
    afternoonCount,
    rng,
  );

  for (const a of morningActs) {
    const dur = Math.round(a.baseDurationMin * durFactor);
    stops.push(buildStop(
      "activity", a.name, minutesToTime(cursor), dur, city, a.notes, a.mapKind,
      {
        openingHours: a.openingHours,
        costEstimate: tPerPerson(estimateCost("activity", a.baseCost, budget)),
        verifyNote: "Hours and prices change — verify before you go.",
      },
    ));
    cursor += dur + estimateTravelGap(pace);
    // Mid-morning rest if relaxed pace
    if (pace === "relaxed") {
      const rest = REST_TEMPLATES[0];
      const rdur = Math.round(rest.baseDurationMin * durFactor);
      stops.push(buildStop(
        "rest", rest.name, minutesToTime(cursor), rdur, city, rest.notes, "cafe",
      ));
      cursor += rdur + estimateTravelGap(pace);
    }
  }

  // Lunch
  const ln = pickMeal("lunch", tripType);
  const lnDur = Math.round(ln.baseDurationMin * durFactor);
  stops.push(buildStop(
    "meal", ln.name, minutesToTime(cursor), lnDur, city, ln.notes, "lunch",
    { costEstimate: tPerPerson(estimateCost("meal", ln.baseCost, budget)) },
  ));
  cursor += lnDur + estimateTravelGap(pace);

  for (const a of afternoonActs) {
    const dur = Math.round(a.baseDurationMin * durFactor);
    stops.push(buildStop(
      "activity", a.name, minutesToTime(cursor), dur, city, a.notes, a.mapKind,
      {
        openingHours: a.openingHours,
        costEstimate: tPerPerson(estimateCost("activity", a.baseCost, budget)),
        verifyNote: "Hours and prices change — verify before you go.",
      },
    ));
    cursor += dur + estimateTravelGap(pace);
  }

  // Dinner
  const dn = pickMeal("dinner", tripType);
  const dnDur = Math.round(dn.baseDurationMin * durFactor);
  // Push dinner to at least 18:30
  if (cursor < 18 * 60 + 30) cursor = 18 * 60 + 30;
  stops.push(buildStop(
    "meal", dn.name, minutesToTime(cursor), dnDur, city, dn.notes, "dinner",
    { costEstimate: tPerPerson(estimateCost("meal", dn.baseCost, budget)) },
  ));

  const totalCost = stops.reduce((s, st) => s + (st.costEstimate ?? 0), 0);
  const walkingDistanceKm = Math.round(
    stops.filter((s) => s.kind !== "transit").length * 0.6 * (pace === "packed" ? 1.3 : pace === "relaxed" ? 0.7 : 1) * 10,
  ) / 10;

  const paceNote =
    pace === "packed"
      ? "Packed day — back-to-back stops with short buffers. Skip a stop if you're running late."
      : pace === "relaxed"
      ? "Relaxed day — long breaks, fewer stops. Take your time at each."
      : "Balanced day — steady pace with reasonable buffers between stops.";

  return {
    dayIndex,
    date,
    city,
    stops,
    totalCostEstimate: totalCost,
    paceNote,
    walkingDistanceKm,
  };
}

// ---------- Main generator ----------

export function generateItinerary(input: ItineraryInput): ItineraryResult {
  const destination = normalizeDestination(input.destination);
  if (!destination) {
    throw new Error("Destination is required");
  }
  const days = clampDays(input.days);
  const travelers = normalizeTravelers(input.travelers ?? 1);
  const cities = parseCities(destination);
  const seed = seedFromInput(input);
  const rng = mulberry32(seed);
  const usedActivityIds: string[] = [];
  const dayPlans: DayPlan[] = [];

  for (let i = 0; i < days; i++) {
    const dayIndex = i + 1;
    const date = input.startDate ? addDays(input.startDate, i) : undefined;
    // Multi-city: assign cities round-robin across days, with transit days
    const cityIdx = cities.length === 1 ? 0 : Math.min(cities.length - 1, Math.floor(i / Math.ceil(days / cities.length)));
    const city = cities[cityIdx];
    const prevCity = i > 0 ? dayPlans[i - 1].city : null;
    const dayPlan = buildDay(
      dayIndex, city, date, input.tripType, input.pace, input.budget,
      input.interests, travelers, rng, usedActivityIds,
    );
    // Insert transit stop if city changed
    if (prevCity && prevCity !== city) {
      const transitDur = 180; // ~3 hours intercity
      const transitStop = buildTransitStop("06:30", transitDur, prevCity, city);
      // Shift the rest of the day's stops by transit + gap
      const shiftMin = transitDur + estimateTravelGap(input.pace, false) - timeToMinutes(dayPlan.stops[0].startTime) + 6 * 60 + 30;
      for (const s of dayPlan.stops) {
        s.startTime = addMinutes(s.startTime, shiftMin);
        s.endTime = addMinutes(s.endTime, shiftMin);
      }
      dayPlan.stops.unshift(transitStop);
    }
    // Track used activity ids to encourage variety
    for (const s of dayPlan.stops) {
      if (s.kind === "activity") usedActivityIds.push(s.id);
    }
    dayPlans.push(dayPlan);
  }

  const stats = computeStats({ days: dayPlans });
  const localTips = buildLocalTips(destination, input.tripType);

  return {
    id: `itin-${seed.toString(36)}-${days}`,
    input: { ...input, destination, days, travelers, interests: input.interests },
    cities,
    days: dayPlans,
    stats,
    localTips,
    generatedAt: Date.now(),
    verifyNote:
      "Hours, prices, and transit times are estimates from public data and can change. Always confirm opening hours and routes before you go. We do not take booking commissions.",
  };
}

export function computeStats(partial: { days: DayPlan[] }): ItineraryStats {
  const allStops = partial.days.flatMap((d) => d.stops);
  const totalStops = allStops.length;
  const totalActivities = allStops.filter((s) => s.kind === "activity").length;
  const totalMeals = allStops.filter((s) => s.kind === "meal").length;
  const totalCost = allStops.reduce((s, st) => s + (st.costEstimate ?? 0), 0);
  const dayCount = Math.max(1, partial.days.length);
  return {
    totalStops,
    totalActivities,
    totalMeals,
    totalCost,
    avgStopsPerDay: Math.round((totalStops / dayCount) * 10) / 10,
    estimatedCostPerDay: Math.round(totalCost / dayCount),
  };
}

export function buildLocalTips(destination: string, tripType: TripType): string[] {
  const tips: string[] = [];
  tips.push(`Download an offline map of ${destination} before you arrive — cell data is unreliable in many old-town cores.`);
  if (tripType === "foodie") {
    tips.push(`Eat where the locals eat: look for menus in the local language and tables filled with regulars, not tourists.`);
  }
  if (tripType === "beach") {
    tips.push(`Check the local UV index and flag-warning system; reapply sunscreen hourly and drink water every 30 min.`);
  }
  if (tripType === "adventure") {
    tips.push(`Book guides and gear rentals 24 hours ahead; carry cash for rural operators who don't take cards.`);
  }
  if (tripType === "cultural") {
    tips.push(`Many religious sites require covered shoulders and knees; pack a light scarf regardless of weather.`);
  }
  tips.push(`Keep a paper copy of your accommodation address and the local emergency number — phones die at the worst time.`);
  return tips;
}

// ---------- Regenerate / adjust pace ----------

/** Regenerate one day with a fresh seed variant; returns a new ItineraryResult. */
export function regenerateDay(
  result: ItineraryResult,
  dayIndex: number,
): ItineraryResult {
  if (dayIndex < 1 || dayIndex > result.days.length) return result;
  const target = result.days[dayIndex - 1];
  // Rotate seed by day index so the variant differs
  const newSeed = (seedFromInput(result.input) ^ (dayIndex * 0x9e3779b9) ^ Date.now()) >>> 0;
  const rng = mulberry32(newSeed);
  const usedIds = result.days
    .filter((d) => d.dayIndex !== dayIndex)
    .flatMap((d) => d.stops.filter((s) => s.kind === "activity").map((s) => s.id));
  const newDay = buildDay(
    dayIndex, target.city, target.date, result.input.tripType, result.input.pace,
    result.input.budget, result.input.interests, result.input.travelers ?? 1, rng, usedIds,
  );
  const days = result.days.map((d) => (d.dayIndex === dayIndex ? newDay : d));
  return { ...result, days, stats: computeStats({ days }), generatedAt: Date.now() };
}

/** Adjust pace and re-schedule all days. */
export function adjustPace(result: ItineraryResult, pace: Pace): ItineraryResult {
  if (pace === result.input.pace) return result;
  const newInput: ItineraryInput = { ...result.input, pace };
  // Reuse the same destination/days/cities but rebuild days.
  const seed = (seedFromInput(newInput) ^ 0x5bd1e995) >>> 0;
  const rng = mulberry32(seed);
  const travelers = normalizeTravelers(newInput.travelers ?? 1);
  const usedIds: string[] = [];
  const days = result.days.map((d) => {
    const newDay = buildDay(
      d.dayIndex, d.city, d.date, newInput.tripType, pace, newInput.budget,
      newInput.interests, travelers, rng, usedIds,
    );
    for (const s of newDay.stops) if (s.kind === "activity") usedIds.push(s.id);
    return newDay;
  });
  return { ...result, input: newInput, days, stats: computeStats({ days }), generatedAt: Date.now() };
}

// ---------- Map links ----------

export function buildDayMapUrl(day: DayPlan): string {
  const stops = day.stops.filter((s) => s.kind !== "transit");
  if (stops.length === 0) return "";
  const origin = encodeURIComponent(stops[0].mapQuery);
  const dest = encodeURIComponent(stops[stops.length - 1].mapQuery);
  const wps = stops.slice(1, -1).map((s) => encodeURIComponent(s.mapQuery)).join("/");
  const base = "https://www.google.com/maps/dir/";
  const url = wps ? `${base}${origin}/${wps}/${dest}` : `${base}${origin}/${dest}`;
  return url;
}

// ---------- Rendering ----------

export function renderItineraryText(result: ItineraryResult): string {
  const lines: string[] = [];
  lines.push(`Itinerary: ${result.input.destination}`);
  lines.push(`${result.days.length} day(s) · ${TRIP_TYPE_LABELS[result.input.tripType]} · ${PACE_LABELS[result.input.pace]} · ${BUDGET_LABELS[result.input.budget]}`);
  lines.push("");
  for (const day of result.days) {
    lines.push(`=== Day ${day.dayIndex}${day.date ? ` — ${day.date}` : ""} — ${day.city} ===`);
    lines.push(`Pace: ${day.paceNote}`);
    lines.push(`Walking: ~${day.walkingDistanceKm} km · Est. cost: ${day.totalCostEstimate}`);
    for (const s of day.stops) {
      const costStr = s.costEstimate != null ? ` · cost ~${s.costEstimate}` : "";
      const hoursStr = s.openingHours ? ` · hours: ${s.openingHours}` : "";
      lines.push(`  ${s.startTime}-${s.endTime} [${s.kind}] ${s.name}${costStr}${hoursStr}`);
      if (s.notes) lines.push(`    → ${s.notes}`);
      if (s.verifyNote) lines.push(`    ⚠ ${s.verifyNote}`);
    }
    lines.push("");
  }
  if (result.localTips.length > 0) {
    lines.push(`--- Local tips ---`);
    for (const t of result.localTips) lines.push(`- ${t}`);
    lines.push("");
  }
  lines.push(`⚠ ${result.verifyNote}`);
  return lines.join("\n");
}

export function renderItineraryMarkdown(result: ItineraryResult): string {
  const lines: string[] = [];
  lines.push(`# Itinerary: ${result.input.destination}`);
  lines.push(`> ${result.days.length} day(s) · **${TRIP_TYPE_LABELS[result.input.tripType]}** · **${PACE_LABELS[result.input.pace]}** · **${BUDGET_LABELS[result.input.budget]}** · ${result.input.travelers ?? 1} traveler(s)`);
  lines.push("");
  lines.push(`**Stats:** ${result.stats.totalStops} stops · ${result.stats.totalActivities} activities · ${result.stats.totalMeals} meals · est. total cost ${result.stats.totalCost} (~${result.stats.estimatedCostPerDay}/day)`);
  lines.push("");
  for (const day of result.days) {
    lines.push(`## Day ${day.dayIndex}${day.date ? ` — ${day.date}` : ""} — ${day.city}`);
    lines.push(`_${day.paceNote}_ · Walking ~${day.walkingDistanceKm} km · Est. cost ${day.totalCostEstimate}`);
    lines.push("");
    lines.push(`| Time | Type | Stop | Hours | Cost | Notes |`);
    lines.push(`|------|------|------|-------|------|-------|`);
    for (const s of day.stops) {
      const hours = s.openingHours ?? "";
      const cost = s.costEstimate != null ? String(s.costEstimate) : "";
      const notes = s.notes.replace(/\|/g, "\\|");
      lines.push(`| ${s.startTime}-${s.endTime} | ${s.kind} | ${s.name.replace(/\|/g, "\\|")} | ${hours} | ${cost} | ${notes} |`);
    }
    lines.push("");
    lines.push(`🗺️ [Open day route in Google Maps](${buildDayMapUrl(day)})`);
    lines.push("");
  }
  if (result.localTips.length > 0) {
    lines.push(`## Local tips`);
    for (const t of result.localTips) lines.push(`- ${t}`);
    lines.push("");
  }
  lines.push(`> ⚠ ${result.verifyNote}`);
  return lines.join("\n");
}

export function renderItineraryJson(result: ItineraryResult): string {
  return JSON.stringify(result, null, 2);
}

// ---------- .ics calendar export ----------

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function icsDateTime(isoDate: string, hhmm: string): string {
  // isoDate: yyyy-mm-dd → yyyymmdd; hhmm: HH:MM → THHMMSS
  const d = isoDate.replace(/-/g, "");
  const t = hhmm.replace(":", "") + "00";
  return `${d}T${t}`;
}

function icsNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

export function buildIcsExport(result: ItineraryResult): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UnQTools//Travel Itinerary Planner//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const day of result.days) {
    if (!day.date) continue; // skip days without a date — .ics needs a date
    for (const s of day.stops) {
      const dtStart = icsDateTime(day.date, s.startTime);
      const dtEnd = icsDateTime(day.date, s.endTime);
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${s.id}@unqtools`);
      lines.push(`DTSTAMP:${icsNow()}`);
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
      lines.push(`SUMMARY:${icsEscape(`[${s.kind}] ${s.name}`)}`);
      lines.push(`LOCATION:${icsEscape(`${s.name}, ${day.city}`)}`);
      lines.push(`DESCRIPTION:${icsEscape(s.notes + (s.verifyNote ? ` ${s.verifyNote}` : ""))}`);
      lines.push("END:VEVENT");
    }
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// ---------- History (localStorage) ----------

const HISTORY_KEY = "unqtools:travel-itinerary-planner:history";
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

// ---------- Share URL ----------

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.destination) params.set("dest", state.destination);
  if (state.days) params.set("days", String(state.days));
  if (state.pace) params.set("pace", state.pace);
  if (state.budget) params.set("budget", state.budget);
  if (state.tripType) params.set("type", state.tripType);
  if (state.interests && state.interests.length > 0) params.set("interests", state.interests.join(","));
  if (state.startDate) params.set("start", state.startDate);
  if (state.travelers) params.set("pax", String(state.travelers));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const defaultState: ShareState = {
    destination: "",
    days: 3,
    pace: "balanced",
    budget: "mid-range",
    tripType: "city-break",
    interests: [],
  };
  if (!clean) return defaultState;
  const params = new URLSearchParams(clean);
  const validPaces: Pace[] = ["relaxed", "balanced", "packed"];
  const validBudgets: Budget[] = ["budget", "mid-range", "luxury"];
  const validTypes: TripType[] = ["city-break", "beach", "adventure", "cultural", "foodie"];
  return {
    ...defaultState,
    destination: params.get("dest") ?? "",
    days: clampDays(Number(params.get("days") ?? "3")),
    pace: (validPaces.includes(params.get("pace") as Pace) ? params.get("pace") : "balanced") as Pace,
    budget: (validBudgets.includes(params.get("budget") as Budget) ? params.get("budget") : "mid-range") as Budget,
    tripType: (validTypes.includes(params.get("type") as TripType) ? params.get("type") : "city-break") as TripType,
    interests: normalizeInterests((params.get("interests") ?? "").split(",").filter(Boolean)),
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(params.get("start") ?? "") ? params.get("start")! : undefined,
    travelers: clampDays(Number(params.get("pax") ?? "1")) || 1,
  };
}

// ---------- LLM (BYO key) ----------

export function buildLlmRequestBody(
  input: ItineraryInput,
  model = "gpt-4o-mini",
): LlmRequestBody {
  const system =
    `You are a travel-planning assistant. Generate a realistic day-by-day itinerary for the user's trip. ` +
    `Trip type: ${TRIP_TYPE_LABELS[input.tripType]}. Pace: ${PACE_LABELS[input.pace]}. Budget: ${BUDGET_LABELS[input.budget]}. ` +
    `Days: ${input.days}. Interests: ${input.interests.map((i) => INTEREST_LABELS[i]).join(", ") || "general"}. ` +
    `Travelers: ${input.travelers ?? 1}. For each day, output a header "Day N — City" then 4-8 lines in the format ` +
    `"HH:MM-HH:MM [activity|meal|transit] Stop name — short note". Include opening-hours notes where relevant. ` +
    `Do not invent specific restaurant names; suggest categories. Always include a verify-before-you-go note at the end.` +
    `Do not add commentary outside the itinerary.`;
  return {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: input.destination },
    ],
    temperature: 0.7,
    max_tokens: 1200,
  };
}

export function extractLlmItinerary(resp: unknown): string {
  if (!resp || typeof resp !== "object") return "";
  const r = resp as Record<string, unknown>;
  const choices = r.choices as Array<{ message?: { content?: string } }> | undefined;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const content = choices[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}
