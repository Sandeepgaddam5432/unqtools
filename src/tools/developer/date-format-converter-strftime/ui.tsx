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
  SYSTEM_LABELS,
  ALL_SYSTEMS,
  TOKEN_TABLE,
  countAllTokens,
  formatBySystem,
  convertPattern,
  lintPattern,
  explainPattern,
  detectFormat,
  codeSnippets,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type FormatSystem,
  type HistoryEntry,
} from "./logic";
import {
  History, CalendarDays, AlertTriangle, Info, Wand2,
  Code2, ListChecks, Search, Lightbulb,
} from "lucide-react";

type Tab = "format" | "translate" | "lint" | "cheatsheet" | "detect";

const COMMON_PATTERNS: Array<{ label: string; pattern: string; system: FormatSystem }> = [
  { label: "ISO 8601 (strftime)", pattern: "%Y-%m-%dT%H:%M:%S%z", system: "strftime" },
  { label: "ISO 8601 (moment)", pattern: "YYYY-MM-DDTHH:mm:ssZ", system: "moment" },
  { label: "US date (strftime)", pattern: "%m/%d/%Y", system: "strftime" },
  { label: "EU date (strftime)", pattern: "%d.%m.%Y", system: "strftime" },
  { label: "RFC 2822 (strftime)", pattern: "%a, %d %b %Y %H:%M:%S %z", system: "strftime" },
  { label: "Log timestamp (moment)", pattern: "YYYY-MM-DD HH:mm:ss.SSS", system: "moment" },
  { label: "Pretty (date-fns)", pattern: "EEEE, MMMM do yyyy", system: "date-fns" },
  { label: "Java SQL", pattern: "yyyy-MM-dd HH:mm:ss", system: "java" },
  { label: ".NET sortable", pattern: "yyyy-MM-ddTHH:mm:ss", system: "dotnet" },
];

export default function DateFormatConverterStrftime() {
  const [tab, setTab] = useState<Tab>("format");
  const [pattern, setPattern] = useState("%Y-%m-%d %H:%M:%S");
  const [system, setSystem] = useState<FormatSystem>("strftime");
  const [useUtc, setUseUtc] = useState(true);
  // Reference date inputs (UTC interpretation)
  const now = new Date();
  const [refYear, setRefYear] = useState(now.getUTCFullYear());
  const [refMonth, setRefMonth] = useState(now.getUTCMonth() + 1);
  const [refDay, setRefDay] = useState(now.getUTCDate());
  const [refHour, setRefHour] = useState(now.getUTCHours());
  const [refMinute, setRefMinute] = useState(now.getUTCMinutes());
  const [refSecond, setRefSecond] = useState(now.getUTCSeconds());
  // Detect tab
  const [detectInput, setDetectInput] = useState("2026-01-15T13:45:30Z");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.pattern) {
        setPattern(p.pattern);
        setSystem(p.system);
        setUseUtc(p.utc);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const refDate = useMemo(() => {
    return new Date(Date.UTC(refYear, refMonth - 1, refDay, refHour, refMinute, refSecond));
  }, [refYear, refMonth, refDay, refHour, refMinute, refSecond]);

  const formatted = useMemo(() => {
    try {
      return formatBySystem(refDate, pattern, system, { utc: useUtc });
    } catch (e) {
      return e instanceof Error ? `Error: ${e.message}` : "Error";
    }
  }, [refDate, pattern, system, useUtc]);

  const issues = useMemo(() => lintPattern(pattern, system), [pattern, system]);
  const explained = useMemo(
    () => explainPattern(pattern, system, refDate),
    [pattern, system, refDate],
  );

  const translations = useMemo(() => {
    return ALL_SYSTEMS.filter((s) => s !== system).map((s) => ({
      system: s,
      pattern: convertPattern(pattern, system, s),
      sample: (() => {
        try { return formatBySystem(refDate, convertPattern(pattern, system, s), s, { utc: useUtc }); }
        catch { return ""; }
      })(),
    }));
  }, [pattern, system, refDate, useUtc]);

  const detected = useMemo(() => detectFormat(detectInput), [detectInput]);

  const snippets = useMemo(
    () => codeSnippets(refDate, pattern, system),
    [refDate, pattern, system],
  );

  const handleSaveHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      pattern,
      system,
      preview: formatted.slice(0, 60),
    });
    setHistory(loadHistory());
  }, [pattern, system, formatted]);

  const handleClear = useCallback(() => {
    setPattern("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {(["format", "translate", "lint", "cheatsheet", "detect"] as Tab[]).map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={tab === t ? "default" : "outline"}
                  onClick={() => setTab(t)}
                >
                  {t === "format" ? "Format" :
                   t === "translate" ? "Translate" :
                   t === "lint" ? "Lint" :
                   t === "cheatsheet" ? "Cheatsheet" : "Detect"}
                </Button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={useUtc}
                onChange={(e) => setUseUtc(e.target.checked)}
              />
              Use UTC
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="dfc-pattern" className="text-xs">Pattern</Label>
                <Input
                  id="dfc-pattern"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="%Y-%m-%d %H:%M:%S"
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">System</Label>
                <select
                  value={system}
                  onChange={(e) => setSystem(e.target.value as FormatSystem)}
                  className="h-9 text-xs rounded border bg-background px-2"
                >
                  {ALL_SYSTEMS.map((s) => (
                    <option key={s} value={s}>{SYSTEM_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {COMMON_PATTERNS.map((p) => (
                <Button
                  key={p.label}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] font-mono"
                  onClick={() => { setPattern(p.pattern); setSystem(p.system); }}
                  title={`${p.label} (${p.system})`}
                >
                  + {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <NumField label="Y" value={refYear} onChange={setRefYear} min={-9999} max={9999} />
            <NumField label="M" value={refMonth} onChange={setRefMonth} min={1} max={12} />
            <NumField label="D" value={refDay} onChange={setRefDay} min={1} max={31} />
            <NumField label="H" value={refHour} onChange={setRefHour} min={0} max={23} />
            <NumField label="Min" value={refMinute} onChange={setRefMinute} min={0} max={59} />
            <NumField label="S" value={refSecond} onChange={setRefSecond} min={0} max={59} />
          </div>
        </CardContent>
      </Card>

      {(tab === "format" || tab === "translate") && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" /> Preview
            </h3>
            <div className="rounded border bg-background p-3 text-sm font-mono break-all">
              {formatted}
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton
                getText={() => { handleSaveHistory(); return formatted; }}
                label="Copy output"
              />
              <DownloadButton
                getText={() => JSON.stringify({
                  pattern, system, utc: useUtc,
                  refDate: refDate.toISOString(),
                  output: formatted,
                  translations: translations.map((t) => ({ system: t.system, pattern: t.pattern, sample: t.sample })),
                }, null, 2)}
                filename="date-format-result.json"
                mime="application/json"
                label="Download JSON"
              />
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(pattern, system, useUtc); }} />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "format" && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ListChecks className="h-4 w-4" /> Token-by-token explanation
            </h3>
            <div className="space-y-1">
              {explained.map((it, i) => (
                <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                  <Badge variant="outline" className="text-[10px] font-mono">{it.raw}</Badge>
                  <span className="text-muted-foreground flex-1">{it.desc}</span>
                  <span className="font-mono text-foreground">→ {it.example}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "translate" && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Wand2 className="h-4 w-4" /> Equivalent patterns in other systems
            </h3>
            <div className="space-y-1">
              {translations.map((t) => (
                <div key={t.system} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                  <Badge variant="secondary" className="text-[10px] w-24">{SYSTEM_LABELS[t.system]}</Badge>
                  <span className="flex-1 font-mono text-foreground truncate">{t.pattern}</span>
                  <span className="font-mono text-muted-foreground text-[10px] truncate max-w-[160px]">{t.sample}</span>
                  <CopyButton getText={() => { handleSaveHistory(); return t.pattern; }} label="" size="icon" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "lint" && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> Footgun linter ({issues.length} issue{issues.length === 1 ? "" : "s"})
            </h3>
            {issues.length === 0 ? (
              <div className="rounded border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 p-3 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                <Info className="h-4 w-4" /> No footguns detected for this pattern.
              </div>
            ) : (
              <div className="space-y-1">
                {issues.map((issue, i) => (
                  <div
                    key={i}
                    className={`rounded border p-3 text-xs flex items-start gap-2 ${
                      issue.severity === "warning"
                        ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200"
                        : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200"
                    }`}
                  >
                    <Badge variant="outline" className="text-[10px] font-mono mt-0.5">{issue.token}</Badge>
                    <Badge variant={issue.severity === "warning" ? "destructive" : "secondary"} className="text-[10px] mt-0.5">
                      {issue.severity}
                    </Badge>
                    <span className="flex-1">{issue.message}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "cheatsheet" && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ListChecks className="h-4 w-4" /> Token cheatsheet — {SYSTEM_LABELS[system]} ({TOKEN_TABLE[system].length} tokens, {countAllTokens()} total across 7 systems)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-[500px] overflow-auto">
              {TOKEN_TABLE[system].map((t) => (
                <div key={t.token} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                  <Badge variant="outline" className="text-[10px] font-mono w-20">{t.token}</Badge>
                  <span className="text-muted-foreground flex-1">{t.desc}</span>
                  <span className="font-mono text-foreground text-[10px]">
                    {(() => {
                      try { return formatBySystem(refDate, t.token, system, { utc: useUtc }); }
                      catch { return ""; }
                    })()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "detect" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Search className="h-4 w-4" /> Detect format from sample string
              </h3>
              <Input
                value={detectInput}
                onChange={(e) => setDetectInput(e.target.value)}
                placeholder="2026-01-15T13:45:30Z"
                className="font-mono text-xs"
              />
              {detected ? (
                <div className="rounded border bg-background p-3 text-xs space-y-1">
                  <div>
                    <Badge variant="secondary" className="text-[10px] mr-2">{SYSTEM_LABELS[detected.system]}</Badge>
                    <span className="font-mono text-foreground">{detected.pattern}</span>
                  </div>
                  <div className="text-muted-foreground">
                    Confidence: {Math.round(detected.confidence * 100)}%
                  </div>
                  <div className="text-muted-foreground">
                    Sample output: <span className="font-mono text-foreground">
                      {(() => {
                        try {
                          return formatBySystem(refDate, detected.pattern, detected.system, { utc: true });
                        } catch { return "(format error)"; }
                      })()}
                    </span>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Format not recognised"
                  hint="Try ISO 8601 (2026-01-15), slash dates (01/15/2026), or compact (20260115)."
                  icon={<Lightbulb className="h-8 w-8" />}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Code2 className="h-4 w-4" /> Code snippets
              </h3>
              {(["strftime", "moment", "dayjs", "luxon", "dateFns", "java", "dotnet"] as const).map((lang) => (
                <div key={lang} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] uppercase">{lang}</Badge>
                    <CopyButton getText={() => snippets[lang]} label="Copy" />
                  </div>
                  <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap">
                    {snippets[lang]}
                  </pre>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
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
                  onClick={() => { setPattern(h.pattern); setSystem(h.system); }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/30"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">{SYSTEM_LABELS[h.system]}</Badge>
                  <span className="font-mono text-foreground">{h.pattern}</span>
                  <span className="font-mono text-muted-foreground ml-2">→ {h.preview}</span>
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
            <strong className="text-foreground">Privacy:</strong> All formatting, conversion, and linting runs locally with JavaScript Date and Intl.DateTimeFormat. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function NumField({
  label, value, onChange, min, max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide">{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!Number.isNaN(v)) onChange(v);
        }}
        className="h-8 text-xs font-mono"
      />
    </div>
  );
}
