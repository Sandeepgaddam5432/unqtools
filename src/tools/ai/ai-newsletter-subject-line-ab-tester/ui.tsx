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
  ANGLE_LABELS,
  ANGLE_DESCRIPTIONS,
  TOPIC_PRESETS,
  HISTORY_MAX,
  generateVariants,
  sortVariants,
  pickWinner,
  truncatePreview,
  lintSubject,
  computeAbDesign,
  zTestTwoProportion,
  renderCsv,
  renderText,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type SubjectAngle,
  type SubjectVariant,
  type ScoreFactor,
  type AbDesign,
  type ZTestResult,
  type HistoryEntry,
} from "./logic";
import {
  Mail, History, Sparkles, Key, Trophy, AlertCircle,
  Smartphone, Monitor, Calculator, FlaskConical,
} from "lucide-react";

const ANGLE_KEYS = Object.keys(ANGLE_LABELS) as SubjectAngle[];

export default function AiNewsletterSubjectLineAbTester() {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [selectedAngles, setSelectedAngles] = useState<SubjectAngle[]>([]);
  const [variants, setVariants] = useState<SubjectVariant[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [error, setError] = useState<string>("");

  // A/B design inputs
  const [totalAudience, setTotalAudience] = useState(50000);
  const [numVariants, setNumVariants] = useState(2);
  const [baselineOpen, setBaselineOpen] = useState(0.20);
  const [mde, setMde] = useState(0.05);
  const [dailyVolume, setDailyVolume] = useState(5000);
  const [abDesign, setAbDesign] = useState<AbDesign | null>(null);

  // Significance inputs
  const [sendsA, setSendsA] = useState(0);
  const [opensA, setOpensA] = useState(0);
  const [sendsB, setSendsB] = useState(0);
  const [opensB, setOpensB] = useState(0);
  const [zResult, setZResult] = useState<ZTestResult | null>(null);

  // LLM
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic" | "openrouter">("openai");
  const [llmLoading, setLlmLoading] = useState(false);

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.topic) setTopic(p.topic);
      if (p.audience) setAudience(p.audience);
      if (p.angles.length > 0) setSelectedAngles(p.angles);
      if (p.topic || p.angles.length > 0) toast.info("Loaded from share link");
    }
  }, []);

  const sortedVariants = useMemo(() => sortVariants(variants), [variants]);
  const winner = useMemo(() => pickWinner(variants), [variants]);

  const handleGenerate = useCallback(() => {
    setError("");
    if (!topic.trim()) {
      setError("Please enter a topic.");
      toast.error("Enter a topic first");
      return;
    }
    const v = generateVariants({
      topic,
      audience,
      angles: selectedAngles.length > 0 ? selectedAngles : undefined,
    });
    setVariants(v);
    setHasGenerated(true);
    const w = pickWinner(v);
    if (w) {
      saveHistory({
        ts: Date.now(),
        topic,
        audience,
        variantCount: v.length,
        topScore: w.score.total,
        topVariant: w.text,
      });
      setHistory(loadHistory());
      toast.success(`Generated ${v.length} variants. Top score: ${w.score.total}/100`);
    }
  }, [topic, audience, selectedAngles]);

  const handleAbDesign = useCallback(() => {
    const d = computeAbDesign(
      totalAudience, numVariants, baselineOpen, mde, 0.80, 0.05, dailyVolume,
    );
    setAbDesign(d);
    toast.success("A/B design computed");
  }, [totalAudience, numVariants, baselineOpen, mde, dailyVolume]);

  const handleZTest = useCallback(() => {
    const r = zTestTwoProportion(sendsA, opensA, sendsB, opensB, 0.05);
    setZResult(r);
    if (r.significant) toast.success(`Significant! Variant ${r.winner.toUpperCase()} wins`);
    else toast.info("Not yet significant — keep collecting data");
  }, [sendsA, opensA, sendsB, opensB]);

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste an API key first");
      return;
    }
    setLlmLoading(true);
    try {
      const prompt = buildLlmPrompt(
        topic,
        audience,
        selectedAngles.length > 0 ? selectedAngles : ANGLE_KEYS,
      );
      const text = await callLlm(llmProvider, llmKey, prompt.system, prompt.user);
      const llmVariants = renderLlmResult(text);
      setVariants((prev) => {
        const merged = [...prev];
        for (const v of llmVariants) {
          if (!merged.some((m) => m.text === v.text)) merged.push(v);
        }
        return merged;
      });
      toast.success(`Added ${llmVariants.length} LLM variants`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`LLM call failed: ${msg}`);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, topic, audience, selectedAngles]);

  const toggleAngle = (a: SubjectAngle) => {
    setSelectedAngles((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  };

  const handleClear = useCallback(() => {
    setTopic("");
    setAudience("");
    setSelectedAngles([]);
    setVariants([]);
    setHasGenerated(false);
    setError("");
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
          <div className="space-y-1.5">
            <Label htmlFor="nlsl-topic">Topic / content angle</Label>
            <Input
              id="nlsl-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. email marketing, morning routines, investing basics"
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
          <div className="space-y-1.5">
            <Label htmlFor="nlsl-audience">Audience (optional)</Label>
            <Input
              id="nlsl-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. marketers, founders, parents"
            />
          </div>
          <div>
            <Label className="text-xs">Angles (optional — leave empty for all 5)</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {ANGLE_KEYS.map((a) => (
                <label key={a} className="flex items-center gap-1.5 text-xs cursor-pointer" title={ANGLE_DESCRIPTIONS[a]}>
                  <input
                    type="checkbox"
                    checked={selectedAngles.includes(a)}
                    onChange={() => toggleAngle(a)}
                  />
                  {ANGLE_LABELS[a]}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleGenerate} label="Generate variants" />
            <ShareButton getUrl={() => buildShareUrl(topic, audience, selectedAngles)} />
            <ClearButton onClick={handleClear} />
          </div>
          {error && <ErrorBanner message={error} />}
        </CardContent>
      </Card>

      {hasGenerated && sortedVariants.length > 0 ? (
        <>
          {winner && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-foreground">Top variant — score {winner.score.total}/100</h3>
                </div>
                <p className="font-mono text-sm text-foreground">{winner.text}</p>
                <Badge variant="secondary" className="mt-1 text-[10px]">{ANGLE_LABELS[winner.angle]}</Badge>
                <span className="ml-2 text-[10px] text-muted-foreground">{winner.charCount} chars · {winner.emojiCount} emoji</span>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Mail className="h-4 w-4" /> {sortedVariants.length} variants (sorted by score)
                </h3>
                <div className="flex gap-2">
                  <CopyButton getText={() => renderText(sortedVariants)} label="Copy TSV" />
                  <DownloadButton
                    getText={() => renderCsv(sortedVariants)}
                    filename="subject-line-variants.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                </div>
              </div>
              <div className="space-y-2 max-h-[600px] overflow-auto">
                {sortedVariants.map((v, i) => (
                  <VariantRow key={v.id} variant={v} rank={i + 1} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Calculator className="h-4 w-4" /> A/B test design calculator
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <NumField label="Total audience" value={totalAudience} onChange={setTotalAudience} />
                <NumField label="Variants (2-5)" value={numVariants} onChange={setNumVariants} />
                <NumField label="Baseline open %" value={Math.round(baselineOpen * 100)} onChange={(v) => setBaselineOpen(v / 100)} />
                <NumField label="MDE %" value={Math.round(mde * 100)} onChange={(v) => setMde(v / 100)} />
                <NumField label="Daily sends" value={dailyVolume} onChange={setDailyVolume} />
              </div>
              <Button size="sm" onClick={handleAbDesign} className="gap-1.5">
                <Calculator className="h-3.5 w-3.5" /> Compute design
              </Button>
              {abDesign && (
                <div className="rounded border bg-background p-3 space-y-1 text-xs">
                  <StatRow label="Sample per variant" value={abDesign.samplePerVariant.toLocaleString()} />
                  <StatRow label="Total sends needed" value={(abDesign.samplePerVariant * abDesign.numVariants).toLocaleString()} />
                  <StatRow label="Holdout %" value={`${abDesign.holdoutPct}%`} />
                  <StatRow label="Test split %" value={`${abDesign.testSplitPct}%`} />
                  <StatRow label="Estimated runtime" value={`${abDesign.estimatedDays} day(s)`} />
                  <StatRow label="Alpha / Power" value={`α=${abDesign.alpha} / power=${abDesign.power}`} />
                  <p className="text-muted-foreground pt-1">{abDesign.note}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FlaskConical className="h-4 w-4" /> Significance test (two-proportion z-test)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <NumField label="Variant A sends" value={sendsA} onChange={setSendsA} />
                <NumField label="Variant A opens" value={opensA} onChange={setOpensA} />
                <NumField label="Variant B sends" value={sendsB} onChange={setSendsB} />
                <NumField label="Variant B opens" value={opensB} onChange={setOpensB} />
              </div>
              <Button size="sm" onClick={handleZTest} className="gap-1.5">
                <FlaskConical className="h-3.5 w-3.5" /> Run z-test
              </Button>
              {zResult && (
                <div className="rounded border bg-background p-3 space-y-1 text-xs">
                  <StatRow label="Open rate A" value={`${(zResult.conversionA * 100).toFixed(2)}%`} />
                  <StatRow label="Open rate B" value={`${(zResult.conversionB * 100).toFixed(2)}%`} />
                  <StatRow label="Lift (B vs A)" value={`${(zResult.lift * 100).toFixed(2)}%`} />
                  <StatRow label="z-score" value={zResult.z.toFixed(4)} />
                  <StatRow label="p-value" value={zResult.pValue.toFixed(4)} />
                  <StatRow label="Significant" value={zResult.significant ? "Yes" : "No"} highlight={zResult.significant ? "good" : "bad"} />
                  <StatRow label="Winner" value={zResult.winner === "none" ? "—" : zResult.winner.toUpperCase()} highlight={zResult.winner === "none" ? undefined : "good"} />
                  <p className="text-muted-foreground pt-1">{zResult.note}</p>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">
                Note: Apple Mail Privacy Protection (MPP) inflates open rates. For definitive results, consider click-based winner selection.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Key className="h-4 w-4" /> Optional: Enhance with BYO-key LLM
              </h3>
              <p className="text-xs text-muted-foreground">
                Paste your own API key (OpenAI / Anthropic / OpenRouter) to generate 10 additional variants. Key stays in your browser — sent directly to the provider.
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
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Generate + score subject line variants"
          hint="Enter your topic (e.g. 'email marketing') and click Generate. We'll produce 5+ variants across 5 proven angles, score each on open-rate potential, preview mobile/desktop truncation, and let you compute proper A/B test sample sizes."
          icon={<Mail className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.topScore}/100</Badge>
                  <Badge variant="outline" className="mr-2">{h.variantCount} variants</Badge>
                  <span className="text-muted-foreground">{h.topic}</span>
                  {h.audience && <span className="text-muted-foreground ml-1">· {h.audience}</span>}
                  <div className="text-muted-foreground mt-0.5 font-mono">{h.topVariant}</div>
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
            <strong className="text-foreground">Privacy:</strong> All variant generation, scoring, linting, and the stats engine run locally. History stored in localStorage on this device. LLM enhancement is opt-in and uses your own key.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function VariantRow({ variant, rank }: { variant: SubjectVariant; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const riskColor = variant.lint.riskLevel === "danger"
    ? "text-red-600 dark:text-red-400"
    : variant.lint.riskLevel === "warn"
      ? "text-amber-600 dark:text-amber-400"
      : "text-emerald-600 dark:text-emerald-400";
  return (
    <div className="rounded border bg-background px-3 py-2 text-xs">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-muted-foreground w-6 text-right">#{rank}</span>
          <Badge variant="secondary" className="text-[10px]">{variant.score.total}</Badge>
          <Badge variant="outline" className="text-[10px]">{ANGLE_LABELS[variant.angle]}</Badge>
          <span className={`font-mono text-foreground flex-1 truncate ${expanded ? "" : "truncate"}`}>{variant.text}</span>
          <span className={`text-[10px] ${riskColor}`}>
            {variant.lint.riskLevel === "ok" ? "✓" : variant.lint.riskLevel === "warn" ? "⚠" : "✗"}
          </span>
        </div>
      </button>
      {expanded && (
        <div className="mt-2 space-y-2 pl-8">
          <div className="flex flex-wrap gap-1.5 text-[10px]">
            {variant.score.factors.map((f) => (
              <FactorBadge key={f.key} factor={f} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border p-2">
              <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Monitor className="h-3 w-3" /> Desktop preview</div>
              <div className="font-mono text-[11px] text-foreground truncate">{variant.preview.desktop}</div>
              {variant.preview.desktopTruncated && <span className="text-[10px] text-amber-600">Truncated</span>}
            </div>
            <div className="rounded border p-2">
              <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Smartphone className="h-3 w-3" /> Mobile preview</div>
              <div className="font-mono text-[11px] text-foreground truncate">{variant.preview.mobile}</div>
              {variant.preview.mobileTruncated && <span className="text-[10px] text-amber-600">Truncated</span>}
            </div>
          </div>
          {variant.lint.issues.length > 0 && (
            <div className="space-y-0.5">
              {variant.lint.issues.map((iss, i) => (
                <div key={i} className={`text-[10px] ${iss.level === "danger" ? "text-red-600" : iss.level === "warn" ? "text-amber-600" : "text-emerald-600"}`}>
                  · {iss.message}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-1">
            <CopyButton getText={() => variant.text} label="Copy" size="sm" />
          </div>
        </div>
      )}
    </div>
  );
}

function FactorBadge({ factor }: { factor: ScoreFactor }) {
  const positive = factor.contribution > 0;
  const neutral = factor.contribution === 0;
  const color = neutral
    ? "border-border text-muted-foreground"
    : positive
      ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
      : "border-red-500/40 text-red-700 dark:text-red-400";
  return (
    <span className={`rounded border px-1.5 py-0.5 ${color}`} title={factor.note}>
      {factor.label}: {positive ? "+" : ""}{factor.contribution}
    </span>
  );
}

function NumField({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-8 text-xs"
      />
    </div>
  );
}

function StatRow({
  label, value, highlight,
}: { label: string; value: string; highlight?: "good" | "bad" }) {
  const color = highlight === "good"
    ? "text-emerald-600 dark:text-emerald-400"
    : highlight === "bad"
      ? "text-red-600 dark:text-red-400"
      : "text-foreground";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-medium ${color}`}>{value}</span>
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
        temperature: 0.8,
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
        max_tokens: 800,
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
      temperature: 0.8,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}
