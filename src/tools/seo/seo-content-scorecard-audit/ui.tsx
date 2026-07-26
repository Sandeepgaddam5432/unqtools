"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { auditContent, buildHtmlReport, type AuditInput, type AuditResult } from "./logic";

const SAMPLE_HTML = `<!doctype html><html><head>
<title>Best Running Shoes 2026 — Reviews & Buying Guide</title>
<meta name="description" content="We tested 47 running shoes for 200+ miles. See the best running shoes for road, trail, and racing in 2026.">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Best Running Shoes 2026"}</script>
</head><body>
<h1>Best Running Shoes 2026</h1>
<p>Looking for the best running shoes? We tested 47 pairs for 200+ miles each. Here are the best running shoes for every runner.</p>
<h2>Road Running Shoes</h2>
<p>The best running shoes for road runners balance cushion and responsiveness. Our top pick is the Example Pro.</p>
<a href="/road-shoes">Road shoes</a> <a href="https://example.com/external">External</a>
<h2>Trail Running Shoes</h2>
<p>For trail runners we recommend grippy outsoles. The best running shoes here have rock plates.</p>
<img src="/shoe1.jpg" alt="Road shoe">
<img src="/shoe2.jpg">
</body></html>`;

function impactColor(impact: "high" | "medium" | "low"): string {
  if (impact === "high") return "#ef4444";
  if (impact === "medium") return "#eab308";
  return "#6b7280";
}

function scoreColor(score: number): string {
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#eab308";
  return "#ef4444";
}

export default function SeoContentScorecardAudit() {
  const [content, setContent] = useState(SAMPLE_HTML);
  const [keyword, setKeyword] = useState("best running shoes");
  const [competitor, setCompetitor] = useState("");
  const [minWords, setMinWords] = useState(600);
  const [error, setError] = useState<string | null>(null);

  const input: AuditInput = useMemo(() => ({ content, keyword, competitor: competitor || undefined, minWords }), [content, keyword, competitor, minWords]);
  const result = useMemo(() => {
    const r = auditContent(input);
    if ("error" in r) { queueMicrotask(() => setError(r.error)); return null; }
    queueMicrotask(() => setError(null));
    return r;
  }, [input]);

  const downloadReport = useCallback(() => {
    if (!result) return;
    const html = buildHtmlReport(result, keyword);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "seo-audit-report.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [result, keyword]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Target keyword</Label>
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Page content (HTML or plain text)</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} className="font-mono text-xs" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Competitor content (optional benchmark)</Label>
              <Textarea value={competitor} onChange={(e) => setCompetitor(e.target.value)} rows={4} className="font-mono text-xs" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Min word count (depth target)</Label>
              <Input type="number" min={100} value={minWords} onChange={(e) => setMinWords(Number(e.target.value))} />
              <div className="text-xs text-muted-foreground mt-2">Tip: paste full HTML to enable title/meta/headings/links/images/schema audits. Plain text skips those sub-scores.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-6 flex-wrap">
                <div className="relative w-24 h-24">
                  <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15" fill="none" stroke={scoreColor(result.overall)} strokeWidth="3"
                      strokeDasharray={`${(result.overall / 100) * 94.2} 94.2`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-xl font-bold" style={{ color: scoreColor(result.overall) }}>
                    {result.overall}
                  </div>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-medium">{result.recommendation}</p>
                  {result.competitorWordCount !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">Competitor: {result.competitorWordCount} words vs yours: {result.metrics.wordCount}.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Sub-scores</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {result.subScores.map((s) => (
                <div key={s.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{s.label}</span>
                    <span style={{ color: scoreColor(s.score) }}>{s.score}/100 ({(s.weight * 100).toFixed(0)}%)</span>
                  </div>
                  <div className="h-1.5 rounded bg-muted overflow-hidden">
                    <div className="h-full" style={{ width: `${s.score}%`, background: scoreColor(s.score) }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{s.rule}</p>
                  <ul className="text-xs text-muted-foreground list-disc list-inside">
                    {s.evidence.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                  {s.fixes.length > 0 && (
                    <ul className="text-xs">
                      {s.fixes.map((f, i) => (
                        <li key={i} style={{ color: impactColor(f.impact) }}>
                          {"•"} [{f.impact}] {f.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Prioritized fix list</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 space-y-1">
              {result.allFixes.length === 0 && <p className="text-xs text-muted-foreground">No fixes needed — content is in good shape.</p>}
              {result.allFixes.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-xs py-1">
                  <Badge variant="outline" style={{ color: impactColor(f.impact) }}>{f.impact}</Badge>
                  <span className="text-muted-foreground">{f.area}:</span>
                  <span>{f.text}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Metrics</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">Words: {result.metrics.wordCount}</Badge>
                <Badge variant="outline">Unique: {result.metrics.uniqueWords}</Badge>
                <Badge variant="outline">H1/H2/H3: {result.metrics.headingCounts.h1}/{result.metrics.headingCounts.h2}/{result.metrics.headingCounts.h3}</Badge>
                <Badge variant="outline">Internal links: {result.metrics.internalLinks}</Badge>
                <Badge variant="outline">External links: {result.metrics.externalLinks}</Badge>
                <Badge variant="outline">Images: {result.metrics.images} (missing alt: {result.metrics.imagesWithoutAlt})</Badge>
                <Badge variant="outline">Flesch: {result.metrics.fleschScore}</Badge>
                <Badge variant="outline">KW density: {result.metrics.keywordDensity.toFixed(2)}%</Badge>
                {result.metrics.hasSchema && <Badge variant="secondary">Schema: {result.metrics.schemaTypes.join(", ")}</Badge>}
              </div>
              {result.metrics.title && <p className="text-xs mt-2"><strong>Title:</strong> {result.metrics.title}</p>}
              {result.metrics.metaDescription && <p className="text-xs"><strong>Meta:</strong> {result.metrics.metaDescription}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex flex-wrap gap-2 justify-end">
              <CopyButton getText={() => JSON.stringify(result, null, 2)} label="Copy JSON" />
              <DownloadButton getText={() => buildHtmlReport(result, keyword)} filename="seo-audit-report.html" mime="text/html" />
              <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(result.allFixes.map((f) => `[${f.impact}] ${f.area}: ${f.text}`).join("\n"))}>Copy fix list</Button>
            </CardContent>
          </Card>

          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground"><strong className="text-foreground">Honest note:</strong> scores are guidance, not ranking guarantees. Auditing pasted content is 100% client-side; no URL fetch, no upload.</p>
          </CardContent></Card>
        </>
      )}
    </div>
  );
}
