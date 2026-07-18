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
  CHANNEL_PRESETS,
  FREQUENCY_PRESETS,
  MONTH_NAMES,
  generateCalendar,
  parseContentMix,
  parseTopics,
  parseChannels,
  generateIcs,
  renderText,
  renderCsv,
  computeSummaryStats,
  filterByChannel,
  detectConflicts,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PostingFrequency,
  type HistoryEntry,
} from "./logic";
import { CalendarDays, History, AlertTriangle, Filter } from "lucide-react";

export default function ContentCalendarPlanner() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getUTCFullYear());
  const [month, setMonth] = useState<number>(now.getUTCMonth() + 1);
  const [postingFrequency, setPostingFrequency] = useState<PostingFrequency>("weekly");
  const [topicsText, setTopicsText] = useState("");
  const [channelsText, setChannelsText] = useState("Blog, YouTube, LinkedIn");
  const [mixText, setMixText] = useState("blog:3, video:2, social:5, email:1");
  const [keywordsText, setKeywordsText] = useState("");
  const [filterChannel, setFilterChannel] = useState<string>("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.year) setYear(p.year);
      if (p.month) setMonth(p.month);
      if (p.topics) setTopicsText(p.topics);
      if (p.channels) setChannelsText(p.channels);
      if (p.contentTypeMix) setMixText(p.contentTypeMix);
      if (p.postingFrequency) setPostingFrequency(p.postingFrequency);
      if (p.keywords) setKeywordsText(p.keywords);
      if (window.location.hash.length > 1) toast.info("Loaded from share link");
    }
  }, []);

  const topics = useMemo(() => parseTopics(topicsText), [topicsText]);
  const channels = useMemo(() => parseChannels(channelsText), [channelsText]);
  const mix = useMemo(() => parseContentMix(mixText), [mixText]);
  const keywords = useMemo(() => parseTopics(keywordsText), [keywordsText]);

  const posts = useMemo(
    () => generateCalendar({
      year, month, topics, channels,
      contentTypeMix: mix,
      postingFrequency,
      keywords,
    }),
    [year, month, topics, channels, mix, postingFrequency, keywords],
  );

  const filteredPosts = useMemo(
    () => filterByChannel(posts, filterChannel),
    [posts, filterChannel],
  );

  const stats = useMemo(() => computeSummaryStats(posts), [posts]);
  const conflicts = useMemo(() => detectConflicts(posts), [posts]);

  const textOut = useMemo(() => renderText(filteredPosts), [filteredPosts]);
  const csvOut = useMemo(() => renderCsv(filteredPosts), [filteredPosts]);
  const icsOut = useMemo(() => generateIcs(filteredPosts, `Content Calendar ${year}-${String(month).padStart(2, "0")}`), [filteredPosts, year, month]);

  const handleSaveHistory = useCallback(() => {
    if (posts.length > 0) {
      saveHistory({
        ts: Date.now(),
        year, month, frequency: postingFrequency,
        totalPosts: posts.length,
      });
      setHistory(loadHistory());
    }
  }, [posts.length, year, month, postingFrequency]);

  const handleClear = useCallback(() => {
    setTopicsText("");
    setChannelsText("Blog, YouTube, LinkedIn");
    setMixText("blog:3, video:2, social:5, email:1");
    setKeywordsText("");
    setFilterChannel("");
    setPostingFrequency("weekly");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const shareInputs = {
    year, month,
    topics: topicsText,
    channels: channelsText,
    contentTypeMix: mixText,
    postingFrequency,
    keywords: keywordsText,
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ccp-year" className="text-xs">Year</Label>
              <Input
                id="ccp-year"
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10) || now.getUTCFullYear())}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ccp-month" className="text-xs">Month</Label>
              <select
                id="ccp-month"
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                className="h-8 text-sm rounded border bg-background px-2 w-full"
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="ccp-freq" className="text-xs">Posting frequency</Label>
              <select
                id="ccp-freq"
                value={postingFrequency}
                onChange={(e) => setPostingFrequency(e.target.value as PostingFrequency)}
                className="h-8 text-sm rounded border bg-background px-2 w-full"
              >
                {FREQUENCY_PRESETS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ccp-topics" className="text-xs">Topics (one per line)</Label>
            <Textarea
              id="ccp-topics"
              value={topicsText}
              onChange={(e) => setTopicsText(e.target.value)}
              placeholder={"SEO basics\nKeyword research\nLink building\nTechnical SEO"}
              className="min-h-[80px] resize-y font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ccp-channels" className="text-xs">Channels (comma-separated)</Label>
            <Input
              id="ccp-channels"
              value={channelsText}
              onChange={(e) => setChannelsText(e.target.value)}
              className="text-sm font-mono"
            />
            <div className="flex flex-wrap gap-1">
              {CHANNEL_PRESETS.map((c) => (
                <Button
                  key={c}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setChannelsText((prev) => (prev ? `${prev}, ${c}` : c))}
                >+ {c}</Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ccp-mix" className="text-xs">Content type mix (type:weight)</Label>
            <Input
              id="ccp-mix"
              value={mixText}
              onChange={(e) => setMixText(e.target.value)}
              placeholder="blog:3, video:2, social:5, email:1"
              className="text-sm font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ccp-kw" className="text-xs">Target keywords (one per line, optional)</Label>
            <Textarea
              id="ccp-kw"
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder={"best SEO tools\nhow to do keyword research"}
              className="min-h-[60px] resize-y font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {posts.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" /> {MONTH_NAMES[month - 1]} {year} — {posts.length} posts
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total posts" value={stats.totalPosts} />
                <Stat label="Channels" value={Object.keys(stats.byChannel).length} />
                <Stat label="Content types" value={Object.keys(stats.byContentType).length} />
                <Stat label="Unique topics" value={stats.uniqueTopics} />
              </div>

              {Object.keys(stats.byChannel).length > 0 && (
                <div className="pt-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">By channel</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(stats.byChannel).map(([ch, n]) => (
                      <Badge key={ch} variant="outline" className="text-[10px]">{ch}: {n}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(stats.byContentType).length > 0 && (
                <div className="pt-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">By content type</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(stats.byContentType).map(([t, n]) => (
                      <Badge key={t} variant="outline" className="text-[10px]">{t}: {n}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {conflicts.length > 0 && (
                <div className="mt-2 rounded border border-amber-400/40 bg-amber-400/10 p-2 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" /> {conflicts.length} topic conflict(s) — same topic within 7 days
                  </div>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                    {conflicts.slice(0, 5).map((c, i) => (
                      <li key={i}>
                        {c.date}: &ldquo;{c.topic}&rdquo; repeats {c.previousDate} ({c.daysApart}d apart)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Filter className="h-4 w-4" /> Schedule ({filteredPosts.length})
                </h3>
                <select
                  value={filterChannel}
                  onChange={(e) => setFilterChannel(e.target.value)}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="">All channels</option>
                  {channels.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-1.5 pr-2 font-medium">Date</th>
                      <th className="py-1.5 pr-2 font-medium">Day</th>
                      <th className="py-1.5 pr-2 font-medium">Topic</th>
                      <th className="py-1.5 pr-2 font-medium">Channel</th>
                      <th className="py-1.5 pr-2 font-medium">Type</th>
                      <th className="py-1.5 font-medium">Keyword</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPosts.map((p, i) => (
                      <tr key={i} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="py-1.5 pr-2 font-mono">{p.date}</td>
                        <td className="py-1.5 pr-2 text-muted-foreground">{p.dayOfWeek}</td>
                        <td className="py-1.5 pr-2">{p.topic || "—"}</td>
                        <td className="py-1.5 pr-2">
                          {p.channel ? <Badge variant="secondary" className="text-[10px]">{p.channel}</Badge> : "—"}
                        </td>
                        <td className="py-1.5 pr-2">
                          {p.contentType ? <Badge variant="outline" className="text-[10px]">{p.contentType}</Badge> : "—"}
                        </td>
                        <td className="py-1.5 text-muted-foreground font-mono text-[11px]">{p.keyword || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => { handleSaveHistory(); return textOut; }} label="Copy table" />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return textOut; }}
                  filename={`content-calendar-${year}-${String(month).padStart(2, "0")}.txt`}
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csvOut}
                  filename={`content-calendar-${year}-${String(month).padStart(2, "0")}.csv`}
                  mime="text/csv"
                  label="Download CSV"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return icsOut; }}
                  filename={`content-calendar-${year}-${String(month).padStart(2, "0")}.ics`}
                  mime="text/calendar"
                  label="Download .ics"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(shareInputs); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Pick a year, month, and frequency to generate a calendar"
          hint="Add topics (one per line), channels, and content-type weights. Each posting day gets one topic + channel + type + keyword assigned."
          icon={<CalendarDays className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{MONTH_NAMES[h.month - 1]} {h.year}</Badge>
                  <Badge variant="outline" className="mr-2">{h.frequency}</Badge>
                  <Badge variant="outline" className="mr-2">{h.totalPosts} posts</Badge>
                  <span className="text-muted-foreground ml-2">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All calendar generation runs locally. History is stored in localStorage on this device only.
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
