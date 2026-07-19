"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  CATEGORIES,
  CATEGORY_LABELS,
  PRESETS,
  DEFAULT_INPUT,
  getCategory,
  listUnitIds,
  defaultUnitId,
  convert,
  swapUnits,
  filterUnits,
  renderText,
  renderCsv,
  computeSummary,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Category,
  type ConverterInput,
  type HistoryEntry,
} from "./logic";
import { History, Ruler, ArrowLeftRight, Search } from "lucide-react";

export default function UnitConverterEducational() {
  const [input, setInput] = useState<ConverterInput>({ ...DEFAULT_INPUT });
  const [searchQuery, setSearchQuery] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      setInput(parsed);
      if (window.location.hash.length > 1) toast.info("Loaded from share link");
    }
  }, []);

  // When category changes, refresh unit ids to valid ones for that category.
  const handleCategoryChange = (cat: Category) => {
    const fromId = defaultUnitId(cat, input.fromUnitId);
    const candidateTo = defaultUnitId(cat, input.toUnitId === fromId ? "" : input.toUnitId);
    const toId = candidateTo || listUnitIds(cat)[1] || fromId;
    setInput((prev) => ({
      ...prev,
      category: cat,
      fromUnitId: fromId,
      toUnitId: toId === fromId ? (listUnitIds(cat)[1] ?? fromId) : toId,
    }));
    setSearchQuery("");
  };

  const result = useMemo(() => convert(input), [input]);
  const filteredFrom = useMemo(
    () => filterUnits(input.category, searchQuery),
    [input.category, searchQuery],
  );
  const summary = useMemo(() => computeSummary(history), [history]);
  const text = useMemo(() => renderText(result), [result]);
  const csv = useMemo(() => renderCsv(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (Number.isFinite(result.result)) {
      saveHistory({
        ts: Date.now(),
        category: input.category,
        fromUnitId: input.fromUnitId,
        toUnitId: input.toUnitId,
        value: input.value,
        result: result.result,
      });
      setHistory(loadHistory());
    }
  }, [result, input]);

  const handleSwap = useCallback(() => {
    setInput((prev) => swapUnits(prev));
  }, []);

  const handleClear = useCallback(() => {
    setInput({ ...DEFAULT_INPUT });
    setSearchQuery("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const patch = (p: Partial<ConverterInput>) => setInput((prev) => ({ ...prev, ...p }));

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs">Category</Label>
            <select
              value={input.category}
              onChange={(e) => handleCategoryChange(e.target.value as Category)}
              className="mt-1 w-full h-9 text-sm rounded border bg-background px-2"
            >
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-end">
            <div>
              <Label htmlFor="uc-from" className="text-xs">From</Label>
              <select
                id="uc-from"
                value={input.fromUnitId}
                onChange={(e) => patch({ fromUnitId: e.target.value })}
                className="mt-1 w-full h-9 text-sm rounded border bg-background px-2"
              >
                {filteredFrom.map((u) => (
                  <option key={u.id} value={u.id}>{u.symbol} — {u.name}</option>
                ))}
              </select>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleSwap}
              title="Swap from/to"
              className="mb-0.5"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </Button>
            <div>
              <Label htmlFor="uc-to" className="text-xs">To</Label>
              <select
                id="uc-to"
                value={input.toUnitId}
                onChange={(e) => patch({ toUnitId: e.target.value })}
                className="mt-1 w-full h-9 text-sm rounded border bg-background px-2"
              >
                {filteredFrom.map((u) => (
                  <option key={u.id} value={u.id}>{u.symbol} — {u.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="uc-value" className="text-xs">Value</Label>
            <Input
              id="uc-value"
              type="number"
              step="any"
              value={input.value}
              onChange={(e) => patch({ value: Number(e.target.value) })}
              className="mt-1 h-9 text-sm font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="uc-precision" className="text-xs">Precision (decimals)</Label>
              <Input
                id="uc-precision"
                type="number"
                min={0}
                max={10}
                value={input.precision}
                onChange={(e) => patch({ precision: Number(e.target.value) })}
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs cursor-pointer h-9">
                <input
                  type="checkbox"
                  checked={input.showSteps}
                  onChange={(e) => patch({ showSteps: e.target.checked })}
                />
                Show step-by-step
              </label>
            </div>
          </div>

          <div>
            <Label htmlFor="uc-search" className="text-xs flex items-center gap-1">
              <Search className="h-3 w-3" /> Filter units
            </Label>
            <Input
              id="uc-search"
              type="text"
              placeholder="Type to filter units by symbol/name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mt-1 h-9 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                variant="ghost"
                size="sm"
                className="h-6 text-[11px]"
                onClick={() => {
                  setInput({
                    category: p.category,
                    fromUnitId: p.fromUnitId,
                    toUnitId: p.toUnitId,
                    value: p.value,
                    showSteps: true,
                    precision: 4,
                  });
                  setSearchQuery("");
                  toast.info(`Preset: ${p.label}`);
                }}
              >+ {p.label}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {Number.isFinite(result.result) ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Ruler className="h-4 w-4" /> Result
              </h3>
              <div className="rounded border bg-background px-3 py-2">
                <span className="font-mono text-base text-foreground">
                  {result.value} {result.fromUnit.symbol}
                </span>
                <span className="mx-2 text-muted-foreground">=</span>
                <span className="font-mono text-base font-semibold text-foreground">
                  {result.result.toFixed(result.precision)} {result.toUnit.symbol}
                </span>
              </div>
              {input.showSteps && (
                <div className="space-y-1 pt-2">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Steps</div>
                  {result.steps.map((s, i) => (
                    <div key={i} className="rounded border bg-muted/30 px-3 py-1.5 text-xs font-mono">
                      <span className="text-muted-foreground mr-2">{s.label}:</span>
                      <span className="text-foreground">{s.expression}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="rounded border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                <strong className="text-foreground">Formula reference:</strong> {result.formulaReference}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Ruler className="h-4 w-4" /> Reference table — {CATEGORY_LABELS[input.category]}
              </h3>
              <div className="overflow-auto max-h-[300px]">
                <table className="border-collapse text-xs w-full">
                  <thead>
                    <tr>
                      <th className="border border-border bg-muted px-2 py-1 text-left">Symbol</th>
                      <th className="border border-border bg-muted px-2 py-1 text-left">Name</th>
                      <th className="border border-border bg-muted px-2 py-1 text-right">Factor (to base)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getCategory(input.category)?.units.map((u) => (
                      <tr key={u.id}>
                        <td className="border border-border px-2 py-1 font-mono">{u.symbol}</td>
                        <td className="border border-border px-2 py-1">{u.name}</td>
                        <td className="border border-border px-2 py-1 font-mono text-right">
                          {input.category === "temperature" ? "—" : u.factor}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Export</h3>
                <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[input.category]}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy report"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename="unit-conversion.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return csv; }}
                  filename="unit-conversion.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a value to convert"
          hint="Pick a category, from/to units, and a value. The tool shows the formula, substitution, and final result."
          icon={<Ruler className="h-8 w-8" />}
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Total" value={summary.total} />
              {Object.entries(summary.byCategory)
                .filter(([, n]) => n > 0)
                .slice(0, 3)
                .map(([cat, n]) => (
                  <Stat key={cat} label={CATEGORY_LABELS[cat as Category]} value={n} />
                ))}
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <button
                  key={i}
                  onClick={() => setInput({
                    category: h.category,
                    fromUnitId: h.fromUnitId,
                    toUnitId: h.toUnitId,
                    value: h.value,
                    showSteps: true,
                    precision: 4,
                  })}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/50"
                >
                  <Badge variant="outline" className="mr-2">{CATEGORY_LABELS[h.category]}</Badge>
                  <span className="font-mono text-foreground">
                    {h.value} → {Number.isFinite(h.result) ? h.result.toFixed(4) : "—"}
                  </span>
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
            <strong className="text-foreground">Privacy:</strong> All conversions and step generation run locally in your browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
