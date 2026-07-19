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
  TONES,
  AUDIENCES,
  PLATFORM_CONFIGS,
  PLATFORM_LABELS,
  TONE_LABELS,
  AUDIENCE_LABELS,
  parseKeyPoints,
  generateForPlatforms,
  generateAllVariations,
  generateVariations,
  getCharLimitStatus,
  getBestTimeToPost,
  computeSummaryStats,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Tone,
  type TargetAudience,
  type Platform,
  type GeneratedPost,
  type HistoryEntry,
} from "./logic";
import { History, MessageCircle, Clock, Hash, Tag } from "lucide-react";

export default function SocialMediaPostGenerator() {
  const [topic, setTopic] = useState("");
  const [keyPointsText, setKeyPointsText] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [audience, setAudience] = useState<TargetAudience>("general");
  const [platforms, setPlatforms] = useState<Platform[]>(["twitter", "linkedin"]);
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [includeCTA, setIncludeCTA] = useState(true);
  const [includeEmojis, setIncludeEmojis] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.topic) setTopic(p.topic);
      if (p.keyPoints.length > 0) setKeyPointsText(p.keyPoints.join("\n"));
      setTone(p.tone);
      setAudience(p.audience);
      if (p.platforms.length > 0) setPlatforms(p.platforms);
      setIncludeHashtags(p.includeHashtags);
      setIncludeCTA(p.includeCTA);
      setIncludeEmojis(p.includeEmojis);
      if (p.topic || p.platforms.length > 0) toast.info("Loaded from share link");
    }
  }, []);

  const keyPoints = useMemo(() => parseKeyPoints(keyPointsText), [keyPointsText]);

  const input = useMemo(
    () => ({
      topic,
      keyPoints,
      tone,
      audience,
      platforms,
      includeHashtags,
      includeCTA,
      includeEmojis,
    }),
    [topic, keyPoints, tone, audience, platforms, includeHashtags, includeCTA, includeEmojis],
  );

  const allPosts = useMemo(() => generateAllVariations(input), [input]);
  const summaryPosts = useMemo(() => generateForPlatforms(input), [input]);
  const stats = useMemo(() => computeSummaryStats(summaryPosts), [summaryPosts]);
  const textReport = useMemo(() => renderText(allPosts), [allPosts]);
  const csv = useMemo(() => renderCsv(allPosts), [allPosts]);

  const handleSaveHistory = useCallback(() => {
    if (allPosts.length > 0 && topic.trim()) {
      saveHistory({
        ts: Date.now(),
        topic,
        platforms,
        tone,
        audience,
        totalPosts: allPosts.length,
      });
      setHistory(loadHistory());
    }
  }, [allPosts, topic, platforms, tone, audience]);

  const togglePlatform = (p: Platform) => {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const handleClear = useCallback(() => {
    setTopic("");
    setKeyPointsText("");
    setTone("professional");
    setAudience("general");
    setPlatforms(["twitter", "linkedin"]);
    setIncludeHashtags(true);
    setIncludeCTA(true);
    setIncludeEmojis(false);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const colorClass = (status: "green" | "yellow" | "red") =>
    status === "red"
      ? "text-red-600 dark:text-red-400"
      : status === "yellow"
        ? "text-amber-600 dark:text-amber-400"
        : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="smpg-topic">Topic</Label>
            <Input
              id="smpg-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. JavaScript testing best practices"
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smpg-points">Key points (one per line)</Label>
            <Textarea
              id="smpg-points"
              value={keyPointsText}
              onChange={(e) => setKeyPointsText(e.target.value)}
              placeholder={"Use Vitest\nMock localStorage\nRun in CI"}
              className="min-h-[80px] resize-y font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              {keyPoints.length} point(s) parsed
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="smpg-tone" className="text-xs">Tone</Label>
              <select
                id="smpg-tone"
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="h-9 w-full text-sm rounded-md border bg-transparent px-3"
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>{TONE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smpg-aud" className="text-xs">Target audience</Label>
              <select
                id="smpg-aud"
                value={audience}
                onChange={(e) => setAudience(e.target.value as TargetAudience)}
                className="h-9 w-full text-sm rounded-md border bg-transparent px-3"
              >
                {AUDIENCES.map((a) => (
                  <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Platforms ({platforms.length}/{PLATFORMS.length})</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {PLATFORMS.map((p) => (
                <label key={p} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={platforms.includes(p)}
                    onChange={() => togglePlatform(p)}
                  />
                  {PLATFORM_LABELS[p]}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={includeHashtags}
                onChange={(e) => setIncludeHashtags(e.target.checked)}
              />
              <Hash className="h-3 w-3" /> Hashtags
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={includeCTA}
                onChange={(e) => setIncludeCTA(e.target.checked)}
              />
              CTA
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={includeEmojis}
                onChange={(e) => setIncludeEmojis(e.target.checked)}
              />
              Emojis
            </label>
          </div>
        </CardContent>
      </Card>

      {allPosts.length > 0 && topic.trim() ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <MessageCircle className="h-4 w-4" /> {stats.totalPosts} posts across {stats.totalPlatforms} platform(s)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total posts" value={stats.totalPosts} />
                <Stat label="Total chars" value={stats.totalChars} />
                <Stat label="Avg chars/post" value={stats.avgCharsPerPost} />
                <Stat
                  label="Truncated"
                  value={stats.truncatedCount}
                  highlight={stats.truncatedCount > 0 ? "bad" : "good"}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <MessageCircle className="h-4 w-4" /> Generated posts ({allPosts.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    getText={() => { handleSaveHistory(); return textReport; }}
                    label="Copy report"
                  />
                  <DownloadButton
                    getText={() => { handleSaveHistory(); return textReport; }}
                    filename="social-media-posts.txt"
                    mime="text/plain"
                    label="Download .txt"
                  />
                  <DownloadButton
                    getText={() => csv}
                    filename="social-media-posts.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                  <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                  <ClearButton onClick={handleClear} />
                </div>
              </div>
              <div className="space-y-4">
                {platforms.map((p) => {
                  const variations = generateVariations(input, p);
                  const cfg = PLATFORM_CONFIGS[p];
                  return (
                    <div key={p} className="rounded-lg border bg-background p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">{cfg.label}</Badge>
                          <span className="text-[10px] text-muted-foreground">
                            Max: {cfg.maxChars} · Optimal: {cfg.optimalChars} · Tags: {cfg.hashtagCount}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" /> Best: {getBestTimeToPost(p)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {variations.map((post: GeneratedPost) => {
                          const status = getCharLimitStatus(post.platform, post.charCount);
                          return (
                            <div key={`${p}-${post.variation}`} className="rounded border bg-muted/30 p-2.5">
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <Badge variant="outline" className="text-[10px]">
                                  V{post.variation} · {post.hook}
                                </Badge>
                                <div className="flex items-center gap-2 text-[10px]">
                                  <span className={colorClass(status)}>
                                    {post.charCount}/{cfg.maxChars} chars
                                  </span>
                                  {post.truncated && (
                                    <Badge variant="destructive" className="text-[10px]">truncated</Badge>
                                  )}
                                  <span className="text-muted-foreground">
                                    <Tag className="inline h-2.5 w-2.5" /> {post.hashtagCount} tags
                                  </span>
                                </div>
                              </div>
                              <pre className="whitespace-pre-wrap font-mono text-[11px] text-foreground leading-relaxed">
                                {post.text}
                              </pre>
                              <div className="mt-1.5">
                                <CopyButton
                                  getText={() => post.text}
                                  label="Copy"
                                  size="sm"
                                />
                              </div>
                            </div>
                          );
                        })}
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
          title="Enter a topic to generate posts"
          hint="Pick platforms, tone, audience, and toggles. The tool produces 3 variations per platform with platform-specific char limits, CTAs, and hashtags."
          icon={<MessageCircle className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.platforms.length} platforms</Badge>
                  <Badge variant="outline" className="mr-2">{h.totalPosts} posts</Badge>
                  <Badge variant="outline" className="mr-2">{TONE_LABELS[h.tone]}</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All post generation runs locally in your browser. History is stored in localStorage on this device only.
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
