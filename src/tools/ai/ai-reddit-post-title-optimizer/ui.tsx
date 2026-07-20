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
  MessageCircle, History, Sparkles, Gauge, FileText, Key, AlertTriangle,
} from "lucide-react";
import {
  ANGLE_LABELS,
  ANGLE_DESCRIPTIONS,
  ALL_ANGLES,
  RULE_RISK_LABELS,
  SUBREDDIT_PRESETS,
  SAMPLE_DRAFTS,
  DEFAULT_CHAR_LIMIT,
  normalizeInput,
  lookupSubreddit,
  optimizeTitles,
  renderText,
  renderMarkdown,
  renderJson,
  renderTitlesOnly,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  parseLlmResult,
  type OptimizationResult,
  type HistoryEntry,
  type TitleOption,
} from "./logic";

export default function AIRedditPostTitleOptimizer() {
  const [draft, setDraft] = useState("");
  const [subreddit, setSubreddit] = useState("");
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [llmKey, setLlmKey] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [showLlm, setShowLlm] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.draft) setDraft(p.draft);
      if (p.subreddit) setSubreddit(p.subreddit);
      if (p.draft || p.subreddit) toast.info("Loaded from share link");
    }
  }, []);

  const presetInfo = useMemo(() => lookupSubreddit(subreddit), [subreddit]);

  const handleRun = useCallback(() => {
    const clean = normalizeInput(draft);
    if (!clean) {
      toast.error("Enter a post draft first");
      return;
    }
    const r = optimizeTitles(clean, subreddit);
    setResult(r);
    const top = r.titles[0];
    saveHistory({
      ts: Date.now(),
      subreddit: r.canonicalSubreddit,
      topic: r.topic,
      titleCount: r.titles.length,
      topScore: top.score,
      topTitle: top.text,
    });
    setHistory(loadHistory());
    toast.success(`Generated ${r.titles.length} title options — top score ${top.score}/100`);
  }, [draft, subreddit]);

  const handleClear = useCallback(() => {
    setDraft("");
    setSubreddit("");
    setResult(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadSample = useCallback((s: { subreddit: string; draft: string }) => {
    setDraft(s.draft);
    setSubreddit(s.subreddit);
    toast.info("Sample loaded");
  }, []);

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your LLM API key first");
      return;
    }
    const clean = normalizeInput(draft);
    if (!clean) {
      toast.error("Enter a post draft first");
      return;
    }
    setLlmLoading(true);
    try {
      const sys = buildLlmPrompt(clean, subreddit);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llmKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are an expert Reddit strategist." },
            { role: "user", content: sys },
          ],
          temperature: 0.5,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content ?? "";
      const parsed = parseLlmResult(text);
      if (parsed.length === 0) throw new Error("No titles returned");
      toast.success(`LLM returned ${parsed.length} extra titles`);
      // Show LLM titles as a separate toast log
      parsed.forEach((p) => toast(`[${p.angle}] ${p.title}`));
    } catch (e) {
      toast.error(`LLM call failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, draft, subreddit]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rpt-draft">Post draft (what you want to post)</Label>
            <Textarea
              id="rpt-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={"Paste the body of your post. The optimizer will extract a topic and generate title options."}
              className="min-h-[100px] resize-y text-xs"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Target subreddit</Label>
              <Input
                value={subreddit}
                onChange={(e) => setSubreddit(e.target.value)}
                placeholder={"AskReddit"}
                className="mt-1 h-8 text-xs font-mono"
              />
            </div>
            <div className="sm:col-span-1">
              <Label className="text-xs">Preset match</Label>
              <div className="mt-1 h-8 flex items-center text-xs">
                {presetInfo.preset ? (
                  <Badge variant="secondary" className="text-[10px]">r/{presetInfo.preset.name}</Badge>
                ) : (
                  <span className="text-muted-foreground text-[10px]">No preset — generic rules apply</span>
                )}
              </div>
            </div>
            <div className="flex items-end">
              <Button onClick={handleRun} className="h-8 gap-1.5 text-xs w-full">
                <Sparkles className="h-3.5 w-3.5" /> Generate titles
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {SAMPLE_DRAFTS.map((s) => (
              <Button
                key={s.label}
                variant="ghost"
                size="sm"
                className="h-6 text-[11px]"
                onClick={() => handleLoadSample(s)}
              >+ {s.label}</Button>
            ))}
          </div>
          {presetInfo.preset && (
            <div className="rounded border bg-background px-3 py-2 text-[11px] text-muted-foreground">
              <span className="text-foreground font-medium">r/{presetInfo.preset.name}</span> · {presetInfo.preset.tone} ·
              char limit <span className="text-foreground font-mono">{presetInfo.preset.charLimit}</span> ·
              preferred angles <span className="text-foreground">{presetInfo.preset.preferredAngles.map((a) => ANGLE_LABELS[a]).join(", ")}</span>
              <div className="mt-1">Rules: {presetInfo.preset.rules.join(" ")}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {result ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <MessageCircle className="h-4 w-4" /> {result.titles.length} title options
                  {!result.known && <Badge variant="outline" className="text-[10px] ml-1">generic rules</Badge>}
                </h3>
                <div className="text-[11px] text-muted-foreground">
                  Topic: <span className="font-mono text-foreground">{result.topic || "(empty)"}</span>
                </div>
              </div>
              <div className="space-y-2">
                {result.titles.map((t, i) => (
                  <TitleCard key={i} title={t} rank={i + 1} />
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => { saveCurrentHistory(result); return renderTitlesOnly(result); }} label="Copy titles only" />
                <CopyButton getText={() => renderText(result)} label="Copy full report" />
                <DownloadButton
                  getText={() => renderMarkdown(result)}
                  filename="reddit-titles.md"
                  mime="text/markdown"
                  label="Download .md"
                />
                <DownloadButton
                  getText={() => renderJson(result)}
                  filename="reddit-titles.json"
                  mime="application/json"
                  label="Download JSON"
                />
                <ShareButton getUrl={() => { saveCurrentHistory(result); return buildShareUrl(draft, subreddit); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          {result.abPair && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Gauge className="h-4 w-4" /> A/B pair (different angles)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[result.abPair[0], result.abPair[1]].map((t, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-[10px]">{i === 0 ? "A" : "B"}</Badge>
                        <Badge variant="outline" className="text-[10px]">{ANGLE_LABELS[t.angle]}</Badge>
                        <span className="text-muted-foreground ml-auto">{t.score}/100</span>
                      </div>
                      <p className="font-mono text-foreground text-xs">{t.text}</p>
                      <div className="text-[10px] text-muted-foreground mt-1">{t.charCount}/{t.charLimit} chars</div>
                      <CopyButton getText={() => t.text} label={`Copy ${i === 0 ? "A" : "B"}`} size="sm" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Rule reminders
              </h3>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {result.rulesReminder.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-foreground">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter your draft and subreddit to generate titles"
          hint="Paste what you want to post, name the target subreddit, and click Generate. Five subreddit-aware, non-clickbait titles will be scored 0–100."
          icon={<MessageCircle className="h-8 w-8" />}
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
                Paste your own OpenAI API key to ask GPT for additional subreddit-tuned title options. The key is stored only in this browser tab and sent directly to OpenAI — never to us.
              </p>
              <Input
                type="password"
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder="sk-..."
                className="font-mono text-xs"
              />
              <Button onClick={handleLlmEnhance} disabled={llmLoading} size="sm" className="gap-1.5 text-xs">
                {llmLoading ? "Working…" : "Enhance with LLM"}
              </Button>
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
                    <Badge variant="outline" className="text-[10px]">{h.topScore}/100</Badge>
                    <Badge variant="outline" className="text-[10px]">r/{h.subreddit}</Badge>
                    <span className="text-muted-foreground text-[11px] truncate">{h.topTitle}</span>
                    <span className="text-muted-foreground ml-auto text-[10px]">{new Date(h.ts).toLocaleString()}</span>
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
            <strong className="text-foreground">Privacy:</strong> All title generation, scoring, and flagging run locally in your browser. The only network call is if you paste your own LLM API key.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function saveCurrentHistory(r: OptimizationResult) {
  if (r.titles.length === 0) return;
  const top = r.titles[0];
  saveHistory({
    ts: r.generatedAt,
    subreddit: r.canonicalSubreddit,
    topic: r.topic,
    titleCount: r.titles.length,
    topScore: top.score,
    topTitle: top.text,
  });
}

function TitleCard({ title, rank }: { title: TitleOption; rank: number }) {
  const scoreColor = title.score >= 75
    ? "text-emerald-600 dark:text-emerald-400"
    : title.score >= 50
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";
  const barColor = title.score >= 75
    ? "bg-emerald-500"
    : title.score >= 50
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className="rounded border bg-background px-3 py-2 text-xs space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-muted-foreground text-[10px] w-4">#{rank}</span>
        <Badge variant="outline" className="text-[10px]">{ANGLE_LABELS[title.angle]}</Badge>
        <span className={`font-bold ${scoreColor}`}>{title.score}</span>
        <span className="text-muted-foreground text-[10px]">/100</span>
        <Badge variant="secondary" className="text-[10px] ml-1">auth {title.authenticity}</Badge>
        {title.clickbaitRisk > 0 && (
          <Badge variant="destructive" className="text-[10px]">clickbait {title.clickbaitRisk}</Badge>
        )}
        {title.overLimit && (
          <Badge variant="destructive" className="text-[10px]">over limit</Badge>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">{title.charCount}/{title.charLimit} chars</span>
      </div>
      <p className="font-mono text-foreground text-sm">{title.text}</p>
      <div className="h-1 rounded bg-muted overflow-hidden">
        <div className={`h-full ${barColor}`} style={{ width: `${title.score}%` }} />
      </div>
      {title.ruleRisks.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {title.ruleRisks.map((r) => (
            <Badge key={r} variant="outline" className="text-[9px] text-amber-700 dark:text-amber-300">
              {RULE_RISK_LABELS[r]}
            </Badge>
          ))}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground pt-0.5">{title.whyItFits}</p>
      <div className="flex gap-1 pt-1">
        <CopyButton getText={() => title.text} label="Copy" size="sm" />
      </div>
    </div>
  );
}

// Suppress unused import warning
export type _Unused = typeof DEFAULT_CHAR_LIMIT;
