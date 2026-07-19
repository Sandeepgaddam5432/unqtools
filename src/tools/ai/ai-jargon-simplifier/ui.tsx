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
  BookOpenText, History, Eye, FileText, Key, Sparkles,
  Lock, Unlock, RotateCcw, Wand2,
} from "lucide-react";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  DOMAIN_LABELS,
  DOMAIN_COLORS,
  LEVEL_LABELS,
  DEFAULT_OPTIONS,
  SAMPLE_TEXTS,
  JARGON_DICTIONARY,
  simplifyText,
  buildDiff,
  renderDiffHtml,
  renderHighlightedHtml,
  renderPlain,
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
  type Domain,
  type ReadingLevel,
  type SimplifyOptions,
  type HistoryEntry,
} from "./logic";

const LEVEL_ORDER: ReadingLevel[] = ["grade5", "grade8", "grade12", "expert"];
const DOMAIN_ORDER: Domain[] = ["tech", "medical", "legal", "financial"];

export default function AiJargonSimplifier() {
  const [text, setText] = useState("");
  const [options, setOptions] = useState<SimplifyOptions>({ ...DEFAULT_OPTIONS });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [view, setView] = useState<"highlighted" | "diff" | "markdown" | "plain">("highlighted");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmOutput, setLlmOutput] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedText, setDebouncedText] = useState("");

  // Load history + ignore list on mount; parse share URL.
  useEffect(() => {
    setHistory(loadHistory());
    const ignored = loadIgnoreList();
    if (ignored.length > 0) {
      setOptions((prev) => ({ ...prev, ignored }));
    }
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-jargon-simplifier:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.text) {
        setText(p.text);
        setDebouncedText(p.text);
        setOptions((prev) => ({ ...prev, level: p.level, domains: p.domains }));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  // Debounce text input so the engine doesn't run on every keystroke.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedText(text), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text]);

  const result = useMemo(
    () => simplifyText(debouncedText, options),
    [debouncedText, options],
  );

  const diffSegments = useMemo(
    () => buildDiff(result.original, result.simplified),
    [result.original, result.simplified],
  );

  const diffHtml = useMemo(() => renderDiffHtml(diffSegments), [diffSegments]);
  const highlightedHtml = useMemo(() => renderHighlightedHtml(result), [result]);
  const markdown = useMemo(() => renderMarkdown(result), [result]);
  const plain = useMemo(() => renderPlain(result), [result]);

  const toggleDomain = useCallback((d: Domain) => {
    setOptions((prev) => ({
      ...prev,
      domains: prev.domains.includes(d)
        ? prev.domains.filter((x) => x !== d)
        : [...prev.domains, d],
    }));
  }, []);

  const setLevel = useCallback((level: ReadingLevel) => {
    setOptions((prev) => ({ ...prev, level }));
  }, []);

  const toggleLock = useCallback(() => {
    setOptions((prev) => ({ ...prev, lockTokens: !prev.lockTokens }));
  }, []);

  const toggleSplit = useCallback(() => {
    setOptions((prev) => ({ ...prev, splitLongSentences: !prev.splitLongSentences }));
  }, []);

  const handleClear = useCallback(() => {
    setText("");
    setDebouncedText("");
    setLlmOutput("");
    setLlmError("");
    toast.info("Cleared");
  }, []);

  const handleSample = useCallback((sample: { label: string; domain: Domain; text: string }) => {
    setText(sample.text);
    setDebouncedText(sample.text);
    setOptions((prev) => ({ ...prev, domains: [sample.domain] }));
    toast.info(`Loaded sample: ${sample.label}`);
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (result.original.length > 0 && result.stats.jargonCount > 0) {
      saveHistory({
        ts: Date.now(),
        level: options.level,
        domains: options.domains,
        originalLength: result.original.length,
        simplifiedLength: result.simplified.length,
        jargonCount: result.stats.jargonCount,
      });
      setHistory(loadHistory());
    }
  }, [result, options]);

  const handleIgnore = useCallback((term: string) => {
    setOptions((prev) => {
      const next = [...new Set([...prev.ignored, term.toLowerCase()])];
      saveIgnoreList(next);
      return { ...prev, ignored: next };
    });
    toast.success(`Ignoring "${term}"`);
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleResetIgnore = useCallback(() => {
    clearIgnoreList();
    setOptions((prev) => ({ ...prev, ignored: [] }));
    toast.success("Ignore list cleared");
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
      const prompt = buildLlmPrompt(text, options.level);
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
              { role: "system", content: "You are a plain-language editor." },
              { role: "user", content: prompt },
            ],
            max_tokens: 800,
            temperature: 0.4,
          })
        : JSON.stringify({
            model: "claude-3-5-haiku-latest",
            max_tokens: 800,
            system: "You are a plain-language editor.",
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
  }, [llmKey, llmProvider, text, options.level]);

  const stats = result.stats;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ajs-text">Paste jargon-heavy text</Label>
            <Textarea
              id="ajs-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Paste technical, medical, legal, or financial text here…"}
              className="min-h-[120px] resize-y font-mono text-xs"
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
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Reading level</Label>
              <div className="flex flex-wrap gap-1 pt-1">
                {LEVEL_ORDER.map((lv) => (
                  <Button
                    key={lv}
                    size="sm"
                    variant={options.level === lv ? "default" : "outline"}
                    className="h-7 text-[11px]"
                    onClick={() => setLevel(lv)}
                  >{LEVEL_LABELS[lv]}</Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Domain filter (optional — leave empty for all)</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {DOMAIN_ORDER.map((d) => (
                  <label key={d} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.domains.includes(d)}
                      onChange={() => toggleDomain(d)}
                    />
                    {DOMAIN_LABELS[d]}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={options.lockTokens} onChange={toggleLock} />
                {options.lockTokens ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                Lock figures/dates/dosages/citations
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.splitLongSentences}
                  onChange={toggleSplit}
                />
                Split long sentences (&gt;25 words)
              </label>
              {options.ignored.length > 0 && (
                <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={handleResetIgnore}>
                  <RotateCcw className="h-3 w-3 mr-1" /> Reset ignore list ({options.ignored.length})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {result.original.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Eye className="h-4 w-4" /> Statistics
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Jargon found" value={stats.jargonCount} />
                <Stat label="Locked tokens" value={stats.lockedCount} />
                <Stat
                  label="Original ease"
                  value={stats.originalReadability.fleschReadingEase}
                  highlight={stats.originalReadability.fleschReadingEase >= 60 ? "good" : "bad"}
                />
                <Stat
                  label="Simplified ease"
                  value={stats.simplifiedReadability.fleschReadingEase}
                  highlight={stats.simplifiedReadability.fleschReadingEase >= 60 ? "good" : "bad"}
                />
              </div>
              {stats.jargonCount > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {DOMAIN_ORDER.map((d) =>
                    stats.byDomain[d] > 0 ? (
                      <Badge key={d} variant="secondary" className="text-[10px]">
                        {DOMAIN_LABELS[d]}: {stats.byDomain[d]}
                      </Badge>
                    ) : null,
                  )}
                </div>
              )}
              <div className="text-[10px] text-muted-foreground pt-1">
                Improvement: <strong className="text-foreground">{stats.improvement > 0 ? "+" : ""}{stats.improvement}</strong> ease points
                · Original grade {stats.originalReadability.fleschGradeLevel} → Simplified grade {stats.simplifiedReadability.fleschGradeLevel}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <BookOpenText className="h-4 w-4" /> Simplified output
                </h3>
                <div className="flex gap-1">
                  {(["highlighted", "diff", "plain", "markdown"] as const).map((v) => (
                    <Button
                      key={v}
                      size="sm"
                      variant={view === v ? "default" : "outline"}
                      className="h-7 text-[11px] capitalize"
                      onClick={() => setView(v)}
                    >{v}</Button>
                  ))}
                </div>
              </div>
              <div className="rounded border bg-background p-3 text-xs">
                {view === "highlighted" && (
                  <div
                    className="prose prose-sm max-w-none [&_.jargon]:underline [&_.jargon]:decoration-dotted [&_.jargon]:cursor-help [&_.jargon]:text-primary [&_.diff-add]:bg-emerald-100 [&_.diff-add_dark]:text-emerald-900 [&_.diff-remove]:bg-red-100 [&_.diff-remove]:line-through dark:[&_.diff-add]:bg-emerald-900/40 dark:[&_.diff-remove]:bg-red-900/40"
                    dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                  />
                )}
                {view === "diff" && (
                  <div
                    className="prose prose-sm max-w-none [&_.diff-add]:bg-emerald-100 [&_.diff-remove]:bg-red-100 [&_.diff-remove]:line-through dark:[&_.diff-add]:bg-emerald-900/40 dark:[&_.diff-remove]:bg-red-900/40 whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: diffHtml }}
                  />
                )}
                {view === "plain" && (
                  <pre className="whitespace-pre-wrap font-sans text-foreground">{plain}</pre>
                )}
                {view === "markdown" && (
                  <pre className="whitespace-pre-wrap font-mono text-foreground">{markdown}</pre>
                )}
              </div>
              {stats.jargonCount > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Inline glossary (click "Ignore" to drop a term for this session):</div>
                  <div className="space-y-1 max-h-[260px] overflow-auto">
                    {result.hits.map((h) => (
                      <div key={h.id} className="rounded border bg-background px-3 py-1.5 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{DOMAIN_LABELS[h.entry.domain]}</Badge>
                          <span className="font-mono text-muted-foreground line-through">{h.original}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-mono text-foreground">{h.replacement}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 text-[10px] ml-auto"
                            onClick={() => handleIgnore(h.entry.term)}
                          >Ignore</Button>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{h.entry.gloss}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return plain; }}
                  label="Copy simplified"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return plain; }}
                  filename="simplified.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => markdown}
                  filename="simplified.md"
                  mime="text/markdown"
                  label="Download .md"
                />
                <ShareButton
                  getUrl={() => {
                    handleSaveHistory();
                    return buildShareUrl({ text, level: options.level, domains: options.domains });
                  }}
                />
                <ClearButton onClick={handleClear} />
                <Button
                  variant={showLlm ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowLlm((v) => !v)}
                >
                  <Sparkles className="h-3.5 w-3.5" /> {showLlm ? "Hide" : "Enhance with LLM"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste jargon-heavy text to simplify"
          hint="Pick a domain preset to load a sample, or paste your own technical, medical, legal, or financial text. Locked tokens (figures, dates, dosages, citations) are preserved exactly."
          icon={<BookOpenText className="h-8 w-8" />}
        />
      )}

      {showLlm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Key className="h-4 w-4" /> Bring your own LLM key (optional)
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Your key is stored only in this browser's localStorage. Requests go directly to the provider you choose — never through our servers.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Provider</Label>
                <select
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                  className="mt-1 h-9 w-full rounded border bg-background px-2 text-xs"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">API key</Label>
                <Input
                  type="password"
                  value={llmKey}
                  onChange={(e) => {
                    setLlmKey(e.target.value);
                    if (typeof localStorage !== "undefined") {
                      localStorage.setItem("unqtools:ai-jargon-simplifier:llm-key", e.target.value);
                    }
                  }}
                  placeholder="sk-…"
                  className="mt-1 text-xs font-mono"
                />
              </div>
            </div>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleEnhanceWithLlm}
              disabled={llmLoading}
            >
              {llmLoading ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              {llmLoading ? "Working…" : "Enhance with LLM"}
            </Button>
            {llmError && <ErrorBanner message={llmError} />}
            {llmOutput && (
              <div className="rounded border bg-background p-3 text-xs whitespace-pre-wrap">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">LLM output</div>
                {llmOutput}
              </div>
            )}
          </CardContent>
        </Card>
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
                  <Badge variant="outline" className="mr-2">{LEVEL_LABELS[h.level].split(" ")[0]}</Badge>
                  <Badge variant="outline" className="mr-2">{h.jargonCount} jargon</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All simplification, glossary matching, and readability scoring run locally. Text never leaves this device. The only network call is if you paste your own LLM API key and click "Enhance with LLM" — that request goes directly to the LLM provider you choose.
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            <strong className="text-foreground">Honesty:</strong> Algorithmic simplification can subtly shift meaning — never use this for medical, legal, or financial decisions without expert review.
            Dictionary: <strong className="text-foreground">{JARGON_DICTIONARY.length}</strong> terms · History max: <strong className="text-foreground">{HISTORY_MAX}</strong>.
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
