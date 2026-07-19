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
  PLATFORM_LABELS,
  RANK_METRICS,
  RANK_METRIC_LABELS,
  CATEGORY_LABELS,
  SATURATION_LABELS,
  parseHashtags,
  filterByPlatform,
  filterByDateRange,
  filterByMinPostCount,
  aggregateByHashtag,
  aggregateByPlatform,
  computeSummary,
  rankHashtags,
  analyzeAllTrends,
  analyzeDensity,
  findCoOccurrence,
  findBestCombos,
  recommendHashtags,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Platform,
  type PlatformFilter,
  type RankMetric,
  type HashtagCategory,
  type HistoryEntry,
} from "./logic";
import { Hash, History, AlertTriangle, Lightbulb, Layers, TrendingUp } from "lucide-react";

const SAMPLE = `hashtag,platform,post_count,avg_engagement,avg_reach,date
#SEO,instagram,15000,500,8000,2024-01-01
marketing,instagram,5000,300,4000,2024-01-01
seo,twitter,20000,250,6000,2024-01-02
growthhacking,linkedin,800,120,1500,2024-01-03
seo,instagram,18000,550,9000,2024-01-10
marketing,twitter,6000,200,3000,2024-01-12
ai,tiktok,500000,2000,50000,2024-01-15
ai,instagram,450000,1800,40000,2024-01-20
growthhacking,twitter,900,130,1600,2024-01-22
seo,linkedin,22000,400,7000,2024-02-01
ai,youtube,300000,1500,30000,2024-02-05
marketing,linkedin,5500,280,3500,2024-02-10`;

export default function SocialMediaHashtagAnalyzer() {
  const [dataText, setDataText] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [minPostCount, setMinPostCount] = useState("");
  const [metric, setMetric] = useState<RankMetric>("engagement");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.data) {
        setDataText(p.data);
        setDateStart(p.dateStart);
        setDateEnd(p.dateEnd);
        setPlatformFilter(p.platform);
        setMinPostCount(p.minPostCount);
        setMetric(p.metric);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const parsed = useMemo(() => parseHashtags(dataText), [dataText]);
  const filtered = useMemo(() => {
    const byDate = filterByDateRange(parsed.entries, dateStart || undefined, dateEnd || undefined);
    const byPlatformList = filterByPlatform(byDate, platformFilter);
    const min = Number(minPostCount);
    return filterByMinPostCount(byPlatformList, Number.isFinite(min) ? min : 0);
  }, [parsed, dateStart, dateEnd, platformFilter, minPostCount]);

  const ranked = useMemo(() => rankHashtags(filtered, metric), [filtered, metric]);
  const summary = useMemo(() => computeSummary(filtered), [filtered]);
  const stats = useMemo(() => aggregateByHashtag(filtered), [filtered]);
  const trends = useMemo(() => analyzeAllTrends(filtered), [filtered]);
  const density = useMemo(() => analyzeDensity(filtered), [filtered]);
  const coOccur = useMemo(() => findCoOccurrence(filtered), [filtered]);
  const combos = useMemo(() => findBestCombos(filtered, 5), [filtered]);
  const recs = useMemo(() => recommendHashtags(filtered, 5), [filtered]);
  const text = useMemo(() => renderText(filtered, metric), [filtered, metric]);
  const csv = useMemo(() => renderCsv(filtered, metric), [filtered, metric]);

  const handleSaveHistory = useCallback(() => {
    if (filtered.length > 0) {
      saveHistory({
        ts: Date.now(),
        entryCount: filtered.length,
        uniqueHashtags: summary.uniqueHashtags,
        totalPosts: summary.totalPosts,
        avgEngagement: summary.avgEngagement,
        preview: filtered[0].hashtag,
      });
      setHistory(loadHistory());
    }
  }, [filtered, summary]);

  const handleClear = useCallback(() => {
    setDataText("");
    setDateStart("");
    setDateEnd("");
    setPlatformFilter("all");
    setMinPostCount("");
    setMetric("engagement");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const catCounts = useMemo(() => {
    const counts: Record<HashtagCategory, number> = { popular: 0, medium: 0, niche: 0 };
    for (const s of stats) counts[s.category] += 1;
    return counts;
  }, [stats]);

  const saturatedHashtags = useMemo(() => stats.filter((s) => s.saturation === "high"), [stats]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sha-data">Hashtag data — CSV (header row optional)</Label>
            <Textarea
              id="sha-data"
              value={dataText}
              onChange={(e) => setDataText(e.target.value)}
              placeholder={"hashtag,platform,post_count,avg_engagement,avg_reach,date\n#SEO,instagram,15000,500,8000,2024-01-01"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setDataText(SAMPLE)}>Load sample</Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Format: <code>hashtag,platform,post_count,avg_engagement,avg_reach,date</code>. Platforms: {PLATFORMS.join(", ")}.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Date from</Label>
              <Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date to</Label>
              <Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Platform</Label>
              <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value as PlatformFilter)} className="h-8 text-xs rounded border bg-background px-2 w-full">
                <option value="all">All platforms</option>
                {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Min post count</Label>
              <Input type="number" min={0} value={minPostCount} onChange={(e) => setMinPostCount(e.target.value)} placeholder="0" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rank by</Label>
              <select value={metric} onChange={(e) => setMetric(e.target.value as RankMetric)} className="h-8 text-xs rounded border bg-background px-2 w-full">
                {RANK_METRICS.map((m) => <option key={m} value={m}>{RANK_METRIC_LABELS[m]}</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {parsed.errors.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-destructive font-semibold mb-1">{parsed.errors.length} parse error(s):</div>
            <ul className="text-[11px] text-destructive space-y-0.5 max-h-[120px] overflow-auto">
              {parsed.errors.map((e, i) => (
                <li key={i}>Line {e.line}: {e.message}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {filtered.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Hash className="h-4 w-4" /> Summary — {filtered.length} entries, {summary.uniqueHashtags} unique hashtags
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total entries" value={String(summary.totalEntries)} />
                <Stat label="Unique hashtags" value={String(summary.uniqueHashtags)} />
                <Stat label="Total posts" value={summary.totalPosts.toLocaleString()} />
                <Stat label="Avg engagement" value={summary.avgEngagement.toFixed(2)} />
                <Stat label="Avg reach" value={summary.avgReach.toFixed(2)} />
                <Stat label="Popular" value={String(catCounts.popular)} highlight="good" />
                <Stat label="Medium" value={String(catCounts.medium)} />
                <Stat label="Niche" value={String(catCounts.niche)} />
              </div>

              {saturatedHashtags.length > 0 && (
                <div className="rounded border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-amber-700 dark:text-amber-300">Saturation warning:</span>{" "}
                    {saturatedHashtags.length} hashtag(s) exceed 100K posts and may be too competitive:{" "}
                    {saturatedHashtags.map((s) => s.hashtag).join(", ")}
                  </div>
                </div>
              )}

              {summary.byPlatform.length > 0 && (
                <div className="space-y-1 pt-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">By platform</div>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.byPlatform.map((g) => (
                      <Badge key={g.platform} variant="outline" className="text-[10px]">
                        {PLATFORM_LABELS[g.platform]}: {g.hashtags.length} entries · {g.totalPosts.toLocaleString()} posts · {g.avgEngagement.toFixed(1)} avg eng
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="h-4 w-4" /> Ranked hashtags ({ranked.length})
              </h3>
              <div className="space-y-1 max-h-[400px] overflow-auto">
                {ranked.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                    <Badge variant="outline" className="text-[10px] w-8 justify-center">#{r.rank}</Badge>
                    <span className="font-mono text-foreground w-28 truncate">#{r.hashtag}</span>
                    <Badge variant="secondary" className="text-[10px]">{PLATFORM_LABELS[r.platform]}</Badge>
                    <span className="text-muted-foreground text-[10px] w-20">{r.date}</span>
                    <span className="font-mono text-[10px] w-16 text-right">{r.postCount.toLocaleString()} posts</span>
                    <span className="font-mono text-[10px] w-16 text-right">{r.avgEngagement.toFixed(1)} eng</span>
                    <span className="font-mono text-[10px] w-16 text-right">{r.avgReach.toFixed(0)} reach</span>
                    <Badge
                      variant={r.category === "popular" ? "default" : r.category === "niche" ? "outline" : "secondary"}
                      className="text-[10px]"
                    >
                      {CATEGORY_LABELS[r.category]}
                    </Badge>
                    {r.saturation === "high" && (
                      <Badge variant="destructive" className="text-[10px]">sat: {SATURATION_LABELS[r.saturation]}</Badge>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => { handleSaveHistory(); return text; }} label="Copy report" />
                <DownloadButton getText={() => { handleSaveHistory(); return text; }} filename="hashtag-report.txt" mime="text/plain" label="Download .txt" />
                <DownloadButton getText={() => csv} filename="hashtag-report.csv" mime="text/csv" label="Download CSV" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ data: dataText, dateStart, dateEnd, platform: platformFilter, minPostCount, metric }); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" /> Engagement trend (top 5)
                </h3>
                <div className="space-y-1">
                  {trends.slice(0, 5).map((t) => (
                    <div key={t.hashtag} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <span className="font-mono">#{t.hashtag}</span>{" "}
                      <Badge
                        variant={t.direction === "improving" ? "default" : t.direction === "declining" ? "destructive" : "outline"}
                        className="text-[10px]"
                      >
                        {t.direction}
                      </Badge>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {t.firstHalfAvg.toFixed(2)} → {t.secondHalfAvg.toFixed(2)} ({t.points.length} data points)
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Hash className="h-4 w-4" /> Posting density (top 5)
                </h3>
                <div className="space-y-1">
                  {density.slice(0, 5).map((d) => (
                    <div key={d.hashtag} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <span className="font-mono">#{d.hashtag}</span>{" "}
                      <Badge variant="secondary" className="text-[10px]">{d.postsPerDay.toFixed(2)} posts/day</Badge>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {d.totalPosts.toLocaleString()} posts over {d.totalDays} day(s)
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="h-4 w-4" /> Co-occurring hashtags (top 5)
                </h3>
                <div className="space-y-1">
                  {coOccur.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No co-occurring hashtags (need multiple hashtags on same date+platform).</p>
                  ) : coOccur.slice(0, 5).map((c, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <span className="font-mono">#{c.hashtags[0]} + #{c.hashtags[1]}</span>{" "}
                      <Badge variant="secondary" className="text-[10px]">{c.count} co-occurrence(s)</Badge>
                      <div className="text-[10px] text-muted-foreground mt-0.5">avg engagement {c.avgEngagement.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4" /> Recommended hashtags (top 5)
                </h3>
                <div className="space-y-1">
                  {recs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Need at least 2 unique hashtags for recommendations.</p>
                  ) : recs.map((r, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <span className="font-mono">#{r.hashtag}</span>{" "}
                      <Badge variant="default" className="text-[10px]">{r.score}/100</Badge>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{r.reason}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {combos.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="h-4 w-4" /> Best hashtag combinations (top {combos.length})
                </h3>
                <div className="space-y-1">
                  {combos.map((c, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <span className="font-mono">{c.hashtags.map((h) => `#${h}`).join(" + ")}</span>{" "}
                      <Badge variant="secondary" className="text-[10px]">{c.avgEngagement.toFixed(2)} avg eng</Badge>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {c.occurrences} entries · {c.totalPosts.toLocaleString()} total posts
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title="Paste CSV hashtag data to analyze performance"
          hint="One row per hashtag-platform-date: hashtag,platform,post_count,avg_engagement,avg_reach,date. Header row is optional. Click 'Load sample' to try it out."
          icon={<Hash className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.entryCount} entries</Badge>
                  <Badge variant="outline" className="mr-2">{h.uniqueHashtags} hashtags</Badge>
                  <Badge variant="secondary" className="mr-2">{h.totalPosts.toLocaleString()} posts</Badge>
                  <span className="text-muted-foreground">#{h.preview}</span>
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
            <strong className="text-foreground">Privacy:</strong> All parsing, aggregation, ranking, and rendering run locally in your browser. History is stored in localStorage on this device only. Shareable URLs encode data in the URL hash and never touch our server.
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
