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
  Smile, History, Key, Sparkles, FileText, Upload, BarChart3,
} from "lucide-react";
import {
  HISTORY_MAX,
  DEFAULT_THRESHOLD,
  SENTIMENT_LABELS,
  SENTIMENT_COLORS,
  EMOTION_LABELS,
  EMOTION_EMOJIS,
  LEXICON,
  analyzeDocument,
  parseCsv,
  analyzeCsv,
  summarizeCsv,
  renderDocumentCsv,
  renderDocumentJson,
  renderHighlightedHtml,
  renderCsvResultsCsv,
  renderCsvResultsJson,
  buildLlmPrompt,
  renderLlmResult,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Sentiment,
  type Emotion,
  type DocumentResult,
  type CsvRow,
  type CsvSummary,
  type HistoryEntry,
} from "./logic";

const EMOTION_ORDER: Emotion[] = [
  "joy", "trust", "anticipation", "surprise", "anger", "sadness", "fear", "disgust",
];

export default function AiSentimentAnalysisTool() {
  const [text, setText] = useState("");
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [csvText, setCsvText] = useState("");
  const [csvCol, setCsvCol] = useState(0);
  const [csvMode, setCsvMode] = useState(false);
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
      ? localStorage.getItem("unqtools:ai-sentiment-analysis-tool:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.text) {
        setText(p.text);
        setDebouncedText(p.text);
        setThreshold(p.threshold);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedText(text), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text]);

  const doc: DocumentResult | null = useMemo(() => {
    if (!debouncedText.trim()) return null;
    return analyzeDocument(debouncedText, threshold);
  }, [debouncedText, threshold]);

  const highlightedHtml = useMemo(() => doc ? renderHighlightedHtml(doc) : "", [doc]);
  const docCsv = useMemo(() => doc ? renderDocumentCsv(doc) : "", [doc]);
  const docJson = useMemo(() => doc ? renderDocumentJson(doc) : "", [doc]);

  const csvRows: CsvRow[] = useMemo(() => {
    if (!csvText.trim() || csvCol < 0) return [];
    return analyzeCsv(csvText, csvCol, threshold);
  }, [csvText, csvCol, threshold]);

  const csvSummary: CsvSummary | null = useMemo(() => {
    if (csvRows.length === 0) return null;
    return summarizeCsv(csvRows);
  }, [csvRows]);

  const csvResultsCsv = useMemo(() => renderCsvResultsCsv(csvRows), [csvRows]);
  const csvResultsJson = useMemo(() => renderCsvResultsJson(csvRows), [csvRows]);

  const csvHeaders = useMemo(() => {
    if (!csvText.trim()) return [];
    const rows = parseCsv(csvText);
    return rows.length > 0 ? rows[0] : [];
  }, [csvText]);

  const handleClear = useCallback(() => {
    setText("");
    setDebouncedText("");
    setCsvText("");
    setLlmOutput("");
    setLlmError("");
    toast.info("Cleared");
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (!doc) return;
    const topEmotion = doc.emotionProfile.find((e) => e.count > 0)?.emotion ?? null;
    saveHistory({
      ts: Date.now(),
      textLength: doc.text.length,
      score: doc.score,
      sentiment: doc.sentiment,
      sentenceCount: doc.stats.sentenceCount,
      emotionTop: topEmotion,
    });
    setHistory(loadHistory());
  }, [doc]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    try {
      const txt = await file.text();
      setCsvText(txt);
      const rows = parseCsv(txt);
      if (rows.length > 0) {
        // Auto-pick the longest text column (likely the review column).
        let bestCol = 0;
        let bestLen = 0;
        for (let c = 0; c < rows[0].length; c++) {
          const sample = rows.slice(1, 6).map((r) => r[c] ?? "").join(" ");
          if (sample.length > bestLen) { bestLen = sample.length; bestCol = c; }
        }
        setCsvCol(bestCol);
      }
      setCsvMode(true);
      toast.success(`Loaded ${file.name} (${rows.length} rows)`);
    } catch {
      toast.error("Could not read file");
    }
  }, []);

  const handleEnhanceWithLlm = useCallback(async () => {
    if (!llmKey) { setLlmError("Enter an API key first."); return; }
    if (!doc) { setLlmError("Enter text to analyze first."); return; }
    setLlmLoading(true);
    setLlmError("");
    setLlmOutput("");
    try {
      const prompt = buildLlmPrompt(debouncedText, doc);
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
            { role: "system", content: "You are a sentiment-analysis assistant." },
            { role: "user", content: prompt },
          ],
          max_tokens: 600,
          temperature: 0.3,
        })
        : JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 600,
          system: "You are a sentiment-analysis assistant.",
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
  }, [llmKey, llmProvider, doc, debouncedText]);

  const handleSaveLlmKey = useCallback((v: string) => {
    setLlmKey(v);
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("unqtools:ai-sentiment-analysis-tool:llm-key", v);
      } catch {
        // ignore
      }
    }
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={!csvMode ? "default" : "outline"}
              onClick={() => setCsvMode(false)}
              className="gap-1.5"
            >
              <FileText className="h-3.5 w-3.5" /> Single text
            </Button>
            <Button
              size="sm"
              variant={csvMode ? "default" : "outline"}
              onClick={() => setCsvMode(true)}
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" /> Bulk CSV
            </Button>
          </div>

          {!csvMode ? (
            <div className="space-y-1.5">
              <Label htmlFor="sat-text">Paste text to analyze (review, tweet, feedback, email)</Label>
              <Textarea
                id="sat-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={"This product is amazing! The battery life is great but the screen is a bit disappointing."}
                className="min-h-[140px] resize-y font-mono text-xs"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="sat-csv-upload" className="text-xs">Upload CSV file</Label>
                  <input
                    id="sat-csv-upload"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f);
                    }}
                    className="block w-full text-xs file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary file:text-primary-foreground file:text-xs"
                  />
                </div>
                {csvHeaders.length > 0 && (
                  <div>
                    <Label htmlFor="sat-csv-col" className="text-xs">Text column</Label>
                    <select
                      id="sat-csv-col"
                      value={csvCol}
                      onChange={(e) => setCsvCol(Number(e.target.value))}
                      className="h-8 text-xs rounded border bg-background px-2"
                    >
                      {csvHeaders.map((h, i) => (
                        <option key={i} value={i}>{i}: {h || `(col ${i})`}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sat-csv-text" className="text-xs">Or paste CSV text</Label>
                <Textarea
                  id="sat-csv-text"
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={"id,text\n1,This product is amazing!\n2,Terrible experience."}
                  className="min-h-[100px] resize-y font-mono text-xs"
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="sat-threshold" className="text-xs">
              Threshold: {threshold.toFixed(2)}
            </Label>
            <input
              id="sat-threshold"
              type="range"
              min={0.05}
              max={0.5}
              step={0.05}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="h-2 flex-1 min-w-[150px]"
            />
            <span className="text-[11px] text-muted-foreground">
              |score| ≥ {threshold.toFixed(2)} → positive/negative
            </span>
          </div>

          {!csvMode && (
            <div className="flex flex-wrap gap-2">
              <CopyButton
                getText={() => { handleSaveHistory(); return doc ? doc.sentiment : ""; }}
                label="Copy label"
              />
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(text, threshold); }} />
              <ClearButton onClick={handleClear} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Single-text analysis */}
      {!csvMode && doc ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Smile className="h-4 w-4" /> Document sentiment
                </h3>
                <Badge variant="outline" className="text-[10px]">
                  Confidence: {doc.confidence}
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat
                  label="Sentiment"
                  value={SENTIMENT_LABELS[doc.sentiment]}
                  highlight={doc.sentiment === "positive" ? "good" : doc.sentiment === "negative" ? "bad" : "warn"}
                />
                <Stat label="Score (-1 to +1)" value={doc.score.toFixed(3)} />
                <Stat label="Sentences" value={doc.stats.sentenceCount} />
                <Stat label="Lexicon hits" value={doc.stats.lexiconHits} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat label="Positive" value={doc.positiveCount} highlight="good" />
                <Stat label="Negative" value={doc.negativeCount} highlight="bad" />
                <Stat label="Neutral" value={doc.neutralCount} highlight="warn" />
              </div>
              <div className="w-full h-3 rounded-full bg-muted overflow-hidden flex">
                <div className="h-full bg-red-500" style={{ width: `${(doc.negativeCount / Math.max(1, doc.sentences.length)) * 100}%` }} />
                <div className="h-full bg-amber-500" style={{ width: `${(doc.neutralCount / Math.max(1, doc.sentences.length)) * 100}%` }} />
                <div className="h-full bg-emerald-500" style={{ width: `${(doc.positiveCount / Math.max(1, doc.sentences.length)) * 100}%` }} />
              </div>
            </CardContent>
          </Card>

          {/* Highlighted view */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Highlighted text</h3>
              <div
                className="prose prose-sm max-w-none rounded border bg-background p-3 text-xs leading-relaxed"
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
              <style>{`
                .sa-hit { padding: 0 2px; border-radius: 3px; cursor: help; }
                .sa-pos { background: rgba(16, 185, 129, 0.25); }
                .sa-neg { background: rgba(239, 68, 68, 0.25); }
              `}</style>
            </CardContent>
          </Card>

          {/* Emotion profile */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Emotion profile</h3>
              {doc.emotionProfile.filter((e) => e.count > 0).length === 0 ? (
                <p className="text-xs text-muted-foreground">No emotions detected.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {doc.emotionProfile.filter((e) => e.count > 0).map((e) => (
                    <div key={e.emotion} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <span className="mr-1">{EMOTION_EMOJIS[e.emotion]}</span>
                      <span className="font-medium">{EMOTION_LABELS[e.emotion]}</span>
                      <Badge variant="outline" className="ml-2 text-[10px]">{e.count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Aspects */}
          {doc.aspects.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Aspect-based sentiment</h3>
                <div className="space-y-1">
                  {doc.aspects.map((a) => (
                    <div key={a.aspect} className="rounded border bg-background px-3 py-1.5 text-xs flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{a.aspect}</Badge>
                      <span className={`font-medium ${SENTIMENT_COLORS[a.sentiment]}`}>{SENTIMENT_LABELS[a.sentiment]}</span>
                      <span className="text-muted-foreground text-[10px]">({a.score.toFixed(2)})</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sentence breakdown */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Sentence breakdown ({doc.sentences.length})</h3>
              <div className="space-y-1 max-h-[400px] overflow-auto">
                {doc.sentences.map((s, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">{i + 1}</Badge>
                      <span className={`font-medium ${SENTIMENT_COLORS[s.sentiment]}`}>{SENTIMENT_LABELS[s.sentiment]}</span>
                      <span className="text-muted-foreground text-[10px]">{s.score.toFixed(2)} · conf: {s.confidence}</span>
                    </div>
                    <p className="text-foreground">{s.text}</p>
                    {(s.positiveWords.length > 0 || s.negativeWords.length > 0) && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {s.positiveWords.map((w, j) => (
                          <Badge key={`p${j}`} variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400">+ {w}</Badge>
                        ))}
                        {s.negativeWords.map((w, j) => (
                          <Badge key={`n${j}`} variant="outline" className="text-[10px] text-red-600 dark:text-red-400">- {w}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <DownloadButton
                  getText={() => { handleSaveHistory(); return docCsv; }}
                  filename="sentiment-analysis.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return docJson; }}
                  filename="sentiment-analysis.json"
                  mime="application/json"
                  label="Download JSON"
                />
              </div>
            </CardContent>
          </Card>

          {/* Optional BYO-key LLM */}
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
                    The on-device lexicon engine above is the default. Optionally paste your own LLM API
                    key for sarcasm, mixed sentiment, and slang handling — your text is sent directly from
                    your browser to the provider you choose, never to UnQTools.
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
                      disabled={llmLoading || !llmKey || !doc}
                      className="gap-1.5"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {llmLoading ? "Working…" : "Enhance"}
                    </Button>
                  </div>
                  {llmError && <ErrorBanner message={llmError} />}
                  {llmOutput && (
                    <pre className="whitespace-pre-wrap rounded border bg-background p-3 text-xs max-h-[300px] overflow-auto">
                      {llmOutput}
                    </pre>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {!csvMode && !doc && (
        <EmptyState
          title="Paste text to analyze sentiment"
          hint="Get a positive / negative / neutral label, a -1 to +1 score, per-sentence breakdowns, emotion detection, and aspect-based sentiment — all locally. Try a review or tweet."
          icon={<Smile className="h-8 w-8" />}
        />
      )}

      {/* CSV analysis */}
      {csvMode && csvText.trim() && (
        <>
          {csvSummary && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4" /> CSV summary ({csvSummary.totalRows} rows)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Mean score" value={csvSummary.meanScore.toFixed(3)} />
                  <Stat label="Positive" value={csvSummary.positive} highlight="good" />
                  <Stat label="Negative" value={csvSummary.negative} highlight="bad" />
                  <Stat label="Neutral" value={csvSummary.neutral} highlight="warn" />
                </div>
                <div className="w-full h-3 rounded-full bg-muted overflow-hidden flex">
                  <div className="h-full bg-red-500" style={{ width: `${(csvSummary.negative / Math.max(1, csvSummary.totalRows)) * 100}%` }} />
                  <div className="h-full bg-amber-500" style={{ width: `${(csvSummary.neutral / Math.max(1, csvSummary.totalRows)) * 100}%` }} />
                  <div className="h-full bg-emerald-500" style={{ width: `${(csvSummary.positive / Math.max(1, csvSummary.totalRows)) * 100}%` }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Top positive</div>
                    <div className="space-y-1">
                      {csvSummary.topPositive.slice(0, 3).map((r, i) => (
                        <div key={i} className="rounded border bg-background px-2 py-1 text-[11px]">
                          <Badge variant="outline" className="text-[9px] mr-1 text-emerald-600 dark:text-emerald-400">+{r.score.toFixed(2)}</Badge>
                          <span className="text-foreground">{r.text.slice(0, 80)}{r.text.length > 80 ? "…" : ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Top negative</div>
                    <div className="space-y-1">
                      {csvSummary.topNegative.slice(0, 3).map((r, i) => (
                        <div key={i} className="rounded border bg-background px-2 py-1 text-[11px]">
                          <Badge variant="outline" className="text-[9px] mr-1 text-red-600 dark:text-red-400">{r.score.toFixed(2)}</Badge>
                          <span className="text-foreground">{r.text.slice(0, 80)}{r.text.length > 80 ? "…" : ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <DownloadButton
                    getText={() => csvResultsCsv}
                    filename="sentiment-results.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                  <DownloadButton
                    getText={() => csvResultsJson}
                    filename="sentiment-results.json"
                    mime="application/json"
                    label="Download JSON"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {csvRows.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Per-row results ({csvRows.length})</h3>
                <div className="space-y-1 max-h-[500px] overflow-auto">
                  {csvRows.map((r, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex items-start gap-2">
                      <Badge variant="outline" className="text-[10px]">{r.rowIndex}</Badge>
                      <span className={`font-medium ${SENTIMENT_COLORS[r.sentiment]}`}>{SENTIMENT_LABELS[r.sentiment]}</span>
                      <span className="text-muted-foreground text-[10px]">{r.score.toFixed(2)}</span>
                      <span className="flex-1 text-foreground truncate">{r.text}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {csvMode && !csvText.trim() && (
        <EmptyState
          title="Upload a CSV or paste CSV text for bulk sentiment analysis"
          hint="Pick a CSV file or paste CSV text, choose the text column, and the engine analyzes every row with a summary chart and top positive / negative rows. All locally."
          icon={<Upload className="h-8 w-8" />}
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
                  <Badge variant="outline" className={`mr-2 ${SENTIMENT_COLORS[h.sentiment]}`}>{SENTIMENT_LABELS[h.sentiment]}</Badge>
                  <Badge variant="outline" className="mr-2">{h.score.toFixed(2)}</Badge>
                  <Badge variant="outline" className="mr-2">{h.sentenceCount} sentences</Badge>
                  {h.emotionTop && (
                    <Badge variant="outline" className="mr-2">{EMOTION_LABELS[h.emotionTop]}</Badge>
                  )}
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
            <strong className="text-foreground">Privacy & honesty:</strong> All sentiment analysis,
            emotion detection, and aspect extraction runs locally in your browser using a {LEXICON.length}-word
            lexicon — your text never leaves this device. On-device classifiers are strong but not perfect —
            scores are heuristic, not ground truth. Sarcasm, mixed sentiment, and domain slang reduce accuracy.
            The lexicon engine handles negation ("not good") and boosters ("very good") but cannot catch every
            nuance. Use the optional BYO-key LLM for sarcasm / slang handling.
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
