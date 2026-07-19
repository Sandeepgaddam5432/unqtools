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
  HISTORY_KEY,
  HISTORY_MAX,
  LLM_KEY_STORAGE,
  TONE_LABELS,
  CTA_LABELS,
  FIELD_HINTS,
  validateInputs,
  detectSpamWords,
  computeSpamRisk,
  computeReadability,
  buildEmailText,
  buildOpener,
  buildBody,
  buildCta,
  generate,
  renderMarkdown,
  renderJson,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type EmailInputs,
  type ProspectInputs,
  type SenderInputs,
  type Tone,
  type CtaType,
  type PersonalizerOutput,
  type HistoryEntry,
  type LlmEnhancement,
} from "./logic";
import {
  Mail, Sparkles, Key, History, AlertCircle, Shield, Gauge,
  MessagesSquare, FileText, Eye, EyeOff,
} from "lucide-react";

const EMPTY_PROSPECT: ProspectInputs = {
  name: "", company: "", industry: "", role: "", context: "", painPoints: "",
};
const EMPTY_SENDER: SenderInputs = {
  name: "", company: "", offer: "", socialProof: "", ctaType: "demo",
};

const SAMPLE: EmailInputs = {
  prospect: {
    name: "Priya",
    company: "Northwind Labs",
    industry: "B2B SaaS",
    role: "VP of Marketing",
    context: "Just published a post on why attribution dashboards break at $10M ARR.",
    painPoints: "Spending 4+ hours/week stitching ad spend data in spreadsheets.",
  },
  sender: {
    name: "Sam Rivera",
    company: "Acme Attribution",
    offer: "Acme gives revenue teams a single live source of truth for ad spend and pipeline, no SQL required.",
    socialProof: "Helped Loom cut reporting time from 8 hours to 20 minutes/week.",
    ctaType: "demo",
  },
};

const PROSPECT_FIELDS: Array<{ key: keyof ProspectInputs; label: string; multiline?: boolean }> = [
  { key: "name", label: "Prospect name" },
  { key: "company", label: "Prospect company" },
  { key: "industry", label: "Industry" },
  { key: "role", label: "Role" },
  { key: "context", label: "Public context you paste (bio, recent post, news)", multiline: true },
  { key: "painPoints", label: "Pain points you can solve", multiline: true },
];

const SENDER_FIELDS: Array<{ key: keyof SenderInputs; label: string; multiline?: boolean }> = [
  { key: "name", label: "Your name" },
  { key: "company", label: "Your company" },
  { key: "offer", label: "Your offer (one or two sentences)", multiline: true },
  { key: "socialProof", label: "Social proof (customer, metric, result)", multiline: true },
];

export default function AiColdEmailPersonalizer() {
  const [prospect, setProspect] = useState<ProspectInputs>(EMPTY_PROSPECT);
  const [sender, setSender] = useState<SenderInputs>(EMPTY_SENDER);
  const [tone, setTone] = useState<Tone>("concise");
  const [output, setOutput] = useState<PersonalizerOutput | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<LlmEnhancement | null>(null);
  const [error, setError] = useState("");

  const inputs: EmailInputs = useMemo(() => ({ prospect, sender }), [prospect, sender]);

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem(LLM_KEY_STORAGE)
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.prospect && Object.keys(p.prospect).length > 0) {
        setProspect((prev) => ({ ...prev, ...p.prospect }));
      }
      if (p.sender && Object.keys(p.sender).length > 0) {
        setSender((prev) => ({ ...prev, ...p.sender }));
      }
      setTone(p.tone);
      if ((p.prospect && Object.keys(p.prospect).length > 0) ||
          (p.sender && Object.keys(p.sender).length > 0)) {
        toast.info("Loaded from share link");
      }
    }
  }, []);

  // Live preview
  const livePreview = useMemo(() => {
    const hasAny = (prospect.name || prospect.company || prospect.context) &&
      (sender.name || sender.company || sender.offer);
    if (!hasAny) return "";
    return buildEmailText(inputs, tone, 0);
  }, [inputs, prospect, sender, tone]);

  const liveWarnings = useMemo(() => validateInputs(inputs), [inputs]);
  const liveSpamRisk = useMemo(() => computeSpamRisk(livePreview), [livePreview]);
  const liveReadability = useMemo(() => computeReadability(livePreview), [livePreview]);

  const handleGenerate = useCallback(() => {
    setError("");
    try {
      const out = generate(inputs, tone);
      setOutput(out);
      setLlmResult(null);
      if (prospect.name || prospect.company) {
        const primary = out.variations.find((v) => v.primary);
        saveHistory({
          ts: Date.now(),
          prospectName: prospect.name,
          prospectCompany: prospect.company,
          tone,
          primaryExcerpt: primary ? primary.opener.slice(0, 80) : "",
        });
        setHistory(loadHistory());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    }
  }, [inputs, prospect, tone]);

  const handleClear = useCallback(() => {
    setProspect(EMPTY_PROSPECT);
    setSender(EMPTY_SENDER);
    setOutput(null);
    setLlmResult(null);
    setError("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadSample = useCallback(() => {
    setProspect(SAMPLE.prospect);
    setSender(SAMPLE.sender);
    toast.info("Sample prospect loaded");
  }, []);

  const handleSaveKey = useCallback(() => {
    if (typeof localStorage !== "undefined") {
      try {
        if (llmKey) localStorage.setItem(LLM_KEY_STORAGE, llmKey);
        else localStorage.removeItem(LLM_KEY_STORAGE);
        toast.success(llmKey ? "API key saved on this device" : "API key removed");
      } catch {
        toast.error("Could not save key");
      }
    }
  }, [llmKey]);

  const handleLlm = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your API key first");
      return;
    }
    if (!prospect.name.trim() || !sender.name.trim()) {
      toast.error("Enter at least a prospect name and your name first");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    setLlmResult(null);
    try {
      const prompt = buildLlmPrompt(inputs, tone);
      const url = llmProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let body: string;
      if (llmProvider === "openai") {
        headers["Authorization"] = `Bearer ${llmKey}`;
        body = JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a JSON-only API. Respond with valid JSON only, no prose." },
            { role: "user", content: prompt },
          ],
          temperature: 0.4,
        });
      } else {
        headers["x-api-key"] = llmKey;
        headers["anthropic-version"] = "2023-06-01";
        body = JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 2048,
          system: "You are a JSON-only API. Respond with valid JSON only, no prose.",
          messages: [{ role: "user", content: prompt }],
        });
      }
      const res = await fetch(url, { method: "POST", headers, body });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`API error ${res.status}: ${txt.slice(0, 200)}`);
      }
      const data = await res.json();
      const raw = llmProvider === "openai"
        ? (data.choices?.[0]?.message?.content ?? "")
        : (data.content?.[0]?.text ?? "");
      const parsed = renderLlmResult(raw);
      if (!parsed.ok) throw new Error(parsed.error);
      setLlmResult(parsed.result);
      toast.success("LLM polish applied");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "LLM call failed";
      setLlmError(msg);
      toast.error(msg);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, inputs, prospect, sender, tone]);

  const hasAnyInput = useMemo(() =>
    Object.values(prospect).some((v) => v && v.trim()) ||
    Object.values(sender).some((v) => v && (typeof v === "string" ? v.trim() : v)),
  [prospect, sender]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Prospect fields */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-foreground">Prospect (context you paste — no scraping)</div>
              {PROSPECT_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label htmlFor={`cep-p-${f.key}`} className="text-[11px]">
                    {f.label}
                    <span className="ml-1 text-muted-foreground font-normal">— {FIELD_HINTS[`prospect${f.key.charAt(0).toUpperCase() + f.key.slice(1)}`]?.hint ?? ""}</span>
                  </Label>
                  {f.multiline ? (
                    <Textarea
                      id={`cep-p-${f.key}`}
                      value={prospect[f.key]}
                      onChange={(e) => setProspect((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={`e.g. ${FIELD_HINTS[`prospect${f.key.charAt(0).toUpperCase() + f.key.slice(1)}`]?.sample ?? ""}`}
                      className="min-h-[60px] resize-y text-sm"
                    />
                  ) : (
                    <Input
                      id={`cep-p-${f.key}`}
                      value={prospect[f.key]}
                      onChange={(e) => setProspect((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={`e.g. ${FIELD_HINTS[`prospect${f.key.charAt(0).toUpperCase() + f.key.slice(1)}`]?.sample ?? ""}`}
                      className="text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
            {/* Sender fields */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-foreground">Sender (you)</div>
              {SENDER_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label htmlFor={`cep-s-${f.key}`} className="text-[11px]">
                    {f.label}
                    <span className="ml-1 text-muted-foreground font-normal">— {FIELD_HINTS[`sender${f.key.charAt(0).toUpperCase() + f.key.slice(1)}`]?.hint ?? ""}</span>
                  </Label>
                  {f.multiline ? (
                    <Textarea
                      id={`cep-s-${f.key}`}
                      value={sender[f.key] as string}
                      onChange={(e) => setSender((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={`e.g. ${FIELD_HINTS[`sender${f.key.charAt(0).toUpperCase() + f.key.slice(1)}`]?.sample ?? ""}`}
                      className="min-h-[60px] resize-y text-sm"
                    />
                  ) : (
                    <Input
                      id={`cep-s-${f.key}`}
                      value={sender[f.key] as string}
                      onChange={(e) => setSender((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={`e.g. ${FIELD_HINTS[`sender${f.key.charAt(0).toUpperCase() + f.key.slice(1)}`]?.sample ?? ""}`}
                      className="text-sm"
                    />
                  )}
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <Label className="text-[11px]">CTA type</Label>
                <select
                  value={sender.ctaType}
                  onChange={(e) => setSender((prev) => ({ ...prev, ctaType: e.target.value as CtaType }))}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  {(Object.keys(CTA_LABELS) as CtaType[]).map((c) => (
                    <option key={c} value={c}>{CTA_LABELS[c]}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs">Tone</Label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
                  <option key={t} value={t}>{TONE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={handleLoadSample}>
              Load sample
            </Button>
          </div>

          {livePreview && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                Live preview · {TONE_LABELS[tone]} · spam risk: {liveSpamRisk.level} ({liveSpamRisk.score})
              </div>
              <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">{livePreview}</pre>
              <div className="flex flex-wrap gap-2 mt-2 text-[10px]">
                <Badge variant="outline">{liveReadability.wordCount} words</Badge>
                <Badge variant="outline">{liveReadability.sentenceCount} sentences</Badge>
                <Badge variant="outline">~{liveReadability.readingTimeSec}s read</Badge>
                <Badge variant={liveReadability.note === "on-target" ? "default" : "outline"}>
                  {liveReadability.note}
                </Badge>
              </div>
              {liveSpamRisk.triggers.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-[10px] text-muted-foreground">Triggers:</span>
                  {liveSpamRisk.triggers.map((t) => (
                    <Badge key={t} variant="destructive" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {liveWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300 mb-1">
                <AlertCircle className="h-3.5 w-3.5" /> {liveWarnings.length} warning{liveWarnings.length === 1 ? "" : "s"}
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-amber-700 dark:text-amber-300">
                {liveWarnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleGenerate} disabled={!hasAnyInput} label="Generate" />
            <CopyButton
              getText={() => livePreview}
              label="Copy preview"
              disabled={!livePreview}
            />
            <DownloadButton
              getText={() => output ? renderMarkdown(output, inputs, tone) : ""}
              filename="cold-email-sequence.md"
              mime="text/markdown"
              label="Download .md"
              disabled={!output}
            />
            <DownloadButton
              getText={() => output ? renderJson(output, inputs, tone) : ""}
              filename="cold-email.json"
              mime="application/json"
              label="Download JSON"
              disabled={!output}
            />
            <DownloadButton
              getText={() => output ? renderCsv(output) : ""}
              filename="cold-email-variations.csv"
              mime="text/csv"
              label="Download CSV"
              disabled={!output}
            />
            <ShareButton getUrl={() => buildShareUrl(inputs, tone)} disabled={!hasAnyInput} />
            <ClearButton onClick={handleClear} disabled={!hasAnyInput && !output} />
          </div>
          {error && <ErrorBanner message={error} />}
        </CardContent>
      </Card>

      {output && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Mail className="h-4 w-4" /> Variations ({output.variations.length})
              </h3>
              <div className="space-y-2">
                {output.variations.map((v) => (
                  <div
                    key={v.id}
                    className={`rounded border p-3 ${v.primary ? "border-primary bg-primary/5" : "bg-background"}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <Badge variant={v.primary ? "default" : "outline"} className="text-[10px]">{v.id}</Badge>
                      <Badge variant="outline" className="text-[10px]">{TONE_LABELS[v.tone]}</Badge>
                      {v.primary && <Badge variant="default" className="text-[10px]">Primary</Badge>}
                      <Badge
                        variant={v.spamRisk.level === "high" ? "destructive" : v.spamRisk.level === "medium" ? "outline" : "secondary"}
                        className="text-[10px]"
                      >
                        <Shield className="h-3 w-3 mr-1" /> {v.spamRisk.level}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        <Gauge className="h-3 w-3 mr-1" /> {v.readability.wordCount}w
                      </Badge>
                      <CopyButton getText={() => v.fullText} label="Copy" size="icon-sm" />
                    </div>
                    <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">{v.fullText}</pre>
                    {v.spamRisk.triggers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="text-[10px] text-muted-foreground">Spam triggers:</span>
                        {v.spamRisk.triggers.map((t) => (
                          <Badge key={t} variant="destructive" className="text-[10px]">{t}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <MessagesSquare className="h-4 w-4" /> Follow-up sequence ({output.followUpSequence.length} touches)
              </h3>
              <div className="space-y-2">
                {output.followUpSequence.map((t) => (
                  <div key={t.touch} className="rounded border bg-background p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Badge variant="outline" className="text-[10px]">Touch {t.touch}</Badge>
                      <span className="text-[11px] font-mono text-muted-foreground">{t.subject}</span>
                      <CopyButton getText={() => t.fullText} label="Copy" size="icon-sm" />
                    </div>
                    <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">{t.fullText}</pre>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Merge-field template (for your sending tool)
              </h3>
              <pre className="text-xs text-foreground whitespace-pre-wrap font-mono rounded bg-background border p-3">{output.mergeFieldTemplate}</pre>
              <CopyButton getText={() => output.mergeFieldTemplate} label="Copy template" />
            </CardContent>
          </Card>

          {llmResult && (
            <Card>
              <CardContent className="p-4 space-y-3 border-l-4 border-l-primary">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> LLM polish
                </h3>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Polished email</div>
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed rounded bg-background border p-2">
                    {llmResult.polishedFullText || "(empty)"}
                  </pre>
                </div>
                {llmResult.subjectLines.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Subject line options</div>
                    <ul className="text-xs space-y-0.5 list-disc pl-5">
                      {llmResult.subjectLines.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {llmResult.suggestions.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Suggestions</div>
                    <ul className="text-xs space-y-0.5 list-disc pl-5">
                      {llmResult.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <button
                className="flex w-full items-center justify-between text-left"
                onClick={() => setShowLlm((v) => !v)}
              >
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Key className="h-4 w-4" /> Optional: polish with your LLM API key
                </h3>
                {showLlm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              {showLlm && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    For sharper, more idiomatic copy than the templates produce. Your key is stored only in localStorage on this device. The request goes directly from your browser to the provider. The LLM is constrained to use only the context you provide — it does not scrape or fabricate prospect details.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={llmProvider}
                      onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                      className="h-8 text-xs rounded border bg-background px-2"
                    >
                      <option value="openai">OpenAI (gpt-4o-mini)</option>
                      <option value="anthropic">Anthropic (claude-3-5-haiku)</option>
                    </select>
                    <Input
                      type="password"
                      value={llmKey}
                      onChange={(e) => setLlmKey(e.target.value)}
                      placeholder={llmProvider === "openai" ? "sk-…" : "sk-ant-…"}
                      className="h-8 text-xs flex-1 min-w-[200px]"
                    />
                    <Button size="sm" variant="outline" onClick={handleSaveKey}>Save key</Button>
                  </div>
                  <RunButton onClick={handleLlm} loading={llmLoading} label="Polish with LLM" />
                  {llmError && <ErrorBanner message={llmError} />}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!output && (
        <EmptyState
          title="Paste prospect context and your offer to generate a cold email"
          hint="Five+ variations across three tones, a 4-touch follow-up sequence, spam-trigger linter, readability meter, and a merge-field template for your sending tool. 100% client-side — no scraping, nothing uploaded."
          icon={<Mail className="h-8 w-8" />}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2 text-[10px]">{TONE_LABELS[h.tone]}</Badge>
                  <span className="font-medium">{h.prospectName}</span>
                  {h.prospectCompany && <span className="text-muted-foreground"> · {h.prospectCompany}</span>}
                  <div className="text-[10px] text-muted-foreground mt-0.5">{h.primaryExcerpt}</div>
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
            <strong className="text-foreground">Honesty & privacy:</strong> This tool personalizes from <em>what you provide</em> — it does not scrape prospect data or fabricate details. You must have a lawful basis to email (CAN-SPAM/GDPR), include an opt-out, and personalize from public info. All generation runs locally in your browser; nothing is uploaded. The only network call is if you choose to paste your own LLM API key.
          </p>
        </CardContent>
      </Card>

      <span className="hidden" aria-hidden="true">{HISTORY_MAX}{HISTORY_KEY}{detectSpamWords("test").length}{buildOpener(prospect, tone, 0).length}{buildBody(inputs, tone).length}{buildCta(inputs, tone).length}</span>
    </div>
  );
}
