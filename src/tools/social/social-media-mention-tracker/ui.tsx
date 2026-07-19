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
  parseAliases,
  buildBrandMatcher,
  parseMentions,
  filterByDateRange,
  filterByPlatform,
  enrichMention,
  searchMentions,
  computeSummary,
  findTopAuthors,
  findTopMentionsByReach,
  computeVelocity,
  analyzeSentimentTrend,
  checkAlert,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  parsePlatformsParam,
  type Platform,
  type HistoryEntry,
} from "./logic";
import { Megaphone, History, AlertTriangle, TrendingUp, TrendingDown, Search } from "lucide-react";

const SAMPLE = `date,platform,author,content,url,sentiment
2024-01-01,twitter,@user1,Love the new Brand Inc product!,https://twitter.com/x/status/1,1
2024-01-02,reddit,u/user2,Brand Inc is overpriced garbage,https://reddit.com/r/x/1,-1
2024-01-03,linkedin,John Doe,Proud to announce our partnership with BrandCo,https://linkedin.com/posts/1,1
2024-01-05,hackernews,alice,Brand Inc just launched a great new tool,https://news.ycombinator.com/item/1,1
2024-01-08,youtube,ChannelA,Review of the Brand Inc widget (honest opinion),https://youtube.com/watch?v=1,0
2024-01-10,producthunt,user5,Brand Inc is amazing! Kudos to the team,https://producthunt.com/posts/1,1
2024-01-12,twitter,@user2,Terrible customer service from Brand Inc,https://twitter.com/x/status/2,-1
2024-01-15,reddit,u/user3,Just tried BrandCo — works great!,https://reddit.com/r/x/2,1`;

export default function SocialMediaMentionTracker() {
  const [brandName, setBrandName] = useState("");
  const [aliasesText, setAliasesText] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [mentionsText, setMentionsText] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [alertThreshold, setAlertThreshold] = useState("5");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      let loaded = false;
      if (p.brand) { setBrandName(p.brand); loaded = true; }
      if (p.aliases) { setAliasesText(p.aliases); loaded = true; }
      if (p.platforms) { setSelectedPlatforms(parsePlatformsParam(p.platforms)); loaded = true; }
      if (p.mentions) { setMentionsText(p.mentions); loaded = true; }
      if (p.dateStart) { setDateStart(p.dateStart); loaded = true; }
      if (p.dateEnd) { setDateEnd(p.dateEnd); loaded = true; }
      if (loaded) toast.info("Loaded from share link");
    }
  }, []);

  const aliases = useMemo(() => parseAliases(aliasesText), [aliasesText]);
  const matcher = useMemo(() => buildBrandMatcher(brandName, aliases), [brandName, aliases]);

  const parsed = useMemo(() => parseMentions(mentionsText), [mentionsText]);

  const enriched = useMemo(
    () => parsed.mentions.map((m) => enrichMention(m, matcher)),
    [parsed, matcher],
  );

  const filtered = useMemo(() => {
    const byDate = filterByDateRange(enriched, dateStart || undefined, dateEnd || undefined);
    const byPlatform = filterByPlatform(byDate, selectedPlatforms);
    return byPlatform;
  }, [enriched, dateStart, dateEnd, selectedPlatforms]);

  const searched = useMemo(() => searchMentions(filtered, searchQuery), [filtered, searchQuery]);

  const summary = useMemo(() => computeSummary(searched), [searched]);
  const topAuthors = useMemo(() => findTopAuthors(searched, 5), [searched]);
  const topMentions = useMemo(() => findTopMentionsByReach(searched, 5), [searched]);
  const velocity = useMemo(() => computeVelocity(searched), [searched]);
  const sentimentTrend = useMemo(() => analyzeSentimentTrend(searched), [searched]);
  const alert = useMemo(() => checkAlert(searched, Number(alertThreshold) || 0), [searched, alertThreshold]);
  const text = useMemo(() => renderText(searched, brandName), [searched, brandName]);
  const csv = useMemo(() => renderCsv(searched), [searched]);

  const handleSaveHistory = useCallback(() => {
    if (searched.length > 0) {
      saveHistory({
        ts: Date.now(),
        brand: brandName,
        mentionCount: searched.length,
        platformCount: summary.byPlatform.length,
        avgSentiment: summary.sentiment.avgScore,
        totalReach: summary.totalReach,
      });
      setHistory(loadHistory());
    }
  }, [searched, summary, brandName]);

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const handleClear = useCallback(() => {
    setBrandName("");
    setAliasesText("");
    setSelectedPlatforms([]);
    setMentionsText("");
    setDateStart("");
    setDateEnd("");
    setSearchQuery("");
    setAlertThreshold("5");
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="smt-brand" className="text-xs">Brand name</Label>
              <Input id="smt-brand" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Brand Inc" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="smt-aliases" className="text-xs">Aliases (comma-separated)</Label>
              <Input id="smt-aliases" value={aliasesText} onChange={(e) => setAliasesText(e.target.value)} placeholder="BrandCo, BI" className="h-8 text-xs" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Platforms (leave empty for all)</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {PLATFORMS.map((p) => (
                <label key={p} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes(p)}
                    onChange={() => togglePlatform(p)}
                  />
                  {PLATFORM_LABELS[p]}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smt-mentions">Mention data — CSV (header row optional)</Label>
            <Textarea
              id="smt-mentions"
              value={mentionsText}
              onChange={(e) => setMentionsText(e.target.value)}
              placeholder={"date,platform,author,content,url,sentiment\n2024-01-01,twitter,@user,Love Brand Inc!,https://x.com,1"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => { setBrandName("Brand Inc"); setAliasesText("BrandCo"); setMentionsText(SAMPLE); }}>Load sample</Button>
            </div>
            <p className="text-[10px] text-muted-foreground">Format: <code>date,platform,author,content,url,sentiment</code> (sentiment optional: -1/0/1)</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Date from</Label>
              <Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date to</Label>
              <Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Alert threshold (mentions/day)</Label>
              <Input type="number" min="0" value={alertThreshold} onChange={(e) => setAlertThreshold(e.target.value)} className="h-8 text-xs" />
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

      {searched.length > 0 ? (
        <>
          {alert.triggered && (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-semibold">Alert triggered!</span>
                  <span className="text-xs">
                    {velocity.mentionsPerDay.toFixed(2)} mentions/day exceeds your threshold of {alert.threshold}/day
                    {alert.maxDayDate && ` (peak: ${alert.maxDayCount} on ${alert.maxDayDate})`}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Megaphone className="h-4 w-4" /> Summary — {searched.length} mentions
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total mentions" value={String(summary.totalMentions)} />
                <Stat label="Brand matches" value={String(summary.brandMentions)} highlight="good" />
                <Stat label="Unique authors" value={String(summary.uniqueAuthors)} />
                <Stat label="Avg reach" value={summary.avgReach.toLocaleString()} />
                <Stat label="Total reach" value={summary.totalReach.toLocaleString()} />
                <Stat label="Mentions/day" value={velocity.mentionsPerDay.toFixed(2)} />
                <Stat
                  label="Sentiment"
                  value={`+${summary.sentiment.positive}/${summary.sentiment.neutral}/-${summary.sentiment.negative}`}
                />
                <Stat
                  label="Avg sentiment"
                  value={summary.sentiment.avgScore.toFixed(2)}
                  highlight={summary.sentiment.avgScore > 0 ? "good" : summary.sentiment.avgScore < 0 ? "bad" : undefined}
                />
              </div>

              {sentimentTrend && (
                <div className="rounded border bg-background px-3 py-2 text-xs flex items-center gap-1.5">
                  <span className="text-muted-foreground">Sentiment trend:</span> {sentimentTrend.direction}
                  {sentimentTrend.direction === "improving" && <TrendingUp className="h-3 w-3 text-emerald-500" />}
                  {sentimentTrend.direction === "declining" && <TrendingDown className="h-3 w-3 text-red-500" />}
                  <span className="text-muted-foreground ml-2">(first half {sentimentTrend.firstHalfAvg.toFixed(2)} → second half {sentimentTrend.secondHalfAvg.toFixed(2)})</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Megaphone className="h-4 w-4" /> Per-platform breakdown
              </h3>
              <div className="space-y-1">
                {summary.byPlatform.map((p) => (
                  <div key={p.platform} className="rounded border bg-background px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{PLATFORM_LABELS[p.platform]}</span>
                      <Badge variant="outline" className="text-[10px]">{p.count} mentions</Badge>
                      <Badge variant="secondary" className="text-[10px]">{p.totalReach.toLocaleString()} reach</Badge>
                      <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400">+{p.positiveCount}</Badge>
                      <Badge variant="outline" className="text-[10px]">{p.neutralCount}</Badge>
                      <Badge variant="outline" className="text-[10px] text-red-600 dark:text-red-400">-{p.negativeCount}</Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      Avg reach: {p.avgReach.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Megaphone className="h-4 w-4" /> Top authors
              </h3>
              <div className="space-y-1">
                {topAuthors.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                    <Badge variant="outline" className="text-[10px]">#{i + 1}</Badge>
                    <span className="font-medium text-foreground flex-1 truncate">{a.author}</span>
                    <Badge variant="secondary" className="text-[10px]">{a.count} mentions</Badge>
                    <Badge variant="outline" className="text-[10px]">{a.totalReach.toLocaleString()} reach</Badge>
                    <span className="text-[10px] text-muted-foreground">{a.platforms.map((p) => PLATFORM_LABELS[p]).join(", ")}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search mentions (content, author, url)…"
                  className="h-8 text-xs"
                />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Mentions ({searched.length})</h3>
              <div className="space-y-1 max-h-[500px] overflow-auto">
                {searched.map((m, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">{PLATFORM_LABELS[m.platform]}</Badge>
                      <span className="text-muted-foreground text-[10px]">{m.date}</span>
                      <span className="font-medium text-foreground">{m.author || "(unknown)"}</span>
                      <Badge
                        variant={m.computedSentiment > 0 ? "default" : m.computedSentiment < 0 ? "destructive" : "outline"}
                        className="text-[10px]"
                      >
                        {m.computedSentiment > 0 ? "positive" : m.computedSentiment < 0 ? "negative" : "neutral"}
                      </Badge>
                      {m.matchesBrand && <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400">brand match</Badge>}
                      <span className="text-[10px] text-muted-foreground ml-auto">{m.reach.toLocaleString()} reach</span>
                    </div>
                    <div className="mt-1 text-[11px] text-foreground">{m.content}</div>
                    {m.url && (
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline mt-0.5 inline-block truncate max-w-full">
                        {m.url}
                      </a>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => { handleSaveHistory(); return text; }} label="Copy report" />
                <DownloadButton getText={() => { handleSaveHistory(); return text; }} filename="mention-report.txt" mime="text/plain" label="Download .txt" />
                <DownloadButton getText={() => csv} filename="mention-report.csv" mime="text/csv" label="Download CSV" />
                <ShareButton getUrl={() => {
                  handleSaveHistory();
                  return buildShareUrl({
                    brand: brandName,
                    aliases: aliasesText,
                    platforms: selectedPlatforms.join(","),
                    mentions: mentionsText,
                    dateStart,
                    dateEnd,
                  });
                }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          {topMentions.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Megaphone className="h-4 w-4" /> Top mentions by reach
                </h3>
                <div className="space-y-1">
                  {topMentions.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                      <Badge variant="outline" className="text-[10px]">#{i + 1}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{PLATFORM_LABELS[m.platform]}</Badge>
                      <span className="text-[10px] text-muted-foreground">{m.date}</span>
                      <span className="font-medium text-foreground flex-1 truncate">{m.author}</span>
                      <span className="text-[10px] font-mono text-foreground">{m.reach.toLocaleString()} reach</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title="Paste mention data to track brand mentions"
          hint="Enter your brand name + aliases, then paste CSV mention data (date,platform,author,content,url,sentiment). Sentiment is optional (-1/0/1). Click 'Load sample' to try it out."
          icon={<Megaphone className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.mentionCount} mentions</Badge>
                  <Badge variant="outline" className="mr-2">{h.platformCount} platforms</Badge>
                  <Badge variant="outline" className="mr-2">{h.totalReach.toLocaleString()} reach</Badge>
                  <Badge variant="secondary" className="mr-2">avg {h.avgSentiment.toFixed(2)}</Badge>
                  <span className="text-muted-foreground">{h.brand}</span>
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
            <strong className="text-foreground">Privacy:</strong> All parsing, sentiment analysis, and reporting happen locally in your browser. History is stored in localStorage on this device only. Shareable URLs encode data in the URL hash and never touch our server.
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
