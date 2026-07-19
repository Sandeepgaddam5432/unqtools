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
  RunButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  GENRE_LABELS,
  TONE_LABELS,
  POV_LABELS,
  LENGTH_LABELS,
  SAMPLE_PREMISES,
  normalizePremise,
  normalizeSetting,
  parseCharacters,
  detectGenre,
  generateStory,
  generateStoryBible,
  continueStory,
  regenerateSection,
  expandSection,
  computeStats,
  renderText,
  renderMarkdown,
  renderJson,
  renderBibleMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Genre,
  type Tone,
  type POV,
  type Length,
  type Story,
  type HistoryEntry,
} from "./logic";
import {
  BookOpen, History, Sparkles, Plus, RefreshCw, Lightbulb,
  Users, MapPin, Scroll, BookMarked,
} from "lucide-react";

type Tab = "story" | "bible";

export default function AiFictionStoryGenerator() {
  const [premise, setPremise] = useState("");
  const [genre, setGenre] = useState<Genre>("fantasy");
  const [tone, setTone] = useState<Tone>("neutral");
  const [pov, setPov] = useState<POV>("third-limited");
  const [length, setLength] = useState<Length>("short");
  const [setting, setSetting] = useState("");
  const [charactersText, setCharactersText] = useState("");
  const [story, setStory] = useState<Story | null>(null);
  const [tab, setTab] = useState<Tab>("story");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const s = parseShareUrl(window.location.hash);
      if (s.premise) {
        setPremise(s.premise);
        setGenre(s.genre);
        setTone(s.tone);
        setPov(s.pov);
        setLength(s.length);
        setSetting(s.setting);
        setCharactersText(s.charactersText);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const detectedGenre = useMemo(() => (premise ? detectGenre(premise) : null), [premise]);

  const handleGenerate = useCallback(() => {
    const p = normalizePremise(premise);
    if (!p) {
      toast.error("Enter a premise first");
      return;
    }
    const chars = parseCharacters(charactersText);
    const s = generateStory(p, genre, {
      tone, pov, length, setting: normalizeSetting(setting), characters: chars,
    });
    setStory(s);
    saveHistory({
      ts: Date.now(),
      title: s.title,
      premise: p,
      genre, tone, pov, length,
      wordCount: s.wordCount,
      sectionCount: s.sections.length,
    });
    setHistory(loadHistory());
    toast.success(`Generated "${s.title}" — ${s.wordCount} words across ${s.sections.length} sections`);
  }, [premise, genre, tone, pov, length, setting, charactersText]);

  const handleClear = useCallback(() => {
    setPremise("");
    setStory(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleContinue = useCallback((sectionId: string) => {
    setStory((prev) => (prev ? continueStory(prev, sectionId) : prev));
    toast.info("Continued");
  }, []);

  const handleExpand = useCallback((sectionId: string) => {
    setStory((prev) => (prev ? expandSection(prev, sectionId) : prev));
    toast.info("Expanded");
  }, []);

  const handleRegenerate = useCallback((sectionId: string) => {
    setStory((prev) => (prev ? regenerateSection(prev, sectionId) : prev));
    toast.info("Regenerated");
  }, []);

  const stats = useMemo(() => (story ? computeStats(story) : null), [story]);
  const bible = useMemo(() => (story ? generateStoryBible(story) : null), [story]);
  const markdown = useMemo(() => (story ? renderMarkdown(story) : ""), [story]);
  const text = useMemo(() => (story ? renderText(story) : ""), [story]);
  const jsonRaw = useMemo(() => (story ? renderJson(story) : ""), [story]);
  const bibleMd = useMemo(() => (bible ? renderBibleMarkdown(bible) : ""), [bible]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="afsg-premise">Premise <span className="text-muted-foreground">(1–2 sentences)</span></Label>
            <Textarea
              id="afsg-premise"
              value={premise}
              onChange={(e) => setPremise(e.target.value)}
              placeholder="e.g. An apprentice mage discovers an ancient spellbook that whispers back."
              className="min-h-[70px] resize-y"
            />
            {detectedGenre && detectedGenre !== genre && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Lightbulb className="h-3 w-3" />
                Detected genre: <button className="underline text-primary" onClick={() => setGenre(detectedGenre)}>{GENRE_LABELS[detectedGenre]}</button>
              </p>
            )}
            <div className="pt-1 space-y-1">
              <div className="text-[11px] text-muted-foreground">Sample premises (click to use):</div>
              <div className="flex flex-wrap gap-1">
                {(SAMPLE_PREMISES[genre] ?? []).map((p) => (
                  <Button
                    key={p}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] max-w-full"
                    onClick={() => setPremise(p)}
                    title={p}
                  >
                    <span className="truncate">{p.length > 40 ? p.slice(0, 40) + "…" : p}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Genre</Label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value as Genre)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(GENRE_LABELS) as Genre[]).map((g) => (
                  <option key={g} value={g}>{GENRE_LABELS[g]}</option>
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
              <Label className="text-xs">POV</Label>
              <select
                value={pov}
                onChange={(e) => setPov(e.target.value as POV)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(POV_LABELS) as POV[]).map((p) => (
                  <option key={p} value={p}>{POV_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Length</Label>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value as Length)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(LENGTH_LABELS) as Length[]).map((l) => (
                  <option key={l} value={l}>{LENGTH_LABELS[l]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="afsg-setting" className="text-xs flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Setting <span className="text-muted-foreground">(optional — auto-picked if blank)</span>
              </Label>
              <Textarea
                id="afsg-setting"
                value={setting}
                onChange={(e) => setSetting(e.target.value)}
                placeholder="e.g. the kingdom of Aerith"
                className="min-h-[40px] resize-y text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="afsg-chars" className="text-xs flex items-center gap-1">
                <Users className="h-3 w-3" /> Characters <span className="text-muted-foreground">(one per line: Name | role | description)</span>
              </Label>
              <Textarea
                id="afsg-chars"
                value={charactersText}
                onChange={(e) => setCharactersText(e.target.value)}
                placeholder={"Eira | protagonist | a hedge-witch\nBran | ally | a disgraced knight"}
                className="min-h-[40px] resize-y text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleGenerate} label="Generate story" />
            <ClearButton onClick={handleClear} />
            <ShareButton
              getUrl={() => buildShareUrl({ premise, genre, tone, pov, length, setting, charactersText })}
            />
          </div>
        </CardContent>
      </Card>

      {story && stats ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <BookOpen className="h-4 w-4 text-primary" />
                <h3 className="text-base font-semibold text-foreground">{story.title}</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px]">{stats.genreLabel}</Badge>
                <Badge variant="outline" className="text-[10px]">{stats.toneLabel}</Badge>
                <Badge variant="outline" className="text-[10px]">{stats.povLabel}</Badge>
                <Badge variant="outline" className="text-[10px]">{LENGTH_LABELS[story.length]}</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Sections" value={stats.totalSections} />
                <Stat label="Paragraphs" value={stats.totalParagraphs} />
                <Stat label="Words" value={stats.totalWords} />
                <Stat label="Characters" value={stats.totalCharacters} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <TabButton active={tab === "story"} onClick={() => setTab("story")} label="Story" icon={<Scroll className="h-3 w-3" />} />
                <TabButton active={tab === "bible"} onClick={() => setTab("bible")} label="Story Bible" icon={<BookMarked className="h-3 w-3" />} />
              </div>

              {tab === "story" ? (
                <div className="space-y-3">
                  {story.sections.map((s, i) => (
                    <SectionCard
                      key={s.id}
                      section={s}
                      index={i}
                      total={story.sections.length}
                      onContinue={() => handleContinue(s.id)}
                      onExpand={() => handleExpand(s.id)}
                      onRegenerate={() => handleRegenerate(s.id)}
                    />
                  ))}
                </div>
              ) : (
                <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono overflow-auto max-h-[500px] whitespace-pre-wrap break-words">
                  {bibleMd}
                </pre>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => (tab === "story" ? markdown : bibleMd)} label={tab === "story" ? "Copy story" : "Copy bible"} />
                {tab === "story" && (
                  <>
                    <DownloadButton
                      getText={() => markdown}
                      filename={`${story.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`}
                      mime="text/markdown"
                      label="Download .md"
                    />
                    <DownloadButton
                      getText={() => text}
                      filename={`${story.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`}
                      mime="text/plain"
                      label="Download .txt"
                    />
                    <DownloadButton
                      getText={() => jsonRaw}
                      filename={`${story.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`}
                      mime="application/json"
                      label="Download .json"
                    />
                  </>
                )}
                {tab === "bible" && (
                  <DownloadButton
                    getText={() => bibleMd}
                    filename="story-bible.md"
                    mime="text/markdown"
                    label="Download bible .md"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a premise and click Generate story"
          hint="Pick a genre, tone, POV, and length, then generate a six-stage plot arc (setup → inciting → rising → climax → falling → resolution). Optional characters and setting are woven into the prose. A story-bible is auto-generated for consistency. Expand, regenerate, or continue any section."
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
                    setPremise(h.premise);
                    setGenre(h.genre);
                    setTone(h.tone);
                    setPov(h.pov);
                    setLength(h.length);
                    const s = generateStory(h.premise, h.genre, { tone: h.tone, pov: h.pov, length: h.length });
                    setStory(s);
                    toast.info("Regenerated from history");
                  }}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">{GENRE_LABELS[h.genre].split(" ")[0]}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.wordCount}w</Badge>
                  <span className="text-foreground font-medium">{h.title}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Honesty:</strong> On-device templates produce coherent but formulaic prose — long-form fiction benefits from a stronger LLM via "Enhance with LLM" (BYO key). Stories drift over long outputs; the story-bible mitigates but review is needed. Content is fiction and yours; nothing is uploaded or logged.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SectionCard({
  section,
  index,
  total,
  onContinue,
  onExpand,
  onRegenerate,
}: {
  section: { id: string; stage: string; heading: string; paragraphs: string[]; wordEstimate: number };
  index: number;
  total: number;
  onContinue: () => void;
  onExpand: () => void;
  onRegenerate: () => void;
}) {
  const stageColors: Record<string, string> = {
    setup: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    inciting: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    rising: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    climax: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    falling: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    resolution: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  };
  const color = stageColors[section.stage] ?? "bg-muted";
  return (
    <div className="rounded border bg-background p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-[10px] capitalize ${color}`}>{section.heading}</Badge>
          <span className="text-[10px] text-muted-foreground">~{section.wordEstimate} words · {section.paragraphs.length} paragraph(s)</span>
          <span className="text-[10px] text-muted-foreground">· {index + 1}/{total}</span>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onContinue} className="text-[11px] h-7 gap-1">
            <Plus className="h-3 w-3" /> Continue
          </Button>
          <Button variant="ghost" size="sm" onClick={onExpand} className="text-[11px] h-7 gap-1">
            <Plus className="h-3 w-3" /> Expand
          </Button>
          <Button variant="ghost" size="sm" onClick={onRegenerate} className="text-[11px] h-7 gap-1">
            <RefreshCw className="h-3 w-3" /> Regenerate
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        {section.paragraphs.map((p, i) => (
          <p key={i} className="text-sm text-foreground leading-relaxed">{p}</p>
        ))}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon?: React.ReactNode }) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className="text-[11px] h-7 gap-1"
    >
      {icon}
      {label}
    </Button>
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
