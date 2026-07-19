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
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  DURATIONS,
  DURATION_LABELS,
  PAYMENT_TERMS_LIST,
  PAYMENT_TERMS_LABELS,
  buildFullSections,
  renderText,
  renderMarkdown,
  renderHtml,
  computeStats,
  countSections,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ContractType,
  type ContractDuration,
  type PaymentTerms,
  type ContractInput,
  type ContractHistoryEntry,
} from "./logic";
import { History, FileSignature, FileText, AlertCircle, CheckCircle2 } from "lucide-react";

const DEFAULT_INPUT: ContractInput = {
  contractType: "freelance",
  partyAName: "Acme Corp",
  partyAAddress: "123 Main St\nAustin, TX 78701",
  partyBName: "Jane Doe",
  partyBAddress: "456 Oak Ave\nDallas, TX 75201",
  effectiveDate: new Date().toISOString().slice(0, 10),
  contractDuration: "6-months",
  projectDescription: "Design and develop a marketing landing page with up to 5 sections, responsive layout, and basic SEO setup.",
  compensationAmount: 5000,
  paymentTerms: "net-30",
  governingState: "Texas",
  additionalClauses: "",
};

export default function ContractTemplateGenerator() {
  const [input, setInput] = useState<ContractInput>(DEFAULT_INPUT);
  const [renderMode, setRenderMode] = useState<"text" | "markdown" | "html">("text");
  const [history, setHistory] = useState<ContractHistoryEntry[]>([]);

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

  const sections = useMemo(() => buildFullSections(input), [input]);
  const stats = useMemo(() => computeStats(input), [input]);
  const text = useMemo(() => renderText(input), [input]);
  const md = useMemo(() => renderMarkdown(input), [input]);
  const html = useMemo(() => renderHtml(input), [input]);
  const sectionCount = useMemo(() => countSections(input), [input]);

  const preview = useMemo(() => {
    if (renderMode === "text") return text;
    if (renderMode === "markdown") return md;
    return html;
  }, [renderMode, text, md, html]);

  const update = useCallback((patch: Partial<ContractInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSaveHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      contractType: input.contractType,
      partyAName: input.partyAName || "(draft)",
      partyBName: input.partyBName || "(draft)",
      effectiveDate: input.effectiveDate,
      sectionCount,
    });
    setHistory(loadHistory());
  }, [input, sectionCount]);

  const handleDownloadHtml = useCallback(() => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${input.contractType}-contract.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    handleSaveHistory();
    toast.success("HTML downloaded");
  }, [html, input.contractType, handleSaveHistory]);

  const handleOpenPrintable = useCallback(() => {
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Popup blocked — please allow popups");
      return;
    }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 250);
    handleSaveHistory();
  }, [html, handleSaveHistory]);

  const handleClear = useCallback(() => {
    setInput({ ...DEFAULT_INPUT, effectiveDate: new Date().toISOString().slice(0, 10) });
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const filenameBase = `${input.contractType}-contract`;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ctg-type">Contract type</Label>
              <select
                id="ctg-type"
                value={input.contractType}
                onChange={(e) => update({ contractType: e.target.value as ContractType })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {CONTRACT_TYPES.map((t) => (
                  <option key={t} value={t}>{CONTRACT_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ctg-date">Effective date</Label>
              <Input
                id="ctg-date"
                type="date"
                value={input.effectiveDate}
                onChange={(e) => update({ effectiveDate: e.target.value })}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Party A</Label>
              <Input
                placeholder="Party A name"
                value={input.partyAName}
                onChange={(e) => update({ partyAName: e.target.value })}
              />
              <Textarea
                placeholder="Address"
                value={input.partyAAddress}
                onChange={(e) => update({ partyAAddress: e.target.value })}
                className="min-h-[60px] resize-y text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Party B</Label>
              <Input
                placeholder="Party B name"
                value={input.partyBName}
                onChange={(e) => update({ partyBName: e.target.value })}
              />
              <Textarea
                placeholder="Address"
                value={input.partyBAddress}
                onChange={(e) => update({ partyBAddress: e.target.value })}
                className="min-h-[60px] resize-y text-xs"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ctg-dur">Duration</Label>
              <select
                id="ctg-dur"
                value={input.contractDuration}
                onChange={(e) => update({ contractDuration: e.target.value as ContractDuration })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>{DURATION_LABELS[d]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ctg-comp">Compensation (USD)</Label>
              <Input
                id="ctg-comp"
                type="number"
                step="0.01"
                min="0"
                value={input.compensationAmount || ""}
                onChange={(e) => update({ compensationAmount: Number(e.target.value) })}
                placeholder="5000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ctg-pt">Payment terms</Label>
              <select
                id="ctg-pt"
                value={input.paymentTerms}
                onChange={(e) => update({ paymentTerms: e.target.value as PaymentTerms })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {PAYMENT_TERMS_LIST.map((p) => (
                  <option key={p} value={p}>{PAYMENT_TERMS_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ctg-state">Governing state</Label>
              <Input
                id="ctg-state"
                placeholder="Texas"
                value={input.governingState}
                onChange={(e) => update({ governingState: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ctg-desc">Project description (for freelance / service / SOW)</Label>
              <Textarea
                id="ctg-desc"
                placeholder="Describe the services, deliverables, and milestones…"
                value={input.projectDescription}
                onChange={(e) => update({ projectDescription: e.target.value })}
                className="min-h-[60px] resize-y text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ctg-add">Additional clauses (one per line — optional)</Label>
            <Textarea
              id="ctg-add"
              placeholder={"All disputes shall be resolved by binding arbitration.\nNotices shall be sent via certified mail."}
              value={input.additionalClauses}
              onChange={(e) => update({ additionalClauses: e.target.value })}
              className="min-h-[60px] resize-y text-xs font-mono"
            />
          </div>

          {stats.hasMissing && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 p-3 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
                <AlertCircle className="h-4 w-4" /> Missing required fields
              </div>
              <ul className="mt-1 ml-5 list-disc text-amber-700 dark:text-amber-400">
                {stats.missingFields.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <FileSignature className="h-4 w-4" /> Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Type" value={stats.typeLabel} />
            <Stat label="Duration" value={stats.durationLabel} />
            <Stat label="Effective" value={stats.effectiveDateLong || "—"} />
            <Stat label="End date" value={stats.endDateLong || "—"} />
            <Stat label="Compensation" value={stats.compensationFormatted} />
            <Stat label="Payment terms" value={stats.paymentTermsLabel.split(" — ")[0]} />
            <Stat label="Sections" value={String(stats.sectionCount)} />
            <Stat
              label="Validation"
              value={stats.hasMissing ? `${stats.missingFields.length} missing` : "OK"}
              highlight={stats.hasMissing ? "bad" : "good"}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> Preview ({sections.length} sections)
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
              title="Contract preview"
              srcDoc={html}
              className="w-full rounded border bg-white min-h-[500px]"
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
              <FileText className="h-3.5 w-3.5" /> Download HTML
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenPrintable} className="gap-1.5">
              <FileSignature className="h-3.5 w-3.5" /> Print / Open
            </Button>
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {sections.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Table of Contents</h3>
            <ol className="space-y-1 text-xs">
              {sections.map((s) => (
                <li key={s.number} className="flex gap-2">
                  <span className="font-mono text-muted-foreground">{s.number}.</span>
                  <span className="text-foreground">{s.title}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{CONTRACT_TYPE_LABELS[h.contractType]}</Badge>
                  <span className="text-foreground">{h.partyAName} ↔ {h.partyBName}</span>
                  <Badge variant="secondary" className="text-[10px]">{h.sectionCount} sections</Badge>
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All contract generation runs 100% locally in your browser. Nothing is uploaded. History is stored in localStorage on this device only.
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 flex items-start gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span><strong>Not legal advice.</strong> Templates are starting points. Have a qualified attorney review any contract before signing.</span>
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
  value: string;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  const icon = highlight === "bad"
    ? <AlertCircle className="h-3 w-3 inline mr-1" />
    : highlight === "good"
      ? <CheckCircle2 className="h-3 w-3 inline mr-1" />
      : null;
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${color}`}>{icon}{value}</div>
    </div>
  );
}
