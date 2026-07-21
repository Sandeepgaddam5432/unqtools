"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  History, Binary, ChevronUp, ChevronDown, AlertTriangle, Grid3x3,
} from "lucide-react";
import {
  FORMAT_INFO,
  PRECISION_ORDER,
  PRESETS,
  convert,
  convertAllPrecisions,
  parseInput,
  decodeFields,
  exactDecimalValue,
  toHexString,
  toBinaryString,
  toggleBit,
  getBit,
  nextUlp,
  prevUlp,
  bitFieldLabel,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Precision,
  type ValueClass,
  type HistoryEntry,
} from "./logic";

const PRECISION_LABELS: Record<Precision, string> = {
  binary16: "binary16 (half)",
  binary32: "binary32 (single)",
  binary64: "binary64 (double)",
  binary128: "binary128 (quad)",
};

const CLASS_COLORS: Record<ValueClass, string> = {
  normal: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  subnormal: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  zero: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
  inf: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  qnan: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  snan: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30",
};

export default function Ieee754FloatingPointConverter() {
  const [inputStr, setInputStr] = useState("0.1");
  const [precision, setPrecision] = useState<Precision>("binary64");
  const [manualBits, setManualBits] = useState<bigint | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showAllPrecisions, setShowAllPrecisions] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.input) setInputStr(p.input);
      if (p.precision) setPrecision(p.precision);
      if (p.input || p.precision !== "binary32") {
        toast.info("Loaded from share link");
      }
    }
  }, []);

  // When the input string changes, reset manual bit editing.
  useEffect(() => {
    setManualBits(null);
  }, [inputStr, precision]);

  const parsed = useMemo(() => {
    try {
      return parseInput(inputStr);
    } catch {
      return null;
    }
  }, [inputStr]);

  const result = useMemo(() => {
    if (manualBits !== null) {
      // Manual bit editing mode — rebuild fields from the bits.
      const info = FORMAT_INFO[precision];
      const fields = decodeFields(manualBits, precision);
      const storedValue = exactDecimalValue(manualBits, precision);
      const jsValue = parseFloat(storedValue === "Infinity" ? "Infinity"
        : storedValue === "-Infinity" ? "-Infinity"
        : storedValue === "NaN" ? "NaN" : storedValue);
      return {
        precision,
        bits: manualBits,
        hex: toHexString(manualBits, info.totalBits),
        binary: toBinaryString(manualBits, info.totalBits),
        fields,
        storedValue,
        jsValue,
        inputParsed: parsed?.canonicalDecimal ?? "",
        roundingError: { absolute: "0", relative: null },
      };
    }
    if (!parsed || parsed.kind === "empty") return null;
    try {
      return convert(inputStr, precision);
    } catch {
      return null;
    }
  }, [manualBits, parsed, inputStr, precision]);

  const allPrecisions = useMemo(() => {
    if (!showAllPrecisions || !parsed || parsed.kind === "empty") return null;
    try {
      return convertAllPrecisions(inputStr);
    } catch {
      return null;
    }
  }, [showAllPrecisions, parsed, inputStr]);

  const handleBitClick = useCallback((position: number) => {
    if (!result) return;
    const current = result.bits;
    const newBits = toggleBit(current, position);
    setManualBits(newBits);
  }, [result]);

  const handleSaveHistory = useCallback(() => {
    if (result) {
      saveHistory({
        ts: Date.now(),
        input: inputStr,
        precision,
        hex: result.hex,
        class: result.fields.class,
      });
      setHistory(loadHistory());
    }
  }, [result, inputStr, precision]);

  const handleStepUlp = useCallback((direction: "next" | "prev") => {
    if (!result) return;
    const newBits = direction === "next" ? nextUlp(result.bits, precision) : prevUlp(result.bits, precision);
    setManualBits(newBits);
    handleSaveHistory();
  }, [result, precision, handleSaveHistory]);

  const handleClear = useCallback(() => {
    setInputStr("");
    setManualBits(null);
    setShowAllPrecisions(false);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handlePreset = useCallback((value: string) => {
    setInputStr(value);
    setManualBits(null);
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ieee-input">Decimal value (or hex float like 0x1.8p+3, or inf / nan / -0)</Label>
            <Input
              id="ieee-input"
              value={inputStr}
              onChange={(e) => setInputStr(e.target.value)}
              placeholder="0.1"
              className="font-mono text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <Button
                  key={p.label}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => handlePreset(p.value)}
                  title={p.description}
                >+ {p.label}</Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Precision</Label>
            <div className="flex flex-wrap gap-2">
              {PRECISION_ORDER.map((p) => (
                <label key={p} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="precision"
                    checked={precision === p}
                    onChange={() => setPrecision(p)}
                  />
                  {PRECISION_LABELS[p]}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {result ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Binary className="h-4 w-4" /> {PRECISION_LABELS[precision]}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className={`text-[10px] ${CLASS_COLORS[result.fields.class]}`}>
                    {result.fields.class}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    sign: {result.fields.sign === 1 ? "−" : "+"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    exp: {result.fields.exponent}
                  </Badge>
                  {result.fields.unbiasedExp !== null && (
                    <Badge variant="outline" className="text-[10px]">
                      unbiased: 2^{result.fields.unbiasedExp}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    mantissa: 0x{result.fields.mantissa.toString(16).toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* Bit grid */}
              <BitGrid
                bits={result.bits}
                precision={precision}
                onBitClick={handleBitClick}
              />

              {/* Hex / binary / exact value */}
              <div className="grid sm:grid-cols-2 gap-2 text-xs">
                <DetailRow label="Hex (big-endian)" value={`0x${result.hex}`} />
                <DetailRow label="Binary" value={result.binary} mono break />
                <DetailRow label="Exact stored value" value={result.storedValue} mono break />
                <DetailRow
                  label="JS number (parsed back)"
                  value={
                    Number.isNaN(result.jsValue) ? "NaN"
                    : !Number.isFinite(result.jsValue) ? (result.jsValue > 0 ? "Infinity" : "-Infinity")
                    : String(result.jsValue)
                  }
                  mono
                />
                {result.roundingError.relative !== null && (
                  <DetailRow label="Absolute rounding error" value={result.roundingError.absolute} mono break />
                )}
                {result.roundingError.relative !== null && (
                  <DetailRow label="Relative rounding error" value={result.roundingError.relative} mono break />
                )}
              </div>

              {manualBits !== null && (
                <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                  Bit-edit mode — the input box above is no longer the source of truth. Click a bit to toggle, or use the Clear button to reset.
                </div>
              )}

              {/* ULP stepping */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => handleStepUlp("prev")} className="gap-1.5">
                  <ChevronDown className="h-3.5 w-3.5" /> Previous ULP
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleStepUlp("next")} className="gap-1.5">
                  <ChevronUp className="h-3.5 w-3.5" /> Next ULP
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllPrecisions((v) => !v)}
                  className="gap-1.5"
                >
                  <Grid3x3 className="h-3.5 w-3.5" />
                  {showAllPrecisions ? "Hide" : "Show"} all 4 precisions
                </Button>
                <CopyButton getText={() => { handleSaveHistory(); return `0x${result.hex}`; }} label="Copy hex" />
                <CopyButton getText={() => result.binary} label="Copy binary" />
                <CopyButton getText={() => result.storedValue} label="Copy exact value" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(inputStr, precision); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          {showAllPrecisions && allPrecisions && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">All four precisions for &quot;{inputStr}&quot;</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-1 pr-3">Precision</th>
                        <th className="py-1 pr-3">Hex</th>
                        <th className="py-1 pr-3">Class</th>
                        <th className="py-1 pr-3">Exact stored value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PRECISION_ORDER.map((p) => {
                        const r = allPrecisions[p];
                        return (
                          <tr key={p} className="border-t border-border/40">
                            <td className="py-1.5 pr-3 font-medium">{PRECISION_LABELS[p]}</td>
                            <td className="py-1.5 pr-3 font-mono">0x{r.hex}</td>
                            <td className="py-1.5 pr-3">
                              <Badge variant="outline" className={`text-[10px] ${CLASS_COLORS[r.fields.class]}`}>
                                {r.fields.class}
                              </Badge>
                            </td>
                            <td className="py-1.5 pr-3 font-mono text-[11px] break-all">{r.storedValue}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title="Enter a decimal, hex-float, inf, nan, or -0"
          hint="The tool decomposes your input into IEEE 754 sign / exponent / mantissa bits for all four widths. Click any bit in the grid to toggle it."
          icon={<Binary className="h-8 w-8" />}
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
                <div
                  key={i}
                  className="rounded border bg-background px-3 py-2 text-xs cursor-pointer hover:bg-accent/40 transition-colors"
                  onClick={() => { setInputStr(h.input); setPrecision(h.precision); setManualBits(null); }}
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.precision}</Badge>
                  <Badge variant="outline" className={`mr-2 text-[10px] ${CLASS_COLORS[h.class]}`}>{h.class}</Badge>
                  <span className="font-mono text-foreground">{h.input}</span>
                  <span className="font-mono text-muted-foreground ml-2">→ 0x{h.hex}</span>
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
            <strong className="text-foreground">Privacy:</strong> All conversion runs locally. For binary128 (no native JS type), a BigInt-based round-to-nearest-even path is used. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function BitGrid({
  bits,
  precision,
  onBitClick,
}: {
  bits: bigint;
  precision: Precision;
  onBitClick: (position: number) => void;
}) {
  const info = FORMAT_INFO[precision];
  const cells = [];
  // MSB (sign) first, then exponent, then mantissa.
  for (let i = info.totalBits - 1; i >= 0; i--) {
    const field = bitFieldLabel(i, precision);
    const colorClass =
      field === "sign"
        ? "bg-rose-500/15 hover:bg-rose-500/30 text-rose-700 dark:text-rose-300 border-rose-500/40"
        : field === "exponent"
          ? "bg-amber-500/15 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 border-amber-500/40"
          : "bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 border-emerald-500/40";
    cells.push(
      <button
        key={i}
        type="button"
        onClick={() => onBitClick(i)}
        title={`Bit ${i} (${field})`}
        className={`h-7 w-7 sm:h-6 sm:w-6 rounded border font-mono text-xs flex items-center justify-center transition-colors ${colorClass}`}
      >
        {getBit(bits, i)}
      </button>,
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {cells}
      </div>
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-rose-500/30 border border-rose-500/40" />
          sign ({1} bit)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-amber-500/30 border border-amber-500/40" />
          exponent ({info.expBits} bits, bias {info.bias})
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-emerald-500/30 border border-emerald-500/40" />
          mantissa ({info.mantBits} bits)
        </span>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
  break: breakLine,
}: {
  label: string;
  value: string;
  mono?: boolean;
  break?: boolean;
}) {
  return (
    <div className={`rounded border bg-background px-3 py-2 ${breakLine ? "break-all" : ""}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold text-foreground ${mono ? "font-mono" : ""} ${breakLine ? "break-all" : ""}`}>{value}</div>
    </div>
  );
}
