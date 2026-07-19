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
  FALLACIES,
  FALLACY_IDS,
  FALLACY_MAP,
  SENSITIVITY_LABELS,
  CATEGORY_LABELS,
  SAMPLE_ARGUMENTS,
  LLM_KEY_STORAGE,
  analyze,
  buildHighlightSegments,
  renderMarkdownReport,
  suggestSteelman,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Sensitivity,
  type FallacyId,
  type HistoryEntry,
} from "./logic";
import {
  ScanSearch, History, Key, Sparkles, AlertTriangle,
  BookOpen, ShieldCheck, Lightbulb,
} from "lucide-react";

type Tab = "report" | "encyclopedia" | "history";

export default function AiLogicalFallacyDetector() {
  const [text, setText] = useState("");
  const [sensitivity, setSensitivity] = useState<Sensitivity>("balanced");
  const [onlyIds, setOnlyIds] = useState<FallacyId[]>([]);
  const [tab, setTab] = useState<Tab>("report");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmBusy, setLlmBusy] = useState(false);
  const [llmResult, setLlmResult] = useState("");
  const [llmError, setLlmError] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    try {
      const k = localStorage.getItem(LLM_KEY_STORAGE);
      if (k) setLlmKey(k);
    } catch { /* ignore */ }
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.text) setText(p.text);
      if (p.sensitivity) setSensitivity(p.sensitivity);
      if (p.onlyIds.length > 0) setOnlyIds(p.onlyIds);
      if (p.text || p.onlyIds.length > 0) toast.info("Loaded from share link");
    }
  }, []);

  const result = useMemo(
    () => analyze(text, { sensitivity, onlyIds: onlyIds.length > 0 ? onlyIds : undefined }),
    [text, sensitivity, onlyIds],
  );
  const segments = useMemo(
    () => buildHighlightSegments(text, result.detections),
    [text, result.detections],
  );
  const report = useMemo(
    () => renderMarkdownReport(text, result),
    [text, result],
  );
  const steelman = useMemo(
    () => suggestSteelman(text, result.detections),
    [text, result.detections],
  );

  const handleSaveHistory = useCallback(() => {
    if (!text.trim()) return;
    const top = result.detections
      .slice()
      .sort((a, b) => b.confidence - a.confidence)[0];
    saveHistory({
      ts: Date.now(),
      textLength: text.length,
      sensitivity,
      totalDetections: result.detections.length,
      topFallacy: top ? top.name : null,
    });
    setHistory(loadHistory());
  }, [text, sensitivity, result.detections]);

  const handleClear = useCallback(() => {
    setText("");
    setOnlyIds([]);
    setSensitivity("balanced");
    setLlmResult("");
    setLlmError(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const toggleFallacy = (id: FallacyId) => {
    setOnlyIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleLlmKeySave = useCallback(() => {
    try {
      localStorage.setItem(LLM_KEY_STORAGE, llmKey);
      toast.success("API key saved (localStorage only)");
    } catch {
      toast.error("Could not save API key");
    }
  }, [llmKey]);

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your own LLM API key first");
      return;
    }
    if (!text.trim()) {
      toast.error("Paste an argument first");
      return;
    }
    setLlmBusy(true);
    setLlmError(null);
    try {
      const prompt = buildLlmPrompt(text, sensitivity);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llmKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
          temperature: 0.2,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`LLM API error ${res.status}: ${errText.slice(0, 200)}`);
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = data.choices?.[0]?.message?.content ?? "";
      const rendered = renderLlmResult(raw);
      setLlmResult(rendered);
      toast.success("LLM analysis complete — verify the result!");
    } catch (e) {
      setLlmError(e instanceof Error ? e.message : "LLM call failed");
      toast.error("LLM call failed");
    } finally {
      setLlmBusy(false);
    }
  }, [llmKey, text, sensitivity]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="lfd-text">Paste an argument, essay, or debate transcript</Label>
            <Textarea
              id="lfd-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"e.g. So you're saying we should just let criminals run free? Everyone knows your plan can't work."}
              className="min-h-[140px] resize-y text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {SAMPLE_ARGUMENTS.map((s) => (
                <Button
                  key={s.label}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setText(s.text)}
                >+ {s.label}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Sensitivity</Label>
              <select
                value={sensitivity}
                onChange={(e) => setSensitivity(e.target.value as Sensitivity)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {(["strict", "balanced", "lenient"] as Sensitivity[]).map((s) => (
                  <option key={s} value={s}>{SENSITIVITY_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Filter (optional — leave empty for all 23)</Label>
              <div className="text-[10px] text-muted-foreground">
                {onlyIds.length === 0 ? "All fallacies enabled" : `${onlyIds.length} selected`}
              </div>
            </div>
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Toggle individual fallacies ({onlyIds.length}/{FALLACY_IDS.length} selected)</summary>
            <div className="flex flex-wrap gap-1.5 pt-2">
              {FALLACIES.map((f) => (
                <label key={f.id} className="flex items-center gap-1 text-[10px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyIds.includes(f.id)}
                    onChange={() => toggleFallacy(f.id)}
                  />
                  {f.name}
                </label>
              ))}
            </div>
          </details>
        </CardContent>
      </Card>

      {text.trim() && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total flags" value={result.stats.total} highlight={result.stats.total > 0 ? "bad" : "good"} />
                <Stat label="Words" value={text.trim().split(/\s+/).length} />
                <Stat label="Sensitivity" value={SENSITIVITY_LABELS[sensitivity].split(" ")[0]} />
                <Stat label="Fallacies tracked" value={FALLACIES.length} />
              </div>
              {result.stats.total > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((c) =>
                    result.stats.byCategory[c] > 0 ? (
                      <Badge key={c} variant="outline" className="text-[10px]">
                        {CATEGORY_LABELS[c]}: {result.stats.byCategory[c]}
                      </Badge>
                    ) : null,
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ScanSearch className="h-4 w-4" /> Highlighted argument
                </h3>
                <div className="flex flex-wrap gap-1">
                  {(["report", "encyclopedia", "history"] as Tab[]).map((t) => (
                    <Button
                      key={t}
                      size="sm"
                      variant={tab === t ? "default" : "outline"}
                      onClick={() => setTab(t)}
                      className="h-7 text-xs capitalize"
                    >{t}</Button>
                  ))}
                </div>
              </div>

              {tab === "report" && (
                <div className="space-y-3">
                  <div className="rounded border bg-background p-3 text-sm leading-relaxed">
                    {segments.map((seg, i) =>
                      seg.detection ? (
                        <mark
                          key={i}
                          className="bg-yellow-200 dark:bg-yellow-900/60 rounded px-0.5 cursor-help"
                          title={`${seg.detection.name} (${(seg.detection.confidence * 100).toFixed(0)}%) — ${seg.detection.explanation}`}
                        >
                          {seg.text}
                        </mark>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      ),
                    )}
                  </div>

                  {result.detections.length > 0 ? (
                    <div className="space-y-2 max-h-[420px] overflow-auto">
                      {result.detections.map((d, i) => {
                        const info = FALLACY_MAP[d.id];
                        return (
                          <div key={i} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary" className="text-[10px]">{d.name}</Badge>
                              <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[d.category]}</Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {(d.confidence * 100).toFixed(0)}% conf
                              </Badge>
                              <span className="font-mono text-muted-foreground text-[10px]">trigger: {d.trigger}</span>
                            </div>
                            <div className="text-foreground italic">&ldquo;{d.snippet}&rdquo;</div>
                            <div><strong className="text-foreground">Why flagged:</strong> <span className="text-muted-foreground">{d.explanation}</span></div>
                            <div><strong className="text-foreground">Steelman:</strong> <span className="text-muted-foreground">{d.steelman}</span></div>
                            <div className="flex items-start gap-1 text-amber-700 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              <span><strong>False-positive risk:</strong> {d.falsePositiveRisk}</span>
                            </div>
                            {info && (
                              <div className="text-[10px] text-muted-foreground pt-1 border-t">
                                <BookOpen className="inline h-3 w-3 mr-1" />
                                Encyclopedia: {info.description} <em>Example: {info.example}</em>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                      <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>No fallacy patterns matched at this sensitivity. This is not a guarantee — context still matters.</span>
                    </div>
                  )}

                  {result.detections.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground flex items-center gap-1">
                        <Lightbulb className="h-3 w-3" /> Steelman suggestion
                      </summary>
                      <pre className="whitespace-pre-wrap text-[11px] font-mono mt-2 rounded border bg-background p-2">{steelman}</pre>
                    </details>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    <CopyButton
                      getText={() => { handleSaveHistory(); return report; }}
                      label="Copy report"
                    />
                    <DownloadButton
                      getText={() => { handleSaveHistory(); return report; }}
                      filename="fallacy-report.md"
                      mime="text/markdown"
                      label="Download .md"
                    />
                    <ShareButton
                      getUrl={() => {
                        handleSaveHistory();
                        return buildShareUrl({ text, sensitivity, onlyIds });
                      }}
                    />
                    <ClearButton onClick={handleClear} />
                  </div>
                </div>
              )}

              {tab === "encyclopedia" && (
                <div className="space-y-2 max-h-[500px] overflow-auto">
                  {FALLACIES.map((f) => (
                    <div key={f.id} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">{f.name}</Badge>
                        <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[f.category]}</Badge>
                      </div>
                      <div className="text-foreground">{f.description}</div>
                      <div className="text-muted-foreground"><em>Example:</em> {f.example}</div>
                      <div className="text-muted-foreground"><strong>Why flawed:</strong> {f.why}</div>
                      <div className="text-muted-foreground"><strong>Steelman:</strong> {f.steelmanHint}</div>
                    </div>
                  ))}
                </div>
              )}

              {tab === "history" && (
                <div className="space-y-2">
                  {history.length > 0 ? (
                    <>
                      <div className="flex justify-end">
                        <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear history</Button>
                      </div>
                      {history.map((h, i) => (
                        <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                          <Badge variant="outline" className="mr-2">{h.totalDetections} flags</Badge>
                          <Badge variant="outline" className="mr-2">{SENSITIVITY_LABELS[h.sensitivity].split(" ")[0]}</Badge>
                          <span className="text-muted-foreground">
                            {h.topFallacy ? `top: ${h.topFallacy}` : "no flags"} · {h.textLength} chars
                          </span>
                          <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <EmptyState
                      title="No history yet"
                      hint="Save an analysis with Copy report, Download, or Share to add to history."
                      icon={<History className="h-8 w-8" />}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <button
                className="text-sm font-semibold text-foreground flex items-center gap-1.5 w-full"
                onClick={() => setShowLlm((v) => !v)}
              >
                <Sparkles className="h-4 w-4" /> Optional: BYO-key LLM analysis
                <Key className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
              </button>
              {showLlm && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs text-muted-foreground">
                    Paste your own OpenAI API key (stored in localStorage only) and click analyze.
                    The request goes directly from your browser to OpenAI — your argument text
                    is sent to them, but never to us.
                  </p>
                  <Input
                    type="password"
                    value={llmKey}
                    onChange={(e) => setLlmKey(e.target.value)}
                    placeholder="sk-..."
                    className="text-xs font-mono"
                  />
                  <div className="flex flex-wrap gap-2">
                    <RunButton
                      onClick={handleLlmEnhance}
                      loading={llmBusy}
                      label="Analyze with LLM"
                      disabled={!text.trim()}
                    />
                    <Button variant="outline" size="sm" onClick={handleLlmKeySave}>Save key</Button>
                  </div>
                  {llmError && <ErrorBanner message={llmError} />}
                  {llmResult && (
                    <pre className="whitespace-pre-wrap text-[11px] font-mono rounded border bg-background p-2 max-h-[300px] overflow-auto">{llmResult}</pre>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!text.trim() && (
        <EmptyState
          title="Paste an argument to detect logical fallacies"
          hint="23 patterns: ad hominem, strawman, slippery slope, false dichotomy, appeal to authority/emotion/popularity, red herring, tu quoque, no true scotsman, post hoc, sunk cost, and more. Each flag is highlighted inline with an explanation, confidence, and steelman suggestion."
          icon={<ScanSearch className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Honesty:</strong> Fallacy detection is genuinely
            hard and context-sensitive. This is a reasoning aid, not an arbiter of truth —
            valid arguments can look fallacious out of context. All analysis runs locally;
            nothing is uploaded. The only network call is if you use your own LLM key.
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
