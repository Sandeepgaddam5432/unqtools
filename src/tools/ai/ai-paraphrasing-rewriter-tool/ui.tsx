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
  rewrite,
  renderMarkdown,
  computeDiff,
  renderDiffHtml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  type ParaphraseMode,
  type VoiceMode,
  type RewriteResult,
  type HistoryEntry,
} from "./logic";
import {
  RefreshCw, History, KeyRound, Loader2, AlertTriangle, Wand2, GitCompare,
  ChevronDown, ChevronRight,
} from "lucide-react";

const SAMPLE_TEXT = `The team uses agile methodology to manage the project. They make progress every sprint. The developers write code and test it. The product owner gives feedback. The team improves the process over time.

Customers love the new features. They want more updates. The marketing team shows the product to potential buyers. Sales go up every quarter. The company makes a lot of money.`;

type LlmProvider = "openai" | "anthropic" | "openrouter";

const MODE_LABELS: Record<ParaphraseMode, string> = {
  standard: "Standard",
  fluent: "Fluent",
  formal: "Formal",
  casual: "Casual",
  concise: "Concise",
  expand: "Expand",
};

const VOICE_LABELS: Record<VoiceMode, string> = {
  preserve: "Preserve voice",
  active: "Force active",
  passive: "Force passive",
};

export default function AiParaphrasingRewriterTool() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ParaphraseMode>("standard");
  const [strength, setStrength] = useState<number>(3);
  const [voice, setVoice] = useState<VoiceMode>("preserve");
  const [variation, setVariation] = useState<number>(0);
  const [preserveTermsText, setPreserveTermsText] = useState("");
  const [result, setResult] = useState<RewriteResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showLlm, setShowLlm] = useState(false);
  const [llmProvider, setLlmProvider] = useState<LlmProvider>("openai");
  const [llmKey, setLlmKey] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmOutput, setLlmOutput] = useState<string>("");
  const [expandedSentence, setExpandedSentence] = useState<number | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.text) {
        setText(p.text);
        setMode(p.mode);
        setStrength(p.strength);
        setVoice(p.voice);
        setVariation(p.variation);
        toast.info("Loaded from share link");
      }
    }
    if (typeof window !== "undefined") {
      try {
        const k = window.localStorage.getItem("unqtools:llm-key") ?? "";
        if (k) setLlmKey(k);
      } catch { /* ignore */ }
    }
  }, []);

  const preserveTerms = useMemo(
    () => preserveTermsText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
    [preserveTermsText],
  );

  const diff = useMemo(() => {
    if (!result) return [];
    return computeDiff(text, result.text);
  }, [text, result]);

  const diffHtml = useMemo(() => renderDiffHtml(diff), [diff]);

  const markdown = useMemo(
    () => (result ? renderMarkdown(result) : ""),
    [result],
  );

  const handleRun = useCallback(() => {
    if (!text.trim()) {
      toast.error("Paste some text first");
      return;
    }
    const r = rewrite(text, {
      mode, strength, voice, variation, preserveTerms,
    });
    setResult(r);
    saveHistory({
      ts: Date.now(),
      mode, strength, voice,
      originalWordCount: r.stats.originalWordCount,
      rewrittenWordCount: r.stats.rewrittenWordCount,
      readabilityDelta: r.stats.readabilityDelta,
      preview: r.text.slice(0, 100),
    });
    setHistory(loadHistory());
    setLlmOutput("");
    toast.success(`Rewritten — ${r.stats.rewrittenWordCount} words (Δ readability ${r.stats.readabilityDelta > 0 ? "+" : ""}${r.stats.readabilityDelta.toFixed(1)})`);
  }, [text, mode, strength, voice, variation, preserveTerms]);

  const handleClear = useCallback(() => {
    setText("");
    setResult(null);
    setLlmOutput("");
    setExpandedSentence(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadSample = useCallback(() => {
    setText(SAMPLE_TEXT);
    setResult(null);
    toast.info("Sample loaded");
  }, []);

  const handleSaveKey = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      if (llmKey) {
        window.localStorage.setItem("unqtools:llm-key", llmKey);
        toast.success("API key saved locally");
      } else {
        window.localStorage.removeItem("unqtools:llm-key");
        toast.info("API key cleared");
      }
    } catch {
      toast.error("Could not save key");
    }
  }, [llmKey]);

  const handleRunLlm = useCallback(async () => {
    if (!text.trim()) {
      toast.error("Paste some text first");
      return;
    }
    if (!llmKey.trim()) {
      toast.error("Enter your API key first");
      return;
    }
    setLlmLoading(true);
    setLlmOutput("");
    try {
      const prompt = buildLlmPrompt(text, mode, strength);
      const endpoint =
        llmProvider === "openai"
          ? "https://api.openai.com/v1/chat/completions"
          : llmProvider === "anthropic"
            ? "https://api.anthropic.com/v1/messages"
            : "https://openrouter.ai/api/v1/chat/completions";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let body: string;
      if (llmProvider === "anthropic") {
        headers["x-api-key"] = llmKey;
        headers["anthropic-version"] = "2023-06-01";
        body = JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 800,
          system: prompt.system,
          messages: [{ role: "user", content: prompt.user }],
        });
      } else {
        headers["Authorization"] = `Bearer ${llmKey}`;
        body = JSON.stringify({
          model: llmProvider === "openai" ? "gpt-4o-mini" : "anthropic/claude-3.5-haiku",
          max_tokens: 800,
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
        });
      }
      const res = await fetch(endpoint, { method: "POST", headers, body });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
      }
      const data = await res.json();
      const out =
        llmProvider === "anthropic"
          ? (data?.content?.[0]?.text ?? "")
          : (data?.choices?.[0]?.message?.content ?? "");
      setLlmOutput(out || "(empty response)");
      toast.success("LLM rewrite generated");
    } catch (e) {
      toast.error(`LLM call failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLlmLoading(false);
    }
  }, [text, llmKey, llmProvider, mode, strength]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="apr-text">Text to rewrite</Label>
            <Button variant="ghost" size="sm" onClick={handleLoadSample}>Load sample</Button>
          </div>
          <Textarea
            id="apr-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your text here…"
            className="min-h-[160px] resize-y text-sm"
          />
          <div>
            <Label className="text-xs">Mode</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {(Object.keys(MODE_LABELS) as ParaphraseMode[]).map((m) => (
                <Button
                  key={m}
                  variant={mode === m ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode(m)}
                >{MODE_LABELS[m]}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Strength: {strength}/5</Label>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={strength}
                onChange={(e) => setStrength(parseInt(e.target.value, 10))}
                className="w-full mt-2"
              />
            </div>
            <div>
              <Label className="text-xs">Voice</Label>
              <div className="flex gap-2 pt-1">
                {(Object.keys(VOICE_LABELS) as VoiceMode[]).map((v) => (
                  <Button
                    key={v}
                    variant={voice === v ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVoice(v)}
                  >{VOICE_LABELS[v]}</Button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Variation: {variation}</Label>
              <div className="flex gap-2 pt-1">
                {[0, 1, 2].map((v) => (
                  <Button
                    key={v}
                    variant={variation === v ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVariation(v)}
                  >V{v + 1}</Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Preserve terms (do-not-substitute, comma-separated)</Label>
              <Input
                value={preserveTermsText}
                onChange={(e) => setPreserveTermsText(e.target.value)}
                placeholder="use, tool, brand-name"
                className="mt-1 text-xs font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleRun} disabled={!text.trim()} className="gap-1.5">
          <Wand2 className="h-4 w-4" /> Rewrite
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDiff((v) => !v)}
          disabled={!result}
          className="gap-1.5"
        >
          <GitCompare className="h-3.5 w-3.5" /> {showDiff ? "Hide" : "Show"} diff
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowLlm((v) => !v)}
          className="gap-1.5"
        >
          <KeyRound className="h-3.5 w-3.5" /> {showLlm ? "Hide" : "Show"} BYO-key LLM
        </Button>
        <ClearButton onClick={handleClear} disabled={!text && !result} />
      </div>

      {showLlm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <KeyRound className="h-4 w-4" /> Optional: bring your own LLM key
            </div>
            <p className="text-xs text-muted-foreground">
              The deterministic rewriter above runs 100% on-device. For LLM-grade rewriting, supply your own API key. The key is stored only in this browser&apos;s localStorage and is sent directly to the provider you choose — never to UnQTools.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value as LlmProvider)}
                className="h-9 text-xs rounded border bg-background px-2"
              >
                <option value="openai">OpenAI (gpt-4o-mini)</option>
                <option value="anthropic">Anthropic (claude-3.5-haiku)</option>
                <option value="openrouter">OpenRouter</option>
              </select>
              <input
                type="password"
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder="sk-… / your API key"
                className="h-9 text-xs rounded border bg-background px-2 font-mono sm:col-span-2"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveKey} variant="outline">Save key locally</Button>
              <Button size="sm" onClick={handleRunLlm} disabled={llmLoading || !llmKey || !text} className="gap-1.5">
                {llmLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                {llmLoading ? "Calling…" : "Run LLM"}
              </Button>
            </div>
            {llmOutput && (
              <div className="rounded border bg-background p-3 text-xs whitespace-pre-wrap max-h-[400px] overflow-auto">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">LLM rewrite</div>
                {llmOutput}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          {result.warnings.length > 0 && (
            <ErrorBanner message={result.warnings.join(" ")} />
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <RefreshCw className="h-4 w-4" /> Stats
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Original words" value={result.stats.originalWordCount} />
                <Stat label="Rewritten words" value={result.stats.rewrittenWordCount} />
                <Stat
                  label="Readability Δ"
                  value={`${result.stats.readabilityDelta > 0 ? "+" : ""}${result.stats.readabilityDelta.toFixed(1)}`}
                />
                <Stat label="Mode" value={MODE_LABELS[result.stats.mode]} />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="outline" className="text-[10px]">Strength: {result.stats.strength}/5</Badge>
                <Badge variant="outline" className="text-[10px]">Voice: {VOICE_LABELS[result.stats.voice]}</Badge>
                <Badge variant="outline" className="text-[10px]">Variation: {result.stats.variation}</Badge>
                <Badge variant="outline" className="text-[10px]">
                  Original readability: {result.stats.originalReadability.toFixed(1)}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Rewritten readability: {result.stats.rewrittenReadability.toFixed(1)}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {showDiff && result && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <GitCompare className="h-4 w-4" /> Diff (word-level)
                </h3>
                <p
                  className="text-xs leading-relaxed"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: diffHtml }}
                />
                <style>{`
                  .diff-insert { background: rgba(34,197,94,0.2); color: rgb(22,163,74); padding: 0 2px; border-radius: 2px; }
                  .diff-delete { background: rgba(239,68,68,0.2); color: rgb(220,38,38); text-decoration: line-through; padding: 0 2px; border-radius: 2px; }
                  .diff-replace { background: rgba(234,179,8,0.2); color: rgb(202,138,4); padding: 0 2px; border-radius: 2px; }
                `}</style>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Wand2 className="h-4 w-4" /> Rewritten
              </h3>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.text}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => result.text} label="Copy rewrite" />
                <DownloadButton
                  getText={() => result.text}
                  filename="rewritten.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => markdown}
                  filename="rewritten.md"
                  mime="text/markdown"
                  label="Download .md"
                />
                <ShareButton getUrl={() => buildShareUrl(text, mode, strength, voice, variation)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold">Per-sentence breakdown</h3>
              <div className="space-y-1">
                {result.sentences.map((sr, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                    <button
                      className="w-full text-left flex items-start gap-2"
                      onClick={() => setExpandedSentence(expandedSentence === i ? null : i)}
                    >
                      {expandedSentence === i
                        ? <ChevronDown className="h-3 w-3 flex-shrink-0 mt-0.5" />
                        : <ChevronRight className="h-3 w-3 flex-shrink-0 mt-0.5" />}
                      <div className="flex-1">
                        <div className="text-muted-foreground line-through">{sr.original}</div>
                        <div className="text-foreground mt-0.5">{sr.rewritten}</div>
                      </div>
                      {sr.changed ? (
                        <Badge variant="default" className="text-[10px]">changed</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">unchanged</Badge>
                      )}
                    </button>
                    {expandedSentence === i && sr.alternatives.length > 0 && (
                      <div className="mt-2 pl-5 space-y-1">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Alternatives</div>
                        {sr.alternatives.map((alt, j) => (
                          <div key={j} className="text-foreground">{j + 1}. {alt}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!result && (
        <EmptyState
          title="Paste text to rewrite"
          hint="Six modes (Standard/Fluent/Formal/Casual/Concise/Expand), strength slider, active↔passive voice change, preserve-terms list, per-sentence alternatives, side-by-side diff, readability delta. Everything runs locally — nothing uploaded."
          icon={<RefreshCw className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="flex flex-wrap gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">{MODE_LABELS[h.mode]}</Badge>
                    <Badge variant="outline" className="text-[10px]">S{h.strength}</Badge>
                    <Badge variant="outline" className="text-[10px]">{VOICE_LABELS[h.voice]}</Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {h.originalWordCount}→{h.rewrittenWordCount} words
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      Δ {h.readabilityDelta > 0 ? "+" : ""}{h.readabilityDelta.toFixed(1)}
                    </Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <p className="text-muted-foreground truncate">{h.preview}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Honesty:
            </strong>{" "}
            This is a deterministic, rule-based rewriter — it will not match LLM fluency. We do NOT claim it beats AI detectors, and we discourage using paraphrasing to disguise plagiarism. Always cite sources and write originally where it matters. Nothing is uploaded.
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
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
