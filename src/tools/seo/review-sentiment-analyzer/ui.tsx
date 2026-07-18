"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  EXAMPLE_REVIEWS,
  FILTER_OPTIONS,
  parseReviews,
  filterReviews,
  computeSummaryStats,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type FilterOption,
  type HistoryEntry,
} from "./logic";
import { MessageSquareHeart, History, Star, AlertTriangle } from "lucide-react";

export default function ReviewSentimentAnalyzer() {
  const [reviewsText, setReviewsText] = useState("");
  const [filter, setFilter] = useState<FilterOption>("all");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.reviews) {
        setReviewsText(p.reviews);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const allReviews = useMemo(() => parseReviews(reviewsText), [reviewsText]);
  const filtered = useMemo(() => filterReviews(allReviews, filter), [allReviews, filter]);
  const stats = useMemo(() => computeSummaryStats(allReviews), [allReviews]);

  const text = useMemo(() => renderText(filtered, stats), [filtered, stats]);
  const csv = useMemo(() => renderCsv(filtered), [filtered]);

  const handleSaveHistory = useCallback(() => {
    if (allReviews.length > 0) {
      saveHistory({
        ts: Date.now(),
        reviewCount: allReviews.length,
        positive: stats.positive,
        negative: stats.negative,
        neutral: stats.neutral,
        avgScore: stats.avgScore,
        mismatchCount: stats.mismatchCount,
        preview: allReviews[0].text.slice(0, 60),
      });
      setHistory(loadHistory());
    }
  }, [allReviews, stats]);

  const handleClear = useCallback(() => {
    setReviewsText("");
    setFilter("all");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadExample = useCallback(() => {
    setReviewsText(EXAMPLE_REVIEWS);
    toast.info("Loaded example reviews");
  }, []);

  const labelColor = (label: string) =>
    label === "positive"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      : label === "negative"
        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="rsa-reviews">Customer reviews (one per line, optional <code className="text-[11px] bg-muted px-1 py-0.5 rounded">[1-5]</code> star prefix)</Label>
              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={handleLoadExample}>
                Load examples
              </Button>
            </div>
            <Textarea
              id="rsa-reviews"
              value={reviewsText}
              onChange={(e) => setReviewsText(e.target.value)}
              placeholder={"[5] Amazing service and friendly staff!\n[4] Good food, slow service.\n[1] Worst experience ever. Terrible and rude.\nNot great, not terrible."}
              className="min-h-[180px] resize-y font-mono text-xs"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Optional star rating prefix: <code className="bg-muted px-1 py-0.5 rounded">[5]</code>, <code className="bg-muted px-1 py-0.5 rounded">[4]</code>, …, <code className="bg-muted px-1 py-0.5 rounded">[1]</code>. Lines without a prefix are still analyzed.
          </p>
        </CardContent>
      </Card>

      {allReviews.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <MessageSquareHeart className="h-4 w-4" /> {allReviews.length} reviews analyzed
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total reviews" value={stats.total} />
                <Stat label="Avg sentiment" value={stats.avgScore} highlight={stats.avgScore > 0 ? "good" : stats.avgScore < 0 ? "bad" : undefined} />
                <Stat label="Avg stars" value={stats.avgStars ?? "n/a"} />
                <Stat label="Mismatches" value={stats.mismatchCount} highlight={stats.mismatchCount > 0 ? "bad" : undefined} />
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 text-xs pt-1">
                <Stat label="Positive" value={stats.positive} highlight="good" />
                <Stat label="Neutral" value={stats.neutral} />
                <Stat label="Negative" value={stats.negative} highlight="bad" />
              </div>
              <div className="rounded border bg-background px-3 py-2 text-xs">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Star distribution</div>
                <div className="flex items-center gap-3">
                  {[5, 4, 3, 2, 1].map((s) => (
                    <div key={s} className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                      <span className="font-mono font-semibold text-foreground">{s}★</span>
                      <span className="text-muted-foreground">{stats.starDistribution[s as 1 | 2 | 3 | 4 | 5]}</span>
                    </div>
                  ))}
                </div>
              </div>
              {stats.topTopics.length > 0 && (
                <div className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Top topics</div>
                  <div className="flex flex-wrap gap-1">
                    {stats.topTopics.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {stats.topWords.length > 0 && (
                <div className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Top 20 words (frequency)</div>
                  <div className="flex flex-wrap gap-1">
                    {stats.topWords.map((w, i) => (
                      <span key={w.word} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px]">
                        <span className="text-[9px] text-muted-foreground/70">{i + 1}.</span>
                        <span className="text-foreground font-medium">{w.word}</span>
                        <span className="text-muted-foreground">×{w.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <MessageSquareHeart className="h-4 w-4" /> Reviews ({filtered.length})
                </h3>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as FilterOption)}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  {FILTER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 max-h-[500px] overflow-auto">
                {filtered.map((r, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {r.stars !== null && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          <Star className="h-2.5 w-2.5 fill-current" />
                          {r.stars}
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${labelColor(r.label)}`}>
                        {r.label}
                      </span>
                      <span className="text-muted-foreground text-[10px]">score {r.score}</span>
                      {r.mismatch && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          <AlertTriangle className="h-2.5 w-2.5" /> mismatch
                        </span>
                      )}
                    </div>
                    <p className="text-foreground">{r.text}</p>
                    <div className="flex flex-wrap gap-1 text-[10px]">
                      {r.positiveWords.map((w) => (
                        <span key={`p-${w}`} className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">+ {w}</span>
                      ))}
                      {r.negativeWords.map((w) => (
                        <span key={`n-${w}`} className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">- {w}</span>
                      ))}
                      {r.topics.map((t) => (
                        <span key={`t-${t}`} className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">#{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {filtered.length > 0 && (
                <div className="text-xs text-muted-foreground pt-1">
                  Showing {filtered.length} of {allReviews.length} reviews
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy report"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename="review-sentiment-report.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="review-sentiment.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(reviewsText); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste customer reviews to analyze sentiment"
          hint="One review per line. Optionally prefix each with a star rating like [5] or [1]. Click 'Load examples' for a quick demo."
          icon={<MessageSquareHeart className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.reviewCount} reviews</Badge>
                  <Badge variant="outline" className="mr-2 text-emerald-600">+{h.positive}</Badge>
                  <Badge variant="outline" className="mr-2 text-red-600">-{h.negative}</Badge>
                  <Badge variant="outline" className="mr-2">~{h.neutral}</Badge>
                  {h.mismatchCount > 0 && (
                    <Badge variant="outline" className="mr-2 text-orange-600">{h.mismatchCount} mismatch</Badge>
                  )}
                  <span className="text-muted-foreground">avg {h.avgScore}</span>
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
            <strong className="text-foreground">Privacy:</strong> All sentiment analysis runs locally using a built-in word list. No AI, no network calls. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
