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
  HISTORY_KEY,
  LLM_KEY_STORAGE,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  LEAN_LABELS,
  SENSITIVITY_LABELS,
  analyze,
  computeStats,
  renderMarkdown,
  renderJson,
  renderHtml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type BiasCategory,
  type LeanLabel,
  type Sensitivity,
  type HistoryEntry,
  type BiasReport,
  type LlmEnhancement,
} from "./logic";
import {
  Scale, Sparkles, Key, History, AlertCircle, BookOpen, FileText,
  Shield, Quote, Lightbulb, Eye, EyeOff,
} from "lucide-react";

const SAMPLE_NEUTRAL =
  "The committee met on Tuesday to discuss the proposal. According to a 2024 report from the bureau, 45% of residents agreed with the plan. However, critics noted methodological limitations in the survey.";
const SAMPLE_LOADED =
  "The radical progressive agenda will destroy our society. Some say it is the worst plan ever. You won't believe what happens next! Everyone must act now.";

export default function AiBiasChecker() {
  const [text, setText] = useState("");
  const [sensitivity, setSensitivity] = useState<Sensitivity>("medium");
  const [report, setReport] = useState<BiasReport | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<LlmEnhancement | null>(null);
  const [showNeutral, setShowNeutral] = useState(false);
  const [showReasoning, setShowReasoning] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem(LLM_KEY_STORAGE)
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.text) {
        setText(p.text);
        setSensitivity(p.sensitivity);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const handleAnalyze = useCallback(() => {
    setError("");
    try {
      const r = analyze(text, sensitivity);
      setReport(r);
      setLlmResult(null);
      if (text.trim()) {
        saveHistory({
          ts: Date.now(),
          snippet: text.slice(0, 80),
          overall: r.scores.overall,
          leanLabel: r.scores.leanLabel,
        });
        setHistory(loadHistory());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    }
  }, [text, sensitivity]);

  const stats = useMemo(() => (report ? computeStats(report) : null), [report]);

  const handleClear = useCallback(() => {
    setText("");
    setReport(null);
    setLlmResult(null);
    setError("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
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
    if (!text.trim()) {
      toast.error("Paste an article first");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    setLlmResult(null);
    try {
      const prompt = buildLlmPrompt(text);
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
          temperature: 0.3,
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
      toast.success("LLM enhancement applied");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "LLM call failed";
      setLlmError(msg);
      toast.error(msg);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, text]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="abc-text">Article text</Label>
            <Textarea
              id="abc-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste an article, news story, op-ed, or blog post…"
              className="min-h-[180px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setText(SAMPLE_LOADED)}>
                Load loaded sample
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setText(SAMPLE_NEUTRAL)}>
                Load neutral sample
              </Button>
              <div className="ml-auto flex items-center gap-1.5">
                <Label className="text-[11px] text-muted-foreground">Sensitivity</Label>
                <select
                  value={sensitivity}
                  onChange={(e) => setSensitivity(e.target.value as Sensitivity)}
                  className="h-7 text-xs rounded border bg-background px-2"
                >
                  {(["low", "medium", "high"] as Sensitivity[]).map((s) => (
                    <option key={s} value={s}>{SENSITIVITY_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleAnalyze} disabled={!text.trim()} label="Analyze bias" />
            <CopyButton
              getText={() => report ? renderMarkdown(report) : ""}
              label="Copy Markdown"
              disabled={!report}
            />
            <DownloadButton
              getText={() => report ? renderMarkdown(report) : ""}
              filename="bias-report.md"
              mime="text/markdown"
              label="Download .md"
              disabled={!report}
            />
            <DownloadButton
              getText={() => report ? renderJson(report) : ""}
              filename="bias-report.json"
              mime="application/json"
              label="Download JSON"
              disabled={!report}
            />
            <DownloadButton
              getText={() => report ? renderHtml(report) : ""}
              filename="bias-report.html"
              mime="text/html"
              label="Download HTML"
              disabled={!report}
            />
            <ShareButton getUrl={() => buildShareUrl(text, sensitivity)} disabled={!text.trim()} />
            <ClearButton onClick={handleClear} disabled={!text && !report} />
          </div>
          {error && <ErrorBanner message={error} />}
        </CardContent>
      </Card>

      {report && stats && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Scale className="h-4 w-4" /> Bias scores
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <ScoreStat label="Overall bias" value={`${report.scores.overall}/100`} tone={report.scores.overall > 50 ? "bad" : report.scores.overall > 25 ? "warn" : "good"} />
                <ScoreStat label="Political lean" value={LEAN_LABELS[report.scores.leanLabel]} tone={Math.abs(report.scores.politicalLean) > 50 ? "bad" : Math.abs(report.scores.politicalLean) > 15 ? "warn" : "good"} />
                <ScoreStat label="Lean score" value={`${report.scores.politicalLean > 0 ? "+" : ""}${report.scores.politicalLean}`} />
                <ScoreStat label="Lean confidence" value={`${report.scores.politicalConfidence}%`} />
                <ScoreStat label="Emotional tone" value={`${report.scores.emotional}/100`} tone={report.scores.emotional > 60 ? "bad" : report.scores.emotional > 30 ? "warn" : "good"} />
                <ScoreStat label="Factual density" value={`${report.scores.factual}/100`} tone={report.scores.factual > 60 ? "good" : report.scores.factual > 30 ? "warn" : "bad"} />
                <ScoreStat label="One-sidedness" value={`${report.scores.oneSidedness}/100`} tone={report.scores.oneSidedness > 60 ? "bad" : report.scores.oneSidedness > 30 ? "warn" : "good"} />
                <ScoreStat label="Sensationalism" value={`${report.scores.sensationalism}/100`} tone={report.scores.sensationalism > 60 ? "bad" : report.scores.sensationalism > 30 ? "warn" : "good"} />
                <ScoreStat label="Readability" value={`${report.readability.fleschScore}/100`} />
              </div>
              <div className="text-xs text-muted-foreground">
                Readability: <span className="text-foreground">{report.readability.label}</span> · Grade level: <span className="text-foreground">{report.readability.gradeLevel}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Words" value={stats.wordCount} />
                <Stat label="Sentences" value={stats.sentenceCount} />
                <Stat label="Flagged phrases" value={stats.phraseCount} />
                <Stat label="Clickbait" value={report.clickbait ? "Yes" : "No"} highlight={report.clickbait ? "bad" : "good"} />
              </div>
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <Badge variant="outline">Fact: {report.factCount}</Badge>
                <Badge variant="outline">Opinion: {report.opinionCount}</Badge>
                <Badge variant="outline">Mixed: {report.mixedCount}</Badge>
                <Badge variant="outline">Neutral: {report.neutralCount}</Badge>
              </div>
            </CardContent>
          </Card>

          {report.clickbait && (
            <Card>
              <CardContent className="p-4 space-y-1">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" /> Clickbait signals
                </h3>
                <ul className="text-xs space-y-1 list-disc pl-5">
                  {report.clickbaitReasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Quote className="h-4 w-4" /> Highlighted article ({report.phrases.length} phrases)
                </h3>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                {(Object.keys(CATEGORY_LABELS) as BiasCategory[]).map((c) => (
                  <Badge key={c} variant="outline" className="text-[10px]" style={{ color: CATEGORY_COLORS[c], borderColor: CATEGORY_COLORS[c] }}>
                    {CATEGORY_LABELS[c]}: {stats.byCategory[c]}
                  </Badge>
                ))}
              </div>
              <div
                className="prose prose-sm max-w-none rounded border bg-background p-3 text-xs leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderHtml(report) }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <button
                className="flex w-full items-center justify-between text-left"
                onClick={() => setShowReasoning((v) => !v)}
              >
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4" /> Lean reasoning
                </h3>
                {showReasoning ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              {showReasoning && (
                <ul className="text-xs space-y-1 list-disc pl-5">
                  {report.reasoning.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> Missing-perspective checklist
              </h3>
              <ul className="text-xs space-y-1">
                {report.missingPerspectives.map((m, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className={m.detected ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                      {m.detected ? "✓" : "✗"}
                    </span>
                    <span className={m.detected ? "text-foreground" : "text-muted-foreground"}>
                      {m.label}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <button
                className="flex w-full items-center justify-between text-left"
                onClick={() => setShowNeutral((v) => !v)}
              >
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Shield className="h-4 w-4" /> Neutral rewrite
                </h3>
                {showNeutral ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              {showNeutral && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Loaded terms replaced with neutral suggestions, subjective adjectives stripped, weasel words marked with <code>[who?]</code>. A starting point for editing — not a final polish.
                  </p>
                  <div className="rounded border bg-background p-3 text-xs leading-relaxed whitespace-pre-wrap">
                    {report.neutralRewrite || "_(no phrases to neutralize)_"}
                  </div>
                  <CopyButton getText={() => report.neutralRewrite} label="Copy rewrite" disabled={!report.neutralRewrite} />
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Flagged sentences
              </h3>
              <div className="space-y-2 max-h-[400px] overflow-auto">
                {report.sentences.filter((s) => s.phrases.length > 0).map((s, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                    <Badge variant="outline" className="mr-1.5 text-[10px]">{s.type}</Badge>
                    <Badge variant="outline" className="mr-1.5 text-[10px]">emo {s.emotionScore}</Badge>
                    <Badge variant="outline" className="text-[10px]">subj {s.subjectivityScore}</Badge>
                    <div className="mt-1 text-foreground">{s.text}</div>
                    <ul className="mt-1 space-y-0.5 text-[11px]">
                      {s.phrases.map((p, j) => (
                        <li key={j} className="flex items-center gap-1.5">
                          <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ background: CATEGORY_COLORS[p.category] }}
                          />
                          <span className="font-mono text-muted-foreground">{CATEGORY_LABELS[p.category]}:</span>
                          <span className="font-mono">"{p.text}"</span>
                          {p.suggestion !== undefined && (
                            <span className="text-muted-foreground">→ <em>{p.suggestion || "(remove)"}</em></span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {report.sentences.filter((s) => s.phrases.length > 0).length === 0 && (
                  <p className="text-xs text-muted-foreground">No flagged phrases.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {llmResult && (
            <Card>
              <CardContent className="p-4 space-y-2 border-l-4 border-l-primary">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> LLM enhancement
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <Stat label="Lean" value={LEAN_LABELS[llmResult.lean]} />
                  <Stat label="Confidence" value={`${llmResult.leanConfidence}%`} />
                  <Stat label="Emotional" value={`${llmResult.emotionScore}/100`} />
                  <Stat label="Factual" value={`${llmResult.factualScore}/100`} />
                  <Stat label="One-sided" value={`${llmResult.oneSidednessScore}/100`} />
                  <Stat label="Sensationalism" value={`${llmResult.sensationalismScore}/100`} />
                </div>
                {llmResult.flaggedPhrases.length > 0 && (
                  <div className="text-xs">
                    <div className="text-muted-foreground">Flagged phrases:</div>
                    <ul className="list-disc pl-5 mt-1">
                      {llmResult.flaggedPhrases.map((p, i) => (
                        <li key={i}>
                          <span className="font-mono">"{p.phrase}"</span> ({p.category})
                          {p.suggestion && <span className="text-muted-foreground"> → <em>{p.suggestion}</em></span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {llmResult.missingPerspectives.length > 0 && (
                  <div className="text-xs">
                    <div className="text-muted-foreground">Missing perspectives:</div>
                    <ul className="list-disc pl-5 mt-1">
                      {llmResult.missingPerspectives.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  </div>
                )}
                {llmResult.reasoning.length > 0 && (
                  <div className="text-xs">
                    <div className="text-muted-foreground">Reasoning:</div>
                    <ul className="list-disc pl-5 mt-1">
                      {llmResult.reasoning.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}
                {llmResult.neutralRewrite && (
                  <div className="text-xs">
                    <div className="text-muted-foreground">Neutral rewrite:</div>
                    <div className="rounded border bg-background p-2 mt-1">{llmResult.neutralRewrite}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <button
                className="flex w-full items-center justify-between text-left"
                onClick={() => setShowLlm((v) => !v)}
              >
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Key className="h-4 w-4" /> Optional: enhance with your LLM API key
                </h3>
                {showLlm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              {showLlm && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    For nuance the offline lexicons miss (subtle framing, context-dependent slant). Your key is stored only in localStorage on this device. The request goes directly from your browser to the provider.
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
                  <RunButton onClick={handleLlm} loading={llmLoading} label="Enhance with LLM" />
                  {llmError && <ErrorBanner message={llmError} />}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!report && (
        <EmptyState
          title="Paste an article to detect bias signals"
          hint="Multi-axis scoring (political lean, emotional tone, factual density, one-sidedness, sensationalism), inline phrase highlighting, fact-vs-opinion tagging, missing-perspective checklist, and one-click neutral rewrite. 100% client-side."
          icon={<Scale className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{LEAN_LABELS[h.leanLabel]}</Badge>
                  <Badge variant="outline" className="mr-2">{h.overall}/100</Badge>
                  <span className="text-muted-foreground">{h.snippet}</span>
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
            <strong className="text-foreground">Honesty:</strong> This tool analyzes <em>language patterns</em> — it does NOT fact-check the claims in the article or judge whether they are true. It rates the text, not the outlet. Lean is estimated from loaded political vocabulary only. All analysis runs locally in your browser; nothing is uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ScoreStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
}) {
  const color = tone === "bad"
    ? "text-red-600 dark:text-red-400"
    : tone === "warn"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "good"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
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

// Suppress unused-import lint
export const _historyKey = HISTORY_KEY;
