"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  HISTORY_KEY,
  HISTORY_MAX,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  SEVERITY_LABELS,
  SAMPLE_TEXTS,
  normalizeText,
  checkText,
  applyAll,
  applyByCategory,
  applySuggestion,
  dismissIssue,
  filterByCategory,
  buildDiff,
  renderDiffHtml,
  renderHighlightedHtml,
  renderCorrected,
  renderHtmlDocument,
  renderMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  loadIgnoreList,
  saveIgnoreList,
  clearIgnoreList,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type IssueCategory,
  type Issue,
  type CheckResult,
  type HistoryEntry,
  type Readability,
} from "./logic";
import {
  SpellCheck, History, Eye, Code2, FileText, Key, Sparkles,
  Check, X, RotateCcw, Wand2, AlertCircle,
} from "lucide-react";

export default function AiGrammarCorrectionTool() {
  const [text, setText] = useState("");
  const [debouncedText, setDebouncedText] = useState("");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [view, setView] = useState<"highlighted" | "diff" | "markdown">("highlighted");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load history and ignore list on mount; parse share URL.
  useEffect(() => {
    setHistory(loadHistory());
    const ignored = loadIgnoreList();
    if (ignored.length > 0) setDismissedIds(new Set(ignored));
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-grammar-tool:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.text) {
        setText(p.text);
        setDebouncedText(p.text);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  // Debounce text changes so the engine doesn't run on every keystroke.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedText(text), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text]);

  const result: CheckResult = useMemo(() => checkText(debouncedText), [debouncedText]);

  // Filter out dismissed issues.
  const visibleIssues: Issue[] = useMemo(
    () => result.issues.filter((i) => !dismissedIds.has(i.id)),
    [result.issues, dismissedIds],
  );

  const correctedText = useMemo(
    () => applyAll(result.original, visibleIssues),
    [result.original, visibleIssues],
  );

  const diff = useMemo(
    () => buildDiff(result.original, correctedText),
    [result.original, correctedText],
  );

  const highlightedHtml = useMemo(
    () => renderHighlightedHtml(result.original, visibleIssues),
    [result.original, visibleIssues],
  );

  const diffHtml = useMemo(() => renderDiffHtml(diff), [diff]);

  const markdownReport = useMemo(
    () => renderMarkdown({ ...result, issues: visibleIssues }),
    [result, visibleIssues],
  );

  const handleSaveHistory = useCallback(() => {
    if (!text.trim() || visibleIssues.length === 0) return;
    const entry: HistoryEntry = {
      ts: Date.now(),
      textPreview: text.slice(0, 80),
      issueCount: visibleIssues.length,
      byCategory: {
        grammar: 0, article: 0, punctuation: 0,
        capitalization: 0, confusion: 0, spelling: 0,
      },
      readability: result.stats.readability,
    };
    for (const i of visibleIssues) entry.byCategory[i.category] += 1;
    saveHistory(entry);
    setHistory(loadHistory());
  }, [text, visibleIssues, result.stats.readability]);

  const handleAccept = useCallback((issue: Issue) => {
    const next = applySuggestion(text, issue);
    setText(next);
    toast.success("Applied fix");
    handleSaveHistory();
  }, [text, handleSaveHistory]);

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveIgnoreList(Array.from(next));
      return next;
    });
  }, []);

  const handleAcceptAllByCategory = useCallback((cat: IssueCategory) => {
    const subset = filterByCategory(visibleIssues, cat);
    if (subset.length === 0) return;
    const out = applyByCategory(text, subset, cat);
    setText(out.text);
    toast.success(`Applied ${out.applied} ${CATEGORY_LABELS[cat]} fix${out.applied === 1 ? "" : "es"}`);
    handleSaveHistory();
  }, [text, visibleIssues, handleSaveHistory]);

  const handleAcceptAll = useCallback(() => {
    if (visibleIssues.length === 0) return;
    setText(applyAll(text, visibleIssues));
    toast.success(`Applied ${visibleIssues.length} fixes`);
    handleSaveHistory();
  }, [text, visibleIssues, handleSaveHistory]);

  const handleReset = useCallback(() => {
    setDismissedIds(new Set());
    clearIgnoreList();
    toast.info("Reset to original (dismissed issues restored)");
  }, []);

  const handleClear = useCallback(() => {
    setText("");
    setDebouncedText("");
    setDismissedIds(new Set());
    clearIgnoreList();
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSaveLlmKey = () => {
    if (typeof localStorage !== "undefined") {
      if (llmKey) localStorage.setItem("unqtools:ai-grammar-tool:llm-key", llmKey);
      else localStorage.removeItem("unqtools:ai-grammar-tool:llm-key");
    }
    toast.success(llmKey ? "API key saved locally" : "API key cleared");
  };

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Please paste your API key first");
      return;
    }
    if (!text.trim()) {
      toast.error("Enter text first");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    try {
      const prompt = buildLlmPrompt(text, "en");
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
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
          temperature: 0.2,
        };
      } else {
        headers["x-api-key"] = llmKey;
        headers["anthropic-version"] = "2023-06-01";
        body = {
          model: "claude-3-5-haiku-20241022",
          max_tokens: 4096,
          messages: [{ role: "user", content: `${prompt.system}\n\n${prompt.user}` }],
        };
      }
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const txt = await res.text();
        setLlmError(`LLM request failed (${res.status}): ${txt.slice(0, 200)}`);
        toast.error("LLM request failed");
        setLlmLoading(false);
        return;
      }
      const data = await res.json();
      const rawText = llmProvider === "openai"
        ? (data.choices?.[0]?.message?.content ?? "")
        : (data.content?.[0]?.text ?? "");
      const corrected = renderLlmResult(rawText);
      if (!corrected) {
        setLlmError("LLM returned an empty response");
        toast.error("LLM returned an empty response");
        setLlmLoading(false);
        return;
      }
      setText(corrected);
      toast.success("LLM-enhanced text loaded");
      handleSaveHistory();
    } catch (e) {
      setLlmError(`LLM request error: ${(e as Error).message}`);
      toast.error("LLM request error");
    }
    setLlmLoading(false);
  }, [llmKey, llmProvider, text, handleSaveHistory]);

  const stats = result.stats;
  const readability = stats.readability;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="gmt-text">Paste or type your text</Label>
              <span className="text-[10px] text-muted-foreground">
                {stats.wordCount} words · {stats.sentenceCount} sentences · {stats.characters} chars
              </span>
            </div>
            <Textarea
              id="gmt-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Paste your text here. Issues are highlighted as you type."}
              className="min-h-[140px] resize-y text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {SAMPLE_TEXTS.map((s, i) => (
                <Button
                  key={i}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setText(s)}
                >+ Sample {i + 1}</Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={handleAcceptAll}
              disabled={visibleIssues.length === 0}
              className="gap-1.5"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Accept all ({visibleIssues.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReset}
              disabled={dismissedIds.size === 0}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset dismissed
            </Button>
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ text, lang: "en" }); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {text.trim() && (
        <>
          {/* Category legend + stats */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <SpellCheck className="h-4 w-4" /> {visibleIssues.length} issue{visibleIssues.length === 1 ? "" : "s"} found
              </h3>
              <div className="flex flex-wrap gap-2 text-xs">
                {(Object.keys(CATEGORY_LABELS) as IssueCategory[]).map((c) => {
                  const count = stats.byCategory[c];
                  const visible = visibleIssues.filter((i) => i.category === c).length;
                  return (
                    <div
                      key={c}
                      className="rounded border px-2 py-1 flex items-center gap-1.5"
                      style={{ borderColor: `${CATEGORY_COLORS[c]}55` }}
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ background: CATEGORY_COLORS[c] }}
                      />
                      <span className="font-medium">{CATEGORY_LABELS[c]}</span>
                      <Badge variant="secondary" className="text-[10px]">{visible}/{count}</Badge>
                      {visible > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[10px]"
                          onClick={() => handleAcceptAllByCategory(c)}
                        >
                          Accept all
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-xs">
                <Stat label="Errors" value={stats.bySeverity.error} highlight="bad" />
                <Stat label="Warnings" value={stats.bySeverity.warning} />
                <Stat label="Style" value={stats.bySeverity.style} />
                <Stat label="Passive voice" value={readability.passiveVoiceCount} />
                <Stat label="Long sentences" value={readability.longSentenceCount} />
              </div>
              <div className="text-[11px] text-muted-foreground">
                Flesch reading ease: <strong>{readability.fleschReadingEase}</strong> · Grade level: <strong>{readability.fleschGradeLevel}</strong> · Avg words/sentence: <strong>{readability.avgWordsPerSentence}</strong>
              </div>
            </CardContent>
          </Card>

          {/* View toggle */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Eye className="h-4 w-4" /> View
                </h3>
                <div className="flex gap-1">
                  <Button
                    variant={view === "highlighted" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setView("highlighted")}
                  >
                    <Eye className="h-3 w-3" /> Highlighted
                  </Button>
                  <Button
                    variant={view === "diff" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setView("diff")}
                  >
                    <Code2 className="h-3 w-3" /> Diff
                  </Button>
                  <Button
                    variant={view === "markdown" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setView("markdown")}
                  >
                    <FileText className="h-3 w-3" /> Report
                  </Button>
                </div>
              </div>

              {view === "highlighted" && (
                <div
                  className="rounded border bg-background p-3 text-sm whitespace-pre-wrap font-mono leading-relaxed min-h-[80px]"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: highlightedHtml || '<span class="text-muted-foreground">No issues to highlight.</span>' }}
                />
              )}
              {view === "diff" && (
                <div
                  className="rounded border bg-background p-3 text-sm whitespace-pre-wrap font-mono leading-relaxed min-h-[80px]"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: diffHtml || '<span class="text-muted-foreground">No changes.</span>' }}
                />
              )}
              {view === "markdown" && (
                <pre className="rounded border bg-background p-3 text-xs whitespace-pre-wrap font-mono leading-relaxed max-h-[400px] overflow-auto">
                  {markdownReport}
                </pre>
              )}

              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return correctedText; }}
                  label="Copy corrected"
                />
                <DownloadButton
                  getText={() => correctedText}
                  filename="corrected.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => renderHtmlDocument({ ...result, issues: visibleIssues })}
                  filename="corrected.html"
                  mime="text/html"
                  label="Download .html"
                />
                <DownloadButton
                  getText={() => markdownReport}
                  filename="grammar-report.md"
                  mime="text/markdown"
                  label="Download report"
                />
              </div>
            </CardContent>
          </Card>

          {/* Issue list */}
          {visibleIssues.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" /> Issues ({visibleIssues.length})
                </h3>
                <div className="space-y-1 max-h-[400px] overflow-auto">
                  {visibleIssues.map((i, idx) => (
                    <div
                      key={i.id}
                      className="rounded border bg-background px-3 py-2 text-xs space-y-1"
                      style={{ borderLeftColor: CATEGORY_COLORS[i.category], borderLeftWidth: 3 }}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">
                          #{idx + 1}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="text-[10px]"
                          style={{ background: `${CATEGORY_COLORS[i.category]}22`, color: CATEGORY_COLORS[i.category] }}
                        >
                          {CATEGORY_LABELS[i.category]}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {SEVERITY_LABELS[i.severity]}
                        </Badge>
                        <span className="text-muted-foreground text-[10px] ml-auto">
                          offset {i.start}–{i.end}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <code className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive text-[11px] line-through">
                          {i.original || "(missing)"}
                        </code>
                        <span className="text-muted-foreground">→</span>
                        <code className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px]">
                          {i.suggestion || "(remove)"}
                        </code>
                      </div>
                      <p className="text-muted-foreground">{i.explanation}</p>
                      <div className="flex gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[11px]"
                          onClick={() => handleAccept(i)}
                        >
                          <Check className="h-3 w-3" /> Accept
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px]"
                          onClick={() => handleDismiss(i.id)}
                        >
                          <X className="h-3 w-3" /> Dismiss
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!text.trim() && (
        <EmptyState
          title="Paste text to start checking"
          hint="Issues are highlighted by category as you type. Accept single fixes, dismiss false positives, or bulk-accept by category. Click a sample to try."
          icon={<SpellCheck className="h-8 w-8" />}
        />
      )}

      {/* Optional LLM enhancement */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" /> Optional: enhance with LLM (BYO key)
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLlm((s) => !s)}
            >
              {showLlm ? "Hide" : "Show"}
            </Button>
          </div>
          {showLlm && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Optional: bring your own OpenAI or Anthropic API key for a deeper, context-aware rewrite. The key is stored only in this browser&apos;s localStorage and the request goes directly from your browser to the provider.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Provider</Label>
                  <select
                    value={llmProvider}
                    onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                    className="h-9 w-full text-sm rounded border bg-background px-2"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">API key (stored locally)</Label>
                  <Input
                    type="password"
                    value={llmKey}
                    onChange={(e) => setLlmKey(e.target.value)}
                    placeholder="sk-..."
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleSaveLlmKey}>
                  <Key className="h-3.5 w-3.5" /> Save key locally
                </Button>
                <Button
                  size="sm"
                  onClick={handleLlmEnhance}
                  disabled={llmLoading || !llmKey || !text.trim()}
                  className="gap-1.5"
                >
                  {llmLoading ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {llmLoading ? "Working…" : "Enhance with LLM"}
                </Button>
              </div>
              {llmError && <ErrorBanner message={llmError} />}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
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
                  <Badge variant="outline" className="mr-2">{h.issueCount} issues</Badge>
                  <span className="text-muted-foreground">{h.textPreview || "(empty)"}</span>
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
            <strong className="text-foreground">Privacy:</strong> All grammar checking runs locally. Text and history are stored only in this browser. The only network call is if you paste your own LLM API key — that goes directly from your browser to the provider you choose.
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

// Suppress unused-import lint for symbols kept for context
export type _Unused = typeof HISTORY_KEY | typeof HISTORY_MAX | Readability;
