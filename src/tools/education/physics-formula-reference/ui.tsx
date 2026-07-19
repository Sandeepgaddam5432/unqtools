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
  CATEGORIES,
  CONSTANTS,
  DIFFICULTY_LABELS,
  UNIT_CATEGORIES,
  FORMULAS,
  formulasByCategory,
  lookupFormula,
  searchFormulas,
  parseKnownValues,
  validateVariables,
  solveFormula,
  formatSigFigs,
  convertUnit,
  checkDimensions,
  formatDimensions,
  computeSummary,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PhysicsCategory,
  type HistoryEntry,
} from "./logic";
import { Atom, History, BookOpen, Calculator } from "lucide-react";

export default function PhysicsFormulaReference() {
  const [category, setCategory] = useState<PhysicsCategory>("mechanics");
  const [formulaId, setFormulaId] = useState<string>("");
  const [knownValuesText, setKnownValuesText] = useState("");
  const [unknownVariable, setUnknownVariable] = useState("");
  const [sigFigs, setSigFigs] = useState(4);
  const [searchQuery, setSearchQuery] = useState("");
  // Unit converter state
  const [convValue, setConvValue] = useState("");
  const [convFrom, setConvFrom] = useState("m/s");
  const [convTo, setConvTo] = useState("km/h");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setCategory(p.category);
      if (p.formulaId) setFormulaId(p.formulaId);
      if (p.knownValues) setKnownValuesText(p.knownValues);
      if (p.unknownVariable) setUnknownVariable(p.unknownVariable);
      if (p.sigFigs) setSigFigs(p.sigFigs);
      if (p.formulaId || p.knownValues) {
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const categoryFormulas = useMemo(() => formulasByCategory(category), [category]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return searchFormulas(searchQuery);
  }, [searchQuery]);

  const selectedFormula = useMemo(() => {
    if (!formulaId) return categoryFormulas[0] ?? null;
    return lookupFormula(formulaId) ?? null;
  }, [formulaId, categoryFormulas]);

  // Auto-set unknown variable to first variable when formula changes.
  useEffect(() => {
    if (selectedFormula && (!unknownVariable || !selectedFormula.variables.find((v) => v.symbol === unknownVariable))) {
      setUnknownVariable(selectedFormula.variables[0].symbol);
    }
  }, [selectedFormula, unknownVariable]);

  const parsedKnown = useMemo(() => parseKnownValues(knownValuesText), [knownValuesText]);

  const validation = useMemo(() => {
    if (!selectedFormula) return null;
    const known = "error" in parsedKnown ? {} : parsedKnown;
    return validateVariables(selectedFormula, known, unknownVariable);
  }, [selectedFormula, parsedKnown, unknownVariable]);

  const solveResult = useMemo(() => {
    if (!selectedFormula || !validation || !validation.ok) return null;
    const known = "error" in parsedKnown ? {} : parsedKnown;
    return solveFormula(selectedFormula, known, unknownVariable);
  }, [selectedFormula, validation, parsedKnown, unknownVariable]);

  const dimCheck = useMemo(() => {
    if (!selectedFormula || !solveResult || !solveResult.ok) return null;
    const known = "error" in parsedKnown ? {} : parsedKnown;
    return checkDimensions(selectedFormula, unknownVariable, known);
  }, [selectedFormula, solveResult, unknownVariable, parsedKnown]);

  const summary = useMemo(() => computeSummary(), []);

  const textReport = useMemo(() => {
    if (!solveResult) return "";
    return renderText(solveResult, sigFigs);
  }, [solveResult, sigFigs]);

  const csvReport = useMemo(() => {
    if (!solveResult) return "";
    return renderCsv(solveResult, sigFigs);
  }, [solveResult, sigFigs]);

  const conversionResult = useMemo(() => {
    const v = parseFloat(convValue);
    if (isNaN(v)) return null;
    return convertUnit(v, convFrom, convTo);
  }, [convValue, convFrom, convTo]);

  const handleSaveHistory = useCallback(() => {
    if (!solveResult || !solveResult.ok || !selectedFormula) return;
    saveHistory({
      ts: Date.now(),
      formulaId: selectedFormula.id,
      formulaName: selectedFormula.name,
      unknownVariable: solveResult.unknownVariable,
      result: `${formatSigFigs(solveResult.value, sigFigs)} ${solveResult.unit}`.trim(),
    });
    setHistory(loadHistory());
  }, [solveResult, selectedFormula, sigFigs]);

  const handleClear = useCallback(() => {
    setKnownValuesText("");
    setUnknownVariable("");
    setSearchQuery("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleCategoryChange = (c: PhysicsCategory) => {
    setCategory(c);
    setFormulaId("");
    setUnknownVariable("");
  };

  // All unit names across categories (for the converter dropdowns).
  const allUnitNames = useMemo(() => {
    const out: string[] = [];
    for (const units of Object.values(UNIT_CATEGORIES)) {
      for (const u of units) out.push(u.name);
    }
    return out;
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Summary stats */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /> Physics Formula Reference
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Total formulas" value={summary.totalFormulas} />
            <Stat label="Categories" value={CATEGORIES.length} />
            <Stat label="Constants" value={CONSTANTS.length} />
            <Stat label="Unit categories" value={Object.keys(UNIT_CATEGORIES).length} />
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {CATEGORIES.map((c) => (
              <Button
                key={c.value}
                variant={category === c.value ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleCategoryChange(c.value)}
              >
                {c.label} <span className="opacity-60 ml-1">({summary.byCategory[c.value]})</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <Label htmlFor="pf-search" className="text-xs">Search formulas (across all categories)</Label>
          <Input
            id="pf-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="e.g. ohm, F=ma, momentum, doppler"
            className="text-sm"
          />
          {searchResults && (
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {searchResults.length === 0 ? (
                <p className="text-xs text-muted-foreground">No matches.</p>
              ) : (
                searchResults.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      setCategory(f.category);
                      setFormulaId(f.id);
                      setSearchQuery("");
                    }}
                    className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:border-primary"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{f.category}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{DIFFICULTY_LABELS[f.difficulty]}</Badge>
                      <span className="font-medium text-foreground">{f.name}</span>
                    </div>
                    <div className="font-mono text-muted-foreground mt-1">{f.equation}</div>
                  </button>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Formula picker + calculator */}
      {selectedFormula && !searchResults && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pf-formula">Formula</Label>
              <select
                id="pf-formula"
                value={selectedFormula.id}
                onChange={(e) => {
                  setFormulaId(e.target.value);
                  setUnknownVariable("");
                }}
                className="h-9 w-full rounded border bg-background px-3 text-sm"
              >
                {categoryFormulas.map((f) => (
                  <option key={f.id} value={f.id}>{f.name} — {f.equation}</option>
                ))}
              </select>
            </div>

            {/* Formula reference card */}
            <div className="rounded border bg-muted/30 p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-mono font-semibold text-foreground">{selectedFormula.equation}</span>
                <Badge variant="secondary" className="text-[10px]">{DIFFICULTY_LABELS[selectedFormula.difficulty]}</Badge>
                <Badge variant="outline" className="text-[10px]">{selectedFormula.category}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{selectedFormula.description}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                {selectedFormula.variables.map((v) => (
                  <div key={v.symbol} className="rounded border bg-background px-2 py-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-medium text-foreground">{v.symbol}</span>
                      <span className="text-[10px] text-muted-foreground">{v.unit || "—"}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{v.name}</div>
                  </div>
                ))}
              </div>
              {selectedFormula.related && selectedFormula.related.length > 0 && (
                <div className="text-[10px] text-muted-foreground">
                  Related: {selectedFormula.related.map((r) => {
                    const rf = lookupFormula(r);
                    return rf ? rf.name : r;
                  }).join(", ")}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pf-known">Known values (variable=value per line, or comma-separated)</Label>
              <Textarea
                id="pf-known"
                value={knownValuesText}
                onChange={(e) => setKnownValuesText(e.target.value)}
                placeholder={"m=10\na=9.8"}
                className="min-h-[70px] resize-y font-mono text-xs"
              />
              {!("error" in parsedKnown) && Object.keys(parsedKnown).length > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Parsed: {Object.entries(parsedKnown).map(([k, v]) => `${k}=${v}`).join(", ")}
                </p>
              )}
              {"error" in parsedKnown && (
                <p className="text-xs text-destructive">⚠ {parsedKnown.error}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pf-unknown">Solve for</Label>
                <select
                  id="pf-unknown"
                  value={unknownVariable}
                  onChange={(e) => setUnknownVariable(e.target.value)}
                  className="h-9 w-full rounded border bg-background px-3 text-sm"
                >
                  {selectedFormula.variables.map((v) => (
                    <option key={v.symbol} value={v.symbol}>
                      {v.symbol} — {v.name} ({v.unit || "unitless"})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-sig">Significant figures</Label>
                <Input
                  id="pf-sig"
                  type="number"
                  min={1}
                  max={12}
                  value={sigFigs}
                  onChange={(e) => setSigFigs(Math.max(1, Math.min(12, parseInt(e.target.value || "4", 10))))}
                  className="text-sm"
                />
              </div>
            </div>

            {validation && !validation.ok && (
              <p className="text-xs text-destructive">⚠ {validation.error}</p>
            )}
            {validation && validation.ok && validation.unknown.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Note: extra variables provided ({validation.unknown.join(", ")}) — they will be ignored.
              </p>
            )}

            {/* Result */}
            {solveResult && solveResult.ok && (
              <div className="rounded border bg-emerald-50 dark:bg-emerald-950/30 p-3 space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Result</div>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {unknownVariable} = {formatSigFigs(solveResult.value, sigFigs)} <span className="text-base font-normal">{solveResult.unit}</span>
                </div>
                {dimCheck && dimCheck.ok && dimCheck.leftDims.length > 0 && (
                  <div className="text-[10px] text-muted-foreground">
                    Dimensions of {unknownVariable}: {formatDimensions(dimCheck.leftDims)}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <CopyButton
                getText={() => { handleSaveHistory(); return textReport; }}
                label="Copy report"
                disabled={!solveResult?.ok}
              />
              <DownloadButton
                getText={() => textReport}
                filename="physics-calculation.txt"
                mime="text/plain"
                label="Download .txt"
                disabled={!solveResult?.ok}
              />
              <DownloadButton
                getText={() => csvReport}
                filename="physics-calculation.csv"
                mime="text/csv"
                label="Download CSV"
                disabled={!solveResult?.ok}
              />
              <ShareButton
                getUrl={() => buildShareUrl(category, selectedFormula.id, knownValuesText, unknownVariable, sigFigs)}
              />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unit converter */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Calculator className="h-4 w-4" /> Unit converter
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Value</Label>
              <Input
                type="number"
                value={convValue}
                onChange={(e) => setConvValue(e.target.value)}
                placeholder="10"
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">From</Label>
              <select
                value={convFrom}
                onChange={(e) => setConvFrom(e.target.value)}
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                {allUnitNames.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">To</Label>
              <select
                value={convTo}
                onChange={(e) => setConvTo(e.target.value)}
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                {allUnitNames.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Result</Label>
              <div className="h-9 rounded border bg-background px-3 flex items-center text-sm font-mono">
                {conversionResult?.ok
                  ? formatSigFigs(conversionResult.result, sigFigs)
                  : conversionResult
                    ? <span className="text-destructive text-xs">⚠ {conversionResult.error}</span>
                    : <span className="text-muted-foreground text-xs">—</span>}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Supports: {Object.keys(UNIT_CATEGORIES).join(", ")}.
          </p>
        </CardContent>
      </Card>

      {/* Constants reference */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Atom className="h-4 w-4" /> Common constants
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
            {CONSTANTS.map((c) => (
              <div key={c.symbol} className="rounded border bg-background px-2 py-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-medium text-foreground">{c.symbol}</span>
                  <span className="text-[10px] text-muted-foreground">{c.unit}</span>
                </div>
                <div className="text-[10px] font-mono text-muted-foreground">{c.value.toExponential(4)}</div>
                <div className="text-[10px] text-muted-foreground">{c.name}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Empty state */}
      {!selectedFormula && !searchResults && (
        <EmptyState
          title="Pick a category and formula"
          hint="Browse 50+ physics formulas across 6 categories. Enter known values and choose which variable to solve for."
          icon={<Atom className="h-8 w-8" />}
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
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.unknownVariable}</Badge>
                  <span className="font-medium text-foreground">{h.formulaName}</span>
                  <span className="text-muted-foreground"> → {h.result}</span>
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
            <strong className="text-foreground">Privacy:</strong> All calculations run locally. The formula database and constants are bundled in the page. History is stored in localStorage on this device only.
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

// Suppress unused-import lint
export type _Unused = typeof FORMULAS;
