/**
 * AI Workout Planner — pure logic.
 *
 * Build personalized, progressive weekly workout plans from goal, experience
 * level, equipment, days/week, session length, and split. 40+ exercise
 * library with form cues, sets/reps/RIR/rest, weekly progression schemes,
 * deload weeks, warm-up/cool-down, equipment-aware swaps, local workout
 * logger with auto-progression, history (localStorage), shareable URL,
 * optional BYO-key LLM.
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API
 * key) lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type Goal =
  | "strength"
  | "muscle-gain"
  | "fat-loss"
  | "cardio"
  | "flexibility"
  | "general-fitness";

export type Level = "beginner" | "intermediate" | "advanced";

export type Equipment =
  | "bodyweight"
  | "dumbbells"
  | "kettlebell"
  | "bands"
  | "barbell"
  | "full-gym";

export type Split = "full-body" | "ppl" | "upper-lower";

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "core"
  | "calves"
  | "cardio"
  | "mobility";

export type ExerciseCategory = "compound" | "accessory" | "isolation" | "cardio" | "mobility";

export interface Exercise {
  id: string;
  name: string;
  muscle: MuscleGroup;
  category: ExerciseCategory;
  equipment: Equipment[];
  goals: Goal[];
  formCue: string;
  /** Alternative exercise IDs (equipment-aware swaps). */
  swaps: string[];
}

export interface PlannedSet {
  setNumber: number;
  reps: string;             // e.g. "5", "8-12", "30s"
  rir: number;              // reps in reserve (0-5); -1 for cardio/mobility (n/a)
  restSec: number;
  load?: string;            // optional load hint, e.g. "80% 1RM" or "bodyweight"
}

export interface PlannedExercise {
  exerciseId: string;
  name: string;
  muscle: MuscleGroup;
  category: ExerciseCategory;
  sets: PlannedSet[];
  formCue: string;
  notes?: string;
}

export interface Session {
  day: number;              // 1..daysPerWeek
  label: string;            // e.g. "Day 1 — Push"
  focus: string;            // e.g. "Push (Chest/Shoulders/Triceps)"
  warmup: string;
  exercises: PlannedExercise[];
  cooldown: string;
  estimatedMin: number;
}

export interface ProgressionScheme {
  name: string;
  description: string;
  weeklyIncrement: string;  // human-readable, e.g. "+2.5% load / week"
}

export interface WorkoutPlan {
  options: PlanOptions;
  sessions: Session[];
  progression: ProgressionScheme;
  deloadWeekEveryN: number; // e.g. 4 → deload every 4th week
  warnings: string[];
  totalExercises: number;
  totalSets: number;
}

export interface PlanOptions {
  goal: Goal;
  level: Level;
  equipment: Equipment;
  daysPerWeek: number;      // 1..7
  sessionLengthMin: number; // 30,45,60,75,90
  split: Split;
  includeMobility: boolean;
  deloadEveryN: number;     // 0 = off, else every N weeks
}

export interface LoggedSet {
  setNumber: number;
  reps: number;
  weightKg?: number;
}

export interface LoggedExercise {
  exerciseId: string;
  sets: LoggedSet[];
}

export interface WorkoutLog {
  ts: number;
  day: number;
  exercises: LoggedExercise[];
}

export interface HistoryEntry {
  ts: number;
  goal: Goal;
  level: Level;
  equipment: Equipment;
  daysPerWeek: number;
  sessionLengthMin: number;
  split: Split;
  totalExercises: number;
  totalSets: number;
}

export interface ShareState {
  options: Partial<PlanOptions>;
}

export interface LlmPrompt {
  system: string;
  user: string;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-workout-planner:history";
export const LOG_KEY = "unqtools:ai-workout-planner:logs";
export const HISTORY_MAX = 20;

export const GOAL_LABELS: Record<Goal, string> = {
  "strength": "Strength",
  "muscle-gain": "Muscle Gain (Hypertrophy)",
  "fat-loss": "Fat Loss",
  "cardio": "Cardio",
  "flexibility": "Flexibility",
  "general-fitness": "General Fitness",
};

export const GOAL_DESCRIPTIONS: Record<Goal, string> = {
  "strength": "Maximal force production. Low reps (3–6), heavy loads, long rests, compound lifts.",
  "muscle-gain": "Hypertrophy focus. Moderate reps (8–12), moderate loads, RIR-driven progression.",
  "fat-loss": "Energy expenditure + muscle retention. Higher reps, supersets, metabolic conditioning.",
  "cardio": "Cardiovascular capacity. Steady-state + intervals, progressive time/heart-rate zones.",
  "flexibility": "Range of motion + mobility. Dynamic + static stretching, foam rolling, yoga flows.",
  "general-fitness": "Balanced strength + cardio + mobility. Well-rounded, sustainable training.",
};

export const LEVEL_LABELS: Record<Level, string> = {
  "beginner": "Beginner",
  "intermediate": "Intermediate",
  "advanced": "Advanced",
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  "bodyweight": "Bodyweight only",
  "dumbbells": "Dumbbells",
  "kettlebell": "Kettlebell",
  "bands": "Resistance bands",
  "barbell": "Barbell",
  "full-gym": "Full gym",
};

export const SPLIT_LABELS: Record<Split, string> = {
  "full-body": "Full body (each session hits all major muscles)",
  "ppl": "Push / Pull / Legs (rotate)",
  "upper-lower": "Upper / Lower (alternate)",
};

export const SPLIT_DESCRIPTIONS: Record<Split, string> = {
  "full-body": "Best for beginners and 2–3 days/week. Every session trains the whole body.",
  "ppl": "Best for 3–6 days/week. Day 1 push, Day 2 pull, Day 3 legs, repeat.",
  "upper-lower": "Best for 4 days/week. Alternates upper and lower body.",
};

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  "chest": "Chest",
  "back": "Back",
  "shoulders": "Shoulders",
  "biceps": "Biceps",
  "triceps": "Triceps",
  "quads": "Quads",
  "hamstrings": "Hamstrings",
  "glutes": "Glutes",
  "core": "Core",
  "calves": "Calves",
  "cardio": "Cardio",
  "mobility": "Mobility",
};

export const SESSION_LENGTHS = [30, 45, 60, 75, 90] as const;

export const DEFAULT_OPTIONS: PlanOptions = {
  goal: "general-fitness",
  level: "beginner",
  equipment: "bodyweight",
  daysPerWeek: 3,
  sessionLengthMin: 45,
  split: "full-body",
  includeMobility: true,
  deloadEveryN: 4,
};

// ---------- Exercise library (40+) ----------

export const EXERCISES: Exercise[] = [
  // ----- Chest -----
  {
    id: "bench-press",
    name: "Barbell Bench Press",
    muscle: "chest",
    category: "compound",
    equipment: ["barbell", "full-gym"],
    goals: ["strength", "muscle-gain", "general-fitness"],
    formCue: "Retract scapulae, lower bar to mid-chest, drive feet through floor.",
    swaps: ["db-bench-press", "pushup", "db-floor-press"],
  },
  {
    id: "db-bench-press",
    name: "Dumbbell Bench Press",
    muscle: "chest",
    category: "compound",
    equipment: ["dumbbells", "full-gym"],
    goals: ["strength", "muscle-gain", "general-fitness"],
    formCue: "Neutral wrists, slow 2-sec descent, touch elbows to bench.",
    swaps: ["bench-press", "pushup", "db-floor-press"],
  },
  {
    id: "pushup",
    name: "Push-up",
    muscle: "chest",
    category: "compound",
    equipment: ["bodyweight"],
    goals: ["strength", "muscle-gain", "general-fitness", "fat-loss"],
    formCue: "Straight line head-to-heel, lower until chest grazes floor.",
    swaps: ["db-bench-press", "bench-press", "incline-pushup"],
  },
  {
    id: "incline-pushup",
    name: "Incline Push-up",
    muscle: "chest",
    category: "compound",
    equipment: ["bodyweight"],
    goals: ["strength", "muscle-gain", "general-fitness", "fat-loss"],
    formCue: "Hands elevated on bench/wall — easier regression. Body in straight line.",
    swaps: ["pushup", "db-bench-press"],
  },
  {
    id: "db-floor-press",
    name: "Dumbbell Floor Press",
    muscle: "chest",
    category: "compound",
    equipment: ["dumbbells"],
    goals: ["strength", "muscle-gain"],
    formCue: "Lie on floor, upper arms touch at bottom, protects shoulders.",
    swaps: ["db-bench-press", "pushup"],
  },
  // ----- Back -----
  {
    id: "deadlift",
    name: "Barbell Deadlift",
    muscle: "back",
    category: "compound",
    equipment: ["barbell", "full-gym"],
    goals: ["strength", "muscle-gain", "general-fitness"],
    formCue: "Bar over mid-foot, brace core, drive hips and chest up together.",
    swaps: ["rdl", "kb-deadlift", "db-romanian-deadlift"],
  },
  {
    id: "pullup",
    name: "Pull-up",
    muscle: "back",
    category: "compound",
    equipment: ["bodyweight", "full-gym"],
    goals: ["strength", "muscle-gain", "general-fitness"],
    formCue: "Pull chest to bar, control descent, full hang at top.",
    swaps: ["inverted-row", "db-row", "band-pulldown"],
  },
  {
    id: "inverted-row",
    name: "Inverted Row",
    muscle: "back",
    category: "compound",
    equipment: ["bodyweight"],
    goals: ["strength", "muscle-gain", "general-fitness", "fat-loss"],
    formCue: "Body straight, pull chest to bar/table, squeeze shoulder blades.",
    swaps: ["pullup", "db-row", "band-row"],
  },
  {
    id: "db-row",
    name: "One-arm Dumbbell Row",
    muscle: "back",
    category: "compound",
    equipment: ["dumbbells", "full-gym"],
    goals: ["strength", "muscle-gain", "general-fitness"],
    formCue: "Hinge at hips, pull elbow past torso, don't twist torso.",
    swaps: ["inverted-row", "band-row", "kb-row"],
  },
  {
    id: "band-row",
    name: "Band Seated Row",
    muscle: "back",
    category: "compound",
    equipment: ["bands"],
    goals: ["strength", "muscle-gain", "general-fitness", "fat-loss"],
    formCue: "Anchor band to feet, pull elbows back, squeeze scapulae.",
    swaps: ["db-row", "inverted-row"],
  },
  {
    id: "band-pulldown",
    name: "Band Lat Pulldown",
    muscle: "back",
    category: "compound",
    equipment: ["bands"],
    goals: ["strength", "muscle-gain", "general-fitness"],
    formCue: "Anchor band high overhead, pull to chest, control the raise.",
    swaps: ["pullup", "inverted-row"],
  },
  {
    id: "kb-row",
    name: "Kettlebell Row",
    muscle: "back",
    category: "compound",
    equipment: ["kettlebell"],
    goals: ["strength", "muscle-gain", "general-fitness"],
    formCue: "Two-KB row from hinge position; keep core tight, no rotation.",
    swaps: ["db-row", "band-row"],
  },
  {
    id: "rdl",
    name: "Romanian Deadlift",
    muscle: "hamstrings",
    category: "compound",
    equipment: ["barbell", "dumbbells", "full-gym"],
    goals: ["strength", "muscle-gain", "general-fitness"],
    formCue: "Soft knees, hinge at hips, feel stretch in hamstrings, drive hips forward.",
    swaps: ["deadlift", "db-romanian-deadlift"],
  },
  {
    id: "db-romanian-deadlift",
    name: "Dumbbell Romanian Deadlift",
    muscle: "hamstrings",
    category: "compound",
    equipment: ["dumbbells"],
    goals: ["strength", "muscle-gain", "general-fitness"],
    formCue: "Dumbbells along thighs, hinge until stretch, neutral spine.",
    swaps: ["rdl", "kb-deadlift"],
  },
  // ----- Shoulders -----
  {
    id: "ohp",
    name: "Standing Overhead Press",
    muscle: "shoulders",
    category: "compound",
    equipment: ["barbell", "full-gym"],
    goals: ["strength", "muscle-gain", "general-fitness"],
    formCue: "Brace core, glutes tight, press bar straight overhead, no leg drive.",
    swaps: ["db-shoulder-press", "pike-pushup"],
  },
  {
    id: "db-shoulder-press",
    name: "Dumbbell Shoulder Press",
    muscle: "shoulders",
    category: "compound",
    equipment: ["dumbbells", "full-gym"],
    goals: ["strength", "muscle-gain", "general-fitness"],
    formCue: "Press dumbbells overhead, palms forward, don't arch lower back.",
    swaps: ["ohp", "pike-pushup", "band-press"],
  },
  {
    id: "pike-pushup",
    name: "Pike Push-up",
    muscle: "shoulders",
    category: "compound",
    equipment: ["bodyweight"],
    goals: ["strength", "muscle-gain", "general-fitness"],
    formCue: "Hips high (inverted V), lower head toward floor between hands.",
    swaps: ["db-shoulder-press", "ohp"],
  },
  {
    id: "band-press",
    name: "Band Overhead Press",
    muscle: "shoulders",
    category: "compound",
    equipment: ["bands"],
    goals: ["strength", "muscle-gain", "general-fitness"],
    formCue: "Stand on band, press handles overhead, control return.",
    swaps: ["db-shoulder-press", "ohp"],
  },
  {
    id: "lateral-raise",
    name: "Dumbbell Lateral Raise",
    muscle: "shoulders",
    category: "isolation",
    equipment: ["dumbbells", "full-gym"],
    goals: ["muscle-gain", "general-fitness"],
    formCue: "Slight bend in elbows, raise to shoulder height, lead with elbows.",
    swaps: ["band-lateral-raise"],
  },
  {
    id: "band-lateral-raise",
    name: "Band Lateral Raise",
    muscle: "shoulders",
    category: "isolation",
    equipment: ["bands"],
    goals: ["muscle-gain", "general-fitness"],
    formCue: "Stand on band, raise handles to sides to shoulder height.",
    swaps: ["lateral-raise"],
  },
  // ----- Legs (quads/glutes/ham) -----
  {
    id: "squat",
    name: "Barbell Back Squat",
    muscle: "quads",
    category: "compound",
    equipment: ["barbell", "full-gym"],
    goals: ["strength", "muscle-gain", "general-fitness"],
    formCue: "Chest tall, knees track over toes, hit depth (hip crease below knee).",
    swaps: ["db-goblet-squat", "bodyweight-squat", "split-squat"],
  },
  {
    id: "db-goblet-squat",
    name: "Dumbbell Goblet Squat",
    muscle: "quads",
    category: "compound",
    equipment: ["dumbbells", "kettlebell", "full-gym"],
    goals: ["strength", "muscle-gain", "general-fitness", "fat-loss"],
    formCue: "Hold weight at chest, elbows tucked, sit back, drive knees out.",
    swaps: ["squat", "bodyweight-squat", "split-squat"],
  },
  {
    id: "bodyweight-squat",
    name: "Bodyweight Squat",
    muscle: "quads",
    category: "compound",
    equipment: ["bodyweight"],
    goals: ["strength", "muscle-gain", "general-fitness", "fat-loss"],
    formCue: "Feet shoulder-width, full depth, weight in mid-foot.",
    swaps: ["db-goblet-squat", "squat", "split-squat"],
  },
  {
    id: "split-squat",
    name: "Bulgarian Split Squat",
    muscle: "quads",
    category: "compound",
    equipment: ["bodyweight", "dumbbells", "kettlebell", "full-gym"],
    goals: ["strength", "muscle-gain", "general-fitness"],
    formCue: "Rear foot elevated, drop back knee toward floor, drive through front heel.",
    swaps: ["bodyweight-squat", "db-goblet-squat", "lunge"],
  },
  {
    id: "lunge",
    name: "Walking Lunge",
    muscle: "quads",
    category: "compound",
    equipment: ["bodyweight", "dumbbells", "kettlebell"],
    goals: ["strength", "muscle-gain", "general-fitness", "fat-loss"],
    formCue: "Long step, front knee over ankle, push through heel to next step.",
    swaps: ["split-squat", "bodyweight-squat"],
  },
  {
    id: "hip-thrust",
    name: "Hip Thrust",
    muscle: "glutes",
    category: "compound",
    equipment: ["barbell", "dumbbells", "full-gym"],
    goals: ["strength", "muscle-gain", "general-fitness"],
    formCue: "Upper back on bench, drive through heels, squeeze glutes at top.",
    swaps: ["glute-bridge", "kb-swing"],
  },
  {
    id: "glute-bridge",
    name: "Glute Bridge",
    muscle: "glutes",
    category: "compound",
    equipment: ["bodyweight", "dumbbells", "barbell"],
    goals: ["strength", "muscle-gain", "general-fitness", "flexibility"],
    formCue: "Lie on floor, drive hips up, squeeze glutes, pause 1 sec.",
    swaps: ["hip-thrust", "kb-swing"],
  },
  {
    id: "kb-swing",
    name: "Kettlebell Swing",
    muscle: "glutes",
    category: "compound",
    equipment: ["kettlebell"],
    goals: ["strength", "muscle-gain", "fat-loss", "general-fitness"],
    formCue: "Hinge at hips, snap hips to drive KB, don't squat the weight up.",
    swaps: ["hip-thrust", "glute-bridge"],
  },
  {
    id: "kb-deadlift",
    name: "Kettlebell Deadlift",
    muscle: "hamstrings",
    category: "compound",
    equipment: ["kettlebell"],
    goals: ["strength", "muscle-gain", "general-fitness"],
    formCue: "KB between feet, hinge down with neutral spine, drive hips forward.",
    swaps: ["deadlift", "db-romanian-deadlift"],
  },
  {
    id: "calf-raise",
    name: "Standing Calf Raise",
    muscle: "calves",
    category: "isolation",
    equipment: ["bodyweight", "dumbbells", "barbell", "full-gym"],
    goals: ["strength", "muscle-gain", "general-fitness"],
    formCue: "Full stretch at bottom, pause, drive up onto toes, pause.",
    swaps: ["seated-calf-raise"],
  },
  {
    id: "seated-calf-raise",
    name: "Seated Calf Raise",
    muscle: "calves",
    category: "isolation",
    equipment: ["dumbbells", "full-gym"],
    goals: ["strength", "muscle-gain"],
    formCue: "Knees bent, weight on thighs, full ROM at ankle.",
    swaps: ["calf-raise"],
  },
  // ----- Arms -----
  {
    id: "db-curl",
    name: "Dumbbell Bicep Curl",
    muscle: "biceps",
    category: "isolation",
    equipment: ["dumbbells", "full-gym"],
    goals: ["muscle-gain", "general-fitness"],
    formCue: "Elbows pinned to sides, curl up, slow lower, no swinging.",
    swaps: ["band-curl", "chinup"],
  },
  {
    id: "band-curl",
    name: "Band Bicep Curl",
    muscle: "biceps",
    category: "isolation",
    equipment: ["bands"],
    goals: ["muscle-gain", "general-fitness", "fat-loss"],
    formCue: "Stand on band, curl handles up, squeeze biceps.",
    swaps: ["db-curl"],
  },
  {
    id: "chinup",
    name: "Chin-up",
    muscle: "biceps",
    category: "compound",
    equipment: ["bodyweight", "full-gym"],
    goals: ["strength", "muscle-gain"],
    formCue: "Palms toward face, pull chest to bar, full hang at bottom.",
    swaps: ["db-curl", "band-curl"],
  },
  {
    id: "triceps-dip",
    name: "Bench Triceps Dip",
    muscle: "triceps",
    category: "compound",
    equipment: ["bodyweight"],
    goals: ["strength", "muscle-gain", "general-fitness"],
    formCue: "Hands on bench behind you, elbows back, lower hips toward floor.",
    swaps: ["db-skullcrusher", "band-pushdown"],
  },
  {
    id: "db-skullcrusher",
    name: "Dumbbell Skullcrusher",
    muscle: "triceps",
    category: "isolation",
    equipment: ["dumbbells", "full-gym"],
    goals: ["muscle-gain", "general-fitness"],
    formCue: "Lie on bench/floor, lower DBs beside ears, extend elbows.",
    swaps: ["triceps-dip", "band-pushdown"],
  },
  {
    id: "band-pushdown",
    name: "Band Triceps Pushdown",
    muscle: "triceps",
    category: "isolation",
    equipment: ["bands"],
    goals: ["muscle-gain", "general-fitness"],
    formCue: "Anchor band high, push handles down, lock elbows.",
    swaps: ["triceps-dip", "db-skullcrusher"],
  },
  // ----- Core -----
  {
    id: "plank",
    name: "Plank",
    muscle: "core",
    category: "isolation",
    equipment: ["bodyweight"],
    goals: ["strength", "muscle-gain", "general-fitness", "fat-loss", "flexibility"],
    formCue: "Forearms down, body straight, brace abs, no hip sag.",
    swaps: ["dead-bug", "hollow-hold"],
  },
  {
    id: "dead-bug",
    name: "Dead Bug",
    muscle: "core",
    category: "isolation",
    equipment: ["bodyweight"],
    goals: ["strength", "general-fitness", "flexibility"],
    formCue: "Lie supine, opposite arm/leg, press lower back into floor.",
    swaps: ["plank", "hollow-hold"],
  },
  {
    id: "hollow-hold",
    name: "Hollow Body Hold",
    muscle: "core",
    category: "isolation",
    equipment: ["bodyweight"],
    goals: ["strength", "general-fitness", "flexibility"],
    formCue: "Lower back pressed to floor, legs and arms extended, hold.",
    swaps: ["plank", "dead-bug"],
  },
  // ----- Cardio -----
  {
    id: "run-steady",
    name: "Steady-state Run",
    muscle: "cardio",
    category: "cardio",
    equipment: ["bodyweight"],
    goals: ["cardio", "fat-loss", "general-fitness"],
    formCue: "Conversational pace (Zone 2), 60-70% max HR.",
    swaps: ["row-steady", "bike-steady", "jumping-jacks"],
  },
  {
    id: "run-intervals",
    name: "Run Intervals (400m)",
    muscle: "cardio",
    category: "cardio",
    equipment: ["bodyweight"],
    goals: ["cardio", "fat-loss", "general-fitness"],
    formCue: "Hard 400m, easy 200m jog recovery, repeat.",
    swaps: ["row-intervals", "burpee-intervals"],
  },
  {
    id: "row-steady",
    name: "Rowing Steady-state",
    muscle: "cardio",
    category: "cardio",
    equipment: ["full-gym"],
    goals: ["cardio", "fat-loss", "general-fitness"],
    formCue: "Legs drive first, then back, then arms; reverse on return.",
    swaps: ["run-steady", "bike-steady"],
  },
  {
    id: "row-intervals",
    name: "Rowing Intervals (500m)",
    muscle: "cardio",
    category: "cardio",
    equipment: ["full-gym"],
    goals: ["cardio", "fat-loss", "general-fitness"],
    formCue: "Hard 500m, 90s rest, repeat. Drive with legs.",
    swaps: ["run-intervals", "burpee-intervals"],
  },
  {
    id: "bike-steady",
    name: "Cycling Steady-state",
    muscle: "cardio",
    category: "cardio",
    equipment: ["full-gym"],
    goals: ["cardio", "fat-loss", "general-fitness"],
    formCue: "Cadence 80–100 rpm, Zone 2 heart rate, smooth pedal stroke.",
    swaps: ["run-steady", "row-steady"],
  },
  {
    id: "burpee-intervals",
    name: "Burpee Intervals",
    muscle: "cardio",
    category: "cardio",
    equipment: ["bodyweight"],
    goals: ["cardio", "fat-loss", "general-fitness"],
    formCue: "30s max burpees, 30s rest, repeat. Chest to floor each rep.",
    swaps: ["run-intervals", "jumping-jacks"],
  },
  {
    id: "jumping-jacks",
    name: "Jumping Jacks",
    muscle: "cardio",
    category: "cardio",
    equipment: ["bodyweight"],
    goals: ["cardio", "fat-loss", "general-fitness"],
    formCue: "Hands overhead, feet wide, rhythmic pace.",
    swaps: ["burpee-intervals", "run-steady"],
  },
  {
    id: "kb-swing-cardio",
    name: "KB Swing Intervals",
    muscle: "cardio",
    category: "cardio",
    equipment: ["kettlebell"],
    goals: ["cardio", "fat-loss", "general-fitness"],
    formCue: "30s swing, 30s rest. Hard hip snap, don't squat the bell.",
    swaps: ["burpee-intervals", "kb-swing"],
  },
  // ----- Mobility -----
  {
    id: "cat-cow",
    name: "Cat-Cow Stretch",
    muscle: "mobility",
    category: "mobility",
    equipment: ["bodyweight"],
    goals: ["flexibility", "general-fitness"],
    formCue: "Quadruped, alternate spinal flexion and extension, slow breath.",
    swaps: ["world-greatest", "hip-circle"],
  },
  {
    id: "world-greatest",
    name: "World's Greatest Stretch",
    muscle: "mobility",
    category: "mobility",
    equipment: ["bodyweight"],
    goals: ["flexibility", "general-fitness"],
    formCue: "Lunge, place opposite hand inside foot, rotate arm to sky.",
    swaps: ["cat-cow", "hip-circle"],
  },
  {
    id: "hip-circle",
    name: "Hip Circles",
    muscle: "mobility",
    category: "mobility",
    equipment: ["bodyweight"],
    goals: ["flexibility", "general-fitness"],
    formCue: "Stand on one leg, circle lifted knee through full ROM.",
    swaps: ["world-greatest", "cat-cow"],
  },
  {
    id: "foam-roll",
    name: "Foam Roll (quads/glutes/back)",
    muscle: "mobility",
    category: "mobility",
    equipment: ["full-gym"],
    goals: ["flexibility", "general-fitness"],
    formCue: "Slow rolls, pause on tight spots 30s, breathe through discomfort.",
    swaps: ["cat-cow", "world-greatest"],
  },
  {
    id: "downward-dog",
    name: "Downward Dog Flow",
    muscle: "mobility",
    category: "mobility",
    equipment: ["bodyweight"],
    goals: ["flexibility", "general-fitness", "fat-loss"],
    formCue: "Inverted V, press chest toward thighs, pedal heels.",
    swaps: ["cat-cow", "world-greatest"],
  },
];

// Map for quick lookup
export const EXERCISE_MAP: Record<string, Exercise> = EXERCISES.reduce(
  (acc, e) => { acc[e.id] = e; return acc; },
  {} as Record<string, Exercise>,
);

// ---------- Validators ----------

export function isValidGoal(g: string): g is Goal {
  return g in GOAL_LABELS;
}

export function isValidLevel(l: string): l is Level {
  return l in LEVEL_LABELS;
}

export function isValidEquipment(e: string): e is Equipment {
  return e in EQUIPMENT_LABELS;
}

export function isValidSplit(s: string): s is Split {
  return s in SPLIT_LABELS;
}

export function validateOptions(opts: PlanOptions): string[] {
  const errs: string[] = [];
  if (!isValidGoal(opts.goal)) errs.push(`Invalid goal: ${opts.goal}`);
  if (!isValidLevel(opts.level)) errs.push(`Invalid level: ${opts.level}`);
  if (!isValidEquipment(opts.equipment)) errs.push(`Invalid equipment: ${opts.equipment}`);
  if (!isValidSplit(opts.split)) errs.push(`Invalid split: ${opts.split}`);
  if (!Number.isInteger(opts.daysPerWeek) || opts.daysPerWeek < 1 || opts.daysPerWeek > 7) {
    errs.push("daysPerWeek must be an integer 1..7");
  }
  if (!(SESSION_LENGTHS as readonly number[]).includes(opts.sessionLengthMin)) {
    errs.push(`sessionLengthMin must be one of ${SESSION_LENGTHS.join(", ")}`);
  }
  if (opts.deloadEveryN < 0 || opts.deloadEveryN > 12) {
    errs.push("deloadEveryN must be 0..12");
  }
  return errs;
}

// ---------- Helpers ----------

/** Normalize a string: trim, collapse whitespace, lowercase. */
export function normalizeId(s: string): string {
  return (s || "").trim().toLowerCase().replace(/\s+/g, "-");
}

/** Pick exercises that match goal + equipment. */
export function pickExercises(goal: Goal, equipment: Equipment): Exercise[] {
  return EXERCISES.filter((e) => e.goals.includes(goal) && e.equipment.includes(equipment));
}

/** Pick exercises that match goal + equipment + muscle group. */
export function pickByMuscle(goal: Goal, equipment: Equipment, muscle: MuscleGroup): Exercise[] {
  return pickExercises(goal, equipment).filter((e) => e.muscle === muscle);
}

/** Find a deterministic swap for an exercise, given the equipment. */
export function findSwap(exerciseId: string, equipment: Equipment): Exercise | null {
  const ex = EXERCISE_MAP[exerciseId];
  if (!ex) return null;
  // First try swaps list, filtered by equipment + muscle + goal overlap.
  for (const sid of ex.swaps) {
    const cand = EXERCISE_MAP[sid];
    if (cand && cand.equipment.includes(equipment)) {
      // Must share at least one goal with the original.
      if (cand.goals.some((g) => ex.goals.includes(g))) return cand;
    }
  }
  // Fallback: any exercise with same muscle group + equipment + shared goal.
  const sameMuscle = pickByMuscle(
    ex.goals[0] as Goal,
    equipment,
    ex.muscle,
  ).filter((e) => e.id !== ex.id);
  return sameMuscle[0] ?? null;
}

// ---------- Sets/reps schemes by goal + level ----------

export interface RepScheme {
  sets: number;
  reps: string;
  rir: number;
  restSec: number;
}

/** Rep scheme for an exercise based on goal, level, and category. */
export function repSchemeFor(
  goal: Goal,
  level: Level,
  category: ExerciseCategory,
): RepScheme {
  // Strength
  if (goal === "strength") {
    if (category === "compound") {
      const sets = level === "beginner" ? 3 : level === "intermediate" ? 4 : 5;
      return { sets, reps: "5", rir: 2, restSec: 180 };
    }
    if (category === "accessory" || category === "isolation") {
      return { sets: 3, reps: "8-10", rir: 2, restSec: 120 };
    }
    if (category === "cardio") return { sets: 1, reps: "10 min", rir: -1, restSec: 0 };
    return { sets: 2, reps: "30s hold", rir: -1, restSec: 30 };
  }
  // Muscle gain
  if (goal === "muscle-gain") {
    if (category === "compound") {
      const sets = level === "beginner" ? 3 : 4;
      return { sets, reps: "8-12", rir: 1, restSec: 120 };
    }
    if (category === "accessory" || category === "isolation") {
      return { sets: 3, reps: "12-15", rir: 1, restSec: 75 };
    }
    if (category === "cardio") return { sets: 1, reps: "5 min", rir: -1, restSec: 0 };
    return { sets: 2, reps: "30s hold", rir: -1, restSec: 30 };
  }
  // Fat loss
  if (goal === "fat-loss") {
    if (category === "compound") {
      return { sets: 3, reps: "12-15", rir: 2, restSec: 60 };
    }
    if (category === "accessory" || category === "isolation") {
      return { sets: 3, reps: "15-20", rir: 2, restSec: 45 };
    }
    if (category === "cardio") return { sets: 4, reps: "30s on / 30s off", rir: -1, restSec: 0 };
    return { sets: 2, reps: "30s hold", rir: -1, restSec: 30 };
  }
  // Cardio
  if (goal === "cardio") {
    if (category === "cardio") {
      const sets = level === "beginner" ? 1 : level === "intermediate" ? 2 : 3;
      return { sets, reps: "5 min", rir: -1, restSec: 60 };
    }
    if (category === "compound") return { sets: 2, reps: "15", rir: 2, restSec: 60 };
    return { sets: 2, reps: "30s hold", rir: -1, restSec: 30 };
  }
  // Flexibility
  if (goal === "flexibility") {
    if (category === "mobility") {
      const sets = level === "beginner" ? 2 : 3;
      return { sets, reps: "45s hold", rir: -1, restSec: 15 };
    }
    if (category === "compound") return { sets: 2, reps: "10", rir: 3, restSec: 60 };
    return { sets: 1, reps: "5 min", rir: -1, restSec: 0 };
  }
  // General fitness (default)
  if (category === "compound") {
    const sets = level === "beginner" ? 3 : 4;
    return { sets, reps: "8-12", rir: 2, restSec: 90 };
  }
  if (category === "accessory" || category === "isolation") {
    return { sets: 3, reps: "10-15", rir: 2, restSec: 60 };
  }
  if (category === "cardio") return { sets: 1, reps: "10 min", rir: -1, restSec: 0 };
  return { sets: 2, reps: "30s hold", rir: -1, restSec: 30 };
}

/** Build a PlannedExercise from an Exercise with full set scheme. */
export function planExercise(
  ex: Exercise,
  goal: Goal,
  level: Level,
  loadHint?: string,
): PlannedExercise {
  const scheme = repSchemeFor(goal, level, ex.category);
  const sets: PlannedSet[] = [];
  for (let i = 1; i <= scheme.sets; i++) {
    sets.push({
      setNumber: i,
      reps: scheme.reps,
      rir: scheme.rir,
      restSec: scheme.restSec,
      load: loadHint,
    });
  }
  return {
    exerciseId: ex.id,
    name: ex.name,
    muscle: ex.muscle,
    category: ex.category,
    sets,
    formCue: ex.formCue,
  };
}

// ---------- Split scheduling ----------

/** Per-day focus labels for a given split + day count. */
export function splitDayLabels(split: Split, daysPerWeek: number): string[] {
  if (split === "full-body") {
    return Array.from({ length: daysPerWeek }, (_, i) => `Day ${i + 1} — Full Body`);
  }
  if (split === "ppl") {
    const cycle = ["Push", "Pull", "Legs"];
    return Array.from({ length: daysPerWeek }, (_, i) => `Day ${i + 1} — ${cycle[i % 3]}`);
  }
  // upper-lower
  const cycle = ["Upper", "Lower"];
  return Array.from({ length: daysPerWeek }, (_, i) => `Day ${i + 1} — ${cycle[i % 2]}`);
}

/** Per-day muscle focus for a given split + day index (0-based). */
export function splitDayFocus(split: Split, dayIdx: number): MuscleGroup[] {
  if (split === "full-body") {
    return ["chest", "back", "quads", "shoulders", "core"];
  }
  if (split === "ppl") {
    const cycle = [["chest", "shoulders", "triceps"], ["back", "biceps"], ["quads", "hamstrings", "glutes"]] as MuscleGroup[][];
    return cycle[dayIdx % 3];
  }
  // upper-lower
  if (dayIdx % 2 === 0) return ["chest", "back", "shoulders", "biceps", "triceps"];
  return ["quads", "hamstrings", "glutes", "core", "calves"];
}

// ---------- Plan generation ----------

/** Estimate total minutes for a session (sets × ~1 min + rest). */
export function estimateSessionMin(exercises: PlannedExercise[], warmupMin: number, cooldownMin: number): number {
  let sec = warmupMin * 60 + cooldownMin * 60;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      // ~40 sec per working set + rest
      sec += 40 + s.restSec;
    }
  }
  return Math.round(sec / 60);
}

/** Trim exercise set counts to fit within sessionLengthMin. */
export function fitToSession(
  exercises: PlannedExercise[],
  sessionLengthMin: number,
  warmupMin: number,
  cooldownMin: number,
): PlannedExercise[] {
  const target = sessionLengthMin - warmupMin - cooldownMin;
  let total = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) total += 40 + s.restSec;
  }
  if (total <= target * 60) return exercises;
  // Trim by dropping last set of each exercise (preserve first 2 sets).
  const trimmed = exercises.map((e) => ({ ...e, sets: e.sets.slice(0, 2) }));
  total = 0;
  for (const ex of trimmed) {
    for (const s of ex.sets) total += 40 + s.restSec;
  }
  if (total <= target * 60) return trimmed;
  // Drop last exercise entirely if still over.
  return trimmed.slice(0, Math.max(1, Math.floor(trimmed.length * (target * 60) / total)));
}

/** Generate the full workout plan from options. */
export function generatePlan(opts: PlanOptions): WorkoutPlan {
  const errs = validateOptions(opts);
  if (errs.length > 0) {
    return {
      options: opts,
      sessions: [],
      progression: { name: "—", description: "Invalid options", weeklyIncrement: "—" },
      deloadWeekEveryN: 0,
      warnings: errs,
      totalExercises: 0,
      totalSets: 0,
    };
  }

  const warnings: string[] = [];
  // Strength with bodyweight-only: warn.
  if (opts.goal === "strength" && opts.equipment === "bodyweight") {
    warnings.push("Strength goal with bodyweight-only equipment: progression will rely on harder movement variations, not load. Consider dumbbells/barbell if available.");
  }
  // Cardio with barbell-only: warn.
  if (opts.goal === "cardio" && opts.equipment === "barbell") {
    warnings.push("Cardio goal with barbell-only equipment: limited cardio options. Consider adding bodyweight or kettlebell for variety.");
  }
  // PPL with <3 days: warn.
  if (opts.split === "ppl" && opts.daysPerWeek < 3) {
    warnings.push("PPL split is best with 3+ days/week. Consider full-body for fewer days.");
  }
  // Flexibility with includeMobility off: warn.
  if (opts.goal === "flexibility" && !opts.includeMobility) {
    warnings.push("Flexibility goal with mobility off: plan will be very short. Re-enable mobility for a useful session.");
  }

  const labels = splitDayLabels(opts.split, opts.daysPerWeek);
  const sessions: Session[] = [];
  let totalExercises = 0;
  let totalSets = 0;
  const warmupMin = opts.goal === "flexibility" ? 5 : 5;
  const cooldownMin = opts.goal === "flexibility" ? 5 : 5;

  for (let i = 0; i < opts.daysPerWeek; i++) {
    const focusMuscles = splitDayFocus(opts.split, i);
    const planned: PlannedExercise[] = [];

    for (const muscle of focusMuscles) {
      const candidates = pickByMuscle(opts.goal, opts.equipment, muscle);
      if (candidates.length === 0) {
        // Try any exercise for this muscle group across all goals.
        const fallback = EXERCISES.filter(
          (e) => e.muscle === muscle && e.equipment.includes(opts.equipment),
        );
        if (fallback.length === 0) continue;
        const ex = fallback[0];
        // Skip if already added (same id).
        if (planned.some((p) => p.exerciseId === ex.id)) continue;
        planned.push(planExercise(ex, opts.goal, opts.level, ex.equipment[0] === "bodyweight" ? "bodyweight" : undefined));
      } else {
        const ex = candidates[0];
        if (planned.some((p) => p.exerciseId === ex.id)) continue;
        planned.push(planExercise(ex, opts.goal, opts.level, ex.equipment[0] === "bodyweight" ? "bodyweight" : undefined));
      }
    }

    // Add cardio for fat-loss or general-fitness with cardio focus.
    if ((opts.goal === "fat-loss" || opts.goal === "general-fitness") && !planned.some((p) => p.category === "cardio")) {
      const cardio = pickByMuscle(opts.goal, opts.equipment, "cardio");
      if (cardio.length > 0 && planned.length < 7) {
        planned.push(planExercise(cardio[0], opts.goal, opts.level));
      }
    }

    // Mobility add-on.
    if (opts.includeMobility && !planned.some((p) => p.category === "mobility")) {
      const mob = pickByMuscle("flexibility", opts.equipment, "mobility");
      if (mob.length > 0 && planned.length < 8) {
        planned.push(planExercise(mob[0], "flexibility", opts.level));
      }
    }

    // Always include core for full-body days.
    if (opts.split === "full-body" && !planned.some((p) => p.muscle === "core")) {
      const core = pickByMuscle(opts.goal, opts.equipment, "core");
      if (core.length > 0 && planned.length < 8) {
        planned.push(planExercise(core[0], opts.goal, opts.level));
      }
    }

    // Fit to session length.
    const fitted = fitToSession(planned, opts.sessionLengthMin, warmupMin, cooldownMin);
    totalExercises += fitted.length;
    for (const ex of fitted) totalSets += ex.sets.length;

    const focusLabel = focusMuscles.map((m) => MUSCLE_LABELS[m]).join(" / ");
    sessions.push({
      day: i + 1,
      label: labels[i],
      focus: focusLabel,
      warmup: buildWarmup(opts.goal, opts.level),
      exercises: fitted,
      cooldown: buildCooldown(opts.goal),
      estimatedMin: estimateSessionMin(fitted, warmupMin, cooldownMin),
    });
  }

  // Progression scheme by goal.
  const progression = buildProgressionScheme(opts.goal);

  return {
    options: opts,
    sessions,
    progression,
    deloadWeekEveryN: opts.deloadEveryN,
    warnings,
    totalExercises,
    totalSets,
  };
}

/** Build warm-up string. */
export function buildWarmup(goal: Goal, level: Level): string {
  if (goal === "flexibility") {
    return "5 min: Cat-cow ×8, World's Greatest Stretch ×4 each side, Hip Circles ×8 each leg.";
  }
  if (goal === "cardio") {
    return "5 min: easy jog / row / bike at conversational pace, then 4×20s strides building to target pace.";
  }
  // Strength / hypertrophy / fat-loss / general
  const base = "5 min general warm-up (light bike/row/jog), then 2 warm-up sets of first compound lift at 50% and 75% target load.";
  if (level === "beginner") return base + " Take an extra 2 min to groove technique on each lift.";
  if (level === "advanced") return base + " Add 1 ramp set at 90% before working sets.";
  return base;
}

/** Build cool-down string. */
export function buildCooldown(goal: Goal): string {
  if (goal === "flexibility") {
    return "5 min: long-hold static stretches — pigeon, hamstring stretch, couch stretch, 60s each.";
  }
  if (goal === "cardio") {
    return "5 min: easy walk/jog to bring HR down, then 2 min diaphragmatic breathing.";
  }
  return "5 min: light walk + static stretches for trained muscles (30s holds each).";
}

/** Build progression scheme description. */
export function buildProgressionScheme(goal: Goal): ProgressionScheme {
  if (goal === "strength") {
    return {
      name: "Double Progression",
      description: "Stay in a rep range (e.g. 5). Once you hit all sets at 5 reps with 2 RIR, add 2.5 kg upper / 5 kg lower body next session.",
      weeklyIncrement: "+2.5 kg upper / +5 kg lower when all reps hit",
    };
  }
  if (goal === "muscle-gain") {
    return {
      name: "RIR Drop",
      description: "Start week 1 at 3 RIR. Drop 1 RIR per week until you reach 0 RIR, then deload and restart.",
      weeklyIncrement: "-1 RIR per week (3 → 2 → 1 → 0 → deload)",
    };
  }
  if (goal === "fat-loss") {
    return {
      name: "Density + Volume",
      description: "Add 1 set per exercise each week (cap at 5). Reduce rest by 10s per week to increase density.",
      weeklyIncrement: "+1 set/exercise / week, -10s rest / week",
    };
  }
  if (goal === "cardio") {
    return {
      name: "Time + Intensity",
      description: "Add 5 min to steady-state per week, or 1 interval per week. Keep RPE 7-8.",
      weeklyIncrement: "+5 min steady / +1 interval per week",
    };
  }
  if (goal === "flexibility") {
    return {
      name: "Hold + Frequency",
      description: "Add 15s to each hold per week (cap 90s). Add a second mobility session if recovering well.",
      weeklyIncrement: "+15s per hold per week",
    };
  }
  // general fitness
  return {
    name: "Mixed Progressive Overload",
    description: "Add reps weekly until top of range, then add load (strength lifts) or sets (accessories). Add 5 min cardio per week.",
    weeklyIncrement: "+1 rep → +load / +5 min cardio per week",
  };
}

// ---------- Stats ----------

export interface PlanStats {
  days: number;
  totalExercises: number;
  totalSets: number;
  avgExercisesPerDay: number;
  avgSetsPerDay: number;
  estimatedMinPerDay: number;
  estimatedWeeklyMin: number;
  byMuscle: Record<MuscleGroup, number>;
}

/** Compute summary stats for a plan. */
export function computeStats(plan: WorkoutPlan): PlanStats {
  const byMuscle = {} as Record<MuscleGroup, number>;
  for (const m of Object.keys(MUSCLE_LABELS) as MuscleGroup[]) byMuscle[m] = 0;
  for (const s of plan.sessions) {
    for (const ex of s.exercises) {
      byMuscle[ex.muscle] += ex.sets.length;
    }
  }
  const days = plan.sessions.length;
  const totalExercises = plan.totalExercises;
  const totalSets = plan.totalSets;
  const avgExercisesPerDay = days > 0 ? Math.round((totalExercises / days) * 10) / 10 : 0;
  const avgSetsPerDay = days > 0 ? Math.round((totalSets / days) * 10) / 10 : 0;
  const estimatedMinPerDay = days > 0 ? Math.round(plan.sessions.reduce((a, s) => a + s.estimatedMin, 0) / days) : 0;
  const estimatedWeeklyMin = plan.sessions.reduce((a, s) => a + s.estimatedMin, 0);
  return {
    days,
    totalExercises,
    totalSets,
    avgExercisesPerDay,
    avgSetsPerDay,
    estimatedMinPerDay,
    estimatedWeeklyMin,
    byMuscle,
  };
}

// ---------- Logging & auto-progression ----------

/** Save a workout log entry (returns all logs). */
export function saveLog(log: WorkoutLog): WorkoutLog[] {
  const logs = loadLogs();
  logs.push(log);
  // Cap at 200 logs.
  const capped = logs.slice(-200);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(capped));
    } catch { /* ignore */ }
  }
  return capped;
}

/** Load all workout logs. */
export function loadLogs(): WorkoutLog[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as WorkoutLog[];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

/** Clear all logs. */
export function clearLogs(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(LOG_KEY); } catch { /* ignore */ }
}

/**
 * Compute next-week progression suggestion from logs for a given exercise.
 * Returns null if no logs found.
 */
export function computeProgressionForExercise(
  exerciseId: string,
  logs: WorkoutLog[],
): { action: "increase" | "hold" | "deload"; reason: string } | null {
  const exLogs = logs
    .filter((l) => l.exercises.some((e) => e.exerciseId === exerciseId))
    .slice(-3);
  if (exLogs.length === 0) return null;
  // Look at the most recent log for this exercise.
  const last = exLogs[exLogs.length - 1];
  const ex = last.exercises.find((e) => e.exerciseId === exerciseId);
  if (!ex || ex.sets.length === 0) return null;

  // If target reps met on all sets → increase.
  // We use 5 as a strength default target; if all sets >= 5 reps, increase.
  const allHit = ex.sets.every((s) => s.reps >= 5);
  if (allHit) {
    return {
      action: "increase",
      reason: "All target reps hit — add load next session (+2.5 kg upper / +5 kg lower).",
    };
  }
  // If missed badly (most sets < 3 reps) → deload.
  const missedBadly = ex.sets.filter((s) => s.reps < 3).length >= Math.ceil(ex.sets.length / 2);
  if (missedBadly) {
    return {
      action: "deload",
      reason: "Multiple sets below 3 reps — take a 10% deload next session.",
    };
  }
  return { action: "hold", reason: "Close to target — hold load and focus on technique." };
}

/** Determine if a given week number is a deload week. */
export function isDeloadWeek(weekNumber: number, deloadEveryN: number): boolean {
  if (deloadEveryN <= 0) return false;
  return weekNumber > 0 && weekNumber % deloadEveryN === 0;
}

/** Apply a deload to a plan (reduce sets by ~40% and lower intensity). */
export function applyDeload(plan: WorkoutPlan): WorkoutPlan {
  const sessions = plan.sessions.map((s) => ({
    ...s,
    exercises: s.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.slice(0, Math.max(1, Math.ceil(ex.sets.length * 0.6))),
      notes: "Deload week — reduce load ~10% and focus on technique.",
    })),
    label: s.label + " (Deload)",
  }));
  return { ...plan, sessions };
}

// ---------- Renderers ----------

/** Render a plan as Markdown. */
export function renderMarkdown(plan: WorkoutPlan): string {
  if (plan.sessions.length === 0) {
    return `# Workout Plan\n\n_No plan generated — fix warnings above._\n\nWarnings:\n${plan.warnings.map((w) => `- ${w}`).join("\n")}`;
  }
  const lines: string[] = [];
  lines.push(`# Workout Plan — ${GOAL_LABELS[plan.options.goal]}`);
  lines.push("");
  lines.push(`- **Goal:** ${GOAL_LABELS[plan.options.goal]}`);
  lines.push(`- **Level:** ${LEVEL_LABELS[plan.options.level]}`);
  lines.push(`- **Equipment:** ${EQUIPMENT_LABELS[plan.options.equipment]}`);
  lines.push(`- **Days/week:** ${plan.options.daysPerWeek}`);
  lines.push(`- **Session length:** ${plan.options.sessionLengthMin} min`);
  lines.push(`- **Split:** ${SPLIT_LABELS[plan.options.split]}`);
  lines.push(`- **Progression:** ${plan.progression.name} — ${plan.progression.description}`);
  if (plan.deloadWeekEveryN > 0) {
    lines.push(`- **Deload:** every ${plan.deloadWeekEveryN} weeks (60% volume, ~10% load reduction)`);
  }
  lines.push("");
  if (plan.warnings.length > 0) {
    lines.push(`## Warnings`);
    for (const w of plan.warnings) lines.push(`- ⚠️ ${w}`);
    lines.push("");
  }
  for (const s of plan.sessions) {
    lines.push(`## ${s.label}`);
    lines.push(`**Focus:** ${s.focus}  ·  **Est:** ${s.estimatedMin} min`);
    lines.push("");
    lines.push(`**Warm-up:** ${s.warmup}`);
    lines.push("");
    lines.push(`| # | Exercise | Muscle | Sets | Reps | RIR | Rest | Form cue |`);
    lines.push(`|---|----------|--------|------|------|-----|------|----------|`);
    s.exercises.forEach((ex, i) => {
      const sets = ex.sets.length;
      const reps = ex.sets[0]?.reps ?? "—";
      const rir = ex.sets[0]?.rir ?? "—";
      const rest = ex.sets[0]?.restSec ?? "—";
      lines.push(`| ${i + 1} | ${ex.name} | ${MUSCLE_LABELS[ex.muscle]} | ${sets} | ${reps} | ${rir === -1 ? "n/a" : rir} | ${rest}s | ${ex.formCue} |`);
    });
    lines.push("");
    lines.push(`**Cool-down:** ${s.cooldown}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Render a plan as plain text. */
export function renderText(plan: WorkoutPlan): string {
  return renderMarkdown(plan);
}

/** Render a plan as JSON. */
export function renderJson(plan: WorkoutPlan): string {
  return JSON.stringify(plan, null, 2);
}

/** Render sessions as CSV. */
export function renderCsv(plan: WorkoutPlan): string {
  const lines = ["day,label,focus,exercise_order,exercise,muscle,sets,reps,rir,rest_sec"];
  for (const s of plan.sessions) {
    s.exercises.forEach((ex, i) => {
      const reps = ex.sets[0]?.reps ?? "";
      const rir = ex.sets[0]?.rir ?? "";
      const rest = ex.sets[0]?.restSec ?? "";
      lines.push([
        s.day,
        escapeCsv(s.label),
        escapeCsv(s.focus),
        i + 1,
        escapeCsv(ex.name),
        ex.muscle,
        ex.sets.length,
        escapeCsv(reps),
        rir,
        rest,
      ].join(","));
    });
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------- History (localStorage) ----------

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch { return []; }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}

// ---------- Shareable URL ----------

export function buildShareUrl(opts: PlanOptions): string {
  const params = new URLSearchParams();
  params.set("goal", opts.goal);
  params.set("level", opts.level);
  params.set("equip", opts.equipment);
  params.set("days", String(opts.daysPerWeek));
  params.set("len", String(opts.sessionLengthMin));
  params.set("split", opts.split);
  params.set("mob", opts.includeMobility ? "1" : "0");
  params.set("deload", String(opts.deloadEveryN));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { options: Partial<PlanOptions> } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { options: {} };
  const params = new URLSearchParams(clean);
  const options: Partial<PlanOptions> = {};
  const goal = params.get("goal");
  if (goal && isValidGoal(goal)) options.goal = goal;
  const level = params.get("level");
  if (level && isValidLevel(level)) options.level = level;
  const equip = params.get("equip");
  if (equip && isValidEquipment(equip)) options.equipment = equip;
  const days = parseInt(params.get("days") ?? "", 10);
  if (Number.isInteger(days) && days >= 1 && days <= 7) options.daysPerWeek = days;
  const len = parseInt(params.get("len") ?? "", 10);
  if ((SESSION_LENGTHS as readonly number[]).includes(len)) options.sessionLengthMin = len;
  const split = params.get("split");
  if (split && isValidSplit(split)) options.split = split;
  const mob = params.get("mob");
  if (mob !== null) options.includeMobility = mob === "1";
  const deload = parseInt(params.get("deload") ?? "", 10);
  if (Number.isInteger(deload) && deload >= 0 && deload <= 12) options.deloadEveryN = deload;
  return { options };
}

// ---------- LLM prompt ----------

export function buildLlmPrompt(opts: PlanOptions): LlmPrompt {
  return {
    system: `You are a certified personal trainer and strength coach. You build personalized, progressive weekly workout plans using evidence-based programming. Always output the plan as Markdown with: goal, level, equipment, days/week, session length, split, per-session exercises with sets/reps/RIR/rest, warm-up, cool-down, and a one-paragraph progression scheme. Include injury caveats.`,
    user: `Build me a weekly workout plan with these inputs:
- Goal: ${GOAL_LABELS[opts.goal]}
- Experience level: ${LEVEL_LABELS[opts.level]}
- Available equipment: ${EQUIPMENT_LABELS[opts.equipment]}
- Days per week: ${opts.daysPerWeek}
- Session length: ${opts.sessionLengthMin} minutes
- Split: ${SPLIT_LABELS[opts.split]}
- Include mobility: ${opts.includeMobility ? "yes" : "no"}
- Deload every N weeks: ${opts.deloadEveryN || "off"}

Output a structured weekly plan with at least ${opts.daysPerWeek} sessions, each with 4-8 exercises. For each exercise include sets, reps, RIR, and rest. Add warm-up and cool-down instructions and explain the weekly progression scheme.`,
  };
}

/** Render an LLM-returned text (just trim). */
export function renderLlmResult(text: string): string {
  return (text || "").trim();
}
