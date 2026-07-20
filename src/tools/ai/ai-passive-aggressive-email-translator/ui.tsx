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
  Mail, MailWarning, History, ShieldAlert, Key, Sparkles, Eye, Wand2,
} from "lucide-react";
import {
  HISTORY_MAX,
  TONE_LABELS,
  SEVERITY_LABELS,
  CATEGORY_LABELS,
  ESCALATION_LABELS,
  SAMPLE_EMAILS,
  decodeEmail,
  defuseEmail,
  renderHighlightedHtml,
  renderDefuseDiffHtml,
  renderHitsCsv,
  buildLlmPrompt,
  renderLlmResult,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Mode,
  type Tone,
  type Severity,
  type PhraseCategory,
  type EscalationLevel,
  type HistoryEntry,
} from "./logic";

const TONE_ORDER: Tone[] = ["calm", "professional", "warm", "direct"];

const SEVERITY_COLORS: Record<Severity, string> = {
  low: "text-emerald-600 dark:text-emerald-400",
  medium: "text-amber-600 dark:text-amber-400",
  high: "text-red-600 dark:text-red-400",
};

const ESCALATION_COLORS: Record<EscalationLevel, string> = {
  "mild": "text-emerald-600 dark:text-emerald-400",
  "annoyed": "text-amber-600 dark:text-amber-400",
  "passive-aggressive": "text-orange-600 dark:text-orange-400",
  "hostile": "text-red-600 dark:text-red-400",
  "hr-incident": "text-fuchsia-600 dark:text-fuchsia-400",
};

export default function AiPassiveAggressiveEmailTranslator() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<Mode>("decode");
  const [tone, setTone] = useState<Tone>("professional");
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
      ? localStorage.getItem("unqtools:ai-passive-aggressive-email-translator:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.text) {
        setText(p.text);
        setDebouncedText(p.text);
        setMode(p.mode);
        setTone(p.tone);
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

  const decodeResult = useMemo(
    () => mode === "decode" ? decodeEmail(debouncedText) : null,
    [debouncedText, mode],
  );
  const defuseResult = useMemo(
    () => mode === "defuse" ? defuseEmail(debouncedText, tone) : null,
    [debouncedText, mode, tone],
  );

  const highlightedHtml = useMemo(
    () => decodeResult ? renderHighlightedHtml(decodeResult) : "",
    [decodeResult],
  );
  const diffHtml = useMemo(
    () => defuseResult ? renderDefuseDiffHtml(defuseResult.original, defuseResult.rewritten) : "",
    [defuseResult],
  );
  const hitsCsv = useMemo(() => {
    if (mode === "decode" && decodeResult) return renderHitsCsv(decodeResult.hits);
    if (mode === "defuse" && defuseResult) return renderHitsCsv(defuseResult.hits);
    return "";
  }, [decodeResult, defuseResult, mode]);

  const handleClear = useCallback(() => {
    setText("");
    setDebouncedText("");
    setLlmOutput("");
    setLlmError("");
    toast.info("Cleared");
  }, []);

  const handleSample = useCallback((s: { label: string; mode: Mode; text: string }) => {
    setText(s.text);
    setDebouncedText(s.text);
    setMode(s.mode);
    toast.info(`Loaded sample: ${s.label}`);
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (!debouncedText.trim()) return;
    if (mode === "decode" && decodeResult) {
      saveHistory({
        ts: Date.now(),
        mode: "decode",
        tone,
        textLength: decodeResult.original.length,
        score: decodeResult.score,
        phraseCount: decodeResult.stats.phraseCount,
        escalationLevel: decodeResult.escalationLevel,
      });
    } else if (mode === "defuse" && defuseResult) {
      saveHistory({
        ts: Date.now(),
        mode: "defuse",
        tone,
        textLength: defuseResult.original.length,
        score: defuseResult.beforeScore,
        phraseCount: defuseResult.hitsFixed,
        escalationLevel: "mild",
      });
    }
    setHistory(loadHistory());
  }, [debouncedText, mode, decodeResult, defuseResult, tone]);

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
      setLlmError("Enter some email text to enhance.");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    setLlmOutput("");
    try {
      const prompt = buildLlmPrompt(text, mode, tone);
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
            { role: "system", content: "You are a workplace communication analyst and editor." },
            { role: "user", content: prompt },
          ],
          max_tokens: 800,
          temperature: 0.4,
        })
        : JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 800,
          system: "You are a workplace communication analyst and editor.",
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
  }, [llmKey, llmProvider, text, mode, tone]);

  const handleSaveLlmKey = useCallback((v: string) => {
    setLlmKey(v);
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("unqtools:ai-passive-aggressive-email-translator:llm-key", v);
      } catch {
        // ignore
      }
    }
  }, []);

  const hasContent = debouncedText.trim().length > 0;
  const phraseCount = decodeResult?.stats.phraseCount ?? defuseResult?.hitsFixed ?? 0;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={mode === "decode" ? "default" : "outline"}
              onClick={() => setMode("decode")}
              className="gap-1.5"
            >
              <Eye className="h-3.5 w-3.5" /> Decode
            </Button>
            <Button
              size="sm"
              variant={mode === "defuse" ? "default" : "outline"}
              onClick={() => setMode("defuse")}
              className="gap-1.5"
            >
              <Wand2 className="h-3.5 w-3.5" /> Defuse
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="paet-text">
              {mode === "decode"
                ? "Paste a passive-aggressive email to decode"
                : "Paste your angry/passive-aggressive draft to defuse"}
            </Label>
            <Textarea
              id="paet-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                mode === "decode"
                  ? "Per my last email, as I mentioned previously, please advise at your earliest convenience…"
                  : "I've told you three times now. Do your job and fix it…"
              }
              className="min-h-[140px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {SAMPLE_EMAILS.map((s) => (
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

          {mode === "defuse" && (
            <div>
              <Label className="text-xs">Defuse tone</Label>
              <div className="flex flex-wrap gap-1 pt-1">
                {TONE_ORDER.map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={tone === t ? "default" : "outline"}
                    className="h-7 text-[11px]"
                    onClick={() => setTone(t)}
                  >{TONE_LABELS[t]}</Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {hasContent ? (
        <>
          {mode === "decode" && decodeResult && (
            <>
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldAlert className="h-4 w-4" /> Passive-aggression score
                    </h3>
                    <Badge variant="outline" className="text-[10px]">
                      Confidence: {decodeResult.confidence}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <Stat
                      label="PA score (0–100)"
                      value={decodeResult.score}
                      highlight={decodeResult.score >= 55 ? "bad" : decodeResult.score >= 35 ? "warn" : "good"}
                    />
                    <Stat label="Phrases" value={decodeResult.stats.phraseCount} />
                    <Stat label="Escalation pts" value={decodeResult.stats.totalEscalation} />
                    <Stat label="Words" value={decodeResult.stats.wordCount} />
                  </div>
                  <div className={`text-sm font-medium ${ESCALATION_COLORS[decodeResult.escalationLevel]}`}>
                    {ESCALATION_LABELS[decodeResult.escalationLevel]}
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500"
                      style={{ width: `${decodeResult.score}%` }}
                    />
                  </div>
                  <div className="rounded border bg-background p-3 text-xs text-muted-foreground">
                    <strong className="text-foreground">Plain-English read: </strong>
                    {decodeResult.summary}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Mail className="h-4 w-4" /> Email with highlighted phrases
                  </h3>
                  <div
                    className="prose prose-sm max-w-none rounded border bg-background p-3 text-xs leading-relaxed font-mono"
                    dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                  />
                  <style>{`
                    .pa-hit { background: rgba(245, 158, 11, 0.25); padding: 0 2px; border-radius: 3px; cursor: help; }
                    .pa-low { background: rgba(16, 185, 129, 0.25); }
                    .pa-medium { background: rgba(245, 158, 11, 0.25); }
                    .pa-high { background: rgba(239, 68, 68, 0.3); }
                  `}</style>
                </CardContent>
              </Card>

              {decodeResult.hits.length > 0 && (
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      Phrase breakdown ({decodeResult.hits.length})
                    </h3>
                    <div className="space-y-1 max-h-[400px] overflow-auto">
                      {decodeResult.hits.map((h) => (
                        <div key={h.id} className="rounded border bg-background px-3 py-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-mono font-medium text-foreground">“{h.original}”</span>
                            <Badge variant="outline" className="text-[10px]">
                              {CATEGORY_LABELS[h.entry.category]}
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] ${SEVERITY_COLORS[h.entry.severity]}`}>
                              {SEVERITY_LABELS[h.entry.severity]}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              esc {h.entry.escalation}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground">
                            <strong className="text-foreground">What they mean: </strong>{h.gloss}
                          </div>
                          <div className="text-muted-foreground mt-0.5">
                            <strong className="text-foreground">Why: </strong>{h.why}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <CopyButton
                        getText={() => { handleSaveHistory(); return decodeResult.summary; }}
                        label="Copy summary"
                      />
                      <DownloadButton
                        getText={() => { handleSaveHistory(); return hitsCsv; }}
                        filename="passive-aggressive-hits.csv"
                        mime="text/csv"
                        label="Download CSV"
                      />
                      <ShareButton
                        getUrl={() => { handleSaveHistory(); return buildShareUrl(text, mode, tone); }}
                      />
                      <ClearButton onClick={handleClear} />
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {mode === "defuse" && defuseResult && (
            <>
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Wand2 className="h-4 w-4" /> Defused ({TONE_LABELS[tone]} tone)
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <Stat label="Phrases fixed" value={defuseResult.hitsFixed} highlight="good" />
                    <Stat label="Score before" value={defuseResult.beforeScore} highlight={defuseResult.beforeScore >= 35 ? "bad" : "warn"} />
                    <Stat label="Score after" value={defuseResult.afterScore} highlight={defuseResult.afterScore < 15 ? "good" : "warn"} />
                    <Stat label="Improvement" value={defuseResult.beforeScore - defuseResult.afterScore} highlight="good" />
                  </div>
                  <div className="rounded border bg-background p-3 text-xs leading-relaxed">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Rewritten</div>
                    <p className="whitespace-pre-wrap font-mono">{defuseResult.rewritten}</p>
                  </div>
                  {defuseResult.hitsFixed > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Diff</div>
                      <div
                        className="prose prose-sm max-w-none rounded border bg-background p-3 text-xs leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: diffHtml }}
                      />
                      <style>{`
                        .pa-del { background: rgba(239, 68, 68, 0.2); text-decoration: line-through; }
                        .pa-ins { background: rgba(16, 185, 129, 0.2); text-decoration: underline; }
                      `}</style>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <CopyButton
                      getText={() => { handleSaveHistory(); return defuseResult.rewritten; }}
                      label="Copy rewrite"
                    />
                    <DownloadButton
                      getText={() => { handleSaveHistory(); return defuseResult.rewritten; }}
                      filename="defused-email.txt"
                      mime="text/plain"
                      label="Download .txt"
                    />
                    <ShareButton
                      getUrl={() => { handleSaveHistory(); return buildShareUrl(text, mode, tone); }}
                    />
                    <ClearButton onClick={handleClear} />
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Optional BYO-key LLM */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Key className="h-4 w-4" /> Optional LLM enhancement (BYO key)
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLlm((v) => !v)}
                >{showLlm ? "Hide" : "Show"}</Button>
              </div>
              {showLlm && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    The on-device engine above is the default. Optionally paste your own LLM API key to
                    get a more nuanced read or rewrite — your text is sent directly from your browser to
                    the provider you choose, never to UnQTools.
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
                      {llmLoading ? "Working…" : `Enhance (${mode})`}
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
          title={mode === "decode"
            ? "Paste a passive-aggressive email to decode"
            : "Paste your angry draft to defuse it"}
          hint={
            mode === "decode"
              ? "Get a 0–100 score, escalation meter, inline phrase highlights, and a plain-English 'what they actually mean' read. Click a sample to try it."
              : "Pick a tone (Calm / Professional / Warm / Direct) and the engine rewrites each flagged phrase. Click a sample to try it."
          }
          icon={<MailWarning className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.mode}</Badge>
                  <Badge variant="outline" className="mr-2">{TONE_LABELS[h.tone]}</Badge>
                  <Badge variant="outline" className="mr-2">score {h.score}</Badge>
                  <Badge variant="outline" className="mr-2">{h.phraseCount} phrases</Badge>
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
            <strong className="text-foreground">Privacy & honesty:</strong> All phrase matching, scoring,
            and rewriting runs locally. Your emails never leave this device. Tone is subjective and
            context-dependent — this tool offers a <em>read</em>, not a verdict. Sarcasm and cultural
            context can flip meaning; the engine flags low-confidence calls so you can read the score
            in context.
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
