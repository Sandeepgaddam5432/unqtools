/**
 * Age Calculator — pure logic.
 */

export interface AgeInput {
  /** Birthdate in YYYY-MM-DD format. */
  birthdate: string;
  /** Target date in YYYY-MM-DD format. Default today. */
  targetDate?: string;
}

export interface AgeResult {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  totalSeconds: number;
  totalWeeks: number;
  weekdayBorn: string;
  zodiacSign: string;
  zodiacEmoji: string;
  chineseZodiac: string;
  birthstone: string;
  birthFlower: string;
  generation: string;
  nextBirthday: { date: string; daysUntil: number; weekday: string; monthsUntil: number };
  halfBirthday: { date: string; daysUntil: number };
  retirementDate: string;
  isEligibleToVote: boolean;
  isEligibleToDrive: boolean;
  lifeExpectancyRemaining: { years: number; note: string } | null;
}

function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function calculateAge(input: AgeInput): AgeResult | { error: string } {
  const birth = parseDate(input.birthdate);
  if (!birth) return { error: "Birthdate must be in YYYY-MM-DD format." };
  const today = input.targetDate ? parseDate(input.targetDate) : new Date();
  if (input.targetDate && !today) return { error: "Target date must be in YYYY-MM-DD format." };

  if (birth > today) return { error: "Birthdate is in the future." };

  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  let days = today.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    // Days in previous month
    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const totalMs = today.getTime() - birth.getTime();
  const totalDays = Math.floor(totalMs / msPerDay);
  const totalHours = Math.floor(totalMs / (60 * 60 * 1000));
  const totalMinutes = Math.floor(totalMs / (60 * 1000));
  const totalSeconds = Math.floor(totalMs / 1000);
  const totalWeeks = Math.floor(totalDays / 7);

  const weekdayBorn = WEEKDAY_NAMES[birth.getDay()]!;
  const { sign: zodiacSign, emoji: zodiacEmoji } = getZodiac(birth);
  const chineseZodiac = getChineseZodiac(birth.getFullYear());
  const birthstone = getBirthstone(birth.getMonth() + 1);
  const birthFlower = getBirthFlower(birth.getMonth() + 1);
  const generation = getGeneration(birth.getFullYear());

  // Next birthday
  const nextBday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (nextBday < today || nextBday.getTime() === today.getTime()) {
    nextBday.setFullYear(nextBday.getFullYear() + 1);
  }
  const daysUntilBday = Math.ceil((nextBday.getTime() - today.getTime()) / msPerDay);
  const monthsUntilBday = Math.floor(daysUntilBday / 30);

  // Half birthday (6 months after birth date this year)
  const halfBday = new Date(today.getFullYear(), birth.getMonth() + 6, birth.getDate());
  if (halfBday < today) halfBday.setFullYear(halfBday.getFullYear() + 1);
  const daysUntilHalfBday = Math.ceil((halfBday.getTime() - today.getTime()) / msPerDay);

  // Retirement at 65
  const retirementDate = new Date(birth.getFullYear() + 65, birth.getMonth(), birth.getDate());

  // Eligibility (assuming US rules: vote 18, drive 16)
  const isEligibleToVote = years >= 18;
  const isEligibleToDrive = years >= 16;

  // Life expectancy (WHO 2023 global avg: 73.4 years; varies by sex not requested)
  const lifeExpectancy = 73.4;
  const yearsRemaining = Math.round((lifeExpectancy - years) * 10) / 10;
  const lifeExpectancyRemaining = years > 0 && years < 110
    ? { years: yearsRemaining, note: `WHO 2023 global avg is 73.4 years — varies by country, sex, and lifestyle.` }
    : null;

  return {
    years, months, days,
    totalDays, totalHours, totalMinutes, totalSeconds, totalWeeks,
    weekdayBorn, zodiacSign, zodiacEmoji, chineseZodiac,
    birthstone, birthFlower, generation,
    nextBirthday: {
      date: `${nextBday.getFullYear()}-${String(nextBday.getMonth() + 1).padStart(2, "0")}-${String(nextBday.getDate()).padStart(2, "0")}`,
      daysUntil: daysUntilBday,
      weekday: WEEKDAY_NAMES[nextBday.getDay()]!,
      monthsUntil: monthsUntilBday,
    },
    halfBirthday: {
      date: `${halfBday.getFullYear()}-${String(halfBday.getMonth() + 1).padStart(2, "0")}-${String(halfBday.getDate()).padStart(2, "0")}`,
      daysUntil: daysUntilHalfBday,
    },
    retirementDate: `${retirementDate.getFullYear()}-${String(retirementDate.getMonth() + 1).padStart(2, "0")}-${String(retirementDate.getDate()).padStart(2, "0")}`,
    isEligibleToVote,
    isEligibleToDrive,
    lifeExpectancyRemaining,
  };
}

export function getZodiac(date: Date): { sign: string; emoji: string } {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const zodiacs: { sign: string; emoji: string; from: [number, number]; to: [number, number] }[] = [
    { sign: "Capricorn", emoji: "♑", from: [12, 22], to: [1, 19] },
    { sign: "Aquarius", emoji: "♒", from: [1, 20], to: [2, 18] },
    { sign: "Pisces", emoji: "♓", from: [2, 19], to: [3, 20] },
    { sign: "Aries", emoji: "♈", from: [3, 21], to: [4, 19] },
    { sign: "Taurus", emoji: "♉", from: [4, 20], to: [5, 20] },
    { sign: "Gemini", emoji: "♊", from: [5, 21], to: [6, 20] },
    { sign: "Cancer", emoji: "♋", from: [6, 21], to: [7, 22] },
    { sign: "Leo", emoji: "♌", from: [7, 23], to: [8, 22] },
    { sign: "Virgo", emoji: "♍", from: [8, 23], to: [9, 22] },
    { sign: "Libra", emoji: "♎", from: [9, 23], to: [10, 22] },
    { sign: "Scorpio", emoji: "♏", from: [10, 23], to: [11, 21] },
    { sign: "Sagittarius", emoji: "♐", from: [11, 22], to: [12, 21] },
  ];
  for (const z of zodiacs) {
    const [fromM, fromD] = z.from;
    const [toM, toD] = z.to;
    if ((m === fromM && d >= fromD) || (m === toM && d <= toD) ||
        (fromM > toM && (m === fromM || m === toM) && (m === fromM ? d >= fromD : d <= toD))) {
      return { sign: z.sign, emoji: z.emoji };
    }
  }
  return { sign: "Capricorn", emoji: "♑" };
}

export function getChineseZodiac(year: number): string {
  const animals = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"];
  // 2020 = Rat → index (year - 2020) % 12
  const idx = ((year - 2020) % 12 + 12) % 12;
  return animals[idx]!;
}

export function getBirthstone(month: number): string {
  const stones = ["", "Garnet", "Amethyst", "Aquamarine", "Diamond", "Emerald", "Pearl", "Ruby", "Peridot", "Sapphire", "Opal", "Topaz", "Turquoise"];
  return stones[month] ?? "Unknown";
}

export function getBirthFlower(month: number): string {
  const flowers = ["", "Carnation", "Violet", "Daffodil", "Daisy", "Lily of the Valley", "Rose", "Larkspur", "Gladiolus", "Aster", "Marigold", "Chrysanthemum", "Narcissus"];
  return flowers[month] ?? "Unknown";
}

export function getGeneration(year: number): string {
  if (year <= 1945) return "Silent Generation";
  if (year <= 1964) return "Baby Boomer";
  if (year <= 1980) return "Generation X";
  if (year <= 1996) return "Millennial (Gen Y)";
  if (year <= 2012) return "Generation Z";
  if (year <= 2024) return "Generation Alpha";
  return "Generation Beta";
}
