/**
 * SERP Feature Detector — pure logic.
 * Metrics calculation utilities.
 */

export interface MetricsInput {
  keyword: string;
  searchVolume: number;
  cpc: number; // cost per click in USD
  competition: number; // 0-1
  wordCount: number; // of top-ranking content
  backlinks: number; // of top-ranking page
  domainAuthority: number; // 0-100
}

export interface MetricsResult {
  difficulty: number; // 0-100
  opportunity: number; // 0-100
  potential: number; // 0-100
  competitionLevel: "Low" | "Medium" | "High" | "Very High";
  estimatedTraffic: number;
  estimatedRevenue: number;
  recommendations: string[];
}

export function calculateMetrics(input: MetricsInput): MetricsResult {
  const recommendations: string[] = [];

  // Difficulty: weighted combination
  const compScore = input.competition * 50;
  const daScore = (input.domainAuthority / 100) * 30;
  const backlinkScore = Math.min(20, Math.log10(input.backlinks + 1) * 5);
  const difficulty = Math.round(Math.min(100, compScore + daScore + backlinkScore));

  // Opportunity: inverse of difficulty + search volume
  const volScore = Math.min(50, Math.log10(input.searchVolume + 1) * 10);
  const opportunity = Math.round(Math.max(0, 100 - difficulty + volScore - 25));

  // Potential: opportunity * estimated traffic
  const estimatedTraffic = Math.round(input.searchVolume * 0.3); // assume 30% CTR for top 3
  const estimatedRevenue = Math.round(estimatedTraffic * input.cpc * 0.05); // 5% conversion
  const potential = Math.round((opportunity + Math.min(50, estimatedTraffic / 100)) / 2);

  // Competition level
  let competitionLevel: MetricsResult["competitionLevel"];
  if (input.competition < 0.25) competitionLevel = "Low";
  else if (input.competition < 0.5) competitionLevel = "Medium";
  else if (input.competition < 0.75) competitionLevel = "High";
  else competitionLevel = "Very High";

  // Recommendations
  if (difficulty > 70) recommendations.push("Very high difficulty — consider long-tail variations");
  if (input.searchVolume > 1000 && difficulty < 50) recommendations.push("Good opportunity — high volume, low difficulty");
  if (input.domainAuthority < 30) recommendations.push("Your DA is low — focus on lower-difficulty keywords");
  if (input.cpc > 5) recommendations.push("High CPC — good for monetization");
  if (input.wordCount < 1000) recommendations.push("Top content is short — aim for 1500+ words");
  if (input.backlinks > 100) recommendations.push("Top page has many backlinks — link building required");

  return {
    difficulty,
    opportunity: Math.max(0, Math.min(100, opportunity)),
    potential: Math.max(0, Math.min(100, potential)),
    competitionLevel,
    estimatedTraffic,
    estimatedRevenue,
    recommendations,
  };
}

export function calculateBulk(inputs: MetricsInput[]): MetricsResult[] {
  return inputs.map(calculateMetrics);
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  if (score >= 20) return "Poor";
  return "Very Poor";
}

export function getDifficultyLabel(score: number): string {
  if (score < 25) return "Easy";
  if (score < 50) return "Moderate";
  if (score < 75) return "Hard";
  return "Very Hard";
}

export function exportResults(results: MetricsResult[], format: "json" | "csv"): string {
  if (format === "json") return JSON.stringify(results, null, 2);
  const rows = [["Difficulty", "Opportunity", "Potential", "Competition", "Est. Traffic", "Est. Revenue"]];
  for (const r of results) {
    rows.push([
      String(r.difficulty),
      String(r.opportunity),
      String(r.potential),
      r.competitionLevel,
      String(r.estimatedTraffic),
      String(r.estimatedRevenue),
    ]);
  }
  return rows.map((r) => r.join(",")).join("\n");
}

export function parseBulkInput(text: string): MetricsInput[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  return lines.map((line) => {
    const parts = line.split(",").map((p) => p.trim());
    return {
      keyword: parts[0] || "",
      searchVolume: parseInt(parts[1] || "0", 10) || 0,
      cpc: parseFloat(parts[2] || "0") || 0,
      competition: parseFloat(parts[3] || "0") || 0,
      wordCount: parseInt(parts[4] || "0", 10) || 0,
      backlinks: parseInt(parts[5] || "0", 10) || 0,
      domainAuthority: parseInt(parts[6] || "0", 10) || 0,
    };
  });
}
