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
  VARIANTS,
  VARIANT_LABELS,
  autoVariant,
  encode,
  encodeSecded,
  decode,
  decodeSecded,
  injectError,
  injectErrors,
  parseDataBits,
  formatBits,
  formatSyndrome,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HammingVariant,
  type ParityMode,
  type HistoryEntry,
} from "./logic";
import { History, Binary, AlertTriangle, CheckCircle2, Zap } from "lucide-react";

export default function HammingCodeErrorCorrectionCalculator() {
  const [variant, setVariant] = useState<HammingVariant>("hamming-7-4");
  const [mode, setMode] = useState<ParityMode>("even");
  const [isSecded, setIsSecded] = useState(false);
  const [dataInput, setDataInput] = useState("1011");
  const [flippedPositions, setFlippedPositions] = useState<number[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.dataBits) setDataInput(p.dataBits);
      setVariant(p.variant);
      setMode(p.mode);
      setIsSecded(p.isSecded);
      setFlippedPositions(p.injectPos > 0 ? [p.injectPos] : []);
      if (p.dataBits || p.injectPos > 0) toast.info("Loaded from share link");
    }
  }, []);

  const params = VARIANTS[variant];

  const parsed = useMemo(() => parseDataBits(dataInput), [dataInput]);

  const suggestedVariant = useMemo(() => {
    if (!parsed.bits.length) return variant;
    return autoVariant(parsed.bits.length);
  }, [parsed.bits, variant]);

  const encodeResult = useMemo(() => {
    if (parsed.error || !parsed.bits.length) return null;
    try {
      const bits = parsed.bits.slice(0, params.k);
      return isSecded
        ? encodeSecded(bits, variant, mode)
        : encode(bits, variant, mode);
    } catch {
      return null;
    }
  }, [parsed, params, isSecded, variant, mode]);

  // The "live" codeword the user sees (with injected errors applied).
  const liveCodeword = useMemo(() => {
    if (!encodeResult) return null;
    const base = isSecded
      ? (encodeResult as ReturnType<typeof encodeSecded>).codewordWithParity
      : encodeResult.codeword;
    if (flippedPositions.length === 0) return base;
    return injectErrors(base, flippedPositions).corrupted;
  }, [encodeResult, isSecded, flippedPositions]);

  const decodeResult = useMemo(() => {
    if (!liveCodeword) return null;
    try {
      return isSecded
        ? decodeSecded(liveCodeword, variant, mode)
        : decode(liveCodeword, variant, mode);
    } catch {
      return null;
    }
  }, [liveCodeword, isSecded, variant, mode]);

  const handleToggleFlip = useCallback(
    (position: number) => {
      setFlippedPositions((prev) =>
        prev.includes(position)
          ? prev.filter((p) => p !== position)
          : [...prev, position],
      );
    },
    [],
  );

  const handleSaveHistory = useCallback(() => {
    if (!encodeResult || !decodeResult) return;
    const base = isSecded
      ? (encodeResult as ReturnType<typeof encodeSecded>).codewordWithParity
      : encodeResult.codeword;
    saveHistory({
      ts: Date.now(),
      variant,
      mode,
      isSecded,
      dataBits: formatBits(encodeResult.dataBits),
      codeword: formatBits(base),
      syndrome: decodeResult.syndrome,
      errorPosition: decodeResult.errorPosition,
      doubleErrorDetected: decodeResult.doubleErrorDetected,
    });
    setHistory(loadHistory());
  }, [encodeResult, decodeResult, variant, mode, isSecded]);

  const handleClear = useCallback(() => {
    setDataInput("");
    setFlippedPositions([]);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleRandomData = useCallback(() => {
    const k = params.k;
    const bits: (0 | 1)[] = Array.from({ length: k }, () =>
      Math.random() < 0.5 ? 0 : 1,
    );
    setDataInput(formatBits(bits));
    setFlippedPositions([]);
  }, [params.k]);

  const codewordLength = isSecded ? params.n + 1 : params.n;
  const isError = decodeResult?.singleErrorCorrected || decodeResult?.doubleErrorDetected;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Controls */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Hamming variant</Label>
              <select
                value={variant}
                onChange={(e) => {
                  setVariant(e.target.value as HammingVariant);
                  setFlippedPositions([]);
                }}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(VARIANTS) as HammingVariant[]).map((v) => (
                  <option key={v} value={v}>{VARIANT_LABELS[v]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Parity mode</Label>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={mode === "even" ? "default" : "outline"}
                  onClick={() => setMode("even")}
                  className="h-9 text-xs flex-1"
                >Even</Button>
                <Button
                  size="sm"
                  variant={mode === "odd" ? "default" : "outline"}
                  onClick={() => setMode("odd")}
                  className="h-9 text-xs flex-1"
                >Odd</Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">SECDED (extended)</Label>
              <Button
                size="sm"
                variant={isSecded ? "default" : "outline"}
                onClick={() => {
                  setIsSecded(!isSecded);
                  setFlippedPositions([]);
                }}
                className="h-9 text-xs w-full"
              >{isSecded ? "SECDED ON" : "SECDED OFF"}</Button>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Variant params: n={params.n} (codeword), k={params.k} (data), p={params.p} (parity).
            {isSecded && " SECDED adds 1 overall parity bit (length " + (params.n + 1) + ")."}
            {suggestedVariant !== variant && parsed.bits.length > 0 && (
              <span className="ml-2 text-amber-600 dark:text-amber-400">
                Tip: {parsed.bits.length} data bit(s) fit in {VARIANT_LABELS[suggestedVariant]}.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data input */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="hc-data" className="text-xs">
              Data bits (max {params.k} for this variant; pad with 0 if shorter)
            </Label>
            <Button variant="ghost" size="sm" onClick={handleRandomData} className="h-6 text-[11px]">
              <Zap className="h-3 w-3 mr-1" /> Random
            </Button>
          </div>
          <Input
            id="hc-data"
            value={dataInput}
            onChange={(e) => {
              setDataInput(e.target.value.replace(/[^01]/g, ""));
              setFlippedPositions([]);
            }}
            placeholder={"1011"}
            className="font-mono text-sm"
            inputMode="numeric"
          />
          {parsed.error && (
            <p className="text-[11px] text-destructive">{parsed.error}</p>
          )}
          {encodeResult && (
            <p className="text-[11px] text-muted-foreground">
              Encoded <strong className="text-foreground">{formatBits(encodeResult.dataBits)}</strong> ({encodeResult.dataBits.length} data bits) → {codewordLength}-bit codeword.
            </p>
          )}
        </CardContent>
      </Card>

      {encodeResult && liveCodeword && decodeResult ? (
        <>
          {/* Codeword display with clickable bits */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Binary className="h-4 w-4" /> Codeword — click a bit to flip
                </h3>
                <Badge variant={isError ? "destructive" : "secondary"} className="text-[10px]">
                  {flippedPositions.length} flipped
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {liveCodeword.map((bit, i) => {
                  const position = i + 1;
                  const isParity =
                    position <= params.n &&
                    (position & (position - 1)) === 0;
                  const isOverall =
                    isSecded && position === params.n + 1;
                  const isFlipped = flippedPositions.includes(position);
                  const isErrorBit = decodeResult.errorPosition === position;
                  const type = isOverall ? "overall" : isParity ? "parity" : "data";
                  const baseColor =
                    type === "overall"
                      ? "bg-purple-100 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800"
                      : type === "parity"
                        ? "bg-blue-100 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800"
                        : "bg-emerald-100 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800";
                  const flipColor = isFlipped
                    ? "ring-2 ring-amber-500"
                    : isErrorBit
                      ? "ring-2 ring-red-500"
                      : "";
                  return (
                    <button
                      key={i}
                      onClick={() => handleToggleFlip(position)}
                      title={`Position ${position} (${type}${isOverall ? " parity" : ""})${isFlipped ? " — flipped" : ""}`}
                      className={`relative h-12 w-12 rounded border ${baseColor} ${flipColor} font-mono text-lg font-bold flex flex-col items-center justify-center hover:scale-105 transition-transform`}
                    >
                      <span className={bit === 1 ? "text-foreground" : "text-muted-foreground"}>
                        {bit}
                      </span>
                      <span className="text-[8px] text-muted-foreground absolute top-0.5 left-0.5">
                        {position}
                      </span>
                      <span className="text-[7px] text-muted-foreground absolute bottom-0.5">
                        {type === "overall" ? "OP" : type === "parity" ? `P${Math.log2(position) + 1}` : "D"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded border bg-emerald-100 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800" />
                  Data bit
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded border bg-blue-100 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800" />
                  Parity bit
                </span>
                {isSecded && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded border bg-purple-100 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800" />
                    Overall parity
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded border-2 border-amber-500" />
                  Flipped
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded border-2 border-red-500" />
                  Error located
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Decode / syndrome panel */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Zap className="h-4 w-4" /> Decode &amp; syndrome
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat
                  label="Syndrome"
                  value={String(decodeResult.syndrome)}
                  hint={`bin ${formatSyndrome(decodeResult.syndromeBits, params.p)}`}
                />
                <Stat
                  label="Error position"
                  value={decodeResult.errorPosition === null ? "—" : String(decodeResult.errorPosition)}
                  hint={decodeResult.errorPosition !== null ? "(1-indexed)" : "no error"}
                />
                {isSecded && (
                  <Stat
                    label="Overall parity"
                    value={decodeResult.overallParityOk ? "OK" : "Mismatch"}
                    highlight={decodeResult.overallParityOk ? "good" : "bad"}
                    hint={`bit=${decodeResult.overallParityBit}`}
                  />
                )}
                <Stat
                  label="Status"
                  value={
                    decodeResult.doubleErrorDetected
                      ? "Double error"
                      : decodeResult.singleErrorCorrected
                        ? "Corrected"
                        : "Clean"
                  }
                  highlight={
                    decodeResult.doubleErrorDetected
                      ? "bad"
                      : decodeResult.singleErrorCorrected
                        ? "bad"
                        : "good"
                  }
                />
              </div>
              {decodeResult.doubleErrorDetected && (
                <div className="rounded border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-2 text-xs text-red-700 dark:text-red-300 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  Double-bit error detected — SECDED cannot correct this. The syndrome ({decodeResult.syndrome}) is misleading and would cause a miscorrection in plain Hamming.
                </div>
              )}
              {decodeResult.singleErrorCorrected && !decodeResult.doubleErrorDetected && (
                <div className="rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                  Single-bit error at position {decodeResult.errorPosition} corrected by flipping it back.
                </div>
              )}
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Corrected codeword</div>
                <div className="font-mono text-sm bg-background border rounded px-2 py-1.5 break-all">
                  {formatBits(decodeResult.corrected)}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-2">Recovered data bits</div>
                <div className="font-mono text-sm bg-background border rounded px-2 py-1.5 break-all text-emerald-700 dark:text-emerald-400 font-bold">
                  {formatBits(decodeResult.recoveredData)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Parity coverage */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Binary className="h-4 w-4" /> Parity-bit coverage ({encodeResult.coverage.length} parity bits)
              </h3>
              <div className="space-y-1 max-h-[300px] overflow-auto">
                {encodeResult.coverage.map((c) => (
                  <div key={c.parityIndex} className="rounded border bg-background px-2 py-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        P{c.parityIndex} @ pos {c.parityPosition}
                      </Badge>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        covers [{c.coveredPositions.join(", ")}]
                      </span>
                      <Badge variant="secondary" className="text-[10px] ml-auto">
                        bit = {c.computed}
                      </Badge>
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                      values [{c.coveredValues.join(", ")}] · {c.mode} parity
                    </div>
                  </div>
                ))}
                {isSecded && (
                  <div className="rounded border bg-purple-50 dark:bg-purple-950/30 px-2 py-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] bg-purple-50 dark:bg-purple-950">
                        OP @ pos {params.n + 1}
                      </Badge>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        covers all {codewordLength} bits (overall)
                      </span>
                      <Badge variant="secondary" className="text-[10px] ml-auto">
                        bit = {(encodeResult as ReturnType<typeof encodeSecded>).overallParity}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => {
                    handleSaveHistory();
                    return formatBits(liveCodeword);
                  }}
                  label="Copy codeword"
                />
                <CopyButton
                  getText={() => formatBits(decodeResult.recoveredData)}
                  label="Copy data"
                />
                <DownloadButton
                  getText={() => {
                    const lines = [
                      `Hamming Code Error-Correction Report`,
                      `Variant: ${VARIANT_LABELS[variant]}`,
                      `Mode: ${mode} parity${isSecded ? " (SECDED)" : ""}`,
                      `Data bits: ${formatBits(encodeResult.dataBits)}`,
                      `Codeword:  ${formatBits(liveCodeword)}`,
                      `Syndrome:  ${decodeResult.syndrome} (bin ${formatSyndrome(decodeResult.syndromeBits, params.p)})`,
                      `Error:     ${decodeResult.errorPosition === null ? "none" : `position ${decodeResult.errorPosition}`}`,
                      `Corrected: ${formatBits(decodeResult.corrected)}`,
                      `Recovered: ${formatBits(decodeResult.recoveredData)}`,
                      decodeResult.doubleErrorDetected ? `WARNING: double-bit error detected (uncorrectable)` : "",
                    ].filter(Boolean);
                    return lines.join("\n");
                  }}
                  filename="hamming-code-report.txt"
                  mime="text/plain"
                  label="Download report"
                />
                <ShareButton
                  getUrl={() => {
                    handleSaveHistory();
                    return buildShareUrl(
                      dataInput,
                      variant,
                      mode,
                      isSecded,
                      flippedPositions[0] ?? 0,
                    );
                  }}
                />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter data bits to encode"
          hint="Type 0s and 1s (up to the variant's k data bits). The encoder places parity bits at powers of two; click any bit in the codeword to inject an error and watch the decoder correct it."
          icon={<Binary className="h-8 w-8" />}
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
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-2 py-1.5 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{VARIANTS[h.variant].n},{VARIANTS[h.variant].k}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.mode}</Badge>
                    {h.isSecded && <Badge variant="outline" className="text-[10px]">SECDED</Badge>}
                    {h.doubleErrorDetected && <Badge variant="destructive" className="text-[10px]">2-err</Badge>}
                    {!h.doubleErrorDetected && h.errorPosition !== null && (
                      <Badge variant="secondary" className="text-[10px]">1-err @ {h.errorPosition}</Badge>
                    )}
                    <span className="font-mono text-muted-foreground">{h.codeword}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    data: {h.dataBits} · {new Date(h.ts).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All Hamming encode/decode/correct logic runs locally in your browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: "good" | "bad";
}) {
  const color =
    highlight === "bad"
      ? "text-red-600 dark:text-red-400"
      : highlight === "good"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-foreground";
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
      {hint && <div className="text-[9px] text-muted-foreground font-mono">{hint}</div>}
    </div>
  );
}
