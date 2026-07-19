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
  PLATFORM_BENCHMARKS,
  parsePosts,
  filterByDateRange,
  filterByPlatform,
  rankPosts,
  computeSummary,
  analyzeTrend,
  computePostingFrequency,
  suggestBestTimeSlot,
  predictGrowth,
  compareBenchmark,
  findBestAndWorst,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Platform,
  type RankMetric,
  type HistoryEntry,
} from "./logic";
import { BarChart3, History, Trophy, TrendingDown, TrendingUp, Clock, Sparkles } from "lucide-react";

const SAMPLE = `date,platform,post_url,likes,comments,shares,saves,impressions
2024-01-01,twitter,https://twitter.com/x/status/1,100,10,5,3,5000
2024-01-05,instagram,https://instagram.com/p/abc,500,40,20,80,8000
2024-01-10,facebook,https://facebook.com/post/1,80,5,2,1,2000
2024-01-15,twitter,https://twitter.com/x/status/2,200,20,10,8,9000
2024-01-20,linkedin,https://linkedin.com/posts/1,150,30,15,40,4000
2024-01-25,tiktok,https://tiktok.com/@x/video/1,2000,150,300,500,50000
2024-02-01,youtube,https://youtube.com/watch?v=1,800,60,40,100,15000
2024-02-05,instagram,https://instagram.com/p/def,700,55,30,120,12000`;

export default function SocialMediaEngagementTracker() {
  const [postsText, setPostsText] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"all" | Platform>("all");
  const [metric, setMetric] = useState<RankMetric>("engagement-rate");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.posts) {
        setPostsText(p.posts);
        setDateStart(p.dateStart);
        setDateEnd(p.dateEnd);
        setPlatformFilter(p.platform);
        setMetric(p.metric);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const parsed = useMemo(() => parsePosts(postsText), [postsText]);
  const filtered = useMemo(() => {
    const byDate = filterByDateRange(parsed.posts, dateStart || undefined, dateEnd || undefined);
    return filterByPlatform(byDate, platformFilter);
  }, [parsed, dateStart, dateEnd, platformFilter]);

  const ranked = useMemo(() => rankPosts(filtered, metric), [filtered, metric]);
  const summary = useMemo(() => computeSummary(filtered), [filtered]);
  const trend = useMemo(() => analyzeTrend(filtered), [filtered]);
  const freq = useMemo(() => computePostingFrequency(filtered), [filtered]);
  const bestSlot = useMemo(() => suggestBestTimeSlot(filtered), [filtered]);
  const growth = useMemo(() => predictGrowth(filtered), [filtered]);
  const bestWorst = useMemo(() => findBestAndWorst(filtered), [filtered]);
  const text = useMemo(() => renderText(filtered, metric), [filtered, metric]);
  const csv = useMemo(() => renderCsv(filtered, metric), [filtered, metric]);

  const handleSaveHistory = useCallback(() => {
    if (filtered.length > 0) {
      saveHistory({
        ts: Date.now(),
        postCount: filtered.length,
        platformCount: summary.byPlatform.length,
        avgEngagementRate: summary.avgEngagementRate,
        preview: filtered[0].postUrl || filtered[0].date,
      });
      setHistory(loadHistory());
    }
  }, [filtered, summary]);

  const handleClear = useCallback(() => {
    setPostsText("");
    setDateStart("");
    setDateEnd("");
    setPlatformFilter("all");
    setMetric("engagement-rate");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sme-posts">Post data — CSV (header row optional)</Label>
            <Textarea
              id="sme-posts"
              value={postsText}
              onChange={(e) => setPostsText(e.target.value)}
              placeholder={"date,platform,post_url,likes,comments,shares,saves,impressions\n2024-01-01,twitter,https://...,100,10,5,3,5000"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setPostsText(SAMPLE)}>Load sample</Button>
            </div>
            <p className="text-[10px] text-muted-foreground">Format: <code>date,platform,post_url,likes,comments,shares,saves,impressions</code></p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
              <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value as "all" | Platform)} className="h-8 text-xs rounded border bg-background px-2 w-full">
                <option value="all">All platforms</option>
                {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
              </select>
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
                <BarChart3 className="h-4 w-4" /> Summary — {filtered.length} posts
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total posts" value={String(summary.totalPosts)} />
                <Stat label="Total engagement" value={summary.totalEngagement.toLocaleString()} />
                <Stat label="Total impressions" value={summary.totalImpressions.toLocaleString()} />
                <Stat label="Avg engagement rate" value={`${summary.avgEngagementRate.toFixed(2)}%`} />
                <Stat label="Posts / week" value={freq.postsPerWeek.toFixed(2)} />
                <Stat label="Unique days" value={String(freq.uniqueDays)} />
                {bestSlot && <Stat label="Best day to post" value={bestSlot.slot} highlight="good" />}
                {trend && (
                  <Stat
                    label="Trend"
                    value={trend.direction}
                    highlight={trend.direction === "improving" ? "good" : trend.direction === "declining" ? "bad" : undefined}
                  />
                )}
              </div>

              {trend && (
                <div className="rounded border bg-background px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Trend analysis:</span>{" "}
                  First half <span className="font-mono">{trend.firstHalfAvgRate.toFixed(2)}%</span> → Second half <span className="font-mono">{trend.secondHalfAvgRate.toFixed(2)}%</span> ({trend.deltaPp >= 0 ? "+" : ""}{trend.deltaPp.toFixed(2)}pp)
                  {trend.direction === "improving" && <TrendingUp className="inline h-3 w-3 ml-1 text-emerald-500" />}
                  {trend.direction === "declining" && <TrendingDown className="inline h-3 w-3 ml-1 text-red-500" />}
                </div>
              )}

              {growth && (
                <div className="rounded border bg-background px-3 py-2 text-xs flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  <span className="text-muted-foreground">Growth prediction:</span> {growth.trend} — projected next-period rate <span className="font-mono">{growth.projectedRateNextPeriod.toFixed(2)}%</span> (confidence: {growth.confidence})
                </div>
              )}

              {bestWorst.best && bestWorst.worst && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="rounded border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                    <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold"><Trophy className="h-3 w-3" /> Best post</div>
                    <div className="mt-1 truncate">{bestWorst.best.postUrl || bestWorst.best.date}</div>
                    <div className="text-[10px] text-muted-foreground">{PLATFORM_LABELS[bestWorst.best.platform]} · {bestWorst.best.engagementRate.toFixed(2)}% ER · {bestWorst.best.totalEngagement.toLocaleString()} engagement</div>
                  </div>
                  <div className="rounded border border-red-500/30 bg-red-500/5 px-3 py-2">
                    <div className="flex items-center gap-1 text-red-700 dark:text-red-300 font-semibold"><TrendingDown className="h-3 w-3" /> Worst post</div>
                    <div className="mt-1 truncate">{bestWorst.worst.postUrl || bestWorst.worst.date}</div>
                    <div className="text-[10px] text-muted-foreground">{PLATFORM_LABELS[bestWorst.worst.platform]} · {bestWorst.worst.engagementRate.toFixed(2)}% ER · {bestWorst.worst.totalEngagement.toLocaleString()} engagement</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" /> Per-platform breakdown
              </h3>
              <div className="space-y-1">
                {summary.byPlatform.map((agg) => {
                  const bench = compareBenchmark(agg.platform, agg.avgEngagementRate);
                  return (
                    <div key={agg.platform} className="rounded border bg-background px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{PLATFORM_LABELS[agg.platform]}</span>
                        <Badge variant="outline" className="text-[10px]">{agg.postCount} posts</Badge>
                        <Badge variant="secondary" className="text-[10px]">{agg.avgEngagementRate.toFixed(2)}% ER</Badge>
                        <Badge variant={bench.status === "above" ? "default" : bench.status === "below" ? "destructive" : "outline"} className="text-[10px]">
                          {bench.status === "above" ? "▲ above" : bench.status === "below" ? "▼ below" : "= on par"} benchmark ({PLATFORM_BENCHMARKS[agg.platform].toFixed(2)}%)
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {agg.totalLikes} likes · {agg.totalComments} comments · {agg.totalShares} shares · {agg.totalSaves} saves · {agg.totalImpressions.toLocaleString()} impressions
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> Ranked posts ({ranked.length})
              </h3>
              <div className="space-y-1 max-h-[500px] overflow-auto">
                {ranked.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                    <Badge variant="outline" className="text-[10px] w-8 justify-center">#{p.rank}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{PLATFORM_LABELS[p.platform]}</Badge>
                    <span className="text-muted-foreground text-[10px] w-20">{p.date}</span>
                    <span className="font-mono text-[10px] w-16 text-right">{p.engagementRate.toFixed(2)}%</span>
                    <span className="font-mono text-[10px] text-muted-foreground w-24 text-right">{p.totalEngagement.toLocaleString()} eng.</span>
                    <a href={p.postUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-foreground truncate hover:text-primary hover:underline">
                      {p.postUrl || "(no url)"}
                    </a>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => { handleSaveHistory(); return text; }} label="Copy report" />
                <DownloadButton getText={() => { handleSaveHistory(); return text; }} filename="engagement-report.txt" mime="text/plain" label="Download .txt" />
                <DownloadButton getText={() => csv} filename="engagement-report.csv" mime="text/csv" label="Download CSV" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ posts: postsText, dateStart, dateEnd, platform: platformFilter, metric }); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste CSV post data to track engagement"
          hint="One post per line: date,platform,post_url,likes,comments,shares,saves,impressions. Header row is optional. Click 'Load sample' to try it out."
          icon={<BarChart3 className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.postCount} posts</Badge>
                  <Badge variant="outline" className="mr-2">{h.platformCount} platforms</Badge>
                  <Badge variant="secondary" className="mr-2">{h.avgEngagementRate.toFixed(2)}% avg ER</Badge>
                  <span className="text-muted-foreground truncate">{h.preview}</span>
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
            <strong className="text-foreground">Privacy:</strong> All parsing, calculations, and rendering run locally in your browser. History is stored in localStorage on this device only. Shareable URLs encode data in the URL hash and never touch our server.
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
