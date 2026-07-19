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
  GOAL_LABELS,
  TONE_LABELS,
  ANGLE_LABELS,
  ANGLE_DESCRIPTIONS,
  PLACEMENT_LABELS,
  PLATFORM_LABELS,
  PLATFORM_LIMITS,
  POWER_WORDS,
  PRODUCT_PRESETS,
  AUDIENCE_PRESETS,
  clean,
  detectPowerWords,
  generateCtas,
  generateAbPairs,
  analyzeCta,
  computeStats,
  renderText,
  renderMarkdown,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  loadFavorites,
  saveFavorite,
  removeFavorite,
  clearFavorites,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Goal,
  type Tone,
  type Angle,
  type Placement,
  type Platform,
  type CtaVariant,
  type AbPair,
  type AnalysisReport,
  type HistoryEntry,
  type FavoriteEntry,
  type ShareState,
} from "./logic";
import {
  Target, Sparkles, Key, History, ChevronDown, ChevronRight,
  Star, FlaskConical, BarChart3, AlertCircle, Trash2, Wand2, Search,
} from "lucide-react";

export default function AiCtaGenerator() {
  const [goal, setGoal] = useState<Goal>("signup");
  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [platform, setPlatform] = useState<Platform>("button-micro");
  const [selectedAngles, setSelectedAngles] = useState<Angle[]>([]);
  const [selectedPlacements, setSelectedPlacements] = useState<Placement[]>([]);
  const [currentCta, setCurrentCta] = useState("");
  const [variants, setVariants] = useState<CtaVariant[]>([]);
  const [abPairs, setAbPairs] = useState<AbPair[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisReport | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [faves, setFaves] = useState<FavoriteEntry[]>([]);
  const [error, setError] = useState("");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    setFaves(loadFavorites());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-cta:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.goal) setGoal(p.goal);
      if (p.product) setProduct(p.product);
      if (p.audience) setAudience(p.audience);
      if (p.tone) setTone(p.tone);
      if (p.platform) setPlatform(p.platform);
      if (p.currentCta) setCurrentCta(p.currentCta);
      if (p.product || p.currentCta) {
        toast.info("Loaded from share link");
        if (p.product) handleGenerate({
          goal: p.goal ?? "signup",
          product: p.product ?? "",
          audience: p.audience ?? "",
          tone: p.tone ?? "professional",
          platform: p.platform ?? "button-micro",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = useCallback(
    (override?: {
      goal?: Goal;
      product?: string;
      audience?: string;
      tone?: Tone;
      platform?: Platform;
    }) => {
      const g = override?.goal ?? goal;
      const pr = (override?.product ?? product).trim();
      const au = (override?.audience ?? audience).trim();
      const tn = override?.tone ?? tone;
      const pl = override?.platform ?? platform;
      setError("");
      if (!pr) {
        setError("Describe your product (e.g., 'fitness tracking app').");
        return;
      }
      const out = generateCtas({
        goal: g,
        product: pr,
        audience: au,
        tone: tn,
        platform: pl,
        angles: selectedAngles.length > 0 ? selectedAngles : undefined,
        placements: selectedPlacements.length > 0 ? selectedPlacements : undefined,
        max: 12,
      });
      setVariants(out);
      setAbPairs(generateAbPairs(out, 3));
      if (out.length > 0) {
        const avg = Math.round(out.reduce((a, b) => a + b.score, 0) / out.length);
        saveHistory({
          ts: Date.now(),
          goal: g, product: pr, audience: au, tone: tn,
          variantCount: out.length, avgScore: avg,
        });
        setHistory(loadHistory());
        toast.success(`Generated ${out.length} CTAs (avg score ${avg})`);
      } else {
        toast.info("No CTAs generated — try different inputs.");
      }
    },
    [goal, product, audience, tone, platform, selectedAngles, selectedPlacements],
  );

  const handleAnalyze = useCallback(() => {
    const text = currentCta.trim();
    if (!text) {
      toast.error("Paste a CTA to analyze first");
      return;
    }
    const r = analyzeCta(text, goal);
    setAnalysis(r);
    toast.success(`Detected: ${r.detectedAngles.map((a) => ANGLE_LABELS[a]).join(", ")}`);
  }, [currentCta, goal]);

  const stats = useMemo(() => computeStats(variants), [variants]);
  const allVariants = variants;

  const shareState: ShareState = { goal, product, audience, tone, platform, currentCta };

  const toggleAngle = (a: Angle) => {
    setSelectedAngles((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  };
  const togglePlacement = (p: Placement) => {
    setSelectedPlacements((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  };

  const handleClear = useCallback(() => {
    setVariants([]);
    setAbPairs([]);
    setAnalysis(null);
    setError("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSaveFavorite = useCallback((v: CtaVariant) => {
    saveFavorite({
      id: v.id, ts: Date.now(), text: v.text, angle: v.angle,
      placement: v.placement, goal: v.goal, tone: v.tone, score: v.score,
    });
    setFaves(loadFavorites());
    toast.success("Saved to swipe file");
  }, []);

  const handleRemoveFavorite = useCallback((id: string) => {
    removeFavorite(id);
    setFaves(loadFavorites());
    toast.info("Removed from swipe file");
  }, []);

  const handleClearFavorites = useCallback(() => {
    clearFavorites();
    setFaves([]);
    toast.success("Swipe file cleared");
  }, []);

  const handleSaveLlmKey = () => {
    if (typeof localStorage !== "undefined") {
      if (llmKey) localStorage.setItem("unqtools:ai-cta:llm-key", llmKey);
      else localStorage.removeItem("unqtools:ai-cta:llm-key");
    }
    toast.success(llmKey ? "API key saved locally" : "API key cleared");
  };

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Please paste your API key first");
      return;
    }
    if (!product.trim()) {
      toast.error("Enter a product first");
      return;
    }
    setLlmLoading(true);
    setError("");
    try {
      const prompt = buildLlmPrompt(goal, product, audience, tone, platform);
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
            { role: "system", content: "You are an expert direct-response copywriter who writes high-converting calls-to-action." },
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
      const extra: CtaVariant[] = parsed.variants.map((v, i) => {
        const charCount = v.text.length;
        const charLimit = PLATFORM_LIMITS[platform];
        return {
          id: `llm-${Date.now()}-${i}`,
          text: v.text,
          angle: v.angle,
          placement: "button",
          platform,
          goal,
          tone,
          score: Math.min(100, 60 + v.text.length / 4 | 0),
          charCount,
          charLimit,
          exceedsLimit: charCount > charLimit,
          powerWords: detectPowerWords(v.text),
          framework: v.framework,
          rationale: v.rationale || `${ANGLE_LABELS[v.angle]} angle, LLM-generated`,
        };
      });
      setVariants((prev) => [...extra, ...prev]);
      setAbPairs(generateAbPairs([...extra, ...allVariants], 3));
      toast.success(`LLM added ${extra.length} CTAs`);
    } catch (e) {
      setError(`LLM request error: ${(e as Error).message}`);
      toast.error("LLM request error");
    }
    setLlmLoading(false);
  }, [llmKey, llmProvider, goal, product, audience, tone, platform, allVariants]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ai-cta-goal" className="text-xs">Goal</Label>
              <select
                id="ai-cta-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value as Goal)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
                  <option key={g} value={g}>{GOAL_LABELS[g]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-cta-tone" className="text-xs">Tone</Label>
              <select
                id="ai-cta-tone"
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
                  <option key={t} value={t}>{TONE_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-cta-product">Product / offer</Label>
            <Textarea
              id="ai-cta-product"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder={"e.g., project management app for remote teams"}
              className="min-h-[50px] resize-y text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {PRODUCT_PRESETS.map((p) => (
                <Button
                  key={p}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setProduct(p)}
                >+ {p}</Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-cta-audience">Audience</Label>
            <Input
              id="ai-cta-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g., busy parents, freelance designers"
              className="text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {AUDIENCE_PRESETS.map((a) => (
                <Button
                  key={a}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setAudience(a)}
                >+ {a}</Button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="ai-cta-platform" className="text-xs">Platform (character limit)</Label>
            <select
              id="ai-cta-platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              className="h-8 w-full text-xs rounded border bg-background px-2"
            >
              {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => (
                <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs">Angles (optional — leave empty for all 10)</Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(Object.keys(ANGLE_LABELS) as Angle[]).map((a) => (
                <Button
                  key={a}
                  variant={selectedAngles.includes(a) ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => toggleAngle(a)}
                  title={ANGLE_DESCRIPTIONS[a]}
                >
                  {ANGLE_LABELS[a]}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Placements (optional — leave empty for all 5)</Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(Object.keys(PLACEMENT_LABELS) as Placement[]).map((p) => (
                <Button
                  key={p}
                  variant={selectedPlacements.includes(p) ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => togglePlacement(p)}
                >
                  {PLACEMENT_LABELS[p]}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-cta-current">Current CTA (optional — analyze before/after)</Label>
            <div className="flex gap-2">
              <Input
                id="ai-cta-current"
                value={currentCta}
                onChange={(e) => setCurrentCta(e.target.value)}
                placeholder="e.g., Click here"
                className="text-sm"
              />
              <Button size="sm" variant="outline" onClick={handleAnalyze} className="gap-1">
                <Search className="h-3.5 w-3.5" /> Analyze
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <RunButton
              onClick={() => handleGenerate()}
              label="Generate CTAs"
              loading={false}
              disabled={!product.trim()}
            />
            <ShareButton getUrl={() => buildShareUrl(shareState)} disabled={!product.trim()} />
            <ClearButton onClick={handleClear} disabled={variants.length === 0 && !analysis} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {analysis && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" /> Current-CTA analysis
            </h3>
            <div className="rounded border bg-background px-3 py-2 text-sm font-medium text-foreground">
              &ldquo;{analysis.text}&rdquo;
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline">Score {analysis.score}/100</Badge>
              <Badge variant="outline">{analysis.charCount} chars</Badge>
              {analysis.detectedAngles.map((a) => (
                <Badge key={a} variant="secondary" className="text-[10px]">{ANGLE_LABELS[a]}</Badge>
              ))}
              {analysis.powerWords.map((w) => (
                <Badge key={w} className="text-[10px] bg-emerald-600 text-white">{w}</Badge>
              ))}
            </div>
            {analysis.suggestions.length > 0 && (
              <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
                {analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {allVariants.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> {allVariants.length} CTA variations for &ldquo;{product || "your offer"}&rdquo;
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Variations" value={allVariants.length} />
                <Stat label="Avg score" value={
                  allVariants.length > 0
                    ? Math.round(allVariants.reduce((a, b) => a + b.score, 0) / allVariants.length)
                    : 0
                } />
                <Stat label="Within limit" value={allVariants.filter((v) => !v.exceedsLimit).length} highlight={allVariants.every((v) => !v.exceedsLimit) ? "good" : "bad"} />
                <Stat label="A/B pairs" value={abPairs.length} />
              </div>
              {stats.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {stats.map((s) => (
                    <Badge key={s.angle} variant="outline" className="text-[10px]">
                      {ANGLE_LABELS[s.angle]}: {s.count} · avg {s.avgScore}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Target className="h-4 w-4" /> CTA cards
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => renderText(allVariants)} label="Copy all" />
                  <DownloadButton
                    getText={() => renderMarkdown(allVariants)}
                    filename="ctas.md"
                    mime="text/markdown"
                    label=".md"
                  />
                  <DownloadButton
                    getText={() => renderCsv(allVariants)}
                    filename="ctas.csv"
                    mime="text/csv"
                    label=".csv"
                  />
                  <DownloadButton
                    getText={() => renderJson(allVariants)}
                    filename="ctas.json"
                    mime="application/json"
                    label=".json"
                  />
                </div>
              </div>
              <div className="space-y-2 max-h-[700px] overflow-auto">
                {allVariants.map((v) => (
                  <div key={v.id} className="rounded border bg-background px-3 py-2 text-xs space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">{ANGLE_LABELS[v.angle]}</Badge>
                      <Badge variant="outline" className="text-[10px]">{PLACEMENT_LABELS[v.placement]}</Badge>
                      <Badge variant="outline" className="text-[10px]">{v.framework}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{v.score}/100</Badge>
                      <Badge variant={v.exceedsLimit ? "destructive" : "outline"} className="text-[10px]">
                        {v.charCount}{v.charLimit ? `/${v.charLimit}` : ""} chars
                      </Badge>
                      {v.id.startsWith("llm-") && (
                        <Badge className="text-[10px] bg-violet-500 text-white">LLM</Badge>
                      )}
                    </div>
                    <p className="font-medium text-foreground text-sm leading-snug">&ldquo;{v.text}&rdquo;</p>
                    {v.powerWords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[10px] text-muted-foreground">power words:</span>
                        {v.powerWords.map((w) => (
                          <Badge key={w} className="text-[10px] bg-emerald-600 text-white px-1.5 py-0">{w}</Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-muted-foreground leading-snug text-[11px]">{v.rationale}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <CopyButton getText={() => v.text} label="Copy" size="sm" />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[11px] gap-1"
                        onClick={() => handleSaveFavorite(v)}
                      >
                        <Star className="h-3 w-3" /> Save
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {abPairs.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FlaskConical className="h-4 w-4" /> A/B pairs ({abPairs.length})
                </h3>
                <div className="space-y-2 max-h-[500px] overflow-auto">
                  {abPairs.map((p) => (
                    <div key={p.id} className="rounded border bg-background p-3 text-xs space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="rounded border border-blue-300/40 bg-blue-50/40 dark:bg-blue-900/15 p-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Badge variant="outline" className="text-[10px]">CONTROL</Badge>
                            <Badge variant="outline" className="text-[10px]">{ANGLE_LABELS[p.control.angle]}</Badge>
                            <Badge variant="secondary" className="text-[10px]">{p.control.score}/100</Badge>
                          </div>
                          <p className="font-medium text-foreground text-sm">&ldquo;{p.control.text}&rdquo;</p>
                        </div>
                        <div className="rounded border border-violet-300/40 bg-violet-50/40 dark:bg-violet-900/15 p-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Badge variant="outline" className="text-[10px]">CHALLENGER</Badge>
                            <Badge variant="outline" className="text-[10px]">{ANGLE_LABELS[p.challenger.angle]}</Badge>
                            <Badge variant="secondary" className="text-[10px]">{p.challenger.score}/100</Badge>
                          </div>
                          <p className="font-medium text-foreground text-sm">&ldquo;{p.challenger.text}&rdquo;</p>
                        </div>
                      </div>
                      <p className="text-muted-foreground leading-snug">
                        <strong className="text-foreground">Hypothesis:</strong> {p.hypothesis}
                      </p>
                      <p className="text-muted-foreground leading-snug">
                        <strong className="text-foreground">Measure:</strong> {p.whatToMeasure}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Power word reference */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Wand2 className="h-4 w-4" /> Power-word library ({POWER_WORDS.length})
              </h3>
              <div className="flex flex-wrap gap-1">
                {POWER_WORDS.map((w) => (
                  <Badge key={w} variant="outline" className="text-[10px] font-mono">{w}</Badge>
                ))}
              </div>
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
                    Paste your own OpenAI or Anthropic API key. Stored only in localStorage on this device. The tool builds an optimal prompt (goal + product + audience + tone + platform) using AIDA/PAS frameworks and parses the JSON response into additional CTA variants (tagged &ldquo;LLM&rdquo;).
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
                      <Button size="sm" variant="outline" onClick={handleSaveLlmKey} className="h-8">Save key</Button>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleLlmEnhance}
                    disabled={llmLoading || !llmKey || !product.trim()}
                    className="gap-1.5"
                  >
                    {llmLoading ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {llmLoading ? "Working…" : "Enhance with LLM"}
                  </Button>
                  <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                    <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    Scores are heuristic guidance, not guaranteed conversion. Always run real A/B tests before drawing conclusions.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Generate high-converting CTAs"
          hint="Pick a goal, describe your product and audience, choose a tone and platform, and click Generate. Each variant carries an angle label, a 0-100 score, and a rationale. A/B pairs are auto-generated for testing."
          icon={<Target className="h-8 w-8" />}
        />
      )}

      {faves.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Star className="h-4 w-4" /> Swipe file ({faves.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearFavorites}>Clear all</Button>
            </div>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {faves.slice(0, 15).map((f) => (
                <div key={f.id} className="flex items-center gap-2 rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="text-[10px]">{ANGLE_LABELS[f.angle]}</Badge>
                  <Badge variant="outline" className="text-[10px]">{PLACEMENT_LABELS[f.placement]}</Badge>
                  <span className="flex-1 truncate text-foreground">&ldquo;{f.text}&rdquo;</span>
                  <span className="text-[10px] text-muted-foreground">{f.score}/100</span>
                  <button
                    aria-label="Remove from swipe file"
                    onClick={() => handleRemoveFavorite(f.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
                    setGoal(h.goal);
                    setProduct(h.product);
                    setAudience(h.audience);
                    setTone(h.tone);
                    handleGenerate({
                      goal: h.goal, product: h.product, audience: h.audience, tone: h.tone, platform,
                    });
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{GOAL_LABELS[h.goal]}</Badge>
                    <Badge variant="outline">{TONE_LABELS[h.tone]}</Badge>
                    <Badge variant="secondary">{h.variantCount} CTAs</Badge>
                    <Badge variant="secondary">avg {h.avgScore}</Badge>
                    <span className="font-medium text-foreground">{h.product}</span>
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
            <strong className="text-foreground">Privacy:</strong> All CTA generation, scoring, A/B pairing, and analysis runs locally in your browser. Your product, audience, and current CTA never leave this device. The only network call is if you paste your own LLM API key and click &ldquo;Enhance with LLM&rdquo; — that request goes directly to your chosen provider. History and swipe file are stored in localStorage on this device only.
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
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
