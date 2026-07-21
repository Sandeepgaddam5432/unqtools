"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  History, Clock, Calendar, AlertTriangle, CheckCircle2,
  Zap, Settings2, ChevronRight, ListChecks,
} from "lucide-react";
import {
  CRON_PRESETS,
  FIELD_RANGES,
  FIELD_LABELS,
  FIELD_DESCRIPTIONS,
  MODE_LABELS,
  MONTH_NAMES,
  MONTH_LABELS,
  WEEKDAY_NAMES,
  WEEKDAY_LABELS,
  SYNTAX_LABELS,
  SYNTAX_DESCRIPTIONS,
  defaultConfig,
  parseField,
  renderField,
  buildExpression,
  parseExpression,
  applyPreset,
  validateConfig,
  describeConfig,
  computeNextRuns,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CronConfig,
  type CronFieldConfig,
  type CronFieldName,
  type CronMode,
  type CronSyntax,
  type CronValidationError,
  type HistoryEntry,
} from "./logic";

export default function CrontabGenerator() {
  const [syntax, setSyntax] = useState<CronSyntax>("unix");
  const [cfg, setCfg] = useState<CronConfig>(() => defaultConfig("unix"));
  const [expressionInput, setExpressionInput] = useState("* * * * *");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Sync default expression on mount + load share-link
  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.expression) {
        try {
          const newCfg = parseExpression(p.expression);
          newCfg.syntax = p.syntax;
          setSyntax(p.syntax);
          setCfg(newCfg);
          setExpressionInput(p.expression);
          toast.info("Loaded from share link");
        } catch {
          // ignore parse errors
        }
      }
    } else {
      // Initialize from the default config
      setExpressionInput(buildExpression(defaultConfig("unix")));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived: expression + description + validation + next runs
  const expression = useMemo(() => buildExpression(cfg), [cfg]);
  const description = useMemo(() => describeConfig(cfg), [cfg]);
  const validation = useMemo(() => validateConfig(cfg), [cfg]);
  const nextRuns = useMemo(() => {
    if (!validation.valid) return [];
    return computeNextRuns(cfg, 5, new Date());
  }, [cfg, validation.valid]);

  // Keep expressionInput in sync with cfg (unless user is typing)
  const [expressionFocused, setExpressionFocused] = useState(false);
  useEffect(() => {
    if (!expressionFocused) setExpressionInput(expression);
  }, [expression, expressionFocused]);

  // Field update helper
  const updateField = useCallback((field: CronFieldName, newCfg: CronFieldConfig) => {
    setCfg((prev) => ({ ...prev, [field]: newCfg }));
  }, []);

  const updateSeconds = useCallback((newCfg: CronFieldConfig) => {
    setCfg((prev) => ({ ...prev, seconds: newCfg }));
  }, []);

  const updateYear = useCallback((newCfg: CronFieldConfig) => {
    setCfg((prev) => ({ ...prev, year: newCfg }));
  }, []);

  // Apply preset
  const handlePreset = useCallback((id: string) => {
    const newCfg = applyPreset(id);
    if (!newCfg) return;
    setSyntax(newCfg.syntax);
    setCfg(newCfg);
    const preset = CRON_PRESETS.find((p) => p.id === id);
    toast.success(`Applied preset: ${preset?.label ?? id}`);
  }, []);

  // Two-way sync: parse expression → cfg
  const handleExpressionInput = useCallback((raw: string) => {
    setExpressionInput(raw);
    const trimmed = raw.trim();
    if (trimmed.split(/\s+/).length >= 5) {
      try {
        const parsed = parseExpression(trimmed);
        // Heuristic syntax detection (same as validateExpression)
        const parts = trimmed.split(/\s+/);
        let detected: CronSyntax = "unix";
        if (parts.length >= 7) detected = "quartz";
        else if (parts.length === 6) {
          detected = /^\d{4}$/.test(parts[5]) && parseInt(parts[5], 10) >= 1970 ? "aws" : "quartz";
        }
        parsed.syntax = detected;
        setSyntax(detected);
        setCfg(parsed);
      } catch {
        // ignore parse errors while typing
      }
    }
  }, []);

  const handleSyntaxChange = useCallback((s: CronSyntax) => {
    setSyntax(s);
    setCfg((prev) => {
      const next = { ...prev, syntax: s };
      if (s === "quartz" && !next.seconds) next.seconds = { mode: "every" };
      return next;
    });
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (validation.valid && expression) {
      saveHistory({
        ts: Date.now(),
        expression,
        syntax,
        description: description.short,
      });
      setHistory(loadHistory());
    }
  }, [validation.valid, expression, syntax, description.short]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleClear = useCallback(() => {
    const fresh = defaultConfig(syntax);
    setCfg(fresh);
    setExpressionInput(buildExpression(fresh));
    toast.info("Cleared");
  }, [syntax]);

  const crontabLine = useMemo(() => {
    return expression + (cfg.command ? ` ${cfg.command}` : "");
  }, [expression, cfg.command]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Syntax switcher + presets */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs">Syntax:</Label>
            {(["unix", "quartz", "aws"] as CronSyntax[]).map((s) => (
              <Button
                key={s}
                variant={syntax === s ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleSyntaxChange(s)}
              >{SYNTAX_LABELS[s]}</Button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{SYNTAX_DESCRIPTIONS[syntax]}</p>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <Zap className="h-3 w-3" /> Presets
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {CRON_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => handlePreset(p.id)}
                  title={p.description}
                >{p.label}</Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expression (two-way) */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="cron-expr" className="text-xs flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Expression
            </Label>
            <Badge variant={validation.valid ? "secondary" : "destructive"} className="text-[10px]">
              {validation.valid ? "Valid" : "Invalid"}
            </Badge>
          </div>
          <Input
            id="cron-expr"
            value={expressionInput}
            onChange={(e) => handleExpressionInput(e.target.value)}
            onFocus={() => setExpressionFocused(true)}
            onBlur={() => setExpressionFocused(false)}
            className="font-mono text-base"
            spellCheck={false}
          />
          <p className="text-sm text-foreground font-medium">{description.text}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <CopyButton
              getText={() => { handleSaveHistory(); return crontabLine; }}
              label="Copy"
            />
            <DownloadButton
              getText={() => `${crontabLine}\n`}
              filename="crontab.txt"
              mime="text/plain"
              label="Download .cron"
            />
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(expression, syntax); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {/* Validation errors */}
      {validation.errors.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span className="font-medium text-foreground">
                {validation.valid ? "Warnings" : "Validation issues"} ({validation.errors.length})
              </span>
            </div>
            {validation.errors.map((e, i) => (
              <ValidationErrorRow key={i} error={e} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Field builder */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Settings2 className="h-4 w-4" /> Builder
          </h3>
          <div className="space-y-2">
            {syntax === "quartz" && cfg.seconds && (
              <FieldEditor
                title="Seconds"
                description="0–59"
                cfg={cfg.seconds}
                onChange={updateSeconds}
                field="minute"
              />
            )}
            <FieldEditor
              title="Minute"
              description={FIELD_DESCRIPTIONS.minute}
              cfg={cfg.minute}
              onChange={(c) => updateField("minute", c)}
              field="minute"
            />
            <FieldEditor
              title="Hour"
              description={FIELD_DESCRIPTIONS.hour}
              cfg={cfg.hour}
              onChange={(c) => updateField("hour", c)}
              field="hour"
            />
            <FieldEditor
              title="Day of month"
              description={FIELD_DESCRIPTIONS.dayOfMonth}
              cfg={cfg.dayOfMonth}
              onChange={(c) => updateField("dayOfMonth", c)}
              field="dayOfMonth"
            />
            <FieldEditor
              title="Month"
              description={FIELD_DESCRIPTIONS.month}
              cfg={cfg.month}
              onChange={(c) => updateField("month", c)}
              field="month"
            />
            <FieldEditor
              title="Day of week"
              description={FIELD_DESCRIPTIONS.dayOfWeek}
              cfg={cfg.dayOfWeek}
              onChange={(c) => updateField("dayOfWeek", c)}
              field="dayOfWeek"
            />
            {(syntax === "quartz" || syntax === "aws") && (
              <FieldEditor
                title="Year"
                description="Optional — defaults to every year (*)"
                cfg={cfg.year ?? { mode: "every" }}
                onChange={updateYear}
                field="minute"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Next runs */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Calendar className="h-4 w-4" /> Next 5 runs
            </h3>
            <span className="text-[10px] text-muted-foreground">
              In your local timezone (DST-aware)
            </span>
          </div>
          {nextRuns.length > 0 ? (
            <div className="space-y-1">
              {nextRuns.map((r, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">#{i + 1}</Badge>
                  <span className="font-mono text-foreground">
                    {r.date.toLocaleString(undefined, {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto" />
                  <span className="text-muted-foreground">{r.date.toLocaleDateString(undefined, { weekday: "long" })}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title={validation.valid ? "No runs in the next year" : "Fix the validation errors to see next runs"}
              hint={validation.valid
                ? "This expression doesn't match any time in the next 12 months (e.g. Feb 31)."
                : "Resolve the errors above to see when this cron will fire next."}
              icon={<Calendar className="h-8 w-8" />}
            />
          )}
        </CardContent>
      </Card>

      {/* Command line preview */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ListChecks className="h-4 w-4" /> Crontab entry
            </h3>
          </div>
          <Label htmlFor="cron-cmd" className="text-[11px] text-muted-foreground">
            Optional command (shown after the expression)
          </Label>
          <Input
            id="cron-cmd"
            value={cfg.command ?? ""}
            onChange={(e) => setCfg((prev) => ({ ...prev, command: e.target.value }))}
            placeholder="/usr/local/bin/backup.sh"
            className="font-mono text-xs"
          />
          <pre className="rounded border bg-muted/30 p-3 text-xs font-mono overflow-x-auto whitespace-pre">
            {crontabLine}
          </pre>
        </CardContent>
      </Card>

      {/* Recent history */}
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
              {history.slice(0, 8).map((h, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const parsed = parseExpression(h.expression);
                    parsed.syntax = h.syntax;
                    setSyntax(h.syntax);
                    setCfg(parsed);
                    setExpressionInput(h.expression);
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-1.5 text-xs hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px]">{SYNTAX_LABELS[h.syntax]}</Badge>
                    <span className="font-mono text-foreground flex-1 truncate">{h.expression}</span>
                    <span className="text-muted-foreground truncate">{h.description}</span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> 100% client-side — next-run computation runs entirely in your browser, no network calls, no ads, no tracking. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function FieldEditor({
  title,
  description,
  cfg,
  onChange,
  field,
}: {
  title: string;
  description: string;
  cfg: CronFieldConfig;
  onChange: (cfg: CronFieldConfig) => void;
  field: CronFieldName;
}) {
  const range = FIELD_RANGES[field];
  const max = field === "dayOfWeek" ? 6 : range.max;
  const isDow = field === "dayOfWeek";
  const isMonth = field === "month";

  const setMode = (mode: CronMode) => {
    if (mode === "every") onChange({ mode });
    else if (mode === "everyN") onChange({ mode, step: 2 });
    else if (mode === "specific") onChange({ mode, values: [range.min] });
    else if (mode === "range") onChange({ mode, rangeStart: range.min, rangeEnd: Math.min(range.min + 4, max) });
    else if (mode === "rangeStep") onChange({ mode, rangeStart: range.min, rangeEnd: max, step: 2 });
  };

  const toggleValue = (v: number) => {
    const vals = cfg.values ?? [];
    const next = vals.includes(v) ? vals.filter((x) => x !== v) : [...vals, v].sort((a, b) => a - b);
    onChange({ mode: "specific", values: next });
  };

  const valueButtons = useMemo(() => {
    const out: { v: number; label: string }[] = [];
    for (let v = range.min; v <= max; v++) {
      let label = String(v);
      if (isMonth) label = MONTH_NAMES[v - 1];
      else if (isDow) label = WEEKDAY_NAMES[v];
      out.push({ v, label });
    }
    return out;
  }, [field, range.min, max, isMonth, isDow]);

  return (
    <div className="rounded border bg-background p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-foreground">{title}</div>
          <div className="text-[10px] text-muted-foreground">{description}</div>
        </div>
        <Badge variant="outline" className="font-mono text-[11px]">{renderField(field, cfg)}</Badge>
      </div>

      <div className="flex flex-wrap gap-1">
        {(Object.keys(MODE_LABELS) as CronMode[]).map((m) => (
          <Button
            key={m}
            variant={cfg.mode === m ? "default" : "outline"}
            size="sm"
            className="h-6 text-[10px]"
            onClick={() => setMode(m)}
          >{MODE_LABELS[m]}</Button>
        ))}
      </div>

      {cfg.mode === "everyN" && (
        <div className="flex items-center gap-2 text-xs">
          <Label className="text-[11px]">Step:</Label>
          <Input
            type="number"
            min={1}
            max={max}
            value={cfg.step ?? 1}
            onChange={(e) => onChange({ ...cfg, step: parseInt(e.target.value, 10) || 1 })}
            className="h-7 w-16 font-mono text-xs"
          />
          <span className="text-[10px] text-muted-foreground">→ {renderField(field, cfg)}</span>
        </div>
      )}

      {cfg.mode === "range" && (
        <div className="flex items-center gap-2 text-xs">
          <Label className="text-[11px]">From:</Label>
          <Input
            type="number"
            min={range.min}
            max={max}
            value={cfg.rangeStart ?? range.min}
            onChange={(e) => onChange({ ...cfg, rangeStart: parseInt(e.target.value, 10) || range.min })}
            className="h-7 w-16 font-mono text-xs"
          />
          <Label className="text-[11px]">to:</Label>
          <Input
            type="number"
            min={range.min}
            max={max}
            value={cfg.rangeEnd ?? max}
            onChange={(e) => onChange({ ...cfg, rangeEnd: parseInt(e.target.value, 10) || max })}
            className="h-7 w-16 font-mono text-xs"
          />
        </div>
      )}

      {cfg.mode === "rangeStep" && (
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <Label className="text-[11px]">From:</Label>
          <Input
            type="number"
            min={range.min}
            max={max}
            value={cfg.rangeStart ?? range.min}
            onChange={(e) => onChange({ ...cfg, rangeStart: parseInt(e.target.value, 10) || range.min })}
            className="h-7 w-14 font-mono text-xs"
          />
          <Label className="text-[11px]">to:</Label>
          <Input
            type="number"
            min={range.min}
            max={max}
            value={cfg.rangeEnd ?? max}
            onChange={(e) => onChange({ ...cfg, rangeEnd: parseInt(e.target.value, 10) || max })}
            className="h-7 w-14 font-mono text-xs"
          />
          <Label className="text-[11px]">step:</Label>
          <Input
            type="number"
            min={1}
            max={max}
            value={cfg.step ?? 1}
            onChange={(e) => onChange({ ...cfg, step: parseInt(e.target.value, 10) || 1 })}
            className="h-7 w-14 font-mono text-xs"
          />
        </div>
      )}

      {(cfg.mode === "specific") && (
        <div className="flex flex-wrap gap-1 max-h-[120px] overflow-auto">
          {valueButtons.map(({ v, label }) => {
            const active = (cfg.values ?? []).includes(v);
            return (
              <Button
                key={v}
                variant={active ? "default" : "outline"}
                size="sm"
                className="h-6 min-w-[2.2rem] text-[10px] font-mono px-1.5"
                onClick={() => toggleValue(v)}
                title={isMonth ? MONTH_LABELS[v - 1] : isDow ? WEEKDAY_LABELS[v] : String(v)}
              >{label}</Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ValidationErrorRow({ error }: { error: CronValidationError }) {
  const isError = error.severity === "error";
  return (
    <div className={`flex items-start gap-2 rounded border px-2 py-1.5 text-xs ${
      isError
        ? "border-red-300/50 bg-red-50/30 dark:bg-red-950/20"
        : "border-amber-300/50 bg-amber-50/30 dark:bg-amber-950/20"
    }`}>
      {isError
        ? <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" />
        : <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />}
      <div className="flex-1">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[9px]">{error.field}</Badge>
          <Badge variant={isError ? "destructive" : "secondary"} className="text-[9px]">{error.severity}</Badge>
        </div>
        <div className="text-foreground mt-0.5">{error.message}</div>
      </div>
    </div>
  );
}
