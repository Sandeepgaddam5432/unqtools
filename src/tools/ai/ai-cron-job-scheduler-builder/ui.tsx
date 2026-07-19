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
  CRON_MACROS,
  NL_PRESETS,
  listTimezones,
  parseNaturalLanguage,
  parseCron,
  validateCron,
  explainCron,
  detectDomDowUnion,
  computeNextRuns,
  cronToCrontabLine,
  cronToSystemdTimer,
  formatRunDate,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  LLM_KEY_STORAGE,
  type CronFlavor,
  type HistoryEntry,
  type LlmEnhancement,
} from "./logic";
import {
  Clock, Sparkles, Key, History, AlertTriangle,
  Calendar, Terminal, Copy, Wand2,
} from "lucide-react";

type Tab = "runs" | "systemd" | "crontab";

export default function AiCronJobSchedulerBuilder() {
  const [nlInput, setNlInput] = useState("");
  const [expr, setExpr] = useState("");
  const [flavor, setFlavor] = useState<CronFlavor>("standard");
  const [tz, setTz] = useState("UTC");
  const [runCount, setRunCount] = useState(5);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [tab, setTab] = useState<Tab>("runs");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<LlmEnhancement | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined" ? localStorage.getItem(LLM_KEY_STORAGE) : null;
    if (key) setLlmKey(key);
    try {
      const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (localTz) setTz(localTz);
    } catch {
      // keep UTC default
    }
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.expression) {
        setExpr(p.expression);
        setFlavor(p.flavor);
        if (p.tz) setTz(p.tz);
        if (p.count !== undefined) setRunCount(p.count);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const validation = useMemo(() => validateCron(expr), [expr]);
  const explanation = useMemo(() => (expr ? explainCron(expr) : ""), [expr]);
  const parsed = useMemo(() => parseCron(expr), [expr]);
  const unionWarning = useMemo(() => (expr ? detectDomDowUnion(parsed) : { isUnion: false, explanation: "" }), [expr, parsed]);
  const runs = useMemo(() => {
    if (!validation.valid) return [];
    return computeNextRuns(expr, new Date(), Math.min(Math.max(runCount, 1), 20), tz).runs;
  }, [expr, validation.valid, runCount, tz]);

  const tzs = useMemo(() => listTimezones(), []);

  const handleParseNl = useCallback(() => {
    if (!nlInput.trim()) {
      toast.error("Enter a schedule in plain English first");
      return;
    }
    const r = parseNaturalLanguage(nlInput);
    if (!r.expression) {
      toast.error(r.note || "Could not parse that schedule");
      return;
    }
    setExpr(r.expression);
    setFlavor(r.flavor);
    if (r.note) toast.info(r.note);
    toast.success(`Parsed → ${r.expression}`);
    saveHistory({ ts: Date.now(), flavor: r.flavor, expression: r.expression, description: nlInput });
    setHistory(loadHistory());
  }, [nlInput]);

  const handleValidateAndSave = useCallback(() => {
    if (!expr) return;
    const v = validateCron(expr);
    if (!v.valid) {
      toast.error(`Invalid: ${v.errors[0]}`);
      return;
    }
    saveHistory({ ts: Date.now(), flavor, expression: expr, description: explanation });
    setHistory(loadHistory());
    toast.success("Saved to history");
  }, [expr, flavor, explanation]);

  const handleClear = useCallback(() => {
    setExpr("");
    setNlInput("");
    setLlmResult(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const crontabLine = useMemo(() => (expr ? cronToCrontabLine(expr) : ""), [expr]);
  const systemdSnippet = useMemo(() => (expr ? cronToSystemdTimer(expr, "myjob") : ""), [expr]);

  const copyRunsText = useCallback(() => {
    return runs.map((d, i) => `${i + 1}. ${formatRunDate(d, tz)}`).join("\n");
  }, [runs, tz]);

  // ---- LLM polish (BYO key) ----
  const handleLlm = useCallback(async () => {
    if (!llmKey) { toast.error("Paste your LLM API key first"); return; }
    if (!nlInput.trim()) { toast.error("Enter a schedule to polish"); return; }
    setLlmLoading(true); setLlmError("");
    try {
      const prompt = buildLlmPrompt(nlInput);
      const out = await callLlm(llmProvider, llmKey, prompt);
      const r = renderLlmResult(out);
      setLlmResult(r);
      if (r.expression) {
        setExpr(r.expression);
        setFlavor(validateCron(r.expression).valid ? flavor : r.expression.split(" ").length >= 6 ? "quartz" : "standard");
        toast.success("LLM polish applied");
      }
    } catch (e) {
      setLlmError(e instanceof Error ? e.message : "LLM call failed");
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, nlInput, flavor]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cron-nl" className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Describe your schedule in plain English
            </Label>
            <Textarea
              id="cron-nl"
              value={nlInput}
              onChange={(e) => setNlInput(e.target.value)}
              placeholder={"e.g., every 5 minutes\ndaily at 9am\nevery Monday at 6pm\nmonthly on the 15th at noon"}
              className="min-h-[80px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {NL_PRESETS.slice(0, 12).map((p) => (
                <Button
                  key={p}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] font-mono"
                  onClick={() => setNlInput(p)}
                >+ {p}</Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleParseNl} label="Parse → cron" />
            <Button variant="outline" size="sm" onClick={() => setShowLlm((v) => !v)} className="gap-1.5">
              <Wand2 className="h-3.5 w-3.5" /> {showLlm ? "Hide" : "Show"} LLM polish
            </Button>
          </div>
        </CardContent>
      </Card>

      {showLlm && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Key className="h-4 w-4" /> Bring your own key (optional)
            </h3>
            <p className="text-xs text-muted-foreground">
              Optional — paste your own OpenAI or Anthropic API key. The key is stored only in this browser&apos;s localStorage; the request goes directly to the provider.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
              <Input
                type="password"
                placeholder="sk-…"
                value={llmKey}
                onChange={(e) => {
                  setLlmKey(e.target.value);
                  if (typeof localStorage !== "undefined") {
                    try { localStorage.setItem(LLM_KEY_STORAGE, e.target.value); } catch { /* ignore */ }
                  }
                }}
                className="h-8 font-mono text-xs max-w-xs"
              />
              <RunButton onClick={handleLlm} label="Polish with LLM" loading={llmLoading} />
            </div>
            {llmError && <ErrorBanner message={llmError} />}
            {llmResult && (
              <div className="rounded border bg-background p-3 text-xs space-y-2">
                <div><strong>Expression:</strong> <code className="font-mono">{llmResult.expression}</code></div>
                <div><strong>Explanation:</strong> {llmResult.explanation}</div>
                {llmResult.alternatives.length > 0 && (
                  <div><strong>Alternatives:</strong> {llmResult.alternatives.map((a, i) => <code key={i} className="font-mono mr-2">{a}</code>)}</div>
                )}
                {llmResult.suggestions.length > 0 && (
                  <ul className="list-disc pl-4 space-y-0.5">
                    {llmResult.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cron-expr" className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Cron expression (or macro)
            </Label>
            <Input
              id="cron-expr"
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              placeholder={"0 9 * * *  or  @daily  or  0 0 9 ? * *  (Quartz)"}
              className="font-mono text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {Object.keys(CRON_MACROS).map((m) => (
                <Button
                  key={m}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] font-mono"
                  onClick={() => { setExpr(m); setFlavor("standard"); }}
                >{m}</Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="rounded border bg-background px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Flavor</div>
              <select
                value={flavor}
                onChange={(e) => setFlavor(e.target.value as CronFlavor)}
                className="bg-transparent text-sm font-semibold w-full"
              >
                <option value="standard">Standard (5-field)</option>
                <option value="quartz">Quartz (6/7-field)</option>
              </select>
            </div>
            <div className="rounded border bg-background px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Timezone</div>
              <select
                value={tz}
                onChange={(e) => setTz(e.target.value)}
                className="bg-transparent text-sm font-semibold w-full"
              >
                {tzs.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="rounded border bg-background px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Next N runs</div>
              <select
                value={runCount}
                onChange={(e) => setRunCount(parseInt(e.target.value, 10))}
                className="bg-transparent text-sm font-semibold w-full"
              >
                {[1, 3, 5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="rounded border bg-background px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Fields</div>
              <div className="text-sm font-semibold">{parsed.fields.length || 0} / {flavor === "quartz" ? "6-7" : "5"}</div>
            </div>
          </div>

          {expr && !validation.valid && (
            <ErrorBanner message={`Invalid: ${validation.errors.join("; ")}`} />
          )}

          {expr && validation.valid && explanation && (
            <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium mb-1">
                <Sparkles className="h-3.5 w-3.5" /> Plain-English explanation
              </div>
              <p className="text-foreground">{explanation}</p>
            </div>
          )}

          {unionWarning.isUnion && (
            <div className="rounded border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
              <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium mb-1">
                <AlertTriangle className="h-3.5 w-3.5" /> DOM/DOW union gotcha
              </div>
              <p className="text-foreground">{unionWarning.explanation}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => expr} label="Copy expression" disabled={!expr} />
            <CopyButton getText={() => copyRunsText()} label="Copy runs" disabled={runs.length === 0} />
            <DownloadButton getText={() => copyRunsText()} filename="cron-next-runs.txt" label="Download runs" disabled={runs.length === 0} />
            <ShareButton
              getUrl={() => { handleValidateAndSave(); return buildShareUrl({ expression: expr, flavor, tz, count: runCount }); }}
              disabled={!expr || !validation.valid}
            />
            <ClearButton onClick={handleClear} disabled={!expr && !nlInput} />
          </div>
        </CardContent>
      </Card>

      {expr && validation.valid && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> Next {runs.length} run{runs.length === 1 ? "" : "s"} ({tz})
              </h3>
              <div className="flex gap-1">
                {(["runs", "crontab", "systemd"] as Tab[]).map((t) => (
                  <Button
                    key={t}
                    variant={tab === t ? "default" : "ghost"}
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => setTab(t)}
                  >
                    {t === "runs" ? "Next runs" : t === "crontab" ? "crontab" : "systemd"}
                  </Button>
                ))}
              </div>
            </div>

            {tab === "runs" && (
              <div className="space-y-1 max-h-[400px] overflow-auto">
                {runs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No upcoming runs found.</p>
                ) : (
                  runs.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                      <Badge variant="outline" className="text-[10px] w-6 justify-center">{i + 1}</Badge>
                      <span className="font-mono text-foreground">{formatRunDate(d, tz)}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "crontab" && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Terminal className="h-3.5 w-3.5" /> Add this line to your crontab:
                </div>
                <pre className="rounded border bg-muted/40 p-3 text-xs font-mono whitespace-pre-wrap overflow-x-auto">
                  {crontabLine}
                </pre>
                <CopyButton getText={() => crontabLine} label="Copy crontab line" />
              </div>
            )}

            {tab === "systemd" && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Terminal className="h-3.5 w-3.5" /> systemd timer + service snippet:
                </div>
                <pre className="rounded border bg-muted/40 p-3 text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-[400px]">
                  {systemdSnippet}
                </pre>
                <CopyButton getText={() => systemdSnippet} label="Copy snippet" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {expr && validation.valid && parsed.fields.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Copy className="h-4 w-4" /> Field breakdown
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {parsed.fields.map((f, i) => {
                const names = parsed.hasSeconds
                  ? ["second", "minute", "hour", "day-of-month", "month", "day-of-week"]
                  : ["minute", "hour", "day-of-month", "month", "day-of-week"];
                const name = names[i] ?? (parsed.hasYear ? "year" : "");
                return (
                  <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{name}</Badge>
                    <code className="font-mono text-foreground">{f}</code>
                    <span className="text-muted-foreground text-[10px] ml-auto">
                      {parsed.parsed[i]?.values.length ?? 0} value{(parsed.parsed[i]?.values.length ?? 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {!expr && (
        <EmptyState
          title="Describe a schedule or enter a cron expression"
          hint="Try 'every 5 minutes', 'daily at 9am', 'every Monday at 6pm'. Standard 5-field and Quartz 6/7-field both supported."
          icon={<Clock className="h-8 w-8" />}
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
                  type="button"
                  onClick={() => { setExpr(h.expression); setFlavor(h.flavor); toast.info(`Loaded: ${h.expression}`); }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:border-primary"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.flavor}</Badge>
                  <code className="font-mono text-foreground">{h.expression}</code>
                  {h.description && (
                    <span className="text-muted-foreground ml-2">— {h.description}</span>
                  )}
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy & honesty:</strong> All parsing, validation, explanation, next-run calculation, and format conversion run locally. The natural-language parser is rule-based (best-effort); the optional BYO-key LLM is stronger for tricky phrasing. Run production servers in UTC and always validate the schedule.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- LLM fetch helper (touches network — kept out of logic.ts) ----------

async function callLlm(provider: "openai" | "anthropic", key: string, prompt: string): Promise<string> {
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You convert plain-English schedules to cron expressions and return raw JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.content?.map((c: { text?: string }) => c.text ?? "").join("") ?? "";
}
