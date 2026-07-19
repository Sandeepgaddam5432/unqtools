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
  CALC_TYPES,
  COMPOUND_PRESETS,
  PERIODIC_TABLE,
  parseFormula,
  validateFormula,
  molarMassBreakdown,
  percentComposition,
  parseExperimentalData,
  empiricalFormula,
  molecularFormula,
  balanceEquation,
  computeSummary,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CalculationType,
  type HistoryEntry,
} from "./logic";
import { FlaskConical, History, Atom } from "lucide-react";

export default function ChemistryFormulaCalculator() {
  const [calcType, setCalcType] = useState<CalculationType>("molar-mass");
  const [formula, setFormula] = useState("");
  const [equation, setEquation] = useState("");
  const [experimentalData, setExperimentalData] = useState("");
  const [molarMassInput, setMolarMassInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setCalcType(p.calcType);
      if (p.formula) setFormula(p.formula);
      if (p.equation) setEquation(p.equation);
      if (p.experimentalData) setExperimentalData(p.experimentalData);
      if (p.molarMass > 0) setMolarMassInput(String(p.molarMass));
      if (p.formula || p.equation || p.experimentalData) {
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const breakdown = useMemo(() => {
    if (calcType !== "molar-mass" && calcType !== "percent-composition") return null;
    if (!formula.trim()) return null;
    return molarMassBreakdown(formula);
  }, [formula, calcType]);

  const percentRows = useMemo(() => {
    if (calcType !== "percent-composition") return null;
    if (!formula.trim()) return null;
    return percentComposition(formula);
  }, [formula, calcType]);

  const empiricalResult = useMemo(() => {
    if (calcType !== "empirical-formula") return null;
    if (!experimentalData.trim()) return null;
    const data = parseExperimentalData(experimentalData);
    if ("error" in data) {
      return {
        formula: "",
        counts: {},
        moles: [],
        ratios: [],
        ok: false,
        error: data.error,
      };
    }
    return empiricalFormula(data);
  }, [experimentalData, calcType]);

  const molecularResult = useMemo(() => {
    if (calcType !== "molecular-formula") return null;
    const emp = empiricalResult ?? (() => {
      if (!experimentalData.trim()) return null;
      const d = parseExperimentalData(experimentalData);
      if ("error" in d) return null;
      return empiricalFormula(d);
    })();
    if (!emp || !emp.ok) return null;
    const mm = parseFloat(molarMassInput);
    if (isNaN(mm) || mm <= 0) {
      return {
        formula: "",
        counts: {},
        multiplier: 0,
        empiricalMass: 0,
        molarMass: mm,
        ok: false,
        error: "Enter a valid molar mass",
      };
    }
    return molecularFormula(emp.formula, mm);
  }, [experimentalData, molarMassInput, calcType, empiricalResult]);

  const balanceResult = useMemo(() => {
    if (calcType !== "balance-equation") return null;
    if (!equation.trim()) return null;
    return balanceEquation(equation);
  }, [equation, calcType]);

  const summary = useMemo(() => {
    if (calcType !== "molar-mass" && calcType !== "percent-composition") return null;
    if (!formula.trim()) return null;
    return computeSummary(formula);
  }, [formula, calcType]);

  const textReport = useMemo(() => {
    if (breakdown && "rows" in breakdown) return renderText(formula, breakdown);
    return "";
  }, [breakdown, formula]);

  const csvReport = useMemo(() => {
    if (breakdown && "rows" in breakdown) return renderCsv(breakdown);
    return "";
  }, [breakdown]);

  const handleSaveHistory = useCallback(() => {
    let resultStr = "";
    if (calcType === "molar-mass" && breakdown && "rows" in breakdown) {
      resultStr = `${breakdown.total.toFixed(4)} g/mol`;
    } else if (calcType === "balance-equation" && balanceResult?.ok) {
      resultStr = balanceResult.balancedEquation;
    } else if (calcType === "empirical-formula" && empiricalResult && "formula" in empiricalResult) {
      resultStr = empiricalResult.formula;
    } else if (calcType === "molecular-formula" && molecularResult && "formula" in molecularResult) {
      resultStr = molecularResult.formula;
    } else if (calcType === "percent-composition" && Array.isArray(percentRows)) {
      resultStr = percentRows.map((r) => `${r.symbol}=${r.percent.toFixed(2)}%`).join(", ");
    }
    if (!resultStr) return;
    const inputForLog =
      calcType === "balance-equation"
        ? equation
        : calcType === "molar-mass" || calcType === "percent-composition"
          ? formula
          : experimentalData;
    saveHistory({
      ts: Date.now(),
      calculationType: calcType,
      formula: inputForLog,
      result: resultStr,
    });
    setHistory(loadHistory());
  }, [calcType, breakdown, balanceResult, empiricalResult, molecularResult, percentRows, formula, equation, experimentalData]);

  const handleClear = useCallback(() => {
    setFormula("");
    setEquation("");
    setExperimentalData("");
    setMolarMassInput("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const validation = useMemo(() => {
    if (calcType === "balance-equation") return null;
    if (!formula.trim()) return null;
    return validateFormula(formula);
  }, [formula, calcType]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cf-calc-type">Calculation type</Label>
            <select
              id="cf-calc-type"
              value={calcType}
              onChange={(e) => setCalcType(e.target.value as CalculationType)}
              className="h-9 w-full rounded border bg-background px-3 text-sm"
            >
              {CALC_TYPES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {(calcType === "molar-mass" || calcType === "percent-composition") && (
            <div className="space-y-1.5">
              <Label htmlFor="cf-formula">Chemical formula</Label>
              <Input
                id="cf-formula"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                placeholder="e.g. H2O, C6H12O6, NaCl, CuSO4·5H2O"
                className="font-mono text-sm"
              />
              <div className="flex flex-wrap gap-1">
                {COMPOUND_PRESETS.map((p) => (
                  <Button
                    key={p.label}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px]"
                    onClick={() => setFormula(p.formula)}
                  >{p.label}</Button>
                ))}
              </div>
              {validation && !validation.ok && (
                <p className="text-xs text-destructive">⚠ {validation.error}</p>
              )}
            </div>
          )}

          {(calcType === "empirical-formula" || calcType === "molecular-formula") && (
            <div className="space-y-1.5">
              <Label htmlFor="cf-exp">Experimental % composition (element,percentage per line)</Label>
              <Textarea
                id="cf-exp"
                value={experimentalData}
                onChange={(e) => setExperimentalData(e.target.value)}
                placeholder={"C,40\nH,6.7\nO,53.3"}
                className="min-h-[80px] resize-y font-mono text-xs"
              />
            </div>
          )}

          {calcType === "molecular-formula" && (
            <div className="space-y-1.5">
              <Label htmlFor="cf-mm">Molar mass (g/mol)</Label>
              <Input
                id="cf-mm"
                type="number"
                value={molarMassInput}
                onChange={(e) => setMolarMassInput(e.target.value)}
                placeholder="e.g. 180.16"
                className="font-mono text-sm"
              />
            </div>
          )}

          {calcType === "balance-equation" && (
            <div className="space-y-1.5">
              <Label htmlFor="cf-eq">Equation to balance</Label>
              <Input
                id="cf-eq"
                value={equation}
                onChange={(e) => setEquation(e.target.value)}
                placeholder="e.g. H2 + O2 = H2O"
                className="font-mono text-sm"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Molar Mass Result */}
      {calcType === "molar-mass" && breakdown && "rows" in breakdown && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Atom className="h-4 w-4" /> Molar mass of {formula}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Molar mass" value={`${breakdown.total.toFixed(4)} g/mol`} />
              <Stat label="Total atoms" value={breakdown.totalAtoms} />
              <Stat label="Distinct elements" value={breakdown.distinctElements} />
              <Stat label="Elements in table" value={PERIODIC_TABLE.length} />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Breakdown</div>
              <div className="rounded border bg-background">
                <div className="grid grid-cols-5 gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground border-b">
                  <span>Element</span>
                  <span className="text-right">Count</span>
                  <span className="text-right">Atomic mass</span>
                  <span className="text-right">Contribution</span>
                  <span className="text-right">Percent</span>
                </div>
                {breakdown.rows.map((r) => (
                  <div key={r.symbol} className="grid grid-cols-5 gap-2 px-3 py-1.5 text-xs">
                    <span className="font-mono text-foreground">{r.symbol} <span className="text-muted-foreground">{r.name}</span></span>
                    <span className="text-right font-mono">{r.count}</span>
                    <span className="text-right font-mono">{r.atomicMass.toFixed(3)}</span>
                    <span className="text-right font-mono">{r.contribution.toFixed(4)}</span>
                    <span className="text-right font-mono">{r.percent.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <CopyButton getText={() => { handleSaveHistory(); return textReport; }} label="Copy report" />
              <DownloadButton getText={() => textReport} filename="molar-mass.txt" mime="text/plain" label="Download .txt" />
              <DownloadButton getText={() => csvReport} filename="molar-mass.csv" mime="text/csv" label="Download CSV" />
              <ShareButton getUrl={() => buildShareUrl(calcType, formula, "", 0, "")} />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Percent Composition Result */}
      {calcType === "percent-composition" && Array.isArray(percentRows) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Atom className="h-4 w-4" /> Percent composition of {formula}
            </h3>
            <div className="rounded border bg-background">
              <div className="grid grid-cols-5 gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground border-b">
                <span>Element</span>
                <span className="text-right">Count</span>
                <span className="text-right">Mass</span>
                <span className="text-right">Total</span>
                <span className="text-right">Percent</span>
              </div>
              {percentRows.map((r) => (
                <div key={r.symbol} className="grid grid-cols-5 gap-2 px-3 py-1.5 text-xs">
                  <span className="font-mono text-foreground">{r.symbol}</span>
                  <span className="text-right font-mono">{r.count}</span>
                  <span className="text-right font-mono">{r.atomicMass.toFixed(3)}</span>
                  <span className="text-right font-mono">{r.contribution.toFixed(4)}</span>
                  <span className="text-right font-mono">{r.percent.toFixed(2)}%</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <CopyButton getText={() => { handleSaveHistory(); return percentRows.map((r) => `${r.symbol}: ${r.percent.toFixed(2)}%`).join("\n"); }} label="Copy results" />
              <DownloadButton
                getText={() => ["symbol,name,count,atomic_mass,contribution,percent", ...percentRows.map((r) => `${r.symbol},${r.name},${r.count},${r.atomicMass.toFixed(6)},${r.contribution.toFixed(6)},${r.percent.toFixed(4)}`)].join("\n")}
                filename="percent-composition.csv"
                mime="text/csv"
                label="Download CSV"
              />
              <ShareButton getUrl={() => buildShareUrl(calcType, formula, "", 0, "")} />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empirical Formula Result */}
      {calcType === "empirical-formula" && empiricalResult && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Atom className="h-4 w-4" /> Empirical formula
            </h3>
            {"error" in empiricalResult ? (
              <p className="text-xs text-destructive">⚠ {empiricalResult.error}</p>
            ) : empiricalResult.ok ? (
              <>
                <div className="text-3xl font-bold font-mono text-foreground">{empiricalResult.formula}</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Moles per 100g sample:</div>
                  {empiricalResult.moles.map((m) => (
                    <div key={m.symbol} className="font-mono">
                      {m.symbol}: {m.moles.toFixed(4)} mol
                    </div>
                  ))}
                  <div className="pt-1">Ratios (relative to smallest):</div>
                  {empiricalResult.ratios.map((r) => (
                    <div key={r.symbol} className="font-mono">
                      {r.symbol}: {r.ratio.toFixed(3)}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <CopyButton getText={() => { handleSaveHistory(); return empiricalResult.formula; }} label="Copy formula" />
                  <ShareButton getUrl={() => buildShareUrl(calcType, "", experimentalData, 0, "")} />
                  <ClearButton onClick={handleClear} />
                </div>
              </>
            ) : (
              <p className="text-xs text-destructive">⚠ {empiricalResult.error}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Molecular Formula Result */}
      {calcType === "molecular-formula" && molecularResult && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Atom className="h-4 w-4" /> Molecular formula
            </h3>
            {"error" in molecularResult || !molecularResult.ok ? (
              <p className="text-xs text-destructive">⚠ {("error" in molecularResult ? molecularResult.error : "Calculation failed")}</p>
            ) : (
              <>
                <div className="text-3xl font-bold font-mono text-foreground">{molecularResult.formula}</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Empirical mass: <span className="font-mono">{molecularResult.empiricalMass.toFixed(4)} g/mol</span></div>
                  <div>Molar mass: <span className="font-mono">{molecularResult.molarMass.toFixed(4)} g/mol</span></div>
                  <div>Multiplier: <span className="font-mono">{molecularResult.multiplier}×</span></div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <CopyButton getText={() => { handleSaveHistory(); return molecularResult.formula; }} label="Copy formula" />
                  <ShareButton getUrl={() => buildShareUrl(calcType, "", experimentalData, molecularResult.molarMass, "")} />
                  <ClearButton onClick={handleClear} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Balance Equation Result */}
      {calcType === "balance-equation" && balanceResult && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Atom className="h-4 w-4" /> Balanced equation
            </h3>
            {balanceResult.ok ? (
              <>
                <div className="text-xl font-bold font-mono text-foreground">{balanceResult.balancedEquation}</div>
                <div className="text-xs text-muted-foreground">
                  Coefficients: <span className="font-mono">{balanceResult.coefficients.join(", ")}</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <CopyButton getText={() => { handleSaveHistory(); return balanceResult.balancedEquation; }} label="Copy equation" />
                  <ShareButton getUrl={() => buildShareUrl(calcType, "", "", 0, equation)} />
                  <ClearButton onClick={handleClear} />
                </div>
              </>
            ) : (
              <p className="text-xs text-destructive">⚠ {balanceResult.error}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!breakdown && !percentRows && !empiricalResult && !molecularResult && !balanceResult && (
        <EmptyState
          title="Enter a chemical formula or equation"
          hint="Pick a calculation type, type a formula like H2O or C6H12O6, or an equation like H2 + O2 = H2O. The built-in 118-element periodic table powers every calculation."
          icon={<FlaskConical className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.calculationType}</Badge>
                  <span className="font-mono text-foreground">{h.formula}</span>
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
            <strong className="text-foreground">Privacy:</strong> All calculations run locally. The periodic table is bundled in the page. History is stored in localStorage on this device only.
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
