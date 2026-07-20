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
  Wand2, History, Sparkles, Gauge, Tag, FileText, Key, Plus, Minus,
} from "lucide-react";
import {
  TARGET_MODEL_LABELS,
  USE_CASE_LABELS,
  USE_CASE_PRESETS,
  DEFAULT_OPTIONS,
  normalizePrompt,
  analyzePrompt,
  scorePrompt,
  suggestImprovements,
  rewritePrompt,
  fillTemplate,
  buildNegativeConstraints,
  renderAnalysisText,
  renderMarkdown,
  renderJson,
  renderDiffText,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type TargetModel,
  type UseCase,
  type RewriteResult,
  type HistoryEntry,
} from "./logic";

const TARGET_MODELS: TargetModel[] = ["gpt4", "claude", "gemini", "local"];
const USE_CASES: UseCase[] = ["general", "coding", "writing", "image-gen", "analysis", "agent-system-prompt"];

export default function AIPromptImprover() {
  const [prompt, setPrompt] = useState("");
  const [targetModel, setTargetModel] = useState<TargetModel>(DEFAULT_OPTIONS.targetModel);
  const [useCase, setUseCase] = useState<UseCase>(DEFAULT_OPTIONS.useCase);
  const [result, setResult] = useState<RewriteResult | null>(null);
  const [negInput, setNegInput] = useState("");
  const [negBlock, setNegBlock] = useState("");
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [llmKey, setLlmKey] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [showLlm, setShowLlm] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.prompt) setPrompt(p.prompt);
      setTargetModel(p.targetModel);
      setUseCase(p.useCase);
      if (p.prompt) toast.info("Loaded from share link");
    }
  }, []);

  const analysis = useMemo(() => analyzePrompt(prompt), [prompt]);
  const score = useMemo(() => scorePrompt(prompt), [prompt]);
  const suggestions = useMemo(() => suggestImprovements(prompt, useCase), [prompt, useCase]);

  const handleRun = useCallback(() => {
    const clean = normalizePrompt(prompt);
    if (!clean) {
      toast.error("Enter a prompt to improve");
      return;
    }
    const r = rewritePrompt(clean, { targetModel, useCase });
    if (negBlock) {
      r.improved = `${r.improved}\n\n${negBlock}`;
    }
    setResult(r);
    saveHistory({
      ts: Date.now(),
      originalLength: clean.length,
      improvedLength: r.improved.length,
      overallScore: r.analysis.overall,
      targetModel,
      useCase,
      variableCount: r.variables.length,
    });
    setHistory(loadHistory());
    toast.success(`Score: ${r.analysis.overall}/100 — prompt improved`);
  }, [prompt, targetModel, useCase, negBlock]);

  const handleAddNegative = useCallback(() => {
    const items = negInput.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    if (items.length === 0) return;
    const block = buildNegativeConstraints(items);
    setNegBlock((prev) => (prev ? `${prev}\n${block}` : block));
    setNegInput("");
    toast.success("Added negative constraints");
  }, [negInput]);

  const handleClear = useCallback(() => {
    setPrompt("");
    setResult(null);
    setNegBlock("");
    setNegInput("");
    setTemplateValues({});
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your LLM API key first");
      return;
    }
    setLlmLoading(true);
    try {
      const sys = buildLlmPrompt(prompt, targetModel, useCase);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llmKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are an expert prompt engineer." },
            { role: "user", content: sys },
          ],
          temperature: 0.4,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content ?? "";
      if (!text) throw new Error("Empty response");
      const out = renderLlmResult(text, prompt);
      setResult((prev) => prev ? { ...prev, improved: out.improved, template: out.template, variables: out.variables } : prev);
      toast.success("LLM enhancement applied");
    } catch (e) {
      toast.error(`LLM call failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, prompt, targetModel, useCase]);

  const filledTemplate = useMemo(() => {
    if (!result) return "";
    return fillTemplate(result.template, templateValues);
  }, [result, templateValues]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="api-prompt">Paste your prompt</Label>
            <Textarea
              id="api-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={"write a thing about stuff"}
              className="min-h-[80px] resize-y font-mono text-xs"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Target model</Label>
              <select
                value={targetModel}
                onChange={(e) => setTargetModel(e.target.value as TargetModel)}
                className="mt-1 h-8 w-full text-xs rounded border bg-background px-2"
              >
                {TARGET_MODELS.map((m) => (
                  <option key={m} value={m}>{TARGET_MODEL_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Use case</Label>
              <select
                value={useCase}
                onChange={(e) => setUseCase(e.target.value as UseCase)}
                className="mt-1 h-8 w-full text-xs rounded border bg-background px-2"
              >
                {USE_CASES.map((u) => (
                  <option key={u} value={u}>{USE_CASE_LABELS[u]}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleRun} className="h-8 gap-1.5 text-xs w-full">
                <Wand2 className="h-3.5 w-3.5" /> Improve
              </Button>
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Use-case preset: <span className="font-mono text-foreground">{USE_CASE_PRESETS[useCase].role}</span> ·{" "}
            <span className="text-foreground">{USE_CASE_PRESETS[useCase].constraints.length}</span> constraints
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Gauge className="h-4 w-4" /> Live score
          </h3>
          {prompt.trim() ? (
            <>
              <div className="flex items-baseline gap-3">
                <span className={`text-3xl font-bold ${scoreColor(score)}`}>{score}</span>
                <span className="text-xs text-muted-foreground">/ 100</span>
                <span className="text-xs text-muted-foreground">· {analysis.wordCount} words · {analysis.charCount} chars</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {([analysis.clarity, analysis.specificity, analysis.context, analysis.constraints, analysis.format, analysis.examples] as const).map((d) => (
                  <div key={d.dimension} className="rounded border bg-background px-2 py-1.5">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
                      <span>{d.dimension}</span>
                      <span className={scoreColor(d.score)}>{d.score}</span>
                    </div>
                    <div className="mt-1 h-1 rounded bg-muted overflow-hidden">
                      <div className={`h-full ${barColor(d.score)}`} style={{ width: `${d.score}%` }} />
                    </div>
                    {d.tips.length > 0 && (
                      <div className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{d.tips[0]}</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Enter a prompt to see its score.</p>
          )}
        </CardContent>
      </Card>

      {suggestions.length > 0 && prompt.trim() && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" /> Suggestions ({suggestions.length})
            </h3>
            <div className="space-y-1.5">
              {suggestions.map((s) => (
                <div key={s.id} className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{s.type}</Badge>
                    <span className="font-medium text-foreground">{s.title}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{s.reason}</p>
                  <pre className="mt-1 text-[10px] text-muted-foreground whitespace-pre-wrap font-mono">{s.snippet}</pre>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Minus className="h-4 w-4" /> Negative constraints (optional)
          </h3>
          <Textarea
            value={negInput}
            onChange={(e) => setNegInput(e.target.value)}
            placeholder={"use jargon\nexceed 100 words"}
            className="min-h-[60px] resize-y font-mono text-xs"
          />
          <div className="flex gap-2">
            <Button onClick={handleAddNegative} variant="outline" size="sm" className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
            {negBlock && (
              <Button onClick={() => setNegBlock("")} variant="ghost" size="sm" className="text-xs">Clear block</Button>
            )}
          </div>
          {negBlock && (
            <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap font-mono rounded border bg-background px-2 py-1">{negBlock}</pre>
          )}
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Improved prompt
                </h3>
                <Badge variant="secondary" className="text-[10px]">{result.tokenEstimate} tokens</Badge>
              </div>
              <Textarea
                value={result.improved}
                readOnly
                className="min-h-[200px] resize-y font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => result.improved} label="Copy improved" />
                <DownloadButton
                  getText={() => renderMarkdown(result)}
                  filename="improved-prompt.md"
                  mime="text/markdown"
                  label="Download .md"
                />
                <DownloadButton
                  getText={() => renderJson(result)}
                  filename="improved-prompt.json"
                  mime="application/json"
                  label="Download JSON"
                />
                <ShareButton getUrl={() => buildShareUrl(prompt, targetModel, useCase)} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Tag className="h-4 w-4" /> Variables + template
              </h3>
              {result.variables.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {result.variables.map((v) => (
                      <div key={v.name} className="rounded border bg-background px-2 py-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-mono">{`{{${v.name}}}`}</Badge>
                          <span className="text-muted-foreground text-[10px]">was: <span className="font-mono text-foreground">{v.original}</span></span>
                        </div>
                        <Input
                          value={templateValues[v.name] ?? ""}
                          onChange={(e) => setTemplateValues((prev) => ({ ...prev, [v.name]: e.target.value }))}
                          placeholder={`value for ${v.name}`}
                          className="mt-1 h-7 text-xs font-mono"
                        />
                      </div>
                    ))}
                  </div>
                  <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap font-mono rounded border bg-background px-2 py-1 max-h-[200px] overflow-auto">{filledTemplate}</pre>
                  <CopyButton getText={() => filledTemplate} label="Copy filled template" />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No variables extracted — the improved prompt is already a final template.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Plus className="h-4 w-4" /> Diff (added lines)
              </h3>
              <pre className="text-[10px] whitespace-pre-wrap font-mono rounded border bg-background px-2 py-1 max-h-[300px] overflow-auto">{renderDiffText(result.diff)}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Gauge className="h-4 w-4" /> Analysis detail
              </h3>
              <pre className="text-[10px] whitespace-pre-wrap font-mono rounded border bg-background px-2 py-1">{renderAnalysisText(result.analysis)}</pre>
            </CardContent>
          </Card>
        </>
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
                Paste your own OpenAI API key to send the prompt to GPT for a richer rewrite. The key is stored only in this browser tab and sent directly to OpenAI — never to us.
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
                  <Badge variant="outline" className="mr-2">{h.overallScore}/100</Badge>
                  <Badge variant="outline" className="mr-2">{TARGET_MODEL_LABELS[h.targetModel]}</Badge>
                  <Badge variant="outline" className="mr-2">{USE_CASE_LABELS[h.useCase]}</Badge>
                  <span className="text-muted-foreground">{h.variableCount} vars · {h.improvedLength} chars</span>
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
            <strong className="text-foreground">Privacy:</strong> All analysis and rewriting run locally in your browser. The only network call is if you paste your own LLM API key.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function barColor(score: number): string {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}
