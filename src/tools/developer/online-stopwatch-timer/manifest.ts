/**
 * Online Stopwatch & Timer — Tool Manifest.
 * Tool #319 — Category 4 (Developer & Code).
 *
 * Drift-free stopwatch with laps/splits, countdown timer with alarm, and
 * Tabata interval timer. Timestamp-anchored monotonic timing (accurate after
 * backgrounding/sleep). Multiple concurrent named timers. Lap analytics
 * (fastest/slowest/average). Pomodoro & Tabata presets. Web Audio beep
 * alarm. Keyboard shortcuts. State persists in localStorage. Shareable
 * `?d=25m` style links. Fully client-side, no network.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "online-stopwatch-timer",
  name: "Online Stopwatch & Timer",
  description:
    "A drift-free stopwatch (with laps/splits), countdown timer (with alarm) and Tabata interval timer — timestamp-anchored for accuracy after backgrounding or sleep. Run multiple named timers at once, see lap analytics (fastest/slowest/avg), export laps as CSV, use Pomodoro & Tabata presets, fire a Web Audio beep alarm, drive everything from the keyboard. State persists across refresh. 100% client-side.",
  category: "developer",
  keywords: [
    "online stopwatch", "countdown timer", "tabata timer",
    "pomodoro timer", "stopwatch with laps", "lap timer",
    "interval timer", "timer with alarm", "beep timer",
    "split timer", "multiple timers", "drift free timer",
  ],
  icon: "timer",
  requiresNetwork: false,
  seo: {
    title: "Online Stopwatch & Timer — Laps, Countdown, Tabata, Beep Alarm | UnQTools",
    faq: [
      {
        q: "How does the stopwatch stay accurate when the tab is backgrounded?",
        a: "We never rely on setInterval counting ticks. Instead each timer anchors to a wall-clock timestamp (Date.now()) when it starts or resumes, and we recompute the elapsed time on every paint. Even if the browser throttles the timer in the background, when the tab regains focus the elapsed value snaps to the correct drift-free total. Pausing accumulates the pre-pause elapsed time so resume continues exactly where you left off.",
      },
      {
        q: "Can I run multiple timers at once?",
        a: "Yes. Add as many named timers as you like — stopwatches, countdowns and Tabata timers can all run simultaneously, each with its own name and color. Every timer is independent: pause one without affecting the others. All running timers are persisted to localStorage so a refresh or accidental close restores them in their current state.",
      },
      {
        q: "What is a Tabata timer and how does it work here?",
        a: "Tabata is a high-intensity interval training format: 8 rounds of 20 seconds work followed by 10 seconds rest (4 minutes total). This tool implements it with a configurable work/rest/rounds structure, advancing the round counter automatically, alternating phases, and beeping at each transition. Standard Tabata (20s/10s × 8) is a one-click preset, as is Pomodoro (25m work / 5m break × 4 rounds).",
      },
      {
        q: "How do the lap times and analytics work?",
        a: "On a stopwatch, pressing Lap records the current elapsed time. Each lap stores its split (time since the previous lap) and its cumulative total. After two or more laps we show fastest, slowest and average split automatically. You can export the full lap table as CSV or plain text for coaches, race timing or personal logs.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Drift-free timestamp-anchored stopwatch. (2) Countdown timer with audible alarm. (3) Tabata interval timer with rounds/phases. (4) Multiple concurrent named timers with colors. (5) Lap recording with split + cumulative times. (6) Lap analytics: fastest / slowest / average. (7) Pomodoro presets (25/5, 50/10, custom). (8) Tabata presets (20/10 × 8). (9) Web Audio API beep alarm (no audio file needed). (10) Keyboard shortcuts (Space start/pause,L lap, R reset). (11) State persists across refresh (localStorage). (12) Lap table export as CSV and TXT. (13) Shareable `?d=25m` link. (14) Tab title shows live remaining/elapsed time. (15) 100% offline, no network, no upload.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All timing runs locally using the browser's clock and Web Audio API. Timer state and lap history are stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
