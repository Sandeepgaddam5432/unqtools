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
  SAMPLE_SNIPPETS,
  HISTORY_MAX,
  LLM_KEY_STORAGE,
  detectLanguage,
  convertCode,
  computeKeyChanges,
  libraryMappings,
  computeDiff,
  wrapInFileBoilerplate,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  honestyNote,
  type Language,
  type ConversionResult,
  type HistoryEntry,
  type LlmEnhancement,
} from "./logic";
import {
  ArrowLeftRight, History, ShieldAlert, Wand2, FileCode,
  Lightbulb, AlertTriangle, GitCompare, Sparkles,
} from "lucide-react";

export default function AiCodeConverter() {
  const [source, setSource] = useState<Language>("python");
  const [target, setTarget] = useState<Language>("javascript");
  const [code, setCode] = useState("");
  const [preserveComments, setPreserveComments] = useState(true);
  const [fileMode, setFileMode] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [showLibNotes, setShowLibNotes] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [autoDetect, setAutoDetect] = useState(false);
  const [error, setError] = useState("");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<LlmEnhancement | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    const storedKey = typeof localStorage !== "undefined" ? localStorage.getItem(LLM_KEY_STORAGE) : null;
    if (storedKey) setLlmKey(storedKey);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.source) setSource(p.source);
      if (p.target) setTarget(p.target);
      if (p.code) setCode(p.code);
      if (p.preserveComments === false) setPreserveComments(false);
      if (p.fileMode) setFileMode(true);
      if (p.code) {
        toast.info("Loaded from share link");
        runConvert(p.code, p.source || source, p.target || target);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runConvert = useCallback(
    (codeArg: string, srcArg: Language, tgtArg: Language) => {
      const c = codeArg.trim();
      if (!c) {
        setError("Enter source code to convert.");
        setResult(null);
        return;
      }
      setError("");
      let src = srcArg;
      if (autoDetect) {
        const detected = detectLanguage(c);
        if (detected !== src) {
          src = detected;
          setSource(detected);
          toast.info(`Detected source language: ${LANGUAGE_LABELS[detected]}`);
        }
      }
      try {
        const res = convertCode(c, src, tgtArg, { preserveComments, fileMode });
        setResult(res);
        saveHistory({
          ts: Date.now(),
          source: src,
          target: tgtArg,
          snippet: c.slice(0, 80),
          linesTranslated: res.stats.parsedLines,
        });
        setHistory(loadHistory());
      } catch (e) {
        setError(`Conversion error: ${e instanceof Error ? e.message : String(e)}`);
        setResult(null);
      }
    },
    [autoDetect, preserveComments, fileMode],
  );

  const handleConvert = useCallback(() => {
    runConvert(code, source, target);
  }, [code, source, target, runConvert]);

  const diff = useMemo(() => {
    if (!result) return [];
    return computeDiff(code, result.output);
  }, [code, result]);

  const libNotes = useMemo(() => libraryMappings(source, target), [source, target]);

  const finalOutput = useMemo(() => {
    if (!result) return "";
    if (llmResult?.refinedCode) return llmResult.refinedCode;
    return result.output;
  }, [result, llmResult]);

  const handleSwap = useCallback(() => {
    setSource(target);
    setTarget(source);
    if (result) {
      setCode(result.output);
      setResult(null);
    }
  }, [source, target, result]);

  const handleClear = useCallback(() => {
    setCode("");
    setResult(null);
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
    setCode(SAMPLE_SNIPPETS[source]);
    setResult(null);
    setLlmResult(null);
  }, [source]);

  const handleLlmEnhance = useCallback(async () => {
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
      const prompt = buildLlmPrompt(code, source, target, result.unsupported);
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
              { role: "system", content: "You are a polyglot code translator. Output only JSON." },
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
      toast.success("LLM enhancement applied");
    } catch (e) {
      setLlmError(e instanceof Error ? e.message : String(e));
    } finally {
      setLlmLoading(false);
    }
  }, [code, source, target, result, llmKey, llmProvider]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="acc-source" className="text-xs">Source language</Label>
              <select
                id="acc-source"
                value={source}
                onChange={(e) => setSource(e.target.value as Language)}
                className="w-full h-9 text-sm rounded border bg-background px-2"
              >
                {ALL_LANGUAGES.map((l) => (
                  <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
                ))}
              </select>
            </div>
            <Button variant="outline" size="icon" onClick={handleSwap} title="Swap source and target">
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
            <div className="space-y-1.5">
              <Label htmlFor="acc-target" className="text-xs">Target language</Label>
              <select
                id="acc-target"
                value={target}
                onChange={(e) => setTarget(e.target.value as Language)}
                className="w-full h-9 text-sm rounded border bg-background px-2"
              >
                {ALL_LANGUAGES.map((l) => (
                  <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={autoDetect} onChange={(e) => setAutoDetect(e.target.checked)} />
              Auto-detect source
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={preserveComments} onChange={(e) => setPreserveComments(e.target.checked)} />
              Preserve comments
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={fileMode} onChange={(e) => setFileMode(e.target.checked)} />
              File mode (wrap in boilerplate)
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={showDiff} onChange={(e) => setShowDiff(e.target.checked)} disabled={!result} />
              Diff view
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={showLibNotes} onChange={(e) => setShowLibNotes(e.target.checked)} disabled={libNotes.length === 0} />
              Library notes ({libNotes.length})
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acc-code" className="text-xs">Source code</Label>
            <Textarea
              id="acc-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={SAMPLE_SNIPPETS[source]}
              className="min-h-[160px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <RunButton onClick={handleConvert} label="Convert" disabled={!code.trim()} />
              <Button variant="outline" size="sm" onClick={handleLoadSample}>Load sample</Button>
              <ClearButton onClick={handleClear} disabled={!code && !result} />
              <ShareButton getUrl={() => buildShareUrl(source, target, code, { preserveComments, fileMode })} disabled={!code.trim()} />
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
                <Stat label="Total lines" value={result.stats.totalLines} />
                <Stat label="Parsed" value={result.stats.parsedLines} highlight="good" />
                <Stat label="Untranslated" value={result.stats.rawLines} highlight={result.stats.rawLines > 0 ? "bad" : undefined} />
                <Stat label="Comments" value={result.stats.commentLines} />
                <Stat label="Blank" value={result.stats.blankLines} />
              </div>
            </CardContent>
          </Card>

          {showLibNotes && libNotes.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> Library / dependency mapping notes
                </h3>
                <div className="space-y-1.5">
                  {libNotes.map((m, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <Badge variant="outline" className="mr-2 text-[10px] font-mono">{m.fromLib}</Badge>
                      <ArrowLeftRight className="inline h-3 w-3 mx-1" />
                      <Badge variant="secondary" className="mx-2 text-[10px] font-mono">{m.toLib}</Badge>
                      <span className="text-muted-foreground">{m.note}</span>
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
                  <FileCode className="h-4 w-4" /> Translated {LANGUAGE_LABELS[target]}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => finalOutput} label="Copy" />
                  <DownloadButton
                    getText={() => fileMode ? wrapInFileBoilerplate(finalOutput, target, `output.${target}`) : finalOutput}
                    filename={`converted.${target === "cpp" ? "cpp" : target === "typescript" ? "ts" : target === "javascript" ? "js" : target.slice(0, 2)}`}
                  />
                </div>
              </div>
              <pre className="rounded border bg-muted/30 p-3 text-xs font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
{finalOutput || "(empty)"}
              </pre>
            </CardContent>
          </Card>

          {showDiff && diff.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <GitCompare className="h-4 w-4" /> Diff (source → target)
                </h3>
                <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
{diff.map((d) => {
  if (d.type === "same") return `  ${d.source}`;
  if (d.type === "added") return `+ ${d.target}`;
  return `- ${d.source}`;
}).join("\n")}
                </pre>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Lightbulb className="h-4 w-4" /> Key changes
              </h3>
              <ul className="space-y-1">
                {result.keyChanges.map((c, i) => (
                  <li key={i} className="text-xs">
                    <Badge variant="outline" className="mr-2 text-[10px]">{c.category}</Badge>
                    <span className="text-muted-foreground">{c.description}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {result.unsupported.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Unsupported features ({result.unsupported.length})
                </h3>
                <div className="space-y-1 max-h-[200px] overflow-auto">
                  {result.unsupported.map((u, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <Badge variant="secondary" className="mr-2 text-[10px]">L{u.line}</Badge>
                      <span className="font-mono text-foreground">{u.text}</span>
                      <span className="text-muted-foreground ml-2">— {u.reason}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

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
                  <Wand2 className="h-4 w-4" /> Optional LLM enhancement (BYO key)
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setShowLlm(!showLlm)}>
                  {showLlm ? "Hide" : "Show"}
                </Button>
              </div>
              {showLlm && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Use your own OpenAI or Anthropic API key to refine the translation. The key is stored only in your browser and the request goes directly to the provider — never to UnQTools servers. Skip this for 100% offline use.
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
                      onClick={handleLlmEnhance}
                      loading={llmLoading}
                      label="Enhance with LLM"
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
                    <div className="space-y-1">
                      {llmResult.notes.length > 0 && (
                        <div>
                          <p className="text-xs font-medium">Notes:</p>
                          <ul className="text-xs text-muted-foreground list-disc pl-4">
                            {llmResult.notes.map((n, i) => <li key={i}>{n}</li>)}
                          </ul>
                        </div>
                      )}
                      {llmResult.unsupportedResolved.length > 0 && (
                        <div>
                          <p className="text-xs font-medium">Resolved unsupported patterns:</p>
                          <ul className="text-xs text-muted-foreground list-disc pl-4">
                            {llmResult.unsupportedResolved.map((n, i) => <li key={i}>{n}</li>)}
                          </ul>
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
          title="Paste code and click Convert"
          hint="Supports Python, JavaScript, TypeScript, Java, C++, Go, and Ruby. Common patterns (loops, conditionals, functions, classes, prints, variables, comments) are translated idiomatically. Anything unsupported is flagged for manual review."
          icon={<ArrowLeftRight className="h-8 w-8" />}
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
                    setSource(h.source);
                    setTarget(h.target);
                    setCode(h.snippet);
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/50"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">{LANGUAGE_LABELS[h.source]} → {LANGUAGE_LABELS[h.target]}</Badge>
                  <span className="font-mono text-muted-foreground">{h.snippet}</span>
                  <span className="text-muted-foreground ml-2">· {h.linesTranslated} lines · {new Date(h.ts).toLocaleString()}</span>
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
