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
  TYPE_LABELS,
  LENGTH_LABELS,
  COMPARE_STRUCTURE_LABELS,
  SAMPLE_TOPICS,
  normalizeTopic,
  detectEssayType,
  suggestAngles,
  generateOutline,
  generateHook,
  reorderSections,
  expandSection,
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
  type EssayType,
  type EssayLength,
  type CompareStructure,
  type Outline,
  type OutlineSection,
  type HistoryEntry,
} from "./logic";
import {
  FileText, History, Sparkles, ArrowUp, ArrowDown, Plus,
  Lightbulb, RefreshCw,
} from "lucide-react";

export default function AiEssayOutlineGenerator() {
  const [topic, setTopic] = useState("");
  const [type, setType] = useState<EssayType>("argumentative");
  const [length, setLength] = useState<EssayLength>("standard");
  const [compareStructure, setCompareStructure] = useState<CompareStructure>("point-by-point");
  const [outline, setOutline] = useState<Outline | null>(null);
  const [thesisIdx, setThesisIdx] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const s = parseShareUrl(window.location.hash);
      if (s.topic) {
        setTopic(s.topic);
        setType(s.type);
        setLength(s.length);
        if (s.compareStructure) setCompareStructure(s.compareStructure);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const detectedType = useMemo(() => (topic ? detectEssayType(topic) : null), [topic]);
  const angles = useMemo(() => (topic && topic.length > 0 ? suggestAngles(topic) : []), [topic]);

  const handleGenerate = useCallback(() => {
    const t = normalizeTopic(topic);
    if (!t) {
      toast.error("Enter a topic first");
      return;
    }
    const o = generateOutline(t, type, length, type === "compare-contrast" ? compareStructure : undefined);
    setOutline(o);
    setThesisIdx(0);
    saveHistory({
      ts: Date.now(),
      topic: t,
      type,
      length,
      thesis: o.chosenThesis,
      sectionCount: o.sections.length,
      wordCount: o.wordCount,
    });
    setHistory(loadHistory());
    toast.success(`Generated ${TYPE_LABELS[type]} outline with ${o.sections.length} sections`);
  }, [topic, type, length, compareStructure]);

  const handleClear = useCallback(() => {
    setTopic("");
    setOutline(null);
    setThesisIdx(0);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const stats = useMemo(() => (outline ? computeStats(outline) : null), [outline]);

  const cycleThesis = useCallback(() => {
    if (!outline || outline.thesisVariants.length <= 1) return;
    const nextIdx = (thesisIdx + 1) % outline.thesisVariants.length;
    setThesisIdx(nextIdx);
    setOutline((prev) => (prev ? chooseThesis(prev, nextIdx) : prev));
  }, [outline, thesisIdx]);

  const moveSection = useCallback((id: string, dir: -1 | 1) => {
    setOutline((prev) => {
      if (!prev) return prev;
      const ids = prev.sections.map((s) => s.id);
      const i = ids.indexOf(id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= ids.length) return prev;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      return reorderSections(prev, ids);
    });
  }, []);

  const handleExpand = useCallback((id: string) => {
    setOutline((prev) => (prev ? expandSection(prev, id) : prev));
    toast.info("Section expanded");
  }, []);

  const liveOutline = useMemo(() => {
    if (!outline) return null;
    return outline;
  }, [outline]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="aeog-topic">Topic or essay prompt</Label>
            <Textarea
              id="aeog-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Should social media platforms be regulated as utilities?"
              className="min-h-[80px] resize-y"
            />
            {detectedType && detectedType !== type && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Lightbulb className="h-3 w-3" />
                Detected type: <button className="underline text-primary" onClick={() => setType(detectedType)}>{TYPE_LABELS[detectedType]}</button>
              </p>
            )}
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
              <Label className="text-xs">Essay type</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as EssayType)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(TYPE_LABELS) as EssayType[]).map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Length</Label>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value as EssayLength)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(LENGTH_LABELS) as EssayLength[]).map((l) => (
                  <option key={l} value={l}>{LENGTH_LABELS[l]}</option>
                ))}
              </select>
            </div>
          </div>

          {type === "compare-contrast" && (
            <div className="space-y-1">
              <Label className="text-xs">Compare structure</Label>
              <select
                value={compareStructure}
                onChange={(e) => setCompareStructure(e.target.value as CompareStructure)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(COMPARE_STRUCTURE_LABELS) as CompareStructure[]).map((c) => (
                  <option key={c} value={c}>{COMPARE_STRUCTURE_LABELS[c]}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleGenerate} label="Generate outline" />
            <ClearButton onClick={handleClear} />
            <ShareButton
              getUrl={() => buildShareUrl({ topic, type, length, compareStructure: type === "compare-contrast" ? compareStructure : undefined })}
            />
          </div>
        </CardContent>
      </Card>

      {liveOutline && stats ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <Stat label="Sections" value={stats.totalSections} />
                <Stat label="Bullets" value={stats.totalBullets} />
                <Stat label="Slots" value={stats.totalSlots} />
                <Stat label="Words" value={stats.totalWords} />
                <Stat label="Type" value={stats.typeLabel.split(" ")[0]} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Thesis</div>
                  {liveOutline.thesisVariants.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={cycleThesis} className="gap-1 text-[11px] h-6">
                      <RefreshCw className="h-3 w-3" />
                      Variant {thesisIdx + 1}/{liveOutline.thesisVariants.length}
                    </Button>
                  )}
                </div>
                <p className="text-sm italic text-foreground border-l-2 border-primary pl-3">
                  {liveOutline.chosenThesis}
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Hook ({liveOutline.hook.style})
                </div>
                <p className="text-sm text-foreground border-l-2 border-muted pl-3">
                  {liveOutline.hook.text}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Outline ({liveOutline.sections.length} sections)
                </h3>
              </div>
              <div className="space-y-3">
                {liveOutline.sections.map((s, i) => (
                  <SectionCard
                    key={s.id}
                    section={s}
                    index={i}
                    total={liveOutline.sections.length}
                    onMoveUp={() => moveSection(s.id, -1)}
                    onMoveDown={() => moveSection(s.id, 1)}
                    onExpand={() => handleExpand(s.id)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Closing thought</div>
              <p className="text-sm italic text-foreground border-l-2 border-primary pl-3">
                {liveOutline.closingThought}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => renderText(liveOutline)} label="Copy outline" />
                <DownloadButton
                  getText={() => renderMarkdown(liveOutline)}
                  filename="essay-outline.md"
                  mime="text/markdown"
                  label="Download .md"
                />
                <DownloadButton
                  getText={() => renderText(liveOutline)}
                  filename="essay-outline.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => renderJson(liveOutline)}
                  filename="essay-outline.json"
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
          hint="Pick an essay type and length, then generate a thesis-driven hierarchical outline with hook, topic sentences, evidence/citation slots, and (for argumentative) counterargument + rebuttal."
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
                    setType(h.type);
                    setLength(h.length);
                    const o = generateOutline(h.topic, h.type, h.length, h.type === "compare-contrast" ? compareStructure : undefined);
                    setOutline(o);
                    setThesisIdx(0);
                  }}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">{TYPE_LABELS[h.type].split(" ")[0]}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.wordCount}w</Badge>
                  <span className="text-muted-foreground">{h.topic.slice(0, 60)}{h.topic.length > 60 ? "…" : ""}</span>
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
            <strong className="text-foreground">Honesty:</strong> The outline is a scaffold — evidence and citation slots (<code>[EVIDENCE]</code>, <code>[CITE]</code>) are placeholders you must fill with real sources. We do not fabricate citations. All generation runs locally; nothing is uploaded.
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
  onMoveUp,
  onMoveDown,
  onExpand,
}: {
  section: OutlineSection;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onExpand: () => void;
}) {
  const typeColor: Record<OutlineSection["type"], string> = {
    intro: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    body: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    counterargument: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    rebuttal: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
    conclusion: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  };
  return (
    <div className="rounded border bg-background p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-[10px] capitalize ${typeColor[section.type]}`}>{section.type}</Badge>
            <span className="text-sm font-medium text-foreground">{section.heading}</span>
            <span className="text-[10px] text-muted-foreground">~{section.wordEstimate} words</span>
          </div>
          <p className="text-xs italic text-foreground mt-1">{section.topicSentence}</p>
        </div>
        <div className="flex flex-col gap-0.5">
          <Button variant="ghost" size="icon" onClick={onMoveUp} disabled={index === 0} title="Move up" className="h-6 w-6">
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onMoveDown} disabled={index === total - 1} title="Move down" className="h-6 w-6">
            <ArrowDown className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <ul className="text-xs text-muted-foreground space-y-0.5 pl-4 list-disc">
        {section.bulletPoints.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
      {section.slots.length > 0 && (
        <div className="pt-1 space-y-0.5">
          {section.slots.map((slot, i) => (
            <div key={i} className="text-[11px] flex items-start gap-2">
              <Badge variant="secondary" className="text-[9px] font-mono">{slot.kind.toUpperCase()}</Badge>
              <span className="font-mono text-foreground">{slot.placeholder}</span>
              <span className="text-muted-foreground">— {slot.label}</span>
            </div>
          ))}
        </div>
      )}
      <Button variant="ghost" size="sm" onClick={onExpand} className="text-[11px] h-6 gap-1">
        <Plus className="h-3 w-3" /> Expand section
      </Button>
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
