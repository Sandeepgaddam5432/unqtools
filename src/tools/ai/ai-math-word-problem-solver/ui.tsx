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
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  CATEGORY_LABELS,
  OPERATION_LABELS,
  LLM_KEY_STORAGE,
  SAMPLE_PROBLEMS,
  classifyProblem,
  solveProblem,
  formatStepsMarkdown,
  formatStepsText,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type HistoryEntry,
} from "./logic";
import {
  Calculator, History, Key, Sparkles, CheckCircle2, AlertTriangle,
  BookOpen,
} from "lucide-react";

export default function AiMathWordProblemSolver() {
  const [problem, setProblem] = useState("");
  const [solved, setSolved] = useState<ReturnType<typeof solveProblem> | null>(null);
  const [tab, setTab] = useState<"steps" | "text">("steps");
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
      if (p) {
        setProblem(p);
        setSolved(solveProblem(p));
        toast.info("Loaded problem from share link");
      }
    }
  }, []);

  const handleSolve = useCallback(() => {
    if (!problem.trim()) {
      toast.error("Enter a problem first");
      return;
    }
    const sol = solveProblem(problem);
    setSolved(sol);
    saveHistory({
      ts: Date.now(),
      problem,
      category: sol.category,
      answer: sol.answer,
      verified: sol.verified,
    });
    setHistory(loadHistory());
    if (sol.verified) {
      toast.success(`Solved — ${sol.answer}`);
    } else {
      toast.warning("Best-effort answer — see warnings");
    }
  }, [problem]);

  const handleClear = useCallback(() => {
    setProblem("");
    setSolved(null);
    setLlmResult("");
    setLlmError(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadSample = useCallback((p: string) => {
    setProblem(p);
    const sol = solveProblem(p);
    setSolved(sol);
    saveHistory({
      ts: Date.now(),
      problem: p,
      category: sol.category,
      answer: sol.answer,
      verified: sol.verified,
    });
    setHistory(loadHistory());
  }, []);

  const handleLlmKeySave = useCallback(() => {
    try {
      localStorage.setItem(LLM_KEY_STORAGE, llmKey);
      toast.success("API key saved (localStorage only)");
    } catch {
      toast.error("Could not save API key");
    }
  }, [llmKey]);

  const handleLlmSetup = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your own LLM API key first");
      return;
    }
    if (!problem.trim()) {
      toast.error("Enter a problem first");
      return;
    }
    setLlmBusy(true);
    setLlmError(null);
    try {
      const prompt = buildLlmPrompt(problem);
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
          temperature: 0.3,
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
      toast.success("LLM setup applied — verify and use as a guide");
    } catch (e) {
      setLlmError(e instanceof Error ? e.message : "LLM call failed");
      toast.error("LLM call failed");
    } finally {
      setLlmBusy(false);
    }
  }, [llmKey, problem]);

  const markdownOutput = useMemo(
    () => (solved ? formatStepsMarkdown(solved, problem) : ""),
    [solved, problem],
  );
  const textOutput = useMemo(
    () => (solved ? formatStepsText(solved, problem) : ""),
    [solved, problem],
  );
  const currentOutput = tab === "steps" ? markdownOutput : textOutput;
  const detectedCategory = useMemo(
    () => (problem.trim() ? classifyProblem(problem) : "unknown"),
    [problem],
  );

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="amw-problem" className="text-xs">Word problem</Label>
            <Textarea
              id="amw-problem"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder={"e.g., What is 25 percent of 80?"}
              className="min-h-[100px] resize-y text-sm"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                Detected: {CATEGORY_LABELS[detectedCategory]}
              </Badge>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="text-[10px] text-muted-foreground">{problem.length} chars</span>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Sample problems</Label>
            <div className="flex flex-wrap gap-1 max-h-[80px] overflow-auto">
              {SAMPLE_PROBLEMS.map((s) => (
                <Button
                  key={s.name}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => handleLoadSample(s.problem)}
                >+ {s.name}</Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSolve} disabled={!problem.trim()} className="gap-1.5">
              <Calculator className="h-3.5 w-3.5" /> Solve problem
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLlm((v) => !v)}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" /> {showLlm ? "Hide" : "LLM setup help"}
            </Button>
            <ClearButton onClick={handleClear} />
          </div>

          {showLlm && (
            <div className="rounded border bg-muted/30 p-3 space-y-2">
              <Label className="text-xs flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5" /> OpenAI API key (BYO — stored in localStorage only)
              </Label>
              <Input
                type="password"
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder="sk-..."
                className="font-mono text-xs"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleLlmKeySave}>Save key</Button>
                <Button
                  size="sm"
                  onClick={handleLlmSetup}
                  disabled={llmBusy || !llmKey || !problem.trim()}
                  className="gap-1.5"
                >
                  {llmBusy ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {llmBusy ? "Setting up…" : "Generate setup (no final answer)"}
                </Button>
              </div>
              {llmError && <ErrorBanner message={llmError} />}
              {llmResult && (
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">LLM setup (review and use as a guide — our engine still verifies the arithmetic)</Label>
                  <pre className="whitespace-pre-wrap rounded border bg-background p-2 text-[11px] font-mono max-h-[200px] overflow-auto">{llmResult}</pre>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {solved ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Calculator className="h-4 w-4" /> Solution
                </h3>
                <Badge variant="secondary" className="text-[10px]">{CATEGORY_LABELS[solved.category]}</Badge>
                {solved.verified ? (
                  <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Not verified
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Category" value={CATEGORY_LABELS[solved.category]} />
                <Stat label="Numbers found" value={solved.numbers.length} />
                <Stat label="Steps" value={solved.steps.length} />
                <Stat label="Answer" value={solved.answer} highlight={solved.verified ? "good" : "bad"} />
              </div>
              {solved.units && (
                <p className="text-[11px] text-muted-foreground">Units detected: <span className="font-mono">{solved.units}</span></p>
              )}
              {solved.equation && (
                <div className="rounded border bg-muted/30 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Equation</div>
                  <code className="text-xs font-mono">{solved.equation}</code>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {(["steps", "text"] as const).map((t) => (
                    <Button
                      key={t}
                      variant={tab === t ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => setTab(t)}
                    >{t === "steps" ? "Markdown" : "Plain text"}</Button>
                  ))}
                </div>
              </div>

              {/* Steps list (always shown for visual structure) */}
              {solved.steps.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Steps</div>
                  {solved.steps.map((s, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="font-medium text-foreground">{i + 1}. {s.label}</div>
                      {s.expression && <div className="font-mono text-muted-foreground mt-0.5">{s.expression}</div>}
                      {s.result && <div className="font-mono text-foreground mt-0.5">→ {s.result}</div>}
                    </div>
                  ))}
                </div>
              )}

              <Textarea
                value={currentOutput}
                readOnly
                className="min-h-[200px] resize-y font-mono text-xs"
              />

              {solved.verificationNote && (
                <div className="rounded border bg-muted/30 p-2 text-[11px]">
                  <span className="font-medium text-foreground">Verification: </span>
                  <span className="text-muted-foreground">{solved.verificationNote}</span>
                </div>
              )}
              {solved.alternativeMethod && (
                <div className="rounded border bg-muted/30 p-2 text-[11px]">
                  <span className="font-medium text-foreground">Alternative method: </span>
                  <span className="text-muted-foreground">{solved.alternativeMethod}</span>
                </div>
              )}
              {solved.assumptions.length > 0 && (
                <div className="rounded border bg-blue-50 dark:bg-blue-950/30 p-2 text-[11px]">
                  <div className="font-medium text-foreground">Assumptions</div>
                  <ul className="list-disc pl-4 text-muted-foreground">
                    {solved.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}
              {solved.warnings.length > 0 && (
                <div className="rounded border bg-amber-50 dark:bg-amber-950/30 p-2 text-[11px]">
                  <div className="font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Warnings
                  </div>
                  <ul className="list-disc pl-4 text-amber-700 dark:text-amber-400">
                    {solved.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <CopyButton getText={() => currentOutput} label={`Copy ${tab === "steps" ? "Markdown" : "text"}`} />
                <DownloadButton
                  getText={() => textOutput}
                  filename="solution.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <ShareButton getUrl={() => buildShareUrl(problem)} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a math word problem to solve"
          hint="Type or paste a problem, or click a sample. Pattern-based classifier detects arithmetic, algebra, geometry, percentage, ratio, rate, and mixture problems — then extracts numbers, sets up the equation, computes the answer with a deterministic engine, and verifies it."
          icon={<Calculator className="h-8 w-8" />}
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
                  onClick={() => { setProblem(h.problem); setSolved(solveProblem(h.problem)); toast.info("Loaded from history"); }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-accent"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">{CATEGORY_LABELS[h.category]}</Badge>
                  {h.verified && (
                    <Badge variant="outline" className="mr-2 text-[10px] text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                    </Badge>
                  )}
                  <Badge variant="outline" className="mr-2 text-[10px] font-mono">{h.answer}</Badge>
                  <span className="text-muted-foreground truncate">{h.problem.slice(0, 60)}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3 space-y-1">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All classification, extraction, equation setup, computation, and verification run locally in your browser. Your problem text never leaves this device. The only network call is if you paste your own LLM API key and click 'Generate setup' — even then, the final arithmetic is verified locally by our deterministic engine.
          </p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <BookOpen className="inline h-3 w-3" /> Honesty: the classifier can misread a problem — verify the equation setup against the original wording. Problems needing diagrams (complex geometry) are flagged, not silently solved.
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
      <div className={`text-sm font-semibold ${color} truncate`}>{value}</div>
    </div>
  );
}
