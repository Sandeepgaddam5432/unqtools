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
  TREND_TYPE_LABELS,
  LIFECYCLE_LABELS,
  URGENCY_LABELS,
  DEFAULT_TREND_THRESHOLD,
  DEFAULT_GROWTH_THRESHOLD,
  DEFAULT_LOOKBACK_DAYS,
  parseTrends,
  filterByPlatform,
  filterByDateRange,
  filterByTrendThreshold,
  rankTrends,
  computeSummary,
  findEmergingTrends,
  findSustainedTrends,
  findDecliningTrends,
  findCrossPlatformTrends,
  recommendBestTime,
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
  type HistoryEntry,
} from "./logic";
import { TrendingUp, History, AlertTriangle, Lightbulb, Activity, Rocket, Flame, TrendingDown, Globe, Clock } from "lucide-react";

const SAMPLE = `date,topic,platform,mention_count,engagement_count
2024-01-02,ai_art,twitter,100,500
2024-01-03,ai_art,twitter,120,600
2024-01-05,ai_art,twitter,150,800
2024-01-09,ai_art,twitter,300,1500
2024-01-11,ai_art,twitter,400,2000
2024-01-15,ai_art,twitter,500,2500
2024-01-02,vr_gaming,twitter,50,200
2024-01-05,vr_gaming,twitter,55,210
2024-01-09,vr_gaming,twitter,60,240
2024-01-12,vr_gaming,twitter,65,260
2024-01-15,vr_gaming,twitter,70,280
2024-01-02,old_topic,twitter,2000,5000
2024-01-05,old_topic,twitter,1800,4500
2024-01-09,old_topic,twitter,800,2000
2024-01-12,old_topic,twitter,400,1000
2024-01-15,old_topic,twitter,200,500
2024-01-09,ai_art,instagram,200,1000
2024-01-12,ai_art,instagram,300,1500
2024-01-15,ai_art,instagram,400,2000
2024-01-09,vr_gaming,tiktok,80,400
2024-01-15,vr_gaming,tiktok,90,450`;

function formatGrowth(n: number): string {
  if (!Number.isFinite(n)) return "∞%";
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

export default function SocialMediaTrendDetector() {
  const [dataText, setDataText] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [trendThreshold, setTrendThreshold] = useState(String(DEFAULT_TREND_THRESHOLD));
  const [growthThreshold, setGrowthThreshold] = useState(String(DEFAULT_GROWTH_THRESHOLD));
  const [lookbackDays, setLookbackDays] = useState(String(DEFAULT_LOOKBACK_DAYS));
  const [metric, setMetric] = useState<RankMetric>("growth_rate");
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
        setTrendThreshold(p.trendThreshold);
        setGrowthThreshold(p.growthThreshold);
        setLookbackDays(p.lookbackDays);
        setMetric(p.metric);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const parsed = useMemo(() => parseTrends(dataText), [dataText]);

  const lookbackNum = Number(lookbackDays);
  const growthNum = Number(growthThreshold);
  const trendNum = Number(trendThreshold);
  const validLookback = Number.isFinite(lookbackNum) && lookbackNum > 0 ? Math.round(lookbackNum) : DEFAULT_LOOKBACK_DAYS;
  const validGrowth = Number.isFinite(growthNum) && growthNum >= 0 ? growthNum : DEFAULT_GROWTH_THRESHOLD;
  const validTrend = Number.isFinite(trendNum) && trendNum >= 0 ? trendNum : DEFAULT_TREND_THRESHOLD;

  const filtered = useMemo(() => {
    const byDate = filterByDateRange(parsed.entries, dateStart || undefined, dateEnd || undefined);
    const byPlatformList = filterByPlatform(byDate, platformFilter);
    return filterByTrendThreshold(byPlatformList, validTrend);
  }, [parsed, dateStart, dateEnd, platformFilter, validTrend]);

  const ranked = useMemo(() => rankTrends(filtered, metric, validLookback, validGrowth), [filtered, metric, validLookback, validGrowth]);
  const summary = useMemo(() => computeSummary(filtered, validLookback, validGrowth), [filtered, validLookback, validGrowth]);
  const emerging = useMemo(() => findEmergingTrends(filtered, validLookback, validGrowth), [filtered, validLookback, validGrowth]);
  const sustained = useMemo(() => findSustainedTrends(filtered, validLookback, validGrowth), [filtered, validLookback, validGrowth]);
  const declining = useMemo(() => findDecliningTrends(filtered, validLookback, validGrowth), [filtered, validLookback, validGrowth]);
  const cross = useMemo(() => findCrossPlatformTrends(filtered, validLookback, validGrowth), [filtered, validLookback, validGrowth]);
  const topOpps = useMemo(() => [...ranked].sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 5), [ranked]);
  const text = useMemo(() => renderText(filtered, metric, validLookback, validGrowth), [filtered, metric, validLookback, validGrowth]);
  const csv = useMemo(() => renderCsv(filtered, metric, validLookback, validGrowth), [filtered, metric, validLookback, validGrowth]);

  const handleSaveHistory = useCallback(() => {
    if (filtered.length > 0) {
      saveHistory({
        ts: Date.now(),
        dataPointCount: filtered.length,
        topicCount: summary.totalTopics,
        trendingCount: summary.trendingCount,
        decliningCount: summary.decliningCount,
        avgGrowthRate: summary.avgGrowthRate,
        preview: ranked[0]?.topic ?? "",
      });
      setHistory(loadHistory());
    }
  }, [filtered, summary, ranked]);

  const handleClear = useCallback(() => {
    setDataText("");
    setDateStart("");
    setDateEnd("");
    setPlatformFilter("all");
    setTrendThreshold(String(DEFAULT_TREND_THRESHOLD));
    setGrowthThreshold(String(DEFAULT_GROWTH_THRESHOLD));
    setLookbackDays(String(DEFAULT_LOOKBACK_DAYS));
    setMetric("growth_rate");
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
            <Label htmlFor="std-data">Trend data — CSV (header row optional)</Label>
            <Textarea
              id="std-data"
              value={dataText}
              onChange={(e) => setDataText(e.target.value)}
              placeholder={"date,topic,platform,mention_count,engagement_count\n2024-01-01,ai_art,twitter,100,500"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setDataText(SAMPLE)}>Load sample</Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Format: <code>date,topic,platform,mention_count,engagement_count</code>. Platforms: {PLATFORMS.join(", ")}. Provide multiple data points per topic over time.
            </p>
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
              <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value as PlatformFilter)} className="h-8 text-xs rounded border bg-background px-2 w-full">
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
            <div className="space-y-1">
              <Label className="text-xs">Trend threshold (mentions)</Label>
              <Input type="number" min={0} value={trendThreshold} onChange={(e) => setTrendThreshold(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Growth threshold (%)</Label>
              <Input type="number" min={0} value={growthThreshold} onChange={(e) => setGrowthThreshold(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Lookback days</Label>
              <Input type="number" min={1} value={lookbackDays} onChange={(e) => setLookbackDays(e.target.value)} className="h-8 text-xs" />
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
                <TrendingUp className="h-4 w-4" /> Summary — {summary.totalTopics} topics, {summary.totalDataPoints} data points
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total topics" value={String(summary.totalTopics)} />
                <Stat label="Data points" value={String(summary.totalDataPoints)} />
                <Stat label="Trending" value={String(summary.trendingCount)} highlight="good" />
                <Stat label="Declining" value={String(summary.decliningCount)} highlight="bad" />
                <Stat label="Stable" value={String(summary.stableCount)} />
                <Stat label="Avg growth" value={formatGrowth(summary.avgGrowthRate)} highlight={summary.avgGrowthRate > 0 ? "good" : summary.avgGrowthRate < 0 ? "bad" : undefined} />
                <Stat label="Lookback" value={`${validLookback}d`} />
                <Stat label="Growth threshold" value={`${validGrowth}%`} />
              </div>

              {summary.byPlatform.length > 0 && (
                <div className="space-y-1 pt-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">By platform</div>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.byPlatform.map((p) => (
                      <Badge key={p.platform} variant="outline" className="text-[10px]">
                        {PLATFORM_LABELS[p.platform]}: {p.topics.length} topics · {p.trendingCount} trending / {p.stableCount} stable / {p.decliningCount} declining
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
                <Activity className="h-4 w-4" /> Ranked trends ({ranked.length})
              </h3>
              <div className="space-y-1 max-h-[400px] overflow-auto">
                {ranked.map((t) => (
                  <div key={t.topic} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                    <Badge variant="outline" className="text-[10px] w-8 justify-center">#{t.rank}</Badge>
                    <span className="font-mono text-foreground w-32 truncate">{t.topic}</span>
                    <Badge
                      variant={t.type === "trending" ? "default" : t.type === "declining" ? "destructive" : "outline"}
                      className="text-[10px]"
                    >
                      {TREND_TYPE_LABELS[t.type]}
                    </Badge>
                    <span className="font-mono text-[10px] w-20 text-right">{formatGrowth(t.growthRate)}</span>
                    <span className="font-mono text-[10px] w-20 text-right">{t.totalMentions.toLocaleString()} mentions</span>
                    <span className="font-mono text-[10px] w-20 text-right">{t.totalEngagement.toLocaleString()} eng</span>
                    <Badge variant="secondary" className="text-[10px]">{LIFECYCLE_LABELS[t.lifecycle]}</Badge>
                    <Badge variant="outline" className="text-[10px]">opp {t.opportunityScore}</Badge>
                    <span className="text-[10px] text-muted-foreground w-20 truncate">{t.platforms.map((p) => PLATFORM_LABELS[p]).join(", ")}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => { handleSaveHistory(); return text; }} label="Copy report" />
                <DownloadButton getText={() => { handleSaveHistory(); return text; }} filename="trend-report.txt" mime="text/plain" label="Download .txt" />
                <DownloadButton getText={() => csv} filename="trend-report.csv" mime="text/csv" label="Download CSV" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ data: dataText, dateStart, dateEnd, platform: platformFilter, trendThreshold, growthThreshold, lookbackDays, metric }); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Rocket className="h-4 w-4" /> Emerging (top 5)
                </h3>
                <div className="space-y-1">
                  {emerging.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No emerging trends (low mentions + high growth).</p>
                  ) : emerging.slice(0, 5).map((t) => (
                    <div key={t.topic} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <span className="font-mono">{t.topic}</span>{" "}
                      <Badge variant="default" className="text-[10px]">{formatGrowth(t.growthRate)}</Badge>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {t.totalMentions.toLocaleString()} mentions · opp {t.opportunityScore}/100 · {LIFECYCLE_LABELS[t.lifecycle]}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Flame className="h-4 w-4" /> Sustained (top 5)
                </h3>
                <div className="space-y-1">
                  {sustained.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No sustained trends (high mentions + sustained growth).</p>
                  ) : sustained.slice(0, 5).map((t) => (
                    <div key={t.topic} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <span className="font-mono">{t.topic}</span>{" "}
                      <Badge variant="default" className="text-[10px]">{formatGrowth(t.growthRate)}</Badge>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {t.totalMentions.toLocaleString()} mentions · {LIFECYCLE_LABELS[t.lifecycle]} stage
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <TrendingDown className="h-4 w-4" /> Declining (top 5)
                </h3>
                <div className="space-y-1">
                  {declining.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No declining trends detected.</p>
                  ) : declining.slice(0, 5).map((t) => (
                    <div key={t.topic} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <span className="font-mono">{t.topic}</span>{" "}
                      <Badge variant="destructive" className="text-[10px]">{formatGrowth(t.growthRate)}</Badge>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {t.totalMentions.toLocaleString()} mentions · {t.velocityDirection}
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
                  <Globe className="h-4 w-4" /> Cross-platform trends (top 5)
                </h3>
                <div className="space-y-1">
                  {cross.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No trends trending on multiple platforms.</p>
                  ) : cross.slice(0, 5).map((c) => (
                    <div key={c.topic} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <span className="font-mono">{c.topic}</span>{" "}
                      <Badge variant="default" className="text-[10px]">trending on {c.trendingOn}/{c.platforms.length}</Badge>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {c.platforms.map((p) => PLATFORM_LABELS[p]).join(", ")} · {c.totalMentions.toLocaleString()} mentions · avg {formatGrowth(c.avgGrowthRate)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> Best time to leverage (top 5 opportunities)
                </h3>
                <div className="space-y-1">
                  {topOpps.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No opportunities detected.</p>
                  ) : topOpps.map((t) => {
                    const rec = recommendBestTime(t.topic, t.lifecycle);
                    return (
                      <div key={t.topic} className="rounded border bg-background px-3 py-1.5 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono">{t.topic}</span>
                          <Badge variant={rec.urgency === "now" ? "default" : rec.urgency === "soon" ? "secondary" : "outline"} className="text-[10px]">
                            {URGENCY_LABELS[rec.urgency]}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">opp {t.opportunityScore}/100</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{rec.recommendation}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <EmptyState
          title="Paste CSV trend data to detect trending topics"
          hint="One row per date+topic+platform: date,topic,platform,mention_count,engagement_count. Header row is optional. Provide multiple data points per topic over time for growth analysis. Click 'Load sample' to try it out."
          icon={<TrendingUp className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.dataPointCount} data points</Badge>
                  <Badge variant="outline" className="mr-2">{h.topicCount} topics</Badge>
                  <Badge variant="default" className="mr-2">{h.trendingCount} trending</Badge>
                  <Badge variant="destructive" className="mr-2">{h.decliningCount} declining</Badge>
                  <span className="text-muted-foreground">{h.preview}</span>
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
