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
  SMELL_LABELS,
  REFACTORING_LABELS,
  PATTERN_LABELS,
  CATEGORY_LABELS,
  PATTERN_CATALOG,
  SAMPLE_SNIPPETS,
  HISTORY_MAX,
  LLM_KEY_STORAGE,
  detectLanguage,
  analyzeCode,
  applyAllSafeRefactorings,
  computeDiff,
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
  type RefactorResult,
  type Suggestion,
  type HistoryEntry,
  type LlmExplanation,
  type PatternCategory,
} from "./logic";
import {
  Wand2, History, ShieldAlert, Sparkles, Code2,
  Activity, Layers, GitCompare, KeyRound, BookMarked,
  CheckCircle2, XCircle, Lightbulb,
} from "lucide-react";

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  error: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
};

export default function AiCodingPatternRefactorer() {
  const [language, setLanguage] = useState<Language>("javascript");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<RefactorResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [autoDetect, setAutoDetect] = useState(false);
  const [error, setError] = useState("");
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const [appliedAllFixed, setAppliedAllFixed] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<Severity | "">("");
  const [patternCategoryFilter, setPatternCategoryFilter] = useState<PatternCategory | "">("");
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
        runAnalyze(p.code, p.language ?? "javascript");
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
      setAcceptedIds(new Set());
      setRejectedIds(new Set());
      setAppliedAllFixed(null);
      saveHistory({
        ts: Date.now(),
        language: lang,
        snippet: c.slice(0, 80),
        smellCount: res.smells.length,
        suggestionCount: res.suggestions.length,
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

  const handleApplyAllSafe = useCallback(() => {
    if (!code.trim()) return;
    const { fixed, applied } = applyAllSafeRefactorings(code, language);
    setAppliedAllFixed(fixed);
    if (applied.length === 0) {
      toast.info("No safe auto-fixes available for this code.");
    } else {
      toast.success(`Applied ${applied.length} safe refactoring(s).`);
    }
  }, [code, language]);

  const acceptSuggestion = useCallback((id: string) => {
    setAcceptedIds((prev) => new Set(prev).add(id));
    setRejectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    toast.success("Suggestion accepted — apply the diff to your code.");
  }, []);

  const rejectSuggestion = useCallback((id: string) => {
    setRejectedIds((prev) => new Set(prev).add(id));
    setAcceptedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    toast.info("Suggestion rejected.");
  }, []);

  const filteredSuggestions = useMemo(() => {
    if (!result) return [];
    let list = result.suggestions;
    if (severityFilter) list = list.filter((s) => s.severity === severityFilter);
    return list;
  }, [result, severityFilter]);

  const filteredPatterns = useMemo(() => {
    if (patternCategoryFilter) {
      return PATTERN_CATALOG.filter((p) => p.category === patternCategoryFilter);
    }
    return PATTERN_CATALOG;
  }, [patternCategoryFilter]);

  const appliedDiff = useMemo(() => {
    if (!appliedAllFixed) return [];
    return computeDiff(code, appliedAllFixed);
  }, [code, appliedAllFixed]);

  const handleClear = useCallback(() => {
    setCode("");
    setResult(null);
    setError("");
    setAcceptedIds(new Set());
    setRejectedIds(new Set());
    setAppliedAllFixed(null);
    setLlmResult(null);
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
    setAcceptedIds(new Set());
    setRejectedIds(new Set());
    setAppliedAllFixed(null);
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
      const prompt = buildLlmPrompt(code, language, result.smells);
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
              { role: "system", content: "You are an expert software architect. Output only JSON." },
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
      toast.success("LLM analysis ready");
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
              <Label htmlFor="acpr-language" className="text-xs">Language</Label>
              <select
                id="acpr-language"
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
            <Label htmlFor="acpr-code" className="text-xs">Code</Label>
            <Textarea
              id="acpr-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={SAMPLE_SNIPPETS[language]}
              className="min-h-[180px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <RunButton onClick={handleAnalyze} label="Analyze" disabled={!code.trim()} />
              <Button variant="outline" size="sm" onClick={handleLoadSample}>Load sample</Button>
              <Button variant="outline" size="sm" onClick={handleApplyAllSafe} disabled={!code.trim()}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Apply safe refactorings
              </Button>
              <ClearButton onClick={handleClear} disabled={!code && !result} />
              <ShareButton getUrl={() => buildShareUrl(language, code, Array.from(acceptedIds))} disabled={!code.trim()} />
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
                <Stat label="Smells" value={result.smells.length} highlight={result.smells.length > 0 ? "bad" : "good"} />
                <Stat label="Suggestions" value={result.suggestions.length} />
                <Stat label="Cyclomatic" value={result.complexityBefore.cyclomatic} />
                <Stat label="Functions" value={result.complexityBefore.functions} />
                <Stat label="Max nesting" value={result.complexityBefore.maxNesting} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-2 border-t">
                <Stat label="Lines" value={result.complexityBefore.lines} />
                <Stat label="Duplicates" value={result.complexityBefore.duplicates} highlight={result.complexityBefore.duplicates > 0 ? "bad" : undefined} />
                <Stat label="Pattern ideas" value={result.patternSuggestions.length} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Wand2 className="h-4 w-4" /> Suggestions ({filteredSuggestions.length})
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
                  <Badge variant="outline" className="text-[10px]">{acceptedIds.size} accepted</Badge>
                  <Badge variant="outline" className="text-[10px]">{rejectedIds.size} rejected</Badge>
                </div>
              </div>
              {filteredSuggestions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No suggestions match the current filter.</p>
              ) : (
                <div className="space-y-2 max-h-[700px] overflow-auto">
                  {filteredSuggestions.map((sug, idx) => (
                    <SuggestionCard
                      key={sug.id ?? idx}
                      suggestion={sug}
                      accepted={acceptedIds.has(sug.id)}
                      rejected={rejectedIds.has(sug.id)}
                      onAccept={() => acceptSuggestion(sug.id)}
                      onReject={() => rejectSuggestion(sug.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {appliedAllFixed && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4" /> Auto-applied refactorings (diff)
                  </h3>
                  <div className="flex gap-2">
                    <CopyButton getText={() => appliedAllFixed} label="Copy fixed" />
                    <DownloadButton getText={() => appliedAllFixed} filename="refactored.txt" />
                  </div>
                </div>
                <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono overflow-auto max-h-[500px] whitespace-pre-wrap">
{appliedDiff.map((d) => {
  if (d.type === "same") return `  ${d.before}`;
  if (d.type === "added") return `+ ${d.after}`;
  return `- ${d.before}`;
}).join("\n")}
                </pre>
              </CardContent>
            </Card>
          )}

          {result.patternSuggestions.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4" /> Suggested patterns ({result.patternSuggestions.length})
                </h3>
                <div className="space-y-1">
                  {result.patternSuggestions.map((p, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                      <Badge variant="secondary" className="mr-2 text-[10px]">{PATTERN_LABELS[p.pattern]}</Badge>
                      <span className="text-muted-foreground">{p.reason}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <BookMarked className="h-4 w-4" /> Pattern catalog ({filteredPatterns.length} / {PATTERN_CATALOG.length})
                </h3>
                <select
                  value={patternCategoryFilter}
                  onChange={(e) => setPatternCategoryFilter(e.target.value as PatternCategory | "")}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="">All categories</option>
                  {(Object.keys(CATEGORY_LABELS) as PatternCategory[]).map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[600px] overflow-auto">
                {filteredPatterns.map((p) => (
                  <div key={p.id} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{CATEGORY_LABELS[p.category]}</Badge>
                      <span className="font-medium text-foreground">{p.name}</span>
                    </div>
                    <p className="text-muted-foreground"><strong>Intent:</strong> {p.intent}</p>
                    <p className="text-muted-foreground"><strong>Use when:</strong> {p.whenToUse}</p>
                    <p className="text-muted-foreground"><strong>Avoid when:</strong> {p.whenNotToUse}</p>
                    <pre className="font-mono text-[10px] bg-muted/30 rounded p-2 overflow-auto max-h-[150px] whitespace-pre-wrap">{p.template}</pre>
                    <div className="flex gap-2">
                      <CopyButton getText={() => p.template} label="Copy template" />
                    </div>
                  </div>
                ))}
              </div>
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
                  <Sparkles className="h-4 w-4" /> Optional LLM enhancement (BYO key)
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setShowLlm(!showLlm)}>
                  {showLlm ? "Hide" : "Show"}
                </Button>
              </div>
              {showLlm && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Use your own OpenAI or Anthropic API key to refine the analysis with concrete refactoring steps and architectural notes. The key is stored only in your browser and the request goes directly to the provider — never to UnQTools servers.
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
                      label="Refine with LLM"
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
                      {llmResult.overallSummary && (
                        <div className="rounded border bg-background px-3 py-2 text-xs">
                          <p className="font-medium mb-1">LLM overall summary:</p>
                          <p className="text-foreground">{llmResult.overallSummary}</p>
                        </div>
                      )}
                      {llmResult.overallNotes.length > 0 && (
                        <div className="rounded border bg-background px-3 py-2 text-xs">
                          <p className="font-medium mb-1">Architectural notes:</p>
                          <ul className="list-disc pl-4 text-muted-foreground">
                            {llmResult.overallNotes.map((n, i) => <li key={i}>{n}</li>)}
                          </ul>
                        </div>
                      )}
                      {llmResult.suggestions.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium">Refined suggestions:</p>
                          {llmResult.suggestions.map((s, i) => (
                            <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                              <Badge variant="outline" className="mr-2 text-[10px]">{s.id}</Badge>
                              <p className="mt-1 text-foreground">{s.rationale}</p>
                              {s.alternative && (
                                <p className="mt-0.5 text-muted-foreground"><Sparkles className="inline h-3 w-3 mr-1" />Alternative: {s.alternative}</p>
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
          hint="Supports Python, JavaScript, TypeScript, Java, C++, and Go. Detects code smells (long methods, deep nesting, magic numbers, duplicated code, switch statements, god classes), suggests named refactorings and GoF design patterns with before/after diffs and rationale. Accept/reject per suggestion. Apply-safe-refactorings button for magic-number extraction."
          icon={<Wand2 className="h-8 w-8" />}
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
                  <Badge variant="secondary" className="mr-2 text-[10px]">{h.smellCount} smells</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.suggestionCount} suggestions</Badge>
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

function SuggestionCard({
  suggestion,
  accepted,
  rejected,
  onAccept,
  onReject,
}: {
  suggestion: Suggestion;
  accepted: boolean;
  rejected: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const diff = useMemo(() => computeDiff(suggestion.before, suggestion.after), [suggestion.before, suggestion.after]);
  return (
    <div className={`rounded border bg-background px-3 py-2 text-xs space-y-2 ${accepted ? "border-emerald-400" : rejected ? "border-red-300 opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${SEVERITY_COLORS[suggestion.severity]}`}>
          {SEVERITY_LABELS[suggestion.severity]}
        </span>
        <Badge variant="outline" className="text-[10px]">L{suggestion.startLine}{suggestion.endLine ? `-${suggestion.endLine}` : ""}</Badge>
        <Badge variant="secondary" className="text-[10px]">{SMELL_LABELS[suggestion.smell]}</Badge>
        <Badge variant="outline" className="text-[10px]">→ {REFACTORING_LABELS[suggestion.refactoring]}</Badge>
        {suggestion.pattern && (
          <Badge variant="outline" className="text-[10px] text-purple-700 dark:text-purple-400">{PATTERN_LABELS[suggestion.pattern]}</Badge>
        )}
        {suggestion.safe ? (
          <Badge variant="outline" className="text-[10px] text-emerald-700 dark:text-emerald-400">safe</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-400">review needed</Badge>
        )}
        {accepted && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
        {rejected && <XCircle className="h-3.5 w-3.5 text-red-500" />}
      </div>
      <p className="text-foreground font-medium">{suggestion.title}</p>
      <p className="text-muted-foreground"><strong>Rationale:</strong> {suggestion.rationale}</p>
      <p className="text-muted-foreground"><strong>Tradeoffs:</strong> {suggestion.tradeoffs}</p>
      <div className="rounded border bg-muted/30 p-2 font-mono text-[10px] overflow-auto max-h-[200px] whitespace-pre-wrap">
{diff.map((d) => {
  if (d.type === "same") return `  ${d.before}`;
  if (d.type === "added") return `+ ${d.after}`;
  return `- ${d.before}`;
}).join("\n")}
      </div>
      <div className="flex gap-2">
        <Button
          variant={accepted ? "default" : "outline"}
          size="sm"
          onClick={onAccept}
          disabled={accepted}
          className="h-7 text-[11px]"
        >
          <CheckCircle2 className="h-3 w-3 mr-1" /> Accept
        </Button>
        <Button
          variant={rejected ? "default" : "outline"}
          size="sm"
          onClick={onReject}
          disabled={rejected}
          className="h-7 text-[11px]"
        >
          <XCircle className="h-3 w-3 mr-1" /> Reject
        </Button>
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
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}
