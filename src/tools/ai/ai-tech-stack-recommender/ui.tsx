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
  HISTORY_MAX,
  PRODUCT_TYPE_LABELS,
  TEAM_SIZE_LABELS,
  TIMELINE_LABELS,
  SCALE_LABELS,
  BUDGET_LABELS,
  COMPLIANCE_LABELS,
  SKILL_LABELS,
  DEFAULT_WEIGHTS,
  DEFAULT_PROFILE,
  PRODUCT_TYPE_PRESETS,
  clamp,
  parseSkills,
  validateProfile,
  recommend,
  compareStacks,
  renderAdr,
  renderText,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type ProductProfile,
  type ProductType,
  type TeamSize,
  type Timeline,
  type Scale,
  type Budget,
  type Compliance,
  type Skill,
  type ScoreWeights,
  type Recommendation,
  type StackCandidate,
  type LayerKey,
  type HistoryEntry,
} from "./logic";
import {
  Layers, History, Key, Sparkles, Star, Scale as ScaleIcon,
  GitCompareArrows, FileText, Lightbulb, TrendingUp,
} from "lucide-react";

const PRODUCT_TYPE_KEYS = Object.keys(PRODUCT_TYPE_LABELS) as ProductType[];
const TEAM_SIZE_KEYS = Object.keys(TEAM_SIZE_LABELS) as TeamSize[];
const TIMELINE_KEYS = Object.keys(TIMELINE_LABELS) as Timeline[];
const SCALE_KEYS = Object.keys(SCALE_LABELS) as Scale[];
const BUDGET_KEYS = Object.keys(BUDGET_LABELS) as Budget[];
const COMPLIANCE_KEYS = Object.keys(COMPLIANCE_LABELS) as Compliance[];
const SKILL_KEYS = Object.keys(SKILL_LABELS) as Skill[];
const LAYER_KEYS: LayerKey[] = ["frontend", "backend", "database", "hosting", "auth"];
const LAYER_LABELS: Record<LayerKey, string> = {
  frontend: "Frontend",
  backend: "Backend",
  database: "Database",
  hosting: "Hosting",
  auth: "Auth",
};

export default function AiTechStackRecommender() {
  const [profile, setProfile] = useState<ProductProfile>({ ...DEFAULT_PROFILE });
  const [weights, setWeights] = useState<ScoreWeights>({ ...DEFAULT_WEIGHTS });
  const [skillsText, setSkillsText] = useState<string>(DEFAULT_PROFILE.skills.join(", "));
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [error, setError] = useState<string>("");
  const [compareLeft, setCompareLeft] = useState<string>("");
  const [compareRight, setCompareRight] = useState<string>("");

  // LLM
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic" | "openrouter">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmOutput, setLlmOutput] = useState<string>("");

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      const merged: ProductProfile = { ...DEFAULT_PROFILE };
      if (p.profile) Object.assign(merged, p.profile);
      if (p.weights) {
        const w: ScoreWeights = { ...DEFAULT_WEIGHTS, ...p.weights };
        setWeights(w);
      }
      if (p.profile?.skills) setSkillsText((p.profile.skills as Skill[]).join(", "));
      setProfile(merged);
      if (p.profile && Object.keys(p.profile).length > 0) {
        toast.info("Loaded profile from share link");
      }
    }
  }, []);

  const updateProfile = useCallback(<K extends keyof ProductProfile>(key: K, value: ProductProfile[K]) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateWeight = useCallback((key: keyof ScoreWeights, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: clamp(value, 0, 1) }));
  }, []);

  const weightSum = useMemo(() => {
    return weights.hiring + weights.shiptime + weights.scale + weights.cost + weights.ecosystem;
  }, [weights]);

  const allCandidates = useMemo<StackCandidate[]>(() => {
    if (!rec) return [];
    return [rec.primary, ...rec.alternatives];
  }, [rec]);

  const comparison = useMemo(() => {
    if (!compareLeft || !compareRight || compareLeft === compareRight) return null;
    const left = allCandidates.find((c) => c.id === compareLeft);
    const right = allCandidates.find((c) => c.id === compareRight);
    if (!left || !right) return null;
    return compareStacks(left, right);
  }, [compareLeft, compareRight, allCandidates]);

  const handleGenerate = useCallback(() => {
    setError("");
    const skills = parseSkills(skillsText);
    const profileWithSkills: ProductProfile = { ...profile, skills };
    const errs = validateProfile(profileWithSkills);
    if (errs.length > 0) {
      setError(errs.join(" "));
      toast.error("Please complete all required fields");
      return;
    }
    if (Math.abs(weightSum - 1) > 0.05) {
      toast.warning(`Weights sum to ${weightSum.toFixed(2)} (expected ~1.0) — scorecard will still compute`);
    }
    const r = recommend(profileWithSkills, weights);
    setRec(r);
    setHasGenerated(true);
    setCompareLeft(r.primary.id);
    setCompareRight(r.alternatives[0]?.id ?? "");
    saveHistory({
      ts: Date.now(),
      productType: profileWithSkills.productType,
      teamSize: profileWithSkills.teamSize,
      primaryStackId: r.primary.id,
      primaryStackName: r.primary.name,
      totalScore: r.primary.totalScore,
    });
    setHistory(loadHistory());
    toast.success(`Recommended: ${r.primary.name} (${r.primary.totalScore.toFixed(2)} / 10)`);
  }, [profile, skillsText, weights, weightSum]);

  const handleLlmEnhance = useCallback(async () => {
    if (!rec) {
      toast.error("Generate a recommendation first");
      return;
    }
    if (!llmKey) {
      toast.error("Paste an API key first");
      return;
    }
    setLlmLoading(true);
    try {
      const prompt = buildLlmPrompt(profile, rec.primary);
      const text = await callLlm(llmProvider, llmKey, prompt.system, prompt.user);
      setLlmOutput(renderLlmResult(text));
      toast.success("LLM rationale generated");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`LLM call failed: ${msg}`);
    } finally {
      setLlmLoading(false);
    }
  }, [rec, profile, llmKey, llmProvider]);

  const handlePreset = useCallback((preset: typeof PRODUCT_TYPE_PRESETS[number]) => {
    const merged: ProductProfile = { ...DEFAULT_PROFILE, ...preset.profile };
    setProfile(merged);
    if (preset.profile.skills) setSkillsText((preset.profile.skills as Skill[]).join(", "));
    toast.info(`Applied preset: ${preset.label}`);
  }, []);

  const handleClear = useCallback(() => {
    setProfile({ ...DEFAULT_PROFILE });
    setWeights({ ...DEFAULT_WEIGHTS });
    setSkillsText(DEFAULT_PROFILE.skills.join(", "));
    setRec(null);
    setHasGenerated(false);
    setError("");
    setLlmOutput("");
    setCompareLeft("");
    setCompareRight("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="text-xs">Quick presets</Label>
            <div className="flex flex-wrap gap-1">
              {PRODUCT_TYPE_PRESETS.map((p) => (
                <Button key={p.label} variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => handlePreset(p)}>
                  + {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Product type">
              <select
                value={profile.productType}
                onChange={(e) => updateProfile("productType", e.target.value as ProductType)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {PRODUCT_TYPE_KEYS.map((k) => (
                  <option key={k} value={k}>{PRODUCT_TYPE_LABELS[k]}</option>
                ))}
              </select>
            </Field>
            <Field label="Team size">
              <select
                value={profile.teamSize}
                onChange={(e) => updateProfile("teamSize", e.target.value as TeamSize)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {TEAM_SIZE_KEYS.map((k) => (
                  <option key={k} value={k}>{TEAM_SIZE_LABELS[k]}</option>
                ))}
              </select>
            </Field>
            <Field label="Timeline">
              <select
                value={profile.timeline}
                onChange={(e) => updateProfile("timeline", e.target.value as Timeline)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {TIMELINE_KEYS.map((k) => (
                  <option key={k} value={k}>{TIMELINE_LABELS[k]}</option>
                ))}
              </select>
            </Field>
            <Field label="Expected scale">
              <select
                value={profile.scale}
                onChange={(e) => updateProfile("scale", e.target.value as Scale)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {SCALE_KEYS.map((k) => (
                  <option key={k} value={k}>{SCALE_LABELS[k]}</option>
                ))}
              </select>
            </Field>
            <Field label="Budget">
              <select
                value={profile.budget}
                onChange={(e) => updateProfile("budget", e.target.value as Budget)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {BUDGET_KEYS.map((k) => (
                  <option key={k} value={k}>{BUDGET_LABELS[k]}</option>
                ))}
              </select>
            </Field>
            <Field label="Compliance">
              <select
                value={profile.compliance}
                onChange={(e) => updateProfile("compliance", e.target.value as Compliance)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {COMPLIANCE_KEYS.map((k) => (
                  <option key={k} value={k}>{COMPLIANCE_LABELS[k]}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={`Team skills (comma or space separated — valid: ${SKILL_KEYS.join(", ")})`}>
            <Input
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              placeholder="typescript, javascript"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <ToggleCheck label="Must run offline / on-prem" checked={profile.offline} onChange={(v) => updateProfile("offline", v)} />
            <ToggleCheck label="Realtime collab required" checked={profile.realtime} onChange={(v) => updateProfile("realtime", v)} />
            <ToggleCheck label="SEO is critical" checked={profile.seoCritical} onChange={(v) => updateProfile("seoCritical", v)} />
          </div>

          <div className="rounded border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5"><ScaleIcon className="h-3.5 w-3.5" /> Scorecard weights</Label>
              <Badge variant="outline" className="text-[10px]">sum = {weightSum.toFixed(2)}</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <WeightSlider label="Hiring" value={weights.hiring} onChange={(v) => updateWeight("hiring", v)} />
              <WeightSlider label="Ship time" value={weights.shiptime} onChange={(v) => updateWeight("shiptime", v)} />
              <WeightSlider label="Scale" value={weights.scale} onChange={(v) => updateWeight("scale", v)} />
              <WeightSlider label="Cost" value={weights.cost} onChange={(v) => updateWeight("cost", v)} />
              <WeightSlider label="Ecosystem" value={weights.ecosystem} onChange={(v) => updateWeight("ecosystem", v)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleGenerate} label="Recommend stack" />
            <ShareButton getUrl={() => buildShareUrl(profile, weights)} />
            <ClearButton onClick={handleClear} />
          </div>
          {error && <ErrorBanner message={error} />}
        </CardContent>
      </Card>

      {hasGenerated && rec ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  Recommended: {rec.primary.name}
                </h3>
                <div className="flex items-center gap-2">
                  <Badge className="text-[10px]">{rec.primary.totalScore.toFixed(2)} / 10</Badge>
                  <Badge variant="outline" className="text-[10px]">{rec.primary.stars}★</Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{rec.primary.summary}</p>

              <div className="space-y-2">
                {LAYER_KEYS.map((layer) => {
                  const c = rec.primary.choices[layer];
                  return (
                    <div key={layer} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{LAYER_LABELS[layer]}: <span className="text-primary">{c.name}</span></span>
                        <Badge variant="outline" className="text-[10px]">{c.category}</Badge>
                      </div>
                      <p className="text-muted-foreground">Why: {c.rationale}</p>
                      <p className="text-muted-foreground"><span className="text-foreground">Alternative:</span> {c.alternative}</p>
                      {c.costEstimate && (
                        <p className="text-muted-foreground"><span className="text-foreground">Cost:</span> {c.costEstimate}</p>
                      )}
                      {c.scaleCeiling && (
                        <p className="text-muted-foreground"><span className="text-foreground">Scale:</span> {c.scaleCeiling}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="rounded border bg-muted/30 p-3 space-y-1">
                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Scorecard</div>
                {rec.primary.scores.map((s) => (
                  <div key={s.key} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="font-mono text-foreground">
                      {s.rawScore.toFixed(1)} × {(s.weight * 100).toFixed(0)}% = <span className="text-primary font-semibold">{s.weightedScore.toFixed(2)}</span>
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
                  <span className="text-foreground font-semibold">Total</span>
                  <span className="font-mono text-primary font-bold">{rec.primary.totalScore.toFixed(2)} / 10</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => renderText(rec)} label="Copy summary" />
                <DownloadButton getText={() => renderAdr(rec)} filename="tech-stack-adr.md" mime="text/markdown" label="Download ADR (.md)" />
                <DownloadButton getText={() => renderJson(rec)} filename="tech-stack.json" mime="application/json" label="Download JSON" />
              </div>
            </CardContent>
          </Card>

          {rec.alternatives.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="h-4 w-4" /> Alternatives considered ({rec.alternatives.length})
                </h3>
                <div className="space-y-1">
                  {rec.alternatives.map((alt) => (
                    <div key={alt.id} className="rounded border bg-background px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{alt.name}</span>
                        <Badge variant="outline" className="text-[10px]">{alt.totalScore.toFixed(2)} / 10 · {alt.stars}★</Badge>
                      </div>
                      <p className="text-muted-foreground mt-0.5">{alt.summary}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <GitCompareArrows className="h-4 w-4" /> Side-by-side comparison
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={compareLeft}
                  onChange={(e) => setCompareLeft(e.target.value)}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="">Pick stack A…</option>
                  {allCandidates.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select
                  value={compareRight}
                  onChange={(e) => setCompareRight(e.target.value)}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="">Pick stack B…</option>
                  {allCandidates.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {comparison && (
                <div className="space-y-1 text-xs">
                  {comparison.deltas.map((d) => {
                    const color = d.winner === "tie"
                      ? "text-muted-foreground"
                      : d.winner === "left"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-amber-700 dark:text-amber-400";
                    const sign = d.delta > 0 ? "+" : "";
                    return (
                      <div key={d.axis} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{d.label}</span>
                        <span className={`font-mono ${color}`}>{sign}{d.delta.toFixed(2)}</span>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    <span className="text-foreground font-semibold">Overall winner</span>
                    <Badge variant="outline" className="text-[10px]">
                      {comparison.overallWinner === "tie"
                        ? "Tie"
                        : comparison.overallWinner === "left"
                          ? comparison.left.name
                          : comparison.right.name}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Lightbulb className="h-4 w-4" /> Honesty notes
              </h3>
              <ul className="space-y-1 text-xs">
                {rec.honestyNotes.map((n, i) => (
                  <li key={i} className="flex items-start gap-2 text-muted-foreground">
                    <span className="text-foreground">•</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Key className="h-4 w-4" /> Optional: Enhance with BYO-key LLM
              </h3>
              <p className="text-xs text-muted-foreground">
                Paste your own API key (OpenAI / Anthropic / OpenRouter) to ask an LLM for a 1-paragraph rationale + parallel prototype suggestion. Key stays in your browser.
              </p>
              <div className="flex flex-wrap gap-2">
                <select
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic" | "openrouter")}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
                <Input
                  type="password"
                  value={llmKey}
                  onChange={(e) => setLlmKey(e.target.value)}
                  placeholder="sk-..."
                  className="h-8 text-xs flex-1 min-w-[200px]"
                />
                <Button size="sm" onClick={handleLlmEnhance} disabled={llmLoading} className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  {llmLoading ? "Working…" : "Enhance with LLM"}
                </Button>
              </div>
              {llmOutput && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">LLM rationale</span>
                    <CopyButton getText={() => llmOutput} label="Copy" size="sm" />
                    <DownloadButton getText={() => llmOutput} filename="tech-stack-llm.md" label="Download" size="sm" mime="text/markdown" />
                  </div>
                  <pre className="bg-muted/50 dark:bg-muted/20 rounded p-3 text-[11px] whitespace-pre-wrap max-h-[400px] overflow-auto">
                    {llmOutput}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Get an opinionated tech-stack recommendation"
          hint="Answer 7 questions about your product, team, and constraints. The rule engine picks a stack (frontend / backend / DB / hosting / auth), scores it on 5 axes with weights you can adjust, explains every choice, and offers 2–3 alternatives. Export as Markdown ADR."
          icon={<Layers className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{PRODUCT_TYPE_LABELS[h.productType]}</Badge>
                  <Badge variant="outline" className="mr-2">{TEAM_SIZE_LABELS[h.teamSize]}</Badge>
                  <Badge variant="outline" className="mr-2">{h.totalScore.toFixed(2)}</Badge>
                  <span className="text-muted-foreground font-mono">{h.primaryStackName}</span>
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
            <strong className="text-foreground">Privacy & Honesty:</strong> All scoring and ADR generation run locally. There is no single "best" stack — this is a <em>starting recommendation</em>, not gospel. Cost and scale numbers are labeled estimates derived from public benchmarks (TechEmpower, State-of-JS, cloud pricing pages) as of 2024–2025. Always validate against your own load tests and team reality. Nothing about your idea is uploaded or logged by us.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ToggleCheck({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function WeightSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <Label className="text-[11px]">{label}</Label>
        <span className="text-[10px] font-mono text-muted-foreground">{(value * 100).toFixed(0)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5"
      />
    </div>
  );
}

// ---- LLM network call (kept here because it touches the network) ----

async function callLlm(
  provider: "openai" | "anthropic" | "openrouter",
  apiKey: string,
  system: string,
  user: string,
): Promise<string> {
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.4,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json() as { choices: { message: { content: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }
  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        system,
        max_tokens: 1500,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json() as { content: { text: string }[] };
    return data.content?.map((c) => c.text).join("") ?? "";
  }
  // openrouter
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

// Suppress unused-import lint (FileText may be used in future inline ADR display)
export type _Unused = typeof FileText;
