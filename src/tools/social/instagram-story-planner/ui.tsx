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
  STORY_TYPES,
  STORY_TYPE_LABELS,
  TONES,
  TONE_LABELS,
  STICKER_LABELS,
  buildStory,
  buildAltVariations,
  computeSummaryStats,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type StoryType,
  type Tone,
  type StoryInput,
  type HistoryEntry,
  type StickerType,
} from "./logic";
import {
  History, Instagram, Clock, Music, Sparkles, AlertTriangle, CheckCircle2, Layers, Tag,
} from "lucide-react";

export default function InstagramStoryPlanner() {
  const [storyTopic, setStoryTopic] = useState("");
  const [slideCount, setSlideCount] = useState(7);
  const [storyType, setStoryType] = useState<StoryType>("announcement");
  const [includePolls, setIncludePolls] = useState(true);
  const [includeQuestions, setIncludeQuestions] = useState(false);
  const [includeLinks, setIncludeLinks] = useState(false);
  const [tone, setTone] = useState<Tone>("casual");
  const [showVariations, setShowVariations] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setStoryTopic(p.storyTopic);
      setSlideCount(p.slideCount);
      setStoryType(p.storyType);
      setTone(p.tone);
      setIncludePolls(p.includePolls);
      setIncludeQuestions(p.includeQuestions);
      setIncludeLinks(p.includeLinks);
      if (p.storyTopic) toast.info("Loaded from share link");
    }
  }, []);

  const input: StoryInput = useMemo(
    () => ({
      storyTopic,
      slideCount,
      storyType,
      includePolls,
      includeQuestions,
      includeLinks,
      tone,
    }),
    [storyTopic, slideCount, storyType, includePolls, includeQuestions, includeLinks, tone],
  );

  const result = useMemo(() => buildStory(input), [input]);
  const stats = useMemo(() => computeSummaryStats(result), [result]);
  const textReport = useMemo(() => renderText(result), [result]);
  const csv = useMemo(() => renderCsv(result), [result]);
  const variations = useMemo(
    () => (showVariations && storyTopic.trim() ? buildAltVariations(input) : []),
    [showVariations, storyTopic, input],
  );

  const handleSaveHistory = useCallback(() => {
    if (result.slides.length > 0) {
      saveHistory({
        ts: Date.now(),
        topic: storyTopic,
        storyType,
        tone,
        slideCount: result.slides.length,
        totalDurationSec: result.totalDurationSec,
      });
      setHistory(loadHistory());
    }
  }, [result, storyTopic, storyType, tone]);

  const handleClear = useCallback(() => {
    setStoryTopic("");
    setSlideCount(7);
    setStoryType("announcement");
    setIncludePolls(true);
    setIncludeQuestions(false);
    setIncludeLinks(false);
    setTone("casual");
    setShowVariations(false);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const hasTopic = storyTopic.trim().length > 0;
  const totalStickers = Object.values(stats.bySticker).reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="isp-topic">Story topic</Label>
            <Input
              id="isp-topic"
              value={storyTopic}
              onChange={(e) => setStoryTopic(e.target.value)}
              placeholder="e.g. our new product launch, behind the scenes of the photoshoot"
              className="text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Story type</Label>
              <select
                value={storyType}
                onChange={(e) => setStoryType(e.target.value as StoryType)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {STORY_TYPES.map((t) => (
                  <option key={t} value={t}>{STORY_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tone</Label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>{TONE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Slide count: {slideCount}</Label>
              <input
                type="range"
                min={3}
                max={15}
                value={slideCount}
                onChange={(e) => setSlideCount(parseInt(e.target.value, 10))}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={includePolls} onChange={(e) => setIncludePolls(e.target.checked)} />
              Poll slides
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={includeQuestions} onChange={(e) => setIncludeQuestions(e.target.checked)} />
              Question stickers
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={includeLinks} onChange={(e) => setIncludeLinks(e.target.checked)} />
              Link stickers <span className="text-muted-foreground">(10K+ followers)</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {hasTopic && result.slides.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Instagram className="h-4 w-4" /> {result.slides.length} slides · {STORY_TYPE_LABELS[storyType]} · {TONE_LABELS[tone]}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total slides" value={stats.totalSlides} />
                <Stat label="Total duration" value={`${stats.totalDurationSec}s`} />
                <Stat label="Avg / slide" value={`${stats.avgDurationSec}s`} />
                <Stat label="Stickers" value={totalStickers} />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {stats.hasHook && <Badge variant="outline" className="text-[10px]"><Sparkles className="h-3 w-3 mr-1" />Hook</Badge>}
                {stats.hasCTA && <Badge variant="outline" className="text-[10px]">CTA</Badge>}
                {stats.flowOk
                  ? <Badge variant="outline" className="text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Flow OK</Badge>
                  : <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Flow issue</Badge>}
              </div>
              <div className="rounded border bg-muted/30 px-3 py-2 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Music className="h-3 w-3" /> Music suggestion
                </div>
                <div className="text-foreground font-medium">{result.musicSuggestion}</div>
              </div>
              <div className="rounded border bg-muted/30 px-3 py-2 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Tag className="h-3 w-3" /> Sticker breakdown
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(stats.bySticker) as StickerType[]).map((s) => (
                    stats.bySticker[s] > 0
                      ? <Badge key={s} variant="secondary" className="text-[10px]">{STICKER_LABELS[s]}: {stats.bySticker[s]}</Badge>
                      : null
                  ))}
                  {totalStickers === 0 && <span className="text-muted-foreground">No stickers (enable poll/question/link)</span>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="h-4 w-4" /> Storyboard
                </h3>
                <Button
                  variant={showVariations ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowVariations((s) => !s)}
                >
                  {showVariations ? "Hide variations" : "Generate 2 variations"}
                </Button>
              </div>
              <div className="space-y-2">
                {result.slides.map((s) => (
                  <div key={s.num} className="rounded border bg-background p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2 pb-2">
                      <Badge variant="secondary" className="text-[10px]">#{s.num}</Badge>
                      <Badge variant="outline" className="text-[10px] uppercase">{s.type}</Badge>
                      {s.isHook && <Badge variant="outline" className="text-[10px]"><Sparkles className="h-3 w-3 mr-1" />Hook</Badge>}
                      {s.isCTA && <Badge variant="outline" className="text-[10px]">CTA</Badge>}
                      <Badge variant="outline" className="text-[10px]">
                        <Clock className="h-3 w-3 mr-1" />{s.durationSec}s
                      </Badge>
                      {s.stickers.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {s.stickers.map((st, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px]">{STICKER_LABELS[st]}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-foreground text-sm leading-relaxed">{s.textOverlay}</pre>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <CopyButton getText={() => { handleSaveHistory(); return s.textOverlay; }} label={`Copy slide ${s.num}`} />
                    </div>
                  </div>
                ))}
              </div>

              {showVariations && variations.length > 0 && (
                <div className="space-y-3 pt-2 border-t">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Alt-variations (different tones + slide counts)</div>
                  {variations.map((v, i) => (
                    <div key={i} className="rounded border bg-muted/30 p-3 space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="secondary">V{i + 1}</Badge>
                        <Badge variant="outline">{TONE_LABELS[v.tone]}</Badge>
                        <Badge variant="outline">{v.slides.length} slides</Badge>
                        <Badge variant="outline">{v.totalDurationSec}s</Badge>
                      </div>
                      <div className="space-y-1">
                        {v.slides.map((s) => (
                          <div key={s.num} className="text-xs text-foreground/90">
                            <span className="text-muted-foreground">[{s.num}] {s.type}</span>
                            {" — "}
                            {s.textOverlay}
                            <span className="text-muted-foreground"> ({s.durationSec}s)</span>
                          </div>
                        ))}
                      </div>
                      <CopyButton getText={() => renderText(v)} label={`Copy variation ${i + 1}`} />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => { handleSaveHistory(); return textReport; }} label="Copy storyboard" />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return textReport; }}
                  filename="instagram-story.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="instagram-story.csv"
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
          title="Enter a topic to plan your Instagram story"
          hint="Pick a story type (announcement, tutorial, BTS, Q&A, poll, list, story-time) and tone. The tool builds a slide-by-slide storyboard with text overlays, stickers, and durations."
          icon={<Instagram className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{STORY_TYPE_LABELS[h.storyType]}</Badge>
                  <Badge variant="outline" className="mr-2">{TONE_LABELS[h.tone]}</Badge>
                  <Badge variant="outline" className="mr-2">{h.slideCount} slides</Badge>
                  <Badge variant="outline" className="mr-2">{h.totalDurationSec}s</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All story planning runs locally in your browser. Your topic never leaves this device. History is stored in localStorage on this device only.
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
