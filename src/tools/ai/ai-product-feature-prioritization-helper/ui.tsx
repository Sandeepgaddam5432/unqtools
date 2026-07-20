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
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  ListTodo, History, Key, Sparkles, AlertTriangle, Plus, Trash2,
  ChevronUp, ChevronDown, BarChart3, Activity,
} from "lucide-react";
import {
  HISTORY_MAX,
  FRAMEWORKS,
  IMPACT_VALUES,
  CONFIDENCE_PRESETS,
  MOSCOW_CATEGORIES,
  MOSCOW_RANK,
  SENSITIVITY_FIELDS,
  HONESTY_NOTES,
  SAMPLE_BACKLOGS,
  DEFAULT_FEATURE,
  createFeature,
  newFeatureId,
  clampNum,
  validateFeature,
  rankFeatures,
  sortScored,
  computeStats,
  sensitivityAnalysis,
  renderCsv,
  renderMarkdown,
  buildLlmPrompt,
  renderLlmResult,
  applyLlmDraft,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Feature,
  type Framework,
  type Impact,
  type MoscowCategory,
  type SortKey,
  type SortDir,
} from "./logic";

const MOSCOW_COLORS: Record<MoscowCategory, string> = {
  must: "bg-red-500/15 text-red-700 dark:text-red-300",
  should: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  could: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  wont: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
};

export default function AiProductFeaturePrioritizationHelper() {
  const [features, setFeatures] = useState<Feature[]>(SAMPLE_BACKLOGS[0].features.map((f) => ({ ...f, id: newFeatureId() })));
  const [framework, setFramework] = useState<Framework>("rice");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [history, setHistory] = useState<ReturnType<typeof loadHistory>>([]);
  const [showLlm, setShowLlm] = useState<string | null>(null); // feature id
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<{ id: string; reach: number | null; impact: Impact | null; confidence: number | null; effort: number | null; rationale: string; warnings: string[] } | null>(null);
  const [sensitivityField, setSensitivityField] = useState<"reach" | "impact" | "confidence" | "effort">("reach");
  const [sensitivityValues, setSensitivityValues] = useState("100, 1000, 5000, 10000");

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-product-feature-prioritization-helper:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.features.length > 0) {
        setFeatures(parsed.features);
        setFramework(parsed.framework);
        toast.info(`Loaded ${parsed.features.length} features from share link`);
      }
    }
  }, []);

  const scored = useMemo(() => rankFeatures(features, framework), [features, framework]);
  const sorted = useMemo(() => sortScored(scored, sortKey, sortDir), [scored, sortKey, sortDir]);
  const stats = useMemo(() => computeStats(features, framework), [features, framework]);
  const activeFormula = useMemo(() => FRAMEWORKS.find((f) => f.value === framework)!.formula, [framework]);

  const sensitivity = useMemo(() => {
    const values = sensitivityValues
      .split(/[,\s]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n) && n > 0);
    if (values.length === 0) return null;
    return sensitivityAnalysis(features, framework, sensitivityField, values);
  }, [features, framework, sensitivityField, sensitivityValues]);

  const csv = useMemo(() => renderCsv(features, framework), [features, framework]);
  const markdown = useMemo(() => renderMarkdown(features, framework), [features, framework]);

  const updateFeature = useCallback((id: string, patch: Partial<Feature>) => {
    setFeatures((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const handleAddFeature = useCallback(() => {
    setFeatures((prev) => [...prev, createFeature(`New feature ${prev.length + 1}`, "")]);
  }, []);

  const handleRemoveFeature = useCallback((id: string) => {
    setFeatures((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleLoadSample = useCallback((idx: number) => {
    const sample = SAMPLE_BACKLOGS[idx];
    setFeatures(sample.features.map((f) => ({ ...f, id: newFeatureId() })));
    toast.info(`Loaded: ${sample.label}`);
  }, []);

  const handleClear = useCallback(() => {
    setFeatures([]);
    setLlmError("");
    setLlmResult(null);
    toast.info("Cleared backlog");
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }, [sortKey]);

  const handleSaveHistory = useCallback(() => {
    if (features.length === 0) return;
    saveHistory({
      ts: Date.now(),
      framework,
      featureCount: features.length,
      topFeature: stats.topFeature,
      avgRice: stats.avgRice,
    });
    setHistory(loadHistory());
  }, [features.length, framework, stats.topFeature, stats.avgRice]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleEnhanceWithLlm = useCallback(async (feature: Feature) => {
    if (!llmKey) {
      setLlmError("Enter an API key first.");
      return;
    }
    if (!feature.name.trim()) {
      setLlmError("Feature name is required.");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("unqtools:ai-product-feature-prioritization-helper:llm-key", llmKey);
      }
      const prompt = buildLlmPrompt(feature);
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
            { role: "system", content: "You are a senior product manager." },
            { role: "user", content: prompt },
          ],
          max_tokens: 300,
          temperature: 0.4,
        })
        : JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 300,
          system: "You are a senior product manager.",
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
      const parsed = renderLlmResult(out);
      setLlmResult({ id: feature.id, ...parsed });
      if (parsed.warnings.length > 0) {
        toast.warning(`LLM parsed with ${parsed.warnings.length} warning(s)`);
      } else {
        toast.success("LLM draft ready — review and apply");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setLlmError(msg);
      toast.error("LLM assist failed");
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider]);

  const handleApplyLlmDraft = useCallback((feature: Feature) => {
    if (!llmResult || llmResult.id !== feature.id) return;
    const updated = applyLlmDraft(feature, llmResult);
    updateFeature(feature.id, {
      reach: updated.reach,
      impact: updated.impact,
      confidence: updated.confidence,
      effort: updated.effort,
    });
    toast.success("Draft applied — review the scores");
    setLlmResult(null);
    setShowLlm(null);
  }, [llmResult, updateFeature]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Framework tabs */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ListTodo className="h-4 w-4" /> Framework
            </h3>
            <div className="flex flex-wrap gap-1">
              {FRAMEWORKS.map((f) => (
                <Button
                  key={f.value}
                  size="sm"
                  variant={framework === f.value ? "default" : "outline"}
                  className="h-7 text-[11px]"
                  onClick={() => { setFramework(f.value); setSortKey("rank"); setSortDir("asc"); }}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="rounded border bg-muted/40 px-3 py-2 text-xs font-mono text-muted-foreground">
            <span className="text-foreground font-semibold">{framework.toUpperCase()}:</span> {activeFormula}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_BACKLOGS.map((s, i) => (
              <Button key={i} variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => handleLoadSample(i)}>
                + {s.label}
              </Button>
            ))}
            <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={handleAddFeature}>
              <Plus className="h-3 w-3 mr-1" /> Add feature
            </Button>
            {features.length > 0 && (
              <ClearButton onClick={handleClear} label="Clear all" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Backlog table */}
      {features.length === 0 ? (
        <EmptyState
          title="Add features to your backlog"
          hint="Click '+ Add feature' or load a sample backlog. For each feature, enter Reach (people affected per period), Impact (0.25–3), Confidence (0–100%), and Effort (person-weeks). The tool auto-ranks by RICE / ICE / WSJF / MoSCoW."
          icon={<ListTodo className="h-8 w-8" />}
        />
      ) : (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground border-b">
                    <Th label="#" sortKey="rank" current={sortKey} dir={sortDir} onClick={handleSort} className="w-8" />
                    <Th label="Name" sortKey="name" current={sortKey} dir={sortDir} onClick={handleSort} />
                    <Th label="Reach" sortKey="reach" current={sortKey} dir={sortDir} onClick={handleSort} className="w-20" />
                    <Th label="Impact" sortKey="impact" current={sortKey} dir={sortDir} onClick={handleSort} className="w-24" />
                    <Th label="Conf%" sortKey="confidence" current={sortKey} dir={sortDir} onClick={handleSort} className="w-20" />
                    <Th label="Effort" sortKey="effort" current={sortKey} dir={sortDir} onClick={handleSort} className="w-20" />
                    <th className="px-2 py-1 w-20">MoSCoW</th>
                    <Th label="RICE" sortKey="rice" current={sortKey} dir={sortDir} onClick={handleSort} className="w-16 text-right" />
                    <Th label="ICE" sortKey="ice" current={sortKey} dir={sortDir} onClick={handleSort} className="w-16 text-right" />
                    <Th label="WSJF" sortKey="wsjf" current={sortKey} dir={sortDir} onClick={handleSort} className="w-16 text-right" />
                    <th className="px-1 py-1 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s) => (
                    <FeatureRow
                      key={s.feature.id}
                      scored={s}
                      framework={framework}
                      onChange={(patch) => updateFeature(s.feature.id, patch)}
                      onRemove={() => handleRemoveFeature(s.feature.id)}
                      onLlmAssist={() => {
                        setShowLlm(s.feature.id);
                        setLlmResult(null);
                        setLlmError("");
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <CopyButton getText={() => { handleSaveHistory(); return csv; }} label="Copy CSV" />
              <DownloadButton
                getText={() => { handleSaveHistory(); return csv; }}
                filename="feature-prioritization.csv"
                mime="text/csv"
                label="Download CSV"
              />
              <DownloadButton
                getText={() => markdown}
                filename="feature-prioritization.md"
                mime="text/markdown"
                label="Download .md"
              />
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(features, framework); }} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {features.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" /> Aggregate stats
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Features" value={stats.count} />
              <Stat label="Avg RICE" value={stats.avgRice} />
              <Stat label="Avg ICE" value={stats.avgIce} />
              <Stat label="Avg WSJF" value={stats.avgWsjf} />
              <Stat label="Total effort" value={`${stats.totalEffort}pw`} />
              <Stat label="Top feature" value={stats.topFeature ?? "—"} />
              <Stat label="Bottom feature" value={stats.bottomFeature ?? "—"} />
              <Stat label="Must-have" value={stats.mustCount} highlight={stats.mustCount > 0 ? "bad" : undefined} />
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant="outline" className={`${MOSCOW_COLORS.must} text-[10px] border-0`}>Must: {stats.mustCount}</Badge>
              <Badge variant="outline" className={`${MOSCOW_COLORS.should} text-[10px] border-0`}>Should: {stats.shouldCount}</Badge>
              <Badge variant="outline" className={`${MOSCOW_COLORS.could} text-[10px] border-0`}>Could: {stats.couldCount}</Badge>
              <Badge variant="outline" className={`${MOSCOW_COLORS.wont} text-[10px] border-0`}>Won't: {stats.wontCount}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sensitivity analysis */}
      {features.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Activity className="h-4 w-4" /> Sensitivity analysis
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Vary one RICE field across a range and see whether rank order changes. Sensitive rankings need more careful input estimates.
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              <select
                value={sensitivityField}
                onChange={(e) => setSensitivityField(e.target.value as "reach" | "impact" | "confidence" | "effort")}
                className="h-9 text-xs rounded border bg-background px-2"
              >
                {SENSITIVITY_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <Input
                value={sensitivityValues}
                onChange={(e) => setSensitivityValues(e.target.value)}
                placeholder="100, 1000, 5000, 10000"
                className="font-mono text-xs"
              />
            </div>
            {sensitivity && (
              <div className="space-y-1 pt-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Base rank order: {sensitivity.baseRankOrder.join(" → ") || "(empty)"}
                </div>
                {sensitivity.variations.map((v, i) => (
                  <div
                    key={i}
                    className={`rounded border px-3 py-1.5 text-xs ${v.changed ? "border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800" : "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800"}`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{sensitivityField} = {v.value}</Badge>
                      <Badge variant="outline" className={`text-[10px] ${v.changed ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                        {v.changed ? "rank order changed" : "stable"}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {v.rankOrder.join(" → ")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* LLM assist modal/inline */}
      {showLlm && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> AI-assist: draft R/I/C/E
              </h3>
              <Button variant="ghost" size="sm" onClick={() => { setShowLlm(null); setLlmResult(null); }}>Close</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Feature: <span className="font-mono text-foreground">{features.find((f) => f.id === showLlm)?.name ?? ""}</span>
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                className="h-9 text-xs rounded border bg-background px-2"
              >
                <option value="openai">OpenAI (gpt-4o-mini)</option>
                <option value="anthropic">Anthropic (claude-3-5-haiku)</option>
              </select>
              <Input
                type="password"
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder="Paste API key (stored locally)"
                className="font-mono text-xs"
              />
            </div>
            <Button
              size="sm"
              onClick={() => {
                const f = features.find((x) => x.id === showLlm);
                if (f) handleEnhanceWithLlm(f);
              }}
              disabled={llmLoading || !llmKey}
            >
              {llmLoading ? "Working…" : "Draft scores"}
            </Button>
            {llmError && <ErrorBanner message={llmError} />}
            {llmResult && llmResult.id === showLlm && (
              <div className="space-y-2 pt-2 border-t">
                <div className="text-xs font-semibold text-foreground">LLM draft:</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Reach" value={llmResult.reach ?? "—"} />
                  <Stat label="Impact" value={llmResult.impact ?? "—"} />
                  <Stat label="Conf%" value={llmResult.confidence ?? "—"} />
                  <Stat label="Effort" value={llmResult.effort ?? "—"} />
                </div>
                {llmResult.rationale && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Rationale:</span> {llmResult.rationale}
                  </div>
                )}
                {llmResult.warnings.length > 0 && (
                  <ul className="text-xs text-amber-700 dark:text-amber-300 list-disc pl-5 space-y-0.5">
                    {llmResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                )}
                <Button
                  size="sm"
                  onClick={() => {
                    const f = features.find((x) => x.id === showLlm);
                    if (f) handleApplyLlmDraft(f);
                  }}
                >
                  Apply draft
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length}/{HISTORY_MAX})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{h.framework.toUpperCase()}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.featureCount} features</Badge>
                    <Badge variant="outline" className="text-[10px]">avg RICE {h.avgRice}</Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  {h.topFeature && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">Top: {h.topFeature}</div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Honesty notes */}
      <Card>
        <CardContent className="p-3 space-y-1">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Honesty notes
          </h4>
          <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
            {HONESTY_NOTES.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function FeatureRow({
  scored,
  framework,
  onChange,
  onRemove,
  onLlmAssist,
}: {
  scored: ReturnType<typeof rankFeatures>[number];
  framework: Framework;
  onChange: (patch: Partial<Feature>) => void;
  onRemove: () => void;
  onLlmAssist: () => void;
}) {
  const f = scored.feature;
  const errors = validateFeature(f);
  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/30">
      <td className="px-2 py-1.5 text-center">
        <Badge variant={scored.rank <= 3 ? "default" : "outline"} className="text-[10px]">
          #{scored.rank}
        </Badge>
      </td>
      <td className="px-2 py-1.5">
        <Input
          value={f.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="h-7 text-xs font-mono"
          placeholder="Feature name"
        />
        {errors.some((e) => e.includes("Name")) && (
          <span className="text-[10px] text-red-600 dark:text-red-400">Name required</span>
        )}
      </td>
      <td className="px-2 py-1.5">
        <Input
          type="number"
          value={f.reach}
          onChange={(e) => onChange({ reach: Number(e.target.value) || 0 })}
          className="h-7 text-xs font-mono"
          min={0}
        />
      </td>
      <td className="px-2 py-1.5">
        <select
          value={f.impact}
          onChange={(e) => onChange({ impact: Number(e.target.value) as Impact })}
          className="h-7 w-full text-xs rounded border bg-background px-1"
        >
          {IMPACT_VALUES.map((i) => <option key={i.value} value={i.value}>{i.value}</option>)}
        </select>
      </td>
      <td className="px-2 py-1.5">
        <select
          value={f.confidence}
          onChange={(e) => onChange({ confidence: Number(e.target.value) })}
          className="h-7 w-full text-xs rounded border bg-background px-1"
        >
          {CONFIDENCE_PRESETS.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value={f.confidence}>{f.confidence}% (custom)</option>
        </select>
      </td>
      <td className="px-2 py-1.5">
        <Input
          type="number"
          value={f.effort}
          onChange={(e) => onChange({ effort: Number(e.target.value) || 0 })}
          className="h-7 text-xs font-mono"
          min={0}
          step="0.5"
        />
      </td>
      <td className="px-2 py-1.5">
        <select
          value={f.moscow}
          onChange={(e) => onChange({ moscow: e.target.value as MoscowCategory })}
          className={`h-7 w-full text-[10px] rounded px-1 ${MOSCOW_COLORS[f.moscow]}`}
        >
          {MOSCOW_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </td>
      <td className="px-2 py-1.5 text-right font-mono text-xs">{scored.rice}</td>
      <td className="px-2 py-1.5 text-right font-mono text-xs">{scored.ice}</td>
      <td className="px-2 py-1.5 text-right font-mono text-xs">{scored.wsjf}</td>
      <td className="px-1 py-1.5">
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onLlmAssist} title="AI-assist draft">
            <Sparkles className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600 dark:text-red-400" onClick={onRemove} title="Remove">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function Th({
  label,
  sortKey,
  current,
  dir,
  onClick,
  className,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  className?: string;
}) {
  const isCurrent = current === sortKey;
  return (
    <th
      className={`px-2 py-1 cursor-pointer select-none ${className ?? ""}`}
      onClick={() => onClick(sortKey)}
    >
      <span className={`inline-flex items-center gap-0.5 ${isCurrent ? "text-foreground font-semibold" : ""}`}>
        {label}
        {isCurrent && (dir === "asc"
          ? <ChevronUp className="h-3 w-3" />
          : <ChevronDown className="h-3 w-3" />)}
      </span>
    </th>
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
      <div className={`text-sm font-semibold truncate ${color}`} title={String(value)}>{value}</div>
    </div>
  );
}

// Suppress unused-import lint
export type _Unused = typeof MOSCOW_RANK | typeof clampNum | typeof DEFAULT_FEATURE;
