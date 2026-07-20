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
} from "../../_shared";
import { toast } from "sonner";
import {
  JARGON_DICTIONARY,
  LEVEL_LABELS,
  DEFAULT_OPTIONS,
  SAMPLE_TEXTS,
  simplifyText,
  diffText,
  detectPassiveVoice,
  computeReadability,
  loadHistory,
  saveHistory,
  clearHistory,
  loadIgnored,
  saveIgnored,
  buildShareUrl,
  parseShareUrl,
  buildLlmRequestBody,
  extractSimplifiedFromLlmResponse,
  type ReadingLevel,
  type SimplifyOptions,
  type HistoryEntry,
  type DiffSegment,
} from "./logic";
import {
  Baby, History, Sparkles, Wand2, AlertTriangle, BookOpen, KeyRound, Loader2,
} from "lucide-react";

const LEVELS: ReadingLevel[] = ["eli5", "grade-school", "teen", "plain-professional"];

export default function AiTextSimplifierEli5() {
  const [text, setText] = useState("");
  const [level, setLevel] = useState<ReadingLevel>(DEFAULT_OPTIONS.level);
  const [lockTokens, setLockTokens] = useState(DEFAULT_OPTIONS.lockTokens);
  const [splitLongSentences, setSplitLongSentences] = useState(DEFAULT_OPTIONS.splitLongSentences);
  const [bulletize, setBulletize] = useState(DEFAULT_OPTIONS.bulletize);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [ignoredInput, setIgnoredInput] = useState("");
  const [showDiff, setShowDiff] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmResult, setLlmResult] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setIgnored(loadIgnored());
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.text !== undefined) setText(p.text);
      if (p.level) setLevel(p.level);
      if (p.lockTokens !== undefined) setLockTokens(p.lockTokens);
      if (p.splitLongSentences !== undefined) setSplitLongSentences(p.splitLongSentences);
      if (p.bulletize !== undefined) setBulletize(p.bulletize);
      if (p.text) toast.info("Loaded from share link");
    }
  }, []);

  const options: SimplifyOptions = useMemo(
    () => ({ level, lockTokens, splitLongSentences, bulletize, ignored }),
    [level, lockTokens, splitLongSentences, bulletize, ignored],
  );

  const result = useMemo(
    () => simplifyText(text, options),
    [text, options],
  );

  const diffSegs = useMemo(
    () => (showDiff && text ? diffText(result.original, result.simplified) : []),
    [showDiff, text, result],
  );

  const passiveHits = useMemo(
    () => (text ? detectPassiveVoice(text) : []),
    [text],
  );

  const handleSaveHistory = useCallback(() => {
    if (!text) return;
    saveHistory({
      ts: Date.now(),
      level,
      originalLength: text.length,
      simplifiedLength: result.simplified.length,
      jargonCount: result.stats.jargonCount,
      improvement: result.stats.improvement,
    });
    setHistory(loadHistory());
  }, [text, level, result]);

  const handleClear = useCallback(() => {
    setText("");
    setLlmResult("");
    setShowDiff(false);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleAddIgnored = useCallback(() => {
    const t = ignoredInput.trim().toLowerCase();
    if (!t) return;
    if (ignored.includes(t)) {
      setIgnoredInput("");
      return;
    }
    const next = [...ignored, t];
    setIgnored(next);
    saveIgnored(next);
    setIgnoredInput("");
    toast.success(`Added "${t}" to ignore list`);
  }, [ignored, ignoredInput]);

  const handleRemoveIgnored = useCallback((t: string) => {
    const next = ignored.filter((x) => x !== t);
    setIgnored(next);
    saveIgnored(next);
  }, [ignored]);

  const handleEnhanceLlm = useCallback(async () => {
    if (!apiKey) {
      toast.error("Paste your API key first");
      return;
    }
    if (!text) {
      toast.error("Paste some text first");
      return;
    }
    setLlmLoading(true);
    setLlmResult("");
    try {
      const body = buildLlmRequestBody(text, level);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        toast.error(`API error ${res.status}: ${txt.slice(0, 200)}`);
        return;
      }
      const json = await res.json();
      const out = extractSimplifiedFromLlmResponse(json);
      if (out) {
        setLlmResult(out);
        toast.success("LLM enhancement complete");
      } else {
        toast.error("No content in LLM response");
      }
    } catch (e) {
      toast.error(`Could not reach API: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLlmLoading(false);
    }
  }, [apiKey, text, level]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="eli5-text">Paste your text</Label>
            <Textarea
              id="eli5-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Paste dense or jargon-heavy text here..."}
              className="min-h-[120px] resize-y text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {SAMPLE_TEXTS.map((s) => (
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
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Reading level</Label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as ReadingLevel)}
                className="mt-1 w-full h-9 text-sm rounded border bg-background px-2"
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end gap-1">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={lockTokens}
                  onChange={(e) => setLockTokens(e.target.checked)}
                />
                Preserve numbers/dates/citations
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={splitLongSentences}
                  onChange={(e) => setSplitLongSentences(e.target.checked)}
                />
                Split long sentences
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulletize}
                  onChange={(e) => setBulletize(e.target.checked)}
                />
                Bullet-ize (one sentence per line)
              </label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ignore list (terms to never substitute)</Label>
            <div className="flex gap-2">
              <Input
                value={ignoredInput}
                onChange={(e) => setIgnoredInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddIgnored(); } }}
                placeholder="e.g. methodology"
                className="h-8 text-xs"
              />
              <Button variant="outline" size="sm" className="h-8" onClick={handleAddIgnored}>Add</Button>
            </div>
            {ignored.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {ignored.map((t) => (
                  <Badge
                    key={t}
                    variant="outline"
                    className="text-[10px] cursor-pointer"
                    onClick={() => handleRemoveIgnored(t)}
                  >
                    {t} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {text ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> Readability &amp; stats
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat
                  label="Reading ease (before)"
                  value={result.stats.originalReadability.fleschReadingEase}
                />
                <Stat
                  label="Reading ease (after)"
                  value={result.stats.simplifiedReadability.fleschReadingEase}
                  highlight={result.stats.improvement > 0 ? "good" : undefined}
                />
                <Stat
                  label="Grade level (before → after)"
                  value={`${result.stats.originalReadability.fleschGradeLevel} → ${result.stats.simplifiedReadability.fleschGradeLevel}`}
                />
                <Stat
                  label="Improvement"
                  value={`+${result.stats.improvement}`}
                  highlight={result.stats.improvement > 0 ? "good" : undefined}
                />
                <Stat label="Jargon hits" value={result.stats.jargonCount} />
                <Stat label="Locked tokens" value={result.stats.lockedCount} />
                <Stat label="Long sentences" value={result.stats.longSentenceCount} highlight={result.stats.longSentenceCount > 0 ? "bad" : undefined} />
                <Stat label="Passive voice" value={result.stats.passiveVoiceCount} highlight={result.stats.passiveVoiceCount > 0 ? "bad" : undefined} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Baby className="h-4 w-4" /> Simplified
                </h3>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showDiff}
                    onChange={(e) => setShowDiff(e.target.checked)}
                  />
                  Show diff
                </label>
              </div>
              {showDiff && diffSegs.length > 0 ? (
                <div className="rounded border bg-background p-3 text-sm whitespace-pre-wrap leading-relaxed">
                  {diffSegs.map((seg: DiffSegment, i: number) => {
                    const cls =
                      seg.type === "added"
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200"
                        : seg.type === "removed"
                          ? "bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200 line-through"
                          : "";
                    return (
                      <span key={i} className={cls}>{seg.text}</span>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded border bg-background p-3 text-sm whitespace-pre-wrap leading-relaxed">
                  {result.simplified || <span className="text-muted-foreground">No output.</span>}
                </div>
              )}
              {result.hits.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    Jargon glossary ({result.hits.length} term{result.hits.length === 1 ? "" : "s"})
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {result.hits.map((h) => (
                      <li key={h.id} className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-[10px]">{h.original}</Badge>
                        <span className="text-foreground">→ {h.replacement}</span>
                        <span className="text-muted-foreground">{h.entry.gloss}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {result.locked.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    Preserved tokens ({result.locked.length})
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {result.locked.map((l, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">{l.kind}: {l.text}</Badge>
                    ))}
                  </div>
                </details>
              )}
              {passiveHits.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    Passive-voice phrases ({passiveHits.length})
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {passiveHits.map((p, i) => (
                      <li key={i} className="text-foreground">• {p.text}</li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return result.simplified; }}
                  label="Copy simplified"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return result.simplified; }}
                  filename="simplified.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <ShareButton
                  getUrl={() => {
                    handleSaveHistory();
                    return buildShareUrl({
                      text,
                      level,
                      lockTokens,
                      splitLongSentences,
                      bulletize,
                    });
                  }}
                />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <KeyRound className="h-4 w-4" /> Optional: enhance with your LLM key
              </div>
              <p className="text-xs text-muted-foreground">
                Paste an OpenAI-compatible API key to ask an LLM to rewrite at the chosen level. The key is used only from your browser — it is never sent to us or stored on a server.
              </p>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="h-8 text-xs font-mono"
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={llmLoading || !apiKey || !text}
                onClick={handleEnhanceLlm}
              >
                {llmLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {llmLoading ? "Working…" : "Enhance with LLM"}
              </Button>
              {llmResult && (
                <div className="rounded border bg-background p-3 text-sm whitespace-pre-wrap">
                  {llmResult}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste text to simplify"
          hint="Pick a reading level and we'll rewrite your text into plain language — jargon glosses, sentence splitting, Flesch readability before/after, and locked numbers/dates/citations. 100% on-device."
          icon={<Baby className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{LEVEL_LABELS[h.level]}</Badge>
                  <Badge variant="outline" className="mr-2">+{h.improvement} ease</Badge>
                  <Badge variant="outline" className="mr-2">{h.jargonCount} jargon</Badge>
                  <span className="text-muted-foreground">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>
              <strong className="text-foreground">Honesty:</strong> On-device simplification is rule-based (synonym substitution + sentence splitting + glossary) and may alter precise meaning. Always verify legal, medical, or financial text against the original. Nothing is uploaded or logged by us; the only network call is your own optional LLM key.
            </p>
          </div>
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

// Unused import suppressor
export type _Unused = typeof Wand2;
