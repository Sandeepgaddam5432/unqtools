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
  MOODS,
  CAPTION_LENGTHS,
  PLATFORMS,
  MOOD_LABELS,
  CAPTION_LENGTH_LABELS,
  PLATFORM_LABELS,
  PLATFORM_CONFIGS,
  generateCaption,
  generateVariations,
  computeSummaryStats,
  splitFirstComment,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Mood,
  type CaptionLength,
  type Platform,
  type GeneratedCaption,
  type HistoryEntry,
} from "./logic";
import { History, MessageSquareQuote, Hash, Smile, Type, FileText } from "lucide-react";

export default function CaptionGenerator() {
  const [imageDescription, setImageDescription] = useState("");
  const [mood, setMood] = useState<Mood>("happy");
  const [captionLength, setCaptionLength] = useState<CaptionLength>("medium");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [includeEmojis, setIncludeEmojis] = useState(true);
  const [includeCTA, setIncludeCTA] = useState(true);
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [showFirstComment, setShowFirstComment] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.imageDescription) setImageDescription(p.imageDescription);
      setMood(p.mood);
      setCaptionLength(p.captionLength);
      setPlatform(p.platform);
      setIncludeEmojis(p.includeEmojis);
      setIncludeCTA(p.includeCTA);
      setIncludeHashtags(p.includeHashtags);
      if (p.imageDescription) toast.info("Loaded from share link");
    }
  }, []);

  const input = useMemo(
    () => ({
      imageDescription,
      mood,
      captionLength,
      includeEmojis,
      includeCTA,
      includeHashtags,
      platform,
    }),
    [imageDescription, mood, captionLength, includeEmojis, includeCTA, includeHashtags, platform],
  );

  const variations = useMemo(() => {
    if (!imageDescription.trim()) return [];
    return generateVariations(input);
  }, [input, imageDescription]);

  const stats = useMemo(() => computeSummaryStats(variations), [variations]);
  const textReport = useMemo(() => renderText(variations), [variations]);
  const csv = useMemo(() => renderCsv(variations), [variations]);

  const handleSaveHistory = useCallback(() => {
    if (variations.length > 0) {
      saveHistory({
        ts: Date.now(),
        imageDescription,
        mood,
        captionLength,
        platform,
        variationCount: variations.length,
      });
      setHistory(loadHistory());
    }
  }, [variations, imageDescription, mood, captionLength, platform]);

  const handleClear = useCallback(() => {
    setImageDescription("");
    setMood("happy");
    setCaptionLength("medium");
    setPlatform("instagram");
    setIncludeEmojis(true);
    setIncludeCTA(true);
    setIncludeHashtags(true);
    setShowFirstComment(false);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const platformConfig = PLATFORM_CONFIGS[platform];
  const hasInput = imageDescription.trim().length > 0;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cg-desc">What's in the photo or video?</Label>
            <Textarea
              id="cg-desc"
              value={imageDescription}
              onChange={(e) => setImageDescription(e.target.value)}
              placeholder="e.g. morning coffee by the window with a good book"
              className="min-h-[80px] resize-y text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Mood</Label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value as Mood)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {MOODS.map((m) => (
                  <option key={m} value={m}>{MOOD_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Caption length</Label>
              <select
                value={captionLength}
                onChange={(e) => setCaptionLength(e.target.value as CaptionLength)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {CAPTION_LENGTHS.map((l) => (
                  <option key={l} value={l}>{CAPTION_LENGTH_LABELS[l]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Platform</Label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={includeEmojis} onChange={(e) => setIncludeEmojis(e.target.checked)} />
              Emojis
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={includeCTA} onChange={(e) => setIncludeCTA(e.target.checked)} />
              CTA
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={includeHashtags} onChange={(e) => setIncludeHashtags(e.target.checked)} />
              Hashtags
            </label>
            {platform === "instagram" && includeHashtags && (
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={showFirstComment} onChange={(e) => setShowFirstComment(e.target.checked)} />
                First-comment separator
              </label>
            )}
          </div>
        </CardContent>
      </Card>

      {hasInput && variations.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <MessageSquareQuote className="h-4 w-4" /> {variations.length} variations · {PLATFORM_LABELS[platform]}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Platform max chars" value={platformConfig.maxChars} />
                <Stat label="Hashtags per caption" value={platformConfig.hashtagCount} />
                <Stat label="Avg chars" value={stats.avgChars} />
                <Stat label="Avg emojis" value={stats.avgEmojis} />
              </div>
              <div className="text-[11px] text-muted-foreground pt-1">
                Platform CTA: <span className="font-mono">{platformConfig.cta}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Caption Variations
                </h3>
                <Badge variant="outline" className="text-[10px]">{stats.withinLimitCount}/{variations.length} within limit</Badge>
              </div>
              <div className="space-y-2">
                {variations.map((c) => {
                  const split = showFirstComment ? splitFirstComment(c) : null;
                  return (
                    <div key={c.variation} className="rounded border bg-background p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2 pb-2">
                        <Badge variant="secondary" className="text-[10px]">V{c.variation}</Badge>
                        <Badge variant="outline" className="text-[10px]">
                          <Type className="h-3 w-3 mr-1" />{c.charCount} chars
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          <Hash className="h-3 w-3 mr-1" />{c.hashtagCount} tags
                        </Badge>
                        {includeEmojis && (
                          <Badge variant="outline" className="text-[10px]">
                            <Smile className="h-3 w-3 mr-1" />{c.emojiCount} emojis
                          </Badge>
                        )}
                        <Badge variant={c.withinLimit ? "outline" : "destructive"} className="text-[10px]">
                          {c.withinLimit ? "within limit" : "OVER LIMIT"}
                        </Badge>
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-foreground text-sm leading-relaxed">
                        {split ? split.visibleCaption : c.fullCaption}
                      </pre>
                      {split && split.firstComment && (
                        <div className="mt-2 rounded border border-dashed bg-muted/30 p-2 text-xs">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">First comment (hashtags)</div>
                          <div className="font-mono text-foreground">{split.firstComment}</div>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <CopyButton
                          getText={() => { handleSaveHistory(); return split ? split.visibleCaption : c.fullCaption; }}
                          label="Copy caption"
                        />
                        {split && split.firstComment && (
                          <CopyButton
                            getText={() => split.firstComment}
                            label="Copy hashtags"
                            successLabel="Copied hashtags!"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return textReport; }}
                  label="Copy all"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return textReport; }}
                  filename="captions.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="captions.csv"
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
          title="Describe your photo or video to generate captions"
          hint="Tell us what's in the image, pick a mood, length, and platform. The tool generates 3 caption variations with hook + body + CTA + emojis + hashtags."
          icon={<MessageSquareQuote className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{MOOD_LABELS[h.mood]}</Badge>
                  <Badge variant="outline" className="mr-2">{PLATFORM_LABELS[h.platform]}</Badge>
                  <Badge variant="outline" className="mr-2">{CAPTION_LENGTH_LABELS[h.captionLength]}</Badge>
                  <span className="text-muted-foreground">{h.imageDescription.slice(0, 60)}</span>
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
            <strong className="text-foreground">Privacy:</strong> All caption generation runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
