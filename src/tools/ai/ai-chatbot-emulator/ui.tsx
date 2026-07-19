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
  RunButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  HISTORY_MAX,
  BOTS_MAX,
  LLM_KEY_STORAGE,
  TONE_LABELS,
  DEFAULT_CONFIG,
  DEFAULT_PERSONA,
  DEFAULT_FALLBACK,
  parseKb,
  sampleKbString,
  validateKb,
  computeStats,
  generateResponse,
  runTestQueries,
  testSummary,
  renderTranscriptText,
  renderTranscriptMarkdown,
  renderConfigJson,
  parseConfigJson,
  loadHistory,
  saveHistory,
  clearHistory,
  loadBots,
  saveBot,
  deleteBot,
  clearBots,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  honestyNote,
  type BotConfig,
  type Tone,
  type ChatMessage,
  type HistoryEntry,
  type SavedBot,
  type LlmEnhancement,
} from "./logic";
import {
  Bot, MessageSquare, Settings, Send, Sparkles, Key, History,
  AlertCircle, Save, Trash2, FileText, FileJson, FileCode, FlaskConical,
  Wand2, ShieldAlert, Quote, Gauge, ListChecks, BookOpen, Eye, EyeOff,
} from "lucide-react";

export default function AiChatbotEmulator() {
  const [config, setConfig] = useState<BotConfig>({ ...DEFAULT_CONFIG, kb: parseKb(sampleKbString()) });
  const [kbRaw, setKbRaw] = useState(sampleKbString());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [bots, setBots] = useState<SavedBot[]>([]);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<LlmEnhancement | null>(null);
  const [showTest, setShowTest] = useState(false);
  const [testInput, setTestInput] = useState("hello\nhow do I reset my password?\nrandom gibberish");
  const [testResults, setTestResults] = useState<ReturnType<typeof runTestQueries> | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState("");
  const [bannedWordsRaw, setBannedWordsRaw] = useState("");
  const msgIdRef = useRef(1);

  useEffect(() => {
    setHistory(loadHistory());
    setBots(loadBots());
    const key = typeof localStorage !== "undefined" ? localStorage.getItem(LLM_KEY_STORAGE) : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.config && p.config.name) {
        setConfig((prev) => ({ ...prev, ...p.config }));
        if (p.config.kb && p.config.kb.length > 0) {
          // Re-render the KB as text.
          setKbRaw(p.config.kb.map((e) => `Q: ${e.question} | A: ${e.answer}`).join("\n"));
        }
        toast.info("Loaded bot config from share link");
      }
    }
  }, []);

  // Keep config.kb in sync with kbRaw.
  const parsedKb = useMemo(() => parseKb(kbRaw), [kbRaw]);
  const effectiveConfig = useMemo<BotConfig>(
    () => ({
      ...config,
      kb: parsedKb,
      bannedWords: bannedWordsRaw.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean),
    }),
    [config, parsedKb, bannedWordsRaw],
  );

  const warnings = useMemo(() => validateKb(effectiveConfig), [effectiveConfig]);
  const stats = useMemo(() => computeStats(effectiveConfig), [effectiveConfig]);

  const handleSend = useCallback(() => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { id: msgIdRef.current++, role: "user", text: chatInput, ts: Date.now() };
    const response = generateResponse(chatInput, effectiveConfig);
    const botMsg: ChatMessage = {
      id: msgIdRef.current++,
      role: "bot",
      text: response.answer,
      ts: Date.now() + 1,
      response,
    };
    setMessages((prev) => [...prev, userMsg, botMsg]);
    saveHistory({
      ts: Date.now(),
      botName: effectiveConfig.name,
      query: chatInput,
      answer: response.answer,
      confidence: response.confidence,
      isFallback: response.isFallback,
    });
    setHistory(loadHistory());
    setChatInput("");
  }, [chatInput, effectiveConfig]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    toast.info("Chat cleared");
  }, []);

  const handleSaveBot = useCallback(() => {
    const next = saveBot(effectiveConfig);
    setBots(next);
    toast.success(`Saved bot "${effectiveConfig.name}"`);
  }, [effectiveConfig]);

  const handleLoadBot = useCallback((bot: SavedBot) => {
    setConfig(bot.config);
    setKbRaw(bot.config.kb.map((e) => `Q: ${e.question} | A: ${e.answer}`).join("\n"));
    setBannedWordsRaw(bot.config.bannedWords.join(", "));
    setMessages([]);
    toast.success(`Loaded bot "${bot.config.name}"`);
  }, []);

  const handleDeleteBot = useCallback((id: string) => {
    const next = deleteBot(id);
    setBots(next);
    toast.info("Bot deleted");
  }, []);

  const handleClearBots = useCallback(() => {
    clearBots();
    setBots([]);
    toast.success("All saved bots cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleRunTests = useCallback(() => {
    const queries = testInput.split("\n").map((s) => s.trim()).filter(Boolean);
    if (queries.length === 0) {
      toast.error("Enter at least one test query");
      return;
    }
    const results = runTestQueries(queries, effectiveConfig);
    setTestResults(results);
    toast.success(`Ran ${queries.length} test queries`);
  }, [testInput, effectiveConfig]);

  const handleLlmPolish = useCallback(async () => {
    if (messages.length === 0) {
      toast.error("Send a message first");
      return;
    }
    const lastBot = [...messages].reverse().find((m) => m.role === "bot");
    if (!lastBot) {
      toast.error("No bot message to polish");
      return;
    }
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) {
      toast.error("No user query");
      return;
    }
    if (!llmKey) {
      toast.error("Paste your LLM API key first");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    setLlmResult(null);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(LLM_KEY_STORAGE, llmKey);
      }
      const prompt = buildLlmPrompt(lastUser.text, effectiveConfig, lastBot.response?.citation ?? null);
      const url = llmProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages";
      const res = await fetch(url, {
        method: "POST",
        headers: llmProvider === "openai"
          ? { "Content-Type": "application/json", Authorization: `Bearer ${llmKey}` }
          : { "Content-Type": "application/json", "x-api-key": llmKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify(
          llmProvider === "openai"
            ? {
                model: "gpt-4o-mini",
                messages: [
                  { role: "system", content: "You are an expert chatbot response writer. Always respond with valid JSON." },
                  { role: "user", content: prompt },
                ],
                temperature: 0.5,
              }
            : {
                model: "claude-3-5-haiku-latest",
                max_tokens: 1500,
                system: "You are an expert chatbot response writer. Always respond with valid JSON.",
                messages: [{ role: "user", content: prompt }],
              },
        ),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`LLM API ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      const raw = llmProvider === "openai"
        ? (data.choices?.[0]?.message?.content ?? "")
        : (data.content?.[0]?.text ?? "");
      const parsed = renderLlmResult(raw);
      if (!parsed.ok) throw new Error(parsed.error);
      setLlmResult(parsed.result);
      toast.success("LLM polish complete");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "LLM polish failed";
      setLlmError(msg);
      toast.error(msg);
    } finally {
      setLlmLoading(false);
    }
  }, [messages, llmKey, llmProvider, effectiveConfig]);

  const handleExportConfig = useCallback(() => {
    const json = renderConfigJson(effectiveConfig);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${effectiveConfig.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-config.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Config exported");
  }, [effectiveConfig]);

  const handleImportConfig = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseConfigJson(text);
      if (!parsed.ok) {
        toast.error(parsed.error);
        return;
      }
      setConfig(parsed.config);
      setKbRaw(parsed.config.kb.map((entry) => `Q: ${entry.question} | A: ${entry.answer}`).join("\n"));
      setBannedWordsRaw(parsed.config.bannedWords.join(", "));
      toast.success("Config imported");
    };
    reader.readAsText(file);
    e.target.value = ""; // allow re-import of same file
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Persona + Settings */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <Settings className="h-4 w-4" />
            <h3 className="text-sm font-semibold text-foreground">Bot persona & settings</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Bot name">
              <Input
                value={config.name}
                onChange={(e) => setConfig((p) => ({ ...p, name: e.target.value }))}
                className="h-9"
              />
            </Field>
            <Field label="Tone">
              <select
                className="h-9 w-full rounded border bg-background px-2 text-sm"
                value={config.tone}
                onChange={(e) => setConfig((p) => ({ ...p, tone: e.target.value as Tone }))}
              >
                {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
                  <option key={t} value={t}>{TONE_LABELS[t]}</option>
                ))}
              </select>
            </Field>
            <Field label="Confidence threshold (0–1)">
              <Input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={config.confidenceThreshold}
                onChange={(e) => setConfig((p) => ({ ...p, confidenceThreshold: parseFloat(e.target.value) || 0 }))}
                className="h-9"
              />
            </Field>
          </div>
          <Field label="Persona / system prompt">
            <Textarea
              value={config.persona}
              onChange={(e) => setConfig((p) => ({ ...p, persona: e.target.value }))}
              placeholder={DEFAULT_PERSONA}
              className="min-h-[80px] resize-y text-xs"
            />
          </Field>
          <Field label="Fallback message (shown when no KB match meets the threshold)">
            <Textarea
              value={config.fallbackMessage}
              onChange={(e) => setConfig((p) => ({ ...p, fallbackMessage: e.target.value }))}
              placeholder={DEFAULT_FALLBACK}
              className="min-h-[50px] resize-y text-xs"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Max response length (chars, 0 = unlimited)">
              <Input
                type="number"
                min="0"
                value={config.maxResponseLength}
                onChange={(e) => setConfig((p) => ({ ...p, maxResponseLength: parseInt(e.target.value, 10) || 0 }))}
                className="h-9"
              />
            </Field>
            <Field label="Banned words (comma-separated, redacted from responses)">
              <Input
                value={bannedWordsRaw}
                onChange={(e) => setBannedWordsRaw(e.target.value)}
                placeholder="competitor, spam"
                className="h-9"
              />
            </Field>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowAdvanced((s) => !s)} className="text-xs">
            {showAdvanced ? "Hide" : "Show"} advanced scoring weights
          </Button>
          {showAdvanced && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Weight: TF-IDF">
                <Input
                  type="number"
                  step="0.05"
                  min="0"
                  value={config.weightTfIdf}
                  onChange={(e) => setConfig((p) => ({ ...p, weightTfIdf: parseFloat(e.target.value) || 0 }))}
                  className="h-9"
                />
              </Field>
              <Field label="Weight: Jaccard">
                <Input
                  type="number"
                  step="0.05"
                  min="0"
                  value={config.weightJaccard}
                  onChange={(e) => setConfig((p) => ({ ...p, weightJaccard: parseFloat(e.target.value) || 0 }))}
                  className="h-9"
                />
              </Field>
              <Field label="Weight: Levenshtein">
                <Input
                  type="number"
                  step="0.05"
                  min="0"
                  value={config.weightLevenshtein}
                  onChange={(e) => setConfig((p) => ({ ...p, weightLevenshtein: parseFloat(e.target.value) || 0 }))}
                  className="h-9"
                />
              </Field>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KB editor */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> Knowledge base
            </h3>
            <Badge variant="secondary" className="text-[10px]">{stats.entryCount} entries</Badge>
          </div>
          <Field label="Paste your FAQ or Q&A pairs">
            <Textarea
              value={kbRaw}
              onChange={(e) => setKbRaw(e.target.value)}
              placeholder={"Q: How do I reset my password? | A: Click the 'Forgot password' link..."}
              className="min-h-[160px] resize-y font-mono text-xs"
            />
          </Field>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Entries" value={stats.entryCount} icon={<BookOpen className="h-3 w-3" />} />
            <Stat label="Total words" value={stats.totalWords} icon={<FileText className="h-3 w-3" />} />
            <Stat label="Avg / entry" value={stats.avgWordsPerEntry} icon={<Gauge className="h-3 w-3" />} />
            <Stat label="Unique words" value={stats.uniqueWords} icon={<ListChecks className="h-3 w-3" />} />
          </div>
          {warnings.length > 0 && (
            <div className="rounded border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs space-y-1">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-amber-800 dark:text-amber-200">{w}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSaveBot} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> Save bot
            </Button>
            <ShareButton getUrl={() => buildShareUrl(effectiveConfig)} />
            <Button variant="outline" size="sm" onClick={handleExportConfig} className="gap-1.5">
              <FileJson className="h-3.5 w-3.5" /> Export config
            </Button>
            <label className="inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded border bg-background hover:bg-accent cursor-pointer">
              <FileCode className="h-3.5 w-3.5" /> Import config
              <input type="file" accept=".json,application/json" onChange={handleImportConfig} className="hidden" />
            </label>
            <Button variant="outline" size="sm" onClick={() => setShowTest((s) => !s)} className="gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" /> {showTest ? "Hide" : "Show"} test mode
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Chat */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" /> Live chat test ({messages.length} messages)
            </h3>
            {messages.length > 0 && (
              <div className="flex gap-2">
                <CopyButton getText={() => renderTranscriptText(messages)} label="Copy" />
                <DownloadButton getText={() => renderTranscriptMarkdown(messages, effectiveConfig)} filename="chatbot-transcript.md" mime="text/markdown" label="Markdown" />
                <DownloadButton getText={() => renderTranscriptText(messages)} filename="chatbot-transcript.txt" mime="text/plain" label="Text" />
                <ClearButton onClick={handleClearChat} />
              </div>
            )}
          </div>
          <div className="rounded border bg-background p-3 min-h-[200px] max-h-[400px] overflow-auto space-y-2">
            {messages.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center pt-8">
                Send a message below to test your bot. Responses include citations, confidence scores, and intent detection.
              </p>
            ) : (
              messages.map((m) => <ChatBubble key={m.id} msg={m} botName={effectiveConfig.name} />)
            )}
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask the bot something..."
              className="flex-1"
            />
            <RunButton onClick={handleSend} disabled={!chatInput.trim()} label="Send" />
          </div>
          {messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowLlm((s) => !s)} className="gap-1.5">
              <Wand2 className="h-3.5 w-3.5" /> {showLlm ? "Hide" : "Show"} optional LLM polish (BYO key)
            </Button>
          )}
          {showLlm && (
            <div className="mt-3 space-y-2">
              <div className="rounded border bg-amber-50 dark:bg-amber-950/30 p-2 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  Optional LLM polish sends the last user query + the cited KB chunk to your chosen LLM provider (OpenAI or Anthropic) using <strong>your own API key</strong>, stored only in this browser. Your entire KB is NOT sent — only the cited chunk. Skip this for 100% offline.
                </span>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  className="h-9 rounded border bg-background px-2 text-xs"
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
                <Input
                  type="password"
                  placeholder="Paste your API key"
                  value={llmKey}
                  onChange={(e) => setLlmKey(e.target.value)}
                  className="h-9 flex-1 min-w-[200px] font-mono text-xs"
                />
                <RunButton onClick={handleLlmPolish} loading={llmLoading} label="Polish last response" />
              </div>
              {llmError && <ErrorBanner message={llmError} />}
              {llmResult && (
                <div className="rounded border bg-background p-3 text-xs space-y-2">
                  <div>
                    <strong className="text-foreground">Refined answer:</strong>
                    <p className="mt-1 text-muted-foreground">{llmResult.refinedAnswer}</p>
                  </div>
                  {llmResult.alternativeAnswers.length > 0 && (
                    <div>
                      <strong className="text-foreground">Alternatives:</strong>
                      <ul className="mt-1 list-disc list-inside text-muted-foreground">
                        {llmResult.alternativeAnswers.map((a, i) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}
                  {llmResult.notes.length > 0 && (
                    <div>
                      <strong className="text-foreground">Notes:</strong>
                      <ul className="mt-1 list-disc list-inside text-muted-foreground">
                        {llmResult.notes.map((n, i) => <li key={i}>{n}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test mode */}
      {showTest && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FlaskConical className="h-4 w-4" /> Test mode — run predefined queries in bulk
            </h3>
            <Field label="Test queries (one per line)">
              <Textarea
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                className="min-h-[80px] resize-y font-mono text-xs"
              />
            </Field>
            <RunButton onClick={handleRunTests} label="Run test queries" />
            {testResults && testResults.length > 0 && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Stat label="Total" value={testSummary(testResults).total} />
                  <Stat label="Fallbacks" value={testSummary(testResults).fallbacks} highlight={testSummary(testResults).fallbacks > 0 ? "bad" : undefined} />
                  <Stat label="Avg confidence" value={`${(testSummary(testResults).avgConfidence * 100).toFixed(0)}%`} />
                </div>
                <div className="space-y-1 max-h-[300px] overflow-auto">
                  {testResults.map((r, i) => (
                    <div key={i} className="rounded border bg-background p-2 text-xs space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{r.response.intent}</Badge>
                        {r.response.isFallback ? (
                          <Badge variant="destructive" className="text-[10px]">fallback</Badge>
                        ) : (
                          <Badge variant="default" className="text-[10px]">{(r.response.confidence * 100).toFixed(0)}% confidence</Badge>
                        )}
                        <span className="font-mono text-muted-foreground">{r.query}</span>
                      </div>
                      <p className="text-foreground">{r.response.answer}</p>
                      {r.response.citation && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Quote className="h-3 w-3" /> cited: "{r.response.citation.question}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Saved bots */}
      {bots.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Bot className="h-4 w-4" /> Saved bots ({bots.length}/{BOTS_MAX})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearBots}>Clear all</Button>
            </div>
            <div className="space-y-1">
              {bots.map((b) => (
                <div key={b.id} className="rounded border bg-background px-3 py-2 text-xs flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{b.config.kb.length} KB</Badge>
                  <span className="font-medium text-foreground">{b.name}</span>
                  <span className="text-muted-foreground text-[10px]">{b.config.tone}</span>
                  <span className="text-muted-foreground text-[10px] ml-auto">{new Date(b.savedAt).toLocaleString()}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleLoadBot(b)}>
                    <Sparkles className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteBot(b.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent queries ({history.length}/{HISTORY_MAX})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{h.botName}</Badge>
                  {h.isFallback ? (
                    <Badge variant="destructive" className="text-[10px]">fallback</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">{(h.confidence * 100).toFixed(0)}%</Badge>
                  )}
                  <span className="font-mono text-muted-foreground">{h.query}</span>
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Honesty */}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}{label}
      </div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function ChatBubble({ msg, botName }: { msg: ChatMessage; botName: string }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
      <div className={`rounded-lg px-3 py-2 text-xs max-w-[85%] ${isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
        <div className="text-[10px] opacity-70 mb-0.5">{isUser ? "You" : botName}</div>
        <div>{msg.text}</div>
      </div>
      {msg.response && !isUser && (
        <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground px-1">
          {msg.response.isFallback ? (
            <Badge variant="destructive" className="text-[9px]">fallback</Badge>
          ) : (
            <Badge variant="secondary" className="text-[9px]">{(msg.response.confidence * 100).toFixed(0)}% confidence</Badge>
          )}
          <Badge variant="outline" className="text-[9px]">{msg.response.intent}</Badge>
          {msg.response.citation && (
            <span className="flex items-center gap-0.5">
              <Quote className="h-2.5 w-2.5" /> {msg.response.citation.question}
            </span>
          )}
          {msg.response.warnings.length > 0 && (
            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
              <AlertCircle className="h-2.5 w-2.5" /> {msg.response.warnings.length} warning(s)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
