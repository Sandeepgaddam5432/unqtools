/**
 * Codec Comparison — pure logic.
 * Compare two codecs across quality, compression, and compatibility.
 */

export interface CodecSpec {
  id: string;
  name: string;
  type: "video" | "audio";
  generation: number; // 1=oldest, 5=newest
  qualityScore: number; // 0-100
  compressionScore: number; // 0-100 (higher = smaller at same quality)
  compatibilityScore: number; // 0-100 (browser/device support)
  encodingSpeed: "slow" | "medium" | "fast";
  royaltyFree: boolean;
  typicalBitrate: string;
  yearIntroduced: number;
}

const CODECS: CodecSpec[] = [
  { id: "h264", name: "H.264 (AVC)", type: "video", generation: 2, qualityScore: 65, compressionScore: 50, compatibilityScore: 100, encodingSpeed: "fast", royaltyFree: false, typicalBitrate: "2-8 Mbps (1080p)", yearIntroduced: 2003 },
  { id: "h265", name: "H.265 (HEVC)", type: "video", generation: 3, qualityScore: 80, compressionScore: 75, compatibilityScore: 60, encodingSpeed: "slow", royaltyFree: false, typicalBitrate: "1-4 Mbps (1080p)", yearIntroduced: 2013 },
  { id: "vp9", name: "VP9", type: "video", generation: 3, qualityScore: 78, compressionScore: 73, compatibilityScore: 70, encodingSpeed: "medium", royaltyFree: true, typicalBitrate: "1-4 Mbps (1080p)", yearIntroduced: 2013 },
  { id: "av1", name: "AV1", type: "video", generation: 4, qualityScore: 90, compressionScore: 90, compatibilityScore: 65, encodingSpeed: "slow", royaltyFree: true, typicalBitrate: "0.5-3 Mbps (1080p)", yearIntroduced: 2018 },
  { id: "mp3", name: "MP3", type: "audio", generation: 1, qualityScore: 50, compressionScore: 40, compatibilityScore: 100, encodingSpeed: "fast", royaltyFree: false, typicalBitrate: "128-320 kbps", yearIntroduced: 1993 },
  { id: "aac", name: "AAC", type: "audio", generation: 2, qualityScore: 70, compressionScore: 60, compatibilityScore: 95, encodingSpeed: "fast", royaltyFree: false, typicalBitrate: "96-256 kbps", yearIntroduced: 1997 },
  { id: "opus", name: "Opus", type: "audio", generation: 3, qualityScore: 88, compressionScore: 85, compatibilityScore: 75, encodingSpeed: "fast", royaltyFree: true, typicalBitrate: "6-510 kbps", yearIntroduced: 2012 },
  { id: "flac", name: "FLAC", type: "audio", generation: 2, qualityScore: 100, compressionScore: 30, compatibilityScore: 70, encodingSpeed: "fast", royaltyFree: true, typicalBitrate: "800-1100 kbps", yearIntroduced: 2001 },
];

export function getAllCodecs(): CodecSpec[] {
  return [...CODECS];
}

export function getCodecById(id: string): CodecSpec | null {
  return CODECS.find((c) => c.id === id) ?? null;
}

export function getCodecsByType(type: "video" | "audio"): CodecSpec[] {
  return CODECS.filter((c) => c.type === type);
}

export interface ComparisonMetric {
  metric: string;
  a: number | string | boolean;
  b: number | string | boolean;
  winner: "a" | "b" | "tie";
  better: "higher" | "lower" | "n/a";
}

export interface CodecComparisonResult {
  a: CodecSpec;
  b: CodecSpec;
  metrics: ComparisonMetric[];
  overallWinner: "a" | "b" | "tie";
  recommendation: string;
}

/** Compare two codecs across multiple metrics. */
export function compareCodecs(idA: string, idB: string): CodecComparisonResult | null {
  const a = getCodecById(idA);
  const b = getCodecById(idB);
  if (!a || !b) return null;

  const numericMetric = (metric: string, av: number, bv: number, higher = true): ComparisonMetric => {
    let winner: "a" | "b" | "tie" = "tie";
    if (av === bv) winner = "tie";
    else if (higher ? av > bv : av < bv) winner = "a";
    else winner = "b";
    return { metric, a: av, b: bv, winner, better: higher ? "higher" : "lower" };
  };

  const metrics: ComparisonMetric[] = [
    numericMetric("Quality", a.qualityScore, b.qualityScore, true),
    numericMetric("Compression", a.compressionScore, b.compressionScore, true),
    numericMetric("Compatibility", a.compatibilityScore, b.compatibilityScore, true),
    numericMetric("Generation", a.generation, b.generation, true),
  ];

  // Count wins
  let aWins = metrics.filter((m) => m.winner === "a").length;
  let bWins = metrics.filter((m) => m.winner === "b").length;
  if (a.royaltyFree && !b.royaltyFree) aWins++;
  if (b.royaltyFree && !a.royaltyFree) bWins++;

  let overallWinner: "a" | "b" | "tie" = "tie";
  if (aWins > bWins) overallWinner = "a";
  else if (bWins > aWins) overallWinner = "b";

  const recommendation =
    overallWinner === "tie"
      ? `${a.name} and ${b.name} are roughly equivalent; choose based on your specific platform.`
      : overallWinner === "a"
      ? `${a.name} is the better all-around choice vs ${b.name}.`
      : `${b.name} is the better all-around choice vs ${a.name}.`;

  return { a, b, metrics, overallWinner, recommendation };
}

export function summarizeCodec(codec: CodecSpec): string {
  const rf = codec.royaltyFree ? "royalty-free" : "licensed";
  return `${codec.name}: quality ${codec.qualityScore}/100, compression ${codec.compressionScore}/100, ${rf}, introduced ${codec.yearIntroduced}.`;
}
