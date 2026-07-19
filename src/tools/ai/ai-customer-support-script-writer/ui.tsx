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
  SCENARIO_LABELS,
  SCENARIO_DESCRIPTIONS,
  CHANNEL_LABELS,
  TONE_LABELS,
  STAGE_LABELS,
  SCENARIO_LIST,
  VARIABLE_FIELDS,
  DEFAULT_BRAND_VOICE,
  loadBrandVoice,
  saveBrandVoice,
  generateScript,
  deEscalate,
  positiveLanguageRewrite,
  renderMarkdown,
  renderJson,
  renderText,
  loadHistory,
  saveHistory,
  clearHistory,
  loadMacros,
  saveMacro,
  deleteMacro,
  clearMacros,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  LLM_KEY_STORAGE,
  type Scenario,
  type Channel,
  type Tone,
  type ScriptVariables,
  type BrandVoice,
  type GeneratedScript,
  type HistoryEntry,
  type MacroEntry,
  type LlmEnhancement,
} from "./logic";
import {
  Headset, Sparkles, Key, History, AlertCircle, AlertTriangle,
  Wand2, Save, Trash2, BookOpen, Shield,
} from "lucide-react";

const EMPTY_VARS: ScriptVariables = {
  customerName: "",
  agentName: "",
  orderId: "",
  productName: "",
  companyName: "",
  issueSummary: "",
  ticketId: "",
};

export default function AiCustomerSupportScriptWriter() {
  const [scenario, setScenario] = useState<Scenario>("refund-request");
  const [channel, setChannel] = useState<Channel>("chat");
  const [tone, setTone] = useState<Tone>("empathetic");
  const [vars, setVars] = useState<ScriptVariables>(EMPTY_VARS);
  const [brandVoice, setBrandVoice] = useState<BrandVoice>(DEFAULT_BRAND_VOICE);
  const [showBrandVoice, setShowBrandVoice] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [macros, setMacros] = useState<MacroEntry[]>([]);
  const [macroName, setMacroName] = useState("");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<LlmEnhancement | null>(null);
  const [generated, setGenerated] = useState<GeneratedScript | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    setMacros(loadMacros());
    setBrandVoice(loadBrandVoice());
    const key = typeof localStorage !== "undefined" ? localStorage.getItem(LLM_KEY_STORAGE) : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setScenario(p.scenario);
      setChannel(p.channel);
      setTone(p.tone);
      if (p.vars) setVars((prev) => ({ ...prev, ...p.vars }));
      toast.info("Loaded from share link");
    }
  }, []);

  const handleGenerate = useCallback(() => {
    const g = generateScript(scenario, channel, tone, vars, brandVoice);
    setGenerated(g);
    saveHistory({
      ts: Date.now(),
      scenario,
      channel,
      tone,
      issueSummary: vars.issueSummary ?? "",
      preview: g.stages[0]?.text.slice(0, 100) ?? "",
    });
    setHistory(loadHistory());
    toast.success("Script generated");
  }, [scenario, channel, tone, vars, brandVoice]);

  const handleClear = useCallback(() => {
    setVars(EMPTY_VARS);
    setGenerated(null);
    setLlmResult(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSaveMacro = useCallback(() => {
    if (!generated) { toast.error("Generate a script first"); return; }
    const name = macroName.trim() || `${SCENARIO_LABELS[scenario]} (${channel}/${tone}) ${new Date().toLocaleDateString()}`;
    const macro: MacroEntry = {
      id: `m-${Date.now()}`,
      name,
      scenario,
      channel,
      tone,
      text: renderText(generated),
      ts: Date.now(),
    };
    const next = saveMacro(macro);
    setMacros(next);
    setMacroName("");
    toast.success(`Saved macro: ${name}`);
  }, [generated, macroName, scenario, channel, tone]);

  const handleDeleteMacro = useCallback((id: string) => {
    setMacros(deleteMacro(id));
    toast.info("Macro deleted");
  }, []);

  const handleClearMacros = useCallback(() => {
    clearMacros();
    setMacros([]);
    toast.success("Macro library cleared");
  }, []);

  const markdown = useMemo(() => (generated ? renderMarkdown(generated) : ""), [generated]);
  const json = useMemo(() => (generated ? renderJson(generated) : ""), [generated]);
  const text = useMemo(() => (generated ? renderText(generated) : ""), [generated]);

  const handleDeEscalate = useCallback(() => {
    if (!generated) { toast.error("Generate a script first"); return; }
    const newStages = generated.stages.map((s) => {
      const r = deEscalate(s.text);
      return { ...s, text: r.text };
    });
    setGenerated({ ...generated, stages: newStages });
    toast.success("De-escalation applied");
  }, [generated]);

  const handlePositiveRewrite = useCallback(() => {
    if (!generated) { toast.error("Generate a script first"); return; }
    const allHits: string[] = [];
    const newStages = generated.stages.map((s) => {
      const r = positiveLanguageRewrite(s.text);
      allHits.push(...r.hits);
      return { ...s, text: r.text };
    });
    setGenerated({ ...generated, stages: newStages });
    if (allHits.length === 0) toast.success("No phrases to rewrite — looks clean.");
    else toast.success(`Rewrote ${allHits.length} phrase(s)`);
  }, [generated]);

  const handleSaveBrandVoice = useCallback(() => {
    saveBrandVoice(brandVoice);
    toast.success("Brand voice saved");
  }, [brandVoice]);

  // ---- LLM polish (BYO key) ----
  const handleLlm = useCallback(async () => {
    if (!llmKey) { toast.error("Paste your LLM API key first"); return; }
    setLlmLoading(true); setLlmError("");
    try {
      const prompt = buildLlmPrompt(scenario, channel, tone, vars, vars.issueSummary ?? "");
      const out = await callLlm(llmProvider, llmKey, prompt);
      const r = renderLlmResult(out);
      setLlmResult(r);
      toast.success("LLM polish ready");
    } catch (e) {
      setLlmError(e instanceof Error ? e.message : "LLM call failed");
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, scenario, channel, tone, vars]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="scenario" className="flex items-center gap-1.5">
              <Headset className="h-3.5 w-3.5" /> Scenario
            </Label>
            <select
              id="scenario"
              value={scenario}
              onChange={(e) => setScenario(e.target.value as Scenario)}
              className="w-full h-9 text-sm rounded border bg-background px-2"
            >
              {SCENARIO_LIST.map((s) => (
                <option key={s} value={s}>{SCENARIO_LABELS[s]}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{SCENARIO_DESCRIPTIONS[scenario]}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="rounded border bg-background px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Channel</div>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as Channel)}
                className="bg-transparent text-sm font-semibold w-full"
              >
                {(Object.keys(CHANNEL_LABELS) as Channel[]).map((c) => (
                  <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div className="rounded border bg-background px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Tone</div>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="bg-transparent text-sm font-semibold w-full"
              >
                {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
                  <option key={t} value={t}>{TONE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="rounded border bg-background px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Brand voice</div>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-xs px-0 font-semibold"
                onClick={() => setShowBrandVoice((v) => !v)}
              >
                {brandVoice.name} →
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {VARIABLE_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={`v-${f.key}`} className="text-[11px] text-muted-foreground">{f.label}</Label>
                <Input
                  id={`v-${f.key}`}
                  value={vars[f.key] ?? ""}
                  onChange={(e) => setVars((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="h-8 text-xs"
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleGenerate} label="Generate script" />
            <Button variant="outline" size="sm" onClick={handleDeEscalate} disabled={!generated} className="gap-1.5">
              <Shield className="h-3.5 w-3.5" /> De-escalate
            </Button>
            <Button variant="outline" size="sm" onClick={handlePositiveRewrite} disabled={!generated} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Positive rewrite
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowLlm((v) => !v)} className="gap-1.5">
              <Wand2 className="h-3.5 w-3.5" /> {showLlm ? "Hide" : "Show"} LLM polish
            </Button>
          </div>
        </CardContent>
      </Card>

      {showBrandVoice && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> Brand voice profile
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Profile name</Label>
                <Input
                  value={brandVoice.name}
                  onChange={(e) => setBrandVoice((v) => ({ ...v, name: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Signature (appended to email closings)</Label>
                <Input
                  value={brandVoice.signature}
                  onChange={(e) => setBrandVoice((v) => ({ ...v, signature: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Traits (comma-separated)</Label>
                <Input
                  value={brandVoice.traits.join(", ")}
                  onChange={(e) => setBrandVoice((v) => ({ ...v, traits: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Avoid (comma-separated)</Label>
                <Input
                  value={brandVoice.avoid.join(", ")}
                  onChange={(e) => setBrandVoice((v) => ({ ...v, avoid: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleSaveBrandVoice}>Save brand voice</Button>
          </CardContent>
        </Card>
      )}

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
                {llmResult.opener && <div><strong>Opener:</strong> {llmResult.opener}</div>}
                {llmResult.acknowledgment && <div><strong>Acknowledgment:</strong> {llmResult.acknowledgment}</div>}
                {llmResult.resolution && <div><strong>Resolution:</strong> {llmResult.resolution}</div>}
                {llmResult.objectionHandling && <div><strong>Objection handling:</strong> {llmResult.objectionHandling}</div>}
                {llmResult.closing && <div><strong>Closing:</strong> {llmResult.closing}</div>}
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

      {generated && (
        <Card>
          <CardContent className="p-4 space-y-3">
            {generated.complianceFlag && (
              <div className="rounded border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
                <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium mb-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Compliance flag
                </div>
                <p className="text-foreground">
                  This scenario may involve legal/policy concerns. Review with your compliance team before sending.
                </p>
              </div>
            )}

            {generated.warnings.length > 0 && (
              <div className="rounded border border-blue-500/30 bg-blue-500/5 p-3 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-medium">
                  <AlertCircle className="h-3.5 w-3.5" /> {generated.warnings.length} warning(s)
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-foreground">
                  {generated.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              {generated.stages.map((s) => (
                <div key={s.stage} className="rounded border bg-background p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{s.label}</Badge>
                    <CopyButton getText={() => s.text} label="Copy" size="sm" />
                  </div>
                  {s.tip && (
                    <p className="text-[11px] text-muted-foreground italic">Tip: {s.tip}</p>
                  )}
                  <p className="text-sm text-foreground whitespace-pre-wrap">{s.text}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => text} label="Copy all" />
              <DownloadButton getText={() => markdown} filename="support-script.md" label="Download .md" />
              <DownloadButton getText={() => json} filename="support-script.json" mime="application/json" label="Download .json" />
              <DownloadButton getText={() => text} filename="support-script.txt" label="Download .txt" />
              <ShareButton
                getUrl={() => buildShareUrl({ scenario, channel, tone, vars })}
              />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      )}

      {generated && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Save className="h-4 w-4" /> Save as macro
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={macroName}
                onChange={(e) => setMacroName(e.target.value)}
                placeholder={`Name (default: ${SCENARIO_LABELS[scenario]} ${channel}/${tone})`}
                className="h-8 text-xs max-w-xs"
              />
              <Button variant="outline" size="sm" onClick={handleSaveMacro}>Save macro</Button>
            </div>
            {macros.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground">{macros.length} macro(s) saved (max 50)</span>
                  <Button variant="ghost" size="sm" onClick={handleClearMacros}>Clear all</Button>
                </div>
                {macros.slice(0, 10).map((m) => (
                  <div key={m.id} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{SCENARIO_LABELS[m.scenario]}</Badge>
                      <Badge variant="outline" className="text-[10px]">{CHANNEL_LABELS[m.channel]}</Badge>
                      <Badge variant="outline" className="text-[10px]">{TONE_LABELS[m.tone]}</Badge>
                      <span className="font-medium text-foreground">{m.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 ml-auto text-[10px]"
                        onClick={() => {
                          setScenario(m.scenario);
                          setChannel(m.channel);
                          setTone(m.tone);
                          toast.info("Loaded macro settings — click Generate to regenerate");
                        }}
                      >Load</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px]"
                        onClick={() => handleDeleteMacro(m.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-muted-foreground text-[10px] truncate">{m.text.slice(0, 120)}…</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!generated && (
        <EmptyState
          title="Pick a scenario and generate a support script"
          hint="12 scenarios × 3 channels × 3 tones = 108 ready-to-use staged scripts. Fill in your variables and click Generate."
          icon={<Headset className="h-8 w-8" />}
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
                  onClick={() => {
                    setScenario(h.scenario);
                    setChannel(h.channel);
                    setTone(h.tone);
                    setVars((prev) => ({ ...prev, issueSummary: h.issueSummary }));
                    toast.info("Loaded scenario from history");
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:border-primary"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">{SCENARIO_LABELS[h.scenario]}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{CHANNEL_LABELS[h.channel]}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{TONE_LABELS[h.tone]}</Badge>
                  <span className="text-muted-foreground">{h.issueSummary || "(no issue summary)"}</span>
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
            <strong className="text-foreground">Privacy & honesty:</strong> All template assembly, variable substitution, de-escalation, weak-phrase linting, and export run locally. Your scenario inputs and customer details never leave this device. Scripts are drafts to adapt — verify against your company policy and local law before sending. The only network call is the optional BYO-key LLM polish, which goes directly to the provider you choose.
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
          { role: "system", content: "You are an expert customer-support coach. You return raw JSON only — no markdown fences." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
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
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.content?.map((c: { text?: string }) => c.text ?? "").join("") ?? "";
}
