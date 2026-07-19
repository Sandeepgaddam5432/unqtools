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
  EMAIL_TYPES,
  EMAIL_TYPE_LABELS,
  EMAIL_TONES,
  EMAIL_TONE_LABELS,
  TYPE_DESCRIPTIONS,
  renderText,
  renderMarkdown,
  renderHtml,
  computeStats,
  generateBatch,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type EmailType,
  type EmailTone,
  type EmailInput,
  type EmailHistoryEntry,
} from "./logic";
import { History, Mail, Clock, AlertCircle, CheckCircle2, Layers } from "lucide-react";

const DEFAULT_INPUT: EmailInput = {
  templateType: "welcome",
  recipientName: "John",
  senderName: "Sarah",
  senderCompany: "Acme",
  subject: "",
  customFields: "",
  tone: "professional",
};

export default function EmailTemplateManager() {
  const [input, setInput] = useState<EmailInput>(DEFAULT_INPUT);
  const [renderMode, setRenderMode] = useState<"text" | "markdown" | "html">("text");
  const [history, setHistory] = useState<EmailHistoryEntry[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchTypes, setBatchTypes] = useState<EmailType[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (Object.keys(parsed).length > 0) {
        setInput((prev) => ({ ...prev, ...parsed }));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const rendered = useMemo(() => renderText(input), [input]);
  const stats = useMemo(() => computeStats(input), [input]);
  const text = useMemo(() => {
    const r = rendered;
    return `Subject: ${r.subject}\n\n${r.body}`;
  }, [rendered]);
  const md = useMemo(() => renderMarkdown(input), [input]);
  const html = useMemo(() => renderHtml(input), [input]);
  const batch = useMemo(
    () => batchOpen && batchTypes.length > 0 ? generateBatch(input, batchTypes) : null,
    [batchOpen, batchTypes, input],
  );

  const preview = useMemo(() => {
    if (renderMode === "markdown") return md;
    if (renderMode === "html") return html;
    return text;
  }, [renderMode, text, md, html]);

  const update = useCallback((patch: Partial<EmailInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSaveHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      templateType: input.templateType,
      tone: input.tone,
      recipientName: input.recipientName || "(none)",
      subject: rendered.subject,
      wordCount: rendered.wordCount,
    });
    setHistory(loadHistory());
  }, [input, rendered]);

  const handleDownloadHtml = useCallback(() => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${input.templateType}-email.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    handleSaveHistory();
    toast.success("HTML downloaded");
  }, [html, input.templateType, handleSaveHistory]);

  const toggleBatchType = (t: EmailType) => {
    setBatchTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  const handleClear = useCallback(() => {
    setInput(DEFAULT_INPUT);
    setBatchTypes([]);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const filenameBase = `${input.templateType}-email`;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="etm-type">Template type</Label>
              <select
                id="etm-type"
                value={input.templateType}
                onChange={(e) => update({ templateType: e.target.value as EmailType })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {EMAIL_TYPES.map((t) => (
                  <option key={t} value={t}>{EMAIL_TYPE_LABELS[t]}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">{TYPE_DESCRIPTIONS[input.templateType]}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="etm-tone">Tone</Label>
              <select
                id="etm-tone"
                value={input.tone}
                onChange={(e) => update({ tone: e.target.value as EmailTone })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {EMAIL_TONES.map((t) => (
                  <option key={t} value={t}>{EMAIL_TONE_LABELS[t]}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                {input.tone === "urgent" ? "Adds [URGENT] prefix to subject." : "Adjusts greeting and closing."}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="etm-rn">Recipient name</Label>
              <Input
                id="etm-rn"
                placeholder="John"
                value={input.recipientName}
                onChange={(e) => update({ recipientName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="etm-sn">Your name</Label>
              <Input
                id="etm-sn"
                placeholder="Sarah"
                value={input.senderName}
                onChange={(e) => update({ senderName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="etm-sc">Your company</Label>
              <Input
                id="etm-sc"
                placeholder="Acme"
                value={input.senderCompany}
                onChange={(e) => update({ senderCompany: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="etm-subj">Subject (leave blank to auto-generate)</Label>
              <span className={`text-[11px] font-mono ${stats.subjectTooLong ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                {stats.subjectLength}/60
              </span>
            </div>
            <Input
              id="etm-subj"
              placeholder="(auto-generated if blank)"
              value={input.subject}
              onChange={(e) => update({ subject: e.target.value })}
            />
            {stats.subjectTooLong && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Subject is over 60 chars — many email clients truncate.
              </p>
            )}
            {input.subject.trim() && (
              <p className="text-[11px] text-muted-foreground">Resolved: <span className="font-mono">{rendered.subject}</span></p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="etm-cf">Custom fields — one <code className="font-mono text-[11px]">key,value</code> per line</Label>
            <Textarea
              id="etm-cf"
              placeholder={"meeting_date,2026-07-20\nmeeting_time,14:00\nlocation,Zoom"}
              value={input.customFields}
              onChange={(e) => update({ customFields: e.target.value })}
              className="min-h-[80px] resize-y font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">Use <code className="font-mono">{"{{key}}"}</code> in subject or refer to them in templates. Common: <code className="font-mono">{"{{meeting_date}}"}</code>, <code className="font-mono">{"{{reason}}"}</code>, <code className="font-mono">{"{{due_date}}"}</code>.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Mail className="h-4 w-4" /> Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Type" value={stats.typeLabel} />
            <Stat label="Tone" value={stats.toneLabel} />
            <Stat label="Words" value={String(stats.wordCount)} />
            <Stat
              label="Read time"
              value={stats.readTimeLabel}
              icon={<Clock className="h-3 w-3 inline mr-1" />}
            />
            <Stat
              label="Subject length"
              value={`${stats.subjectLength} chars`}
              highlight={stats.subjectTooLong ? "bad" : undefined}
            />
            <Stat
              label="Placeholders"
              value={stats.hasPlaceholders ? `${stats.placeholders.length} unsubstituted` : "All resolved"}
              highlight={stats.hasPlaceholders ? "bad" : "good"}
            />
          </div>
          {stats.hasPlaceholders && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 p-3 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
                <AlertCircle className="h-4 w-4" /> Unsubstituted placeholders
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {stats.placeholders.map((p) => (
                  <Badge key={p} variant="outline" className="font-mono text-[10px]">{`{{${p}}}`}</Badge>
                ))}
              </div>
              <p className="mt-1 text-amber-700 dark:text-amber-400">Add these as custom fields (e.g. <code className="font-mono">{`${stats.placeholders[0] || "key"},value`}</code>) to substitute them.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Mail className="h-4 w-4" /> Preview
            </h3>
            <div className="flex gap-1">
              {(["text", "markdown", "html"] as const).map((m) => (
                <Button
                  key={m}
                  variant={renderMode === m ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setRenderMode(m)}
                >
                  {m === "text" ? "Text" : m === "markdown" ? "Markdown" : "HTML"}
                </Button>
              ))}
            </div>
          </div>

          {renderMode === "html" ? (
            <iframe
              title="Email preview"
              srcDoc={html}
              className="w-full rounded border bg-white min-h-[400px]"
              sandbox=""
            />
          ) : (
            <pre className="rounded border bg-muted/20 p-3 text-[11px] font-mono overflow-auto max-h-[500px] whitespace-pre-wrap">
              {preview}
            </pre>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <CopyButton
              getText={() => {
                handleSaveHistory();
                return renderMode === "html" ? html : preview;
              }}
              label="Copy"
            />
            <DownloadButton
              getText={() => { handleSaveHistory(); return text; }}
              filename={`${filenameBase}.txt`}
              mime="text/plain"
              label="Download .txt"
            />
            <DownloadButton
              getText={() => { handleSaveHistory(); return md; }}
              filename={`${filenameBase}.md`}
              mime="text/markdown"
              label="Download .md"
            />
            <Button variant="outline" size="sm" onClick={handleDownloadHtml} className="gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Download HTML
            </Button>
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <button
            onClick={() => setBatchOpen((v) => !v)}
            className="w-full text-left flex items-center justify-between"
          >
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="h-4 w-4" /> Multi-template batch generator
            </h3>
            <span className="text-xs text-muted-foreground">{batchOpen ? "Hide" : "Show"}</span>
          </button>
          {batchOpen && (
            <>
              <p className="text-xs text-muted-foreground">Pick multiple template types — we'll generate all of them using your current variables. Useful for building a full outreach sequence.</p>
              <div className="flex flex-wrap gap-1">
                {EMAIL_TYPES.map((t) => (
                  <Button
                    key={t}
                    variant={batchTypes.includes(t) ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => toggleBatchType(t)}
                  >
                    {EMAIL_TYPE_LABELS[t]}
                  </Button>
                ))}
              </div>
              {batch && (
                <div className="space-y-2 mt-2 max-h-[500px] overflow-auto">
                  {batchTypes.map((t) => {
                    const r = batch[t];
                    return (
                      <div key={t} className="rounded border bg-background p-3 text-xs">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px]">{EMAIL_TYPE_LABELS[t]}</Badge>
                          <span className="text-muted-foreground">{r.wordCount} words · {r.hasPlaceholders ? `${r.placeholders.length} unsubstituted` : "complete"}</span>
                        </div>
                        <div className="font-semibold text-foreground mb-1">{r.subject}</div>
                        <pre className="whitespace-pre-wrap font-mono text-[11px] text-muted-foreground line-clamp-6">{r.body}</pre>
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <CopyButton
                      getText={() => batchTypes.map((t) => `=== ${EMAIL_TYPE_LABELS[t]} ===\nSubject: ${batch[t].subject}\n\n${batch[t].body}`).join("\n\n\n")}
                      label="Copy all"
                    />
                    <DownloadButton
                      getText={() => batchTypes.map((t) => `=== ${EMAIL_TYPE_LABELS[t]} ===\nSubject: ${batch[t].subject}\n\n${batch[t].body}`).join("\n\n\n")}
                      filename="email-batch.txt"
                      mime="text/plain"
                      label="Download batch"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {history.length > 0 ? (
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{EMAIL_TYPE_LABELS[h.templateType]}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{EMAIL_TONE_LABELS[h.tone]}</Badge>
                  <span className="text-foreground truncate max-w-[300px]">{h.subject}</span>
                  <Badge variant="outline" className="text-[10px]">{h.wordCount} words</Badge>
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All template generation, variable substitution, and rendering happen 100% locally in your browser. Nothing is uploaded. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>

      {(!input.recipientName || !input.senderName || !input.senderCompany) && (
        <EmptyState
          title="Fill in recipient and sender details"
          hint="Enter at least the recipient name, your name, and your company to generate a personalized email template."
          icon={<Mail className="h-8 w-8" />}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  icon,
}: {
  label: string;
  value: string;
  highlight?: "bad" | "good";
  icon?: React.ReactNode;
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  const defaultIcon = highlight === "bad"
    ? <AlertCircle className="h-3 w-3 inline mr-1" />
    : highlight === "good"
      ? <CheckCircle2 className="h-3 w-3 inline mr-1" />
      : icon;
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${color}`}>{defaultIcon}{value}</div>
    </div>
  );
}
