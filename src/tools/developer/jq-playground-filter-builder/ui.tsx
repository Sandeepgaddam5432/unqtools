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
  DEFAULT_FLAGS,
  SAMPLE_JSON,
  RECIPES,
  STEP_TYPE_LABELS,
  parseInput,
  formatOutput,
  run,
  buildFilter,
  renderStep,
  decodeError,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Flags,
  type BuilderStep,
  type BuilderStepType,
  type HistoryEntry,
} from "./logic";
import {
  History, Braces, Play, BookOpen, Plus, Trash2, Filter, Zap, AlertTriangle,
  CheckCircle2, Wand2,
} from "lucide-react";

export default function JqPlaygroundFilterBuilder() {
  const [input, setInput] = useState(SAMPLE_JSON[0].json);
  const [filter, setFilter] = useState(".");
  const [flags, setFlags] = useState<Flags>(DEFAULT_FLAGS);
  const [steps, setSteps] = useState<BuilderStep[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"raw" | "builder">("raw");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.filter) setFilter(p.filter);
      if (p.input) setInput(p.input);
      setFlags(p.flags);
      if (p.filter || p.input) toast.info("Loaded from share link");
    }
  }, []);

  const result = useMemo(() => run(input, filter, flags), [input, filter, flags]);
  const output = useMemo(() => formatOutput(result.results, flags), [result, flags]);
  const builderState = useMemo(() => buildFilter(steps), [steps]);
  const errorInfo = useMemo(
    () => result.error ? decodeError(result.error) : null,
    [result.error],
  );

  // When builder steps change, sync the filter (unless user is editing raw).
  useEffect(() => {
    if (activeTab === "builder" && steps.length > 0) {
      setFilter(builderState.filter);
    }
  }, [steps, activeTab, builderState.filter]);

  const toggleFlag = useCallback((key: keyof Flags) => {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (filter && result.inputValid) {
      saveHistory({
        ts: Date.now(),
        filter,
        resultCount: result.results.length,
        inputBytes: input.length,
      });
      setHistory(loadHistory());
    }
  }, [filter, input, result]);

  const handleClear = useCallback(() => {
    setInput("");
    setFilter(".");
    setFlags(DEFAULT_FLAGS);
    setSteps([]);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const loadSample = useCallback((idx: number) => {
    setInput(SAMPLE_JSON[idx].json);
    toast.info(`Loaded sample: ${SAMPLE_JSON[idx].label}`);
  }, []);

  const loadRecipe = useCallback((filterStr: string) => {
    setFilter(filterStr);
    setActiveTab("raw");
    toast.info("Loaded recipe");
  }, []);

  const addStep = useCallback((type: BuilderStepType) => {
    const step: BuilderStep = { type };
    if (type === "field" || type === "sort_by" || type === "group_by" || type === "unique_by" || type === "del" || type === "has") {
      step.field = "";
    } else if (type === "select") {
      step.condition = ". != null";
    } else if (type === "map" || type === "map_values" || type === "first" || type === "last") {
      step.expr = ".";
    } else if (type === "limit") {
      step.count = 1;
      step.limitExpr = ".[]";
    } else if (type === "index") {
      step.index = 0;
    } else if (type === "contains") {
      step.value = "{}";
    } else if (type === "array_constructor") {
      step.arrayExpr = ".";
    }
    setSteps((prev) => [...prev, step]);
    setActiveTab("builder");
  }, []);

  const updateStep = useCallback((index: number, patch: Partial<BuilderStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }, []);

  const removeStep = useCallback((index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const moveStep = useCallback((index: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="jq-input" className="text-sm font-semibold flex items-center gap-1.5">
              <Braces className="h-4 w-4" /> JSON input
            </Label>
            <div className="flex flex-wrap gap-1">
              {SAMPLE_JSON.map((s, i) => (
                <Button
                  key={i}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => loadSample(i)}
                  title={`Load: ${s.label}`}
                >{s.label}</Button>
              ))}
            </div>
          </div>
          <Textarea
            id="jq-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='{"hello": "world"}'
            className="min-h-[120px] resize-y font-mono text-xs"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Label className="text-xs">Flags:</Label>
            <FlagToggle label="-c (compact)" checked={flags.compact} onChange={() => toggleFlag("compact")} />
            <FlagToggle label="-r (raw)" checked={flags.raw} onChange={() => toggleFlag("raw")} />
            <FlagToggle label="-s (slurp NDJSON)" checked={flags.slurp} onChange={() => toggleFlag("slurp")} />
            <FlagToggle label="-S (sort keys)" checked={flags.sortKeys} onChange={() => toggleFlag("sortKeys")} />
            <Badge variant="outline" className="text-[10px]">
              {result.inputValid ? `${result.inputCount} input(s)` : "invalid input"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="jq-filter" className="text-sm font-semibold flex items-center gap-1.5">
              <Filter className="h-4 w-4" /> jq filter
            </Label>
            <div className="flex gap-1">
              <Button
                variant={activeTab === "raw" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setActiveTab("raw")}
              >Raw editor</Button>
              <Button
                variant={activeTab === "builder" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setActiveTab("builder")}
              ><Wand2 className="h-3 w-3" /> Builder</Button>
            </div>
          </div>
          {activeTab === "raw" ? (
            <Input
              id="jq-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="."
              className="font-mono text-xs"
            />
          ) : (
            <BuilderPanel
              steps={steps}
              builderFilter={builderState.filter}
              explained={builderState.explained}
              onAdd={addStep}
              onUpdate={updateStep}
              onRemove={removeStep}
              onMove={moveStep}
            />
          )}
        </CardContent>
      </Card>

      {result.inputError && (
        <ErrorBanner message={`Input JSON error: ${result.inputError}`} />
      )}
      {result.error && (
        <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-4 w-4" /> Filter error
          </div>
          <div className="font-mono">{result.error}</div>
          {errorInfo && errorInfo.hint && (
            <div className="text-foreground/80">
              <strong>Hint:</strong> {errorInfo.hint}
            </div>
          )}
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Play className="h-4 w-4" /> Output
              <Badge variant="secondary" className="text-[10px] ml-1">{result.results.length} result(s)</Badge>
              {!result.error && result.inputValid && result.results.length > 0 && (
                <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> ok
                </Badge>
              )}
            </h3>
            <div className="flex flex-wrap gap-2">
              <CopyButton
                getText={() => { handleSaveHistory(); return output; }}
                label="Copy output"
              />
              <DownloadButton
                getText={() => output}
                filename="jq-output.json"
                mime="application/json"
                label="Download"
              />
              <ShareButton
                getUrl={() => { handleSaveHistory(); return buildShareUrl(filter, input, flags); }}
              />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          {output ? (
            <pre className="rounded-lg bg-muted/50 border p-3 text-xs font-mono overflow-auto max-h-[400px] whitespace-pre">
              {output}
            </pre>
          ) : (
            <EmptyState
              title="No output yet"
              hint="Enter JSON, choose or write a filter, and the result appears here."
              icon={<Play className="h-8 w-8" />}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /> Recipe library
          </h3>
          <div className="flex flex-wrap gap-1">
            {RECIPES.map((r) => (
              <Button
                key={r.id}
                variant="outline"
                size="sm"
                className="h-7 text-[11px] font-mono"
                onClick={() => loadRecipe(r.filter)}
                title={r.description}
              >{r.label}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

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
                  onClick={() => setFilter(h.filter)}
                  className="w-full text-left rounded border bg-background px-3 py-1.5 text-xs hover:bg-muted/40"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.resultCount}</Badge>
                  <span className="font-mono text-foreground">{h.filter || "."}</span>
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
            <strong className="text-foreground">Privacy:</strong> The jq interpreter runs entirely in your browser — your JSON never leaves the device. History is stored in localStorage on this device only. Subset of jq is supported; for the full engine use play.jqlang.org.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Builder panel
// ---------------------------------------------------------------------------

function BuilderPanel({
  steps,
  builderFilter,
  explained,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
}: {
  steps: BuilderStep[];
  builderFilter: string;
  explained: { n: number; fragment: string; explanation: string }[];
  onAdd: (type: BuilderStepType) => void;
  onUpdate: (index: number, patch: Partial<BuilderStep>) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, dir: -1 | 1) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Add step</Label>
        <div className="flex flex-wrap gap-1 pt-1 max-h-[120px] overflow-auto">
          {(Object.keys(STEP_TYPE_LABELS) as BuilderStepType[]).map((t) => (
            <Button
              key={t}
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] font-mono"
              onClick={() => onAdd(t)}
            >{STEP_TYPE_LABELS[t]}</Button>
          ))}
        </div>
      </div>
      {steps.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No builder steps yet. Click a step type above to add one. The filter string will update as you go.
        </p>
      ) : (
        <div className="space-y-2">
          {steps.map((s, i) => (
            <StepEditor
              key={i}
              step={s}
              index={i}
              total={steps.length}
              explained={explained[i]}
              onUpdate={(patch) => onUpdate(i, patch)}
              onRemove={() => onRemove(i)}
              onMoveUp={() => onMove(i, -1)}
              onMoveDown={() => onMove(i, 1)}
            />
          ))}
        </div>
      )}
      <div className="rounded border bg-muted/30 p-2">
        <Label className="text-xs">Generated filter:</Label>
        <pre className="mt-1 text-xs font-mono whitespace-pre-wrap break-all text-foreground">{builderFilter}</pre>
      </div>
    </div>
  );
}

function StepEditor({
  step,
  index,
  total,
  explained,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  step: BuilderStep;
  index: number;
  total: number;
  explained?: { n: number; fragment: string; explanation: string };
  onUpdate: (patch: Partial<BuilderStep>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const needsField = ["field", "sort_by", "group_by", "unique_by", "del", "has"].includes(step.type);
  const needsIndex = step.type === "index";
  const needsCondition = step.type === "select";
  const needsExpr = ["map", "map_values", "first", "last"].includes(step.type);
  const needsLimit = step.type === "limit";
  const needsValue = step.type === "contains";
  const needsArrayExpr = step.type === "array_constructor";

  return (
    <div className="rounded border bg-background p-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="secondary" className="text-[10px] font-mono">
          {explained?.n ?? index + 1}. {STEP_TYPE_LABELS[step.type]}
        </Badge>
        <div className="flex gap-1">
          <Button
            variant="ghost" size="icon" disabled={index === 0}
            onClick={onMoveUp} title="Move up"
          >↑</Button>
          <Button
            variant="ghost" size="icon" disabled={index === total - 1}
            onClick={onMoveDown} title="Move down"
          >↓</Button>
          <Button
            variant="ghost" size="icon" onClick={onRemove} title="Remove"
          ><Trash2 className="h-3 w-3" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {needsField && (
          <Input
            value={step.field ?? ""}
            onChange={(e) => onUpdate({ field: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
            placeholder="field name"
            className="h-7 text-xs font-mono"
          />
        )}
        {needsIndex && (
          <>
            <Input
              type="number"
              value={step.index ?? 0}
              onChange={(e) => onUpdate({ index: Number(e.target.value) })}
              placeholder="index"
              className="h-7 text-xs font-mono"
            />
            <Input
              type="number"
              value={step.indexEnd ?? ""}
              onChange={(e) => onUpdate({ indexEnd: e.target.value === "" ? undefined : Number(e.target.value) })}
              placeholder="end (optional, for slice)"
              className="h-7 text-xs font-mono"
            />
          </>
        )}
        {needsCondition && (
          <Input
            value={step.condition ?? ""}
            onChange={(e) => onUpdate({ condition: e.target.value })}
            placeholder=".age > 18"
            className="col-span-2 h-7 text-xs font-mono"
          />
        )}
        {needsExpr && (
          <Input
            value={step.expr ?? ""}
            onChange={(e) => onUpdate({ expr: e.target.value })}
            placeholder="."
            className="col-span-2 h-7 text-xs font-mono"
          />
        )}
        {needsLimit && (
          <>
            <Input
              type="number"
              value={step.count ?? 1}
              onChange={(e) => onUpdate({ count: Number(e.target.value) })}
              placeholder="n"
              className="h-7 text-xs font-mono"
            />
            <Input
              value={step.limitExpr ?? ""}
              onChange={(e) => onUpdate({ limitExpr: e.target.value })}
              placeholder=".[]"
              className="h-7 text-xs font-mono"
            />
          </>
        )}
        {needsValue && (
          <Input
            value={step.value ?? ""}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder='{"key":"value"}'
            className="col-span-2 h-7 text-xs font-mono"
          />
        )}
        {needsArrayExpr && (
          <Input
            value={step.arrayExpr ?? ""}
            onChange={(e) => onUpdate({ arrayExpr: e.target.value })}
            placeholder="."
            className="col-span-2 h-7 text-xs font-mono"
          />
        )}
      </div>
      <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
        <Zap className="h-3 w-3 mt-0.5 flex-shrink-0" />
        <div>
          <code className="font-mono text-foreground">{renderStep(step)}</code>
          {explained && <span className="ml-2">— {explained.explanation}</span>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flag toggle
// ---------------------------------------------------------------------------

function FlagToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-1 text-xs cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}
