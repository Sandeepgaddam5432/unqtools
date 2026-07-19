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
  PLATFORMS,
  PLATFORM_CONFIGS,
  PLATFORM_LABELS,
  CATEGORY_LABELS,
  HASHTAG_TYPE_LABELS,
  TRENDING_NICHES,
  generate,
  analyzeDensity,
  computeStats,
  getTrendingForNiche,
  listTrendingNiches,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Platform,
  type HashtagEntry,
  type Category,
  type HistoryEntry,
} from "./logic";
import { History, Hash, TrendingUp, AlertCircle } from "lucide-react";

export default function HashtagGenerator() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [count, setCount] = useState(20);
  const [includeBranded, setIncludeBranded] = useState(true);
  const [includeNiche, setIncludeNiche] = useState(true);
  const [excludeGeneric, setExcludeGeneric] = useState(false);
  const [mixPopularNiche, setMixPopularNiche] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.topic) setTopic(p.topic);
      setPlatform(p.platform);
      setCount(p.count);
      setIncludeBranded(p.includeBranded);
      setIncludeNiche(p.includeNiche);
      setExcludeGeneric(p.excludeGeneric);
      setMixPopularNiche(p.mixPopularNiche);
      if (p.topic) toast.info("Loaded from share link");
    }
  }, []);

  const input = useMemo(
    () => ({
      topic,
      platform,
      count,
      includeBranded,
      includeNiche,
      excludeGeneric,
      mixPopularNiche,
    }),
    [topic, platform, count, includeBranded, includeNiche, excludeGeneric, mixPopularNiche],
  );

  const entries = useMemo(() => generate(input), [input]);
  const stats = useMemo(() => computeStats(entries), [entries]);
  const density = useMemo(() => analyzeDensity(input, count), [input, count]);
  const textReport = useMemo(() => renderText(entries), [entries]);
  const csv = useMemo(() => renderCsv(entries, platform), [entries, platform]);

  const handleSaveHistory = useCallback(() => {
    if (entries.length > 0 && topic.trim()) {
      saveHistory({
        ts: Date.now(),
        topic,
        platform,
        count,
        totalHashtags: entries.length,
      });
      setHistory(loadHistory());
    }
  }, [entries, topic, platform, count]);

  const handleClear = useCallback(() => {
    setTopic("");
    setPlatform("instagram");
    setCount(20);
    setIncludeBranded(true);
    setIncludeNiche(true);
    setExcludeGeneric(false);
    setMixPopularNiche(true);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const cfg = PLATFORM_CONFIGS[platform];
  const trendingNiches = useMemo(() => listTrendingNiches(), []);

  const categoryColor = (cat: Category) =>
    cat === "popular"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      : cat === "medium"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="hg-topic">Topic (e.g. &quot;javascript programming&quot;)</Label>
            <Input
              id="hg-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="javascript programming"
              className="text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="hg-plat" className="text-xs">Platform</Label>
              <select
                id="hg-plat"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
                className="h-9 w-full text-sm rounded-md border bg-transparent px-3"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hg-count" className="text-xs">
                Count (optimal {cfg.optimalCount}, max {cfg.maxCount})
              </Label>
              <Input
                id="hg-count"
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={includeBranded}
                onChange={(e) => setIncludeBranded(e.target.checked)}
              />
              Branded
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={includeNiche}
                onChange={(e) => setIncludeNiche(e.target.checked)}
              />
              Niche
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={excludeGeneric}
                onChange={(e) => setExcludeGeneric(e.target.checked)}
              />
              Exclude generic spam
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={mixPopularNiche}
                onChange={(e) => setMixPopularNiche(e.target.checked)}
              />
              Mix popular + niche (30/40/30)
            </label>
          </div>
          <div className="pt-1">
            <Label className="text-xs">Trending niche suggestions ({trendingNiches.length})</Label>
            <div className="flex flex-wrap gap-1 pt-1">
              {trendingNiches.map((n) => (
                <Button
                  key={n}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setTopic(n)}
                >
                  + {n}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {entries.length > 0 && topic.trim() ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Hash className="h-4 w-4" /> {stats.total} hashtags for {PLATFORM_LABELS[platform]}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total hashtags" value={stats.total} />
                <Stat label="Popular" value={stats.byCategory.popular} />
                <Stat label="Medium" value={stats.byCategory.medium} />
                <Stat label="Niche" value={stats.byCategory.niche} />
              </div>
              <div
                className={`rounded border p-2 text-xs ${
                  density.status === "over-max"
                    ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-900/20"
                    : density.status === "over-optimal"
                      ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20"
                      : "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-900/20"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {density.status === "ok" ? null : <AlertCircle className="h-3 w-3" />}
                  <span>
                    Density: {density.count} / optimal {density.optimal} / max {density.max}
                    {" — "}
                    {density.status === "ok"
                      ? "Within optimal range"
                      : density.status === "over-optimal"
                        ? "Over optimal — may dilute reach"
                        : "Over platform max — will be truncated"}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Total hashtag chars: {density.totalHashtagChars}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Hash className="h-4 w-4" /> Generated hashtags ({entries.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    getText={() => {
                      handleSaveHistory();
                      return entries.map((e) => e.tag).join(" ");
                    }}
                    label="Copy all"
                  />
                  <CopyButton
                    getText={() => { handleSaveHistory(); return textReport; }}
                    label="Copy report"
                  />
                  <DownloadButton
                    getText={() => { handleSaveHistory(); return textReport; }}
                    filename="hashtags.txt"
                    mime="text/plain"
                    label="Download .txt"
                  />
                  <DownloadButton
                    getText={() => csv}
                    filename="hashtags.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                  <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                  <ClearButton onClick={handleClear} />
                </div>
              </div>
              <div className="space-y-2 max-h-[600px] overflow-auto">
                {(["popular", "medium", "niche"] as Category[]).map((cat) => {
                  const list = entries.filter((e) => e.category === cat);
                  if (list.length === 0) return null;
                  return (
                    <div key={cat} className="rounded-lg border bg-background p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold">{CATEGORY_LABELS[cat]}</h4>
                        <Badge variant="outline" className="text-[10px]">{list.length}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {list.map((e: HashtagEntry, i: number) => (
                          <span
                            key={`${e.tag}-${i}`}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-mono ${categoryColor(e.category)}`}
                            title={`${HASHTAG_TYPE_LABELS[e.type]} · est. reach ${formatReach(e.estReach)}`}
                          >
                            {e.tag}
                            <span className="text-[9px] opacity-70">{formatReach(e.estReach)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a topic to generate hashtags"
          hint="Pick a platform, count, and toggles. The tool generates 5 hashtag types (direct, compound, variations, community, trending-style), categorizes them by reach, mixes popular + niche in 30/40/30 ratio, and filters spam."
          icon={<Hash className="h-8 w-8" />}
        />
      )}

      {topic.trim() && getTrendingForNiche(topic).length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" /> Trending for &quot;{topic}&quot;
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {getTrendingForNiche(topic).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-mono text-primary"
                >
                  {tag}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
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
                  <Badge variant="outline" className="mr-2">{PLATFORM_LABELS[h.platform]}</Badge>
                  <Badge variant="outline" className="mr-2">{h.count} requested</Badge>
                  <Badge variant="outline" className="mr-2">{h.totalHashtags} generated</Badge>
                  <span className="text-muted-foreground">{h.topic}</span>
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
            <strong className="text-foreground">Privacy:</strong> All hashtag generation runs locally in your browser. History is stored in localStorage on this device only.
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

function formatReach(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// Suppress unused-import lint
export type _Unused = typeof TRENDING_NICHES;
