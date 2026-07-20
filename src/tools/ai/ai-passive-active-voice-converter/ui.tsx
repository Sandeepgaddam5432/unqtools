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
  ArrowLeftRight, History, Key, Sparkles, Eye, FileText, Gauge,
} from "lucide-react";
import {
  HISTORY_MAX,
  STYLE_LABELS,
  DIRECTION_LABELS,
  SAMPLE_TEXTS,
  convertVoice,
  renderHighlightedHtml,
  renderSuggestionsCsv,
  buildLlmPrompt,
  renderLlmResult,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Direction,
  type StylePreset,
  type HistoryEntry,
} from "./logic";

const STYLE_ORDER: StylePreset[] = ["general", "academic", "journalism"];

export default function AiPassiveActiveVoiceConverter() {
  const [text, setText] = useState("");
  const [direction, setDirection] = useState<Direction>("to-active");
  const [style, setStyle] = useState<StylePreset>("general");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmOutput, setLlmOutput] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedText, setDebouncedText] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-passive-active-voice-converter:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.text) {
        setText(p.text);
        setDebouncedText(p.text);
        setDirection(p.direction);
        setStyle(p.style);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedText(text), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text]);

  const result = useMemo(
    () => convertVoice(debouncedText, direction, style),
    [debouncedText, direction, style],
  );
  const highlightedHtml = useMemo(() => renderHighlightedHtml(result), [result]);
  const suggestionsCsv = useMemo(() => renderSuggestionsCsv(result), [result]);

  const handleClear = useCallback(() => {
    setText("");
    setDebouncedText("");
    setLlmOutput("");
    setLlmError("");
    toast.info("Cleared");
  }, []);

  const handleSample = useCallback(
    (s: { label: string; direction: Direction; text: string }) => {
      setText(s.text);
      setDebouncedText(s.text);
      setDirection(s.direction);
      toast.info(`Loaded sample: ${s.label}`);
    },
    [],
  );

  const handleSaveHistory = useCallback(() => {
    if (!debouncedText.trim()) return;
    saveHistory({
      ts: Date.now(),
      direction,
      style,
      textLength: result.original.length,
      sentenceCount: result.stats.sentenceCount,
      passiveCount: result.stats.passiveCount,
      convertedCount: result.stats.convertedCount,
      passivePercentage: result.stats.passivePercentage,
    });
    setHistory(loadHistory());
  }, [debouncedText, direction, style, result]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleEnhanceWithLlm = useCallback(async () => {
    if (!llmKey) {
      setLlmError("Enter an API key first.");
      return;
    }
    if (!text.trim()) {
      setLlmError("Enter some text to enhance.");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    setLlmOutput("");
    try {
      const prompt = buildLlmPrompt(text, direction);
      const endpoint = llmProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages";
      const headers: Record<string, string> = llmProvider === "openai"
        ? { "Content-Type": "application/json", "Authorization": `Bearer ${llmKey}` }
        : {
          "Content-Type": "application/json",
          "x-api-key": llmKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        };
      const body = llmProvider === "openai"
        ? JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a grammar editor specializing in active/passive voice." },
            { role: "user", content: prompt },
          ],
          max_tokens: 1000,
          temperature: 0.3,
        })
        : JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 1000,
          system: "You are a grammar editor specializing in active/passive voice.",
          messages: [{ role: "user", content: prompt }],
        });
      const res = await fetch(endpoint, { method: "POST", headers, body });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      const json = await res.json();
      const out = llmProvider === "openai"
        ? json.choices?.[0]?.message?.content ?? ""
        : json.content?.[0]?.text ?? "";
      setLlmOutput(renderLlmResult(out));
      toast.success("LLM enhancement complete");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setLlmError(msg);
      toast.error("LLM enhancement failed");
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, text, direction]);

  const handleSaveLlmKey = useCallback((v: string) => {
    setLlmKey(v);
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("unqtools:ai-passive-active-voice-converter:llm-key", v);
      } catch {
        // ignore
      }
    }
  }, []);

  const hasContent = debouncedText.trim().length > 0;
  const stats = result.stats;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["to-active", "to-passive"] as Direction[]).map((d) => (
              <Button
                key={d}
                size="sm"
                variant={direction === d ? "default" : "outline"}
                onClick={() => setDirection(d)}
                className="gap-1.5"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" /> {DIRECTION_LABELS[d]}
              </Button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="paavc-text">
              {direction === "to-active"
                ? "Paste text with passive voice to convert to active"
                : "Paste active-voice text to convert to passive"}
            </Label>
            <Textarea
              id="paavc-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                direction === "to-active"
                  ? "The report was written by Jane. The data has been analyzed by the team…"
                  : "Jane wrote the report. The team analyzed the data…"
              }
              className="min-h-[140px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {SAMPLE_TEXTS.map((s) => (
                <Button
                  key={s.label}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => handleSample(s)}
                >+ {s.label}</Button>
              ))}
            </div>
          </div>

          {direction === "to-active" && (
            <div>
              <Label className="text-xs">Style preset</Label>
              <div className="flex flex-wrap gap-1 pt-1">
                {STYLE_ORDER.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={style === s ? "default" : "outline"}
                    className="h-7 text-[11px]"
                    onClick={() => setStyle(s)}
                  >{STYLE_LABELS[s].split(" (")[0]}</Button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{STYLE_LABELS[style]}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {hasContent ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Gauge className="h-4 w-4" /> Document stats
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Sentences" value={stats.sentenceCount} />
                <Stat label="Words" value={stats.wordCount} />
                <Stat
                  label={direction === "to-active" ? "Passive clauses" : "Active sentences"}
                  value={direction === "to-active" ? stats.passiveCount : stats.activeCount}
                  highlight={direction === "to-active" && stats.passiveCount > 0 ? "warn" : undefined}
                />
                <Stat
                  label={direction === "to-active" ? "Legitimate passives" : "Converted"}
                  value={direction === "to-active" ? stats.legitimateCount : stats.convertedCount}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {direction === "to-active" ? "Passive voice %" : "Convertible to passive %"}
                  </span>
                  <span className="font-mono font-medium text-foreground">{stats.passivePercentage}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${
                      stats.passivePercentage >= 50
                        ? "bg-red-500"
                        : stats.passivePercentage >= 25
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                    style={{ width: `${stats.passivePercentage}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {direction === "to-active" && stats.passiveCount > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Eye className="h-4 w-4" /> Passive clauses highlighted
                </h3>
                <div
                  className="prose prose-sm max-w-none rounded border bg-background p-3 text-xs leading-relaxed font-mono"
                  dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                />
                <style>{`
                  .pa-passive { background: rgba(245, 158, 11, 0.25); padding: 0 2px; border-radius: 3px; cursor: help; }
                  .pa-flag { background: rgba(245, 158, 11, 0.3); }
                  .pa-legit { background: rgba(16, 185, 129, 0.25); }
                `}</style>
              </CardContent>
            </Card>
          )}

          {result.sentences.some((s) =>
            direction === "to-active"
              ? s.clauses.some((c) => c.rewrite || c.isLegitimate)
              : s.activeRewrite && s.activeRewrite.passiveRewrite,
          ) && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Suggestions
                </h3>
                <div className="space-y-1 max-h-[500px] overflow-auto">
                  {result.sentences.map((s) => (
                    <SentenceSuggestions key={s.index} sentence={s} direction={direction} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <CopyButton
                    getText={() => { handleSaveHistory(); return result.converted; }}
                    label="Copy converted"
                  />
                  <DownloadButton
                    getText={() => { handleSaveHistory(); return result.converted; }}
                    filename={`converted-${direction}.txt`}
                    mime="text/plain"
                    label="Download .txt"
                  />
                  <DownloadButton
                    getText={() => suggestionsCsv}
                    filename="voice-suggestions.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                  <ShareButton
                    getUrl={() => { handleSaveHistory(); return buildShareUrl(text, direction, style); }}
                  />
                  <ClearButton onClick={handleClear} />
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Converted text</h3>
              <div className="rounded border bg-background p-3 text-xs whitespace-pre-wrap font-mono">
                {result.converted}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Key className="h-4 w-4" /> Optional LLM enhancement (BYO key)
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setShowLlm((v) => !v)}>
                  {showLlm ? "Hide" : "Show"}
                </Button>
              </div>
              {showLlm && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    The on-device engine above is the default and works 100% offline. Optionally
                    paste your own LLM API key for a more nuanced rewrite — your text goes directly
                    from your browser to the provider you choose, never to UnQTools.
                  </p>
                  <div className="flex flex-wrap gap-2">
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
                      placeholder={llmProvider === "openai" ? "sk-…" : "sk-ant-…"}
                      value={llmKey}
                      onChange={(e) => handleSaveLlmKey(e.target.value)}
                      className="h-8 text-xs flex-1 min-w-[200px]"
                    />
                    <Button
                      size="sm"
                      onClick={handleEnhanceWithLlm}
                      disabled={llmLoading || !llmKey || !text.trim()}
                      className="gap-1.5"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {llmLoading ? "Working…" : "Enhance"}
                    </Button>
                  </div>
                  {llmError && <ErrorBanner message={llmError} />}
                  {llmOutput && (
                    <div className="rounded border bg-background p-3 text-xs whitespace-pre-wrap">
                      {llmOutput}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title={direction === "to-active"
            ? "Paste text to convert passive → active"
            : "Paste text to convert active → passive"}
          hint={
            direction === "to-active"
              ? "The engine detects passive clauses, identifies the agent, and proposes an active rewrite per sentence. Legitimate passives (agent unknown) are flagged, not blindly rewritten. Click a sample to try it."
              : "The engine looks for past-tense active sentences with a clear subject/verb/object and produces a passive rewrite. Click a sample to try it."
          }
          icon={<ArrowLeftRight className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent (last {HISTORY_MAX})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{DIRECTION_LABELS[h.direction]}</Badge>
                  <Badge variant="outline" className="mr-2">{h.sentenceCount} sentences</Badge>
                  <Badge variant="outline" className="mr-2">{h.passiveCount} passive</Badge>
                  <Badge variant="outline" className="mr-2">{h.passivePercentage}%</Badge>
                  <span className="text-muted-foreground">· {h.textLength} chars · {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy & honesty:</strong> All sentence splitting,
            passive detection, agent identification, and rewriting runs locally. Text never leaves
            this device. Passive voice isn't always wrong — the engine preserves and explains
            legitimate passives (science writing, unknown agents) instead of forcing conversion.
            The on-device detector is conservative (high-precision, lower-recall) to avoid false
            positives on stative adjectives like "is interested in".
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SentenceSuggestions({
  sentence,
  direction,
}: {
  sentence: import("./logic").Sentence;
  direction: Direction;
}) {
  if (direction === "to-active") {
    if (sentence.clauses.length === 0) return null;
    return (
      <div className="rounded border bg-background px-3 py-2 text-xs space-y-2">
        <div className="text-muted-foreground italic">“{sentence.text}”</div>
        {sentence.clauses.map((c) => (
          <div key={`${c.start}-${c.end}`} className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-foreground">“{c.originalClause}”</span>
              <Badge variant="outline" className="text-[10px]">{c.tense}</Badge>
              {c.isLegitimate && (
                <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400">
                  Legitimate passive
                </Badge>
              )}
              {c.agent && (
                <Badge variant="outline" className="text-[10px]">
                  Agent: {c.agent}
                </Badge>
              )}
              {c.agentSource === "agentless" && (
                <Badge variant="outline" className="text-[10px]">Agentless</Badge>
              )}
            </div>
            {c.rewrite ? (
              <div className="pl-3 border-l-2 border-emerald-400/40">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Active rewrite: </span>
                <span className="font-mono text-foreground">{c.rewrite}</span>
              </div>
            ) : (
              <div className="pl-3 border-l-2 border-amber-400/40 text-muted-foreground">
                {c.legitimateReason ?? "No confident rewrite available."}
              </div>
            )}
            <div className="pl-3 text-[10px] text-muted-foreground">{c.explanation}</div>
          </div>
        ))}
      </div>
    );
  }
  // to-passive
  if (!sentence.activeRewrite || !sentence.activeRewrite.passiveRewrite) return null;
  return (
    <div className="rounded border bg-background px-3 py-2 text-xs space-y-1">
      <div className="text-muted-foreground italic">“{sentence.text}”</div>
      <div className="pl-3 border-l-2 border-emerald-400/40">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Passive rewrite: </span>
        <span className="font-mono text-foreground">{sentence.activeRewrite.passiveRewrite}</span>
      </div>
      <div className="pl-3 text-[10px] text-muted-foreground">{sentence.activeRewrite.explanation}</div>
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
  highlight?: "good" | "warn" | "bad";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "warn"
      ? "text-amber-600 dark:text-amber-400"
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
