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
  HISTORY_MAX,
  LLM_KEY_STORAGE,
  PURPOSE_LABELS,
  TONE_LABELS,
  LENGTH_LABELS,
  FIELD_HINTS,
  validateInputs,
  generateEmail,
  shortenBody,
  lengthenBody,
  renderMailto,
  renderEml,
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
  type Mode,
  type Purpose,
  type Tone,
  type Length,
  type EmailInputs,
  type EmailDraft,
  type Signature,
  type HistoryEntry,
  type LlmEnhancement,
} from "./logic";
import {
  Mail, Key, History, AlertCircle, Lightbulb, Wand2,
  ShieldAlert, ArrowDown, ArrowUp, MailOpen,
} from "lucide-react";

const DEFAULT_SIG: Signature = { name: "", title: "", email: "", phone: "" };

const DEFAULT_INPUTS: EmailInputs = {
  mode: "compose",
  purpose: "request",
  tone: "friendly",
  length: "medium",
  recipientName: "",
  senderName: "",
  brief: "",
  thread: "",
  originalSubject: "",
  signature: DEFAULT_SIG,
};

const SAMPLE_BRIEF = "Ask Jordan for feedback on the Q3 roadmap deck by Friday.";

export default function AiEmailDraftGenerator() {
  const [inputs, setInputs] = useState<EmailInputs>(DEFAULT_INPUTS);
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [selectedSubjectIdx, setSelectedSubjectIdx] = useState(0);
  const [bodyOverride, setBodyOverride] = useState<string>("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<LlmEnhancement | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem(LLM_KEY_STORAGE)
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.inputs && Object.keys(p.inputs).length > 0) {
        setInputs((prev) => ({ ...prev, ...p.inputs }));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const liveWarnings = useMemo(() => validateInputs(inputs), [inputs]);

  const handleGenerate = useCallback(() => {
    setError("");
    try {
      const d = generateEmail(inputs);
      setDraft(d);
      setSelectedSubjectIdx(0);
      setBodyOverride("");
      setLlmResult(null);
      saveHistory({
        ts: Date.now(),
        mode: inputs.mode,
        purpose: inputs.purpose,
        tone: inputs.tone,
        length: inputs.length,
        recipientName: inputs.recipientName,
        primarySubject: d.primarySubject,
        bodyPreview: d.body.slice(0, 120),
      });
      setHistory(loadHistory());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    }
  }, [inputs]);

  const handleClear = useCallback(() => {
    setInputs(DEFAULT_INPUTS);
    setDraft(null);
    setBodyOverride("");
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
    setInputs((prev) => ({
      ...prev,
      mode: "compose",
      purpose: "request",
      tone: "friendly",
      length: "medium",
      recipientName: "Jordan",
      senderName: "Alex",
      brief: SAMPLE_BRIEF,
      signature: {
        name: "Alex Rivera",
        title: "Product Manager",
        email: "alex@acme.com",
        phone: "+1-555-0100",
      },
    }));
    toast.info("Sample inputs loaded");
  }, []);

  const handleShorten = useCallback(() => {
    if (!draft) return;
    const src = bodyOverride || draft.body;
    setBodyOverride(shortenBody(src));
    toast.info("Body shortened");
  }, [draft, bodyOverride]);

  const handleLengthen = useCallback(() => {
    if (!draft) return;
    const src = bodyOverride || draft.body;
    setBodyOverride(lengthenBody(src));
    toast.info("Body lengthened");
  }, [draft, bodyOverride]);

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
    if (!draft) {
      toast.error("Generate a draft first");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    setLlmResult(null);
    try {
      const prompt = buildLlmPrompt(inputs, draft);
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
          temperature: 0.7,
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
      toast.success("LLM refinement applied");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "LLM call failed";
      setLlmError(msg);
      toast.error(msg);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, draft, inputs]);

  // Effective draft (with user-selected subject + body override).
  const effectiveDraft: EmailDraft | null = useMemo(() => {
    if (!draft) return null;
    const variant = draft.subjectVariants[selectedSubjectIdx] ?? draft.subjectVariants[0];
    const body = bodyOverride || draft.body;
    return {
      ...draft,
      primarySubject: variant.subject,
      body,
    };
  }, [draft, selectedSubjectIdx, bodyOverride]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Mode toggle */}
          <div className="space-y-1.5">
            <Label className="text-xs">Mode</Label>
            <div className="flex flex-wrap gap-1.5">
              {(["compose", "reply"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setInputs((prev) => ({ ...prev, mode: m }))}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    inputs.mode === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  {m === "compose" ? "Compose" : "Reply"}
                </button>
              ))}
            </div>
          </div>

          {/* Purpose */}
          <div className="space-y-1.5">
            <Label className="text-xs">Purpose</Label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(PURPOSE_LABELS) as Purpose[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setInputs((prev) => ({ ...prev, purpose: p }))}
                  className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
                    inputs.purpose === p
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  {PURPOSE_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Tone + Length */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tone</Label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setInputs((prev) => ({ ...prev, tone: t }))}
                    className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
                      inputs.tone === t
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    {TONE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Length</Label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(LENGTH_LABELS) as Length[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setInputs((prev) => ({ ...prev, length: l }))}
                    className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
                      inputs.length === l
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    {LENGTH_LABELS[l].split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Recipient + sender names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edg-to" className="text-[11px]">Recipient name</Label>
              <Input
                id="edg-to"
                value={inputs.recipientName}
                onChange={(e) => setInputs((prev) => ({ ...prev, recipientName: e.target.value }))}
                placeholder="e.g. Jordan"
                className="text-sm h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edg-from" className="text-[11px]">Your name</Label>
              <Input
                id="edg-from"
                value={inputs.senderName}
                onChange={(e) => setInputs((prev) => ({ ...prev, senderName: e.target.value }))}
                placeholder="e.g. Alex"
                className="text-sm h-9"
              />
            </div>
          </div>

          {/* Brief (compose) OR thread + original subject (reply) */}
          {inputs.mode === "compose" ? (
            <div className="space-y-1.5">
              <Label htmlFor="edg-brief" className="text-xs">
                Brief
                <span className="ml-2 text-muted-foreground font-normal">— {FIELD_HINTS.brief.hint}</span>
              </Label>
              <Textarea
                id="edg-brief"
                value={inputs.brief}
                onChange={(e) => setInputs((prev) => ({ ...prev, brief: e.target.value }))}
                placeholder={`e.g. ${FIELD_HINTS.brief.sample}`}
                className="min-h-[80px] resize-y text-sm"
              />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="edg-subj" className="text-xs">
                  Original subject
                  <span className="ml-2 text-muted-foreground font-normal">— {FIELD_HINTS.originalSubject.hint}</span>
                </Label>
                <Input
                  id="edg-subj"
                  value={inputs.originalSubject}
                  onChange={(e) => setInputs((prev) => ({ ...prev, originalSubject: e.target.value }))}
                  placeholder="e.g. Q3 roadmap call"
                  className="text-sm h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edg-thread" className="text-xs">
                  Incoming thread
                  <span className="ml-2 text-muted-foreground font-normal">— {FIELD_HINTS.thread.hint}</span>
                </Label>
                <Textarea
                  id="edg-thread"
                  value={inputs.thread}
                  onChange={(e) => setInputs((prev) => ({ ...prev, thread: e.target.value }))}
                  placeholder={`e.g. ${FIELD_HINTS.thread.sample}`}
                  className="min-h-[120px] resize-y text-xs font-mono"
                />
              </div>
            </>
          )}

          {/* Signature */}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Signature (optional)</summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <Input
                value={inputs.signature.name}
                onChange={(e) => setInputs((prev) => ({ ...prev, signature: { ...prev.signature, name: e.target.value } }))}
                placeholder="Your name"
                className="text-xs h-8"
              />
              <Input
                value={inputs.signature.title}
                onChange={(e) => setInputs((prev) => ({ ...prev, signature: { ...prev.signature, title: e.target.value } }))}
                placeholder="Title"
                className="text-xs h-8"
              />
              <Input
                value={inputs.signature.email}
                onChange={(e) => setInputs((prev) => ({ ...prev, signature: { ...prev.signature, email: e.target.value } }))}
                placeholder="email@acme.com"
                className="text-xs h-8"
              />
              <Input
                value={inputs.signature.phone}
                onChange={(e) => setInputs((prev) => ({ ...prev, signature: { ...prev.signature, phone: e.target.value } }))}
                placeholder="+1-555-0100"
                className="text-xs h-8"
              />
            </div>
          </details>

          {/* Live warnings */}
          {liveWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300 space-y-0.5">
              {liveWarnings.map((w, i) => <div key={i}>• {w}</div>)}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <RunButton
              onClick={handleGenerate}
              label="Generate draft"
              disabled={inputs.mode === "compose" ? inputs.brief.trim().length < 5 : inputs.thread.trim().length < 5}
            />
            <Button variant="ghost" size="sm" onClick={handleLoadSample} className="gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" /> Sample
            </Button>
            <ClearButton onClick={handleClear} />
            <div className="flex-1" />
            <ShareButton getUrl={() => buildShareUrl(inputs)} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {/* Output */}
      {effectiveDraft && (
        <Card>
          <CardContent className="p-4 space-y-3">
            {/* Subject variants */}
            <div className="space-y-1.5">
              <Label className="text-xs">Subject (pick one)</Label>
              <div className="space-y-1">
                {draft!.subjectVariants.map((v, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedSubjectIdx(i)}
                    className={`w-full text-left rounded border px-3 py-2 text-xs transition-colors ${
                      selectedSubjectIdx === i
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-background hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <span className="font-mono">{v.subject}</span>
                    <Badge variant="outline" className="ml-2 text-[9px]">{v.style}</Badge>
                  </button>
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Body</Label>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="ghost" size="sm" onClick={handleShorten} className="gap-1 text-[11px] h-7">
                    <ArrowDown className="h-3 w-3" /> Shorten
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleLengthen} className="gap-1 text-[11px] h-7">
                    <ArrowUp className="h-3 w-3" /> Lengthen
                  </Button>
                </div>
              </div>
              <Textarea
                value={bodyOverride || effectiveDraft.body}
                onChange={(e) => setBodyOverride(e.target.value)}
                className="min-h-[280px] resize-y text-sm font-mono"
              />
            </div>

            {/* Action bar */}
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton
                getText={() => renderText(effectiveDraft)}
                label="Copy email"
              />
              <CopyButton
                getText={() => effectiveDraft.body}
                label="Copy body only"
              />
              <DownloadButton
                getText={() => renderText(effectiveDraft)}
                filename="email-draft.txt"
                label=".txt"
              />
              <DownloadButton
                getText={() => renderMarkdown(effectiveDraft, inputs)}
                filename="email-draft.md"
                label=".md"
              />
              <DownloadButton
                getText={() => renderJson(effectiveDraft, inputs)}
                filename="email-draft.json"
                mime="application/json"
                label=".json"
              />
              <DownloadButton
                getText={() => renderEml(effectiveDraft, {
                  from: inputs.signature.email || "you@example.com",
                  to: recipientEmail || "recipient@example.com",
                })}
                filename="email-draft.eml"
                mime="message/rfc822"
                label=".eml"
              />
              <div className="flex-1" />
              <Input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="recipient@example.com"
                className="h-9 text-xs max-w-[220px]"
              />
              <a
                href={renderMailto(effectiveDraft, recipientEmail || undefined)}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent h-9 px-3 text-xs font-medium"
              >
                <MailOpen className="h-3.5 w-3.5" /> Open in mail client
              </a>
            </div>

            {effectiveDraft.notes.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300 space-y-0.5">
                {effectiveDraft.notes.map((w, i) => <div key={i}>• {w}</div>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!effectiveDraft && (
        <EmptyState
          title="Pick a mode, purpose, tone, and length — then generate"
          hint="Compose mode starts from a short brief; Reply mode extracts each point from a pasted thread and addresses them. The draft is yours to edit, copy, mailto:, or export as .eml."
          icon={<Mail className="h-8 w-8" />}
        />
      )}

      {/* LLM polish */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <button
            type="button"
            onClick={() => setShowLlm((s) => !s)}
            className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:underline"
          >
            <Wand2 className="h-4 w-4" /> Optional: polish with LLM (BYO API key)
          </button>
          {showLlm && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Paste your own OpenAI or Anthropic API key. The key is stored only in this browser's localStorage
                and is sent directly to the provider you choose — never to UnQTools.
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                  className="h-9 text-xs rounded border bg-background px-2"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
                <Input
                  type="password"
                  value={llmKey}
                  onChange={(e) => setLlmKey(e.target.value)}
                  placeholder="sk-… / anthropic key"
                  className="h-9 text-xs max-w-[260px]"
                />
                <Button variant="outline" size="sm" onClick={handleSaveKey} className="gap-1.5">
                  <Key className="h-3.5 w-3.5" /> Save key
                </Button>
                <RunButton
                  onClick={handleLlm}
                  label="Polish with LLM"
                  loading={llmLoading}
                  disabled={!llmKey || !draft}
                />
              </div>
              {llmError && <ErrorBanner message={llmError} />}
              {llmResult && (
                <div className="rounded-lg border bg-background p-3 text-xs space-y-2">
                  {llmResult.refinedSubject && (
                    <div>
                      <div className="font-semibold">Refined subject</div>
                      <div className="font-mono">{llmResult.refinedSubject}</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-7 text-[11px]"
                        onClick={() => {
                          setBodyOverride(llmResult.refinedBody || bodyOverride || draft?.body || "");
                          toast.success("Refined body applied");
                        }}
                      >
                        Apply refined body
                      </Button>
                    </div>
                  )}
                  {llmResult.notes.length > 0 && (
                    <div>
                      <div className="font-semibold">Notes</div>
                      <ul className="list-disc list-inside text-muted-foreground">
                        {llmResult.notes.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
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
                <HistoryRow key={i} entry={h} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              <strong className="text-foreground">Honesty:</strong> This is a draft — review before sending. No sending backend; nothing is uploaded. Sensitive / legal content should be reviewed by a qualified human before sending.
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  return (
    <div className="rounded border bg-background px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[10px]">{entry.mode}</Badge>
        <Badge variant="outline" className="text-[10px]">{PURPOSE_LABELS[entry.purpose]}</Badge>
        <Badge variant="outline" className="text-[10px]">{TONE_LABELS[entry.tone]}</Badge>
        <Badge variant="outline" className="text-[10px]">{LENGTH_LABELS[entry.length].split(" ")[0]}</Badge>
        <span className="font-mono font-medium text-foreground">{entry.primarySubject}</span>
      </div>
      <div className="text-muted-foreground mt-0.5">
        → {entry.recipientName || "—"} · {entry.bodyPreview}… · {new Date(entry.ts).toLocaleString()}
      </div>
    </div>
  );
}

