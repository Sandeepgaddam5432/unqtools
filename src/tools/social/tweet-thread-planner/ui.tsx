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
  TONES,
  TONE_LABELS,
  TWEET_MAX_CHARS,
  buildThread,
  buildAltVariations,
  computeSummaryStats,
  renderText,
  renderCsv,
  bestTimeToPost,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Tone,
  type ThreadInput,
  type HistoryEntry,
} from "./logic";
import {
  History, MessagesSquare, Type, Clock, Sparkles, AlertTriangle, CheckCircle2, Twitter,
} from "lucide-react";

export default function TweetThreadPlanner() {
  const [mainTopic, setMainTopic] = useState("");
  const [longContent, setLongContent] = useState("");
  const [tweetsPerThread, setTweetsPerThread] = useState(7);
  const [includeNumbering, setIncludeNumbering] = useState(true);
  const [includeHook, setIncludeHook] = useState(true);
  const [includeCTA, setIncludeCTA] = useState(true);
  const [tone, setTone] = useState<Tone>("informational");
  const [showVariations, setShowVariations] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setMainTopic(p.mainTopic);
      setLongContent(p.longContent);
      setTweetsPerThread(p.tweetsPerThread);
      setIncludeNumbering(p.includeNumbering);
      setIncludeHook(p.includeHook);
      setIncludeCTA(p.includeCTA);
      setTone(p.tone);
      if (p.mainTopic || p.longContent) toast.info("Loaded from share link");
    }
  }, []);

  const input: ThreadInput = useMemo(
    () => ({
      mainTopic,
      longContent,
      tweetsPerThread,
      includeNumbering,
      includeHook,
      includeCTA,
      tone,
    }),
    [mainTopic, longContent, tweetsPerThread, includeNumbering, includeHook, includeCTA, tone],
  );

  const result = useMemo(() => buildThread(input), [input]);
  const stats = useMemo(() => computeSummaryStats(result), [result]);
  const textReport = useMemo(() => renderText(result), [result]);
  const csv = useMemo(() => renderCsv(result), [result]);
  const variations = useMemo(
    () => (showVariations && longContent.trim() ? buildAltVariations(input) : []),
    [showVariations, longContent, input],
  );
  const topTimes = useMemo(() => bestTimeToPost(), []);

  const handleSaveHistory = useCallback(() => {
    if (result.tweets.length > 0) {
      saveHistory({
        ts: Date.now(),
        topic: mainTopic,
        tone,
        tweetCount: result.tweets.length,
        engagementScore: result.engagementScore,
      });
      setHistory(loadHistory());
    }
  }, [result, mainTopic, tone]);

  const handleClear = useCallback(() => {
    setMainTopic("");
    setLongContent("");
    setTweetsPerThread(7);
    setIncludeNumbering(true);
    setIncludeHook(true);
    setIncludeCTA(true);
    setTone("informational");
    setShowVariations(false);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const hasContent = longContent.trim().length > 0;
  const engagementColor = result.engagementScore >= 70 ? "good" : result.engagementScore >= 45 ? "" : "bad";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ttp-topic">Main topic (optional)</Label>
              <Input
                id="ttp-topic"
                value={mainTopic}
                onChange={(e) => setMainTopic(e.target.value)}
                placeholder="e.g. marketing, productivity, design"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ttp-tone">Tone</Label>
              <select
                id="ttp-tone"
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>{TONE_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ttp-content">Long content (paste blog post / article / rough thoughts)</Label>
            <Textarea
              id="ttp-content"
              value={longContent}
              onChange={(e) => setLongContent(e.target.value)}
              placeholder={"Paste your long-form content here. The tool will break it into tweet-sized chunks."}
              className="min-h-[180px] resize-y text-sm"
            />
            <div className="text-[11px] text-muted-foreground">
              {longContent.length} chars · approx {Math.max(1, Math.ceil(longContent.length / 240))} tweets at 240 chars each
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tweets per thread (target: {tweetsPerThread})</Label>
              <input
                type="range"
                min={3}
                max={15}
                value={tweetsPerThread}
                onChange={(e) => setTweetsPerThread(parseInt(e.target.value, 10))}
                className="w-full"
              />
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={includeNumbering} onChange={(e) => setIncludeNumbering(e.target.checked)} />
                1/N numbering
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={includeHook} onChange={(e) => setIncludeHook(e.target.checked)} />
                Hook tweet
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={includeCTA} onChange={(e) => setIncludeCTA(e.target.checked)} />
                CTA tweet
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasContent && result.tweets.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Twitter className="h-4 w-4" /> {result.tweets.length} tweets · {TONE_LABELS[tone]}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total tweets" value={stats.totalTweets} />
                <Stat label="Avg chars / tweet" value={stats.avgCharsPerTweet} />
                <Stat label="Hook strength" value={`${stats.hookStrength}/100`} />
                <Stat
                  label="Engagement score"
                  value={`${stats.engagementScore}/100`}
                  highlight={engagementColor as "good" | "bad" | undefined}
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {stats.hasHook && <Badge variant="outline" className="text-[10px]"><Sparkles className="h-3 w-3 mr-1" />Hook</Badge>}
                {stats.hasCTA && <Badge variant="outline" className="text-[10px]">CTA</Badge>}
                {result.flowOk
                  ? <Badge variant="outline" className="text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Flow OK</Badge>
                  : <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Flow issue</Badge>}
                {stats.overLimit > 0
                  ? <Badge variant="destructive" className="text-[10px]">{stats.overLimit} over limit</Badge>
                  : <Badge variant="outline" className="text-[10px]">All ≤ {TWEET_MAX_CHARS}</Badge>}
              </div>
              <div className="rounded border bg-muted/30 px-3 py-2 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Clock className="h-3 w-3" /> Best times to post (US, weekdays)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {topTimes.map((t) => (
                    <Badge key={t.hour} variant="secondary" className="text-[10px]">
                      {t.label} · ×{t.multiplier}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <MessagesSquare className="h-4 w-4" /> Thread
                </h3>
                <Button
                  variant={showVariations ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowVariations((s) => !s)}
                >
                  {showVariations ? "Hide alt-variations" : "Generate 2 alt-variations"}
                </Button>
              </div>
              <div className="space-y-2">
                {result.tweets.map((t) => (
                  <div key={t.num} className="rounded border bg-background p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2 pb-2">
                      <Badge variant="secondary" className="text-[10px]">#{t.num}</Badge>
                      {t.isHook && <Badge variant="outline" className="text-[10px]"><Sparkles className="h-3 w-3 mr-1" />Hook</Badge>}
                      {t.isCTA && <Badge variant="outline" className="text-[10px]">CTA</Badge>}
                      {t.transition && <Badge variant="outline" className="text-[10px] text-muted-foreground">→ {t.transition}</Badge>}
                      <Badge variant={t.withinLimit ? "outline" : "destructive"} className="text-[10px]">
                        <Type className="h-3 w-3 mr-1" />{t.charCount}/{TWEET_MAX_CHARS}
                      </Badge>
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-foreground text-sm leading-relaxed">{t.content}</pre>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <CopyButton getText={() => { handleSaveHistory(); return t.content; }} label={`Copy tweet ${t.num}`} />
                    </div>
                  </div>
                ))}
              </div>

              {showVariations && variations.length > 0 && (
                <div className="space-y-3 pt-2 border-t">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Alt-variations (different tones + lengths)</div>
                  {variations.map((v, i) => (
                    <div key={i} className="rounded border bg-muted/30 p-3 space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="secondary">V{i + 1}</Badge>
                        <Badge variant="outline">{TONE_LABELS[v.tone]}</Badge>
                        <Badge variant="outline">{v.tweets.length} tweets</Badge>
                        <Badge variant="outline">engagement {v.engagementScore}/100</Badge>
                      </div>
                      <div className="space-y-1">
                        {v.tweets.map((t) => (
                          <div key={t.num} className="text-xs font-mono text-foreground/90">
                            <span className="text-muted-foreground">{t.num}/{v.tweets.length}</span> {t.content}
                          </div>
                        ))}
                      </div>
                      <CopyButton getText={() => renderText(v)} label={`Copy variation ${i + 1}`} />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => { handleSaveHistory(); return textReport; }} label="Copy thread" />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return textReport; }}
                  filename="tweet-thread.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="tweet-thread.csv"
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
          title="Paste your content to plan a tweet thread"
          hint="Enter your long content above. The tool splits it into ≤280-char tweets, adds a hook + CTA, applies 1/N numbering, and inserts transition words."
          icon={<MessagesSquare className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{TONE_LABELS[h.tone]}</Badge>
                  <Badge variant="outline" className="mr-2">{h.tweetCount} tweets</Badge>
                  <Badge variant="outline" className="mr-2">{h.engagementScore}/100</Badge>
                  <span className="text-muted-foreground">{h.topic || "(no topic)"}</span>
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
            <strong className="text-foreground">Privacy:</strong> All thread planning runs locally in your browser. Your content never leaves this device. History is stored in localStorage on this device only.
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
