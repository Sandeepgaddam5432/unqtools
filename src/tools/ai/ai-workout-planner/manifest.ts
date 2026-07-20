import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-workout-planner",
  name: "AI Workout Planner",
  description:
    "Build a personalized, progressive weekly workout plan from goal (strength, muscle gain, fat loss, cardio, flexibility, general fitness), experience level, available equipment, days/week, and session length. Pure-JS engine picks exercises from a 40+ movement library, assigns sets/reps/RIR/rest with weekly progression, equipment-aware swaps, warm-up/cool-down, deload weeks, and split options (full-body / PPL / upper-lower). Local workout logger drives auto-progression. Optional BYO-key LLM. 100% client-side, no subscription, no upload.",
  category: "ai",
  keywords: [
    "workout planner", "ai workout planner", "free workout plan",
    "personalized workout", "gym program generator", "strength plan",
    "hypertrophy plan", "fat loss workout", "cardio plan", "flexibility plan",
    "no subscription fitness", "private workout planner", "fitbod alternative",
    "progressive overload", "exercise routine builder",
  ],
  icon: "dumbbell",
  requiresNetwork: false,
  seo: {
    title: "AI Workout Planner — Personalized Progressive Training Plan, Private | UnQTools",
    faq: [
      {
        q: "How does the AI Workout Planner work?",
        a: "Pick your goal (strength, muscle gain, fat loss, cardio, flexibility, or general fitness), experience level (beginner, intermediate, advanced), available equipment (bodyweight, dumbbells, kettlebell, bands, barbell, or full gym), days per week (1–7), session length (30–90 min), and optional split (full-body / PPL / upper-lower). The engine picks exercises from a 40+ movement library, assigns sets, reps, RIR, and rest per exercise, schedules them across your training days, and adds warm-up + cool-down. Each week applies a deterministic progression scheme (double-progression for strength, RIR drop for hypertrophy, time/intensity bump for cardio).",
      },
      {
        q: "Can I log my workouts and auto-progress?",
        a: "Yes. Each session has a 'Log' button — enter the actual sets/reps/weights you completed. The engine reads your log to compute progression: if you hit all your reps at the target RIR, the next week bumps weight 2.5–5% (strength) or reduces RIR by 1 (hypertrophy). If you miss reps, it holds steady or triggers a deload week (60% volume) every 4th week by default.",
      },
      {
        q: "What if I don't have the suggested equipment?",
        a: "Every exercise is tagged with required equipment and a fallback. Tap 'Swap' on any exercise and the planner returns a deterministic equipment-aware alternative that hits the same muscle group and goal. For example, barbell back squat with bodyweight-only swaps to bodyweight Bulgarian split squat; dumbbell row swaps to band row or towel row.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 40+ exercise library with form cues. (2) Six goal templates (strength, muscle gain, fat loss, cardio, flexibility, general). (3) Three experience levels with auto-scaled volume/intensity. (4) Six equipment profiles. (5) Days/week (1–7). (6) Session length 30/45/60/75/90 min. (7) Three splits (full-body, PPL, upper-lower). (8) Sets/reps/RIR/rest per exercise. (9) Weekly progression schemes (double-progression, RIR drop, time/intensity). (10) Deload weeks (every 4th week). (11) Warm-up + cool-down per session. (12) Equipment-aware swap button. (13) Local workout logger. (14) Auto-progression from logged performance. (15) Export Markdown/JSON/TXT/printable. (16) History (localStorage, last 20). (17) Shareable URL. (18) Optional BYO-key LLM enhancement. (19) Deterministic — same inputs always produce the same plan.",
      },
      {
        q: "Is my workout or body data sent anywhere?",
        a: "No. All plan generation, exercise selection, progression math, logging, and deload logic run locally in your browser. Workout logs never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};
