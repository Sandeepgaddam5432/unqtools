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
  TONE_LABELS,
  LENGTH_LABELS,
  generateDraft,
  regenerateHook,
  detectCliches,
  applyClicheSuggestions,
  renderMarkdown,
  renderJson,
  renderRequirementsCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Tone,
  type Length,
  type CoverLetterInputs,
  type CoverLetterDraft,
  type ClicheHit,
  type HistoryEntry,
  type LlmEnhancement,
  type SectionBlock,
} from "./logic";
import {
  FileText, Sparkles, Key, History, AlertCircle, ShieldCheck,
  CheckCircle2, Circle, RefreshCw, Wand2,
} from "lucide-react";

const EMPTY_INPUTS: CoverLetterInputs = {
  name: "",
  email: "",
  phone: "",
  experience: "",
  company: "",
  role: "",
  jobDescription: "",
};

const SAMPLE_JD = `Senior Product Manager, Acme Cloud
We are looking for a Senior Product Manager to lead our cloud platform.
Requirements:
- 5+ years of product management experience in B2B SaaS
- Strong experience with roadmap planning and prioritization
- Experience working with engineering, design, and GTM teams
- Data-driven decision-making with SQL and analytics tools
- Excellent communication and stakeholder management
- Experience with pricing, packaging, and monetization
- Familiarity with AWS, GCP, or Azure
Nice-to-have: experience with API products and developer platforms.`;

const SAMPLE_EXPERIENCE = `I have 6 years of product management experience at B2B SaaS companies.
At Northwind, I led roadmap planning for the analytics product and
shipped a major SQL-driven insights feature with engineering and design.
I worked closely with GTM teams on pricing and packaging. We used
AWS for infrastructure. I have strong communication and stakeholder
management skills across engineering, design, and sales.`;

const SAMPLE: CoverLetterInputs = {
  name: "Jordan Lee",
  email: "jordan@example.com",
  phone: "+1-555-0100",
  experience: SAMPLE_EXPERIENCE,
  company: "Acme Cloud",
  role: "Senior Product Manager",
  jobDescription: SAMPLE_JD,
};

export default function AiCoverLetterWriter() {
  const [inputs, setInputs] = useState<CoverLetterInputs>(EMPTY_INPUTS);
  const [tone, setTone] = useState<Tone>("formal");
  const [length, setLength] = useState<Length>("standard");
  const [draft, setDraft] = useState<CoverLetterDraft | null>(null);
  const [hookVariant, setHookVariant] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [editableText, setEditableText] = useState("");
  const [cliches, setCliches] = useState<ClicheHit[]>([]);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<LlmEnhancement | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-cover-letter-writer:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.inputs && Object.keys(p.inputs).length > 0) {
        setInputs((prev) => ({ ...prev, ...p.inputs }));
      }
      setTone(p.tone);
      setLength(p.length);
      if (p.inputs && Object.keys(p.inputs).length > 0) {
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const hasRequired = useMemo(() =>
    inputs.name.trim() && inputs.experience.trim() && inputs.company.trim() && inputs.role.trim() && inputs.jobDescription.trim(),
  [inputs]);

  const handleGenerate = useCallback(() => {
    setError("");
    try {
      const d = generateDraft(inputs, tone, length);
      setDraft(d);
      setEditableText(d.fullText);
      setCliches(detectCliches(d.fullText));
      setHookVariant(0);
      setLlmResult(null);
      if (inputs.name.trim()) {
        saveHistory({
          ts: Date.now(),
          name: inputs.name,
          company: inputs.company,
          role: inputs.role,
          tone,
          length,
          matchedCount: d.requirements.filter((r) => r.matched).length,
          unmatchedCount: d.unmatchedCount,
        });
        setHistory(loadHistory());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    }
  }, [inputs, tone, length]);

  const handleRegenerateHook = useCallback(() => {
    if (!draft) return;
    const nextVariant = (hookVariant + 1) % 3;
    const updated = regenerateHook(draft, inputs, tone, nextVariant);
    setDraft(updated);
    setEditableText(updated.fullText);
    setHookVariant(nextVariant);
    setCliches(detectCliches(updated.fullText));
    toast.info(`Hook variant ${nextVariant + 1} of 3`);
  }, [draft, hookVariant, inputs, tone]);

  const handleEditableChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditableText(e.target.value);
    setCliches(detectCliches(e.target.value));
  }, []);

  const handleApplyCliches = useCallback(() => {
    if (cliches.length === 0) return;
    const out = applyClicheSuggestions(editableText, cliches);
    setEditableText(out);
    setCliches(detectCliches(out));
    toast.success(`Replaced ${cliches.length} cliché(s) with rewrite placeholder(s)`);
  }, [cliches, editableText]);

  const handleClear = useCallback(() => {
    setInputs(EMPTY_INPUTS);
    setDraft(null);
    setEditableText("");
    setCliches([]);
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
    setInputs(SAMPLE);
    toast.info("Sample inputs loaded");
  }, []);

  const handleSaveKey = useCallback(() => {
    if (typeof localStorage !== "undefined") {
      try {
        if (llmKey) localStorage.setItem("unqtools:ai-cover-letter-writer:llm-key", llmKey);
        else localStorage.removeItem("unqtools:ai-cover-letter-writer:llm-key");
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
    if (!inputs.name.trim() || !inputs.experience.trim()) {
      toast.error("Enter at least your name and experience first");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    setLlmResult(null);
    try {
      const prompt = buildLlmPrompt(inputs, tone, length);
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
          temperature: 0.5,
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
  }, [llmKey, llmProvider, inputs, tone, length]);

  const markdown = useMemo(() => {
    if (!draft) return "";
    return renderMarkdown(draft, inputs, tone, length);
  }, [draft, inputs, tone, length]);

  const json = useMemo(() => {
    if (!draft) return "";
    return renderJson(draft, inputs, tone, length);
  }, [draft, inputs, tone, length]);

  const requirementsCsv = useMemo(() => draft ? renderRequirementsCsv(draft) : "", [draft]);

  const matchedCount = draft ? draft.requirements.filter((r) => r.matched).length : 0;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Inputs */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">Inputs</div>
            <div className="flex gap-1.5">
              <Button variant="ghost" size="sm" onClick={handleLoadSample}>Load sample</Button>
              <ClearButton onClick={handleClear} disabled={!hasRequired && !draft} />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-foreground">You</div>
              <div className="grid grid-cols-1 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="clw-name" className="text-[11px]">Your name *</Label>
                  <Input id="clw-name" value={inputs.name} onChange={(e) => setInputs((p) => ({ ...p, name: e.target.value }))} className="text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="clw-email" className="text-[11px]">Email (optional)</Label>
                    <Input id="clw-email" value={inputs.email ?? ""} onChange={(e) => setInputs((p) => ({ ...p, email: e.target.value }))} className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="clw-phone" className="text-[11px]">Phone (optional)</Label>
                    <Input id="clw-phone" value={inputs.phone ?? ""} onChange={(e) => setInputs((p) => ({ ...p, phone: e.target.value }))} className="text-sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="clw-exp" className="text-[11px]">Experience, skills, achievements (paste anything relevant) *</Label>
                  <Textarea id="clw-exp" value={inputs.experience} onChange={(e) => setInputs((p) => ({ ...p, experience: e.target.value }))} className="min-h-[140px] resize-y text-sm" placeholder="Paste resume bullets, LinkedIn about, project notes…" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-foreground">Target</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="clw-co" className="text-[11px]">Company *</Label>
                  <Input id="clw-co" value={inputs.company} onChange={(e) => setInputs((p) => ({ ...p, company: e.target.value }))} className="text-sm" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="clw-role" className="text-[11px]">Role / title *</Label>
                  <Input id="clw-role" value={inputs.role} onChange={(e) => setInputs((p) => ({ ...p, role: e.target.value }))} className="text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="clw-jd" className="text-[11px]">Job description *</Label>
                <Textarea id="clw-jd" value={inputs.jobDescription} onChange={(e) => setInputs((p) => ({ ...p, jobDescription: e.target.value }))} className="min-h-[200px] resize-y text-sm" placeholder="Paste the full JD…" />
              </div>
            </div>
          </div>

          {draft && draft.warnings.length > 0 && (
            <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/10 p-2">
              {draft.warnings.map((w, i) => (
                <div key={i} className="text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
                  <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px]">Tone</Label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="h-8 text-xs rounded border bg-background px-2 w-full"
              >
                {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
                  <option key={t} value={t}>{TONE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Length</Label>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value as Length)}
                className="h-8 text-xs rounded border bg-background px-2 w-full"
              >
                {(Object.keys(LENGTH_LABELS) as Length[]).map((l) => (
                  <option key={l} value={l}>{LENGTH_LABELS[l]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RunButton onClick={handleGenerate} disabled={!hasRequired} label="Generate draft" />
            <Button variant="outline" size="sm" onClick={() => setShowLlm((v) => !v)} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              {showLlm ? "Hide LLM polish" : "Polish with LLM"}
            </Button>
            <ShareButton getUrl={() => buildShareUrl(inputs, tone, length)} disabled={!hasRequired} />
          </div>
        </CardContent>
      </Card>

      {/* Requirement checklist */}
      {draft && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> Requirement checklist
              </h3>
              <div className="text-[11px] text-muted-foreground">
                {matchedCount} matched · {draft.unmatchedCount} unmatched · {draft.requirements.length} total
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
              {draft.requirements.map((r, i) => (
                <div key={i} className="rounded border bg-background px-2 py-1.5 text-[11px] flex items-start gap-1.5">
                  {r.matched ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <div className={r.matched ? "text-foreground font-medium" : "text-muted-foreground line-through"}>
                      {r.keyword}
                    </div>
                    {r.evidence && (
                      <div className="text-[10px] text-muted-foreground line-clamp-2">{r.evidence}</div>
                    )}
                    {!r.matched && (
                      <div className="text-[10px] text-amber-700 dark:text-amber-300">unmatched — not claimed</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              Unmatched requirements are <strong>not</strong> claimed in the draft. The honesty clause: this is a draft to personalize — we never invent credentials.
            </p>
          </CardContent>
        </Card>
      )}

      {/* LLM panel */}
      {showLlm && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Key className="h-4 w-4" /> Optional BYO-key LLM polish
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Paste your own OpenAI or Anthropic key. The key is stored only in this browser's localStorage. Requests go directly from your browser to the provider.
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
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder="sk-…"
                className="h-8 max-w-[300px] text-xs"
              />
              <Button size="sm" variant="outline" onClick={handleSaveKey}>Save key</Button>
              <RunButton onClick={handleLlm} disabled={!llmKey || llmLoading} loading={llmLoading} label="Polish letter" />
            </div>
            {llmError && <ErrorBanner message={llmError} />}
            {llmResult && (
              <div className="space-y-2 pt-2">
                {llmResult.polishedSections.length > 0 && (
                  <div className="space-y-1">
                    {llmResult.polishedSections.map((s: SectionBlock, i: number) => (
                      <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                        <div className="font-medium text-foreground">{s.label}</div>
                        <div className="text-muted-foreground whitespace-pre-wrap">{s.text}</div>
                      </div>
                    ))}
                  </div>
                )}
                {llmResult.hookVariants.length > 0 && (
                  <div>
                    <div className="text-[11px] font-medium text-foreground">Hook variants:</div>
                    <ul className="ml-4 list-disc text-xs text-muted-foreground">
                      {llmResult.hookVariants.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {llmResult.suggestions.length > 0 && (
                  <div>
                    <div className="text-[11px] font-medium text-foreground">Suggestions:</div>
                    <ul className="ml-4 list-disc text-xs text-muted-foreground">
                      {llmResult.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                <CopyButton getText={() => llmResult.polishedFullText} label="Copy polished letter" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Output */}
      {draft ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Draft ({draft.wordCount} words)
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleRegenerateHook} className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" /> Hook variant {hookVariant + 1}/3
                </Button>
                <CopyButton getText={() => editableText} label="Copy letter" />
                <DownloadButton getText={() => markdown} filename="cover-letter.md" label="Download .md" />
                <DownloadButton getText={() => json} filename="cover-letter.json" mime="application/json" label="Download JSON" />
                <DownloadButton getText={() => requirementsCsv} filename="cover-letter-requirements.csv" mime="text/csv" label="Reqs CSV" />
              </div>
            </div>
            <Textarea
              value={editableText}
              onChange={handleEditableChange}
              className="min-h-[360px] resize-y text-sm font-mono"
            />

            {/* De-cliché pass */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Wand2 className="h-3.5 w-3.5" /> De-cliché pass
                </h4>
                {cliches.length > 0 && (
                  <Button size="sm" variant="outline" onClick={handleApplyCliches} className="gap-1.5">
                    <Wand2 className="h-3.5 w-3.5" /> Replace all with [your specific example]
                  </Button>
                )}
              </div>
              {cliches.length === 0 ? (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> No clichés detected — clean copy.
                </p>
              ) : (
                <div className="space-y-1">
                  {cliches.map((h, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-2 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="destructive" className="text-[10px]">cliché</Badge>
                        <span className="font-mono text-foreground">"{h.phrase}"</span>
                      </div>
                      <div className="text-muted-foreground mt-0.5">{h.suggestion}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground pt-2 border-t">
              <strong className="text-foreground">Honesty:</strong> This is a draft to personalize, not a submit-as-is letter. We never invent credentials — every claim references the experience you pasted. Verify every detail before sending.
            </p>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Paste your experience + the JD, then generate"
          hint="Deterministic JD keyword extraction drives a requirement-to-evidence mapping. Matched requirements are addressed in your own words; unmatched ones are NOT claimed. Tone control, length presets, hook variants, de-cliché pass. Click 'Load sample' to try it."
          icon={<FileText className="h-8 w-8" />}
        />
      )}

      {/* History */}
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
              {history.slice(0, 5).map((h) => (
                <div key={h.ts} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="text-[10px] mr-2">{TONE_LABELS[h.tone]}</Badge>
                  <Badge variant="outline" className="text-[10px] mr-2">{LENGTH_LABELS[h.length].split(" ")[0]}</Badge>
                  <span className="text-muted-foreground">{h.name} → {h.company} · {h.role}</span>
                  <span className="text-muted-foreground ml-2">· {h.matchedCount}/{h.matchedCount + h.unmatchedCount} reqs</span>
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
            <strong className="text-foreground">Privacy:</strong> All keyword extraction, requirement mapping, draft assembly, and the de-cliché pass run locally. History is stored in localStorage on this device only. The only network call is the optional BYO-key LLM polish.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
