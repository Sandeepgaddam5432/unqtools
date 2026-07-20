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
  Handshake, History, Key, Sparkles, MessageCircle, Mail, Shield, ListChecks,
} from "lucide-react";
import {
  HISTORY_MAX,
  SCENARIO_LABELS,
  SCENARIO_HINTS,
  TONE_LABELS,
  TONE_HINTS,
  OBJECTION_LABELS,
  LEVERAGE_LABELS,
  NON_SALARY_LEVER_LABELS,
  ROLE_PLAY_PRESETS,
  formatSalary,
  normalizeText,
  computeAnchorRange,
  validateInput,
  generateScript,
  renderScriptText,
  renderScriptCsv,
  buildLlmPrompt,
  renderLlmResult,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Scenario,
  type Tone,
  type LeverageKey,
  type NonSalaryLeverKey,
  type NegotiationInput,
  type NegotiationScript,
  type HistoryEntry,
} from "./logic";

const SCENARIOS: Scenario[] = ["initial-ask", "counter-offer", "final-offer"];
const TONES: Tone[] = ["confident", "collaborative"];
const LEVERAGE_KEYS = Object.keys(LEVERAGE_LABELS) as LeverageKey[];
const NLEVER_KEYS = Object.keys(NON_SALARY_LEVER_LABELS) as NonSalaryLeverKey[];

export default function AiSalaryNegotiationScriptWriter() {
  const [input, setInput] = useState<NegotiationInput>({
    scenario: "counter-offer",
    tone: "confident",
    role: "",
    companyName: "",
    hiringManager: "",
    currentSalary: null,
    offerSalary: null,
    targetSalary: 0,
    location: "",
    leverage: [],
    levers: [],
    customLeverageNote: "",
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmOutput, setLlmOutput] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-salary-negotiation-script-writer:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setInput((prev) => ({ ...prev, ...p }));
      if (Object.keys(p).length > 0) toast.info("Loaded from share link");
    }
  }, []);

  const script: NegotiationScript | null = useMemo(() => {
    const errs = validateInput(input);
    if (errs.length > 0) {
      return null;
    }
    return generateScript(input);
  }, [input]);

  const scriptText = useMemo(() => script ? renderScriptText(script) : "", [script]);
  const scriptCsv = useMemo(() => script ? renderScriptCsv(script) : "", [script]);
  const anchor = useMemo(() => computeAnchorRange(input.targetSalary || 0), [input.targetSalary]);

  const setField = useCallback(<K extends keyof NegotiationInput>(key: K, value: NegotiationInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleArr = useCallback(<T extends string>(key: "leverage" | "levers", value: T) => {
    setInput((prev) => {
      const arr = prev[key] as unknown as string[];
      const next = arr.includes(value)
        ? arr.filter((v) => v !== value)
        : [...arr, value];
      return { ...prev, [key]: next } as NegotiationInput;
    });
  }, []);

  const handleClear = useCallback(() => {
    setInput({
      scenario: "counter-offer", tone: "confident", role: "", companyName: "",
      hiringManager: "", currentSalary: null, offerSalary: null, targetSalary: 0,
      location: "", leverage: [], levers: [], customLeverageNote: "",
    });
    setErrors([]);
    setLlmOutput("");
    setLlmError("");
    toast.info("Cleared");
  }, []);

  const handleSample = useCallback((s: { label: string; input: NegotiationInput }) => {
    setInput({ ...s.input });
    toast.info(`Loaded sample: ${s.label}`);
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (!script) return;
    saveHistory({
      ts: Date.now(),
      scenario: input.scenario,
      tone: input.tone,
      role: normalizeText(input.role),
      targetSalary: input.targetSalary,
      offerSalary: input.offerSalary,
      anchorHigh: script.anchorRange.high,
      leverage: input.leverage,
      nonSalaryLeverCount: input.levers.length,
    });
    setHistory(loadHistory());
  }, [script, input]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleEnhanceWithLlm = useCallback(async () => {
    if (!llmKey) { setLlmError("Enter an API key first."); return; }
    if (!script) { setLlmError("Fix input errors first."); return; }
    setLlmLoading(true);
    setLlmError("");
    setLlmOutput("");
    try {
      const prompt = buildLlmPrompt(input, script);
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
            { role: "system", content: "You are a senior career coach and salary negotiation expert." },
            { role: "user", content: prompt },
          ],
          max_tokens: 800,
          temperature: 0.4,
        })
        : JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 800,
          system: "You are a senior career coach and salary negotiation expert.",
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
      setLlmOutput(renderLlmResult(out));
      toast.success("LLM enhancement complete");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setLlmError(msg);
      toast.error("LLM enhancement failed");
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, script, input]);

  const handleSaveLlmKey = useCallback((v: string) => {
    setLlmKey(v);
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("unqtools:ai-salary-negotiation-script-writer:llm-key", v);
      } catch {
        // ignore
      }
    }
  }, []);

  const validationErrors = useMemo(() => validateInput(input), [input]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Scenario + Tone */}
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Scenario</Label>
              <div className="flex flex-wrap gap-1 pt-1">
                {SCENARIOS.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={input.scenario === s ? "default" : "outline"}
                    className="h-7 text-[11px]"
                    onClick={() => setField("scenario", s)}
                  >{SCENARIO_LABELS[s]}</Button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{SCENARIO_HINTS[input.scenario]}</p>
            </div>
            <div>
              <Label className="text-xs">Tone</Label>
              <div className="flex flex-wrap gap-1 pt-1">
                {TONES.map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={input.tone === t ? "default" : "outline"}
                    className="h-7 text-[11px]"
                    onClick={() => setField("tone", t)}
                  >{TONE_LABELS[t]}</Button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{TONE_HINTS[input.tone]}</p>
            </div>
          </div>

          {/* Role + Company + Manager */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="sns-role" className="text-xs">Role</Label>
              <Input
                id="sns-role"
                value={input.role}
                onChange={(e) => setField("role", e.target.value)}
                placeholder="Senior Software Engineer"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sns-company" className="text-xs">Company</Label>
              <Input
                id="sns-company"
                value={input.companyName}
                onChange={(e) => setField("companyName", e.target.value)}
                placeholder="Acme Corp"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sns-mgr" className="text-xs">Hiring manager (optional)</Label>
              <Input
                id="sns-mgr"
                value={input.hiringManager}
                onChange={(e) => setField("hiringManager", e.target.value)}
                placeholder="Jordan Lee"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Salary inputs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label htmlFor="sns-current" className="text-xs">Current salary</Label>
              <Input
                id="sns-current"
                type="number"
                value={input.currentSalary ?? ""}
                onChange={(e) => setField("currentSalary", e.target.value ? Number(e.target.value) : null)}
                placeholder="165000"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sns-offer" className="text-xs">Existing offer</Label>
              <Input
                id="sns-offer"
                type="number"
                value={input.offerSalary ?? ""}
                onChange={(e) => setField("offerSalary", e.target.value ? Number(e.target.value) : null)}
                placeholder="180000"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sns-target" className="text-xs">Target salary *</Label>
              <Input
                id="sns-target"
                type="number"
                value={input.targetSalary || ""}
                onChange={(e) => setField("targetSalary", e.target.value ? Number(e.target.value) : 0)}
                placeholder="210000"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sns-loc" className="text-xs">Location (optional)</Label>
              <Input
                id="sns-loc"
                value={input.location}
                onChange={(e) => setField("location", e.target.value)}
                placeholder="San Francisco, CA"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Leverage */}
          <div>
            <Label className="text-xs">Leverage framings (check all that apply)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
              {LEVERAGE_KEYS.map((k) => (
                <label key={k} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={input.leverage.includes(k)}
                    onChange={() => toggleArr<LeverageKey>("leverage", k)}
                  />
                  {LEVERAGE_LABELS[k]}
                </label>
              ))}
            </div>
          </div>

          {/* Non-salary levers */}
          <div>
            <Label className="text-xs">Non-salary levers to include</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
              {NLEVER_KEYS.map((k) => (
                <label key={k} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={input.levers.includes(k)}
                    onChange={() => toggleArr<NonSalaryLeverKey>("levers", k)}
                  />
                  {NON_SALARY_LEVER_LABELS[k]}
                </label>
              ))}
            </div>
          </div>

          {/* Custom note */}
          <div className="space-y-1">
            <Label htmlFor="sns-note" className="text-xs">Extra context (optional)</Label>
            <Textarea
              id="sns-note"
              value={input.customLeverageNote}
              onChange={(e) => setField("customLeverageNote", e.target.value)}
              placeholder="e.g. just promoted to staff scope, leading 4-person team"
              className="min-h-[60px] resize-y text-xs"
            />
          </div>

          {/* Sample scenarios */}
          <div className="flex flex-wrap gap-1">
            <span className="text-[11px] text-muted-foreground py-1">Try:</span>
            {ROLE_PLAY_PRESETS.map((s) => (
              <Button
                key={s.label}
                variant="ghost"
                size="sm"
                className="h-6 text-[11px]"
                onClick={() => handleSample(s)}
              >+ {s.label}</Button>
            ))}
          </div>

          {validationErrors.length > 0 && (
            <ErrorBanner message={validationErrors.join(" ")} />
          )}
        </CardContent>
      </Card>

      {script ? (
        <>
          {/* Anchor range + summary */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Shield className="h-4 w-4" /> Anchor range
                </h3>
                <Badge variant="outline" className="text-[10px]">
                  Confidence: {script.confidence}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat label="Floor (walk-away)" value={formatSalary(script.anchorRange.low)} highlight="warn" />
                <Stat label="Ask (your target)" value={formatSalary(script.anchorRange.mid)} highlight="good" />
                <Stat label="Stretch (open here)" value={formatSalary(script.anchorRange.high)} highlight="bad" />
              </div>
              <div className="rounded border bg-background p-3 text-xs text-muted-foreground">
                {script.summary}
              </div>
            </CardContent>
          </Card>

          {/* Email */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Mail className="h-4 w-4" /> Counter-offer email
              </h3>
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Subject</div>
                <div className="rounded border bg-background px-3 py-2 text-xs font-mono">
                  {script.email.subject}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Body</div>
                <pre className="whitespace-pre-wrap rounded border bg-background px-3 py-2 text-xs font-mono max-h-[300px] overflow-auto">
                  {script.email.body}
                </pre>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleSaveHistory(); return script.email.body; }} label="Copy email body" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          {/* Talking points */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <MessageCircle className="h-4 w-4" /> Talking points ({script.talkingPoints.length})
              </h3>
              <ol className="space-y-1.5 list-decimal list-inside text-xs">
                {script.talkingPoints.map((p, i) => (
                  <li key={i} className="rounded border bg-background px-3 py-2 text-xs leading-relaxed">
                    {p}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Objection responses */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                Objection responses ({script.objectionResponses.length})
              </h3>
              <div className="space-y-2 max-h-[500px] overflow-auto">
                {script.objectionResponses.map((o) => (
                  <div key={o.key} className="rounded border bg-background px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">{OBJECTION_LABELS[o.key]}</Badge>
                    </div>
                    <div className="font-mono text-muted-foreground mb-1">They say: {o.objection}</div>
                    <div className="text-foreground">You say: {o.response}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Non-salary levers */}
          {script.nonSalaryLevers.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Non-salary levers ({script.nonSalaryLevers.length})
                </h3>
                <div className="space-y-2">
                  {script.nonSalaryLevers.map((l) => (
                    <div key={l.key} className="rounded border bg-background px-3 py-2 text-xs">
                      <Badge variant="outline" className="text-[10px] mb-1">{l.label}</Badge>
                      <div className="text-foreground">{l.script}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Role-play Q&A */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                Role-play practice
              </h3>
              <div className="space-y-2">
                {script.rolePlayQa.map((q, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                    <div className="font-mono text-muted-foreground mb-1">Q: {q.question}</div>
                    <div className="text-foreground">A: {q.answer}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Benefits checklist */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ListChecks className="h-4 w-4" /> Benefits checklist
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                {script.benefitsChecklist.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-muted-foreground">☐</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Full-script downloads */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Full script</h3>
              <pre className="whitespace-pre-wrap rounded border bg-background px-3 py-2 text-xs font-mono max-h-[400px] overflow-auto">
                {scriptText}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleSaveHistory(); return scriptText; }} label="Copy full script" />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return scriptText; }}
                  filename="salary-negotiation-script.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => scriptCsv}
                  filename="salary-negotiation-script.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
              </div>
            </CardContent>
          </Card>

          {/* Optional BYO-key LLM */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Key className="h-4 w-4" /> Optional LLM enhancement (BYO key)
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLlm((v) => !v)}
                >{showLlm ? "Hide" : "Show"}</Button>
              </div>
              {showLlm && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    The on-device template engine above is the default. Optionally paste your own LLM API
                    key to refine the email and talking points — your input is sent directly from your
                    browser to the provider you choose, never to UnQTools.
                  </p>
                  <div className="flex flex-wrap gap-2">
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
                      placeholder={llmProvider === "openai" ? "sk-…" : "sk-ant-…"}
                      value={llmKey}
                      onChange={(e) => handleSaveLlmKey(e.target.value)}
                      className="h-8 text-xs flex-1 min-w-[200px]"
                    />
                    <Button
                      size="sm"
                      onClick={handleEnhanceWithLlm}
                      disabled={llmLoading || !llmKey || !script}
                      className="gap-1.5"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {llmLoading ? "Working…" : "Enhance"}
                    </Button>
                  </div>
                  {llmError && <ErrorBanner message={llmError} />}
                  {llmOutput && (
                    <pre className="whitespace-pre-wrap rounded border bg-background p-3 text-xs max-h-[300px] overflow-auto">
                      {llmOutput}
                    </pre>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter your scenario, role, and target salary to generate a script"
          hint="Pick a scenario (initial ask / counter-offer / final offer), enter your role + company + target, and check your leverage. The engine builds a counter-offer email, talking points, objection responses, and non-salary levers — all locally."
          icon={<Handshake className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{SCENARIO_LABELS[h.scenario]}</Badge>
                  <Badge variant="outline" className="mr-2">{TONE_LABELS[h.tone]}</Badge>
                  <Badge variant="outline" className="mr-2">{formatSalary(h.targetSalary)}</Badge>
                  <span className="text-muted-foreground">{h.role || "(role)"} · stretch {formatSalary(h.anchorHigh)} · {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy & honesty:</strong> All script generation runs
            locally in your browser — your salary details never leave this device. Scripts are guidance,
            not guarantees — outcomes depend on employer, market, and timing. Do your own market-rate
            research and consider local employment norms. The on-device template engine is less nuanced
            than a BYO-key LLM but works fully offline.
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
  highlight?: "good" | "warn" | "bad";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "warn"
      ? "text-amber-600 dark:text-amber-400"
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
