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
  History, Binary, ArrowRight, AlertTriangle, CheckCircle2, Grid3x3,
  ListOrdered, Plus, Minus, RefreshCw, Maximize2, Minimize2,
} from "lucide-react";
import {
  WIDTH_PRESETS,
  MIN_CUSTOM_WIDTH,
  MAX_CUSTOM_WIDTH,
  isValidWidth,
  normalizeWidth,
  getRange,
  convert,
  changeWidth,
  toggleBit,
  groupNibbles,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
} from "./logic";

export default function TwosComplementSignedIntegerCalculator() {
  const [inputStr, setInputStr] = useState("-5");
  const [width, setWidth] = useState(8);
  const [customWidth, setCustomWidth] = useState(12);
  const [useCustom, setUseCustom] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [prevWidth, setPrevWidth] = useState<number | null>(null);

  const effectiveWidth = useCustom ? normalizeWidth(customWidth) : width;

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.input) setInputStr(p.input);
      if (WIDTH_PRESETS.includes(p.width as 4 | 8 | 16 | 32 | 64)) {
        setWidth(p.width as 4 | 8 | 16 | 32 | 64);
        setUseCustom(false);
      } else if (isValidWidth(p.width)) {
        setCustomWidth(p.width);
        setUseCustom(true);
      }
      if (p.input || p.width !== 32) {
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const result = useMemo(() => {
    if (!inputStr.trim()) return null;
    return convert(inputStr, effectiveWidth);
  }, [inputStr, effectiveWidth]);

  // Track width-change visualization (sign extension / truncation).
  const widthChange = useMemo(() => {
    if (prevWidth === null || prevWidth === effectiveWidth || !result) return null;
    return changeWidth(result.input, prevWidth, effectiveWidth);
  }, [prevWidth, effectiveWidth, result]);

  useEffect(() => {
    // After the effect runs, remember the current width for the next change.
    setPrevWidth(effectiveWidth);
  }, [effectiveWidth]);

  const handleBitClick = useCallback((position: number) => {
    if (!result || result.error) return;
    const newValue = toggleBit(result.input, position, effectiveWidth);
    setInputStr(newValue.toString(10));
  }, [result, effectiveWidth]);

  const handleSaveHistory = useCallback(() => {
    if (result && !result.error) {
      saveHistory({
        ts: Date.now(),
        input: inputStr,
        width: effectiveWidth,
        dec: result.twos.dec,
        hex: result.twos.hex,
      });
      setHistory(loadHistory());
    }
  }, [result, inputStr, effectiveWidth]);

  const handleClear = useCallback(() => {
    setInputStr("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleIncrement = useCallback(() => {
    if (!result || result.error) {
      setInputStr("1");
      return;
    }
    setInputStr((result.input + 1n).toString(10));
  }, [result]);

  const handleDecrement = useCallback(() => {
    if (!result || result.error) {
      setInputStr("-1");
      return;
    }
    setInputStr((result.input - 1n).toString(10));
  }, [result]);

  const handleNegate = useCallback(() => {
    if (!result || result.error) return;
    setInputStr((-result.input).toString(10));
  }, [result]);

  const handleWiden = useCallback(() => {
    const next = Math.min(MAX_CUSTOM_WIDTH, effectiveWidth + 1);
    if (WIDTH_PRESETS.includes(next as 4 | 8 | 16 | 32 | 64)) {
      setWidth(next as 4 | 8 | 16 | 32 | 64);
      setUseCustom(false);
    } else {
      setCustomWidth(next);
      setUseCustom(true);
    }
  }, [effectiveWidth]);

  const handleNarrow = useCallback(() => {
    const next = Math.max(MIN_CUSTOM_WIDTH, effectiveWidth - 1);
    if (WIDTH_PRESETS.includes(next as 4 | 8 | 16 | 32 | 64)) {
      setWidth(next as 4 | 8 | 16 | 32 | 64);
      setUseCustom(false);
    } else {
      setCustomWidth(next);
      setUseCustom(true);
    }
  }, [effectiveWidth]);

  const range = useMemo(() => getRange(effectiveWidth), [effectiveWidth]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs text-muted-foreground">Width</Label>
            {WIDTH_PRESETS.map((w) => (
              <Button
                key={w}
                size="sm"
                variant={!useCustom && width === w ? "default" : "outline"}
                onClick={() => { setWidth(w); setUseCustom(false); }}
                className="h-8"
              >{w}-bit</Button>
            ))}
            <Button
              size="sm"
              variant={useCustom ? "default" : "outline"}
              onClick={() => setUseCustom(true)}
              className="h-8"
            >Custom</Button>
            {useCustom && (
              <Input
                type="number"
                min={MIN_CUSTOM_WIDTH}
                max={MAX_CUSTOM_WIDTH}
                value={customWidth}
                onChange={(e) => setCustomWidth(Math.max(MIN_CUSTOM_WIDTH, Math.min(MAX_CUSTOM_WIDTH, parseInt(e.target.value, 10) || MIN_CUSTOM_WIDTH)))}
                className="h-8 w-20 font-mono"
              />
            )}
            <div className="ml-auto flex items-center gap-1">
              <Button size="icon-sm" variant="outline" onClick={handleNarrow} title="Narrow by 1 bit"><Minimize2 className="h-3.5 w-3.5" /></Button>
              <Button size="icon-sm" variant="outline" onClick={handleWiden} title="Widen by 1 bit"><Maximize2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="tcs-input">Signed decimal or bit pattern</Label>
              <Input
                id="tcs-input"
                value={inputStr}
                onChange={(e) => setInputStr(e.target.value)}
                placeholder="e.g. -5, 0xFF, 0b11111011, 0o373"
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Decimal is interpreted as signed. <code className="font-mono">0x</code>hex, <code className="font-mono">0b</code>bin and <code className="font-mono">0o</code>oct are interpreted as raw bit patterns (so <code className="font-mono">0xFF</code> at 8-bit = −1).
              </p>
            </div>
            <div className="flex flex-col gap-1.5 justify-end">
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" onClick={handleDecrement} title="−1"><Minus className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" onClick={handleIncrement} title="+1"><Plus className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" onClick={handleNegate} title="Negate"><RefreshCw className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <Badge variant="outline" className="text-[10px]">{effectiveWidth}-bit</Badge>
            <Badge variant="outline" className="text-[10px] font-mono">range: {range.min.toString()} … {range.max.toString()}</Badge>
            {result && result.overflow && (
              <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-300 border-amber-500/40">
                <AlertTriangle className="h-3 w-3 mr-1" />overflow
              </Badge>
            )}
            {result && !result.overflow && !result.error && (
              <Badge variant="outline" className="text-[10px] text-emerald-700 dark:text-emerald-300 border-emerald-500/40">
                <CheckCircle2 className="h-3 w-3 mr-1" />in range
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          {result.error ? (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> {result.error}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <ArrowRight className="h-4 w-4" /> Two's complement
                    </h3>
                    <Badge variant="outline" className="text-[10px]">{effectiveWidth}-bit</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <BaseRow label="BIN" value={groupNibbles(result.twos.bin)} mono />
                    <BaseRow label="OCT" value={result.twos.oct} mono />
                    <BaseRow label="DEC" value={result.twos.dec} mono />
                    <BaseRow label="HEX" value={result.twos.hex} mono />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <CopyButton getText={() => { handleSaveHistory(); return result.twos.hex; }} label="Copy hex" />
                    <CopyButton getText={() => result.twos.bin} label="Copy bin" />
                    <CopyButton getText={() => result.twos.dec} label="Copy dec" />
                    <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ input: inputStr, width: effectiveWidth }); }} />
                    <ClearButton onClick={handleClear} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Grid3x3 className="h-4 w-4" /> Bit grid — click any bit to toggle (MSB on left = sign bit)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="text-[11px] font-mono">
                      <tbody>
                        <tr>
                          <td className="pr-3 text-muted-foreground text-right align-middle">bits</td>
                          <td className="whitespace-nowrap">
                            {result.bitGrid.cells.map((cell, j) => {
                              const sep = j > 0 && j % 4 === 0 ? " " : "";
                              return (
                                <React.Fragment key={cell.position}>
                                  {sep && <span className="inline-block w-1.5" />}
                                  <button
                                    type="button"
                                    onClick={() => handleBitClick(cell.position)}
                                    title={`bit ${cell.position} (weight 2^${cell.position} = ${cell.weight.toString()})${cell.isSign ? " — sign bit" : ""}`}
                                    className={
                                      "inline-block w-6 h-6 leading-6 text-center mr-px rounded transition-colors hover:ring-2 hover:ring-primary/40 " +
                                      (cell.value === 1
                                        ? (cell.isSign
                                          ? "bg-amber-500/30 text-amber-800 dark:text-amber-200 border border-amber-500/40"
                                          : "bg-emerald-500/25 text-emerald-700 dark:text-emerald-300")
                                        : (cell.isSign
                                          ? "bg-muted text-amber-700/50 dark:text-amber-300/50 border border-amber-500/20"
                                          : "bg-muted text-muted-foreground"))
                                    }
                                  >{cell.value}</button>
                                </React.Fragment>
                              );
                            })}
                          </td>
                        </tr>
                        <tr className="text-muted-foreground">
                          <td className="pr-3 text-right align-top">weight</td>
                          <td className="whitespace-nowrap">
                            {result.bitGrid.cells.map((cell, j) => {
                              const sep = j > 0 && j % 4 === 0 ? " " : "";
                              return (
                                <React.Fragment key={cell.position}>
                                  {sep && <span className="inline-block w-1.5" />}
                                  <span className="inline-block w-6 text-center mr-px text-[9px]">2<sup>{cell.position}</sup></span>
                                </React.Fragment>
                              );
                            })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Amber = sign bit (position {effectiveWidth - 1}, weight −{(-1n * (1n << BigInt(effectiveWidth - 1))).toString()}). Green = set value bit. Click any cell to flip it.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Binary className="h-4 w-4" /> All three representations side-by-side
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="text-xs font-mono w-full">
                      <thead>
                        <tr className="text-muted-foreground border-b">
                          <th className="px-2 text-left">representation</th>
                          <th className="px-2 text-left">binary</th>
                          <th className="px-2 text-right">hex</th>
                          <th className="px-2 text-right">dec</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="px-2">two's complement</td>
                          <td className="px-2">{groupNibbles(result.twos.bin)}</td>
                          <td className="px-2 text-right">{result.twos.hex}</td>
                          <td className="px-2 text-right">{result.twos.dec}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="px-2">one's complement</td>
                          <td className="px-2">{groupNibbles(result.ones.bin)}</td>
                          <td className="px-2 text-right">{result.ones.hex}</td>
                          <td className="px-2 text-right">{result.ones.dec}</td>
                        </tr>
                        <tr>
                          <td className="px-2">sign-magnitude</td>
                          <td className="px-2">{groupNibbles(result.signMag.bin)}</td>
                          <td className="px-2 text-right">{result.signMag.hex}</td>
                          <td className="px-2 text-right">{result.signMag.dec}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Note: one's complement and sign-magnitude both have a ±0 ambiguity; two's complement has a single zero. Two's complement also uniquely represents the most-negative value (−{(range.min).toString()}) which has no positive counterpart.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <ListOrdered className="h-4 w-4" /> Step-by-step negation (invert → +1)
                  </h3>
                  <ol className="space-y-1 text-xs font-mono">
                    {result.negation.steps.map((s, i) => (
                      <li key={i} className="rounded border bg-background px-2 py-1">
                        <span className="text-muted-foreground mr-2">{i + 1}.</span>
                        <CheckCircle2 className="inline h-3 w-3 mr-1 text-emerald-500" />
                        {s}
                      </li>
                    ))}
                  </ol>
                  {result.negation.isMostNegative && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3" /> Most-negative value — its negation overflows back to itself.
                    </p>
                  )}
                </CardContent>
              </Card>

              {widthChange && widthChange.fromWidth !== widthChange.toWidth && (
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <RefreshCw className="h-4 w-4" /> Width change: {widthChange.fromWidth} → {widthChange.toWidth} bits
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <BaseRow label={`BIN (${widthChange.fromWidth})`} value={groupNibbles(widthChange.fromBin)} mono />
                      <BaseRow label={`BIN (${widthChange.toWidth})`} value={groupNibbles(widthChange.toBin)} mono />
                    </div>
                    <p className={"text-[11px] " + (widthChange.preserved ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300")}>
                      {widthChange.description}
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {!result && (
        <EmptyState
          title="Enter a signed decimal or bit pattern to convert"
          hint="Pick a bit width (4/8/16/32/64 or custom up to 256) and type a signed decimal like -5 or a bit pattern like 0xFF / 0b11111011 / 0o373. The tool shows two's, one's, and sign-magnitude side-by-side, a clickable bit grid, the step-by-step negation, and range/overflow detection."
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.width}-bit</Badge>
                  <span className="font-mono text-muted-foreground mr-2 break-all">{h.input}</span>
                  <ArrowRight className="inline h-3 w-3 text-muted-foreground" />
                  <span className="font-mono text-foreground ml-2">{h.dec}</span>
                  <span className="font-mono text-muted-foreground ml-2">(0x{h.hex})</span>
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
            <strong className="text-foreground">Privacy:</strong> All math runs locally with BigInt precision. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function BaseRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded border bg-background px-3 py-1.5">
      <Badge variant="outline" className="text-[10px] w-28">{label}</Badge>
      <span className={"break-all " + (mono ? "font-mono" : "")}>{value}</span>
    </div>
  );
}
