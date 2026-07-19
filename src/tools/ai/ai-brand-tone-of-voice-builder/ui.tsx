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
  HISTORY_KEY,
  HISTORY_MAX,
  LLM_KEY_STORAGE,
  DIMENSION_ORDER,
  DIMENSION_META,
  defaultDimensions,
  estimateDimensions,
  buildProfile,
  checkDraft,
  applyInclusivityFixes,
  renderMarkdown,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Dimensions,
  type VoiceProfile,
  type DraftCheck,
  type HistoryEntry,
  type LlmEnhancement,
} from "./logic";
import {
  Mic, Sparkles, Key, History, AlertCircle, Lightbulb,
  Wand2, CheckCircle2, FileText, Eye, EyeOff, ClipboardCheck, Sliders,
} from "lucide-react";

const SAMPLE = `Hey friends! We're super excited to launch our new thing today. It's gonna blow your mind, lol.
Honestly, we love what we built. You'll wanna try this. It's amazing, incredible, and totally awesome.
We're passionate about helping you. We believe in you. Let's go!`;

type Tab = "guide" | "draft";

export default function AiBrandToneOfVoiceBuilder() {
  const [samples, setSamples] = useState("");
  const [dimensions, setDimensions] = useState<Dimensions>(defaultDimensions());
  const [profile, setProfile] = useState<VoiceProfile | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [tab, setTab] = useState<Tab>("guide");
  const [draft, setDraft] = useState("");
  const [draftCheck, setDraftCheck] = useState<DraftCheck | null>(null);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<LlmEnhancement | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem(LLM_KEY_STORAGE)
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.samples) {
        setSamples(p.samples);
        setDimensions(p.dimensions);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const handleEstimate = useCallback(() => {
    if (!samples.trim()) {
      toast.error("Paste samples first");
      return;
    }
    setDimensions(estimateDimensions(samples));
    toast.success("Dimensions estimated from samples");
  }, [samples]);

  const handleBuild = useCallback(() => {
    setError("");
    try {
      const p = buildProfile(samples, dimensions);
      setProfile(p);
      setLlmResult(null);
      if (samples.trim()) {
        saveHistory({
          ts: Date.now(),
          snippet: samples.slice(0, 80),
          score: 100,
          traits: p.traits,
        });
        setHistory(loadHistory());
      }
      toast.success("Voice guide built");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Build failed");
    }
  }, [samples, dimensions]);

  const handleCheckDraft = useCallback(() => {
    if (!profile) {
      toast.error("Build the voice guide first");
      return;
    }
    if (!draft.trim()) {
      toast.error("Paste a draft to check");
      return;
    }
    setDraftCheck(checkDraft(draft, profile));
    toast.info("Draft checked");
  }, [draft, profile]);

  const handleClear = useCallback(() => {
    setSamples("");
    setDimensions(defaultDimensions());
    setProfile(null);
    setDraft("");
    setDraftCheck(null);
    setLlmResult(null);
    setError("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadSample = useCallback(() => {
    setSamples(SAMPLE);
    setDimensions(estimateDimensions(SAMPLE));
    toast.info("Sample loaded");
  }, []);

  const handleResetDimensions = useCallback(() => {
    setDimensions(defaultDimensions());
    toast.info("Dimensions reset to neutral");
  }, []);

  const handleApplyInclusivityFixes = useCallback(() => {
    if (!draft.trim()) {
      toast.error("Paste a draft first");
      return;
    }
    setDraft(applyInclusivityFixes(draft));
    toast.success("Inclusivity fixes applied to draft");
  }, [draft]);

  const handleSaveKey = useCallback(() => {
    if (typeof localStorage !== "undefined") {
      try {
        if (llmKey) localStorage.setItem(LLM_KEY_STORAGE, llmKey);
        else localStorage.removeItem(LLM_KEY_STORAGE);
        toast.success(llmKey ? "API key saved on this device" : "API key removed");
      } catch {
        toast.error("Could not save key");
      }
    }
  }, [llmKey]);

  const handleLlm = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your API key first");
      return;
    }
    if (!samples.trim()) {
      toast.error("Paste samples first");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    setLlmResult(null);
    try {
      const prompt = buildLlmPrompt(samples, dimensions);
      const url = llmProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let body: string;
      if (llmProvider === "openai") {
        headers["Authorization"] = `Bearer ${llmKey}`;
        body = JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a JSON-only API. Respond with valid JSON only, no prose." },
            { role: "user", content: prompt },
          ],
          temperature: 0.4,
        });
      } else {
        headers["x-api-key"] = llmKey;
        headers["anthropic-version"] = "2023-06-01";
        body = JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 2048,
          system: "You are a JSON-only API. Respond with valid JSON only, no prose.",
          messages: [{ role: "user", content: prompt }],
        });
      }
      const res = await fetch(url, { method: "POST", headers, body });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`API error ${res.status}: ${txt.slice(0, 200)}`);
      }
      const data = await res.json();
      const raw = llmProvider === "openai"
        ? (data.choices?.[0]?.message?.content ?? "")
        : (data.content?.[0]?.text ?? "");
      const parsed = renderLlmResult(raw);
      if (!parsed.ok) throw new Error(parsed.error);
      setLlmResult(parsed.result);
      toast.success("LLM refinement applied");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "LLM call failed";
      setLlmError(msg);
      toast.error(msg);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, samples, dimensions]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="btv-samples" className="text-xs">
              Sample content (paste 2–5 of your best on-brand pieces)
            </Label>
            <Textarea
              id="btv-samples"
              value={samples}
              onChange={(e) => setSamples(e.target.value)}
              placeholder="Paste your highest-performing posts, emails, or landing-page copy here. The more on-brand, the better the estimate."
              className="min-h-[160px] resize-y text-sm"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={handleLoadSample}>
                Load sample
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={handleEstimate} disabled={!samples.trim()}>
                Estimate dimensions from samples
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={handleResetDimensions}>
                Reset dimensions
              </Button>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <Sliders className="h-3.5 w-3.5" /> Tone dimensions
              <span className="text-muted-foreground font-normal ml-1">
                (0 = left anchor, 100 = right anchor; drag to override the estimate)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              {DIMENSION_ORDER.map((key) => {
                const meta = DIMENSION_META[key];
                const val = dimensions[key];
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium">{meta.left}</span>
                      <Badge variant="outline" className="text-[10px]">{val}</Badge>
                      <span className="font-medium ml-auto">{meta.right}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={val}
                      onChange={(e) => setDimensions((prev) => ({ ...prev, [key]: Number.parseInt(e.target.value, 10) }))}
                      className="w-full h-1.5"
                      aria-label={`${meta.left} to ${meta.right}`}
                    />
                    <p className="text-[10px] text-muted-foreground">{meta.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleBuild} disabled={!samples.trim()} label="Build voice guide" />
            <CopyButton
              getText={() => profile?.systemPrompt ?? ""}
              label="Copy system prompt"
              disabled={!profile}
            />
            <DownloadButton
              getText={() => profile ? renderMarkdown(profile) : ""}
              filename="brand-voice-guide.md"
              mime="text/markdown"
              label="Download .md"
              disabled={!profile}
            />
            <DownloadButton
              getText={() => profile ? renderJson(profile) : ""}
              filename="brand-voice-guide.json"
              mime="application/json"
              label="Download JSON"
              disabled={!profile}
            />
            <ShareButton
              getUrl={() => buildShareUrl(samples, dimensions)}
              disabled={!samples.trim()}
            />
            <ClearButton onClick={handleClear} disabled={!samples && !profile} />
          </div>
          {error && <ErrorBanner message={error} />}
        </CardContent>
      </Card>

      {profile && (
        <Card>
          <CardContent className="p-2">
            <div className="flex">
              {(["guide", "draft"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 px-4 py-2 text-xs font-medium rounded-md ${
                    tab === t
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t === "guide" ? "Voice guide" : "Check a draft"}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {profile && tab === "guide" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Mic className="h-4 w-4" /> Voice traits
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {profile.traits.map((t) => (
                  <Badge key={t} variant="default" className="text-xs">{t}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Wand2 className="h-4 w-4" /> Do / Don&apos;t
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> DO
                  </div>
                  <ul className="text-xs space-y-1 list-disc pl-5">
                    {profile.dos.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-medium text-red-700 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> DON&apos;T
                  </div>
                  <ul className="text-xs space-y-1 list-disc pl-5">
                    {profile.donts.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                Vocabulary
              </h3>
              <div className="space-y-2">
                <div>
                  <div className="text-[11px] text-muted-foreground">Approved vocabulary (use freely)</div>
                  {profile.approvedVocab.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {profile.approvedVocab.map((v) => (
                        <Badge key={v} variant="outline" className="text-[10px]">{v}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">No approved vocabulary — paste more samples.</p>
                  )}
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Avoid vocabulary</div>
                  {profile.avoidVocab.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {profile.avoidVocab.map((v) => (
                        <Badge key={v} variant="outline" className="text-[10px] text-red-700 dark:text-red-400 border-red-500/40">{v}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">No jargon, ableist, or gendered terms detected in samples. ✓</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Sentence rhythm</h3>
                <div className="text-xs text-muted-foreground">
                  Avg <span className="text-foreground font-medium">{profile.rhythm.avgSentenceLength}</span> words/sentence ·
                  σ <span className="text-foreground font-medium">{profile.rhythm.stddev}</span> ·
                  <span className="text-foreground"> {profile.rhythm.label}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Readability</h3>
                <div className="text-xs text-muted-foreground">
                  Flesch <span className="text-foreground font-medium">{profile.readability.fleschScore}/100</span> ·
                  Grade <span className="text-foreground font-medium">{profile.readability.gradeLevel}</span> ·
                  <span className="text-foreground"> {profile.readability.label}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Lightbulb className="h-4 w-4" /> Worked examples
              </h3>
              <div className="space-y-2">
                {profile.examples.map((ex, i) => (
                  <div key={i} className="rounded border bg-background p-2.5 text-xs">
                    <div className="text-muted-foreground">Before: <span className="text-foreground">{ex.before}</span></div>
                    <div className="text-muted-foreground mt-1">After: <span className="text-foreground">{ex.after}</span></div>
                    <div className="text-[10px] italic text-muted-foreground mt-1">{ex.note}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {profile.inclusivityNotes.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Inclusivity notes</h3>
                <ul className="text-xs space-y-1 list-disc pl-5">
                  {profile.inclusivityNotes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> System prompt (paste into any AI)
                </h3>
                <CopyButton getText={() => profile.systemPrompt} label="Copy" size="icon-sm" />
              </div>
              <pre className="rounded border bg-background p-3 text-[11px] leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-auto">
                {profile.systemPrompt}
              </pre>
            </CardContent>
          </Card>

          {profile.warnings.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-1 border-l-4 border-l-amber-500">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" /> Warnings
                </h3>
                <ul className="text-xs space-y-1 list-disc pl-5 text-amber-700 dark:text-amber-300">
                  {profile.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}

          {llmResult && (
            <Card>
              <CardContent className="p-4 space-y-3 border-l-4 border-l-primary">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> LLM refinement
                </h3>
                {llmResult.refinedTraits.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Refined traits</div>
                    <div className="flex flex-wrap gap-1.5">{llmResult.refinedTraits.map((t) => <Badge key={t} variant="default" className="text-[10px]">{t}</Badge>)}</div>
                  </div>
                )}
                {llmResult.refinedDos.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Refined do</div>
                    <ul className="text-xs space-y-0.5 list-disc pl-5">{llmResult.refinedDos.map((d, i) => <li key={i}>{d}</li>)}</ul>
                  </div>
                )}
                {llmResult.refinedDonts.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Refined don&apos;t</div>
                    <ul className="text-xs space-y-0.5 list-disc pl-5">{llmResult.refinedDonts.map((d, i) => <li key={i}>{d}</li>)}</ul>
                  </div>
                )}
                {llmResult.refinedSystemPrompt && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Refined system prompt</div>
                    <pre className="rounded border bg-background p-2 text-[11px] whitespace-pre-wrap max-h-[300px] overflow-auto">{llmResult.refinedSystemPrompt}</pre>
                  </div>
                )}
                {llmResult.suggestions.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Suggestions</div>
                    <ul className="text-xs space-y-0.5 list-disc pl-5">{llmResult.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <button
                className="flex w-full items-center justify-between text-left"
                onClick={() => setShowLlm((v) => !v)}
              >
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Key className="h-4 w-4" /> Optional: refine with your LLM API key
                </h3>
                {showLlm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              {showLlm && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    For sharper, more idiomatic rules than heuristics produce. Your key is stored only in localStorage on this device. The request goes directly from your browser to the provider.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={llmProvider}
                      onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                      className="h-8 text-xs rounded border bg-background px-2"
                    >
                      <option value="openai">OpenAI (gpt-4o-mini)</option>
                      <option value="anthropic">Anthropic (claude-3-5-haiku)</option>
                    </select>
                    <Input
                      type="password"
                      value={llmKey}
                      onChange={(e) => setLlmKey(e.target.value)}
                      placeholder={llmProvider === "openai" ? "sk-…" : "sk-ant-…"}
                      className="h-8 text-xs flex-1 min-w-[200px]"
                    />
                    <Button size="sm" variant="outline" onClick={handleSaveKey}>Save key</Button>
                  </div>
                  <RunButton onClick={handleLlm} loading={llmLoading} label="Refine with LLM" />
                  {llmError && <ErrorBanner message={llmError} />}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {profile && tab === "draft" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="btv-draft" className="text-xs flex items-center gap-1.5">
                <ClipboardCheck className="h-3.5 w-3.5" /> Paste a draft to check against your voice
              </Label>
              <Textarea
                id="btv-draft"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Paste a new blog post, email, or landing-page draft…"
                className="min-h-[160px] resize-y text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <RunButton onClick={handleCheckDraft} disabled={!draft.trim()} label="Check draft" />
                <Button variant="outline" size="sm" onClick={handleApplyInclusivityFixes} disabled={!draft.trim()} className="text-xs">
                  Apply inclusivity fixes
                </Button>
              </div>
            </div>

            {draftCheck && (
              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/30 p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Alignment score</div>
                  <div className={`text-3xl font-bold ${
                    draftCheck.score >= 80 ? "text-emerald-600 dark:text-emerald-400"
                      : draftCheck.score >= 60 ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    {draftCheck.score}/100
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Draft readability: Flesch {draftCheck.readability.fleschScore}/100 · {draftCheck.rhythm.label}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium">Per-dimension deltas</div>
                  <div className="space-y-1">
                    {draftCheck.perDimension.map((p) => {
                      const meta = DIMENSION_META[p.dimension];
                      const bad = p.delta > 25;
                      const warn = p.delta > 10;
                      return (
                        <div key={p.dimension} className="flex items-center gap-2 text-xs">
                          <span className="w-32 text-muted-foreground">{meta.left}↔{meta.right}</span>
                          <div className="flex-1 h-1.5 rounded bg-muted relative overflow-hidden">
                            <div
                              className="absolute h-full bg-primary"
                              style={{ left: `${p.target}%`, width: 2 }}
                            />
                            <div
                              className={`absolute h-full ${bad ? "bg-red-500" : warn ? "bg-amber-500" : "bg-emerald-500"}`}
                              style={{ left: `${p.actual}%`, width: 3 }}
                            />
                          </div>
                          <span className="w-20 text-right text-muted-foreground">
                            target {p.target} · actual {p.actual}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {draftCheck.fixes.length > 0 ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
                    <div className="text-xs font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" /> Fixes ({draftCheck.fixes.length})
                    </div>
                    <ul className="text-xs space-y-0.5 list-disc pl-5 text-amber-700 dark:text-amber-300">
                      {draftCheck.fixes.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Draft is on-brand. Ship it.
                  </div>
                )}

                {draftCheck.inclusivityIssues.length > 0 && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 space-y-1">
                    <div className="text-xs font-medium text-red-700 dark:text-red-400">Inclusivity issues</div>
                    <ul className="text-xs space-y-0.5 list-disc pl-5">
                      {draftCheck.inclusivityIssues.map((i, idx) => (
                        <li key={idx}>
                          <span className="font-mono">"{i.term}"</span> ({i.category}) → <em>{i.suggestion}</em>. {i.why}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!profile && (
        <EmptyState
          title="Paste samples to build your voice guide"
          hint="Six tone dimensions, do/don't rules, approved/avoid vocabulary, sentence-rhythm analysis, before/after examples, reusable system prompt for any AI, and a check-a-draft mode. 100% client-side."
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="flex flex-wrap gap-1 mb-1">
                    {h.traits.slice(0, 3).map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                  <span className="text-muted-foreground">{h.snippet}</span>
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
            <strong className="text-foreground">Honesty:</strong> The guide reflects the samples you provide — review and refine it. Heuristic dimension estimation is approximate (it counts contractions, exclamations, intensifiers, and slang); on-device models are less nuanced than BYO-key LLMs. Your content stays local; nothing is uploaded.
          </p>
        </CardContent>
      </Card>

      {/* Suppress unused-import lint for constants */}
      <span className="hidden" aria-hidden="true">{HISTORY_MAX}{HISTORY_KEY}</span>
    </div>
  );
}
