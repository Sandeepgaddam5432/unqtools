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
  DOMAIN_LABELS,
  STYLE_LABELS,
  COMPLEXITY_LABELS,
  AUDIENCE_LABELS,
  CONCEPT_PRESETS,
  generateAnalogies,
  expandExplainer,
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
  randomDomains,
  type AnalogyDomain,
  type AnalogyStyle,
  type Complexity,
  type Audience,
  type AnalogyVariation,
  type HistoryEntry,
  type Explainer,
  type ShareState,
} from "./logic";
import {
  Lightbulb, Sparkles, Key, History, ChevronDown, ChevronRight,
  Dice5, BookOpen, AlertCircle,
} from "lucide-react";

export default function AiAnalogiesGenerator() {
  const [concept, setConcept] = useState("");
  const [domains, setDomains] = useState<AnalogyDomain[]>(["cooking", "technology"]);
  const [styles, setStyles] = useState<AnalogyStyle[]>(["metaphor", "simile"]);
  const [complexity, setComplexity] = useState<Complexity>("standard");
  const [audience, setAudience] = useState<Audience>("expert");
  const [variations, setVariations] = useState<AnalogyVariation[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [explainer, setExplainer] = useState<Explainer | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState("");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmExtra, setLlmExtra] = useState<AnalogyVariation[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-analogies:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.concept) setConcept(p.concept);
      if (p.domains && p.domains.length > 0) setDomains(p.domains);
      if (p.styles && p.styles.length > 0) setStyles(p.styles);
      if (p.complexity) setComplexity(p.complexity);
      if (p.audience) setAudience(p.audience);
      if (p.concept) {
        toast.info("Loaded from share link");
        handleGenerate(p.concept, p.domains, p.styles, p.complexity, p.audience);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = useCallback(
    (
      overrideConcept?: string,
      overrideDomains?: AnalogyDomain[],
      overrideStyles?: AnalogyStyle[],
      overrideComplexity?: Complexity,
      overrideAudience?: Audience,
    ) => {
      const c = (overrideConcept ?? concept).trim();
      const d = overrideDomains ?? domains;
      const s = overrideStyles ?? styles;
      const cx = overrideComplexity ?? complexity;
      const a = overrideAudience ?? audience;
      setError("");
      setExplainer(null);
      setLlmExtra([]);
      if (!c) {
        setError("Please enter a concept to explain (e.g., 'DNS', 'compound interest').");
        return;
      }
      if (d.length === 0) {
        setError("Pick at least one domain.");
        return;
      }
      if (s.length === 0) {
        setError("Pick at least one style.");
        return;
      }
      const out = generateAnalogies({
        concept: c, domains: d, styles: s, complexity: cx, audience: a, max: 10,
      });
      setVariations(out);
      setExpandedId(out[0]?.id ?? null);
      if (out.length > 0) {
        const avg = Math.round(out.reduce((acc, v) => acc + v.score, 0) / out.length);
        saveHistory({
          ts: Date.now(),
          concept: c,
          domainCount: d.length,
          styleCount: s.length,
          variationCount: out.length,
          avgScore: avg,
        });
        setHistory(loadHistory());
        toast.success(`Generated ${out.length} analogies (avg score ${avg})`);
      } else {
        toast.info("No analogies generated — try different inputs.");
      }
    },
    [concept, domains, styles, complexity, audience],
  );

  const stats = useMemo(() => computeStats(variations), [variations]);

  const handleExpand = useCallback((v: AnalogyVariation) => {
    setExplainer(expandExplainer(v));
    setExpandedId(v.id);
  }, []);

  const handleRandomizeDomains = useCallback(() => {
    const picks = randomDomains(3);
    setDomains(picks);
    toast.info(`Picked: ${picks.map((d) => DOMAIN_LABELS[d]).join(", ")}`);
  }, []);

  const toggleDomain = (d: AnalogyDomain) => {
    setDomains((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  };
  const toggleStyle = (s: AnalogyStyle) => {
    setStyles((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const handleClear = useCallback(() => {
    setConcept("");
    setVariations([]);
    setExplainer(null);
    setLlmExtra([]);
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
      if (llmKey) localStorage.setItem("unqtools:ai-analogies:llm-key", llmKey);
      else localStorage.removeItem("unqtools:ai-analogies:llm-key");
    }
    toast.success(llmKey ? "API key saved locally" : "API key cleared");
  };

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Please paste your API key first");
      return;
    }
    if (!concept.trim()) {
      toast.error("Enter a concept first");
      return;
    }
    setLlmLoading(true);
    setError("");
    try {
      const prompt = buildLlmPrompt(concept, domains, styles, complexity, audience);
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
            { role: "system", content: "You are an expert teacher who explains concepts with creative, honest analogies." },
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
      const extra: AnalogyVariation[] = parsed.variations.map((v, i) => ({
        id: `llm-${Date.now()}-${i}`,
        concept: concept.trim(),
        domain: "everyday",
        style: "metaphor",
        complexity,
        audience,
        headline: v.headline,
        body: v.body,
        breakdown: v.breakdown || "LLM-generated — review before using.",
        score: 0,
        keywords: [],
      }));
      setLlmExtra(extra);
      toast.success(`LLM added ${extra.length} analogies`);
    } catch (e) {
      setError(`LLM request error: ${(e as Error).message}`);
      toast.error("LLM request error");
    }
    setLlmLoading(false);
  }, [llmKey, llmProvider, concept, domains, styles, complexity, audience]);

  const allVariations = useMemo(
    () => [...variations, ...llmExtra],
    [variations, llmExtra],
  );

  const shareState: ShareState = { concept, domains, styles, complexity, audience };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ai-analogies-concept">Concept to explain</Label>
            <Textarea
              id="ai-analogies-concept"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder={"e.g., DNS (Domain Name System), compound interest, recursion in programming"}
              className="min-h-[60px] resize-y text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {CONCEPT_PRESETS.map((p) => (
                <Button
                  key={p}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setConcept(p.trim())}
                >+ {p.trim()}</Button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Domains ({domains.length})</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] gap-1"
                onClick={handleRandomizeDomains}
              >
                <Dice5 className="h-3 w-3" /> Surprise me (3)
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(Object.keys(DOMAIN_LABELS) as AnalogyDomain[]).map((d) => (
                <Button
                  key={d}
                  variant={domains.includes(d) ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => toggleDomain(d)}
                >
                  {DOMAIN_LABELS[d]}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Styles ({styles.length})</Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(Object.keys(STYLE_LABELS) as AnalogyStyle[]).map((s) => (
                <Button
                  key={s}
                  variant={styles.includes(s) ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => toggleStyle(s)}
                >
                  {STYLE_LABELS[s]}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ai-analogies-complexity" className="text-xs">Complexity</Label>
              <select
                id="ai-analogies-complexity"
                value={complexity}
                onChange={(e) => setComplexity(e.target.value as Complexity)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(COMPLEXITY_LABELS) as Complexity[]).map((c) => (
                  <option key={c} value={c}>{COMPLEXITY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-analogies-audience" className="text-xs">Audience</Label>
              <select
                id="ai-analogies-audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value as Audience)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(AUDIENCE_LABELS) as Audience[]).map((a) => (
                  <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <RunButton
              onClick={() => handleGenerate()}
              label="Generate analogies"
              loading={false}
              disabled={!concept.trim()}
            />
            <ShareButton getUrl={() => buildShareUrl(shareState)} disabled={!concept.trim()} />
            <ClearButton onClick={handleClear} disabled={!concept && variations.length === 0} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {allVariations.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> {allVariations.length} analogies for &ldquo;{concept}&rdquo;
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Variations" value={allVariations.length} />
                <Stat label="Domains" value={domains.length} />
                <Stat label="Styles" value={styles.length} />
                <Stat
                  label="Avg score"
                  value={
                    allVariations.length > 0
                      ? Math.round(
                          allVariations.reduce((a, b) => a + (b.score || 0), 0) /
                            allVariations.filter((v) => v.score > 0).length || 1,
                        )
                      : 0
                  }
                />
              </div>
              {stats.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {stats.map((s) => (
                    <Badge key={s.domain} variant="outline" className="text-[10px]">
                      {DOMAIN_LABELS[s.domain]}: {s.count} · avg {s.avgScore}
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
                  <Lightbulb className="h-4 w-4" /> Analogy cards
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => renderText(allVariations)} label="Copy all" />
                  <DownloadButton
                    getText={() => renderMarkdown(allVariations)}
                    filename="analogies.md"
                    mime="text/markdown"
                    label="Download .md"
                  />
                  <DownloadButton
                    getText={() => renderJson(allVariations)}
                    filename="analogies.json"
                    mime="application/json"
                    label="Download .json"
                  />
                </div>
              </div>
              <div className="space-y-2 max-h-[700px] overflow-auto">
                {allVariations.map((v) => {
                  const isExpanded = expandedId === v.id;
                  return (
                    <div key={v.id} className="rounded border bg-background px-3 py-2 text-xs space-y-1.5">
                      <div className="flex items-start gap-2">
                        <button
                          aria-label={isExpanded ? "Collapse" : "Expand"}
                          onClick={() => setExpandedId(isExpanded ? null : v.id)}
                          className="mt-0.5 text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5" />
                            : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                        <div className="flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px]">{DOMAIN_LABELS[v.domain]}</Badge>
                            <Badge variant="outline" className="text-[10px]">{STYLE_LABELS[v.style]}</Badge>
                            {v.score > 0 && (
                              <Badge variant="secondary" className="text-[10px]">Score {v.score}</Badge>
                            )}
                            {v.id.startsWith("llm-") && (
                              <Badge className="text-[10px] bg-violet-500 text-white">LLM</Badge>
                            )}
                          </div>
                          <p className="font-medium text-foreground leading-snug">{v.headline}</p>
                          <p className="text-muted-foreground leading-snug">{v.body}</p>
                          <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
                            ⚠ {v.breakdown}
                          </p>
                          {isExpanded && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[11px] gap-1"
                                onClick={() => handleExpand(v)}
                              >
                                <BookOpen className="h-3 w-3" /> Expand to explainer
                              </Button>
                              <CopyButton
                                getText={() => `${v.headline}\n\n${v.body}\n\nLimitation: ${v.breakdown}`}
                                label="Copy"
                                size="sm"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {explainer && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4" /> Explainer
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <CopyButton getText={() => explainer.fullText} label="Copy explainer" />
                    <DownloadButton
                      getText={() => explainer.fullText}
                      filename="explainer.md"
                      mime="text/markdown"
                      label="Download"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  <Badge variant="outline">{explainer.wordCount} words</Badge>
                  <Badge variant="outline">~{explainer.readingTimeMin} min read</Badge>
                </div>
                <pre className="text-xs whitespace-pre-wrap font-sans text-foreground bg-muted/40 rounded p-3 max-h-[400px] overflow-auto">
                  {explainer.fullText}
                </pre>
              </CardContent>
            </Card>
          )}

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
                    Paste your own OpenAI or Anthropic API key. Stored only in localStorage on this device. The tool builds an optimal prompt and parses the JSON response into additional analogy cards (tagged &ldquo;LLM&rdquo;).
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
                    disabled={llmLoading || !llmKey || !concept.trim()}
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
                    Scores are heuristics, not guaranteed quality. Always review LLM output for accuracy.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a concept to generate analogies"
          hint="Pick one or more domains and styles, then click Generate. Each analogy includes a 'where it breaks down' honesty note."
          icon={<Lightbulb className="h-8 w-8" />}
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
                    setConcept(h.concept);
                    handleGenerate(h.concept);
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{h.variationCount} analogies</Badge>
                    <Badge variant="outline">avg {h.avgScore}</Badge>
                    <span className="font-medium text-foreground">{h.concept}</span>
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
            <strong className="text-foreground">Privacy:</strong> All analogy generation runs locally in your browser. The only network call is if you paste your own LLM API key and click &ldquo;Enhance with LLM&rdquo; — that request goes directly to your chosen provider. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
