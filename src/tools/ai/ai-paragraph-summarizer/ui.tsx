"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  summarize,
  renderMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  countWords,
  countSentences,
  buildLlmPrompt,
  type SummaryLength,
  type OutputFormat,
  type SummaryResult,
  type HistoryEntry,
} from "./logic";
import {
  FileText, List, History, KeyRound, Loader2, AlertTriangle, Tag,
} from "lucide-react";

const SAMPLE_TEXT = `Climate change is one of the most pressing challenges of our time. Rising global temperatures are melting polar ice caps and raising sea levels. Coastal communities face increasing flood risks during storms and high tides.

Scientists agree that human activity is the primary driver. Burning fossil fuels releases greenhouse gases that trap heat in the atmosphere. Deforestation reduces the planet's capacity to absorb carbon dioxide. Industrial agriculture contributes methane and nitrous oxide emissions.

The consequences are far-reaching. Droughts last longer and intensify in many regions. Wildfires burn larger areas and destroy habitats. Ocean acidification threatens coral reefs and marine food chains. Extreme weather events cause billions in damages every year.

Solutions exist but require coordinated action. Renewable energy sources like solar and wind are now cheaper than coal in most markets. Electric vehicles are replacing combustion engines. Energy-efficient buildings reduce consumption. Reforestation projects absorb carbon while restoring ecosystems.

Individuals can also make a difference. Reducing meat consumption lowers personal emissions. Choosing public transit or cycling cuts fossil fuel use. Supporting climate-conscious companies sends market signals. Voting for leaders who prioritize climate policy matters most.`;

type LlmProvider = "openai" | "anthropic" | "openrouter";

export default function AiParagraphSummarizer() {
  const [text, setText] = useState("");
  const [length, setLength] = useState<SummaryLength>("medium");
  const [format, setFormat] = useState<OutputFormat>("paragraph");
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showLlm, setShowLlm] = useState(false);
  const [llmProvider, setLlmProvider] = useState<LlmProvider>("openai");
  const [llmKey, setLlmKey] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmOutput, setLlmOutput] = useState<string>("");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.text) {
        setText(p.text);
        setLength(p.length);
        setFormat(p.format);
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

  const wordCount = useMemo(() => countWords(text), [text]);
  const sentenceCount = useMemo(() => countSentences(text), [text]);

  const markdown = useMemo(
    () => (result ? renderMarkdown(result) : ""),
    [result],
  );

  const handleRun = useCallback(() => {
    if (!text.trim()) {
      toast.error("Paste some text first");
      return;
    }
    const r = summarize(text, { length, format });
    setResult(r);
    saveHistory({
      ts: Date.now(),
      length,
      format,
      originalWordCount: r.stats.originalWordCount,
      summaryWordCount: r.stats.summaryWordCount,
      compressionRatio: r.stats.compressionRatio,
      preview: r.summary.slice(0, 100),
    });
    setHistory(loadHistory());
    setLlmOutput("");
    toast.success(
      `Summary: ${r.stats.summaryWordCount} words (${(r.stats.compressionRatio * 100).toFixed(0)}%)`,
    );
  }, [text, length, format]);

  const handleClear = useCallback(() => {
    setText("");
    setResult(null);
    setLlmOutput("");
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
      const prompt = buildLlmPrompt(text, length, format);
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
          max_tokens: 600,
          system: prompt.system,
          messages: [{ role: "user", content: prompt.user }],
        });
      } else {
        headers["Authorization"] = `Bearer ${llmKey}`;
        body = JSON.stringify({
          model: llmProvider === "openai" ? "gpt-4o-mini" : "anthropic/claude-3.5-haiku",
          max_tokens: 600,
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
      toast.success("LLM summary generated");
    } catch (e) {
      toast.error(`LLM call failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLlmLoading(false);
    }
  }, [text, llmKey, llmProvider, length, format]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="aps-text">Text to summarize</Label>
            <Button variant="ghost" size="sm" onClick={handleLoadSample}>Load sample</Button>
          </div>
          <Textarea
            id="aps-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste an article, report, notes, or transcript here…"
            className="min-h-[180px] resize-y text-sm"
          />
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <Badge variant="outline">{wordCount} words</Badge>
            <Badge variant="outline">{sentenceCount} sentences</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <Label className="text-xs">Length</Label>
              <div className="flex gap-2 pt-1">
                {(["short", "medium", "long"] as SummaryLength[]).map((l) => (
                  <Button
                    key={l}
                    variant={length === l ? "default" : "outline"}
                    size="sm"
                    className="capitalize"
                    onClick={() => setLength(l)}
                  >{l}</Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Output format</Label>
              <div className="flex gap-2 pt-1">
                <Button
                  variant={format === "paragraph" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormat("paragraph")}
                  className="gap-1.5"
                ><FileText className="h-3.5 w-3.5" /> Paragraph</Button>
                <Button
                  variant={format === "bullets" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormat("bullets")}
                  className="gap-1.5"
                ><List className="h-3.5 w-3.5" /> Bullets</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleRun} disabled={!text.trim()} className="gap-1.5">
          <FileText className="h-4 w-4" /> Summarize
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
              Extractive summarization runs 100% on-device. For abstractive (rewritten) summaries, supply your own API key. The key is stored only in this browser&apos;s localStorage and is sent directly to the provider you choose — never to UnQTools.
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
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">LLM abstractive summary</div>
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
                <FileText className="h-4 w-4" /> Stats
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Original words" value={result.stats.originalWordCount} />
                <Stat label="Summary words" value={result.stats.summaryWordCount} />
                <Stat
                  label="Compression"
                  value={`${(result.stats.compressionRatio * 100).toFixed(0)}%`}
                />
                <Stat
                  label="Sentences"
                  value={`${result.stats.summarySentenceCount}/${result.stats.originalSentenceCount}`}
                />
              </div>
              {result.keywords.length > 0 && (
                <div className="pt-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Keywords
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {result.keywords.map((k) => (
                      <Badge key={k} variant="secondary" className="text-[10px] font-mono">{k}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {result.keyPoints.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <List className="h-4 w-4" /> Key points
                </h3>
                <ul className="space-y-1 text-xs">
                  {result.keyPoints.map((kp, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span>{kp.text}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Summary ({result.stats.length}, {result.stats.format})
              </h3>
              {result.stats.format === "bullets" ? (
                <ul className="space-y-1 text-sm">
                  {result.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span>{b.replace(/^- /, "")}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm leading-relaxed">{result.summary}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => result.stats.format === "bullets" ? result.bullets.join("\n") : result.summary} label="Copy summary" />
                <DownloadButton
                  getText={() => result.summary}
                  filename="summary.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => markdown}
                  filename="summary.md"
                  mime="text/markdown"
                  label="Download .md"
                />
                <ShareButton getUrl={() => buildShareUrl(text, length, format)} />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!result && (
        <EmptyState
          title="Paste text to summarize"
          hint="Adjustable length (short/medium/long), paragraph or bullet output, multi-paragraph support, key-points extraction, compression-ratio readout. Everything runs locally — nothing uploaded."
          icon={<FileText className="h-8 w-8" />}
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
                    <Badge variant="outline" className="text-[10px]">{h.length}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.format}</Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {(h.compressionRatio * 100).toFixed(0)}% ({h.summaryWordCount}/{h.originalWordCount})
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
            Extractive summarization keeps source sentences verbatim — it does not rephrase or invent. Always verify the summary against the source before quoting. Nothing is uploaded.
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
