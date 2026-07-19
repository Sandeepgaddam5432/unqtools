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
  DEPTH_LABELS,
  DEPTH_SENTENCE_COUNT,
  analyzeBook,
  computeStats,
  renderMarkdown,
  renderJson,
  renderOutlineMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Depth,
  type BookReport,
  type HistoryEntry,
  type LlmEnhancement,
} from "./logic";
import {
  BookOpen, Sparkles, Key, History, AlertCircle, Lightbulb,
  FileText, ListTree, HelpCircle, Eye, EyeOff, BookMarked, Quote,
} from "lucide-react";

const SAMPLE =
  "Chapter 1: Introduction\n" +
  "This book explains how to build habits. Small habits compound over time. " +
  "The author argues that tiny changes lead to remarkable results. " +
  "You should focus on systems, not goals. Goals are about results; systems are about processes. " +
  "Make a habit obvious, attractive, easy, and satisfying.\n\n" +
  "Chapter 2: The Science of Habits\n" +
  "Habits form through a four-step loop: cue, craving, response, reward. " +
  "The cue triggers a craving, which motivates a response, which delivers a reward. " +
  "According to a 2009 study, it takes about 66 days to form a new habit. " +
  "Remember that progress is non-linear. You must be patient.\n\n" +
  "Chapter 3: Identity Change\n" +
  "True behavior change is identity change. Don't just set a goal to run a marathon; become a runner. " +
  "Your habits shape your identity, and your identity shapes your habits. " +
  "Every action you take is a vote for the type of person you wish to become.";

export default function AiBookSummaryGenerator() {
  const [text, setText] = useState("");
  const [depth, setDepth] = useState<Depth>("medium");
  const [report, setReport] = useState<BookReport | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<LlmEnhancement | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  const [showOutline, setShowOutline] = useState(true);
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
        setDepth(p.depth);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const handleAnalyze = useCallback(() => {
    setError("");
    try {
      const r = analyzeBook(text, depth);
      setReport(r);
      setLlmResult(null);
      // Expand first 3 chapters by default.
      setExpandedChapters(new Set(r.chapterSummaries.slice(0, 3).map((_, i) => i)));
      if (text.trim()) {
        saveHistory({
          ts: Date.now(),
          title: r.chapterSummaries[0]?.chapter.title || "Untitled",
          wordCount: r.stats.wordCount,
          chapterCount: r.stats.chapterCount,
          depth,
        });
        setHistory(loadHistory());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    }
  }, [text, depth]);

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

  const toggleChapter = useCallback((i: number) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (!report) return;
    setExpandedChapters(new Set(report.chapterSummaries.map((_, i) => i)));
  }, [report]);

  const collapseAll = useCallback(() => {
    setExpandedChapters(new Set());
  }, []);

  const handleLlm = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your API key first");
      return;
    }
    if (!text.trim()) {
      toast.error("Paste book text first");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    setLlmResult(null);
    try {
      const prompt = buildLlmPrompt(text, depth);
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
          max_tokens: 4096,
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
  }, [llmKey, llmProvider, text, depth]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="bsg-text">Book / manuscript text</Label>
            <Textarea
              id="bsg-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Paste your book or manuscript here. Chapter headings like 'Chapter 1:' or 'Part I' are detected automatically."}
              className="min-h-[220px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setText(SAMPLE)}>
                Load sample (Atomic Habits-style)
              </Button>
              <div className="ml-auto flex items-center gap-1.5">
                <Label className="text-[11px] text-muted-foreground">Depth</Label>
                <select
                  value={depth}
                  onChange={(e) => setDepth(e.target.value as Depth)}
                  className="h-7 text-xs rounded border bg-background px-2"
                >
                  {(["low", "medium", "high"] as Depth[]).map((d) => (
                    <option key={d} value={d}>{DEPTH_LABELS[d]}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleAnalyze} disabled={!text.trim()} label="Generate summary" />
            <CopyButton
              getText={() => report ? renderMarkdown(report) : ""}
              label="Copy Markdown"
              disabled={!report}
            />
            <DownloadButton
              getText={() => report ? renderMarkdown(report) : ""}
              filename="book-summary.md"
              mime="text/markdown"
              label="Download .md"
              disabled={!report}
            />
            <DownloadButton
              getText={() => report ? renderJson(report) : ""}
              filename="book-summary.json"
              mime="application/json"
              label="Download JSON"
              disabled={!report}
            />
            <ShareButton getUrl={() => buildShareUrl(text, depth)} disabled={!text.trim()} />
            <ClearButton onClick={handleClear} disabled={!text && !report} />
          </div>
          {error && <ErrorBanner message={error} />}
        </CardContent>
      </Card>

      {report && stats && (
        <>
          {report.warnings.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                {report.warnings.map((w, i) => <div key={i}>· {w}</div>)}
              </div>
            </div>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> Summary overview
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Words" value={stats.wordCount} />
                <Stat label="Sentences" value={stats.sentenceCount} />
                <Stat label="Chapters" value={stats.chapterCount} />
                <Stat label="Est. reading time" value={`${stats.readingTimeMinutes} min`} />
              </div>
              <div className="rounded border bg-background p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Premise</div>
                <p className="text-sm text-foreground">{report.premise || "_(none)_"}</p>
              </div>
              {report.keyIdeas.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Key ideas</div>
                  <div className="flex flex-wrap gap-1.5">
                    {report.keyIdeas.map((k, i) => (
                      <Badge key={i} variant="secondary" className="text-[11px]">{k}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {report.overallSummary.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Overall summary
                </h3>
                <ul className="space-y-1.5 text-xs">
                  {report.overallSummary.map((s, i) => (
                    <li key={i} className="rounded border bg-background px-3 py-1.5 text-foreground">
                      {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {report.takeaways.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4" /> Takeaways
                </h3>
                <ul className="space-y-1.5 text-xs list-disc pl-5">
                  {report.takeaways.map((t, i) => (
                    <li key={i} className="text-foreground">{t}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <BookMarked className="h-4 w-4" /> Chapter breakdown ({report.chapterSummaries.length})
                </h3>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={expandAll}>Expand all</Button>
                  <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={collapseAll}>Collapse all</Button>
                </div>
              </div>
              <div className="space-y-1">
                {report.chapterSummaries.map((cs, i) => (
                  <div key={i} className="rounded border bg-background">
                    <button
                      className="flex w-full items-center justify-between px-3 py-2 text-left"
                      onClick={() => toggleChapter(i)}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{i + 1}</Badge>
                        <span className="text-sm font-medium text-foreground">{cs.chapter.title}</span>
                        <span className="text-[10px] text-muted-foreground">{cs.wordCount} words · {cs.sentenceCount} sentences</span>
                      </div>
                      {expandedChapters.has(i) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    {expandedChapters.has(i) && (
                      <div className="px-3 pb-3 space-y-2 text-xs">
                        {cs.summary.length > 0 && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Summary ({cs.summary.length} sentence{cs.summary.length === 1 ? "" : "s"})</div>
                            <ul className="list-disc pl-5 mt-1 space-y-0.5">
                              {cs.summary.map((s, j) => <li key={j} className="text-foreground">{s}</li>)}
                            </ul>
                          </div>
                        )}
                        {cs.keywords.length > 0 && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Keywords</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {cs.keywords.map((k, j) => (
                                <Badge key={j} variant="outline" className="text-[10px]">{k}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {cs.takeaways.length > 0 && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Takeaways</div>
                            <ul className="list-disc pl-5 mt-1 space-y-0.5">
                              {cs.takeaways.map((t, j) => <li key={j} className="text-foreground">{t}</li>)}
                            </ul>
                          </div>
                        )}
                        {cs.qaPairs.length > 0 && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                              <HelpCircle className="h-3 w-3" /> Q&A
                            </div>
                            <ul className="mt-1 space-y-1">
                              {cs.qaPairs.map((qa, j) => (
                                <li key={j} className="rounded bg-muted/30 px-2 py-1">
                                  <div className="text-foreground"><strong>Q:</strong> {qa.question}</div>
                                  <div className="text-muted-foreground mt-0.5"><strong>A:</strong> {qa.answer}</div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <button
                className="flex w-full items-center justify-between text-left"
                onClick={() => setShowOutline((v) => !v)}
              >
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ListTree className="h-4 w-4" /> Outline / mind map
                </h3>
                {showOutline ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              {showOutline && (
                <pre className="rounded border bg-background p-3 text-[11px] font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
                  {renderOutlineMarkdown(report) || "_(empty)_"}
                </pre>
              )}
            </CardContent>
          </Card>

          {llmResult && (
            <Card>
              <CardContent className="p-4 space-y-2 border-l-4 border-l-primary">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> LLM enhancement
                </h3>
                <div className="rounded border bg-background p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Premise</div>
                  <p className="text-sm text-foreground">{llmResult.premise || "_(none)_"}</p>
                </div>
                {llmResult.keyIdeas.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Key ideas</div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {llmResult.keyIdeas.map((k, i) => (
                        <Badge key={i} variant="secondary" className="text-[11px]">{k}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {llmResult.overallSummary.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Overall summary</div>
                    <ul className="list-disc pl-5 mt-1 text-xs">
                      {llmResult.overallSummary.map((s, i) => <li key={i} className="text-foreground">{s}</li>)}
                    </ul>
                  </div>
                )}
                {llmResult.takeaways.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Takeaways</div>
                    <ul className="list-disc pl-5 mt-1 text-xs">
                      {llmResult.takeaways.map((t, i) => <li key={i} className="text-foreground">{t}</li>)}
                    </ul>
                  </div>
                )}
                {llmResult.chapterSummaries.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Chapter summaries</div>
                    <ul className="mt-1 space-y-1 text-xs">
                      {llmResult.chapterSummaries.map((c, i) => (
                        <li key={i} className="rounded bg-muted/30 px-2 py-1">
                          <div className="text-foreground font-medium">{c.title}</div>
                          <ul className="list-disc pl-5 mt-0.5">
                            {c.summary.map((s, j) => <li key={j} className="text-muted-foreground">{s}</li>)}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {llmResult.reasoning.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                      <Quote className="h-3 w-3" /> Reasoning
                    </div>
                    <ul className="list-disc pl-5 mt-1 text-xs">
                      {llmResult.reasoning.map((r, i) => <li key={i} className="text-muted-foreground">{r}</li>)}
                    </ul>
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
                    On-device extractive summarization picks the highest-scoring sentences from the source — it does not generate new prose. For abstractive summaries with subtle nuance, paste your own LLM API key. The key is stored only in localStorage on this device; the request goes directly from your browser to the provider.
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
          title="Paste a book or manuscript to generate a multi-level summary"
          hint="Multi-level extractive summary: one-line premise, key ideas, chapter-by-chapter breakdown, takeaways, and a collapsible outline. Long text is handled with hierarchical chunk-and-merge. 100% client-side."
          icon={<BookOpen className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.depth}</Badge>
                  <Badge variant="outline" className="mr-2">{h.chapterCount} ch</Badge>
                  <Badge variant="outline" className="mr-2">{h.wordCount} words</Badge>
                  <span className="text-muted-foreground">{h.title}</span>
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
            <strong className="text-foreground">Honesty:</strong> This tool uses extractive summarization — it picks the highest-scoring sentences from the source text. It does not generate new prose or capture subtle literary nuance. For tougher cases, paste your own LLM API key. Only summarize content you have the rights to. All processing is on-device; nothing is uploaded.
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

// Suppress unused-import lint
export const _historyKey = HISTORY_KEY;
export const _depthSentenceCount = DEPTH_SENTENCE_COUNT;
