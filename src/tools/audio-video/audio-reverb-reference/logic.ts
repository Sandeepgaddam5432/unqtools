/**
 * Audio Reverb Reference — pure logic.
 * Reference table for common reverb types with decay/pre-delay/RT60 calculations.
 */

export interface ReverbPreset {
  id: string;
  name: string;
  category: "hall" | "plate" | "spring" | "room" | "chamber";
  decayMs: number; // typical RT60 in ms
  preDelayMs: number; // gap before first reflection
  diffusion: number; // 0..1 — how spread out reflections are
  density: number; // 0..1 — number of reflections
  highFreqDamping: number; // 0..1 — HF absorption
  lowRatio: number; // bass multiplier vs mids
  description: string;
  useCases: string[];
  instruments: string[];
  famousExamples: string[];
}

export const REVERB_PRESETS: ReverbPreset[] = [
  {
    id: "small-hall",
    name: "Small Hall",
    category: "hall",
    decayMs: 1200,
    preDelayMs: 20,
    diffusion: 0.78,
    density: 0.7,
    highFreqDamping: 0.35,
    lowRatio: 1.1,
    description: "Intimate recital hall. Natural ambience with quick decay.",
    useCases: ["Acoustic guitar", "Solo piano", "Vocal intimacy", "Chamber ensembles"],
    instruments: ["Strings", "Piano", "Acoustic guitar", "Vocals"],
    famousExamples: ["Abbey Road Studio 2", "Carnegie Hall (small ensembles)"],
  },
  {
    id: "large-hall",
    name: "Large Hall",
    category: "hall",
    decayMs: 2800,
    preDelayMs: 40,
    diffusion: 0.85,
    density: 0.8,
    highFreqDamping: 0.45,
    lowRatio: 1.25,
    description: "Concert hall grandeur. Long, lush tail with deep bass.",
    useCases: ["Orchestral mixes", "Cinematic scores", "Lead vocals (ballads)"],
    instruments: ["Full orchestra", "Drum room", "Lead vocals", "Pads"],
    famousExamples: ["Boston Symphony Hall", "Vienna Musikverein"],
  },
  {
    id: "plate",
    name: "Plate Reverb",
    category: "plate",
    decayMs: 1800,
    preDelayMs: 10,
    diffusion: 0.95,
    density: 0.9,
    highFreqDamping: 0.5,
    lowRatio: 0.95,
    description: "Metal plate resonance. Bright, dense, smooth. Studio classic.",
    useCases: ["Snare drums", "Lead vocals (rock/pop)", "1960s pop vibe"],
    instruments: ["Vocals", "Snare", "Electric guitar solos"],
    famousExamples: ["EMT 140", "Plate reverb on John Lennon vocals"],
  },
  {
    id: "spring",
    name: "Spring Reverb",
    category: "spring",
    decayMs: 1500,
    preDelayMs: 5,
    diffusion: 0.4,
    density: 0.3,
    highFreqDamping: 0.6,
    lowRatio: 1.0,
    description: "Spring tank resonance. Boingy, characterful, vintage surf tone.",
    useCases: ["Surf guitar", "Dub/reggae", "Vintage rockabilly"],
    instruments: ["Electric guitar (Fender amp)", "Vocals (dub)"],
    famousExamples: ["Fender Twin Reverb", "Dick Dale surf tone"],
  },
  {
    id: "room",
    name: "Room Reverb",
    category: "room",
    decayMs: 600,
    preDelayMs: 8,
    diffusion: 0.6,
    density: 0.55,
    highFreqDamping: 0.4,
    lowRatio: 1.05,
    description: "Generic room ambience. Subtle space without obvious reverb.",
    useCases: ["Drum room mic", "Acoustic glue", "Subtle vocal ambience"],
    instruments: ["Drum overheads", "Acoustic guitar", "Strings section"],
    famousExamples: ["SSL live room", "Home studio treatment"],
  },
  {
    id: "chamber",
    name: "Chamber Reverb",
    category: "chamber",
    decayMs: 2200,
    preDelayMs: 25,
    diffusion: 0.82,
    density: 0.75,
    highFreqDamping: 0.42,
    lowRatio: 1.15,
    description: "Echo chamber tone. Smoother than hall, richer than plate.",
    useCases: ["Vocal reverb (1950s-70s)", "Vintage pop", "Lush strings"],
    instruments: ["Vocals", "Strings", "Horns"],
    famousExamples: ["Capitol Studios echo chamber", "Abbey Road echo chamber"],
  },
];

export function getAllPresets(): ReverbPreset[] {
  return [...REVERB_PRESETS];
}

export function getPresetById(id: string): ReverbPreset | null {
  const exact = REVERB_PRESETS.find((p) => p.id === id);
  if (exact) return exact;
  // Category alias: "hall", "plate", etc. resolves to the first preset of that category.
  if (["hall", "plate", "spring", "room", "chamber"].includes(id)) {
    return REVERB_PRESETS.find((p) => p.category === id) ?? null;
  }
  return null;
}

export function getPresetsByCategory(category: ReverbPreset["category"]): ReverbPreset[] {
  return REVERB_PRESETS.filter((p) => p.category === category);
}

export function searchPresets(query: string): ReverbPreset[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return REVERB_PRESETS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.useCases.some((u) => u.toLowerCase().includes(q)) ||
      p.instruments.some((i) => i.toLowerCase().includes(q)),
  );
}

/** RT60 = time for reverb to decay 60 dB. Estimate from decayMs and damping. */
export function calculateRT60(decayMs: number, highFreqDamping: number): number {
  if (decayMs <= 0) return 0;
  // High-freq damping shortens perceived RT60 slightly.
  return decayMs * (1 - highFreqDamping * 0.2);
}

/** Pre-delay ratio — how much of decay is the initial gap (0..1). */
export function preDelayRatio(preDelayMs: number, decayMs: number): number {
  if (decayMs <= 0) return 0;
  return Math.min(1, preDelayMs / (preDelayMs + decayMs));
}

/** Mix suggestion (wet %) based on reverb category. */
export function suggestMixLevel(category: ReverbPreset["category"]): number {
  const map: Record<ReverbPreset["category"], number> = {
    hall: 22,
    plate: 18,
    spring: 30,
    room: 12,
    chamber: 20,
  };
  return map[category] ?? 15;
}

/** Convert ms to seconds string. */
export function msToSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Compare two presets side by side. Returns diff fields. */
export function comparePresets(a: ReverbPreset, b: ReverbPreset): Array<{ field: string; a: string; b: string }> {
  return [
    { field: "Category", a: a.category, b: b.category },
    { field: "Decay", a: msToSeconds(a.decayMs), b: msToSeconds(b.decayMs) },
    { field: "Pre-delay", a: msToSeconds(a.preDelayMs), b: msToSeconds(b.preDelayMs) },
    { field: "Diffusion", a: `${Math.round(a.diffusion * 100)}%`, b: `${Math.round(b.diffusion * 100)}%` },
    { field: "Density", a: `${Math.round(a.density * 100)}%`, b: `${Math.round(b.density * 100)}%` },
    { field: "HF Damping", a: `${Math.round(a.highFreqDamping * 100)}%`, b: `${Math.round(b.highFreqDamping * 100)}%` },
    { field: "Low Ratio", a: a.lowRatio.toFixed(2), b: b.lowRatio.toFixed(2) },
  ];
}

/** Format preset as plain-text reference card. */
export function formatPresetAsText(p: ReverbPreset): string {
  const lines = [
    `${p.name.toUpperCase()} (${p.category})`,
    `${p.description}`,
    ``,
    `Decay (RT60):      ${msToSeconds(p.decayMs)}`,
    `Pre-delay:         ${msToSeconds(p.preDelayMs)}`,
    `Diffusion:         ${Math.round(p.diffusion * 100)}%`,
    `Density:           ${Math.round(p.density * 100)}%`,
    `HF Damping:        ${Math.round(p.highFreqDamping * 100)}%`,
    `Low Ratio:         ${p.lowRatio.toFixed(2)}`,
    `Suggested Mix:     ${suggestMixLevel(p.category)}%`,
    ``,
    `Use cases:    ${p.useCases.join(", ")}`,
    `Instruments:  ${p.instruments.join(", ")}`,
    `Examples:     ${p.famousExamples.join(", ")}`,
  ];
  return lines.join("\n");
}

/** Export all presets as CSV. */
export function exportPresetsAsCSV(): string {
  const header = [
    "id",
    "name",
    "category",
    "decay_ms",
    "pre_delay_ms",
    "diffusion",
    "density",
    "hf_damping",
    "low_ratio",
    "description",
  ];
  const rows = REVERB_PRESETS.map((p) =>
    [
      p.id,
      `"${p.name}"`,
      p.category,
      p.decayMs,
      p.preDelayMs,
      p.diffusion,
      p.density,
      p.highFreqDamping,
      p.lowRatio,
      `"${p.description.replace(/"/g, '""')}"`,
    ].join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

/** Recommended reverb plugin chain for a given category. */
export function recommendPluginChain(category: ReverbPreset["category"]): string[] {
  const chains: Record<ReverbPreset["category"], string[]> = {
    hall: ["EQ (cut muddy 200-400 Hz)", "Reverb (hall)", "Sidechain compressor on reverb"],
    plate: ["Reverb (plate)", "EQ (add 8 kHz air)", "De-esser before reverb"],
    spring: ["Reverb (spring)", "Tape saturation", "Low-pass filter at 6 kHz"],
    room: ["Reverb (room)", "Subtle compression", "EQ (roll off <100 Hz)"],
    chamber: ["Pre-delay 20-30 ms", "Reverb (chamber)", "EQ (warm mids)"],
  };
  return chains[category] ?? [];
}

/** Validate custom decay/pre-delay values for a hall-type preset. */
export function validateReverbParams(params: {
  decayMs?: number;
  preDelayMs?: number;
  diffusion?: number;
}): string[] {
  const warnings: string[] = [];
  if (params.decayMs !== undefined) {
    if (params.decayMs < 100) warnings.push("Decay below 100 ms is barely audible — consider using a room preset.");
    if (params.decayMs > 6000) warnings.push("Decay above 6 s will sound washed out for most material.");
  }
  if (params.preDelayMs !== undefined) {
    if (params.preDelayMs < 0) warnings.push("Pre-delay cannot be negative.");
    if (params.preDelayMs > 200) warnings.push("Pre-delay above 200 ms separates reverb from source — use sparingly.");
  }
  if (params.diffusion !== undefined) {
    if (params.diffusion < 0 || params.diffusion > 1) warnings.push("Diffusion must be between 0 and 1.");
  }
  return warnings;
}
