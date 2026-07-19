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
  ALL_LANGUAGES,
  LANGUAGE_LABELS,
  SEVERITY_LABELS,
  SEVERITY_ORDER,
  RULE_LABELS,
  SAMPLE_SNIPPETS,
  HISTORY_MAX,
  LLM_KEY_STORAGE,
  detectLanguage,
  analyzeCode,
  autoFix,
  computeDiff,
  guessRootCause,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  honestyNote,
  type Language,
  type Severity,
  type AnalysisResult,
  type HistoryEntry,
  type LlmExplanation,
  type RootCauseGuess,
} from "./logic";
import {
  Bug, History, ShieldAlert, Wand2, AlertTriangle,
  Activity, GitCompare, Sparkles, Stethoscope, Zap, KeyRound,
} from "lucide-react";

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  error: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
};

export default function AiCodeDebugger() {
  const [language, setLanguage] = useState<Language>("python");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [autoDetect, setAutoDetect] = useState(false);
  const [error, setError] = useState("");
  const [showDiff, setShowDiff] = useState(false);
  const [fixedCode, setFixedCode] = useState<string | null>(null);
  const [appliedFixes, setAppliedFixes] = useState<{ rule: string; description: string; applied: number }[] | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [rootCause, setRootCause] = useState<RootCauseGuess | null>(null);
  const [severityFilter, setSeverityFilter] = useState<Severity | "">("");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<LlmExplanation | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    const storedKey = typeof localStorage !== "undefined" ? localStorage.getItem(LLM_KEY_STORAGE) : null;
    if (storedKey) setLlmKey(storedKey);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.language) setLanguage(p.language);
      if (p.code) {
        setCode(p.code);
        runAnalyze(p.code, p.language ?? "python");
        toast.info("Loaded from share link");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAnalyze = useCallback((codeArg: string, langArg: Language) => {
    const c = codeArg.trim();
    if (!c) {
      setError("Paste code to analyze.");
      setResult(null);
      return;
    }
    setError("");
    let lang = langArg;
    if (autoDetect) {
      const detected = detectLanguage(c);
      if (detected !== lang) {
        lang = detected;
        setLanguage(detected);
        toast.info(`Detected language: ${LANGUAGE_LABELS[detected]}`);
      }
    }
    try {
      const res = analyzeCode(c, lang);
      setResult(res);
      setFixedCode(null);
      setAppliedFixes(null);
      saveHistory({
        ts: Date.now(),
        language: lang,
        snippet: c.slice(0, 80),
        issueCount: res.stats.total,
        criticalCount: res.stats.critical,
      });
      setHistory(loadHistory());
    } catch (e) {
      setError(`Analysis error: ${e instanceof Error ? e.message : String(e)}`);
      setResult(null);
    }
  }, [autoDetect]);

  const handleAnalyze = useCallback(() => {
    runAnalyze(code, language);
  }, [code, language, runAnalyze]);

  const handleAutoFix = useCallback(() => {
    if (!code.trim()) return;
    const { fixed, fixes } = autoFix(code, language);
    setFixedCode(fixed);
    setAppliedFixes(fixes);
    if (fixes.length === 0) {
      toast.info("No safe auto-fixes available for this code.");
    } else {
      toast.success(`Applied ${fixes.reduce((n, f) => n + f.applied, 0)} safe fix(es).`);
    }
  }, [code, language]);

  const handleGuessRootCause = useCallback(() => {
    if (!errorMessage.trim()) {
      toast.error("Paste an error message first.");
      return;
    }
    const guess = guessRootCause(errorMessage, language);
    setRootCause(guess);
    if (guess.matched) {
      toast.success("Root-cause pattern matched.");
    } else {
      toast.info("No specific pattern matched — see explanation.");
    }
  }, [errorMessage, language]);

  const diff = useMemo(() => {
    if (!fixedCode) return [];
    return computeDiff(code, fixedCode);
  }, [code, fixedCode]);

  const filteredIssues = useMemo(() => {
    if (!result) return [];
    if (!severityFilter) return result.issues;
    return result.issues.filter((i) => i.severity === severityFilter);
  }, [result, severityFilter]);

  const handleClear = useCallback(() => {
    setCode("");
    setResult(null);
    setFixedCode(null);
    setAppliedFixes(null);
    setError("");
    setLlmResult(null);
    setRootCause(null);
    setErrorMessage("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadSample = useCallback(() => {
    setCode(SAMPLE_SNIPPETS[language]);
    setResult(null);
    setFixedCode(null);
    setAppliedFixes(null);
    setLlmResult(null);
  }, [language]);

  const handleLlmExplain = useCallback(async () => {
    if (!result) return;
    if (!llmKey) {
      setLlmError("Paste your own API key (stored only in your browser).");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(LLM_KEY_STORAGE, llmKey);
      }
      const prompt = buildLlmPrompt(code, language, result.issues);
      const url = llmProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages";
      const headers: Record<string, string> = llmProvider === "openai"
        ? { "Content-Type": "application/json", Authorization: `Bearer ${llmKey}` }
        : { "Content-Type": "application/json", "x-api-key": llmKey, "anthropic-version": "2023-06-01" };
      const body = llmProvider === "openai"
        ? JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are an expert code reviewer. Output only JSON." },
              { role: "user", content: prompt },
            ],
            temperature: 0.2,
          })
        : JSON.stringify({
            model: "claude-3-5-sonnet-latest",
            max_tokens: 4096,
            messages: [{ role: "user", content: prompt }],
          });
      const resp = await fetch(url, { method: "POST", headers, body });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${txt.slice(0, 200)}`);
      }
      const data = await resp.json();
      const raw = llmProvider === "openai"
        ? data?.choices?.[0]?.message?.content ?? ""
        : data?.content?.[0]?.text ?? "";
      const parsed = renderLlmResult(raw);
      if (!parsed.ok) throw new Error(parsed.error);
      setLlmResult(parsed.result);
      toast.success("LLM explanation ready");
    } catch (e) {
      setLlmError(e instanceof Error ? e.message : String(e));
    } finally {
      setLlmLoading(false);
    }
  }, [code, language, result, llmKey, llmProvider]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acd-language" className="text-xs">Language</Label>
              <select
                id="acd-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="h-9 text-sm rounded border bg-background px-2"
              >
                {ALL_LANGUAGES.map((l) => (
                  <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer pb-2">
              <input type="checkbox" checked={autoDetect} onChange={(e) => setAutoDetect(e.target.checked)} />
              Auto-detect language
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acd-code" className="text-xs">Code</Label>
            <Textarea
              id="acd-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={SAMPLE_SNIPPETS[language]}
              className="min-h-[160px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <RunButton onClick={handleAnalyze} label="Analyze" disabled={!code.trim()} />
              <Button variant="outline" size="sm" onClick={handleLoadSample}>Load sample</Button>
              <ClearButton onClick={handleClear} disabled={!code && !result} />
              <ShareButton getUrl={() => buildShareUrl(language, code)} disabled={!code.trim()} />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <Stat label="Total issues" value={result.stats.total} />
                <Stat label="Critical" value={result.stats.critical} highlight={result.stats.critical > 0 ? "bad" : undefined} />
                <Stat label="Errors" value={result.stats.error} highlight={result.stats.error > 0 ? "bad" : undefined} />
                <Stat label="Warnings" value={result.stats.warning} />
                <Stat label="Info" value={result.stats.info} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-2 border-t">
                <Stat label="Complexity" value={result.complexity.cyclomatic} />
                <Stat label="Functions" value={result.complexity.functions} />
                <Stat label="Max nesting" value={result.complexity.maxNesting} />
                <Stat label="Code smells" value={result.smells.length} />
              </div>
              <p className="text-xs text-muted-foreground pt-2">{result.complexity.explanation}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Bug className="h-4 w-4" /> Issues ({filteredIssues.length})
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value as Severity | "")}
                    className="h-8 text-xs rounded border bg-background px-2"
                  >
                    <option value="">All severities</option>
                    {SEVERITY_ORDER.map((s) => (
                      <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
                    ))}
                  </select>
                  <Button variant="outline" size="sm" onClick={handleAutoFix}>
                    <Zap className="h-3.5 w-3.5 mr-1.5" /> Auto-fix safe issues
                  </Button>
                </div>
              </div>
              {filteredIssues.length === 0 ? (
                <p className="text-xs text-muted-foreground">No issues match the current filter.</p>
              ) : (
                <div className="space-y-1.5 max-h-[500px] overflow-auto">
                  {filteredIssues.map((issue, idx) => (
                    <div key={idx} className="rounded border bg-background px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${SEVERITY_COLORS[issue.severity]}`}>
                          {SEVERITY_LABELS[issue.severity]}
                        </span>
                        <Badge variant="outline" className="text-[10px]">L{issue.line}{issue.column ? `:${issue.column}` : ""}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{RULE_LABELS[issue.rule]}</Badge>
                        {issue.deterministic ? (
                          <Badge variant="outline" className="text-[10px] text-emerald-700 dark:text-emerald-400">deterministic</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-400">heuristic</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-foreground">{issue.message}</p>
                      {issue.suggestion && (
                        <p className="mt-0.5 text-muted-foreground">
                          <Sparkles className="inline h-3 w-3 mr-1" />
                          {issue.suggestion}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {appliedFixes && appliedFixes.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Zap className="h-4 w-4" /> Auto-fixes applied
                </h3>
                <ul className="space-y-1">
                  {appliedFixes.map((f, i) => (
                    <li key={i} className="text-xs">
                      <Badge variant="secondary" className="mr-2 text-[10px]">×{f.applied}</Badge>
                      <span className="text-foreground">{f.description}</span>
                      <span className="text-muted-foreground ml-2">({RULE_LABELS[f.rule as keyof typeof RULE_LABELS] ?? f.rule})</span>
                    </li>
                  ))}
                </ul>
                {fixedCode && (
                  <>
                    <div className="flex items-center justify-between pt-2">
                      <Label className="text-xs">Fixed code</Label>
                      <div className="flex gap-2">
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input type="checkbox" checked={showDiff} onChange={(e) => setShowDiff(e.target.checked)} />
                          Diff view
                        </label>
                        <CopyButton getText={() => fixedCode} label="Copy fixed" />
                        <DownloadButton getText={() => fixedCode} filename="fixed.txt" />
                      </div>
                    </div>
                    {showDiff ? (
                      <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
{diff.map((d) => {
  if (d.type === "same") return `  ${d.before}`;
  if (d.type === "added") return `+ ${d.after}`;
  return `- ${d.before}`;
}).join("\n")}
                      </pre>
                    ) : (
                      <pre className="rounded border bg-muted/30 p-3 text-xs font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
{fixedCode}
                      </pre>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Stethoscope className="h-4 w-4" /> Runtime-error root-cause guesser
              </h3>
              <p className="text-xs text-muted-foreground">Paste an error message and we'll try to match it to a known root cause.</p>
              <Textarea
                value={errorMessage}
                onChange={(e) => setErrorMessage(e.target.value)}
                placeholder="e.g., ZeroDivisionError: integer division or modulo by zero"
                className="min-h-[60px] resize-y font-mono text-xs"
              />
              <div className="flex gap-2">
                <RunButton onClick={handleGuessRootCause} label="Guess root cause" disabled={!errorMessage.trim()} />
              </div>
              {rootCause && (
                <div className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                  {rootCause.matched ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">Matched</Badge>
                        {rootCause.rule && <Badge variant="outline" className="text-[10px]">{RULE_LABELS[rootCause.rule]}</Badge>}
                        {rootCause.severity && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${SEVERITY_COLORS[rootCause.severity]}`}>
                            {SEVERITY_LABELS[rootCause.severity]}
                          </span>
                        )}
                      </div>
                      <p className="text-foreground">{rootCause.explanation}</p>
                      {rootCause.suggestedFix && (
                        <p className="text-muted-foreground"><Sparkles className="inline h-3 w-3 mr-1" />{rootCause.suggestedFix}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground">{rootCause.explanation}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Activity className="h-4 w-4" /> Code smells
              </h3>
              {result.smells.length === 0 ? (
                <p className="text-xs text-muted-foreground">No smells detected.</p>
              ) : (
                <div className="space-y-1">
                  {result.smells.map((s, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <Badge variant="outline" className="mr-2 text-[10px]">L{s.line}</Badge>
                      <Badge variant="secondary" className="mr-2 text-[10px]">{s.type}</Badge>
                      <span className="text-muted-foreground">{s.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {result.warnings.length > 0 && (
            <Card>
              <CardContent className="p-3">
                <div className="space-y-1">
                  {result.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>{w}</span>
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Wand2 className="h-4 w-4" /> Optional LLM explanation (BYO key)
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setShowLlm(!showLlm)}>
                  {showLlm ? "Hide" : "Show"}
                </Button>
              </div>
              {showLlm && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Use your own OpenAI or Anthropic API key to get plain-English explanations and concrete fixes for each issue. The key is stored only in your browser and the request goes directly to the provider — never to UnQTools servers.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
                    <select
                      value={llmProvider}
                      onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                      className="h-9 text-sm rounded border bg-background px-2"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                    </select>
                    <Input
                      type="password"
                      value={llmKey}
                      onChange={(e) => setLlmKey(e.target.value)}
                      placeholder="sk-..."
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="flex gap-2">
                    <RunButton
                      onClick={handleLlmExplain}
                      loading={llmLoading}
                      label="Explain with LLM"
                      disabled={!llmKey || !result}
                    />
                    {llmKey && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setLlmKey("");
                          if (typeof localStorage !== "undefined") localStorage.removeItem(LLM_KEY_STORAGE);
                          toast.info("Key cleared");
                        }}
                      >Clear key</Button>
                    )}
                  </div>
                  {llmError && <ErrorBanner message={llmError} />}
                  {llmResult && (
                    <div className="space-y-2">
                      {llmResult.overallNotes.length > 0 && (
                        <div className="rounded border bg-background px-3 py-2 text-xs">
                          <p className="font-medium mb-1">Overall notes:</p>
                          <ul className="list-disc pl-4 text-muted-foreground">
                            {llmResult.overallNotes.map((n, i) => <li key={i}>{n}</li>)}
                          </ul>
                        </div>
                      )}
                      {llmResult.issues.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium">Per-issue explanations:</p>
                          {llmResult.issues.map((iss, i) => (
                            <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                              <Badge variant="outline" className="mr-2 text-[10px]">{iss.rule}</Badge>
                              <p className="mt-1 text-foreground">{iss.explanation}</p>
                              {iss.fix && (
                                <p className="mt-0.5 text-muted-foreground"><Sparkles className="inline h-3 w-3 mr-1" />{iss.fix}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!result && !error && (
        <EmptyState
          title="Paste code and click Analyze"
          hint="Supports Python, JavaScript, TypeScript, Java, C++, and Go. Detects 15+ bug patterns with line numbers, severity, and suggested fixes. Auto-fix button applies safe corrections (var→let, ==→===, missing semicolons, missing break)."
          icon={<Bug className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length} / {HISTORY_MAX})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setLanguage(h.language);
                    setCode(h.snippet);
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/50"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">{LANGUAGE_LABELS[h.language]}</Badge>
                  <Badge variant="secondary" className="mr-2 text-[10px]">{h.issueCount} issues</Badge>
                  {h.criticalCount > 0 && (
                    <Badge variant="outline" className="mr-2 text-[10px] text-red-700 dark:text-red-400">{h.criticalCount} critical</Badge>
                  )}
                  <span className="font-mono text-muted-foreground">{h.snippet}</span>
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
            <strong className="text-foreground">Honesty:</strong> {honestyNote()}
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
