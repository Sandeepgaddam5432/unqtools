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
  RunButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  DECK_TYPE_LABELS,
  SLIDE_COUNT_LABELS,
  SLIDE_COUNT_VALUES,
  TONE_LABELS,
  VISUAL_LABELS,
  SAMPLE_TOPICS,
  AUDIENCE_PRESETS,
  normalizeText,
  detectDeckType,
  suggestFramework,
  suggestTone,
  suggestAngles,
  formatTime,
  generatePresentation,
  reorderSlides,
  expandSlide,
  regenerateSlide,
  chooseThesis,
  computeStats,
  renderText,
  renderMarkdown,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type DeckType,
  type Tone,
  type SlideCountPreset,
  type Presentation,
  type Slide,
  type HistoryEntry,
} from "./logic";
import {
  Presentation as PresentationIcon, History, Sparkles, ArrowUp, ArrowDown,
  Plus, Lightbulb, RefreshCw, Clock, Image,
} from "lucide-react";

export default function AiPresentationOutlineGenerator() {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("");
  const [deckType, setDeckType] = useState<DeckType>("conference");
  const [tone, setTone] = useState<Tone>("conversational");
  const [preset, setPreset] = useState<SlideCountPreset>("standard");
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [thesisIdx, setThesisIdx] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const s = parseShareUrl(window.location.hash);
      if (s.topic) {
        setTopic(s.topic);
        setAudience(s.audience);
        setGoal(s.goal);
        setDeckType(s.deckType);
        setTone(s.tone);
        setPreset(s.preset);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const detectedType = useMemo(
    () => (goal ? detectDeckType(goal) : null),
    [goal],
  );
  const angles = useMemo(
    () => (topic ? suggestAngles(topic) : []),
    [topic],
  );

  const slideCount = SLIDE_COUNT_VALUES[preset];

  const handleGenerate = useCallback(() => {
    const t = normalizeText(topic);
    if (!t) {
      toast.error("Enter a topic first");
      return;
    }
    const p = generatePresentation(t, audience, goal, deckType, tone, slideCount);
    setPresentation(p);
    setThesisIdx(0);
    saveHistory({
      ts: Date.now(),
      topic: t,
      audience,
      deckType,
      slideCount: p.slideCount,
      totalSeconds: p.totalSeconds,
      thesis: p.chosenThesis,
    });
    setHistory(loadHistory());
    toast.success(
      `Generated ${DECK_TYPE_LABELS[deckType].split(" ")[0]} deck with ${p.slides.length} slides (~${formatTime(p.totalSeconds)})`,
    );
  }, [topic, audience, goal, deckType, tone, slideCount]);

  const handleClear = useCallback(() => {
    setTopic("");
    setAudience("");
    setGoal("");
    setPresentation(null);
    setThesisIdx(0);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const stats = useMemo(
    () => (presentation ? computeStats(presentation) : null),
    [presentation],
  );

  const cycleThesis = useCallback(() => {
    if (!presentation || presentation.thesisVariants.length <= 1) return;
    const nextIdx = (thesisIdx + 1) % presentation.thesisVariants.length;
    setThesisIdx(nextIdx);
    setPresentation((prev) => (prev ? chooseThesis(prev, nextIdx) : prev));
  }, [presentation, thesisIdx]);

  const moveSlide = useCallback((id: string, dir: -1 | 1) => {
    setPresentation((prev) => {
      if (!prev) return prev;
      const ids = prev.slides.map((s) => s.id);
      const i = ids.indexOf(id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= ids.length) return prev;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      return reorderSlides(prev, ids);
    });
  }, []);

  const handleExpand = useCallback((id: string) => {
    setPresentation((prev) => (prev ? expandSlide(prev, id) : prev));
    toast.info("Slide expanded");
  }, []);

  const handleRegenerate = useCallback((id: string) => {
    setPresentation((prev) => (prev ? regenerateSlide(prev, id) : prev));
    toast.info("Slide regenerated");
  }, []);

  const handleAutoDetect = useCallback(() => {
    if (!goal) return;
    const detected = detectDeckType(goal);
    setDeckType(detected);
    setTone(suggestTone(detected));
    toast.success(`Auto-detected: ${DECK_TYPE_LABELS[detected].split(" ")[0]}`);
  }, [goal]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="apog-topic">Topic</Label>
            <Textarea
              id="apog-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. How our SaaS cut churn 32% in two quarters"
              className="min-h-[60px] resize-y"
            />
            {angles.length > 0 && (
              <div className="pt-1 space-y-1">
                <div className="text-[11px] text-muted-foreground">Suggested angles (click to use):</div>
                <div className="flex flex-wrap gap-1">
                  {angles.slice(0, 3).map((a) => (
                    <Button
                      key={a}
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] max-w-full"
                      onClick={() => setTopic(a)}
                    >
                      <span className="truncate">{a}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-1 pt-1">
              {SAMPLE_TOPICS.slice(0, 6).map((t) => (
                <Button
                  key={t}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setTopic(t)}
                >{t.length > 36 ? t.slice(0, 36) + "…" : t}</Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="apog-audience" className="text-xs">Audience</Label>
              <Input
                id="apog-audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. Executives, Engineering team"
                className="h-9 text-xs"
              />
              <div className="flex flex-wrap gap-1 pt-0.5">
                {AUDIENCE_PRESETS.slice(0, 5).map((a) => (
                  <Button
                    key={a}
                    variant="ghost"
                    size="sm"
                    className="h-5 text-[10px] px-2"
                    onClick={() => setAudience(a)}
                  >+ {a}</Button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="apog-goal" className="text-xs">Goal / desired outcome</Label>
              <Input
                id="apog-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Close the deal, raise the round"
                className="h-9 text-xs"
              />
              {detectedType && detectedType !== deckType && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" />
                  Detected type:
                  <button
                    className="underline text-primary"
                    onClick={handleAutoDetect}
                  >{DECK_TYPE_LABELS[detectedType]}</button>
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Deck type</Label>
              <select
                value={deckType}
                onChange={(e) => setDeckType(e.target.value as DeckType)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(DECK_TYPE_LABELS) as DeckType[]).map((t) => (
                  <option key={t} value={t}>{DECK_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tone</Label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
                  <option key={t} value={t}>{TONE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Length</Label>
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value as SlideCountPreset)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(SLIDE_COUNT_LABELS) as SlideCountPreset[]).map((p) => (
                  <option key={p} value={p}>{SLIDE_COUNT_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleGenerate} label={`Generate ${slideCount}-slide deck`} />
            <ClearButton onClick={handleClear} />
            <ShareButton
              getUrl={() => buildShareUrl({ topic, audience, goal, deckType, tone, preset })}
            />
          </div>
        </CardContent>
      </Card>

      {presentation && stats ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <Stat label="Slides" value={stats.totalSlides} />
                <Stat label="Bullets" value={stats.totalBullets} />
                <Stat label="Time" value={formatTime(stats.totalSeconds)} />
                <Stat label="Type" value={stats.deckTypeLabel.split(" ")[0]} />
                <Stat label="Framework" value={presentation.framework} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Presentation thesis</div>
                  {presentation.thesisVariants.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cycleThesis}
                      className="gap-1 text-[11px] h-6"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Variant {thesisIdx + 1}/{presentation.thesisVariants.length}
                    </Button>
                  )}
                </div>
                <p className="text-sm italic text-foreground border-l-2 border-primary pl-3">
                  {presentation.chosenThesis}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <PresentationIcon className="h-4 w-4" />
                  Slides ({presentation.slides.length}) · ~{formatTime(presentation.totalSeconds)}
                </h3>
              </div>
              <div className="space-y-3">
                {presentation.slides.map((s, i) => (
                  <SlideCard
                    key={s.id}
                    slide={s}
                    index={i}
                    total={presentation.slides.length}
                    onMoveUp={() => moveSlide(s.id, -1)}
                    onMoveDown={() => moveSlide(s.id, 1)}
                    onExpand={() => handleExpand(s.id)}
                    onRegenerate={() => handleRegenerate(s.id)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => renderText(presentation)} label="Copy outline" />
                <DownloadButton
                  getText={() => renderMarkdown(presentation)}
                  filename="presentation-outline.md"
                  mime="text/markdown"
                  label="Download .md"
                />
                <DownloadButton
                  getText={() => renderText(presentation)}
                  filename="presentation-outline.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => renderJson(presentation)}
                  filename="presentation-outline.json"
                  mime="application/json"
                  label="Download .json"
                />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a topic and click Generate"
          hint="Pick a deck type, audience, and length, then generate a slide-by-slide outline with titles, bullets, speaker notes, and visual suggestions. Export to Markdown, plain text, or JSON for any deck tool."
          icon={<Sparkles className="h-8 w-8" />}
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
                <button
                  key={i}
                  onClick={() => {
                    setTopic(h.topic);
                    setAudience(h.audience);
                    setDeckType(h.deckType);
                    setTone(suggestTone(h.deckType));
                    const p = generatePresentation(
                      h.topic, h.audience, "", h.deckType,
                      suggestTone(h.deckType), h.slideCount,
                    );
                    setPresentation(p);
                    setThesisIdx(0);
                  }}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">
                    {DECK_TYPE_LABELS[h.deckType].split(" ")[0]}
                  </Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">
                    {h.slideCount} slides
                  </Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">
                    {formatTime(h.totalSeconds)}
                  </Badge>
                  <span className="text-muted-foreground">
                    {h.topic.slice(0, 60)}{h.topic.length > 60 ? "…" : ""}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    · {new Date(h.ts).toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Honesty:</strong> Visuals are
            suggestions only — we do not generate images. Speaker notes are
            scaffolds to edit before presenting. All generation runs locally;
            nothing is uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SlideCard({
  slide,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onExpand,
  onRegenerate,
}: {
  slide: Slide;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onExpand: () => void;
  onRegenerate: () => void;
}) {
  const visualColor: Record<string, string> = {
    chart: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    diagram: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
    photo: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    screenshot: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    quote: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    statistic: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    video: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
    logo: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  };
  return (
    <div className="rounded border bg-background p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] capitalize">
              {slide.type.replace(/-/g, " ")}
            </Badge>
            <span className="text-sm font-medium text-foreground">
              {index + 1}. {slide.title}
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Clock className="h-3 w-3" /> ~{formatTime(slide.secondsEstimate)}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMoveUp}
            disabled={index === 0}
            title="Move up"
            className="h-6 w-6"
          >
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onMoveDown}
            disabled={index === total - 1}
            title="Move down"
            className="h-6 w-6"
          >
            <ArrowDown className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <ul className="text-xs text-muted-foreground space-y-0.5 pl-4 list-disc">
        {slide.bulletPoints.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>

      <div className="text-[11px] flex items-start gap-2 bg-muted/30 rounded px-2 py-1.5">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Notes</span>
        <span className="text-foreground/80">{slide.speakerNotes}</span>
      </div>

      <div className="text-[11px] flex items-center gap-2">
        <Badge
          variant="outline"
          className={`text-[9px] gap-0.5 ${visualColor[slide.visual.kind] ?? ""}`}
        >
          <Image className="h-2.5 w-2.5" />
          {VISUAL_LABELS[slide.visual.kind]}
        </Badge>
        <span className="text-muted-foreground">{slide.visual.text}</span>
      </div>

      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onExpand}
          className="text-[11px] h-6 gap-1"
        >
          <Plus className="h-3 w-3" /> Expand
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRegenerate}
          className="text-[11px] h-6 gap-1"
        >
          <RefreshCw className="h-3 w-3" /> Regenerate
        </Button>
      </div>
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
