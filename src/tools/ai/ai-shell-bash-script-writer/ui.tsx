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
  TASK_PRESETS,
  CATEGORY_LABELS,
  normalizeTask,
  detectCategory,
  generateScript,
  lintScript,
  detectDestructive,
  explainScript,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  LLM_KEY_STORAGE,
  type ShellFlavor,
  type GeneratedScript,
  type HistoryEntry,
  type LlmEnhancement,
} from "./logic";
import {
  Terminal, Sparkles, Key, History, AlertTriangle,
  ShieldCheck, Wand2, FileText, ListChecks,
} from "lucide-react";

type Tab = "script" | "lint" | "explain";

export default function AiShellBashScriptWriter() {
  const [task, setTask] = useState("");
  const [flavor, setFlavor] = useState<ShellFlavor>("bash");
  const [dryRun, setDryRun] = useState(false);
  const [cron, setCron] = useState(false);
  const [result, setResult] = useState<GeneratedScript | null>(null);
  const [tab, setTab] = useState<Tab>("script");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [existing, setExisting] = useState("");
  const [existingExplained, setExistingExplained] = useState<{ sections: ReturnType<typeof explainScript> } | null>(null);

  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<LlmEnhancement | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined" ? localStorage.getItem(LLM_KEY_STORAGE) : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.task) {
        setTask(p.task);
        setFlavor(p.flavor);
        setDryRun(p.dryRun);
        setCron(p.cron);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const handleGenerate = useCallback(() => {
    const t = normalizeTask(task);
    if (!t) {
      toast.error("Describe a task first");
      return;
    }
    const r = generateScript(t, { flavor, dryRun, cron });
    setResult(r);
    setTab("script");
    saveHistory({
      ts: Date.now(),
      task: t,
      flavor,
      category: r.category,
      scriptPreview: r.script.slice(0, 200),
    });
    setHistory(loadHistory());
    if (r.destructive.length > 0) {
      toast.warning(`Destructive commands detected on ${r.destructive.length} line(s)`);
    } else {
      toast.success("Script generated");
    }
  }, [task, flavor, dryRun, cron]);

  const handleExplainExisting = useCallback(() => {
    if (!existing.trim()) {
      toast.error("Paste a script to explain first");
      return;
    }
    const sections = explainScript(existing);
    setExistingExplained({ sections });
    toast.success(`Explained ${sections.length} section(s)`);
  }, [existing]);

  const handleClear = useCallback(() => {
    setTask("");
    setResult(null);
    setExisting("");
    setExistingExplained(null);
    setLlmResult(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const detectedCat = useMemo(() => (task ? detectCategory(task) : "generic"), [task]);

  // Live lint of the generated script
  const liveLint = useMemo(
    () => (result ? lintScript(result.script) : []),
    [result],
  );

  // ---- LLM polish (BYO key) ----
  const handleLlm = useCallback(async () => {
    if (!llmKey) { toast.error("Paste your LLM API key first"); return; }
    const t = normalizeTask(task);
    if (!t) { toast.error("Describe a task to polish"); return; }
    setLlmLoading(true); setLlmError("");
    try {
      const prompt = buildLlmPrompt(t, flavor);
      const out = await callLlm(llmProvider, llmKey, prompt);
      const r = renderLlmResult(out);
      setLlmResult(r);
      if (r.script) {
        const gen = generateScript(t, { flavor, dryRun, cron });
        gen.script = r.script;
        gen.findings = lintScript(r.script);
        gen.destructive = detectDestructive(r.script);
        gen.sections = explainScript(r.script);
        gen.note = "Polished via BYO-key LLM.";
        setResult(gen);
        toast.success("LLM polish applied");
      }
    } catch (e) {
      setLlmError(e instanceof Error ? e.message : "LLM call failed");
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, task, flavor, dryRun, cron]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sh-task" className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Describe the task in plain English
            </Label>
            <Textarea
              id="sh-task"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder={"e.g., back up this folder daily and rotate old backups\nfind all .log files older than 30 days and delete them\nmonitor a URL and alert on HTTP 5xx"}
              className="min-h-[80px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {TASK_PRESETS.slice(0, 10).map((p) => (
                <Button
                  key={p}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] font-mono"
                  onClick={() => setTask(p)}
                >+ {p}</Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="rounded border bg-background px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Flavor</div>
              <select
                value={flavor}
                onChange={(e) => setFlavor(e.target.value as ShellFlavor)}
                className="bg-transparent text-sm font-semibold w-full"
              >
                <option value="bash">Bash</option>
                <option value="posix">POSIX /bin/sh</option>
              </select>
            </div>
            <div className="rounded border bg-background px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Detected</div>
              <div className="text-sm font-semibold">{CATEGORY_LABELS[detectedCat]}</div>
            </div>
            <div className="rounded border bg-background px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Dry-run guard</div>
              <label className="flex items-center gap-1.5 text-sm font-semibold cursor-pointer">
                <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                {dryRun ? "On" : "Off"}
              </label>
            </div>
            <div className="rounded border bg-background px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Cron wrapper</div>
              <label className="flex items-center gap-1.5 text-sm font-semibold cursor-pointer">
                <input type="checkbox" checked={cron} onChange={(e) => setCron(e.target.checked)} />
                {cron ? "On" : "Off"}
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleGenerate} label="Generate script" />
            <Button variant="outline" size="sm" onClick={() => setShowLlm((v) => !v)} className="gap-1.5">
              <Wand2 className="h-3.5 w-3.5" /> {showLlm ? "Hide" : "Show"} LLM polish
            </Button>
          </div>
        </CardContent>
      </Card>

      {showLlm && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Key className="h-4 w-4" /> Bring your own key (optional)
            </h3>
            <p className="text-xs text-muted-foreground">
              Optional — paste your own OpenAI or Anthropic API key. The key is stored only in this browser&apos;s localStorage; the request goes directly to the provider.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
              <Input
                type="password"
                placeholder="sk-…"
                value={llmKey}
                onChange={(e) => {
                  setLlmKey(e.target.value);
                  if (typeof localStorage !== "undefined") {
                    try { localStorage.setItem(LLM_KEY_STORAGE, e.target.value); } catch { /* ignore */ }
                  }
                }}
                className="h-8 font-mono text-xs max-w-xs"
              />
              <RunButton onClick={handleLlm} label="Polish with LLM" loading={llmLoading} />
            </div>
            {llmError && <ErrorBanner message={llmError} />}
            {llmResult && (
              <div className="rounded border bg-background p-3 text-xs space-y-2">
                {llmResult.explanation && (
                  <div><strong>Explanation:</strong> {llmResult.explanation}</div>
                )}
                {llmResult.alternatives.length > 0 && (
                  <div><strong>Alternatives:</strong>
                    <ul className="list-disc pl-4">
                      {llmResult.alternatives.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}
                {llmResult.warnings.length > 0 && (
                  <div className="text-amber-700 dark:text-amber-400"><strong>Warnings:</strong> {llmResult.warnings.join("; ")}</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Terminal className="h-4 w-4" /> Generated script ({result.flavor})
              </h3>
              <div className="flex gap-1">
                {(["script", "lint", "explain"] as Tab[]).map((t) => (
                  <Button
                    key={t}
                    variant={tab === t ? "default" : "ghost"}
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => setTab(t)}
                  >
                    {t === "script" ? "Script" : t === "lint" ? `Lint (${liveLint.length})` : "Explain"}
                  </Button>
                ))}
              </div>
            </div>

            {tab === "script" && (
              <>
                {result.destructive.length > 0 && (
                  <div className="rounded border border-red-500/40 bg-red-500/5 p-3 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" /> Destructive commands detected ({result.destructive.length})
                    </div>
                    <ul className="list-disc pl-4">
                      {result.destructive.map((d, i) => (
                        <li key={i}>
                          line {d.line}: <code className="font-mono">{d.pattern}</code> — {d.reason}
                        </li>
                      ))}
                    </ul>
                    <p className="text-muted-foreground">Suggestion: run with <code className="font-mono">--dry-run</code> first, or test on a non-critical copy.</p>
                  </div>
                )}
                <pre className="rounded border bg-muted/40 p-3 text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-[500px]">
                  {result.script}
                </pre>
                <div className="text-xs text-muted-foreground">{result.note}</div>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => result.script} label="Copy script" />
                  <DownloadButton
                    getText={() => result.script}
                    filename={`${(task || "script").replace(/\s+/g, "-").slice(0, 40) || "script"}.sh`}
                    mime="text/x-shellscript"
                    label="Download .sh"
                  />
                  <ShareButton
                    getUrl={() => buildShareUrl({ task, flavor, dryRun, cron })}
                  />
                  <ClearButton onClick={handleClear} />
                </div>
              </>
            )}

            {tab === "lint" && (
              <div className="space-y-1 max-h-[500px] overflow-auto">
                {liveLint.length === 0 ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="h-3.5 w-3.5" /> No lint findings — looks clean.
                  </div>
                ) : (
                  liveLint.map((f, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            f.severity === "error"
                              ? "text-red-700 dark:text-red-400 border-red-500/40"
                              : f.severity === "warning"
                                ? "text-amber-700 dark:text-amber-400 border-amber-500/40"
                                : "text-blue-700 dark:text-blue-400 border-blue-500/40"
                          }
                        >
                          {f.rule}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">line {f.line}</Badge>
                        <span className="text-foreground">{f.message}</span>
                      </div>
                      {f.suggestion && (
                        <div className="text-muted-foreground mt-1 text-[11px]">→ {f.suggestion}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "explain" && (
              <div className="space-y-1 max-h-[500px] overflow-auto">
                {result.sections.map((s, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">L{s.start}–{s.end}</Badge>
                      <span className="font-medium text-foreground">{s.label}</span>
                    </div>
                    <p className="text-muted-foreground mt-1">{s.explanation}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Explain-existing mode */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sh-existing" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Explain an existing script (paste here)
            </Label>
            <Textarea
              id="sh-existing"
              value={existing}
              onChange={(e) => setExisting(e.target.value)}
              placeholder={"#!/usr/bin/env bash\nset -euo pipefail\n..."}
              className="min-h-[100px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <RunButton onClick={handleExplainExisting} label="Explain sections" />
              {existing && (
                <CopyButton getText={() => existing} label="Copy input" />
              )}
            </div>
          </div>
          {existingExplained && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ListChecks className="h-3.5 w-3.5" /> {existingExplained.sections.length} section(s)
              </div>
              {existingExplained.sections.map((s, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">L{s.start}–{s.end}</Badge>
                    <span className="font-medium text-foreground">{s.label}</span>
                  </div>
                  <p className="text-muted-foreground mt-1">{s.explanation}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!result && !existingExplained && (
        <EmptyState
          title="Describe a task or paste an existing script"
          hint="Try 'back up this folder daily and rotate old backups' or 'monitor a URL and alert on 5xx'. The generator is rule-based and private — nothing is uploaded."
          icon={<Terminal className="h-8 w-8" />}
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
                  type="button"
                  onClick={() => {
                    setTask(h.task); setFlavor(h.flavor);
                    toast.info(`Loaded: ${h.task}`);
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:border-primary"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.flavor}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{CATEGORY_LABELS[h.category]}</Badge>
                  <span className="text-foreground">{h.task}</span>
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
            <strong className="text-foreground">Privacy & honesty:</strong> All generation, linting, explaining, and wrapping run locally. The generator is rule-based and template-driven (best-effort); the optional BYO-key LLM is stronger for tricky tasks. Always read and test scripts on non-critical data first — shell mistakes can delete files irreversibly. Nothing is uploaded or logged by us.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- LLM fetch helper (touches network — kept out of logic.ts) ----------

async function callLlm(provider: "openai" | "anthropic", key: string, prompt: string): Promise<string> {
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You convert plain-English tasks to safe, commented Bash scripts and return raw JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.content?.map((c: { text?: string }) => c.text ?? "").join("") ?? "";
}
