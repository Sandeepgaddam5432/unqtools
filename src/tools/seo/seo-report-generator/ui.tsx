"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ALL_SECTIONS,
  SECTION_LABELS,
  REPORT_FORMATS,
  REPORT_FORMAT_LABELS,
  defaultInput,
  scoreInfo,
  SCORE_COLOR_HEX,
  SCORE_COLOR_NAME,
  computeOverallScore,
  validate,
  generateReport,
  computeSummaryStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ReportInput,
  type ReportFormat,
  type SectionId,
  type HistoryEntry,
} from "./logic";
import { History, FileText, CheckCircle2 } from "lucide-react";

export default function SeoReportGenerator() {
  const [input, setInput] = useState<ReportInput>(defaultInput());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (Object.keys(p).length > 0) {
        setInput((prev) => ({ ...prev, ...p }));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const validation = useMemo(() => validate(input), [input]);
  const overallScore = useMemo(() => computeOverallScore(input), [input]);
  const stats = useMemo(() => computeSummaryStats(input), [input]);

  const output = useMemo(() => {
    if (!validation.ok) return "";
    try {
      return generateReport(input);
    } catch {
      return "";
    }
  }, [input, validation.ok]);

  const setField = useCallback(<K extends keyof ReportInput>(key: K, value: ReportInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleSection = useCallback((s: SectionId) => {
    setInput((prev) => ({
      ...prev,
      sectionsToInclude: prev.sectionsToInclude.includes(s)
        ? prev.sectionsToInclude.filter((x) => x !== s)
        : [...prev.sectionsToInclude, s],
    }));
  }, []);

  const handleGenerate = useCallback(() => {
    setSubmitted(true);
    if (validation.ok) {
      saveHistory({
        ts: Date.now(),
        clientName: input.clientName,
        websiteUrl: input.websiteUrl,
        auditDate: input.auditDate,
        format: input.reportFormat,
        sectionsCount: input.sectionsToInclude.length,
        overallScore,
      });
      setHistory(loadHistory());
      toast.success("Report generated");
    } else {
      toast.error(validation.errors[0] ?? "Validation failed");
    }
  }, [validation, input, overallScore]);

  const handleClear = useCallback(() => {
    setInput(defaultInput());
    setSubmitted(false);
    toast.info("Form cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const scoreColorHex = overallScore !== null
    ? SCORE_COLOR_HEX[scoreInfo(String(overallScore)).color]
    : SCORE_COLOR_HEX.none;

  const fileExt = input.reportFormat === "markdown" ? "md" : input.reportFormat === "html" ? "html" : "txt";
  const mime = input.reportFormat === "markdown" ? "text/markdown" : input.reportFormat === "html" ? "text/html" : "text/plain";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Client & audit details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Client name *" value={input.clientName} onChange={(v) => setField("clientName", v)} placeholder="Acme Corp" id="sr-client" />
            <Field label="Website URL *" value={input.websiteUrl} onChange={(v) => setField("websiteUrl", v)} placeholder="https://acme.example.com" id="sr-url" />
            <Field label="Audit date *" value={input.auditDate} onChange={(v) => setField("auditDate", v)} placeholder="2024-03-15" id="sr-date" type="date" />
            <Field label="Auditor name *" value={input.auditorName} onChange={(v) => setField("auditorName", v)} placeholder="Jane SEO" id="sr-auditor" />
            <div className="space-y-1.5">
              <Label htmlFor="sr-format" className="text-xs">Report format</Label>
              <Select value={input.reportFormat} onValueChange={(v) => setField("reportFormat", v as ReportFormat)}>
                <SelectTrigger id="sr-format"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPORT_FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>{REPORT_FORMAT_LABELS[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Sections to include ({input.sectionsToInclude.length}/{ALL_SECTIONS.length})</h3>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setField("sectionsToInclude", [...ALL_SECTIONS])}>Select all</Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setField("sectionsToInclude", [])}>Clear all</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {ALL_SECTIONS.map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-xs cursor-pointer rounded border bg-background px-2.5 py-1.5">
                <input
                  type="checkbox"
                  checked={input.sectionsToInclude.includes(s)}
                  onChange={() => toggleSection(s)}
                />
                {SECTION_LABELS[s]}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Audit scores (0-100)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ScoreField label="Technical SEO (25%)" value={input.technicalSeoScore} onChange={(v) => setField("technicalSeoScore", v)} id="sr-tech" />
            <ScoreField label="On-Page SEO (25%)" value={input.onPageSeoScore} onChange={(v) => setField("onPageSeoScore", v)} id="sr-onpage" />
            <ScoreField label="Content (20%)" value={input.contentScore} onChange={(v) => setField("contentScore", v)} id="sr-content" />
            <ScoreField label="Backlinks (30%)" value={input.backlinkScore} onChange={(v) => setField("backlinkScore", v)} id="sr-backlink" />
          </div>
          <div className="pt-2 flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">Overall:</span>
            <Badge
              style={{ backgroundColor: scoreColorHex, color: "#fff" }}
              className="text-xs font-semibold"
            >
              {overallScore ?? "—"} / 100 — {overallScore !== null ? scoreInfo(String(overallScore)).label : "Not available"}
            </Badge>
            <span className="text-muted-foreground">({SCORE_COLOR_NAME[overallScore !== null ? scoreInfo(String(overallScore)).color : "none"]})</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Long text fields</h3>
          <FieldArea label="Executive summary" value={input.executiveSummary} onChange={(v) => setField("executiveSummary", v)} placeholder="Brief overview of the audit findings…" id="sr-exec" />
          <FieldArea
            label="Keyword rankings (CSV: keyword,position,url — one per line)"
            value={input.keywordRankings}
            onChange={(v) => setField("keywordRankings", v)}
            placeholder={"wireless headphones,3,https://acme.example.com/p1\nbluetooth speaker,12,https://acme.example.com/p2"}
            id="sr-keywords"
            mono
          />
          <FieldArea
            label="Top recommendations (one per line — first item = highest priority)"
            value={input.topRecommendations}
            onChange={(v) => setField("topRecommendations", v)}
            placeholder={"Fix title tags on top 10 pages\nImprove Core Web Vitals\nBuild 5 high-authority backlinks"}
            id="sr-recs"
          />
          <FieldArea
            label="Competitor URLs (one per line)"
            value={input.competitorUrls}
            onChange={(v) => setField("competitorUrls", v)}
            placeholder={"https://comp1.com\nhttps://comp2.com"}
            id="sr-comp"
            mono
          />
        </CardContent>
      </Card>

      {submitted && !validation.ok && (
        <ErrorBanner message={validation.errors.join("; ")} />
      )}
      {validation.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1">
          {validation.warnings.map((w, i) => (
            <div key={i}>• {w}</div>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <FileText className="h-4 w-4" /> Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Sections selected" value={`${stats.selectedSections}/${stats.totalSections}`} />
            <Stat label="Scores provided" value={`${stats.scoresProvided}/${stats.scoresTotal}`} />
            <Stat label="Keyword rows" value={stats.keywordCount} />
            <Stat label="Competitors" value={stats.competitorCount} />
            <Stat label="Recommendations" value={stats.recommendationCount} />
            <Stat label="Overall score" value={stats.overallScore ?? "—"} highlight={stats.overallColor === "excellent" || stats.overallColor === "good" ? "good" : stats.overallColor === "poor" ? "bad" : undefined} />
            <Stat label="Score label" value={stats.overallLabel} />
            <Stat label="Format" value={input.reportFormat} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleGenerate} disabled={!validation.ok}>Generate report</Button>
        <ShareButton getUrl={() => buildShareUrl(input)} />
        <ClearButton onClick={handleClear} />
      </div>

      {output ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Generated report ({input.reportFormat})
            </h3>
            <pre className="text-xs font-mono bg-muted/40 rounded p-3 overflow-auto max-h-[600px] whitespace-pre-wrap break-all">{output}</pre>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => { handleGenerate(); return output; }} label="Copy report" />
              <DownloadButton
                getText={() => output}
                filename={`seo-report-${input.clientName.toLowerCase().replace(/\s+/g, "-") || "untitled"}.${fileExt}`}
                mime={mime}
                label={`Download .${fileExt}`}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Fill in client + audit details to generate a report"
          hint="Required: client name, website URL, audit date, auditor name, at least one section. Optional: scores, keyword CSV, recommendations, competitors."
          icon={<FileText className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.format}</Badge>
                  {h.overallScore !== null && <Badge variant="outline" className="mr-2">{h.overallScore} / 100</Badge>}
                  <Badge variant="outline" className="mr-2">{h.sectionsCount} sections</Badge>
                  <span className="text-foreground">{h.clientName || "(unnamed)"}</span>
                  <span className="text-muted-foreground"> · {h.websiteUrl}</span>
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
            <strong className="text-foreground">Privacy:</strong> All report generation runs locally in your browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  id,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="text-xs" />
    </div>
  );
}

function ScoreField({
  label,
  value,
  onChange,
  id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  id: string;
}) {
  const info = scoreInfo(value);
  const hex = SCORE_COLOR_HEX[info.color];
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input id={id} type="number" min={0} max={100} value={value} onChange={(e) => onChange(e.target.value)} placeholder="0-100" className="text-xs" />
      {value !== "" && (
        <div className="text-[10px] font-medium" style={{ color: hex }}>
          {info.value} / 100 — {info.label}
        </div>
      )}
    </div>
  );
}

function FieldArea({
  label,
  value,
  onChange,
  placeholder,
  id,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`min-h-[80px] resize-y text-xs ${mono ? "font-mono" : ""}`} />
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
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
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
