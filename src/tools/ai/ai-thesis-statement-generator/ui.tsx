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
  ESSAY_TYPE_LABELS,
  STANCE_LABELS,
  ACADEMIC_LEVEL_LABELS,
  CITATION_STYLE_LABELS,
  SAMPLE_TOPICS,
  normalizeTopic,
  detectEssayType,
  generateTheses,
  computeStats,
  renderThesesText,
  renderThesesMarkdown,
  renderThesesJson,
  buildOutlineHandoffUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmRequestBody,
  extractLlmTheses,
  type EssayType,
  type Stance,
  type AcademicLevel,
  type CitationStyle,
  type ThesisResult,
  type ThesisOption,
  type HistoryEntry,
} from "./logic";
import {
  GraduationCap, History, Sparkles, Lightbulb, KeyRound, Loader2,
  ExternalLink, ChevronDown, ChevronRight, Wand2,
} from "lucide-react";

const ESSAY_TYPES: EssayType[] = ["argumentative", "analytical", "expository", "compare-contrast"];
const STANCES: Stance[] = ["for", "against", "neutral"];
const LEVELS: AcademicLevel[] = ["high-school", "undergraduate", "graduate"];
const CITATION_STYLES: CitationStyle[] = ["apa", "mla", "chicago", "harvard"];

export default function AiThesisStatementGenerator() {
  const [topic, setTopic] = useState("");
  const [stance, setStance] = useState<Stance>("for");
  const [essayType, setEssayType] = useState<EssayType>("argumentative");
  const [academicLevel, setAcademicLevel] = useState<AcademicLevel>("undergraduate");
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("apa");
  const [result, setResult] = useState<ThesisResult | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [apiKey, setApiKey] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmTheses, setLlmTheses] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.topic) setTopic(p.topic);
      if (p.stance) setStance(p.stance);
      if (p.essayType) setEssayType(p.essayType);
      if (p.academicLevel) setAcademicLevel(p.academicLevel);
      if (p.citationStyle) setCitationStyle(p.citationStyle);
      if (p.topic) toast.info("Loaded from share link");
    }
  }, []);

  const detectedType = useMemo(() => (topic ? detectEssayType(topic) : null), [topic]);

  const handleGenerate = useCallback(() => {
    const t = normalizeTopic(topic);
    if (!t) {
      toast.error("Enter a topic first");
      return;
    }
    const r = generateTheses({ topic: t, stance, essayType, academicLevel, citationStyle });
    setResult(r);
    setExpandedIds(new Set([r.theses[0]?.id].filter(Boolean) as string[]));
    setLlmTheses([]);
    saveHistory({
      ts: Date.now(),
      topic: t,
      stance,
      essayType,
      thesisCount: r.theses.length,
      topScore: r.theses[0]?.scores.composite ?? 0,
    });
    setHistory(loadHistory());
    toast.success(`Generated ${r.theses.length} thesis statements`);
  }, [topic, stance, essayType, academicLevel, citationStyle]);

  const handleClear = useCallback(() => {
    setTopic("");
    setResult(null);
    setLlmTheses([]);
    setExpandedIds(new Set());
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const stats = useMemo(() => (result ? computeStats(result) : null), [result]);

  const handleEnhanceLlm = useCallback(async () => {
    if (!apiKey) {
      toast.error("Paste your API key first");
      return;
    }
    const t = normalizeTopic(topic);
    if (!t) {
      toast.error("Enter a topic first");
      return;
    }
    setLlmLoading(true);
    setLlmTheses([]);
    try {
      const body = buildLlmRequestBody({ topic: t, stance, essayType, academicLevel, citationStyle });
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        toast.error(`API error ${res.status}: ${txt.slice(0, 200)}`);
        return;
      }
      const json = await res.json();
      const out = extractLlmTheses(json);
      if (out.length > 0) {
        setLlmTheses(out);
        toast.success(`LLM generated ${out.length} theses`);
      } else {
        toast.error("No theses found in LLM response");
      }
    } catch (e) {
      toast.error(`Could not reach API: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLlmLoading(false);
    }
  }, [apiKey, topic, stance, essayType, academicLevel, citationStyle]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tsg-topic">Topic or essay prompt</Label>
            <Textarea
              id="tsg-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={"e.g. Should social media platforms be regulated as utilities?"}
              className="min-h-[80px] resize-y"
            />
            {detectedType && detectedType !== essayType && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Lightbulb className="h-3 w-3" />
                Detected type: <button className="underline text-primary" onClick={() => setEssayType(detectedType)}>{ESSAY_TYPE_LABELS[detectedType]}</button>
              </p>
            )}
            <div className="flex flex-wrap gap-1 pt-1">
              {SAMPLE_TOPICS.slice(0, 6).map((t) => (
                <Button
                  key={t}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] max-w-full"
                  onClick={() => setTopic(t)}
                >
                  <span className="truncate">{t.length > 36 ? t.slice(0, 36) + "…" : t}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Essay type</Label>
              <select
                value={essayType}
                onChange={(e) => setEssayType(e.target.value as EssayType)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {ESSAY_TYPES.map((t) => (
                  <option key={t} value={t}>{ESSAY_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Stance</Label>
              <select
                value={stance}
                onChange={(e) => setStance(e.target.value as Stance)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {STANCES.map((s) => (
                  <option key={s} value={s}>{STANCE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Academic level</Label>
              <select
                value={academicLevel}
                onChange={(e) => setAcademicLevel(e.target.value as AcademicLevel)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{ACADEMIC_LEVEL_LABELS[l]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Citation style</Label>
              <select
                value={citationStyle}
                onChange={(e) => setCitationStyle(e.target.value as CitationStyle)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {CITATION_STYLES.map((c) => (
                  <option key={c} value={c}>{CITATION_STYLE_LABELS[c]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleGenerate} label="Generate theses" />
            <ClearButton onClick={handleClear} />
            <ShareButton
              getUrl={() => buildShareUrl({ topic, stance, essayType, academicLevel, citationStyle })}
            />
          </div>
        </CardContent>
      </Card>

      {result && stats ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Theses" value={stats.thesisCount} />
                <Stat label="Top score" value={`${stats.topScore}/100`} highlight={stats.topScore >= 70 ? "good" : stats.topScore < 50 ? "bad" : undefined} />
                <Stat label="Avg score" value={`${stats.avgScore}/100`} />
                <Stat label="Type" value={stats.essayTypeLabel.split(" ")[0]} />
              </div>
              {result.scopeNarrowing.length > 0 && (
                <div className="pt-2 space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <Lightbulb className="h-3 w-3" /> Scope suggestions
                  </div>
                  <ul className="text-[11px] text-muted-foreground space-y-0.5 pl-4 list-disc">
                    {result.scopeNarrowing.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4" /> Ranked thesis statements ({result.theses.length})
              </h3>
              <div className="space-y-2">
                {result.theses.map((t, i) => (
                  <ThesisCard
                    key={t.id}
                    thesis={t}
                    rank={i + 1}
                    expanded={expandedIds.has(t.id)}
                    onToggle={() => toggleExpand(t.id)}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => renderThesesText(result)} label="Copy all" />
                <DownloadButton
                  getText={() => renderThesesMarkdown(result)}
                  filename="theses.md"
                  mime="text/markdown"
                  label="Download .md"
                />
                <DownloadButton
                  getText={() => renderThesesText(result)}
                  filename="theses.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => renderThesesJson(result)}
                  filename="theses.json"
                  mime="application/json"
                  label="Download .json"
                />
                <Button variant="outline" size="sm" asChild className="gap-1.5">
                  <a href={buildOutlineHandoffUrl(result)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" /> Outline tool
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                <h4 className="text-sm font-semibold text-foreground">Optional: Enhance with LLM (BYO key)</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Paste your own OpenAI API key to get 5 AI-drafted theses. The key stays in your browser; requests go directly to OpenAI. Always follow your institution's academic-integrity rules.
              </p>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="h-9 text-sm font-mono"
              />
              <Button size="sm" onClick={handleEnhanceLlm} disabled={llmLoading} className="gap-1.5">
                {llmLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {llmLoading ? "Asking LLM…" : "Enhance with LLM"}
              </Button>
              {llmTheses.length > 0 && (
                <div className="pt-2 space-y-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">LLM-drafted theses</div>
                  {llmTheses.map((t, i) => (
                    <div key={i} className="rounded border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
                      <span className="text-primary text-xs font-mono mr-2">{i + 1}.</span>
                      {t}
                    </div>
                  ))}
                  <CopyButton getText={() => llmTheses.map((t, i) => `${i + 1}. ${t}`).join("\n")} label="Copy LLM theses" />
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a topic and click Generate"
          hint="Pick essay type + stance + academic level + citation style. We'll generate 5+ ranked thesis statements with rubric scores (clarity, specificity, arguability, scope), supporting-point scaffolds, and counter-argument prompts."
          icon={<GraduationCap className="h-8 w-8" />}
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
                    setStance(h.stance);
                    setEssayType(h.essayType);
                    const r = generateTheses({
                      topic: h.topic,
                      stance: h.stance,
                      essayType: h.essayType,
                      academicLevel,
                      citationStyle,
                    });
                    setResult(r);
                    setExpandedIds(new Set([r.theses[0]?.id].filter(Boolean) as string[]));
                  }}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">{ESSAY_TYPE_LABELS[h.essayType].split(" ")[0]}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{STANCE_LABELS[h.stance].split(" ")[0]}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.topScore}/100</Badge>
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
            <strong className="text-foreground">Honesty:</strong> Theses are drafts to refine, not final academic work. The rubric is a heuristic — your judgment matters more than the score. Evidence and citation slots (<code>[EVIDENCE]</code>, <code>[CITE]</code>) are placeholders you must fill with real sources. Always follow your institution's academic-integrity rules. All generation runs locally; nothing is uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ThesisCard({
  thesis,
  rank,
  expanded,
  onToggle,
}: {
  thesis: ThesisOption;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const scoreColor = thesis.scores.composite >= 75
    ? "text-emerald-600 dark:text-emerald-400"
    : thesis.scores.composite >= 55
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";
  return (
    <div className="rounded border bg-background p-3 space-y-2">
      <div className="flex items-start gap-2">
        <span className="text-[11px] font-mono text-muted-foreground mt-0.5">#{rank}</span>
        <div className="flex-1">
          <p className="text-sm text-foreground">{thesis.text}</p>
        </div>
        <div className="text-right">
          <div className={`text-base font-semibold ${scoreColor}`}>{thesis.scores.composite}</div>
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">/100</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        <Badge variant="outline">Clarity {thesis.scores.clarity}</Badge>
        <Badge variant="outline">Specificity {thesis.scores.specificity}</Badge>
        <Badge variant="outline">Arguability {thesis.scores.arguability}</Badge>
        <Badge variant="outline">Scope {thesis.scores.scope}</Badge>
      </div>
      <p className="text-[11px] text-muted-foreground italic">
        <Wand2 className="inline h-3 w-3 mr-1" />
        {thesis.improvementTip}
      </p>
      <Button variant="ghost" size="sm" onClick={onToggle} className="text-[11px] h-6 gap-1">
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {expanded ? "Hide scaffolds" : "Show scaffolds"}
      </Button>
      {expanded && (
        <div className="pt-1 space-y-2 border-t border-border">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Supporting points</div>
            <div className="space-y-1">
              {thesis.supportingPoints.map((p, i) => (
                <div key={i} className="text-[11px] rounded bg-muted/30 px-2 py-1.5">
                  <div className="font-medium text-foreground">{p.label}</div>
                  <div className="font-mono text-muted-foreground">{p.template}</div>
                  <div className="text-[10px] text-muted-foreground italic mt-0.5">{p.hint}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Counter-argument</div>
            <p className="text-[11px] text-foreground italic border-l-2 border-amber-400 pl-2">
              {thesis.counterArgument}
            </p>
          </div>
          <CopyButton getText={() => thesis.text} label="Copy thesis" />
        </div>
      )}
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
