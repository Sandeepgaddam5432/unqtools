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
  VIDEO_CATEGORIES,
  THUMBNAIL_STYLES,
  TEXT_LENGTHS,
  CATEGORY_LABELS,
  STYLE_LABELS,
  LENGTH_LABELS,
  COLOR_COMBOS,
  FONTS,
  POSITIONS,
  generateVariations,
  computeStats,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type VideoCategory,
  type ThumbnailStyle,
  type TextLength,
  type OverlayInput,
  type HistoryEntry,
} from "./logic";
import { History, Youtube, Type, Palette, MousePointerClick, FlaskConical, Trophy } from "lucide-react";

export default function YoutubeThumbnailTextOverlay() {
  const [videoTitle, setVideoTitle] = useState("");
  const [videoCategory, setVideoCategory] = useState<VideoCategory>("tech");
  const [thumbnailStyle, setThumbnailStyle] = useState<ThumbnailStyle>("face-cam");
  const [textLength, setTextLength] = useState<TextLength>("short");
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeEmoji, setIncludeEmoji] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.videoTitle) setVideoTitle(p.videoTitle);
      setVideoCategory(p.videoCategory);
      setThumbnailStyle(p.thumbnailStyle);
      setTextLength(p.textLength);
      setIncludeNumbers(p.includeNumbers);
      setIncludeEmoji(p.includeEmoji);
      if (p.videoTitle) toast.info("Loaded from share link");
    }
  }, []);

  const input: OverlayInput = useMemo(
    () => ({
      videoTitle,
      videoCategory,
      thumbnailStyle,
      textLength,
      includeNumbers,
      includeEmoji,
    }),
    [videoTitle, videoCategory, thumbnailStyle, textLength, includeNumbers, includeEmoji],
  );

  const variations = useMemo(() => generateVariations(input), [input]);
  const stats = useMemo(() => computeStats(variations), [variations]);
  const textReport = useMemo(() => renderText(variations), [variations]);
  const csvReport = useMemo(() => renderCsv(variations), [variations]);

  const handleSaveHistory = useCallback(() => {
    if (variations.length > 0) {
      saveHistory({
        ts: Date.now(),
        videoTitle,
        videoCategory,
        thumbnailStyle,
        textLength,
        variationCount: variations.length,
      });
      setHistory(loadHistory());
    }
  }, [variations, videoTitle, videoCategory, thumbnailStyle, textLength]);

  const handleClear = useCallback(() => {
    setVideoTitle("");
    setVideoCategory("tech");
    setThumbnailStyle("face-cam");
    setTextLength("short");
    setIncludeNumbers(true);
    setIncludeEmoji(false);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const ctrColor = (score: number): string => {
    if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ytt-video-title">Video title</Label>
            <Input
              id="ytt-video-title"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="How I Built a $1M App in 30 Days"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Video category</Label>
              <select
                value={videoCategory}
                onChange={(e) => setVideoCategory(e.target.value as VideoCategory)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {VIDEO_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Thumbnail style</Label>
              <select
                value={thumbnailStyle}
                onChange={(e) => setThumbnailStyle(e.target.value as ThumbnailStyle)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {THUMBNAIL_STYLES.map((s) => (
                  <option key={s} value={s}>{STYLE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Text length</Label>
              <select
                value={textLength}
                onChange={(e) => setTextLength(e.target.value as TextLength)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {TEXT_LENGTHS.map((l) => (
                  <option key={l} value={l}>{LENGTH_LABELS[l]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={includeNumbers} onChange={(e) => setIncludeNumbers(e.target.checked)} />
              Include numbers from title ($1M, 30 days, etc.)
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={includeEmoji} onChange={(e) => setIncludeEmoji(e.target.checked)} />
              Include emoji
            </label>
          </div>
        </CardContent>
      </Card>

      {variations.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FlaskConical className="h-4 w-4" /> {stats.totalVariations} variations · avg CTR score {stats.avgCtrScore}/100
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Variations" value={stats.totalVariations} />
                <Stat label="Avg text length" value={`${stats.avgTextLength} words`} />
                <Stat label="Avg font size" value={`${stats.avgFontSize}px`} />
                <Stat label="Avg CTR score" value={`${stats.avgCtrScore}/100`} highlight={stats.avgCtrScore >= 70 ? "good" : stats.avgCtrScore >= 50 ? "warn" : "bad"} />
              </div>
              {stats.abTestPair && (
                <div className="rounded border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5" />
                  <strong>A/B test suggestion:</strong> Test variation {stats.abTestPair[0]} vs variation {stats.abTestPair[1]} (top CTR scores)
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Youtube className="h-4 w-4" /> Thumbnail overlay variations
              </h3>
              <div className="space-y-3">
                {variations.map((v) => (
                  <div key={v.variation} className="rounded border bg-background p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">Variation {v.variation}</Badge>
                        {v.hasNumbers && <Badge variant="outline" className="text-[10px]">has numbers</Badge>}
                        {v.emoji && <Badge variant="outline" className="text-[10px]">{v.emoji}</Badge>}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        CTR: <span className={`font-semibold ${ctrColor(v.ctrScore)}`}>{v.ctrScore}/100</span>
                      </div>
                    </div>

                    {/* Thumbnail preview */}
                    <div
                      className="relative w-full h-32 rounded overflow-hidden border"
                      style={{ backgroundColor: v.color.hex.bg }}
                    >
                      <div
                        className="absolute font-bold leading-tight"
                        style={{
                          color: v.color.hex.text,
                          fontFamily: v.font.id === "impact" ? "Impact, sans-serif" : v.font.id === "bebas-neue" ? "'Bebas Neue', Impact, sans-serif" : v.font.id === "anton" ? "'Anton', Impact, sans-serif" : v.font.id === "oswald" ? "'Oswald', Impact, sans-serif" : "'Montserrat', Impact, sans-serif",
                          fontWeight: 900,
                          fontSize: `${Math.min(v.fontSize, 40)}px`,
                          ...(v.position.id === "top-left" && { top: "8px", left: "12px" }),
                          ...(v.position.id === "top-right" && { top: "8px", right: "12px" }),
                          ...(v.position.id === "bottom-center" && { bottom: "8px", left: "50%", transform: "translateX(-50%)" }),
                          ...(v.position.id === "center" && { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }),
                          ...(v.position.id === "left-center" && { top: "50%", left: "12px", transform: "translateY(-50%)" }),
                        }}
                      >
                        {v.text}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <div className="text-muted-foreground text-[10px] uppercase">Text</div>
                        <div className="font-mono text-foreground">{v.text}</div>
                        <div className="text-muted-foreground">{v.wordCount} words · {v.charCount} chars</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[10px] uppercase">Position</div>
                        <div className="text-foreground">{v.position.label}</div>
                        <div className="text-muted-foreground">{v.position.description}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[10px] uppercase">Font size</div>
                        <div className="text-foreground">{v.fontSize}px</div>
                        <div className="text-muted-foreground">{v.font.name}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[10px] uppercase">Color</div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-block w-3 h-3 rounded-sm border"
                            style={{ backgroundColor: v.color.hex.text }}
                          />
                          <span
                            className="inline-block w-3 h-3 rounded-sm border"
                            style={{ backgroundColor: v.color.hex.bg }}
                          />
                          <span className="text-foreground">{v.color.label}</span>
                        </div>
                        <div className="text-muted-foreground text-[10px]">{v.color.hex.text} / {v.color.hex.bg}</div>
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground pt-1 border-t">
                      <strong className="text-foreground">Why this position:</strong> {v.position.reasoning}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      <strong className="text-foreground">Font availability:</strong> {v.font.availability}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return variations[0].text; }}
                  label="Copy variation 1 text"
                />
                <CopyButton
                  getText={() => { handleSaveHistory(); return textReport; }}
                  label="Copy text report"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return textReport; }}
                  filename="thumbnail-overlay.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csvReport}
                  filename="thumbnail-overlay.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Palette className="h-4 w-4" /> Color combos ({COLOR_COMBOS.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {COLOR_COMBOS.map((c) => (
                  <div key={c.id} className="rounded border bg-background p-2 text-xs">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="inline-block w-4 h-4 rounded-sm border" style={{ backgroundColor: c.hex.text }} />
                      <span className="inline-block w-4 h-4 rounded-sm border" style={{ backgroundColor: c.hex.bg }} />
                      <span className="text-foreground">{c.label}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">{c.hex.text} / {c.hex.bg}</div>
                    <Badge variant={c.contrast === "high" ? "default" : "secondary"} className="text-[10px] mt-1">{c.contrast}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Type className="h-4 w-4" /> Recommended fonts ({FONTS.length})
              </h3>
              <div className="space-y-1">
                {FONTS.map((f) => (
                  <div key={f.id} className="rounded border bg-background px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{f.weight}</Badge>
                      <span className="font-medium text-foreground">{f.name}</span>
                    </div>
                    <div className="text-muted-foreground mt-1">{f.availability}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <MousePointerClick className="h-4 w-4" /> Position options ({POSITIONS.length})
              </h3>
              <div className="space-y-1">
                {POSITIONS.map((p) => (
                  <div key={p.id} className="rounded border bg-background px-3 py-2 text-xs">
                    <div className="font-medium text-foreground">{p.label}</div>
                    <div className="text-muted-foreground">{p.description}</div>
                    <div className="text-muted-foreground mt-1"><strong className="text-foreground">Reasoning:</strong> {p.reasoning}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a video title to generate thumbnail text overlays"
          hint="The tool extracts keywords and numbers from your title, suggests text (1-7 words), picks a position, calculates font size, recommends a high-contrast color combo, and chooses a bold display font. Three variations are generated with a CTR predictor score."
          icon={<Youtube className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{CATEGORY_LABELS[h.videoCategory]}</Badge>
                  <Badge variant="outline" className="mr-2">{STYLE_LABELS[h.thumbnailStyle]}</Badge>
                  <Badge variant="outline" className="mr-2">{LENGTH_LABELS[h.textLength]}</Badge>
                  <span className="text-muted-foreground">{h.videoTitle}</span>
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
            <strong className="text-foreground">Privacy:</strong> All overlay generation runs locally in your browser. Your video title never leaves this device. History is stored in localStorage on this device only.
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
  highlight?: "good" | "warn" | "bad";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "warn"
      ? "text-amber-600 dark:text-amber-400"
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
