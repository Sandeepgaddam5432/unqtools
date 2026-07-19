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
  Tags, History, Key, Sparkles, Wand2, Hash, ListOrdered, Cloud,
} from "lucide-react";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  ALGORITHM_LABELS,
  LANGUAGE_LABELS,
  DEFAULT_OPTIONS,
  SAMPLE_TEXTS,
  extract,
  renderCommaList,
  renderLineList,
  renderCsv,
  renderJson,
  renderMarkdown,
  renderTagCloudHtml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Algorithm,
  type Language,
  type ExtractOptions,
  type HistoryEntry,
} from "./logic";

const ALGORITHM_ORDER: Algorithm[] = ["tfidf", "rake", "yake"];
const LANGUAGE_ORDER: Language[] = ["en", "es", "fr", "de", "pt"];
const NGRAM_OPTIONS: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];
const TOPN_OPTIONS: number[] = [5, 10, 15, 20, 50];

export default function AiKeywordExtractor() {
  const [text, setText] = useState("");
  const [options, setOptions] = useState<ExtractOptions>({ ...DEFAULT_OPTIONS });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [view, setView] = useState<"table" | "cloud" | "markdown" | "json">("table");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmOutput, setLlmOutput] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedText, setDebouncedText] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-keyword-extractor:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.text) {
        setText(p.text);
        setDebouncedText(p.text);
        setOptions((prev) => ({
          ...prev,
          algorithm: p.algorithm,
          language: p.language,
          ngram: p.ngram,
          topN: p.topN,
        }));
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
    () => extract(debouncedText, options),
    [debouncedText, options],
  );

  const commaList = useMemo(() => renderCommaList(result.keywords), [result.keywords]);
  const lineList = useMemo(() => renderLineList(result.keywords), [result.keywords]);
  const csv = useMemo(
    () => renderCsv(result.keywords),
    [result.keywords],
  );
  const json = useMemo(
    () => renderJson(result.keywords, result.stats, result.clusters),
    [result.keywords, result.stats, result.clusters],
  );
  const markdown = useMemo(
    () => renderMarkdown(result.keywords, result.stats, result.clusters),
    [result.keywords, result.stats, result.clusters],
  );
  const cloudHtml = useMemo(
    () => renderTagCloudHtml(result.keywords),
    [result.keywords],
  );

  const setAlgo = useCallback((algorithm: Algorithm) => {
    setOptions((prev) => ({ ...prev, algorithm }));
  }, []);
  const setLang = useCallback((language: Language) => {
    setOptions((prev) => ({ ...prev, language }));
  }, []);
  const setNgram = useCallback((ngram: 1 | 2 | 3 | 4) => {
    setOptions((prev) => ({ ...prev, ngram }));
  }, []);
  const setTopN = useCallback((topN: number) => {
    setOptions((prev) => ({ ...prev, topN }));
  }, []);
  const toggleCluster = useCallback(() => {
    setOptions((prev) => ({ ...prev, clusterTopics: !prev.clusterTopics }));
  }, []);
  const toggleNumbers = useCallback(() => {
    setOptions((prev) => ({ ...prev, includeNumbers: !prev.includeNumbers }));
  }, []);

  const handleClear = useCallback(() => {
    setText("");
    setDebouncedText("");
    setLlmOutput([]);
    setLlmError("");
    toast.info("Cleared");
  }, []);

  const handleSample = useCallback((sample: { label: string; language: Language; text: string }) => {
    setText(sample.text);
    setDebouncedText(sample.text);
    setOptions((prev) => ({ ...prev, language: sample.language }));
    toast.info(`Loaded sample: ${sample.label}`);
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (result.keywords.length > 0 && debouncedText.length > 0) {
      saveHistory({
        ts: Date.now(),
        algorithm: options.algorithm,
        language: options.language,
        topN: options.topN,
        textLength: debouncedText.length,
        keywordCount: result.keywords.length,
        topKeyword: result.keywords[0]?.text ?? "",
      });
      setHistory(loadHistory());
    }
  }, [result.keywords, options, debouncedText]);

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
      setLlmError("Enter some text to extract keywords from.");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    setLlmOutput([]);
    try {
      const prompt = buildLlmPrompt(text, options.algorithm, options.topN);
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
              { role: "system", content: "You are a keyword extraction assistant. Return one keyword per line, no numbering, no extra text." },
              { role: "user", content: prompt },
            ],
            max_tokens: 400,
            temperature: 0.2,
          })
        : JSON.stringify({
            model: "claude-3-5-haiku-latest",
            max_tokens: 400,
            system: "You are a keyword extraction assistant. Return one keyword per line, no numbering, no extra text.",
            messages: [{ role: "user", content: prompt }],
          });
      const res = await fetch(endpoint, { method: "POST", headers, body });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      const json2 = await res.json();
      const out = llmProvider === "openai"
        ? json2.choices?.[0]?.message?.content ?? ""
        : json2.content?.[0]?.text ?? "";
      setLlmOutput(renderLlmResult(out));
      toast.success("LLM extraction complete");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setLlmError(msg);
      toast.error("LLM extraction failed");
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, text, options.algorithm, options.topN]);

  const stats = result.stats;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="akx-text">Paste text to extract keywords from</Label>
            <Textarea
              id="akx-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Paste an article, product description, or any text…"}
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
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Algorithm</Label>
              <div className="flex flex-wrap gap-1 pt-1">
                {ALGORITHM_ORDER.map((a) => (
                  <Button
                    key={a}
                    size="sm"
                    variant={options.algorithm === a ? "default" : "outline"}
                    className="h-7 text-[11px]"
                    onClick={() => setAlgo(a)}
                  >{ALGORITHM_LABELS[a]}</Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Language (stopword pack)</Label>
              <select
                value={options.language}
                onChange={(e) => setLang(e.target.value as Language)}
                className="mt-1 h-8 text-xs rounded border bg-background px-2"
              >
                {LANGUAGE_ORDER.map((l) => (
                  <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">N-gram (TF-IDF only)</Label>
                <div className="flex flex-wrap gap-1 pt-1">
                  {NGRAM_OPTIONS.map((n) => (
                    <Button
                      key={n}
                      size="sm"
                      variant={options.ngram === n ? "default" : "outline"}
                      className="h-7 text-[11px] w-9"
                      onClick={() => setNgram(n)}
                      disabled={options.algorithm !== "tfidf"}
                    >{n}</Button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Top N</Label>
                <div className="flex flex-wrap gap-1 pt-1">
                  {TOPN_OPTIONS.map((n) => (
                    <Button
                      key={n}
                      size="sm"
                      variant={options.topN === n ? "default" : "outline"}
                      className="h-7 text-[11px] w-12"
                      onClick={() => setTopN(n)}
                    >{n}</Button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.clusterTopics}
                  onChange={toggleCluster}
                />
                Topic clustering (co-occurrence)
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.includeNumbers}
                  onChange={toggleNumbers}
                />
                Include pure numbers
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {debouncedText.trim().length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Hash className="h-4 w-4" /> Statistics
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total words" value={stats.totalWords} />
                <Stat label="Unique words" value={stats.uniqueWords} />
                <Stat label="Sentences" value={stats.totalSentences} />
                <Stat label="Keywords found" value={result.keywords.length} />
                <Stat
                  label="Top-N share"
                  value={`${(stats.topShare * 100).toFixed(1)}%`}
                />
                <Stat label="Algorithm" value={ALGORITHM_LABELS[stats.algorithm]} />
                <Stat label="Language" value={LANGUAGE_LABELS[stats.language]} />
                <Stat label="N-gram" value={options.ngram} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Tags className="h-4 w-4" /> Top {result.keywords.length} keywords
                </h3>
                <div className="flex gap-1">
                  {(["table", "cloud", "markdown", "json"] as const).map((v) => (
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
              {view === "table" && (
                <div className="space-y-1 max-h-[420px] overflow-auto">
                  {result.keywords.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic">No keywords found — try a longer text or a different algorithm.</div>
                  ) : result.keywords.map((k, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                      <span className="text-muted-foreground w-6 text-right">{i + 1}.</span>
                      <span className="font-mono text-foreground flex-1 truncate">{k.text}</span>
                      <Badge variant="outline" className="text-[10px]">{k.ngram}-gram</Badge>
                      {k.capitalized && (
                        <Badge variant="secondary" className="text-[10px]">Cap</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">{k.frequency}×</Badge>
                      <div className="w-20 h-2 rounded bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${Math.min(100, Math.max(4, k.density * 100 * 10))}%` }}
                          title={`density: ${(k.density * 100).toFixed(2)}%`}
                        />
                      </div>
                      <span className="text-muted-foreground text-[10px] w-12 text-right">{k.score.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              )}
              {view === "cloud" && (
                <div
                  className="rounded border bg-background p-4 text-xs leading-loose [&_.tag]:inline-block [&_.tag]:mx-1 [&_.tag]:my-0.5 [&_.tag]:text-foreground"
                  dangerouslySetInnerHTML={{ __html: cloudHtml || "<em class='text-muted-foreground'>No keywords found.</em>" }}
                />
              )}
              {view === "markdown" && (
                <pre className="rounded border bg-background p-3 text-xs font-mono whitespace-pre-wrap text-foreground max-h-[420px] overflow-auto">{markdown}</pre>
              )}
              {view === "json" && (
                <pre className="rounded border bg-background p-3 text-xs font-mono whitespace-pre-wrap text-foreground max-h-[420px] overflow-auto">{json}</pre>
              )}
              {options.clusterTopics && result.clusters.length > 0 && (
                <div className="space-y-1 pt-2">
                  <div className="text-xs text-muted-foreground">Topic clusters (co-occurrence):</div>
                  {result.clusters.map((c) => (
                    <div key={c.id} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <Badge variant="outline" className="mr-2 text-[10px]">{c.members.length}</Badge>
                      <span className="font-mono text-foreground">{c.members.join(", ")}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return commaList; }}
                  label="Copy comma list"
                />
                <CopyButton
                  getText={() => lineList}
                  label="Copy line list"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return csv; }}
                  filename="keywords.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <DownloadButton
                  getText={() => json}
                  filename="keywords.json"
                  mime="application/json"
                  label="Download JSON"
                />
                <DownloadButton
                  getText={() => markdown}
                  filename="keywords.md"
                  mime="text/markdown"
                  label="Download .md"
                />
                <ShareButton
                  getUrl={() => {
                    handleSaveHistory();
                    return buildShareUrl({
                      text,
                      algorithm: options.algorithm,
                      language: options.language,
                      ngram: options.ngram,
                      topN: options.topN,
                    });
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
          title="Paste text to extract keywords"
          hint="Choose an algorithm (TF-IDF / RAKE / YAKE), pick a language stopword pack, and set the n-gram and top-N. Results render as a ranked table, tag cloud, Markdown, or JSON."
          icon={<Tags className="h-8 w-8" />}
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
                      localStorage.setItem("unqtools:ai-keyword-extractor:llm-key", e.target.value);
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
              {llmLoading ? "Working…" : "Extract with LLM"}
            </Button>
            {llmError && <ErrorBanner message={llmError} />}
            {llmOutput.length > 0 && (
              <div className="rounded border bg-background p-3 text-xs">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">LLM keywords ({llmOutput.length})</div>
                <ol className="list-decimal ml-4 space-y-0.5">
                  {llmOutput.map((k, i) => (
                    <li key={i} className="font-mono">{k}</li>
                  ))}
                </ol>
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
                  <Badge variant="outline" className="mr-2">{ALGORITHM_LABELS[h.algorithm]}</Badge>
                  <Badge variant="outline" className="mr-2">{LANGUAGE_LABELS[h.language]}</Badge>
                  <Badge variant="outline" className="mr-2">top {h.topN}</Badge>
                  <span className="text-muted-foreground ml-1">→ {h.topKeyword}</span>
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
            <strong className="text-foreground">Privacy:</strong> All keyword extraction, scoring, and clustering run locally. Text never leaves this device. The only network call is if you paste your own LLM API key and click "Enhance with LLM" — that request goes directly to the LLM provider you choose.
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            <strong className="text-foreground">Honesty:</strong> Algorithmic extraction is deterministic — same input always produces the same output. Recall drops on very short text. Stopword packs cover English, Spanish, French, German, and Portuguese. History max: <strong className="text-foreground">{HISTORY_MAX}</strong>.
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
