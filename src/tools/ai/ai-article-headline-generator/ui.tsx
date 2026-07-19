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
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  FORMULA_LABELS,
  TRIGGER_LABELS,
  STYLE_LABELS,
  TOPIC_PRESETS,
  generateHeadlines,
  pickABPair,
  computeStats,
  renderText,
  renderMarkdown,
  renderJson,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  estimatePixelWidth,
  findPowerWords,
  detectEmotionalTrigger,
  scoreHeadline,
  detectClickbait,
  type HeadlineFormula,
  type StylePreset,
  type HeadlineVariation,
  type ABPair,
  type HistoryEntry,
  type ShareState,
} from "./logic";
import {
  Newspaper, Sparkles, Key, History, ChevronDown, ChevronRight,
  Trophy, AlertTriangle, BookOpen, BarChart3,
} from "lucide-react";

type SortKey = "score" | "length" | "pixel";

export default function AiArticleHeadlineGenerator() {
  const [topic, setTopic] = useState("");
  const [draft, setDraft] = useState("");
  const [formulas, setFormulas] = useState<HeadlineFormula[]>([]);
  const [style, setStyle] = useState<StylePreset>("informative");
  const [max, setMax] = useState(12);
  const [seed, setSeed] = useState(42);
  const [variations, setVariations] = useState<HeadlineVariation[]>([]);
  const [abPair, setAbPair] = useState<ABPair | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [formulaFilter, setFormulaFilter] = useState<HeadlineFormula | "">("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState("");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmExtra, setLlmExtra] = useState<HeadlineVariation[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-headline:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.topic) setTopic(p.topic);
      if (p.draft) setDraft(p.draft);
      if (p.formulas && p.formulas.length > 0) setFormulas(p.formulas);
      if (p.style) setStyle(p.style);
      if (p.max) setMax(p.max);
      if (p.topic) {
        toast.info("Loaded from share link");
        handleGenerate(p.topic, p.draft, p.formulas, p.style, p.max);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = useCallback(
    (
      overrideTopic?: string,
      overrideDraft?: string,
      overrideFormulas?: HeadlineFormula[],
      overrideStyle?: StylePreset,
      overrideMax?: number,
    ) => {
      const t = (overrideTopic ?? topic).trim();
      const d = (overrideDraft ?? draft).trim();
      const f = overrideFormulas ?? formulas;
      const s = overrideStyle ?? style;
      const m = overrideMax ?? max;
      setError("");
      setLlmExtra([]);
      if (!t) {
        setError("Please enter a topic or paste a draft.");
        return;
      }
      const out = generateHeadlines({
        topic: t,
        draft: d,
        formulas: f.length > 0 ? f : undefined,
        style: s,
        max: m,
        seed,
      });
      setVariations(out);
      setAbPair(pickABPair(out));
      if (out.length > 0) {
        const avg = Math.round(out.reduce((a, v) => a + v.scores.total, 0) / out.length);
        const best = Math.max(...out.map((v) => v.scores.total));
        saveHistory({ ts: Date.now(), topic: t, count: out.length, avgScore: avg, bestScore: best });
        setHistory(loadHistory());
        toast.success(`Generated ${out.length} headlines (avg ${avg}, best ${best})`);
      } else {
        toast.info("No headlines generated — try different inputs.");
      }
    },
    [topic, draft, formulas, style, max, seed],
  );

  const allVariations = useMemo(() => [...variations, ...llmExtra], [variations, llmExtra]);
  const stats = useMemo(() => computeStats(allVariations), [allVariations]);

  const sortedVariations = useMemo(() => {
    const arr = [...allVariations];
    if (sortKey === "score") arr.sort((a, b) => b.scores.total - a.scores.total);
    else if (sortKey === "length") arr.sort((a, b) => a.charCount - b.charCount);
    else if (sortKey === "pixel") arr.sort((a, b) => a.pixelWidth - b.pixelWidth);
    return arr;
  }, [allVariations, sortKey]);

  const filteredVariations = useMemo(() => {
    if (!formulaFilter) return sortedVariations;
    return sortedVariations.filter((v) => v.formula === formulaFilter);
  }, [sortedVariations, formulaFilter]);

  const toggleFormula = (f: HeadlineFormula) => {
    setFormulas((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  };

  const handleClear = useCallback(() => {
    setTopic("");
    setDraft("");
    setVariations([]);
    setLlmExtra([]);
    setAbPair(null);
    setError("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSaveLlmKey = () => {
    if (typeof localStorage !== "undefined") {
      if (llmKey) localStorage.setItem("unqtools:ai-headline:llm-key", llmKey);
      else localStorage.removeItem("unqtools:ai-headline:llm-key");
    }
    toast.success(llmKey ? "API key saved locally" : "API key cleared");
  };

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Please paste your API key first");
      return;
    }
    if (!topic.trim()) {
      toast.error("Enter a topic first");
      return;
    }
    setLlmLoading(true);
    setError("");
    try {
      const prompt = buildLlmPrompt(topic, draft, formulas, style);
      const url = llmProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let body: Record<string, unknown>;
      if (llmProvider === "openai") {
        headers["Authorization"] = `Bearer ${llmKey}`;
        body = {
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are an expert copywriter who writes high-converting article headlines." },
            { role: "user", content: prompt },
          ],
          temperature: 0.8,
        };
      } else {
        headers["x-api-key"] = llmKey;
        headers["anthropic-version"] = "2023-06-01";
        body = {
          model: "claude-3-5-haiku-20241022",
          max_tokens: 2048,
          messages: [{ role: "user", content: prompt }],
        };
      }
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const txt = await res.text();
        setError(`LLM request failed (${res.status}): ${txt.slice(0, 200)}`);
        toast.error("LLM request failed");
        setLlmLoading(false);
        return;
      }
      const data = await res.json();
      const rawText = llmProvider === "openai"
        ? (data.choices?.[0]?.message?.content ?? "")
        : (data.content?.[0]?.text ?? "");
      const parsed = renderLlmResult(rawText);
      if (!parsed.ok) {
        setError(parsed.error);
        setLlmLoading(false);
        return;
      }
      const extra: HeadlineVariation[] = parsed.headlines.map((h, i) => {
        const text = h.text;
        const pixelWidth = estimatePixelWidth(text);
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        const formula = h.formula;
        const powerWords = findPowerWords(text);
        const trigger = detectEmotionalTrigger(text);
        const subScores = scoreHeadline(text, formula);
        const clickbait = detectClickbait(text);
        return {
          id: `llm-${Date.now()}-${i}`,
          text,
          formula,
          style,
          wordCount,
          charCount: text.length,
          pixelWidth,
          powerWords,
          emotionalTrigger: trigger,
          scores: subScores,
          clickbait: clickbait.isClickbait,
          clickbaitReasons: clickbait.reasons,
          metaDescription: h.metaDescription || "",
          topic: topic.trim(),
        };
      });
      setLlmExtra(extra);
      toast.success(`LLM added ${extra.length} headlines`);
    } catch (e) {
      setError(`LLM request error: ${(e as Error).message}`);
      toast.error("LLM request error");
    }
    setLlmLoading(false);
  }, [llmKey, llmProvider, topic, draft, formulas, style]);

  const shareState: ShareState = { topic, draft, formulas, style, max };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ai-headline-topic">Topic or article title</Label>
            <Textarea
              id="ai-headline-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={"e.g., How to start a podcast in 2025"}
              className="min-h-[60px] resize-y text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {TOPIC_PRESETS.map((p) => (
                <Button
                  key={p}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setTopic(p)}
                >+ {p}</Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-headline-draft" className="text-xs">
              Draft or notes (optional — gives more accurate keyword extraction)
            </Label>
            <Textarea
              id="ai-headline-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={"Paste the first 1-2 paragraphs of your draft, or bullet points of key takeaways."}
              className="min-h-[80px] resize-y text-xs"
            />
          </div>

          <div>
            <Label className="text-xs">
              Formulas ({formulas.length === 0 ? "all 10" : formulas.length} selected — leave empty for all)
            </Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(Object.keys(FORMULA_LABELS) as HeadlineFormula[]).map((f) => (
                <Button
                  key={f}
                  variant={formulas.includes(f) ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => toggleFormula(f)}
                >
                  {FORMULA_LABELS[f]}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ai-headline-style" className="text-xs">Style preset</Label>
              <select
                id="ai-headline-style"
                value={style}
                onChange={(e) => setStyle(e.target.value as StylePreset)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(STYLE_LABELS) as StylePreset[]).map((s) => (
                  <option key={s} value={s}>{STYLE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-headline-max" className="text-xs">Max headlines</Label>
              <Input
                id="ai-headline-max"
                type="number"
                min={1}
                max={40}
                value={max}
                onChange={(e) => setMax(Math.max(1, Math.min(40, parseInt(e.target.value, 10) || 12)))}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-headline-seed" className="text-xs">Seed (for numbers)</Label>
              <Input
                id="ai-headline-seed"
                type="number"
                value={seed}
                onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <RunButton
              onClick={() => handleGenerate()}
              label="Generate headlines"
              loading={false}
              disabled={!topic.trim()}
            />
            <ShareButton getUrl={() => buildShareUrl(shareState)} disabled={!topic.trim()} />
            <ClearButton onClick={handleClear} disabled={!topic && variations.length === 0} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {allVariations.length > 0 ? (
        <>
          {/* Stats summary */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" /> Stats for &ldquo;{topic}&rdquo;
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Headlines" value={allVariations.length} />
                <Stat label="Avg score" value={stats.avgScore} />
                <Stat label="Avg pixel width" value={`${stats.avgPixelWidth}px`} />
                <Stat
                  label="Clickbait flagged"
                  value={stats.clickbaitCount}
                  highlight={stats.clickbaitCount > 0 ? "bad" : undefined}
                />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(Object.keys(FORMULA_LABELS) as HeadlineFormula[]).map((f) => (
                  stats.byFormula[f] > 0 && (
                    <Badge key={f} variant="outline" className="text-[10px]">
                      {FORMULA_LABELS[f]}: {stats.byFormula[f]}
                    </Badge>
                  )
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(TRIGGER_LABELS) as Array<keyof typeof TRIGGER_LABELS>).map((t) => (
                  stats.byTrigger[t] > 0 && (
                    <Badge key={t} variant="secondary" className="text-[10px]">
                      {TRIGGER_LABELS[t]}: {stats.byTrigger[t]}
                    </Badge>
                  )
                ))}
              </div>
            </CardContent>
          </Card>

          {/* A/B pair picker */}
          {abPair && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Trophy className="h-4 w-4" /> Recommended A/B pair
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(["a", "b"] as const).map((side) => {
                    const v = abPair[side];
                    const isWinner = abPair.winner === side;
                    return (
                      <div
                        key={side}
                        className={`rounded border p-3 text-xs ${isWinner ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "bg-background"}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Badge variant={isWinner ? "default" : "outline"} className="text-[10px]">
                            {side.toUpperCase()}{isWinner ? " · winner" : ""}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">{v.scores.total}/100</Badge>
                          <Badge variant="outline" className="text-[10px]">{FORMULA_LABELS[v.formula]}</Badge>
                        </div>
                        <p className="font-medium text-foreground leading-snug">{v.text}</p>
                        <p className="text-muted-foreground mt-1">{v.metaDescription}</p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground pt-1">{abPair.reason}</p>
              </CardContent>
            </Card>
          )}

          {/* Headlines list */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Newspaper className="h-4 w-4" /> Headlines ({filteredVariations.length})
                </h3>
                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    value={formulaFilter}
                    onChange={(e) => setFormulaFilter(e.target.value as HeadlineFormula | "")}
                    className="h-8 text-xs rounded border bg-background px-2"
                  >
                    <option value="">All formulas</option>
                    {(Object.keys(FORMULA_LABELS) as HeadlineFormula[]).map((f) => (
                      <option key={f} value={f}>{FORMULA_LABELS[f]}</option>
                    ))}
                  </select>
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="h-8 text-xs rounded border bg-background px-2"
                  >
                    <option value="score">Sort: score ↓</option>
                    <option value="length">Sort: length ↑</option>
                    <option value="pixel">Sort: pixel width ↑</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2 max-h-[700px] overflow-auto">
                {filteredVariations.map((v, i) => (
                  <HeadlineCard key={v.id} v={v} rank={i + 1} />
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => renderText(filteredVariations)} label="Copy all" />
                <DownloadButton
                  getText={() => renderMarkdown(filteredVariations)}
                  filename="headlines.md"
                  mime="text/markdown"
                  label="Download .md"
                />
                <DownloadButton
                  getText={() => renderCsv(filteredVariations)}
                  filename="headlines.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <DownloadButton
                  getText={() => renderJson(filteredVariations)}
                  filename="headlines.json"
                  mime="application/json"
                  label="Download JSON"
                />
              </div>
            </CardContent>
          </Card>

          {/* Optional LLM enhancement */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <button
                className="flex items-center gap-1.5 text-sm font-semibold text-foreground w-full"
                onClick={() => setShowLlm((v) => !v)}
              >
                {showLlm ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Key className="h-4 w-4" /> Optional: Enhance with LLM (BYO API key)
              </button>
              {showLlm && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs text-muted-foreground">
                    Paste your own OpenAI or Anthropic API key. Stored only in localStorage on this device. The tool builds an optimal prompt with power words and formula cues, then re-scores the LLM output using the same engine so you can compare directly.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      type="password"
                      placeholder="sk-... or anthropic key"
                      value={llmKey}
                      onChange={(e) => setLlmKey(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <div className="flex gap-2">
                      <select
                        value={llmProvider}
                        onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                        className="h-8 text-xs rounded border bg-background px-2 flex-1"
                      >
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                      </select>
                      <Button size="sm" variant="outline" onClick={handleSaveLlmKey} className="h-8">
                        Save key
                      </Button>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleLlmEnhance}
                    disabled={llmLoading || !llmKey || !topic.trim()}
                    className="gap-1.5"
                  >
                    {llmLoading ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {llmLoading ? "Working…" : "Enhance with LLM"}
                  </Button>
                  <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    Scores are heuristics, not guaranteed CTR. LLM headlines are tagged &ldquo;LLM&rdquo; and scored with the same engine for fair comparison.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a topic to generate scored, A/B-ready headlines"
          hint="Pick formula families (or leave empty for all 10), choose a style preset, then click Generate. Each headline gets a 5-axis score, clickbait flag, and meta description pairing."
          icon={<Newspaper className="h-8 w-8" />}
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
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/40 transition"
                  onClick={() => {
                    setTopic(h.topic);
                    handleGenerate(h.topic);
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{h.count} headlines</Badge>
                    <Badge variant="outline">avg {h.avgScore}</Badge>
                    <Badge variant="outline">best {h.bestScore}</Badge>
                    <span className="font-medium text-foreground">{h.topic}</span>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All headline generation, scoring, and pixel-width estimation runs locally in your browser. The only network call is if you paste your own LLM API key and click &ldquo;Enhance with LLM&rdquo; — that request goes directly to your chosen provider. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function HeadlineCard({ v, rank }: { v: HeadlineVariation; rank: number }) {
  const [expanded, setExpanded] = useState(rank === 1);
  const pixelOverflow = v.pixelWidth > 580;
  return (
    <div className="rounded border bg-background px-3 py-2 text-xs space-y-1.5">
      <div className="flex items-start gap-2">
        <button
          aria-label={expanded ? "Collapse" : "Expand"}
          onClick={() => setExpanded((p) => !p)}
          className="mt-0.5 text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px]">#{rank}</Badge>
            <Badge variant="outline" className="text-[10px]">{v.scores.total}/100</Badge>
            <Badge variant="outline" className="text-[10px]">{FORMULA_LABELS[v.formula]}</Badge>
            {v.emotionalTrigger && (
              <Badge variant="outline" className="text-[10px]">{TRIGGER_LABELS[v.emotionalTrigger]}</Badge>
            )}
            {v.id.startsWith("llm-") && (
              <Badge className="text-[10px] bg-violet-500 text-white">LLM</Badge>
            )}
            {v.clickbait && (
              <Badge className="text-[10px] bg-amber-500 text-white">⚠ Clickbait</Badge>
            )}
            {pixelOverflow && (
              <Badge className="text-[10px] bg-red-500 text-white">Truncated</Badge>
            )}
          </div>
          <p className="font-medium text-foreground leading-snug">{v.text}</p>

          {/* Pixel width bar */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className="flex-1 h-1.5 bg-muted rounded overflow-hidden">
                <div
                  className={pixelOverflow ? "h-full bg-red-500" : "h-full bg-emerald-500"}
                  style={{ width: `${Math.min(100, (v.pixelWidth / 700) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">{v.pixelWidth}px</span>
            </div>
          </div>

          {expanded && (
            <div className="space-y-1 pt-1">
              <div className="grid grid-cols-5 gap-1 text-[10px]">
                <ScoreBar label="Length" value={v.scores.length} />
                <ScoreBar label="Power" value={v.scores.power} />
                <ScoreBar label="Emotion" value={v.scores.emotion} />
                <ScoreBar label="Click" value={v.scores.clickability} />
                <ScoreBar label="Pixel" value={v.scores.pixel} />
              </div>
              <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                <span>{v.charCount} chars · {v.wordCount} words</span>
                {v.powerWords.length > 0 && (
                  <span>· power: {v.powerWords.join(", ")}</span>
                )}
              </div>
              {v.clickbait && v.clickbaitReasons.length > 0 && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  {v.clickbaitReasons.join("; ")} — deliver on the promise in the body.
                </p>
              )}
              <div className="rounded bg-muted/40 p-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5 flex items-center gap-1">
                  <BookOpen className="h-3 w-3" /> Meta description ({v.metaDescription.length} chars)
                </div>
                <p className="text-foreground leading-snug">{v.metaDescription}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <CopyButton
                  getText={() => v.text}
                  label="Copy headline"
                  size="sm"
                />
                <CopyButton
                  getText={() => `${v.text}\n\n${v.metaDescription}`}
                  label="Copy + meta"
                  size="sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div className="h-1 bg-muted rounded overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
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
