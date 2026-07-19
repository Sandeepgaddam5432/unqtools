import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pomodoro-timer",
  name: "Pomodoro Timer",
  description:
    "Productivity timer using the Pomodoro Technique — 25/5 cycles with long breaks every 4 sessions. Customizable work/break durations, 4 presets (Classic 25/5, Long 50/10, Short 15/3, Custom), phase sequence generator, total time estimator, 3 beep frequency presets (Web Audio API oscillator — no external audio file), text + CSV export, history (localStorage), shareable URL, summary stats, circular progress indicator, auto-start toggle. 100% client-side.",
  category: "business",
  keywords: [
    "pomodoro", "pomodoro timer", "productivity timer",
    "focus timer", "work break", "time management",
    "25/5 timer", "focus session", "tomato timer",
    "deep work", "concentration",
  ],
  icon: "timer",
  requiresNetwork: false,
  seo: {
    title: "Pomodoro Timer — 25/5 Focus Sessions + Long Breaks | UnQTools",
    faq: [
      {
        q: "How does the Pomodoro timer work?",
        a: "The classic Pomodoro Technique alternates 25-minute focus sessions with 5-minute short breaks. After every 4 work sessions, take a longer 15-minute break. Start the timer, work until it beeps, take the suggested break, then start the next session. The session counter shows your progress (e.g. 3/8). All timing runs locally in your browser — no network needed.",
      },
      {
        q: "Can I customize the durations?",
        a: "Yes. Set the work duration (default 25 min), short break (5 min), long break (15 min), how often to take a long break (default every 4 work sessions), and the total number of work sessions planned (default 8). Or pick a preset: Classic (25/5/15), Long (50/10/30), Short (15/3/10), or Custom.",
      },
      {
        q: "How does the beep work? Does it need an audio file?",
        a: "No external audio file is used. The beep is synthesized on-the-fly using the Web Audio API — an oscillator running at one of three preset frequencies (low 220 Hz, medium 440 Hz, high 880 Hz). This keeps the tool 100% client-side with zero asset downloads. You can mute the beep entirely with the sound toggle.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 4 session presets (Classic, Long, Short, Custom). (2) Phase calculator (work / short-break / long-break). (3) Time formatter/parser (MM:SS ↔ seconds). (4) Phase sequence generator (full plan for totalSessions). (5) Total time estimator (work + breaks). (6) 3 beep frequency presets. (7) Beep parameter builder (Web Audio plays the actual sound in the UI). (8) Text report generator (session breakdown). (9) CSV report generator (session_num, phase, duration_min). (10) History (localStorage, max 20 completed runs). (11) Shareable URL (settings in hash). (12) Summary stats (total work/break/overall time, sessions completed). (13) Circular progress indicator. (14) Auto-start next phase toggle.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. The timer runs entirely in your browser. No audio is downloaded — beeps are synthesized with the Web Audio API. Completed-session history is stored in localStorage on this device only. The share link encodes settings in the URL hash, which never leaves the device unless you copy and send it.",
      },
    ],
  },
  status: "done",
};
