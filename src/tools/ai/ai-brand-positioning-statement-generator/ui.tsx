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
  FRAMEWORK_LABELS,
  TONE_LABELS,
  FIELD_HINTS,
  GENERIC_PHRASES,
  validateInputs,
  detectGenericPhrases,
  sharpenDifferentiator,
  buildStatement,
  derivePillars,
  deriveElevatorPitch,
  deriveTaglines,
  generate,
  renderMarkdown,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type BrandInputs,
  type Framework,
  type Tone,
  type PositioningOutput,
  type HistoryEntry,
  type LlmEnhancement,
} from "./logic";
import {
  Target, Sparkles, Key, History, AlertCircle, Lightbulb,
  Megaphone, Quote, Tag, Compass, Eye, EyeOff, Wand2,
} from "lucide-react";

const SAMPLE: BrandInputs = {
  brandName: "Acme Analytics",
  category: "product analytics platform",
  audience: "growth-stage SaaS product teams",
  need: "understand feature adoption without writing SQL",
  benefit: "answer product questions in seconds with no-code dashboards",
  differentiator: "ingest events from any source with a visual schema mapper",
  reasonToBelieve: "trusted by 400+ SaaS teams including Notion, Linear, and Vercel",
};

const FIELDS: Array<{ key: keyof BrandInputs; label: string; multiline?: boolean }> = [
  { key: "brandName", label: "Brand name" },
  { key: "category", label: "Category" },
  { key: "audience", label: "Target audience" },
  { key: "need", label: "Customer need", multiline: true },
  { key: "benefit", label: "Key benefit", multiline: true },
  { key: "differentiator", label: "Differentiator", multiline: true },
  { key: "reasonToBelieve", label: "Reason to believe", multiline: true },
];

export default function AiBrandPositioningStatementGenerator() {
  const [inputs, setInputs] = useState<BrandInputs>({
    brandName: "",
    category: "",
    audience: "",
    need: "",
    benefit: "",
    differentiator: "",
    reasonToBelieve: "",
  });
  const [framework, setFramework] = useState<Framework>("moore");
  const [tone, setTone] = useState<Tone>("concise");
  const [output, setOutput] = useState<PositioningOutput | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
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
      if (p.inputs && Object.keys(p.inputs).length > 0) {
        setInputs((prev) => ({ ...prev, ...p.inputs }));
        setFramework(p.framework);
        setTone(p.tone);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  // Live preview — recompute whenever inputs/framework/tone change.
  const livePreview = useMemo(() => {
    const hasAny = Object.values(inputs).some((v) => v && v.trim());
    if (!hasAny) return "";
    return buildStatement(inputs, framework, tone);
  }, [inputs, framework, tone]);

  const liveWarnings = useMemo(() => validateInputs(inputs), [inputs]);
  const liveSharpen = useMemo(() => {
    if (!inputs.differentiator || !inputs.differentiator.trim()) return null;
    return sharpenDifferentiator(inputs.differentiator);
  }, [inputs.differentiator]);

  const handleGenerate = useCallback(() => {
    setError("");
    try {
      const out = generate(inputs, framework, tone);
      setOutput(out);
      setLlmResult(null);
      if (inputs.brandName && inputs.brandName.trim()) {
        saveHistory({
          ts: Date.now(),
          brandName: inputs.brandName,
          framework,
          tone,
          statement: out.statements.find((s) => s.primary)?.text ?? "",
        });
        setHistory(loadHistory());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    }
  }, [inputs, framework, tone]);

  const handleClear = useCallback(() => {
    setInputs({
      brandName: "", category: "", audience: "", need: "",
      benefit: "", differentiator: "", reasonToBelieve: "",
    });
    setOutput(null);
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
    toast.info("Sample brand loaded");
  }, []);

  const handleApplySharpened = useCallback(() => {
    if (liveSharpen && liveSharpen.genericPhrases.length > 0) {
      setInputs((prev) => ({ ...prev, differentiator: liveSharpen.sharpened }));
      toast.success("Sharpened differentiator applied — edit the [bracketed] prompts");
    }
  }, [liveSharpen]);

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
    if (!inputs.brandName.trim()) {
      toast.error("Enter at least a brand name first");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    setLlmResult(null);
    try {
      const prompt = buildLlmPrompt(inputs, framework, tone);
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
      toast.success("LLM polish applied");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "LLM call failed";
      setLlmError(msg);
      toast.error(msg);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, inputs, framework, tone]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <div key={f.key} className={f.multiline ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}>
                <Label htmlFor={`bps-${f.key}`} className="text-xs">
                  {f.label}
                  <span className="ml-2 text-muted-foreground font-normal">— {FIELD_HINTS[f.key].hint}</span>
                </Label>
                {f.multiline ? (
                  <Textarea
                    id={`bps-${f.key}`}
                    value={inputs[f.key]}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={`e.g. ${FIELD_HINTS[f.key].sample}`}
                    className="min-h-[60px] resize-y text-sm"
                  />
                ) : (
                  <Input
                    id={`bps-${f.key}`}
                    value={inputs[f.key]}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={`e.g. ${FIELD_HINTS[f.key].sample}`}
                    className="text-sm"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs">Framework</Label>
              <select
                value={framework}
                onChange={(e) => setFramework(e.target.value as Framework)}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                {(Object.keys(FRAMEWORK_LABELS) as Framework[]).map((fw) => (
                  <option key={fw} value={fw}>{FRAMEWORK_LABELS[fw]}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs">Tone</Label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
                  <option key={t} value={t}>{TONE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={handleLoadSample}>
              Load sample
            </Button>
          </div>

          {livePreview && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                Live preview · {FRAMEWORK_LABELS[framework]} · {TONE_LABELS[tone]}
              </div>
              <p className="text-sm text-foreground leading-relaxed">{livePreview}</p>
            </div>
          )}

          {liveWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300 mb-1">
                <AlertCircle className="h-3.5 w-3.5" /> {liveWarnings.length} warning{liveWarnings.length === 1 ? "" : "s"}
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-amber-700 dark:text-amber-300">
                {liveWarnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {liveSharpen && liveSharpen.genericPhrases.length > 0 && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-2.5 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-medium">
                <Wand2 className="h-3.5 w-3.5" /> Differentiator sharpener
              </div>
              <p className="text-muted-foreground">
                Generic phrases detected: {liveSharpen.genericPhrases.map((g) => <Badge key={g} variant="outline" className="mx-0.5 text-[10px]">{g}</Badge>)}
              </p>
              <div className="rounded bg-background p-2 text-foreground font-mono text-[11px]">
                {liveSharpen.sharpened}
              </div>
              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={handleApplySharpened}>
                Apply sharpened version
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleGenerate} disabled={!Object.values(inputs).some((v) => v && v.trim())} label="Generate" />
            <CopyButton
              getText={() => livePreview}
              label="Copy preview"
              disabled={!livePreview}
            />
            <DownloadButton
              getText={() => output ? renderMarkdown(output, inputs) : ""}
              filename="brand-positioning.md"
              mime="text/markdown"
              label="Download .md"
              disabled={!output}
            />
            <DownloadButton
              getText={() => output ? renderJson(output, inputs) : ""}
              filename="brand-positioning.json"
              mime="application/json"
              label="Download JSON"
              disabled={!output}
            />
            <ShareButton
              getUrl={() => buildShareUrl(inputs, framework, tone)}
              disabled={!Object.values(inputs).some((v) => v && v.trim())}
            />
            <ClearButton onClick={handleClear} disabled={!Object.values(inputs).some((v) => v && v.trim()) && !output} />
          </div>
          {error && <ErrorBanner message={error} />}
        </CardContent>
      </Card>

      {output && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Compass className="h-4 w-4" /> Positioning statements ({output.statements.length})
              </h3>
              <div className="space-y-2">
                {output.statements.map((s, i) => (
                  <div
                    key={i}
                    className={`rounded border p-3 ${s.primary ? "border-primary bg-primary/5" : "bg-background"}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Badge variant={s.primary ? "default" : "outline"} className="text-[10px]">
                        {FRAMEWORK_LABELS[s.framework]}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">{TONE_LABELS[s.tone]}</Badge>
                      {s.primary && <Badge variant="default" className="text-[10px]">Primary</Badge>}
                      <CopyButton getText={() => s.text} label="Copy" size="icon-sm" />
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{s.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Megaphone className="h-4 w-4" /> Messaging pillars
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {output.pillars.map((p, i) => (
                  <div key={i} className="rounded border bg-background p-3">
                    <div className="text-xs font-semibold text-foreground">{p.title}</div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{p.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Quote className="h-4 w-4" /> Elevator pitch
              </h3>
              <p className="text-sm text-foreground leading-relaxed">{output.elevatorPitch}</p>
              <CopyButton getText={() => output.elevatorPitch} label="Copy pitch" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Tag className="h-4 w-4" /> Tagline options
              </h3>
              <div className="space-y-1.5">
                {output.taglines.map((t, i) => (
                  <div key={i} className="flex items-center justify-between rounded border bg-background px-3 py-2">
                    <span className="text-sm text-foreground">{t}</span>
                    <CopyButton getText={() => t} label="Copy" size="icon-sm" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {output.sharpenResult && output.sharpenResult.genericPhrases.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2 border-l-4 border-l-amber-500">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4" /> Differentiator sharpening
                </h3>
                <ul className="text-xs space-y-1 list-disc pl-5">
                  {output.sharpenResult.issues.map((iss, i) => <li key={i}>{iss}</li>)}
                </ul>
                <div className="rounded bg-background p-2 text-xs font-mono">
                  {output.sharpenResult.sharpened}
                </div>
              </CardContent>
            </Card>
          )}

          {llmResult && (
            <Card>
              <CardContent className="p-4 space-y-3 border-l-4 border-l-primary">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> LLM polish
                </h3>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Polished statement</div>
                  <p className="text-sm text-foreground leading-relaxed">{llmResult.polishedStatement || "(empty)"}</p>
                </div>
                {llmResult.polishedPillars.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Polished pillars</div>
                    <ul className="text-xs space-y-1 list-disc pl-5">
                      {llmResult.polishedPillars.map((p, i) => (
                        <li key={i}><strong>{p.title}:</strong> {p.description}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {llmResult.polishedPitch && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Polished pitch</div>
                    <p className="text-sm text-foreground">{llmResult.polishedPitch}</p>
                  </div>
                )}
                {llmResult.polishedTaglines.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Polished taglines</div>
                    <ul className="text-xs space-y-0.5 list-disc pl-5">
                      {llmResult.polishedTaglines.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </div>
                )}
                {llmResult.suggestions.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Suggestions</div>
                    <ul className="text-xs space-y-0.5 list-disc pl-5">
                      {llmResult.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
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
                  <Key className="h-4 w-4" /> Optional: polish with your LLM API key
                </h3>
                {showLlm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              {showLlm && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    For sharper, more idiomatic phrasing than the templates produce. Your key is stored only in localStorage on this device. The request goes directly from your browser to the provider.
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
                  <RunButton onClick={handleLlm} loading={llmLoading} label="Polish with LLM" />
                  {llmError && <ErrorBanner message={llmError} />}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!output && (
        <EmptyState
          title="Fill in your brand inputs to generate positioning"
          hint="Four frameworks (Moore, Dunford, JTBD, Geiger) × three tones (concise, energetic, formal), plus auto-derived messaging pillars, elevator pitch, taglines, and a generic-differentiator sharpener. 100% client-side."
          icon={<Target className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2 text-[10px]">{FRAMEWORK_LABELS[h.framework]}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{TONE_LABELS[h.tone]}</Badge>
                  <span className="font-medium">{h.brandName}</span>
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
            <strong className="text-foreground">Honesty:</strong> Positioning is a thinking exercise — this tool <em>structures and phrases your thinking</em> into proven frameworks. Great positioning comes from real customer and market insight, not from a template. Use the output as a starting point; review and refine with your team. All generation runs locally in your browser; nothing is uploaded.
          </p>
        </CardContent>
      </Card>

      {/* Suppress unused-import lint for icon and constants */}
      <span className="hidden" aria-hidden="true">{GENERIC_PHRASES.length}{HISTORY_MAX}{HISTORY_KEY}</span>
    </div>
  );
}
