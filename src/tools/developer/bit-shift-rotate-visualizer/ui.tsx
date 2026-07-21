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
  History, Cpu, ArrowRight, AlertTriangle, CheckCircle2, Grid3x3,
  ListOrdered, RotateCw, ArrowLeftRight, Flag,
} from "lucide-react";
import {
  OPERATIONS,
  OP_LABELS,
  BIT_WIDTHS,
  parseOperand,
  visualize,
  visualizeFromInput,
  chain,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  groupNibbles,
  type BitWidth,
  type SignMode,
  type ShiftOp,
  type HistoryEntry,
  type BitCell,
} from "./logic";

const OP_OPTIONS: ShiftOp[] = ["<<", ">>", ">>>", "ROL", "ROR", "RCL", "RCR"];

const ROLE_COLORS: Record<BitCell["role"], string> = {
  set: "bg-emerald-500/25 text-emerald-700 dark:text-emerald-300",
  zero: "bg-muted text-muted-foreground",
  "fill-zero": "bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30",
  "fill-sign": "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30",
  "shifted-out": "bg-rose-500/20 text-rose-700 dark:text-rose-300 line-through",
  "carry-in": "bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30",
  "carry-out": "bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-500/30",
};

export default function BitShiftRotateVisualizer() {
  const [op, setOp] = useState<ShiftOp>("<<");
  const [inputStr, setInputStr] = useState("0b00001010");
  const [width, setWidth] = useState<BitWidth>(8);
  const [shift, setShift] = useState(1);
  const [signed, setSigned] = useState<SignMode>("unsigned");
  const [carryIn, setCarryIn] = useState<0 | 1>(0);
  const [chainCount, setChainCount] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.op) setOp(p.op);
      if (p.input) setInputStr(p.input);
      setWidth(p.width);
      setShift(p.shift);
      setSigned(p.signed);
      setCarryIn(p.carryIn);
      if (p.input || p.shift !== 1 || p.width !== 32) {
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const result = useMemo(() => {
    if (!inputStr.trim()) return null;
    return visualizeFromInput(op, inputStr, width, shift, signed, carryIn);
  }, [op, inputStr, width, shift, signed, carryIn]);

  const chainResult = useMemo(() => {
    if (chainCount <= 0 || !inputStr.trim()) return null;
    let inputVal: bigint;
    try {
      inputVal = parseOperand(inputStr).value;
    } catch {
      return null;
    }
    return chain(op, inputVal, width, shift, chainCount, signed, carryIn);
  }, [op, inputStr, width, shift, signed, carryIn, chainCount]);

  const handleSaveHistory = useCallback(() => {
    if (result && !result.error) {
      saveHistory({
        ts: Date.now(),
        op,
        input: inputStr,
        width,
        shift,
        signed,
        carryIn,
        resultHex: result.bases.hex,
      });
      setHistory(loadHistory());
    }
  }, [result, op, inputStr, width, shift, signed, carryIn]);

  const handleClear = useCallback(() => {
    setInputStr("");
    setShift(1);
    setCarryIn(0);
    setChainCount(0);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const opInfo = OPERATIONS.find((o) => o.id === op);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={op}
              onChange={(e) => setOp(e.target.value as ShiftOp)}
              className="h-9 text-sm rounded border bg-background px-2 font-mono"
            >
              {OP_OPTIONS.map((o) => (
                <option key={o} value={o}>{o} — {OP_LABELS[o]}</option>
              ))}
            </select>
            <select
              value={width}
              onChange={(e) => setWidth(Number(e.target.value) as BitWidth)}
              className="h-9 text-sm rounded border bg-background px-2"
            >
              {BIT_WIDTHS.map((w) => (
                <option key={w} value={w}>{w}-bit</option>
              ))}
            </select>
            <select
              value={signed}
              onChange={(e) => setSigned(e.target.value as SignMode)}
              className="h-9 text-sm rounded border bg-background px-2"
            >
              <option value="unsigned">unsigned</option>
              <option value="signed">signed</option>
            </select>
            <div className="ml-auto flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">Carry-in</Label>
              <Button
                size="sm"
                variant={carryIn === 1 ? "default" : "outline"}
                onClick={() => setCarryIn(carryIn === 1 ? 0 : 1)}
                className="h-8 w-12"
              >
                {carryIn}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="bsrv-input">Input value</Label>
              <Input
                id="bsrv-input"
                value={inputStr}
                onChange={(e) => setInputStr(e.target.value)}
                placeholder="e.g. 0b00001010, 0xFF, 42, -8"
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Operands: <code className="font-mono">0x</code>hex, <code className="font-mono">0b</code>bin, <code className="font-mono">0o</code>oct, decimal (with optional <code className="font-mono">-</code>).
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bsrv-shift">Shift / rotate k</Label>
              <Input
                id="bsrv-shift"
                type="number"
                min={0}
                value={shift}
                onChange={(e) => setShift(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="font-mono"
              />
            </div>
          </div>

          {opInfo && (
            <p className="text-[11px] text-muted-foreground rounded border bg-background px-2 py-1.5">
              <Badge variant="outline" className="text-[10px] mr-1.5 font-mono">{opInfo.symbol}</Badge>
              {opInfo.description}
            </p>
          )}
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
                      <ArrowRight className="h-4 w-4" /> Result
                    </h3>
                    <Badge variant="outline" className="text-[10px] font-mono">{op} {shift}</Badge>
                    <Badge variant="outline" className="text-[10px]">{width}-bit {signed}</Badge>
                    {result.warning && (
                      <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-300 border-amber-500/40">
                        <AlertTriangle className="h-3 w-3 mr-1" />{result.warning}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <BaseRow label="BIN" value={groupNibbles(result.bases.bin)} mono />
                    <BaseRow label="OCT" value={result.bases.oct} mono />
                    <BaseRow label="DEC" value={result.bases.dec} mono />
                    <BaseRow label="HEX" value={result.bases.hex} mono />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
                    <span className="flex items-center gap-1">
                      <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                      Carry-out:{" "}
                      <Badge variant="outline" className={result.carryOut ? "text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/40" : ""}>{result.carryOut}</Badge>
                    </span>
                    {(op === "RCL" || op === "RCR") && (
                      <span className="flex items-center gap-1">
                        Carry-in:{" "}
                        <Badge variant="outline" className={carryIn ? "text-purple-700 dark:text-purple-300 border-purple-500/40" : ""}>{carryIn}</Badge>
                      </span>
                    )}
                    <span className="text-muted-foreground">Shifted-out bits: <span className="font-mono">{result.shiftedOut.length ? result.shiftedOut.join("") : "—"}</span></span>
                  </div>
                  <p className="text-xs text-foreground/80 rounded border bg-muted/40 px-2 py-1.5">{result.annotation}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <CopyButton getText={() => { handleSaveHistory(); return result.bases.hex; }} label="Copy hex" />
                    <CopyButton getText={() => result.bases.bin} label="Copy bin" />
                    <CopyButton getText={() => result.bases.dec} label="Copy dec" />
                    <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ op, input: inputStr, width, shift, signed, carryIn }); }} />
                    <ClearButton onClick={handleClear} />
                  </div>
                </CardContent>
              </Card>

              {result.bitGrid.length > 0 && (
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Grid3x3 className="h-4 w-4" /> Bit movement grid (MSB → LSB)
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="text-[11px] font-mono">
                        <tbody>
                          {result.bitGrid.map((row, i) => (
                            <tr key={i}>
                              <td className="pr-3 text-muted-foreground text-right align-middle whitespace-nowrap">{row.label}</td>
                              <td className="whitespace-nowrap">
                                {row.cells.length === 0 ? (
                                  <span className="text-muted-foreground">{row.bits}</span>
                                ) : (
                                  row.cells.map((cell, j) => {
                                    const sep = j > 0 && j % 4 === 0 ? " " : "";
                                    return (
                                      <React.Fragment key={j}>
                                        {sep && <span className="inline-block w-1.5" />}
                                        <span
                                          title={cell.role}
                                          className={"inline-block w-5 h-5 leading-5 text-center mr-px rounded " + ROLE_COLORS[cell.role]}
                                        >{cell.value}</span>
                                      </React.Fragment>
                                    );
                                  })
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground pt-1">
                      <Legend swatch={ROLE_COLORS.set} label="set bit" />
                      <Legend swatch={ROLE_COLORS.zero} label="zero bit" />
                      <Legend swatch={ROLE_COLORS["fill-zero"]} label="fill zero" />
                      <Legend swatch={ROLE_COLORS["fill-sign"]} label="fill sign" />
                      <Legend swatch={ROLE_COLORS["shifted-out"]} label="shifted out" />
                      <Legend swatch={ROLE_COLORS["carry-in"]} label="carry-in" />
                    </div>
                  </CardContent>
                </Card>
              )}

              {result.steps.length > 0 && (
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <ListOrdered className="h-4 w-4" /> Step-by-step ({result.steps.length})
                    </h3>
                    <ol className="space-y-1 text-xs font-mono">
                      {result.steps.map((s, i) => (
                        <li key={i} className="rounded border bg-background px-2 py-1">
                          <span className="text-muted-foreground mr-2">{i + 1}.</span>
                          <CheckCircle2 className="inline h-3 w-3 mr-1 text-emerald-500" />
                          {s}
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <RotateCw className="h-4 w-4" /> Chain ({op} {shift} × N)
                    </h3>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Label className="text-xs text-muted-foreground">repeat</Label>
                      <Input
                        type="number"
                        min={0}
                        max={width * 2}
                        value={chainCount}
                        onChange={(e) => setChainCount(Math.max(0, Math.min(width * 2, parseInt(e.target.value, 10) || 0)))}
                        className="h-8 w-20 font-mono"
                      />
                      <Button size="sm" variant="outline" onClick={() => setChainCount(Math.max(0, chainCount - 1))}>−</Button>
                      <Button size="sm" variant="outline" onClick={() => setChainCount(chainCount + 1)}>+</Button>
                    </div>
                  </div>
                  {chainResult && chainResult.error ? (
                    <p className="text-xs text-destructive">{chainResult.error}</p>
                  ) : chainResult && chainResult.steps.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="text-xs font-mono w-full">
                        <thead>
                          <tr className="text-muted-foreground border-b">
                            <th className="px-2 text-right">#</th>
                            <th className="px-2 text-left">binary</th>
                            <th className="px-2 text-right">hex</th>
                            <th className="px-2 text-right">carry</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chainResult.steps.map((s) => (
                            <tr key={s.step} className="border-b last:border-0">
                              <td className="px-2 text-right text-muted-foreground">{s.step}</td>
                              <td className="px-2">{groupNibbles(s.bin)}</td>
                              <td className="px-2 text-right">0x{s.result.toString(16).toUpperCase()}</td>
                              <td className={"px-2 text-right " + (s.carry ? "text-fuchsia-700 dark:text-fuchsia-300" : "text-muted-foreground")}>{s.carry}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Set the repeat count above 0 to apply the same operation multiple times and see how the register evolves step by step.</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <ArrowLeftRight className="h-4 w-4" /> Operation reference
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {OPERATIONS.map((o) => (
              <div key={o.id} className="rounded border bg-background px-3 py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] w-16 font-mono">{o.symbol}</Badge>
                  <span className="font-medium">{o.label}</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">{o.family}</Badge>
                </div>
                <p className="text-muted-foreground text-[10px] mt-1">{o.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {!result && (
        <EmptyState
          title="Enter an input value to visualize a bit shift or rotate"
          hint="Pick an operation (<<, >>, >>>, ROL, ROR, RCL, RCR), a bit width (8/16/32/64), and a shift count k. The tool shows the before/after binary grid, the bits shifted out, the carry flag, and the ×/÷ by 2^k relationship. BigInt-correct at every width."
          icon={<Cpu className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2 text-[10px] font-mono">{h.op}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.width}-bit {h.signed}</Badge>
                  <span className="font-mono text-muted-foreground mr-2 break-all">{h.input}</span>
                  <ArrowRight className="inline h-3 w-3 text-muted-foreground" />
                  <span className="font-mono text-foreground ml-2">0x{h.resultHex}</span>
                  <span className="text-muted-foreground ml-2">· k={h.shift} · {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All math runs locally with BigInt precision (64-bit exact). History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function BaseRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded border bg-background px-3 py-1.5">
      <Badge variant="outline" className="text-[10px] w-12">{label}</Badge>
      <span className={"break-all " + (mono ? "font-mono" : "")}>{value}</span>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={"inline-block w-3 h-3 rounded " + swatch} />
      {label}
    </span>
  );
}
