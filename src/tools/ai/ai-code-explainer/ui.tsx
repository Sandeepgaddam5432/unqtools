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
  DEPTH_LABELS,
  DEPTH_ORDER,
  TRANSLATION_LABELS,
  ALL_TRANSLATIONS,
  CONSTRUCT_LABELS,
  SAMPLE_SNIPPETS,
  HISTORY_MAX,
  LLM_KEY_STORAGE,
  detectLanguage,
  identifyConstructs,
  explainCodeFull,
  addInlineComments,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  honestyNote,
  type Language,
  type Depth,
  type TranslationLang,
  type ExplanationResult,
  type HistoryEntry,
  type LlmExplanation,
} from "./logic";
import {
  BookOpen, History, ShieldAlert, Sparkles, Code2,
  Activity, Layers, GitBranch, KeyRound, MessageSquareText,
} from "lucide-react";

const CONSTRUCT_COLORS: Partial<Record<string, string>> = {
  "function-decl": "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  "arrow-function": "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  "class-decl": "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  "if": "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  "elif": "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  "else": "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  "for-loop": "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  "while-loop": "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  "return": "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  "import": "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  "comment": "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  "blank": "bg-gray-50 text-gray-400 dark:bg-gray-900 dark:text-gray-500",
};

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  error: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export default function AiCodeExplainer() {
  const [language, setLanguage] = useState<Language>("python");
  const [depth, setDepth] = useState<Depth>("beginner");
  const [translate, setTranslate] = useState<TranslationLang>("en");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ExplanationResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [autoDetect, setAutoDetect] = useState(false);
  const [error, setError] = useState("");
  const [showCommented, setShowCommented] = useState(false);
  const [constructFilter, setConstructFilter] = useState<string>("");
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
      if (p.depth) setDepth(p.depth);
      if (p.translate) setTranslate(p.translate);
      if (p.code) {
        setCode(p.code);
        runExplain(p.code, p.language ?? "python", p.depth ?? "beginner", p.translate ?? "en");
        toast.info("Loaded from share link");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runExplain = useCallback(
    (codeArg: string, langArg: Language, depthArg: Depth, trArg: TranslationLang) => {
      const c = codeArg.trim();
      if (!c) {
        setError("Paste code to explain.");
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
        const res = explainCodeFull(c, lang, depthArg, trArg);
        setResult(res);
        saveHistory({
          ts: Date.now(),
          language: lang,
          depth: depthArg,
          snippet: c.slice(0, 80),
          lineCount: res.lines.length,
          constructCount: res.lines.filter((l) => l.construct !== "blank" && l.construct !== "comment").length,
        });
        setHistory(loadHistory());
      } catch (e) {
        setError(`Explanation error: ${e instanceof Error ? e.message : String(e)}`);
        setResult(null);
      }
    },
    [autoDetect],
  );

  const handleExplain = useCallback(() => {
    runExplain(code, language, depth, translate);
  }, [code, language, depth, translate, runExplain]);

  const commentedCode = useMemo(() => {
    if (!code.trim()) return "";
    return addInlineComments(code, language, depth);
  }, [code, language, depth]);

  const filteredLines = useMemo(() => {
    if (!result) return [];
    if (!constructFilter) return result.lines;
    return result.lines.filter((l) => l.construct === constructFilter);
  }, [result, constructFilter]);

  const constructCounts = useMemo(() => {
    if (!result) return {} as Record<string, number>;
    const c: Record<string, number> = {};
    for (const l of result.lines) c[l.construct] = (c[l.construct] ?? 0) + 1;
    return c;
  }, [result]);

  const handleClear = useCallback(() => {
    setCode("");
    setResult(null);
    setError("");
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
    setLlmResult(null);
  }, [language]);

  const handleLlmExplain = useCallback(async () => {
    if (!code.trim()) return;
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
      const prompt = buildLlmPrompt(code, language, depth);
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
  }, [code, language, depth, llmKey, llmProvider]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ace-language" className="text-xs">Language</Label>
              <select
                id="ace-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="h-9 text-sm rounded border bg-background px-2"
              >
                {ALL_LANGUAGES.map((l) => (
                  <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ace-depth" className="text-xs">Depth</Label>
              <select
                id="ace-depth"
                value={depth}
                onChange={(e) => setDepth(e.target.value as Depth)}
                className="h-9 text-sm rounded border bg-background px-2"
              >
                {DEPTH_ORDER.map((d) => (
                  <option key={d} value={d}>{DEPTH_LABELS[d]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ace-translate" className="text-xs">Translate to</Label>
              <select
                id="ace-translate"
                value={translate}
                onChange={(e) => setTranslate(e.target.value as TranslationLang)}
                className="h-9 text-sm rounded border bg-background px-2"
              >
                {ALL_TRANSLATIONS.map((t) => (
                  <option key={t} value={t}>{TRANSLATION_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer pb-2">
              <input type="checkbox" checked={autoDetect} onChange={(e) => setAutoDetect(e.target.checked)} />
              Auto-detect
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ace-code" className="text-xs">Code</Label>
            <Textarea
              id="ace-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={SAMPLE_SNIPPETS[language]}
              className="min-h-[180px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <RunButton onClick={handleExplain} label="Explain" disabled={!code.trim()} />
              <Button variant="outline" size="sm" onClick={handleLoadSample}>Load sample</Button>
              <ClearButton onClick={handleClear} disabled={!code && !result} />
              <ShareButton getUrl={() => buildShareUrl(language, depth, code, translate)} disabled={!code.trim()} />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <Stat label="Lines" value={result.lines.length} />
                <Stat label="Constructs" value={Object.values(constructCounts).reduce((a, b) => a + b, 0)} />
                <Stat label="Functions" value={(constructCounts["function-decl"] ?? 0) + (constructCounts["arrow-function"] ?? 0)} />
                <Stat label="Loops" value={(constructCounts["for-loop"] ?? 0) + (constructCounts["while-loop"] ?? 0) + (constructCounts["do-while"] ?? 0)} />
                <Stat label="Libraries" value={result.libraries.length} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-1">
                  <MessageSquareText className="h-4 w-4" /> Overall summary
                </h3>
                <p className="text-xs text-foreground">{result.overallSummary}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Activity className="h-4 w-4" /> Complexity hint
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Big-O" value={result.complexity.bigO} />
                <Stat label="Cyclomatic" value={result.complexity.cyclomatic} />
                <Stat label="Loops" value={result.complexity.loops} />
                <Stat label="Nested loops" value={result.complexity.nestedLoops} />
              </div>
              <p className="text-xs text-muted-foreground pt-1">{result.complexity.explanation}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Code2 className="h-4 w-4" /> Line-by-line ({filteredLines.length})
                </h3>
                <select
                  value={constructFilter}
                  onChange={(e) => setConstructFilter(e.target.value)}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="">All constructs</option>
                  {Object.entries(constructCounts).map(([c, n]) => (
                    <option key={c} value={c}>{CONSTRUCT_LABELS[c as keyof typeof CONSTRUCT_LABELS]} ×{n}</option>
                  ))}
                </select>
              </div>
              {filteredLines.length === 0 ? (
                <p className="text-xs text-muted-foreground">No lines match the filter.</p>
              ) : (
                <div className="space-y-1 max-h-[600px] overflow-auto">
                  {filteredLines.map((l, idx) => (
                    <div key={idx} className="rounded border bg-background px-3 py-2 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] text-muted-foreground font-mono w-8 flex-shrink-0 text-right pt-0.5">L{l.line}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] flex-shrink-0 ${CONSTRUCT_COLORS[l.construct] ?? ""}`}
                        >
                          {CONSTRUCT_LABELS[l.construct]}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <pre className="font-mono text-[11px] text-foreground whitespace-pre-wrap break-all bg-muted/30 rounded px-2 py-1 mb-1">{l.text || " "}</pre>
                          <p className="text-muted-foreground">{l.explanation}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => result.lines.map((l) => `L${l.line} [${CONSTRUCT_LABELS[l.construct]}]: ${l.explanation}`).join("\n")}
                  label="Copy explanations"
                />
                <DownloadButton
                  getText={() => result.lines.map((l) => `L${l.line} [${CONSTRUCT_LABELS[l.construct]}]: ${l.explanation}`).join("\n")}
                  filename="code-explanation.txt"
                />
              </div>
            </CardContent>
          </Card>

          {result.libraries.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="h-4 w-4" /> Libraries & APIs ({result.libraries.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.libraries.map((lib, i) => (
                    <Badge key={i} variant="secondary" className="text-[11px]">
                      {lib.name} <span className="text-muted-foreground ml-1">·{lib.kind}·L{lib.line}</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.securitySmells.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" /> Security smells ({result.securitySmells.length})
                </h3>
                <div className="space-y-1">
                  {result.securitySmells.map((s, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${SEVERITY_COLORS[s.severity]}`}>
                          {s.severity}
                        </span>
                        <Badge variant="outline" className="text-[10px]">L{s.line}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{s.rule}</Badge>
                      </div>
                      <p className="mt-1 text-foreground">{s.message}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.dataFlow.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <GitBranch className="h-4 w-4" /> Data flow ({result.dataFlow.length})
                </h3>
                <div className="space-y-1 max-h-[300px] overflow-auto">
                  {result.dataFlow.map((d, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <span className="font-mono text-foreground">{d.variable}</span>
                      <span className="text-muted-foreground ml-2">declared L{d.declaredAt}</span>
                      {d.usedAt.length > 0 && (
                        <span className="text-muted-foreground ml-2">used L{d.usedAt.join(", L")}</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> Inline-commented code
                </h3>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={showCommented} onChange={(e) => setShowCommented(e.target.checked)} />
                  Show
                </label>
              </div>
              {showCommented && (
                <>
                  <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono overflow-auto max-h-[500px] whitespace-pre-wrap">
{commentedCode}
                  </pre>
                  <div className="flex gap-2">
                    <CopyButton getText={() => commentedCode} label="Copy commented code" />
                    <DownloadButton getText={() => commentedCode} filename="code-with-comments.txt" />
                  </div>
                </>
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
                  <Sparkles className="h-4 w-4" /> Optional LLM enhancement (BYO key)
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setShowLlm(!showLlm)}>
                  {showLlm ? "Hide" : "Show"}
                </Button>
              </div>
              {showLlm && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Use your own OpenAI or Anthropic API key to get a refined overall summary and per-line notes. The key is stored only in your browser and the request goes directly to the provider — never to UnQTools servers.
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
                      disabled={!llmKey || !code.trim()}
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
                          <p className="font-medium mb-1">Notes:</p>
                          <ul className="list-disc pl-4 text-muted-foreground">
                            {llmResult.overallNotes.map((n, i) => <li key={i}>{n}</li>)}
                          </ul>
                        </div>
                      )}
                      {llmResult.lineNotes.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium">Per-line notes:</p>
                          {llmResult.lineNotes.map((n, i) => (
                            <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                              <Badge variant="outline" className="mr-2 text-[10px]">L{n.line}</Badge>
                              <span className="text-foreground">{n.note}</span>
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
          title="Paste code and click Explain"
          hint="Supports Python, JavaScript, TypeScript, Java, C++, and Go. Line-by-line plain-English explanations with depth control (ELI5 → Expert), Big-O complexity hint, library detection, security smells, data-flow notes, and inline-comment injection."
          icon={<BookOpen className="h-8 w-8" />}
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
                    setDepth(h.depth);
                    setCode(h.snippet);
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/50"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">{LANGUAGE_LABELS[h.language]}</Badge>
                  <Badge variant="secondary" className="mr-2 text-[10px]">{DEPTH_LABELS[h.depth]}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.lineCount} lines</Badge>
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
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
