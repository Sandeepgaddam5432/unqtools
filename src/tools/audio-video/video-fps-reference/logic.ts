/**
 * Video FPS Reference — pure logic.
 * Frame rate table, use cases, conversion calculations.
 */

export interface FpsInfo {
  id: string;
  fps: number;
  name: string;
  type: "cinema" | "tv" | "broadcast" | "high-framerate" | "ultra";
  useCases: string[];
  pros: string[];
  cons: string[];
  notes: string;
}

export const FPS_TABLE: FpsInfo[] = [
  {
    id: "23.976",
    fps: 23.976,
    name: "23.976 fps (NTSC film)",
    type: "cinema",
    useCases: ["Theatrical film", "Streaming originals", "Cinematic look"],
    pros: ["Cinematic motion blur", "Standard for Hollywood", "Efficient storage"],
    cons: ["Judder on panning shots", "Not ideal for sports", "NTSC pulldown complexity"],
    notes: "True film rate is 24 fps; 23.976 = 24 × (1000/1001) for NTSC compatibility.",
  },
  {
    id: "24",
    fps: 24,
    name: "24 fps (Film)",
    type: "cinema",
    useCases: ["Digital cinema packages", "Film festivals", "Cinematic video"],
    pros: ["Pure film standard", "Universal cinema support", "Smooth motion blur"],
    cons: ["Same judder issues as 23.976", "Not broadcast-safe"],
    notes: "DCP standard for theatrical projection.",
  },
  {
    id: "25",
    fps: 25,
    name: "25 fps (PAL)",
    type: "broadcast",
    useCases: ["European TV", "PAL broadcast", "Documentaries"],
    pros: ["PAL broadcast standard", "Clean 1:1 with 50 Hz mains", "European TV native"],
    cons: ["Slightly choppy vs 30", "Not for US broadcast"],
    notes: "Used in Europe, Australia, much of Asia and Africa.",
  },
  {
    id: "29.97",
    fps: 29.97,
    name: "29.97 fps (NTSC)",
    type: "broadcast",
    useCases: ["US TV broadcast", "Live news", "Soap operas"],
    pros: ["US broadcast standard", "Smooth motion for video look", "Live-TV feel"],
    cons: ["Non-integer causes audio drift", "Video look (less cinematic)"],
    notes: "NTSC color burst forced 30 → 29.97 to prevent interference.",
  },
  {
    id: "30",
    fps: 30,
    name: "30 fps",
    type: "tv",
    useCases: ["Web video", "Sports highlight reels", "Old VHS"],
    pros: ["Smooth motion", "Web-friendly", "Good for action"],
    cons: ["Less cinematic than 24", "NTSC drift if broadcast"],
    notes: "Often used for online content and gaming capture.",
  },
  {
    id: "50",
    fps: 50,
    name: "50 fps (PAL HD)",
    type: "broadcast",
    useCases: ["European sports", "Live concerts", "HD broadcast in PAL regions"],
    pros: ["Buttery smooth", "Great for fast motion", "PAL HD native"],
    cons: ["Looks 'too real' for narrative", "Higher bandwidth"],
    notes: "Double PAL. Common for sports in Europe.",
  },
  {
    id: "60",
    fps: 60,
    name: "60 fps",
    type: "high-framerate",
    useCases: ["Gaming streams", "Sports (US)", "Action cameras", "Slo-mo source"],
    pros: ["Very smooth motion", "Reduces motion blur", "E-sports standard"],
    cons: ["File size 2.5× vs 24", "Uncinematic look"],
    notes: "Often rounded from 59.94 for NTSC compatibility.",
  },
  {
    id: "120",
    fps: 120,
    name: "120 fps",
    type: "high-framerate",
    useCases: ["Slow-motion source (5x)", "VR headsets", "High-end gaming"],
    pros: ["Excellent slo-mo", "Buttery for VR", "Future-proof capture"],
    cons: ["Huge file size", "Heavy CPU to edit", "Limited playback support"],
    notes: "Conform to 24 fps for 5× slow motion.",
  },
  {
    id: "240",
    fps: 240,
    name: "240 fps",
    type: "ultra",
    useCases: ["Extreme slow-motion", "Sports analysis", "Action cameras"],
    pros: ["10× slow-mo at 24 fps", "Crisp detail in motion"],
    cons: ["Massive files", "Often 720p max", "Heavy editing load"],
    notes: "iPhone and GoPro support 240 fps for short bursts.",
  },
];

export function getAllFps(): FpsInfo[] {
  return [...FPS_TABLE];
}

export function getFpsById(id: string): FpsInfo | null {
  return FPS_TABLE.find((f) => f.id === id) ?? null;
}

export function getFpsByType(type: FpsInfo["type"]): FpsInfo[] {
  return FPS_TABLE.filter((f) => f.type === type);
}

/** Convert runtime (seconds) at one fps to another by frame count equivalence. */
export function convertFrameCount(runtimeSec: number, fromFps: number, toFps: number): number {
  if (fromFps <= 0 || toFps <= 0) return 0;
  const frames = runtimeSec * fromFps;
  return frames / toFps;
}

/** Compute slow-motion ratio when conforming from → to. */
export function slowMoRatio(sourceFps: number, targetFps: number): number {
  if (targetFps <= 0) return 0;
  return sourceFps / targetFps;
}

/** Estimate file size (MB) for given fps, duration, resolution, bitrate. */
export function estimateFileSize(durationSec: number, bitrateMbps: number): number {
  if (durationSec <= 0 || bitrateMbps <= 0) return 0;
  return (durationSec * bitrateMbps) / 8;
}

/** Calculate motion blur at given fps and shutter angle (degrees). */
export function motionBlurMs(fps: number, shutterAngleDeg: number): number {
  if (fps <= 0) return 0;
  return (shutterAngleDeg / 360) * (1000 / fps);
}

/** Recommend target fps for a use case keyword. */
export function recommendFpsForUseCase(useCase: string): FpsInfo[] {
  const q = useCase.toLowerCase();
  return FPS_TABLE.filter((f) => f.useCases.some((u) => u.toLowerCase().includes(q)));
}

/** Audio sync drift over time (ms) when NTSC offset is ignored. */
export function ntscDriftMs(durationSec: number): number {
  // 29.97 vs 30 drift: 0.1% slower. Over duration, drift = duration * 0.001
  return durationSec * 1.0; // ~1 ms per second
}

/** Format FPS info as text card. */
export function formatFpsCard(f: FpsInfo): string {
  return [
    `${f.name}`,
    `FPS:           ${f.fps}`,
    `Type:          ${f.type}`,
    ``,
    `Use cases:  ${f.useCases.join(", ")}`,
    `Pros:       ${f.pros.join("; ")}`,
    `Cons:       ${f.cons.join("; ")}`,
    `Notes:      ${f.notes}`,
  ].join("\n");
}

/** Export all FPS as CSV. */
export function exportFpsAsCSV(): string {
  const header = ["id", "fps", "name", "type", "use_cases", "pros", "cons", "notes"];
  const rows = FPS_TABLE.map((f) =>
    [
      f.id,
      f.fps,
      `"${f.name}"`,
      f.type,
      `"${f.useCases.join("; ")}"`,
      `"${f.pros.join("; ")}"`,
      `"${f.cons.join("; ")}"`,
      `"${f.notes.replace(/"/g, '""')}"`,
    ].join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

/** Validate FPS input. */
export function validateFps(fps: number): string[] {
  const warnings: string[] = [];
  if (fps <= 0) warnings.push("FPS must be positive.");
  if (fps > 1000) warnings.push("FPS above 1000 is unusual — verify capture device spec.");
  if (fps !== Math.round(fps) && !FPS_TABLE.some((f) => f.fps === fps)) {
    warnings.push("Non-standard fractional FPS — check NTSC/PAL compatibility.");
  }
  return warnings;
}

/** Pulldown detection: 24 → 30 with 3:2 cadence. */
export function detectPulldown(sourceFps: number, targetFps: number): string {
  if (sourceFps === 24 && (targetFps === 30 || targetFps === 29.97)) return "3:2 pulldown (telecine)";
  if (sourceFps === 25 && targetFps === 50) return "1:1 doubling (field doubling)";
  if (sourceFps === 30 && targetFps === 60) return "1:1 doubling";
  if (sourceFps === 24 && targetFps === 25) return "4% speed-up (PAL speedup)";
  return "No standard pulldown pattern";
}

/** Shutter speed recommendation for cinematic look at given fps. */
export function cinematicShutterSpeed(fps: number): string {
  if (fps <= 0) return "1/50 s";
  return `1/${Math.round((1 / fps) * 360 / 180 * 1000) / 1000 * 1000} s (180° shutter)`;
}
