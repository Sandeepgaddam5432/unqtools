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
  FORMAT_LABELS,
  DURATION_PRESETS,
  TOPIC_PRESETS,
  PLATFORM_LABELS,
  validateInput,
  generateEpisode,
  computeStats,
  renderText,
  renderMarkdown,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type EpisodeFormat,
  type EpisodePlan,
  type HistoryEntry,
  type ShareState,
} from "./logic";
import {
  Mic, Sparkles, Key, History, ChevronDown, ChevronRight,
  ListChecks, Clock, Users, MessageCircle, AlertCircle, Scissors,
} from "lucide-react";

export default function AiPodcastEpisodePlanner() {
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState<EpisodeFormat>("solo");
  const [durationMin, setDurationMin] = useState(30);
  const [guestsText, setGuestsText] = useState("");
  const [plan, setPlan] = useState<EpisodePlan | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState("");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmExtra, setLlmExtra] = useState<{
    hook?: string;
    segmentSuggestions: Array<{ label: string; talkingPoints: string[] }>;
    guestQuestions: string[];
    titleOptions: string[];
    showNotes: string[];
  } | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-podcast-planner:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.topic) setTopic(p.topic);
      if (p.format) setFormat(p.format);
      if (p.durationMin) setDurationMin(p.durationMin);
      if (p.guests !== undefined) setGuestsText(p.guests);
      if (p.topic) {
        toast.info("Loaded from share link");
        handleGenerate({
          topic: p.topic,
          format: p.format ?? "solo",
          durationMin: p.durationMin ?? 30,
          guestsText: p.guests ?? "",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = useCallback(
    (overrides?: {
      topic?: string;
      format?: EpisodeFormat;
      durationMin?: number;
      guestsText?: string;
    }) => {
      const t = (overrides?.topic ?? topic).trim();
      const f = overrides?.format ?? format;
      const d = overrides?.durationMin ?? durationMin;
      const gText = overrides?.guestsText ?? guestsText;
      const guests = gText
        .split(/[\n,;]+/)
        .map((s) => s.replace(/\s+/g, " ").trim())
        .filter(Boolean);

      const err = validateInput(t, d, f, guests);
      if (err) {
        setError(err);
        setPlan(null);
        toast.error(err);
        return;
      }
      setError("");
      setLlmExtra(null);
      try {
        const out = generateEpisode({ topic: t, format: f, durationMin: d, guests });
        setPlan(out);
        saveHistory({
          ts: Date.now(),
          topic: out.topic,
          format: out.format,
          durationMin: out.durationMin,
          guestCount: out.guests.length,
          segmentCount: out.segments.length,
          guestQuestionCount: out.guestQuestions.length,
        });
        setHistory(loadHistory());
        toast.success(`Plan generated: ${out.segments.length} segments, ${out.guestQuestions.length} questions`);
      } catch (e) {
        const msg = (e as Error).message;
        setError(msg);
        toast.error(msg);
      }
    },
    [topic, format, durationMin, guestsText],
  );

  const stats = useMemo(() => (plan ? computeStats(plan) : null), [plan]);

  const handleClear = useCallback(() => {
    setTopic("");
    setGuestsText("");
    setPlan(null);
    setLlmExtra(null);
    setError("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSaveLlmKey = () => {
    if (typeof localStorage !== "undefined") {
      if (llmKey) localStorage.setItem("unqtools:ai-podcast-planner:llm-key", llmKey);
      else localStorage.removeItem("unqtools:ai-podcast-planner:llm-key");
    }
    toast.success(llmKey ? "API key saved locally" : "API key cleared");
  };

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) { toast.error("Please paste your API key first"); return; }
    if (!topic.trim()) { toast.error("Enter a topic first"); return; }
    setLlmLoading(true);
    setError("");
    try {
      const guests = guestsText
        .split(/[\n,;]+/)
        .map((s) => s.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      const prompt = buildLlmPrompt(topic.trim(), format, durationMin, guests);
      const url = llmProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let body: Record<string, unknown>;
      if (llmProvider === "openai") {
        headers["Authorization"] = `Bearer ${llmKey}`;
        body = {
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a senior podcast producer who plans episodes." },
            { role: "user", content: prompt },
          ],
          temperature: 0.8,
        };
      } else {
        headers["x-api-key"] = llmKey;
        headers["anthropic-version"] = "2023-06-01";
        body = {
          model: "claude-3-5-haiku-20241022",
          max_tokens: 2048,
          messages: [{ role: "user", content: prompt }],
        };
      }
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const txt = await res.text();
        setError(`LLM request failed (${res.status}): ${txt.slice(0, 200)}`);
        toast.error("LLM request failed");
        setLlmLoading(false);
        return;
      }
      const data = await res.json();
      const rawText = llmProvider === "openai"
        ? (data.choices?.[0]?.message?.content ?? "")
        : (data.content?.[0]?.text ?? "");
      const parsed = renderLlmResult(rawText);
      if (!parsed.ok) {
        setError(parsed.error);
        setLlmLoading(false);
        return;
      }
      setLlmExtra(parsed.result);
      toast.success(`LLM added ${parsed.result.segmentSuggestions.length} segment suggestions`);
    } catch (e) {
      setError(`LLM request error: ${(e as Error).message}`);
      toast.error("LLM request error");
    }
    setLlmLoading(false);
  }, [llmKey, llmProvider, topic, format, durationMin, guestsText]);

  const shareState: ShareState = { topic, format, durationMin, guests: guestsText };
  const needsGuests = format === "interview" || format === "panel";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ai-pod-topic">Episode topic</Label>
            <Textarea
              id="ai-pod-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={"e.g., The future of remote work, Building habits that stick"}
              className="min-h-[60px] resize-y text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {TOPIC_PRESETS.map((p) => (
                <Button
                  key={p}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setTopic(p)}
                >+ {p}</Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Format</Label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as EpisodeFormat)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(FORMAT_LABELS) as EpisodeFormat[]).map((f) => (
                  <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-pod-dur" className="text-xs">Duration (min)</Label>
              <Input
                id="ai-pod-dur"
                type="number"
                min={1}
                max={240}
                value={durationMin}
                onChange={(e) => setDurationMin(Math.max(1, Number(e.target.value) || 1))}
                className="h-8 text-xs"
              />
              <div className="flex flex-wrap gap-1">
                {DURATION_PRESETS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={() => setDurationMin(d)}
                  >{d}m</button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-pod-guests" className="text-xs">
                Guests {needsGuests ? "(required)" : "(optional)"}
              </Label>
              <Input
                id="ai-pod-guests"
                value={guestsText}
                onChange={(e) => setGuestsText(e.target.value)}
                placeholder={format === "panel" ? "Jane Doe, John Smith, A. N. Other" : "Jane Doe"}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <RunButton
              onClick={() => handleGenerate()}
              label="Generate episode plan"
              loading={false}
              disabled={!topic.trim()}
            />
            <ShareButton getUrl={() => buildShareUrl(shareState)} disabled={!topic.trim()} />
            <ClearButton onClick={handleClear} disabled={!topic && !plan} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {plan && stats ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> Plan for &ldquo;{plan.topic}&rdquo;
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Segments" value={stats.segmentCount} icon={<ListChecks className="h-3 w-3" />} />
                <Stat label="Runtime" value={`${plan.durationMin}m`} icon={<Clock className="h-3 w-3" />} />
                <Stat label="Guest questions" value={stats.guestQuestionCount} icon={<MessageCircle className="h-3 w-3" />} />
                <Stat label="Ad breaks" value={stats.adBreakCount} icon={<Scissors className="h-3 w-3" />} />
              </div>
              <div className="rounded border bg-muted/40 px-3 py-2 text-xs italic text-foreground">
                <strong className="not-italic">Hook:</strong> {plan.hook}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ListChecks className="h-4 w-4" /> Segments with timestamps
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => renderText(plan)} label="Copy text" />
                  <DownloadButton
                    getText={() => renderMarkdown(plan)}
                    filename="podcast-episode-plan.md"
                    mime="text/markdown"
                    label="Download .md"
                  />
                  <DownloadButton
                    getText={() => renderJson(plan)}
                    filename="podcast-episode-plan.json"
                    mime="application/json"
                    label="Download .json"
                  />
                </div>
              </div>
              <div className="space-y-2 max-h-[600px] overflow-auto">
                {plan.segments.map((s, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] font-mono">{s.startLabel}–{s.endLabel}</Badge>
                      <span className="font-medium text-foreground">{s.label}</span>
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        {Math.round(s.weight * 100)}% of runtime
                      </Badge>
                    </div>
                    <ul className="ml-4 list-disc text-muted-foreground space-y-0.5">
                      {s.talkingPoints.map((tp, j) => (
                        <li key={j}>{tp}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {plan.adBreaks.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Scissors className="h-4 w-4" /> Ad breaks
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {plan.adBreaks.map((a, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      {a.atLabel} · {a.position} ({a.durationSec}s)
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {plan.guestQuestions.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> Guest interview questions
                </h3>
                <div className="space-y-1 max-h-[400px] overflow-auto">
                  {plan.guestQuestions.map((q, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <Badge variant="secondary" className="text-[10px] mr-2">{q.guest}</Badge>
                      <Badge variant="outline" className="text-[10px] mr-2">{q.intent}</Badge>
                      <span className="text-foreground">{q.question}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Title options</h3>
              <ol className="list-decimal ml-5 text-xs space-y-1">
                {plan.titleOptions.map((t, i) => (
                  <li key={i} className="text-foreground">{t}</li>
                ))}
              </ol>
              <h3 className="text-sm font-semibold text-foreground pt-2">Description options</h3>
              <div className="space-y-1">
                {plan.descriptionOptions.map((d, i) => (
                  <p key={i} className="text-xs text-muted-foreground rounded border bg-background px-3 py-1.5">
                    {d}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>

          {plan.socialClips.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Social clip suggestions</h3>
                <div className="space-y-1">
                  {plan.socialClips.map((c) => (
                    <div key={c.index} className="rounded border bg-background px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {PLATFORM_LABELS[c.suggestedPlatform]}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{c.durationSec}s</Badge>
                        <span className="font-medium text-foreground">from &ldquo;{c.segment}&rdquo;</span>
                      </div>
                      <p className="text-muted-foreground mt-1">{c.hook}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Show notes</h3>
              <pre className="text-xs whitespace-pre-wrap font-sans text-foreground bg-muted/40 rounded p-3 max-h-[300px] overflow-auto">
                {plan.showNotes.join("\n")}
              </pre>
            </CardContent>
          </Card>

          {/* Optional LLM enhancement */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <button
                className="flex items-center gap-1.5 text-sm font-semibold text-foreground w-full"
                onClick={() => setShowLlm((v) => !v)}
              >
                {showLlm ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Key className="h-4 w-4" /> Optional: Enhance with LLM (BYO API key)
              </button>
              {showLlm && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs text-muted-foreground">
                    Paste your own OpenAI or Anthropic API key. Stored only in localStorage on this device. The tool builds an optimal prompt and parses the JSON response into extra segment suggestions and title options.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      type="password"
                      placeholder="sk-... or anthropic key"
                      value={llmKey}
                      onChange={(e) => setLlmKey(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <div className="flex gap-2">
                      <select
                        value={llmProvider}
                        onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                        className="h-8 text-xs rounded border bg-background px-2 flex-1"
                      >
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                      </select>
                      <Button size="sm" variant="outline" onClick={handleSaveLlmKey} className="h-8">
                        Save key
                      </Button>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleLlmEnhance}
                    disabled={llmLoading || !llmKey || !topic.trim()}
                    className="gap-1.5"
                  >
                    {llmLoading ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {llmLoading ? "Working…" : "Enhance with LLM"}
                  </Button>
                  {llmExtra && (
                    <div className="space-y-2 pt-2 border-t">
                      {llmExtra.hook && (
                        <div className="text-xs rounded border bg-violet-50 dark:bg-violet-950/30 px-3 py-2">
                          <Badge className="text-[10px] mr-2 bg-violet-500 text-white">LLM hook</Badge>
                          <span className="italic text-foreground">{llmExtra.hook}</span>
                        </div>
                      )}
                      {llmExtra.segmentSuggestions.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-foreground mb-1">
                            LLM segment suggestions ({llmExtra.segmentSuggestions.length})
                          </p>
                          <div className="space-y-1">
                            {llmExtra.segmentSuggestions.map((s, i) => (
                              <div key={i} className="text-xs rounded border bg-background px-3 py-1.5">
                                <div className="font-medium text-foreground">{s.label}</div>
                                <ul className="ml-4 list-disc text-muted-foreground">
                                  {s.talkingPoints.map((tp, j) => <li key={j}>{tp}</li>)}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {llmExtra.titleOptions.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-foreground mb-1">LLM title options</p>
                          <ul className="list-disc ml-5 text-xs text-foreground">
                            {llmExtra.titleOptions.map((t, i) => <li key={i}>{t}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                    <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    Plans are drafts to shape with your voice. LLM output is a starting point — always review for accuracy and originality before publishing.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a topic to plan your episode"
          hint="Pick a format, set the duration, add guests if needed. We'll generate segments with timestamps, talking points, guest questions, ad breaks, chapter markers, title options, and show notes."
          icon={<Mic className="h-8 w-8" />}
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
                <button
                  key={i}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/40 transition"
                  onClick={() => {
                    setTopic(h.topic);
                    setFormat(h.format);
                    setDurationMin(h.durationMin);
                    handleGenerate({
                      topic: h.topic,
                      format: h.format,
                      durationMin: h.durationMin,
                      guestsText: "",
                    });
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{FORMAT_LABELS[h.format]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.durationMin}m</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.segmentCount} segs</Badge>
                    <span className="font-medium text-foreground">{h.topic}</span>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All planning runs locally in your browser. Topics and guests never leave this device. The only network call is if you paste your own LLM API key and click &ldquo;Enhance with LLM&rdquo; — that request goes directly to your chosen provider. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}{label}
      </div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
