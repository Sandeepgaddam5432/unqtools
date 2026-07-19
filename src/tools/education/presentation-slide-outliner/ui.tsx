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
  AUDIENCE_LEVELS,
  AUDIENCE_LABELS,
  AUDIENCE_STYLES,
  PRESENTATION_TYPE_PRESETS,
  MAX_BULLETS_PER_SLIDE,
  MAX_TITLE_LENGTH,
  DEFAULT_SLIDES_PER_MINUTE,
  buildSlides,
  validatePresentation,
  computeStats,
  renderText,
  renderHtml,
  renderMarkdown,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type AudienceLevel,
  type PresentationInput,
  type HistoryEntry,
} from "./logic";
import { Presentation, History, AlertTriangle, Clock, Users } from "lucide-react";

type ExportFormat = "text" | "html" | "markdown" | "csv";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  text: "Text",
  html: "HTML",
  markdown: "Markdown",
  csv: "CSV",
};

const DEFAULT_INPUT: PresentationInput = {
  presentationTitle: "",
  presenterName: "",
  audienceLevel: "college",
  presentationDuration: 30,
  topicOutline: "",
  includeTitleSlide: true,
  includeAgendaSlide: true,
  includeQASlide: true,
  includeSummarySlide: true,
  slidesPerMinute: DEFAULT_SLIDES_PER_MINUTE,
};

export default function PresentationSlideOutliner() {
  const [input, setInput] = useState<PresentationInput>(DEFAULT_INPUT);
  const [format, setFormat] = useState<ExportFormat>("text");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (Object.keys(parsed).length > 0) {
        setInput((prev) => ({ ...prev, ...parsed }));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const slides = useMemo(() => buildSlides(input), [input]);
  const issues = useMemo(() => validatePresentation(slides), [slides]);
  const stats = useMemo(() => computeStats(slides, input.presentationDuration), [slides, input.presentationDuration]);

  const rendered = useMemo(() => {
    switch (format) {
      case "html": return renderHtml(slides, input);
      case "markdown": return renderMarkdown(slides, input);
      case "csv": return renderCsv(slides);
      default: return renderText(slides, input);
    }
  }, [format, slides, input]);

  const setField = useCallback(<K extends keyof PresentationInput>(key: K, value: PresentationInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }));
  }, []);

  const applyPreset = useCallback((presetType: string) => {
    const preset = PRESENTATION_TYPE_PRESETS.find((p) => p.type === presetType);
    if (!preset) return;
    setInput((prev) => ({ ...prev, ...preset.defaults }));
    toast.info(`Applied ${preset.label} preset`);
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (slides.length > 0) {
      saveHistory({
        ts: Date.now(),
        presentationTitle: input.presentationTitle || "Untitled",
        audienceLevel: input.audienceLevel,
        slideCount: slides.length,
        durationMinutes: input.presentationDuration,
      });
      setHistory(loadHistory());
    }
  }, [slides.length, input.presentationTitle, input.audienceLevel, input.presentationDuration]);

  const handleClear = useCallback(() => {
    setInput(DEFAULT_INPUT);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const ext = format === "markdown" ? "md" : format === "html" ? "html" : format === "csv" ? "csv" : "txt";
  const mime = format === "html" ? "text/html" : format === "csv" ? "text/csv" : format === "markdown" ? "text/markdown" : "text/plain";

  const audienceStyle = AUDIENCE_STYLES[input.audienceLevel];

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label htmlFor="pso-title" className="text-xs">Presentation title</Label>
              <Input
                id="pso-title"
                value={input.presentationTitle}
                onChange={(e) => setField("presentationTitle", e.target.value)}
                placeholder="e.g. Introduction to Photosynthesis"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="pso-presenter" className="text-xs">Presenter name</Label>
              <Input
                id="pso-presenter"
                value={input.presenterName}
                onChange={(e) => setField("presenterName", e.target.value)}
                placeholder="e.g. Dr. Jane Smith"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <Label htmlFor="pso-audience" className="text-xs">Audience level</Label>
              <select
                id="pso-audience"
                value={input.audienceLevel}
                onChange={(e) => setField("audienceLevel", e.target.value as AudienceLevel)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {AUDIENCE_LEVELS.map((l) => (
                  <option key={l} value={l}>{AUDIENCE_LABELS[l]}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="pso-duration" className="text-xs">Duration (minutes)</Label>
              <Input
                id="pso-duration"
                type="number"
                min={1}
                value={input.presentationDuration}
                onChange={(e) => setField("presentationDuration", Number(e.target.value) || 0)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="pso-spm" className="text-xs">Slides per minute</Label>
              <Input
                id="pso-spm"
                type="number"
                min={0.1}
                step={0.1}
                value={input.slidesPerMinute}
                onChange={(e) => setField("slidesPerMinute", Number(e.target.value) || 0)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pso-outline" className="text-xs">Topic outline — one section per line: <code className="font-mono">section_title|key_points</code> (key points semicolon-separated)</Label>
            <Textarea
              id="pso-outline"
              value={input.topicOutline}
              onChange={(e) => setField("topicOutline", e.target.value)}
              placeholder={"Introduction|What is X; Why it matters\nCore Concepts|Definition; Key principles; Examples\nAdvanced Topics|Edge cases; Best practices\nConclusion|Summary; Next steps"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={input.includeTitleSlide} onChange={(e) => setField("includeTitleSlide", e.target.checked)} />
              Title slide
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={input.includeAgendaSlide} onChange={(e) => setField("includeAgendaSlide", e.target.checked)} />
              Agenda slide
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={input.includeSummarySlide} onChange={(e) => setField("includeSummarySlide", e.target.checked)} />
              Summary slide
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={input.includeQASlide} onChange={(e) => setField("includeQASlide", e.target.checked)} />
              Q&A slide
            </label>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Presentation type presets:</Label>
            <div className="flex flex-wrap gap-1">
              {PRESENTATION_TYPE_PRESETS.map((p) => (
                <Button
                  key={p.type}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  title={p.description}
                  onClick={() => applyPreset(p.type)}
                >+ {p.label}</Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {slides.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Presentation className="h-4 w-4" /> {stats.totalSlides} slides · {stats.totalTimeMinutes} min
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total slides" value={stats.totalSlides} />
                <Stat label="Content slides" value={stats.totalContentSlides} />
                <Stat label="Unique sections" value={stats.totalSections} />
                <Stat label="Avg min/slide" value={stats.avgTimePerSlide.toFixed(1)} />
              </div>
              <div className="space-y-1.5">
                <div className="text-[11px] text-muted-foreground">Breakdown by kind:</div>
                <div className="flex flex-wrap gap-1.5">
                  {(["title", "agenda", "content", "summary", "qa"] as const).map((k) => (
                    <Badge key={k} variant="outline" className="text-[10px]">
                      {k}: {stats.byKind[k]}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="rounded border bg-muted/30 p-2 text-[11px] space-y-1">
                <div className="font-medium text-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" /> {AUDIENCE_LABELS[input.audienceLevel]} style
                </div>
                <div className="text-muted-foreground"><strong>Bullets:</strong> {audienceStyle.bulletTone}</div>
                <div className="text-muted-foreground"><strong>Notes:</strong> {audienceStyle.noteTone}</div>
                <div className="text-muted-foreground"><strong>Visuals:</strong> {audienceStyle.visualPreference}</div>
                <div className="text-muted-foreground"><strong>Max bullets per slide:</strong> {audienceStyle.maxBullets}</div>
              </div>
              {issues.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> {issues.length} validation issue(s)
                  </div>
                  <div className="max-h-24 overflow-auto">
                    {issues.slice(0, 10).map((iss, i) => (
                      <div key={i} className="text-[11px] text-amber-700 dark:text-amber-300 font-mono pl-2">
                        {iss.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Presentation className="h-4 w-4" /> Slide outline ({slides.length})
                </h3>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Format:</Label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as ExportFormat)}
                    className="h-8 text-xs rounded border bg-background px-2"
                  >
                    {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((f) => (
                      <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {format === "text" && (
                <div className="space-y-2 max-h-[500px] overflow-auto">
                  {slides.map((s) => (
                    <div key={s.index} className="rounded border bg-background px-3 py-2">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="text-xs font-medium text-foreground">
                          <span className="text-muted-foreground mr-1">#{s.index}</span>
                          {s.title}
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[9px]">{s.kind}</Badge>
                          <Badge variant="secondary" className="text-[9px]">
                            <Clock className="h-2.5 w-2.5 mr-0.5" /> {s.timeMinutes.toFixed(1)}m
                          </Badge>
                        </div>
                      </div>
                      {s.bullets.length > 0 && (
                        <ul className="text-[11px] text-muted-foreground ml-4 list-disc space-y-0.5">
                          {s.bullets.map((b, i) => <li key={i}>{b}</li>)}
                        </ul>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-1 italic">
                        <strong>Notes:</strong> {s.speakerNotes}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        <strong>Visual:</strong> {s.visualSuggestion}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {format !== "text" && (
                <pre className="text-[11px] font-mono whitespace-pre-wrap break-words max-h-[500px] overflow-auto bg-muted/30 p-3 rounded border">
                  {rendered}
                </pre>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return rendered; }}
                  label={`Copy ${FORMAT_LABELS[format]}`}
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return rendered; }}
                  filename={`presentation.${ext}`}
                  mime={mime}
                  label={`Download .${ext}`}
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a presentation title and topic outline"
          hint="Set duration + audience level. The tool auto-calculates the slide count and generates bullets, speaker notes, and visual suggestions per slide."
          icon={<Presentation className="h-8 w-8" />}
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{h.presentationTitle}</span>
                    <Badge variant="outline" className="text-[10px]">{AUDIENCE_LABELS[h.audienceLevel]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.slideCount} slides</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.durationMinutes} min</Badge>
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
            <strong className="text-foreground">Privacy:</strong> 100% client-side. All outline generation runs in your browser. History is stored in localStorage on this device only.
            <span className="ml-1 text-muted-foreground/70">Rules: max {MAX_BULLETS_PER_SLIDE} bullets/slide, max {MAX_TITLE_LENGTH} chars/title.</span>
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
