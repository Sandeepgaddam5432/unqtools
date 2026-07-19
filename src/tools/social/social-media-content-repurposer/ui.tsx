"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  SOURCE_TYPES,
  TARGET_FORMATS,
  TONES,
  SOURCE_TYPE_LABELS,
  TARGET_FORMAT_LABELS,
  TONE_LABELS,
  SOURCE_TYPE_PRESETS,
  TARGET_FORMAT_CONFIGS,
  analyzeContent,
  generateForFormats,
  generateVariations,
  scoreContentQuality,
  checkCrossFormatConsistency,
  recommendBestFormat,
  computeSummaryStats,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SourceType,
  type TargetFormat,
  type Tone,
  type RepurposerInput,
  type HistoryEntry,
} from "./logic";
import {
  History, Repeat, Sparkles, CheckCircle2, AlertTriangle,
  Lightbulb, BarChart3, FileText,
} from "lucide-react";

export default function SocialMediaContentRepurposer() {
  const [sourceContent, setSourceContent] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("blog-post");
  const [targetFormats, setTargetFormats] = useState<TargetFormat[]>([
    "twitter-thread", "linkedin-post",
  ]);
  const [tone, setTone] = useState<Tone>("professional");
  const [includeCTA, setIncludeCTA] = useState(true);
  const [maxItemsPerFormat, setMaxItemsPerFormat] = useState(5);
  const [showVariations, setShowVariations] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.sourceContent) setSourceContent(p.sourceContent);
      setSourceType(p.sourceType);
      if (p.targetFormats.length > 0) setTargetFormats(p.targetFormats);
      setTone(p.tone);
      setIncludeCTA(p.includeCTA);
      setMaxItemsPerFormat(p.maxItemsPerFormat);
      if (p.sourceContent || p.targetFormats.length > 0) {
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const analysis = useMemo(
    () => analyzeContent(sourceContent, Math.max(maxItemsPerFormat, 7)),
    [sourceContent, maxItemsPerFormat],
  );

  const input: RepurposerInput = useMemo(
    () => ({
      sourceContent,
      sourceType,
      targetFormats,
      tone,
      includeCTA,
      maxItemsPerFormat,
    }),
    [sourceContent, sourceType, targetFormats, tone, includeCTA, maxItemsPerFormat],
  );

  const opts = useMemo(
    () => ({ tone, includeCTA, maxItemsPerFormat }),
    [tone, includeCTA, maxItemsPerFormat],
  );

  const results = useMemo(() => {
    if (!sourceContent.trim() || targetFormats.length === 0) return [];
    if (showVariations) {
      const out = [] as ReturnType<typeof generateForFormats>;
      for (const f of targetFormats) {
        out.push(...generateVariations(f, analysis, opts));
      }
      return out;
    }
    return generateForFormats(targetFormats, analysis, opts);
  }, [sourceContent, targetFormats, analysis, opts, showVariations]);

  const quality = useMemo(() => scoreContentQuality(analysis), [analysis]);
  const stats = useMemo(() => computeSummaryStats(results), [results]);
  const consistency = useMemo(
    () => checkCrossFormatConsistency(results, analysis.keyPoints),
    [results, analysis.keyPoints],
  );
  const recommendations = useMemo(
    () => recommendBestFormat(sourceType),
    [sourceType],
  );

  const text = useMemo(() => renderText(results), [results]);
  const csv = useMemo(() => renderCsv(results), [results]);

  const handleSaveHistory = useCallback(() => {
    if (results.length > 0) {
      saveHistory({
        ts: Date.now(),
        sourceType,
        targetFormats,
        tone,
        wordCount: analysis.wordCount,
        totalFormats: stats.totalFormats,
        totalChars: stats.totalChars,
      });
      setHistory(loadHistory());
    }
  }, [results, sourceType, targetFormats, tone, analysis.wordCount, stats]);

  const toggleFormat = (f: TargetFormat) => {
    setTargetFormats((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );
  };

  const loadPreset = (s: SourceType) => {
    setSourceType(s);
    setSourceContent(SOURCE_TYPE_PRESETS[s]);
    toast.info(`Loaded ${SOURCE_TYPE_LABELS[s]} sample`);
  };

  const handleClear = useCallback(() => {
    setSourceContent("");
    setTargetFormats([]);
    setTone("professional");
    setIncludeCTA(true);
    setMaxItemsPerFormat(5);
    setShowVariations(false);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const qualityColor = quality.rating === "high"
    ? "text-emerald-600 dark:text-emerald-400"
    : quality.rating === "medium"
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="smcr-source">Source content</Label>
              <Badge variant="outline" className="text-[10px]">
                {analysis.wordCount} words · {analysis.sentenceCount} sentences
              </Badge>
            </div>
            <Textarea
              id="smcr-source"
              value={sourceContent}
              onChange={(e) => setSourceContent(e.target.value)}
              placeholder="Paste your blog post, YouTube transcript, podcast transcript, email newsletter, or presentation slides here…"
              className="min-h-[180px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] text-muted-foreground mr-1 self-center">Load sample:</span>
              {SOURCE_TYPES.map((s) => (
                <Button
                  key={s}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => loadPreset(s)}
                >+ {SOURCE_TYPE_LABELS[s]}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="smcr-source-type" className="text-xs">Source type</Label>
              <select
                id="smcr-source-type"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as SourceType)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {SOURCE_TYPES.map((s) => (
                  <option key={s} value={s}>{SOURCE_TYPE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smcr-tone" className="text-xs">Tone</Label>
              <select
                id="smcr-tone"
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>{TONE_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Target formats ({targetFormats.length} selected)</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {TARGET_FORMATS.map((f) => (
                <label key={f} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={targetFormats.includes(f)}
                    onChange={() => toggleFormat(f)}
                  />
                  {TARGET_FORMAT_LABELS[f]}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="smcr-max" className="text-xs">Max items per format</Label>
              <Input
                id="smcr-max"
                type="number"
                min={1}
                max={20}
                value={maxItemsPerFormat}
                onChange={(e) => setMaxItemsPerFormat(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 5)))}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smcr-cta" className="text-xs">Include CTA</Label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer h-9">
                <input
                  id="smcr-cta"
                  type="checkbox"
                  checked={includeCTA}
                  onChange={(e) => setIncludeCTA(e.target.checked)}
                />
                {includeCTA ? "Yes — append CTA per format" : "No — skip CTAs"}
              </label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smcr-var" className="text-xs">Variations</Label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer h-9">
                <input
                  id="smcr-var"
                  type="checkbox"
                  checked={showVariations}
                  onChange={(e) => setShowVariations(e.target.checked)}
                />
                {showVariations ? "2 variations per format" : "1 variation per format"}
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {sourceContent.trim() && targetFormats.length > 0 ? (
        <>
          {/* Analysis summary */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> Content Analysis
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Title" value={analysis.title ? truncate(analysis.title, 28) : "—"} />
                <Stat label="Key points" value={analysis.keyPoints.length} />
                <Stat label="Stats" value={analysis.stats.length} />
                <Stat label="Quotes" value={analysis.quotes.length} />
              </div>
              {analysis.hook && (
                <div className="rounded border bg-background px-3 py-2 text-xs">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Hook: </span>
                  <span className="text-foreground">{truncate(analysis.hook, 200)}</span>
                </div>
              )}
              {analysis.keyPoints.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Key points</div>
                  {analysis.keyPoints.map((kp, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1 text-xs">
                      <span className="text-muted-foreground mr-2">{i + 1}.</span>
                      {kp}
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <div className="rounded border bg-background px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" /> Quality Score
                  </div>
                  <div className={`text-base font-semibold ${qualityColor}`}>
                    {quality.score}/100 ({quality.rating})
                  </div>
                  {quality.reasons.length > 0 && (
                    <ul className="text-[10px] text-muted-foreground mt-1 space-y-0.5">
                      {quality.reasons.slice(0, 3).map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded border bg-background px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    {consistency.consistent
                      ? <CheckCircle2 className="h-3 w-3" />
                      : <AlertTriangle className="h-3 w-3" />}
                    Cross-format Consistency
                  </div>
                  <div className={`text-base font-semibold ${
                    consistency.consistent
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}>
                    {consistency.coveragePercent}% coverage
                  </div>
                  {consistency.missingFrom.length > 0 && (
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {consistency.missingFrom.length} format(s) missing key points
                    </div>
                  )}
                </div>
                <div className="rounded border bg-background px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <Lightbulb className="h-3 w-3" /> Recommended for {SOURCE_TYPE_LABELS[sourceType]}
                  </div>
                  <div className="text-xs font-medium text-foreground mt-1">
                    {recommendations.map((r) => TARGET_FORMAT_LABELS[r]).join(" → ")}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary stats */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Repeat className="h-4 w-4" /> {results.length} repurposed pieces across {stats.totalFormats} format(s)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total formats" value={stats.totalFormats} />
                <Stat label="Total items" value={stats.totalItems} />
                <Stat label="Total chars" value={stats.totalChars} />
                <Stat label="Avg chars/piece" value={results.length > 0 ? Math.round(stats.totalChars / results.length) : 0} />
              </div>
              {stats.byFormat.length > 0 && (
                <div className="space-y-1 pt-2">
                  {stats.byFormat.map((s) => (
                    <div key={s.format} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{s.label}</span>
                        <Badge variant="secondary" className="text-[10px]">{s.variations} variation(s)</Badge>
                        <Badge variant="outline" className="text-[10px]">{s.itemCount} items</Badge>
                        <Badge variant="outline" className="text-[10px]">{s.charCount} chars</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generated content */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Repurposed Content
                </h3>
              </div>
              <div className="space-y-3 max-h-[600px] overflow-auto">
                {results.map((r, i) => (
                  <div key={i} className="rounded border bg-background p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-[10px]">
                        {TARGET_FORMAT_LABELS[r.format]}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        v{r.variation}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {r.charCount}/{TARGET_FORMAT_CONFIGS[r.format].maxChars} chars
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {r.itemCount} items
                      </Badge>
                    </div>
                    <pre className="text-xs whitespace-pre-wrap font-mono text-foreground">
                      {r.content}
                    </pre>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy all"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename="repurposed-content.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="repurposed-content.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste source content and pick target formats"
          hint="Load a sample preset above, paste your own content, and select one or more of the 7 target formats. The tool will analyze your content and generate platform-specific versions."
          icon={<Repeat className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{SOURCE_TYPE_LABELS[h.sourceType]}</Badge>
                  <Badge variant="outline" className="mr-2">{TONE_LABELS[h.tone]}</Badge>
                  <Badge variant="outline" className="mr-2">{h.totalFormats} formats</Badge>
                  <Badge variant="outline" className="mr-2">{h.wordCount} words</Badge>
                  <span className="text-muted-foreground">{h.targetFormats.map((f) => TARGET_FORMAT_LABELS[f]).join(", ")}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All content analysis and repurposing runs locally in your browser. History is stored in localStorage on this device only — your source content never leaves your machine.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
