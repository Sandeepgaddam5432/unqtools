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
  PORTER_FORCE_LABELS,
  FORCE_LEVEL_LABELS,
  AXIS_LABELS,
  FIELD_HINTS,
  validateInputs,
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
  type AnalysisInputs,
  type CompetitorInputs,
  type PositioningAxis,
  type AnalysisOutput,
  type HistoryEntry,
  type LlmEnhancement,
} from "./logic";
import {
  Microscope, Sparkles, Key, History, AlertCircle,
  Grid3x3, Target, Compass, Map, Plus, Trash2, Eye, EyeOff,
} from "lucide-react";

const EMPTY_COMP: CompetitorInputs = {
  name: "", strengths: "", weaknesses: "", pricing: "", features: "",
};

const SAMPLE_YOUR: CompetitorInputs = {
  name: "UnQlytics",
  strengths: "Fast UI\nNo-code dashboards\nFree tier",
  weaknesses: "Fewer integrations than Acme\nNewer brand",
  pricing: "$$",
  features: "Dashboards\nFunnels\nCohorts\nNo-code builder\nLive collaboration",
};

const SAMPLE_COMPS: CompetitorInputs[] = [
  {
    name: "Acme Analytics",
    strengths: "Strong enterprise brand\n200+ integrations\nISO 27001 certified",
    weaknesses: "Slow UI\nNo free tier\nPricey for SMBs",
    pricing: "$$$",
    features: "Dashboards\nFunnels\nCohorts\nSQL explorer",
  },
  {
    name: "Beta Insights",
    strengths: "Easy to use\nAffordable\nGreat docs",
    weaknesses: "Limited enterprise features\nFew integrations",
    pricing: "$",
    features: "Dashboards\nFunnels\nAlerts",
  },
];

const COMPETITOR_FIELDS: Array<{ key: keyof CompetitorInputs; label: string; multiline?: boolean }> = [
  { key: "name", label: "Name" },
  { key: "pricing", label: "Pricing ($, $$, $$$, $$$$ or text)" },
  { key: "strengths", label: "Strengths (one per line)", multiline: true },
  { key: "weaknesses", label: "Weaknesses (one per line)", multiline: true },
  { key: "features", label: "Key features (one per line)", multiline: true },
];

export default function AiCompetitorAnalysisFramework() {
  const [yourCompany, setYourCompany] = useState<CompetitorInputs>(EMPTY_COMP);
  const [competitors, setCompetitors] = useState<CompetitorInputs[]>([{ ...EMPTY_COMP }, { ...EMPTY_COMP }]);
  const [industry, setIndustry] = useState("");
  const [marketNotes, setMarketNotes] = useState("");
  const [xAxis, setXAxis] = useState<PositioningAxis>("price");
  const [yAxis, setYAxis] = useState<PositioningAxis>("quality");
  const [output, setOutput] = useState<AnalysisOutput | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<LlmEnhancement | null>(null);
  const [error, setError] = useState("");

  const inputs: AnalysisInputs = useMemo(
    () => ({ yourCompany, competitors, industry, marketNotes }),
    [yourCompany, competitors, industry, marketNotes],
  );

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem(LLM_KEY_STORAGE)
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.inputs.yourCompany) setYourCompany((prev) => ({ ...prev, ...p.inputs.yourCompany }));
      if (p.inputs.competitors && p.inputs.competitors.length > 0) setCompetitors(p.inputs.competitors);
      if (p.inputs.industry) setIndustry(p.inputs.industry);
      if (p.inputs.marketNotes) setMarketNotes(p.inputs.marketNotes);
      if (Object.keys(p.inputs).length > 0) toast.info("Loaded from share link");
    }
  }, []);

  const liveWarnings = useMemo(() => validateInputs(inputs), [inputs]);

  const handleGenerate = useCallback(() => {
    setError("");
    try {
      const out = generate(inputs, xAxis, yAxis);
      setOutput(out);
      setLlmResult(null);
      if (yourCompany.name || competitors.some((c) => c.name)) {
        saveHistory({
          ts: Date.now(),
          yourCompany: yourCompany.name || "(unnamed)",
          competitorCount: competitors.filter((c) => c.name && c.name.trim()).length,
          industry,
        });
        setHistory(loadHistory());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    }
  }, [inputs, yourCompany, competitors, industry, xAxis, yAxis]);

  const handleClear = useCallback(() => {
    setYourCompany(EMPTY_COMP);
    setCompetitors([{ ...EMPTY_COMP }, { ...EMPTY_COMP }]);
    setIndustry("");
    setMarketNotes("");
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
    setYourCompany(SAMPLE_YOUR);
    setCompetitors(SAMPLE_COMPS.map((c) => ({ ...c })));
    setIndustry("B2B product analytics SaaS");
    setMarketNotes("Market growing 18% YoY\nMid-market segment underserved\nConsolidation wave underway");
    toast.info("Sample inputs loaded");
  }, []);

  const handleAddCompetitor = useCallback(() => {
    setCompetitors((prev) => [...prev, { ...EMPTY_COMP }]);
  }, []);

  const handleRemoveCompetitor = useCallback((idx: number) => {
    setCompetitors((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleCompetitorChange = useCallback((idx: number, key: keyof CompetitorInputs, value: string) => {
    setCompetitors((prev) => prev.map((c, i) => (i === idx ? { ...c, [key]: value } : c)));
  }, []);

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
    if (!yourCompany.name.trim()) {
      toast.error("Enter at least your company name first");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    setLlmResult(null);
    try {
      const prompt = buildLlmPrompt(inputs);
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
  }, [llmKey, llmProvider, inputs, yourCompany]);

  const hasAnyInput = useMemo(() =>
    !!yourCompany.name.trim() ||
    competitors.some((c) => c.name.trim()) ||
    !!industry.trim(),
  [yourCompany, competitors, industry]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Your company */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-foreground">Your company</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {COMPETITOR_FIELDS.map((f) => (
                <div key={f.key} className={f.multiline ? "sm:col-span-2 space-y-1" : "space-y-1"}>
                  <Label htmlFor={`caf-y-${f.key}`} className="text-[11px]">{f.label}</Label>
                  {f.multiline ? (
                    <Textarea
                      id={`caf-y-${f.key}`}
                      value={yourCompany[f.key]}
                      onChange={(e) => setYourCompany((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={`e.g. ${FIELD_HINTS[f.key === "name" ? "competitorName" : f.key]?.sample ?? ""}`}
                      className="min-h-[60px] resize-y text-sm font-mono"
                    />
                  ) : (
                    <Input
                      id={`caf-y-${f.key}`}
                      value={yourCompany[f.key]}
                      onChange={(e) => setYourCompany((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={`e.g. ${f.key === "name" ? "UnQlytics" : FIELD_HINTS[f.key]?.sample ?? ""}`}
                      className="text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Industry & market notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="caf-ind" className="text-[11px]">Industry</Label>
              <Input
                id="caf-ind"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder={`e.g. ${FIELD_HINTS.industry.sample}`}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="caf-mkt" className="text-[11px]">Market notes (optional, one per line)</Label>
              <Textarea
                id="caf-mkt"
                value={marketNotes}
                onChange={(e) => setMarketNotes(e.target.value)}
                placeholder={`e.g. ${FIELD_HINTS.marketNotes.sample}`}
                className="min-h-[60px] resize-y text-sm"
              />
            </div>
          </div>

          {/* Competitors */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-foreground">Competitors ({competitors.length})</div>
              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={handleAddCompetitor}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add competitor
              </Button>
            </div>
            <div className="space-y-2">
              {competitors.map((c, idx) => (
                <div key={idx} className="rounded border p-2.5 space-y-2 bg-background">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground">#{idx + 1}</span>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleRemoveCompetitor(idx)} aria-label="Remove competitor">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {COMPETITOR_FIELDS.map((f) => (
                      <div key={f.key} className={f.multiline ? "sm:col-span-2 space-y-1" : "space-y-1"}>
                        <Label className="text-[10px]">{f.label}</Label>
                        {f.multiline ? (
                          <Textarea
                            value={c[f.key]}
                            onChange={(e) => handleCompetitorChange(idx, f.key, e.target.value)}
                            placeholder={FIELD_HINTS[f.key === "name" ? "competitorName" : f.key]?.sample ?? ""}
                            className="min-h-[50px] resize-y text-xs font-mono"
                          />
                        ) : (
                          <Input
                            value={c[f.key]}
                            onChange={(e) => handleCompetitorChange(idx, f.key, e.target.value)}
                            placeholder={f.key === "name" ? "Acme Analytics" : (FIELD_HINTS[f.key]?.sample ?? "")}
                            className="text-xs"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Axis selectors */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs">X axis</Label>
              <select
                value={xAxis}
                onChange={(e) => setXAxis(e.target.value as PositioningAxis)}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                {(Object.keys(AXIS_LABELS) as PositioningAxis[]).map((a) => (
                  <option key={a} value={a}>{AXIS_LABELS[a]}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs">Y axis</Label>
              <select
                value={yAxis}
                onChange={(e) => setYAxis(e.target.value as PositioningAxis)}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                {(Object.keys(AXIS_LABELS) as PositioningAxis[]).map((a) => (
                  <option key={a} value={a}>{AXIS_LABELS[a]}</option>
                ))}
              </select>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={handleLoadSample}>
              Load sample
            </Button>
          </div>

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

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleGenerate} disabled={!hasAnyInput} label="Generate analysis" />
            <DownloadButton
              getText={() => output ? renderMarkdown(output, inputs) : ""}
              filename="competitor-analysis.md"
              mime="text/markdown"
              label="Download .md"
              disabled={!output}
            />
            <DownloadButton
              getText={() => output ? renderJson(output, inputs) : ""}
              filename="competitor-analysis.json"
              mime="application/json"
              label="Download JSON"
              disabled={!output}
            />
            <ShareButton getUrl={() => buildShareUrl(inputs)} disabled={!hasAnyInput} />
            <ClearButton onClick={handleClear} disabled={!hasAnyInput && !output} />
          </div>
          {error && <ErrorBanner message={error} />}
        </CardContent>
      </Card>

      {output && (
        <>
          {/* SWOTs */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Compass className="h-4 w-4" /> SWOT ({output.swots.length})
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {output.swots.map((s, i) => (
                  <div key={i} className="rounded border bg-background p-3">
                    <div className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                      {s.name === inputs.yourCompany.name ? <Badge variant="default" className="text-[10px]">You</Badge> : null}
                      {s.name}
                    </div>
                    <SwotBlock label="Strengths" items={s.swot.strengths} color="text-emerald-700 dark:text-emerald-300" />
                    <SwotBlock label="Weaknesses" items={s.swot.weaknesses} color="text-red-700 dark:text-red-300" />
                    <SwotBlock label="Opportunities" items={s.swot.opportunities} color="text-blue-700 dark:text-blue-300" />
                    <SwotBlock label="Threats" items={s.swot.threats} color="text-amber-700 dark:text-amber-300" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Feature matrix */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Grid3x3 className="h-4 w-4" /> Feature / Pricing Matrix
              </h3>
              {output.featureMatrix.featureNames.length === 0 ? (
                <p className="text-xs text-muted-foreground">No features provided. Add features per company to populate the matrix.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="text-xs border-collapse">
                    <thead>
                      <tr>
                        <th className="border px-2 py-1 text-left bg-background">Company</th>
                        {output.featureMatrix.featureNames.map((f) => (
                          <th key={f} className="border px-2 py-1 text-left bg-background capitalize">{f}</th>
                        ))}
                        <th className="border px-2 py-1 text-left bg-background">Pricing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {output.featureMatrix.rows.map((r, i) => (
                        <tr key={i}>
                          <td className="border px-2 py-1 font-medium">
                            {r.competitor === yourCompany.name ? <Badge variant="default" className="mr-1 text-[10px]">You</Badge> : null}
                            {r.competitor}
                          </td>
                          {output.featureMatrix.featureNames.map((f) => (
                            <td key={f} className="border px-2 py-1 text-center">
                              {r.features[f] ? <span className="text-emerald-600 dark:text-emerald-400">✓</span> : <span className="text-muted-foreground">—</span>}
                            </td>
                          ))}
                          <td className="border px-2 py-1 font-mono">{r.pricing}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Porter */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Target className="h-4 w-4" /> Porter's Five Forces
              </h3>
              <div className="rounded border bg-primary/5 border-primary/30 p-2 text-xs">
                <Badge variant={output.porter.overallAttractiveness === "high" ? "default" : output.porter.overallAttractiveness === "medium" ? "outline" : "destructive"} className="mr-2 text-[10px]">
                  Attractiveness: {output.porter.overallAttractiveness}
                </Badge>
                <span className="text-muted-foreground">{output.porter.summary}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {output.porter.forces.map((f) => (
                  <div key={f.force} className="rounded border bg-background p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{PORTER_FORCE_LABELS[f.force]}</span>
                      <Badge
                        variant={f.level === "high" ? "destructive" : f.level === "medium" ? "outline" : "secondary"}
                        className="text-[10px]"
                      >
                        {FORCE_LEVEL_LABELS[f.level]}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{f.notes}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Positioning map */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Map className="h-4 w-4" /> Positioning Map
              </h3>
              <div className="text-[10px] text-muted-foreground">
                X: {AXIS_LABELS[output.positioningMap.xAxis]} · Y: {AXIS_LABELS[output.positioningMap.yAxis]}
              </div>
              <PositioningPlot map={output.positioningMap} />
              <div className="text-[11px] text-muted-foreground space-y-0.5">
                {output.positioningMap.points.map((p) => (
                  <div key={p.name}>
                    {p.isYou ? "★ " : "• "}<strong>{p.name}</strong>: ({p.x}, {p.y})
                  </div>
                ))}
              </div>
              {output.positioningMap.whiteSpace.length > 0 && (
                <div className="rounded border bg-blue-500/5 border-blue-500/30 p-2 text-[11px]">
                  <div className="font-medium mb-1 text-blue-700 dark:text-blue-300">White-space callouts (inferred)</div>
                  <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                    {output.positioningMap.whiteSpace.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* White space synthesis */}
          {output.whiteSpace.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> White-space opportunities ({output.whiteSpace.length})
                </h3>
                <div className="space-y-2">
                  {output.whiteSpace.map((w, i) => (
                    <div key={i} className="rounded border bg-background p-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge variant="outline" className="text-[10px]">{w.source}</Badge>
                        <span className="text-xs font-medium">{w.title}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{w.rationale}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* LLM result */}
          {llmResult && (
            <Card>
              <CardContent className="p-4 space-y-3 border-l-4 border-l-primary">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> LLM polish
                </h3>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Executive synthesis</div>
                  <p className="text-sm text-foreground leading-relaxed">{llmResult.polishedSummary || "(empty)"}</p>
                </div>
                {llmResult.polishedSwots.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Per-company SWOTs</div>
                    <ul className="text-xs space-y-1 list-disc pl-5">
                      {llmResult.polishedSwots.map((s, i) => (
                        <li key={i}>
                          <strong>{s.name}:</strong> opportunities = [{s.opportunities.join("; ")}], threats = [{s.threats.join("; ")}]
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {llmResult.polishedPorterNotes.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Porter notes</div>
                    <ul className="text-xs space-y-0.5 list-disc pl-5">
                      {llmResult.polishedPorterNotes.map((n, i) => <li key={i}>{n}</li>)}
                    </ul>
                  </div>
                )}
                {llmResult.whiteSpaceIdeas.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">White-space ideas</div>
                    <ul className="text-xs space-y-0.5 list-disc pl-5">
                      {llmResult.whiteSpaceIdeas.map((w, i) => <li key={i}>{w}</li>)}
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

          {/* LLM panel */}
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
                    For sharper synthesis than the templates produce. Your key is stored only in localStorage on this device. The request goes directly from your browser to the provider. The LLM is constrained to synthesize from your inputs — it cannot browse live competitor data.
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
          title="Enter your company and competitors to generate an analysis draft"
          hint="Four frameworks: SWOT, Feature/pricing matrix, Porter's Five Forces, positioning map. White-space opportunities cite the gaps they are based on. 100% client-side — your inputs never leave the browser."
          icon={<Microscope className="h-8 w-8" />}
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
                  <span className="font-medium">{h.yourCompany}</span>
                  <Badge variant="outline" className="mx-2 text-[10px]">{h.competitorCount} competitors</Badge>
                  {h.industry && <span className="text-muted-foreground">· {h.industry}</span>}
                  <div className="text-[10px] text-muted-foreground">{new Date(h.ts).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Honesty & privacy:</strong> The tool cannot browse or verify live competitor pricing or features — it structures and reasons over <em>the facts you provide</em> and flags anything it inferred. Analysis quality depends on your inputs. All generation runs locally in your browser; nothing is uploaded. The only network call is if you choose to paste your own LLM API key.
          </p>
        </CardContent>
      </Card>

      <span className="hidden" aria-hidden="true">{HISTORY_MAX}{HISTORY_KEY}</span>
    </div>
  );
}

function SwotBlock({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div className="mb-1.5">
      <div className={`text-[10px] font-medium ${color}`}>{label}</div>
      <ul className="text-[11px] text-foreground list-disc pl-5 space-y-0">
        {items.length === 0 ? <li className="text-muted-foreground">(none)</li> : items.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    </div>
  );
}

function PositioningPlot({ map }: { map: { points: Array<{ name: string; x: number; y: number; isYou: boolean }>; xAxis: PositioningAxis; yAxis: PositioningAxis } }) {
  const W = 320;
  const H = 240;
  const pad = 32;
  const xScale = (v: number) => pad + (v / 100) * (W - pad * 2);
  const yScale = (v: number) => H - pad - (v / 100) * (H - pad * 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md h-auto border rounded bg-background">
      {/* Axes */}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} className="stroke-border" strokeWidth="1" />
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} className="stroke-border" strokeWidth="1" />
      {/* Grid midlines */}
      <line x1={pad} y1={(H) / 2} x2={W - pad} y2={(H) / 2} className="stroke-border" strokeWidth="0.5" strokeDasharray="2 2" />
      <line x1={(W) / 2} y1={pad} x2={(W) / 2} y2={H - pad} className="stroke-border" strokeWidth="0.5" strokeDasharray="2 2" />
      {/* Labels */}
      <text x={W / 2} y={H - 8} className="fill-muted-foreground" fontSize="9" textAnchor="middle">
        {AXIS_LABELS[map.xAxis].split("(")[0].trim()}
      </text>
      <text x={10} y={H / 2} className="fill-muted-foreground" fontSize="9" textAnchor="middle" transform={`rotate(-90 10 ${H / 2})`}>
        {AXIS_LABELS[map.yAxis].split("(")[0].trim()}
      </text>
      {/* Points */}
      {map.points.map((p) => (
        <g key={p.name}>
          <circle
            cx={xScale(p.x)}
            cy={yScale(p.y)}
            r={p.isYou ? 5 : 4}
            className={p.isYou ? "fill-primary" : "fill-muted-foreground"}
          />
          <text
            x={xScale(p.x) + 6}
            y={yScale(p.y) - 6}
            className={p.isYou ? "fill-primary" : "fill-foreground"}
            fontSize="9"
          >
            {p.name}{p.isYou ? " ★" : ""}
          </text>
        </g>
      ))}
    </svg>
  );
}
