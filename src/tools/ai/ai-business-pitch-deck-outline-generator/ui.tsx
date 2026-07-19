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
  HISTORY_MAX,
  LLM_KEY_STORAGE,
  STAGE_LABELS,
  FIELD_HINTS,
  SLIDE_TITLES,
  validateInputs,
  generate,
  renderMarkdown,
  renderSpeakerNotes,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type PitchInputs,
  type Stage,
  type PitchOutput,
  type HistoryEntry,
  type LlmEnhancement,
} from "./logic";
import {
  Presentation, Key, History, AlertCircle, Eye, EyeOff,
  Sparkles, Mic, Target, TrendingUp, AlertTriangle, CheckCircle2,
  XCircle, Clock, DollarSign,
} from "lucide-react";

const DEFAULT_INPUTS: PitchInputs = {
  companyName: "",
  oneLiner: "",
  industry: "",
  stage: "seed",
  targetRaise: "",
  problem: "",
  solution: "",
  audience: "",
  whyNow: "",
  teamCredibility: "",
  traction: "",
};

const SAMPLE: PitchInputs = {
  companyName: "Ledgerloop",
  oneLiner: "Honest accounting software for indie creators.",
  industry: "fintech",
  stage: "seed",
  targetRaise: "$1.5M",
  problem: "Indie creators spend 6+ hours per month on bookkeeping with tools built for SMBs.",
  solution: "Auto-categorize Stripe/PayPal income, auto-match receipts, file Schedule C in one click.",
  audience: "US-based indie creators earning $50k–$500k per year",
  whyNow: "1099 worker growth since 2020, Stripe/PayPal API maturity, and IRS e-file modernization.",
  teamCredibility: "Founder was CPA at a top-50 firm; CTO built the tax engine at TurboTax for 5 years.",
  traction: "1,200 paid users, $18k MRR, 12% MoM growth, 4 published case studies.",
};

const FIELDS: Array<{ key: keyof PitchInputs; label: string; multiline?: boolean }> = [
  { key: "companyName", label: "Company name" },
  { key: "oneLiner", label: "One-liner", multiline: true },
  { key: "industry", label: "Industry" },
  { key: "targetRaise", label: "Target raise" },
  { key: "problem", label: "Problem", multiline: true },
  { key: "solution", label: "Solution", multiline: true },
  { key: "audience", label: "Target audience", multiline: true },
  { key: "whyNow", label: "Why now", multiline: true },
  { key: "teamCredibility", label: "Team credibility", multiline: true },
  { key: "traction", label: "Traction", multiline: true },
];

export default function AiBusinessPitchDeckOutlineGenerator() {
  const [inputs, setInputs] = useState<PitchInputs>(DEFAULT_INPUTS);
  const [output, setOutput] = useState<PitchOutput | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<LlmEnhancement | null>(null);
  const [speakerMode, setSpeakerMode] = useState(false);
  const [expandedSlide, setExpandedSlide] = useState<number | null>(0);
  const [error, setError] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem(LLM_KEY_STORAGE)
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.inputs && Object.keys(p.inputs).length > 0) {
        setInputs((prev) => ({ ...prev, ...p.inputs }));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const liveWarnings = useMemo(() => validateInputs(inputs), [inputs]);

  const handleGenerate = useCallback(() => {
    setError("");
    try {
      const out = generate(inputs);
      setOutput(out);
      setLlmResult(null);
      setExpandedSlide(0);
      if (inputs.companyName && inputs.companyName.trim()) {
        saveHistory({
          ts: Date.now(),
          companyName: inputs.companyName,
          industry: inputs.industry,
          stage: inputs.stage,
          targetRaise: inputs.targetRaise,
          slideCount: out.slideCount,
        });
        setHistory(loadHistory());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    }
  }, [inputs]);

  const handleClear = useCallback(() => {
    setInputs(DEFAULT_INPUTS);
    setOutput(null);
    setLlmResult(null);
    setError("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadSample = useCallback(() => {
    setInputs(SAMPLE);
    toast.info("Sample startup loaded");
  }, []);

  const handleSaveKey = useCallback(() => {
    if (typeof localStorage !== "undefined") {
      try {
        if (llmKey) localStorage.setItem(LLM_KEY_STORAGE, llmKey);
        else localStorage.removeItem(LLM_KEY_STORAGE);
        toast.success(llmKey ? "API key saved on this device" : "API key removed");
      } catch {
        toast.error("Could not save key");
      }
    }
  }, [llmKey]);

  const handleLlm = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your API key first");
      return;
    }
    if (!inputs.companyName.trim()) {
      toast.error("Enter at least a company name first");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    setLlmResult(null);
    try {
      const slideTitles = (output?.slides ?? []).map((s) => s.title);
      const prompt = buildLlmPrompt(inputs, slideTitles);
      const url = llmProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let body: string;
      if (llmProvider === "openai") {
        headers["Authorization"] = `Bearer ${llmKey}`;
        body = JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a JSON-only API. Respond with valid JSON only, no prose." },
            { role: "user", content: prompt },
          ],
          temperature: 0.5,
        });
      } else {
        headers["x-api-key"] = llmKey;
        headers["anthropic-version"] = "2023-06-01";
        body = JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 2048,
          system: "You are a JSON-only API. Respond with valid JSON only, no prose.",
          messages: [{ role: "user", content: prompt }],
        });
      }
      const res = await fetch(url, { method: "POST", headers, body });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`API error ${res.status}: ${txt.slice(0, 200)}`);
      }
      const data = await res.json();
      const raw = llmProvider === "openai"
        ? (data.choices?.[0]?.message?.content ?? "")
        : (data.content?.[0]?.text ?? "");
      const parsed = renderLlmResult(raw);
      if (!parsed.ok) throw new Error(parsed.error);
      setLlmResult(parsed.result);
      toast.success("LLM polish applied");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "LLM call failed";
      setLlmError(msg);
      toast.error(msg);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, inputs, output]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Stage selector — first because it shapes everything */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              Deck type / funding stage
              <span className="ml-2 text-muted-foreground font-normal">— {FIELD_HINTS.stage.hint}</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(STAGE_LABELS) as Stage[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setInputs((prev) => ({ ...prev, stage: s }))}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    inputs.stage === s
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  {STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <div key={f.key} className={f.multiline ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}>
                <Label htmlFor={`pdg-${f.key}`} className="text-xs">
                  {f.label}
                  <span className="ml-2 text-muted-foreground font-normal">— {FIELD_HINTS[f.key].hint}</span>
                </Label>
                {f.multiline ? (
                  <Textarea
                    id={`pdg-${f.key}`}
                    value={inputs[f.key]}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={`e.g. ${FIELD_HINTS[f.key].sample}`}
                    className="min-h-[60px] resize-y text-sm"
                  />
                ) : (
                  <Input
                    id={`pdg-${f.key}`}
                    value={inputs[f.key]}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={`e.g. ${FIELD_HINTS[f.key].sample}`}
                    className="text-sm"
                  />
                )}
              </div>
            ))}
          </div>

          {liveWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300 mb-1">
                <AlertCircle className="h-3.5 w-3.5" /> {liveWarnings.length} warning{liveWarnings.length === 1 ? "" : "s"}
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-amber-700 dark:text-amber-300">
                {liveWarnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <RunButton
              onClick={handleGenerate}
              disabled={!inputs.companyName.trim() && !inputs.oneLiner.trim()}
              label="Generate outline"
            />
            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={handleLoadSample}>
              Load sample
            </Button>
            <DownloadButton
              getText={() => output ? renderMarkdown(output, inputs) : ""}
              filename="pitch-deck-outline.md"
              mime="text/markdown"
              label="Download .md"
              disabled={!output}
            />
            <DownloadButton
              getText={() => output ? renderSpeakerNotes(output) : ""}
              filename="pitch-deck-speaker-notes.md"
              mime="text/markdown"
              label="Speaker notes"
              disabled={!output}
            />
            <DownloadButton
              getText={() => output ? renderJson(output, inputs) : ""}
              filename="pitch-deck-outline.json"
              mime="application/json"
              label="Download JSON"
              disabled={!output}
            />
            <ShareButton
              getUrl={() => buildShareUrl(inputs)}
              disabled={!inputs.companyName.trim() && !inputs.oneLiner.trim()}
            />
            <ClearButton
              onClick={handleClear}
              disabled={!inputs.companyName && !inputs.oneLiner && !output}
            />
          </div>
          {error && <ErrorBanner message={error} />}
        </CardContent>
      </Card>

      {output && (
        <>
          {/* Narrative arc check */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Target className="h-4 w-4" /> Narrative arc check
              </h3>
              <p className="text-xs text-foreground">
                {output.narrative.ok ? "✅" : "⚠️"} {output.narrative.summary}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {output.narrative.checks.map((c) => (
                  <div
                    key={c.name}
                    className={`rounded border p-2 text-xs ${
                      c.status === "ok"
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : c.status === "weak"
                          ? "border-amber-500/30 bg-amber-500/5"
                          : "border-destructive/30 bg-destructive/5"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {c.status === "ok" && <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />}
                      {c.status === "weak" && <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />}
                      {c.status === "missing" && <XCircle className="h-3 w-3 text-destructive" />}
                      <span className="font-medium">{c.name}</span>
                      <Badge variant="outline" className="text-[9px] ml-auto">{c.status}</Badge>
                    </div>
                    <p className="text-muted-foreground">{c.note}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Use of funds + milestones */}
          {output.useOfFunds.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4" /> Use of funds (suggested breakdown)
                </h3>
                <div className="space-y-1.5">
                  {output.useOfFunds.map((u) => (
                    <div key={u.category} className="rounded border bg-background p-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{u.category}</span>
                        <span className="font-mono text-muted-foreground">{u.percentage}%</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{u.rationale}</p>
                      <div className="flex gap-0.5 h-1 mt-1 rounded overflow-hidden bg-muted">
                        <div className="bg-primary" style={{ width: `${u.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {output.milestones.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" /> Milestones for this raise
                </h3>
                <div className="space-y-1.5">
                  {output.milestones.map((m, i) => (
                    <div key={i} className="rounded border bg-background p-2.5 text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <Clock className="h-3 w-3" />
                        <span className="font-medium">{m.timeframe}</span>
                      </div>
                      <div className="text-foreground">{m.goal}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        <span className="font-medium">Metric:</span> {m.metric}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Slide-by-slide outline */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Presentation className="h-4 w-4" /> Slide-by-slide outline ({output.slideCount} slides)
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => setSpeakerMode((v) => !v)}
                >
                  <Mic className="h-3 w-3 mr-1" /> {speakerMode ? "Outline mode" : "Speaker notes mode"}
                </Button>
              </div>
              <div className="space-y-1.5">
                {output.slides.map((s, i) => {
                  const expanded = expandedSlide === i;
                  return (
                    <div key={`${s.id}-${i}`} className="rounded border bg-background">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between p-2.5 text-left"
                        onClick={() => setExpandedSlide(expanded ? null : i)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[11px] text-muted-foreground w-6 flex-shrink-0">{i + 1}</span>
                          <span className="text-sm font-medium text-foreground truncate">{s.title}</span>
                          <Badge variant="outline" className="text-[9px]">{SLIDE_TITLES[s.id]}</Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground ml-2 flex-shrink-0">
                          {expanded ? "Hide" : "Expand"}
                        </span>
                      </button>
                      {expanded && (
                        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border">
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Purpose</div>
                            <p className="text-xs text-foreground">{s.purpose}</p>
                          </div>
                          {!speakerMode && (
                            <>
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Talking points</div>
                                <ul className="text-xs space-y-0.5 list-disc pl-5 text-foreground">
                                  {s.talkingPoints.map((t, j) => <li key={j}>{t}</li>)}
                                </ul>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400 mb-0.5">What investors look for</div>
                                <ul className="text-xs space-y-0.5 list-disc pl-5 text-foreground">
                                  {s.investorExpectations.map((t, j) => <li key={j}>{t}</li>)}
                                </ul>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-0.5">Common pitfalls</div>
                                <ul className="text-xs space-y-0.5 list-disc pl-5 text-foreground">
                                  {s.pitfalls.map((t, j) => <li key={j}>{t}</li>)}
                                </ul>
                              </div>
                            </>
                          )}
                          <div className="rounded bg-primary/5 border border-primary/20 p-2">
                            <div className="text-[10px] uppercase tracking-wide text-primary mb-0.5 flex items-center gap-1">
                              <Mic className="h-3 w-3" /> Speaker notes (30–60s)
                            </div>
                            <p className="text-xs text-foreground italic">{s.speakerNotes}</p>
                          </div>
                          <div className="flex gap-1.5">
                            <CopyButton
                              getText={() => {
                                const parts = [
                                  `### Slide ${i + 1}: ${s.title}`,
                                  "",
                                  `**Purpose:** ${s.purpose}`,
                                  "",
                                  "**Talking points:**",
                                  ...s.talkingPoints.map((t) => `- ${t}`),
                                  "",
                                  "**Speaker notes:**",
                                  s.speakerNotes,
                                ];
                                return parts.join("\n");
                              }}
                              label="Copy slide"
                              size="icon-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* LLM result */}
          {llmResult && (
            <Card>
              <CardContent className="p-4 space-y-3 border-l-4 border-l-primary">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> LLM polish
                </h3>
                {llmResult.refinedSlides.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Refined talking points</div>
                    <ul className="text-xs space-y-2 list-disc pl-5">
                      {llmResult.refinedSlides.map((s, i) => (
                        <li key={i}>
                          <strong>{s.title}</strong>
                          <ul className="list-[circle] pl-4 mt-0.5 space-y-0.5">
                            {s.refinedTalkingPoints.map((t, j) => <li key={j}>{t}</li>)}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {llmResult.narrativeSuggestions.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Narrative suggestions</div>
                    <ul className="text-xs space-y-0.5 list-disc pl-5">
                      {llmResult.narrativeSuggestions.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {llmResult.openQuestions.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Open questions to answer</div>
                    <ul className="text-xs space-y-0.5 list-disc pl-5">
                      {llmResult.openQuestions.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* LLM panel */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <button
                className="flex w-full items-center justify-between text-left"
                onClick={() => setShowLlm((v) => !v)}
              >
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Key className="h-4 w-4" /> Optional: polish with your LLM API key
                </h3>
                {showLlm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              {showLlm && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    For sharper, more idiomatic talking points than the templates produce. Your key is stored only in localStorage on this device. The request goes directly from your browser to the provider.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={llmProvider}
                      onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                      className="h-8 text-xs rounded border bg-background px-2"
                    >
                      <option value="openai">OpenAI (gpt-4o-mini)</option>
                      <option value="anthropic">Anthropic (claude-3-5-haiku)</option>
                    </select>
                    <Input
                      type="password"
                      value={llmKey}
                      onChange={(e) => setLlmKey(e.target.value)}
                      placeholder={llmProvider === "openai" ? "sk-…" : "sk-ant-…"}
                      className="h-8 text-xs flex-1 min-w-[200px]"
                    />
                    <Button size="sm" variant="outline" onClick={handleSaveKey}>Save key</Button>
                  </div>
                  <RunButton onClick={handleLlm} loading={llmLoading} label="Polish with LLM" />
                  {llmError && <ErrorBanner message={llmError} />}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!output && (
        <EmptyState
          title="Fill in your startup inputs to generate an outline"
          hint="Four deck-type presets (pre-seed, seed, Series A, sales deck). Canonical 10–12 slide sequence with talking points, investor expectations, and common pitfalls per slide. Narrative-arc check, use-of-funds breakdown, milestones, speaker-notes mode, Markdown export. 100% client-side."
          icon={<Presentation className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length}/{HISTORY_MAX})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex items-center justify-between">
                  <div>
                    <Badge variant="outline" className="mr-2 text-[10px]">{STAGE_LABELS[h.stage]}</Badge>
                    <span className="font-medium">{h.companyName}</span>
                    <span className="text-muted-foreground ml-2">· {h.industry || "—"}</span>
                    <span className="text-muted-foreground ml-2">· {h.slideCount} slides</span>
                  </div>
                  <span className="text-muted-foreground text-[11px]">{new Date(h.ts).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Honesty:</strong> This tool builds the <em>outline and narrative spine</em> of your deck — it does NOT design slides, write financials, or verify your traction numbers. Traction and financial numbers MUST be real (investors will find fake numbers in due diligence). Design comes after story. Use the exported Markdown as a starting point to drop into your slide tool of choice (Pitch, Gamma, Google Slides, Keynote, PowerPoint). All generation runs locally; nothing is uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
