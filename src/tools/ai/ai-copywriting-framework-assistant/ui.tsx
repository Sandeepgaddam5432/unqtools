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
  FRAMEWORKS,
  FRAMEWORK_LABELS,
  FRAMEWORK_STAGES,
  FRAMEWORK_EXPLAINERS,
  TONE_LABELS,
  LENGTH_LABELS,
  CHANNEL_LABELS,
  VARIANT_COUNT,
  validateInputs,
  detectHype,
  generateVariants,
  generateAllFrameworks,
  renderPlain,
  renderMarkdown,
  renderJson,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  loadSwipe,
  saveSwipe,
  removeSwipe,
  clearSwipe,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Framework,
  type Tone,
  type Length,
  type Channel,
  type CopyInputs,
  type FrameworkVariant,
  type StageBlock,
  type HistoryEntry,
  type SwipeEntry,
  type LlmEnhancement,
} from "./logic";
import {
  PenTool, Sparkles, Key, History, AlertCircle, BookOpen, Layers,
  Bookmark, BookmarkCheck, Eye, EyeOff,
} from "lucide-react";

const EMPTY_INPUTS: CopyInputs = {
  product: "",
  audience: "",
  benefit: "",
  pain: "",
  feature: "",
  proof: "",
  cta: "",
};

const SAMPLE: CopyInputs = {
  product: "Acme Attribution",
  audience: "B2B SaaS marketers at $5–50M ARR",
  benefit: "Cuts reporting time from 8 hours/week to 20 minutes/week",
  pain: "Spending Mondays stitching ad-spend data across five platforms in spreadsheets",
  feature: "live pipeline attribution with no SQL required",
  proof: "Loom cut reporting time from 8 hours to 20 minutes per week",
  cta: "Start your free trial",
};

const INPUT_FIELDS: Array<{ key: keyof CopyInputs; label: string; multiline?: boolean; required?: boolean }> = [
  { key: "product", label: "Product / brand", required: true },
  { key: "audience", label: "Target audience", multiline: true, required: true },
  { key: "benefit", label: "Core benefit (outcome)", multiline: true, required: true },
  { key: "pain", label: "Pain point you solve", multiline: true, required: true },
  { key: "feature", label: "Anchoring feature (optional)", multiline: true },
  { key: "proof", label: "Proof point — metric, customer, result (optional)", multiline: true },
  { key: "cta", label: "Call to action", required: true },
];

export default function AiCopywritingFrameworkAssistant() {
  const [inputs, setInputs] = useState<CopyInputs>(EMPTY_INPUTS);
  const [framework, setFramework] = useState<Framework>("aida");
  const [tone, setTone] = useState<Tone>("professional");
  const [length, setLength] = useState<Length>("standard");
  const [channel, setChannel] = useState<Channel>("ad");
  const [output, setOutput] = useState<FrameworkVariant[] | null>(null);
  const [allOutput, setAllOutput] = useState<Record<Framework, FrameworkVariant[]> | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [swipe, setSwipe] = useState<SwipeEntry[]>([]);
  const [showExplainer, setShowExplainer] = useState(false);
  const [showAllFrameworks, setShowAllFrameworks] = useState(false);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<LlmEnhancement | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    setSwipe(loadSwipe());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-copywriting-framework-assistant:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.inputs && Object.keys(p.inputs).length > 0) {
        setInputs((prev) => ({ ...prev, ...p.inputs }));
      }
      setFramework(p.framework);
      setTone(p.tone);
      setLength(p.length);
      setChannel(p.channel);
      if (p.inputs && Object.keys(p.inputs).length > 0) {
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const warnings = useMemo(() => validateInputs(inputs), [inputs]);
  const hasRequired = useMemo(() =>
    inputs.product.trim() && inputs.audience.trim() && inputs.benefit.trim() && inputs.pain.trim() && inputs.cta.trim(),
  [inputs]);

  const handleGenerate = useCallback(() => {
    setError("");
    try {
      if (showAllFrameworks) {
        const all = generateAllFrameworks(inputs, tone, length, channel);
        setAllOutput(all);
        setOutput(all[framework]);
      } else {
        const vs = generateVariants(inputs, framework, tone, length, channel);
        setOutput(vs);
        setAllOutput(null);
      }
      setLlmResult(null);
      if (inputs.product.trim()) {
        saveHistory({
          ts: Date.now(),
          product: inputs.product,
          framework,
          tone,
          variantCount: VARIANT_COUNT,
        });
        setHistory(loadHistory());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    }
  }, [inputs, framework, tone, length, channel, showAllFrameworks]);

  const handleClear = useCallback(() => {
    setInputs(EMPTY_INPUTS);
    setOutput(null);
    setAllOutput(null);
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
    setInputs(SAMPLE);
    toast.info("Sample inputs loaded");
  }, []);

  const handleSaveSwipe = useCallback((variant: FrameworkVariant) => {
    const excerpt = variant.stages.map((s) => s.text).join(" ").slice(0, 120);
    saveSwipe({
      ts: Date.now(),
      framework: variant.framework,
      tone: variant.tone,
      product: inputs.product,
      excerpt,
    });
    setSwipe(loadSwipe());
    toast.success("Saved to swipe file");
  }, [inputs.product]);

  const handleRemoveSwipe = useCallback((ts: number) => {
    setSwipe(removeSwipe(ts));
    toast.info("Removed from swipe file");
  }, []);

  const handleClearSwipe = useCallback(() => {
    clearSwipe();
    setSwipe([]);
    toast.success("Swipe file cleared");
  }, []);

  const handleSaveKey = useCallback(() => {
    if (typeof localStorage !== "undefined") {
      try {
        if (llmKey) localStorage.setItem("unqtools:ai-copywriting-framework-assistant:llm-key", llmKey);
        else localStorage.removeItem("unqtools:ai-copywriting-framework-assistant:llm-key");
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
    if (!inputs.product.trim()) {
      toast.error("Enter at least a product name first");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    setLlmResult(null);
    try {
      const prompt = buildLlmPrompt(inputs, framework, tone, length, channel);
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
          temperature: 0.5,
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
      toast.success("LLM polish applied");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "LLM call failed";
      setLlmError(msg);
      toast.error(msg);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, inputs, framework, tone, length, channel]);

  const markdown = useMemo(() => {
    if (!output) return "";
    return renderMarkdown(output, inputs, framework, tone, length, channel);
  }, [output, inputs, framework, tone, length, channel]);

  const json = useMemo(() => {
    if (!output) return "";
    return renderJson(output, inputs, framework, tone, length, channel);
  }, [output, inputs, framework, tone, length, channel]);

  const csv = useMemo(() => output ? renderCsv(output) : "", [output]);

  const explainer = FRAMEWORK_EXPLAINERS[framework];

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Inputs */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">Inputs</div>
            <div className="flex gap-1.5">
              <Button variant="ghost" size="sm" onClick={handleLoadSample}>Load sample</Button>
              <ClearButton onClick={handleClear} disabled={!hasRequired && !output} />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {INPUT_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={`cfw-${f.key}`} className="text-[11px]">
                  {f.label}{f.required ? <span className="ml-1 text-destructive">*</span> : null}
                </Label>
                {f.multiline ? (
                  <Textarea
                    id={`cfw-${f.key}`}
                    value={inputs[f.key] ?? ""}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    className="min-h-[60px] resize-y text-sm"
                  />
                ) : (
                  <Input
                    id={`cfw-${f.key}`}
                    value={inputs[f.key] ?? ""}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    className="text-sm"
                  />
                )}
              </div>
            ))}
          </div>

          {warnings.length > 0 && (
            <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/10 p-2">
              {warnings.map((w, i) => (
                <div key={i} className="text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
                  <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px]">Framework</Label>
              <select
                value={framework}
                onChange={(e) => setFramework(e.target.value as Framework)}
                className="h-8 text-xs rounded border bg-background px-2 w-full"
              >
                {FRAMEWORKS.map((f) => (
                  <option key={f} value={f}>{FRAMEWORK_LABELS[f].split(" — ")[0]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Tone</Label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="h-8 text-xs rounded border bg-background px-2 w-full"
              >
                {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
                  <option key={t} value={t}>{TONE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Length</Label>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value as Length)}
                className="h-8 text-xs rounded border bg-background px-2 w-full"
              >
                {(Object.keys(LENGTH_LABELS) as Length[]).map((l) => (
                  <option key={l} value={l}>{LENGTH_LABELS[l]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Channel</Label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as Channel)}
                className="h-8 text-xs rounded border bg-background px-2 w-full"
              >
                {(Object.keys(CHANNEL_LABELS) as Channel[]).map((c) => (
                  <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <RunButton onClick={handleGenerate} disabled={!hasRequired} label={showAllFrameworks ? "Generate all frameworks" : `Generate ${VARIANT_COUNT} variants`} />
            <Button variant="outline" size="sm" onClick={() => setShowAllFrameworks((v) => !v)} className="gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              {showAllFrameworks ? "Single framework" : "Compare all frameworks"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowExplainer((v) => !v)} className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              {showExplainer ? "Hide explainer" : "Explain this framework"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowLlm((v) => !v)} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              {showLlm ? "Hide LLM polish" : "Polish with LLM"}
            </Button>
            <ShareButton getUrl={() => buildShareUrl(inputs, framework, tone, length, channel)} disabled={!hasRequired} />
          </div>
        </CardContent>
      </Card>

      {/* Explainer */}
      {showExplainer && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> {explainer.name} — why it works
            </h3>
            <div className="space-y-1">
              {explainer.stages.map((s) => (
                <div key={s.slug} className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="font-medium text-foreground">{s.label}</div>
                  <div className="text-muted-foreground"><strong>What:</strong> {s.what}</div>
                  <div className="text-muted-foreground"><strong>Why:</strong> {s.why}</div>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground">
              <strong>Best for:</strong> {explainer.bestFor}
            </div>
            <div className="text-[11px] text-muted-foreground">
              <strong>Watch out:</strong> {explainer.watchOut}
            </div>
          </CardContent>
        </Card>
      )}

      {/* LLM panel */}
      {showLlm && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Key className="h-4 w-4" /> Optional BYO-key LLM polish
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Paste your own OpenAI or Anthropic key. The key is stored only in this browser's localStorage. Requests go directly from your browser to the provider.
            </p>
            <div className="flex flex-wrap items-center gap-2">
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
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder="sk-…"
                className="h-8 max-w-[300px] text-xs"
              />
              <Button size="sm" variant="outline" onClick={handleSaveKey}>Save key</Button>
              <RunButton onClick={handleLlm} disabled={!llmKey || llmLoading} loading={llmLoading} label="Polish copy" />
            </div>
            {llmError && <ErrorBanner message={llmError} />}
            {llmResult && (
              <div className="space-y-2 pt-2">
                {llmResult.polishedStages.length > 0 && (
                  <div className="space-y-1">
                    {llmResult.polishedStages.map((s: StageBlock, i: number) => (
                      <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                        <div className="font-medium text-foreground">{s.label}</div>
                        <div className="text-muted-foreground whitespace-pre-wrap">{s.text}</div>
                      </div>
                    ))}
                  </div>
                )}
                {llmResult.subjectLines.length > 0 && (
                  <div>
                    <div className="text-[11px] font-medium text-foreground">Alternate headlines:</div>
                    <ul className="ml-4 list-disc text-xs text-muted-foreground">
                      {llmResult.subjectLines.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {llmResult.suggestions.length > 0 && (
                  <div>
                    <div className="text-[11px] font-medium text-foreground">Suggestions:</div>
                    <ul className="ml-4 list-disc text-xs text-muted-foreground">
                      {llmResult.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                <CopyButton getText={() => llmResult.polishedFullText} label="Copy polished copy" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* All frameworks comparison */}
      {showAllFrameworks && allOutput && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="h-4 w-4" /> All 5 frameworks — variant 1
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {FRAMEWORKS.map((f) => {
                const v = allOutput[f][0];
                return (
                  <div key={f} className="rounded border bg-background p-2 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-[10px]">{FRAMEWORK_LABELS[f].split(" — ")[0]}</Badge>
                      <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => { setFramework(f); setShowAllFrameworks(false); setOutput(allOutput[f]); }}>
                        Focus →
                      </Button>
                    </div>
                    <div className="text-muted-foreground space-y-0.5">
                      {v.stages.map((s) => (
                        <div key={s.slug}><span className="font-medium text-foreground">{s.label}:</span> {s.text}</div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Output */}
      {output && !showAllFrameworks ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <PenTool className="h-4 w-4" /> {FRAMEWORK_LABELS[framework]}
              </h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => markdown} label="Copy markdown" />
                <DownloadButton getText={() => markdown} filename="copywriting-framework.md" label="Download .md" />
                <DownloadButton getText={() => json} filename="copywriting-framework.json" mime="application/json" label="Download JSON" />
                <DownloadButton getText={() => csv} filename="copywriting-framework.csv" mime="text/csv" label="Download CSV" />
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {TONE_LABELS[tone]} · {LENGTH_LABELS[length]} · {CHANNEL_LABELS[channel]} · {VARIANT_COUNT} variants
            </div>
            <div className="space-y-3">
              {output.map((v) => (
                <div key={v.id} className="rounded-lg border bg-background p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-foreground">{v.id} <span className="text-muted-foreground font-normal">· {v.wordCount} words</span></div>
                    <div className="flex gap-1">
                      <CopyButton getText={() => renderPlain(v)} label="Copy plain" size="sm" />
                      <CopyButton getText={() => v.fullText} label="Copy labeled" size="sm" />
                      <Button size="sm" variant="outline" onClick={() => handleSaveSwipe(v)} className="gap-1.5">
                        <Bookmark className="h-3.5 w-3.5" /> Save
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {v.stages.map((s) => (
                      <div key={s.slug} className="text-xs">
                        <Badge variant="outline" className="text-[10px] mr-1.5">{s.label}</Badge>
                        <span className="text-foreground">{s.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground pt-2 border-t">
              <strong className="text-foreground">Honesty:</strong> This is a strong draft. Edit for accuracy and claims compliance before shipping. Do not publish unverified metrics or customer names. The honesty linter flags common hype words; replace them with specific proof points.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!output && !allOutput && (
        <EmptyState
          title="Fill in the inputs, pick a framework, generate"
          hint="Five labeled frameworks (AIDA, PAS, FAB, BAB, 4Ps), 3+ variants each, tone + length + channel control, explainer notes, swipe file. Click 'Load sample' to try it."
          icon={<PenTool className="h-8 w-8" />}
        />
      )}

      {/* Swipe file */}
      {swipe.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BookmarkCheck className="h-4 w-4" /> Swipe file ({swipe.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearSwipe}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[260px] overflow-auto">
              {swipe.map((s) => (
                <div key={s.ts} className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{FRAMEWORK_LABELS[s.framework].split(" — ")[0]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{TONE_LABELS[s.tone]}</Badge>
                    <span className="text-muted-foreground truncate flex-1">{s.excerpt}</span>
                    <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => handleRemoveSwipe(s.ts)}>Remove</Button>
                  </div>
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
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h) => (
                <div key={h.ts} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="text-[10px] mr-2">{FRAMEWORK_LABELS[h.framework].split(" — ")[0]}</Badge>
                  <Badge variant="outline" className="text-[10px] mr-2">{TONE_LABELS[h.tone]}</Badge>
                  <span className="text-muted-foreground">{h.product}</span>
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
            <strong className="text-foreground">Privacy:</strong> All framework assembly, variant generation, and the honesty linter run locally. History and swipe file are stored in localStorage on this device only. The only network call is the optional BYO-key LLM polish.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
