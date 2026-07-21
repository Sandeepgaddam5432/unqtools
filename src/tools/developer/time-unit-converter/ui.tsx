"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  Clock, History, Code, FlaskConical, Table as TableIcon,
} from "lucide-react";
import {
  UNIT_INFO,
  DEV_UNIT_INFO,
  MONTH_DEFINITIONS,
  YEAR_DEFINITIONS,
  DEFAULT_CONFIG,
  convertAll,
  convertNumber,
  formatValueForDisplay,
  formatScientific,
  humanizeDuration,
  parseHumanDuration,
  generateCodeSnippet,
  validateValue,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Config,
  type AnyUnit,
  type MonthDef,
  type YearDef,
  type HistoryEntry,
} from "./logic";

export default function TimeUnitConverter() {
  const [valueStr, setValueStr] = useState("1");
  const [fromUnit, setFromUnit] = useState<AnyUnit>("h");
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [scientific, setScientific] = useState(false);
  const [showHumanize, setShowHumanize] = useState(true);
  const [humanInput, setHumanInput] = useState("1d 1h 1m 1s");
  const [codeLang, setCodeLang] = useState<"js" | "py">("js");
  const [toUnit, setToUnit] = useState<AnyUnit>("s");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p) {
        setValueStr(String(p.value));
        setFromUnit(p.from);
        setConfig(p.config);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const validation = useMemo(() => validateValue(valueStr), [valueStr]);
  const value = validation.ok ? validation.value : 0;

  const rows = useMemo(
    () => (validation.ok ? convertAll(value, fromUnit, config) : []),
    [value, fromUnit, config, validation.ok],
  );

  const directResult = useMemo(() => {
    if (!validation.ok) return null;
    return convertNumber(value, fromUnit, toUnit, config);
  }, [value, fromUnit, toUnit, config, validation.ok]);

  const humanized = useMemo(() => {
    if (!validation.ok) return "—";
    const seconds = convertNumber(value, fromUnit, "s", config);
    return humanizeDuration(seconds);
  }, [value, fromUnit, config, validation.ok]);

  const humanParseResult = useMemo(() => parseHumanDuration(humanInput), [humanInput]);

  const codeSnippet = useMemo(() => {
    if (!validation.ok) return "";
    return generateCodeSnippet(value, fromUnit, toUnit, config, codeLang);
  }, [value, fromUnit, toUnit, config, codeLang, validation.ok]);

  const handleSaveHistory = useCallback(() => {
    if (!validation.ok) return;
    saveHistory({
      ts: Date.now(),
      value,
      from: fromUnit,
      to: "all",
      month: config.month,
      year: config.year,
    });
    setHistory(loadHistory());
  }, [validation.ok, value, fromUnit, config]);

  const handleClear = useCallback(() => {
    setValueStr("1");
    setFromUnit("h");
    setConfig(DEFAULT_CONFIG);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const allUnits: AnyUnit[] = useMemo(
    () => [...UNIT_INFO.map((u) => u.id), ...DEV_UNIT_INFO.map((u) => u.id)],
    [],
  );

  const csv = useMemo(() => {
    const header = "unit,label,symbol,value,display,kind";
    const lines = rows.map((r) =>
      [r.unit, `"${r.label}"`, r.symbol, r.value, `"${r.display}"`, r.kind].join(","),
    );
    return [header, ...lines].join("\n");
  }, [rows]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Input */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2">
            <div>
              <Label htmlFor="tuc-value" className="text-xs">Value</Label>
              <Input
                id="tuc-value"
                value={valueStr}
                onChange={(e) => setValueStr(e.target.value)}
                placeholder="e.g. 1, 1.5, 1e9"
                className={`h-9 font-mono ${validation.ok ? "" : "border-destructive"}`}
              />
              {!validation.ok && (
                <p className="text-[10px] text-destructive mt-1">{validation.error}</p>
              )}
            </div>
            <div>
              <Label htmlFor="tuc-from" className="text-xs">From unit</Label>
              <select
                id="tuc-from"
                value={fromUnit}
                onChange={(e) => setFromUnit(e.target.value as AnyUnit)}
                className="h-9 rounded border bg-background px-2 text-sm w-full"
              >
                <optgroup label="Base units">
                  {UNIT_INFO.map((u) => (
                    <option key={u.id} value={u.id}>{u.label} ({u.symbol})</option>
                  ))}
                </optgroup>
                <optgroup label="Developer units">
                  {DEV_UNIT_INFO.map((u) => (
                    <option key={u.id} value={u.id}>{u.label} ({u.symbol})</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div>
              <Label htmlFor="tuc-to" className="text-xs">Quick convert to</Label>
              <select
                id="tuc-to"
                value={toUnit}
                onChange={(e) => setToUnit(e.target.value as AnyUnit)}
                className="h-9 rounded border bg-background px-2 text-sm w-full"
              >
                <optgroup label="Base units">
                  {UNIT_INFO.map((u) => (
                    <option key={u.id} value={u.id}>{u.label} ({u.symbol})</option>
                  ))}
                </optgroup>
                <optgroup label="Developer units">
                  {DEV_UNIT_INFO.map((u) => (
                    <option key={u.id} value={u.id}>{u.label} ({u.symbol})</option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Definitions */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div>
              <Label htmlFor="tuc-mo" className="text-xs">Month definition</Label>
              <select
                id="tuc-mo"
                value={config.month}
                onChange={(e) => setConfig((c) => ({ ...c, month: e.target.value as MonthDef }))}
                className="h-8 rounded border bg-background px-2 text-xs w-full"
              >
                {MONTH_DEFINITIONS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="tuc-yr" className="text-xs">Year definition</Label>
              <select
                id="tuc-yr"
                value={config.year}
                onChange={(e) => setConfig((c) => ({ ...c, year: e.target.value as YearDef }))}
                className="h-8 rounded border bg-background px-2 text-xs w-full"
              >
                {YEAR_DEFINITIONS.map((y) => (
                  <option key={y.id} value={y.id}>{y.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="tuc-fps" className="text-xs">Frames per second (fps)</Label>
              <Input
                id="tuc-fps"
                type="number"
                min={1}
                value={config.fps}
                onChange={(e) => setConfig((c) => ({ ...c, fps: Math.max(1, parseFloat(e.target.value || "1") || 1) }))}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div>
              <Label htmlFor="tuc-hz" className="text-xs">Kernel HZ (jiffies)</Label>
              <Input
                id="tuc-hz"
                type="number"
                min={1}
                value={config.hz}
                onChange={(e) => setConfig((c) => ({ ...c, hz: Math.max(1, parseFloat(e.target.value || "1") || 1) }))}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={scientific ? "default" : "outline"}
              onClick={() => setScientific((s) => !s)}
              className="gap-1.5"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              {scientific ? "Scientific on" : "Scientific off"}
            </Button>
            <Button
              size="sm"
              variant={showHumanize ? "default" : "outline"}
              onClick={() => setShowHumanize((s) => !s)}
              className="gap-1.5"
            >
              <Clock className="h-3.5 w-3.5" />
              {showHumanize ? "Humanize on" : "Humanize off"}
            </Button>
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(value, fromUnit, config); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {/* Quick conversion + humanize */}
      {validation.ok && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded border bg-background px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Quick conversion</div>
                <div className="font-mono text-base">
                  <span className="font-semibold text-foreground">{value}</span>
                  <span className="text-muted-foreground mx-1">{fromUnit}</span>
                  <span className="text-muted-foreground mx-1">=</span>
                  <span className="font-semibold text-foreground">
                    {scientific ? formatScientific(directResult ?? 0) : formatValueForDisplay(directResult ?? 0)}
                  </span>
                  <span className="text-muted-foreground ml-1">{toUnit}</span>
                </div>
              </div>
              {showHumanize && (
                <div className="rounded border bg-background px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Humanized</div>
                  <div className="font-mono text-base text-foreground">{humanized}</div>
                </div>
              )}
            </div>

            {/* Humanize inverse parser */}
            {showHumanize && (
              <div className="space-y-1.5">
                <Label htmlFor="tuc-human" className="text-xs">Parse a human duration ("1d 1h 1m 1s" → seconds)</Label>
                <div className="flex gap-2">
                  <Input
                    id="tuc-human"
                    value={humanInput}
                    onChange={(e) => setHumanInput(e.target.value)}
                    className="h-8 font-mono text-xs"
                    placeholder="1d 1h 1m 1s"
                  />
                  <div className="rounded border bg-background px-3 py-1.5 text-xs font-mono min-w-[120px]">
                    {humanParseResult.ok
                      ? `${humanParseResult.seconds.toLocaleString("en-US", { maximumFractionDigits: 6 })} s`
                      : <span className="text-destructive">{humanParseResult.error}</span>}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (humanParseResult.ok) {
                        setValueStr(String(humanParseResult.seconds));
                        setFromUnit("s");
                        toast.success("Loaded into converter");
                      } else {
                        toast.error("Could not parse");
                      }
                    }}
                    disabled={!humanParseResult.ok}
                  >
                    Load
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Batch table */}
      {validation.ok && rows.length > 0 ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <TableIcon className="h-4 w-4" /> Batch conversion table
                <Badge variant="secondary" className="text-[10px] ml-1">{rows.length} units</Badge>
              </h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return csv; }}
                  label="Copy CSV"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="time-unit-conversion.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
              </div>
            </div>
            <div className="max-h-[480px] overflow-auto rounded border bg-background">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left">Unit</th>
                    <th className="px-3 py-2 text-left">Symbol</th>
                    <th className="px-3 py-2 text-right">Value</th>
                    <th className="px-3 py-2 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const display = scientific ? formatScientific(r.value) : r.display;
                    return (
                      <tr key={r.unit} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-1.5">
                          <span className="font-medium text-foreground">{r.label}</span>
                          {r.kind === "dev" && (
                            <Badge variant="outline" className="ml-2 text-[9px]">dev</Badge>
                          )}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.symbol}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-foreground">{display}</td>
                        <td className="px-3 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(display).then(
                                () => toast.success(`Copied ${r.label}`),
                                () => toast.error("Copy failed"),
                              );
                            }}
                            className="text-[10px] text-primary hover:underline"
                          >
                            Copy
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        !validation.ok && (
          <EmptyState
            title="Enter a value to convert"
            hint="Type any number above and pick a source unit. We'll fan it out to every time unit, from nanoseconds to centuries."
            icon={<Clock className="h-8 w-8" />}
          />
        )
      )}

      {/* Code snippet */}
      {validation.ok && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Code className="h-4 w-4" /> Code snippet
              </h3>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={codeLang === "js" ? "default" : "outline"}
                  onClick={() => setCodeLang("js")}
                >
                  JavaScript
                </Button>
                <Button
                  size="sm"
                  variant={codeLang === "py" ? "default" : "outline"}
                  onClick={() => setCodeLang("py")}
                >
                  Python
                </Button>
              </div>
            </div>
            <pre className="rounded border bg-muted/30 p-3 text-xs font-mono overflow-auto max-h-[280px]">
              {codeSnippet}
            </pre>
            <div className="flex gap-2">
              <CopyButton getText={() => codeSnippet} label="Copy snippet" />
            </div>
          </CardContent>
        </Card>
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
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {history.slice(0, 10).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <Badge variant="outline" className="mr-2 font-mono">{h.from}</Badge>
                  <span className="font-mono font-medium mr-2">{h.value}</span>
                  <span className="text-muted-foreground">→ all units</span>
                  <span className="text-muted-foreground ml-2">· mo={h.month} y={h.year}</span>
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
            <strong className="text-foreground">Privacy:</strong> All conversion math runs locally with native BigInt + Number arithmetic.
            History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
