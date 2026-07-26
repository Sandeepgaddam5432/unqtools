/**
 * Audio LUFS Reference — pure logic.
 * LUFS / true-peak / loudness standards (EBU R128, ATSC A/85, Spotify, Apple, etc.).
 */

export interface LoudnessStandard {
  id: string;
  name: string;
  platform: string;
  targetLufs: number;
  truePeakDbfs: number;
  lraRange: string;
  region: string;
  notes: string;
  enforcement: "hard" | "soft" | "recommended";
}

export const LOUDNESS_STANDARDS: LoudnessStandard[] = [
  { id: "ebu-r128", name: "EBU R128", platform: "European broadcast TV/radio", targetLufs: -23, truePeakDbfs: -1, lraRange: "±1 LU", region: "Europe", notes: "European Broadcasting Union standard for all TV & radio.", enforcement: "hard" },
  { id: "atsc-a85", name: "ATSC A/85 (CALM Act)", platform: "US broadcast TV", targetLufs: -24, truePeakDbfs: -2, lraRange: "±2 LU", region: "USA", notes: "US CALM Act mandates consistent loudness across commercials.", enforcement: "hard" },
  { id: "spotify", name: "Spotify", platform: "Spotify (free & premium)", targetLufs: -14, truePeakDbfs: -1, lraRange: "—", region: "Global", notes: "Spotify normalizes all tracks to -14 LUFS. Louder masters get turned down.", enforcement: "hard" },
  { id: "apple-music", name: "Apple Music / Sound Check", platform: "Apple Music", targetLufs: -16, truePeakDbfs: -1, lraRange: "—", region: "Global", notes: "Apple's Sound Check normalizes to -16 LUFS.", enforcement: "hard" },
  { id: "youtube", name: "YouTube Music", platform: "YouTube / YT Music", targetLufs: -14, truePeakDbfs: -1, lraRange: "—", region: "Global", notes: "YouTube normalizes to ~-14 LUFS. Tracks louder than this are attenuated.", enforcement: "soft" },
  { id: "tidal", name: "Tidal", platform: "Tidal HiFi", targetLufs: -14, truePeakDbfs: -1, lraRange: "—", region: "Global", notes: "Tidal applies album-level normalization.", enforcement: "soft" },
  { id: "amazon", name: "Amazon Music", platform: "Amazon Music HD", targetLufs: -14, truePeakDbfs: -1, lraRange: "—", region: "Global", notes: "Amazon normalizes to -14 LUFS across all tiers.", enforcement: "soft" },
  { id: "deezer", name: "Deezer", platform: "Deezer streaming", targetLufs: -15, truePeakDbfs: -1, lraRange: "—", region: "Global", notes: "Deezer target slightly quieter than Spotify.", enforcement: "soft" },
  { id: "club", name: "Club / Festival master", platform: "Live DJ sets", targetLufs: -8, truePeakDbfs: -0.5, lraRange: "—", region: "Global", notes: "Loud, compressed masters for club systems. Not for streaming.", enforcement: "recommended" },
  { id: "podcast", name: "Podcast (Spotify/Loudness)", platform: "Podcasts", targetLufs: -16, truePeakDbfs: -1, lraRange: "—", region: "Global", notes: "Podcast standard around -16 LUFS for speech clarity.", enforcement: "recommended" },
];

export function getAllStandards(): LoudnessStandard[] {
  return [...LOUDNESS_STANDARDS];
}

export function getStandardById(id: string): LoudnessStandard | null {
  return LOUDNESS_STANDARDS.find((s) => s.id === id) ?? null;
}

export function getStandardsByPlatform(platform: string): LoudnessStandard[] {
  const q = platform.toLowerCase();
  return LOUDNESS_STANDARDS.filter((s) => s.platform.toLowerCase().includes(q));
}

/** Gain change (dB) needed to move from current LUFS to target LUFS. */
export function gainChange(currentLufs: number, targetLufs: number): number {
  return targetLufs - currentLufs;
}

/** New LUFS after applying gain (dB). */
export function applyGain(currentLufs: number, gainDb: number): number {
  return currentLufs + gainDb;
}

/** Convert LUFS to dBFS approximation (integrated LUFS ≈ RMS - 0.691 dB K-weighted offset). */
export function lufsToRmsDb(lufs: number): number {
  return lufs + 0.691;
}

export function rmsDbToLufs(rmsDb: number): number {
  return rmsDb - 0.691;
}

/** True-peak margin recommendation given LUFS target. */
export function recommendedTruePeakMargin(targetLufs: number): number {
  if (targetLufs >= -10) return -0.5;
  if (targetLufs >= -16) return -1.0;
  return -1.5;
}

/** Compare loudness across standards — returns gain offset relative to first. */
export function compareLoudness(currentLufs: number): Array<{ standard: string; target: number; offset: number }> {
  return LOUDNESS_STANDARDS.map((s) => ({
    standard: s.name,
    target: s.targetLufs,
    offset: gainChange(currentLufs, s.targetLufs),
  }));
}

/** Validate input LUFS. */
export function validateLufs(lufs: number): string[] {
  const w: string[] = [];
  if (lufs > 0) w.push("LUFS above 0 is impossible for normal audio — likely measurement error.");
  if (lufs < -70) w.push("LUFS below -70 dB indicates near-silence.");
  if (lufs > -5) w.push("LUFS above -5 is extremely loud — will be heavily attenuated by streaming platforms.");
  return w;
}

/** LRA (loudness range) interpretation. */
export function interpretLRA(lra: number): string {
  if (lra < 5) return "Very compressed — modern pop master";
  if (lra < 10) return "Moderate compression — radio-friendly";
  if (lra < 15) return "Natural dynamics — good for acoustic / jazz";
  if (lra < 20) return "Wide dynamics — classical / orchestral";
  return "Very wide dynamics — live recording";
}

/** Format standard as text card. */
export function formatStandardCard(s: LoudnessStandard): string {
  return [
    `${s.name} (${s.platform})`,
    `Target LUFS:     ${s.targetLufs}`,
    `True-peak:       ${s.truePeakDbfs} dBFS`,
    `LRA tolerance:   ${s.lraRange}`,
    `Region:          ${s.region}`,
    `Enforcement:     ${s.enforcement}`,
    ``,
    `Notes: ${s.notes}`,
  ].join("\n");
}

/** Export as CSV. */
export function exportStandardsCSV(): string {
  const header = ["id", "name", "platform", "target_lufs", "true_peak_dbfs", "lra_range", "region", "enforcement", "notes"];
  const rows = LOUDNESS_STANDARDS.map((s) =>
    [s.id, `"${s.name}"`, `"${s.platform}"`, s.targetLufs, s.truePeakDbfs, `"${s.lraRange}"`, `"${s.region}"`, s.enforcement, `"${s.notes.replace(/"/g, '""')}"`].join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

/** Detect if a master will be turned down on Spotify. */
export function spotifyTurnDown(currentLufs: number): { willTurnDown: boolean; amountDb: number } {
  const offset = gainChange(currentLufs, -14);
  return {
    willTurnDown: offset < 0,
    amountDb: offset < 0 ? Math.abs(offset) : 0,
  };
}

/** Suggest master LUFS for a delivery target. */
export function suggestMasterTarget(useCase: "streaming" | "broadcast-eu" | "broadcast-us" | "club" | "podcast"): number {
  const map = {
    streaming: -14,
    "broadcast-eu": -23,
    "broadcast-us": -24,
    club: -8,
    podcast: -16,
  };
  return map[useCase];
}

/** Dynamic range preservation score (0..100) for given LRA. */
export function dynamicsPreservationScore(lra: number): number {
  if (lra <= 0) return 0;
  if (lra >= 20) return 100;
  return Math.round((lra / 20) * 100);
}

/** Calculate crest factor (peak - RMS) in dB. */
export function crestFactor(peakDbfs: number, rmsDb: number): number {
  return peakDbfs - rmsDb;
}
