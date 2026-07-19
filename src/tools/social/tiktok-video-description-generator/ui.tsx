"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  VIDEO_STYLES,
  TARGET_AUDIENCES,
  STYLE_LABELS,
  AUDIENCE_LABELS,
  MAX_CHARS,
  OPTIMAL_MIN,
  OPTIMAL_MAX,
  generateVariations,
  scoreViralPotential,
  suggestBestPostTime,
  computeSummaryStats,
  renderTextAll,
  renderCsvAll,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateCharCount,
  type VideoStyle,
  type TargetAudience,
  type TikTokInput,
  type HistoryEntry,
} from "./logic";
import { History, Music, Hash, Smile, Type, Clock, Flame, Sparkles } from "lucide-react";

export default function TikTokVideoDescriptionGenerator() {
  const [videoTopic, setVideoTopic] = useState("");
  const [videoStyle, setVideoStyle] = useState<VideoStyle>("tutorial");
  const [targetAudience, setTargetAudience] = useState<TargetAudience>("gen-z");
  const [includeTrendingSounds, setIncludeTrendingSounds] = useState(true);
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [includeCTA, setIncludeCTA] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.videoTopic) setVideoTopic(p.videoTopic);
      setVideoStyle(p.videoStyle);
      setTargetAudience(p.targetAudience);
      setIncludeTrendingSounds(p.includeTrendingSounds);
      setIncludeHashtags(p.includeHashtags);
      setIncludeCTA(p.includeCTA);
      if (p.videoTopic) toast.info("Loaded from share link");
    }
  }, []);

  const input: TikTokInput = useMemo(
    () => ({
      videoTopic,
      videoStyle,
      targetAudience,
      includeTrendingSounds,
      includeHashtags,
      includeCTA,
    }),
    [
      videoTopic, videoStyle, targetAudience,
      includeTrendingSounds, includeHashtags, includeCTA,
    ],
  );

  const variations = useMemo(() => generateVariations(input), [input]);
  const stats = useMemo(() => computeSummaryStats(variations), [variations]);
  const text = useMemo(() => renderTextAll(variations), [variations]);
  const csv = useMemo(() => renderCsvAll(variations), [variations]);
  const bestTimes = useMemo(() => suggestBestPostTime(), []);

  const handleSaveHistory = useCallback(() => {
    if (variations.length > 0) {
      saveHistory({
        ts: Date.now(),
        videoTopic,
        videoStyle,
        targetAudience,
        variationCount: variations.length,
        viralScore: stats.viralScore,
      });
      setHistory(loadHistory());
    }
  }, [variations, videoTopic, videoStyle, targetAudience, stats.viralScore]);

  const handleClear = useCallback(() => {
    setVideoTopic("");
    setVideoStyle("tutorial");
    setTargetAudience("gen-z");
    setIncludeTrendingSounds(true);
    setIncludeHashtags(true);
    setIncludeCTA(true);
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
            <Label htmlFor="tiktok-topic">Video topic</Label>
            <Input
              id="tiktok-topic"
              value={videoTopic}
              onChange={(e) => setVideoTopic(e.target.value)}
              placeholder="e.g. Easy 5-minute pasta recipe"
              className="text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Video style</Label>
              <select
                value={videoStyle}
                onChange={(e) => setVideoStyle(e.target.value as VideoStyle)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {VIDEO_STYLES.map((s) => (
                  <option key={s} value={s}>{STYLE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Target audience</Label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value as TargetAudience)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {TARGET_AUDIENCES.map((a) => (
                  <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-1 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTrendingSounds}
                onChange={(e) => setIncludeTrendingSounds(e.target.checked)}
              />
              Suggest trending sounds
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeHashtags}
                onChange={(e) => setIncludeHashtags(e.target.checked)}
              />
              Include hashtags
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeCTA}
                onChange={(e) => setIncludeCTA(e.target.checked)}
              />
              Include CTA
            </label>
          </div>
        </CardContent>
      </Card>

      {variations.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Variations" value={stats.totalVariations} />
                <Stat label="Avg chars" value={stats.avgChars} highlight={stats.avgChars <= OPTIMAL_MAX ? "good" : undefined} />
                <Stat label="Avg words" value={stats.avgWords} />
                <Stat label="Avg hashtags" value={stats.avgHashtags} />
                <Stat label="Avg emojis" value={stats.avgEmojis} />
                <Stat label="Avg sounds" value={stats.avgSounds} />
                <Stat label="Within optimal" value={`${stats.withinOptimalCount}/${stats.totalVariations}`} highlight={stats.withinOptimalCount === stats.totalVariations ? "good" : undefined} />
                <Stat label="Viral score" value={`${stats.viralScore}/100`} highlight={stats.viralScore >= 70 ? "good" : stats.viralScore < 50 ? "bad" : undefined} />
              </div>
              <div className="pt-2 border-t border-border">
                <h4 className="text-xs font-medium text-foreground flex items-center gap-1.5 mb-1.5">
                  <Clock className="h-3.5 w-3.5" /> Best times to post (TikTok engagement data)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {bestTimes.map((t) => (
                    <Badge key={t.hour} variant="outline" className="text-[11px]">
                      {t.label} · {t.score}/100
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {variations.map((desc) => {
            const v = validateCharCount(desc.charCount);
            const viralScore = scoreViralPotential(desc);
            return (
              <Card key={desc.variation}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Music className="h-4 w-4" /> Variation {desc.variation}
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={charBadgeClass(v)}>
                        {desc.charCount} chars · {v}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        <Flame className="h-3 w-3 mr-1" /> {viralScore}/100
                      </Badge>
                    </div>
                  </div>

                  <div className="rounded border bg-background px-3 py-2 text-sm font-medium text-foreground whitespace-pre-wrap">
                    {desc.fullDescription}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <Mini label="Hook" value={desc.hook} icon={<Type className="h-3 w-3" />} />
                    <Mini label="Opener" value={desc.opener} icon={<Sparkles className="h-3 w-3" />} />
                    <Mini label="CTA" value={desc.cta || "—"} icon={<Hash className="h-3 w-3" />} />
                    <Mini label="Emojis" value={desc.emojis} icon={<Smile className="h-3 w-3" />} />
                  </div>

                  {desc.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {desc.hashtags.map((h) => (
                        <Badge key={h} variant="secondary" className="text-[10px]">#{h}</Badge>
                      ))}
                    </div>
                  )}

                  {desc.trendingSounds.length > 0 && (
                    <div className="pt-1">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                        Suggested trending sounds
                      </div>
                      <ul className="space-y-0.5">
                        {desc.trendingSounds.map((s) => (
                          <li key={s} className="text-[11px] text-foreground flex items-center gap-1.5">
                            <Music className="h-3 w-3 text-muted-foreground" /> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Export &amp; share</h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy all"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename="tiktok-descriptions.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="tiktok-descriptions.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
              <p className="text-[10px] text-muted-foreground pt-1">
                Char limits: optimal {OPTIMAL_MIN}-{OPTIMAL_MAX}, max {MAX_CHARS}.
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a video topic to generate TikTok descriptions"
          hint="Pick a style and audience to generate 3 variations with hooks, hashtags, trending sounds, and CTAs."
          icon={<Music className="h-8 w-8" />}
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
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{STYLE_LABELS[h.videoStyle]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{AUDIENCE_LABELS[h.targetAudience]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.variationCount} vars</Badge>
                    <Badge variant="outline" className="text-[10px]">
                      <Flame className="h-3 w-3 mr-1" /> {h.viralScore}/100
                    </Badge>
                    <span className="text-muted-foreground">{h.videoTopic}</span>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All description generation runs locally. No network calls. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function charBadgeClass(v: "optimal" | "over-optimal" | "too-long" | "too-short"): string {
  if (v === "optimal") return "text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
  if (v === "too-long") return "text-red-600 dark:text-red-400 border-red-500/30";
  if (v === "too-short") return "text-amber-600 dark:text-amber-400 border-amber-500/30";
  return "text-amber-600 dark:text-amber-400 border-amber-500/30";
}

function Mini({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="text-[11px] text-foreground line-clamp-2">{value}</div>
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
