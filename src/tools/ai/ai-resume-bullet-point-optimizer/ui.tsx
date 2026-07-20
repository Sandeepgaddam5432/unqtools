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
} from "../../_shared";
import { toast } from "sonner";
import {
  FileText, History, Sparkles, AlertTriangle, Key, TrendingUp, Check, Lightbulb,
} from "lucide-react";
import {
  SAMPLE_BULLETS,
  SAMPLE_JD,
  parseBullets,
  analyzeBullet,
  bulkOptimize,
  renderText,
  renderMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  parseLlmResult,
  type HistoryEntry,
  type BulletAnalysis,
} from "./logic";

export default function AIResumeBulletPointOptimizer() {
  const [bulletsText, setBulletsText] = useState("");
  const [jd, setJd] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [llmKey, setLlmKey] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmIndex, setLlmIndex] = useState<number | null>(null);
  const [showLlm, setShowLlm] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.bullets) setBulletsText(p.bullets);
      if (p.jd) setJd(p.jd);
      if (p.bullets || p.jd) toast.info("Loaded from share link");
    }
  }, []);

  const bullets = useMemo(() => parseBullets(bulletsText), [bulletsText]);
  const bulk = useMemo(() => bulkOptimize(bullets, jd || undefined), [bullets, jd]);

  const handleSaveHistory = useCallback(() => {
    if (bullets.length === 0) return;
    saveHistory({
      ts: Date.now(),
      bulletCount: bullets.length,
      averageScore: bulk.averageScore,
      preview: bullets[0].slice(0, 80),
    });
    setHistory(loadHistory());
  }, [bullets, bulk]);

  const handleClear = useCallback(() => {
    setBulletsText("");
    setJd("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadSample = useCallback((i: number) => {
    const sample = SAMPLE_BULLETS[i];
    if (!sample) return;
    setBulletsText((prev) => (prev ? `${prev}\n${sample}` : sample));
    if (!jd) setJd(SAMPLE_JD);
    toast.info("Sample loaded");
  }, [jd]);

  const handleLlmEnhance = useCallback(async (idx: number) => {
    if (!llmKey) {
      toast.error("Paste your LLM API key first");
      return;
    }
    const bullet = bullets[idx];
    if (!bullet) return;
    setLlmLoading(true);
    setLlmIndex(idx);
    try {
      const prompt = buildLlmPrompt(bullet, jd || undefined);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llmKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are an expert resume writer." },
            { role: "user", content: prompt },
          ],
          temperature: 0.4,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content ?? "";
      const parsed = parseLlmResult(text);
      if (!parsed) throw new Error("No rewrites returned");
      // Replace the bullet with the first LLM rewrite.
      const next = [...bullets];
      next[idx] = parsed.rewrites[0];
      setBulletsText(next.join("\n"));
      toast.success(`LLM rewrite applied — verify and add your real metric. (${parsed.explanation.slice(0, 60)})`);
    } catch (e) {
      toast.error(`LLM call failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLlmLoading(false);
      setLlmIndex(null);
    }
  }, [llmKey, bullets, jd]);

  const allMarkdown = useMemo(() => {
    return bulk.bullets.map((b) => renderMarkdown(b)).join("\n\n---\n\n");
  }, [bulk]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="arb-bullets">Paste resume bullets (one per line, or separated by • or ;)</Label>
            <Textarea
              id="arb-bullets"
              value={bulletsText}
              onChange={(e) => setBulletsText(e.target.value)}
              placeholder={"Responsible for managing a team of 5 engineers.\nWorked on the API migration that reduced latency by 30%."}
              className="min-h-[120px] resize-y text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {SAMPLE_BULLETS.map((s, i) => (
                <Button
                  key={i}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => handleLoadSample(i)}
                >+ Sample {i + 1}</Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="arb-jd" className="text-xs">Optional: paste target job description (JD) for keyword matching</Label>
            <Textarea
              id="arb-jd"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder={"We are looking for a Senior PM with experience in roadmapping, SQL, A/B testing, and stakeholder management..."}
              className="min-h-[60px] resize-y text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {bulk.bullets.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Bullets" value={bulk.bullets.length} />
                <Stat label="Avg score" value={`${bulk.averageScore}/100`} highlight={bulk.averageScore >= 70 ? "good" : bulk.averageScore < 50 ? "bad" : undefined} />
                <Stat label="Weak bullets" value={bulk.weakBullets} highlight={bulk.weakBullets > 0 ? "bad" : "good"} />
                <Stat label="Tense" value={bulk.tenseConsistent ? "consistent" : "mixed"} highlight={bulk.tenseConsistent ? "good" : "bad"} />
              </div>
              {bulk.totalJdGaps.length > 0 && (
                <div className="pt-1 text-[11px] text-muted-foreground">
                  <span className="text-foreground font-medium">JD keyword gaps ({bulk.totalJdGaps.length}):</span>{" "}
                  {bulk.totalJdGaps.slice(0, 12).join(", ")}{bulk.totalJdGaps.length > 12 ? "…" : ""}
                </div>
              )}
            </CardContent>
          </Card>

          {bulk.bullets.map((a, i) => (
            <BulletCard
              key={i}
              index={i}
              analysis={a}
              onLlmEnhance={() => handleLlmEnhance(i)}
              llmLoading={llmLoading && llmIndex === i}
              showLlm={showLlm}
              onSaveHistory={handleSaveHistory}
              allMarkdown={allMarkdown}
              shareUrl={buildShareUrl(bulletsText, jd)}
              onClear={handleClear}
            />
          ))}
        </>
      ) : (
        <EmptyState
          title="Paste resume bullets to optimize"
          hint="We'll rewrite them using Action verb + Task + Result + Metric, flag weak phrases ('responsible for'), score each bullet 0–100, and suggest strong alternatives. We never invent metrics — placeholders in [brackets] are for your real numbers."
          icon={<FileText className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <button
            onClick={() => setShowLlm(!showLlm)}
            className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
          >
            <Key className="h-4 w-4" /> Optional: enhance with your own LLM key
          </button>
          {showLlm && (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Paste your own OpenAI API key to ask GPT for richer rewrites. The LLM is instructed to NEVER fabricate metrics — it will use [placeholders] you must verify. The key is stored only in this browser tab and sent directly to OpenAI — never to us.
              </p>
              <Input
                type="password"
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder="sk-..."
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Click "Enhance with LLM" on any bullet card below to use it.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

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
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{h.bulletCount} bullets</Badge>
                    <Badge variant="outline" className="text-[10px]">avg {h.averageScore}/100</Badge>
                    <span className="text-muted-foreground text-[11px] truncate flex-1">{h.preview}</span>
                    <span className="text-muted-foreground text-[10px]">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All bullet analysis, scoring, and rewriting run locally in your browser. Your resume text never leaves this device. The only network call is if you paste your own LLM API key.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function BulletCard({
  index,
  analysis,
  onLlmEnhance,
  llmLoading,
  showLlm,
  onSaveHistory,
  allMarkdown,
  shareUrl,
  onClear,
}: {
  index: number;
  analysis: BulletAnalysis;
  onLlmEnhance: () => void;
  llmLoading: boolean;
  showLlm: boolean;
  onSaveHistory: () => void;
  allMarkdown: string;
  shareUrl: string;
  onClear: () => void;
}) {
  const scoreColor = analysis.score.score >= 70
    ? "text-emerald-600 dark:text-emerald-400"
    : analysis.score.score >= 40
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <FileText className="h-4 w-4" /> Bullet #{index + 1}
          </h3>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className={`text-[10px] ${scoreColor}`}>Score {analysis.score.score}/100</Badge>
            <Badge variant="outline" className="text-[10px]">{analysis.tense}</Badge>
            {analysis.verbs[0] && (
              <Badge variant="outline" className="text-[10px]">{analysis.verbs[0].category}</Badge>
            )}
          </div>
        </div>
        <div className="rounded border bg-background px-3 py-2 text-xs">
          <span className="text-muted-foreground text-[10px] uppercase tracking-wide">Original</span>
          <p className="mt-1 text-foreground">{analysis.original}</p>
        </div>

        {analysis.diagnostics.length > 0 && (
          <div className="space-y-1">
            {analysis.diagnostics.map((d, i) => (
              <div key={i} className="flex items-start gap-2 rounded border border-amber-300/40 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-1.5 text-[11px]">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <span className="text-foreground">{d}</span>
              </div>
            ))}
          </div>
        )}

        {analysis.score.signals.hasMetric && analysis.metrics.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-[11px]">
            <span className="text-muted-foreground">Metrics:</span>
            {analysis.metrics.map((m, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">{m.raw}</Badge>
            ))}
          </div>
        )}

        {analysis.rewrites.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Lightbulb className="h-3.5 w-3.5" /> Suggested rewrites
            </div>
            {analysis.rewrites.map((r, i) => (
              <div key={i} className="rounded border border-emerald-300/40 bg-emerald-50/50 dark:bg-emerald-900/10 px-3 py-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-foreground flex-1">{r}</p>
                  <CopyButton getText={() => r} label="" successLabel="Copied" size="icon-sm" />
                </div>
              </div>
            ))}
          </div>
        )}

        {showLlm && (
          <div className="flex items-center gap-2">
            <Button onClick={onLlmEnhance} disabled={llmLoading} size="sm" variant="outline" className="gap-1.5 text-xs">
              {llmLoading ? "Working…" : <><Sparkles className="h-3.5 w-3.5" /> Enhance with LLM</>}
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <CopyButton getText={() => { onSaveHistory(); return renderText(analysis); }} label="Copy report" />
          <DownloadButton
            getText={() => { onSaveHistory(); return allMarkdown; }}
            filename="resume-bullets.md"
            mime="text/markdown"
            label="Download all .md"
          />
          <ShareButton getUrl={() => { onSaveHistory(); return shareUrl; }} />
          <ClearButton onClick={onClear} />
        </div>
      </CardContent>
    </Card>
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

// Suppress unused import warning
export type _Unused = typeof Check;
