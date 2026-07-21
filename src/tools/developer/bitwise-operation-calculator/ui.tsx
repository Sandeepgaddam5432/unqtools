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
  History, Cpu, ArrowRight, AlertTriangle, CheckCircle2, Grid3x3, ListOrdered,
} from "lucide-react";
import {
  OPERATIONS,
  OP_LABELS,
  OP_SYMBOLS,
  BIT_WIDTHS,
  parseOperand,
  parseOperands,
  evaluate,
  computeChain,
  generateTruthTable,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BitWidth,
  type SignMode,
  type ChainOp,
  type HistoryEntry,
} from "./logic";

type Mode = "expression" | "chain";

export default function BitwiseOperationCalculator() {
  const [mode, setMode] = useState<Mode>("expression");
  const [expression, setExpression] = useState("");
  const [chainOp, setChainOp] = useState<ChainOp>("AND");
  const [chainInputs, setChainInputs] = useState("");
  const [width, setWidth] = useState<BitWidth>(32);
  const [signed, setSigned] = useState<SignMode>("unsigned");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.expression) {
        setExpression(p.expression);
        setMode("expression");
      }
      setWidth(p.width);
      setSigned(p.signed);
      if (p.expression || p.width !== 32 || p.signed !== "unsigned") {
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const expressionResult = useMemo(() => {
    if (mode !== "expression" || !expression.trim()) return null;
    return evaluate(expression, width, signed);
  }, [mode, expression, width, signed]);

  const chainResult = useMemo(() => {
    if (mode !== "chain" || !chainInputs.trim()) return null;
    const { operands } = parseOperands(chainInputs);
    if (operands.length === 0) return null;
    return computeChain(operands.map((o) => o.value), chainOp, width, signed);
  }, [mode, chainInputs, chainOp, width, signed]);

  const truthTable = useMemo(() => generateTruthTable(chainOp), [chainOp]);

  const handleSaveHistory = useCallback(() => {
    const expr = mode === "expression" ? expression : `${chainInputs} [${chainOp}]`;
    const result = mode === "expression" ? expressionResult : chainResult;
    if (result && !result.error) {
      saveHistory({
        ts: Date.now(),
        expression: expr,
        width,
        signed,
        result: result.bases.hex,
      });
      setHistory(loadHistory());
    }
  }, [mode, expression, chainInputs, chainOp, expressionResult, chainResult, width, signed]);

  const handleClear = useCallback(() => {
    setExpression("");
    setChainInputs("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const activeResult = mode === "expression" ? expressionResult : chainResult;

  // Build a unified bit grid from the active result
  const bitGrid = activeResult?.bitGrid ?? [];

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={mode === "expression" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("expression")}
            >Expression</Button>
            <Button
              variant={mode === "chain" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("chain")}
            >Chain (multi-input)</Button>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <select
                value={width}
                onChange={(e) => setWidth(Number(e.target.value) as BitWidth)}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                {BIT_WIDTHS.map((w) => (
                  <option key={w} value={w}>{w === 0 ? "BigInt" : `${w}-bit`}</option>
                ))}
              </select>
              <select
                value={signed}
                onChange={(e) => setSigned(e.target.value as SignMode)}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                <option value="unsigned">unsigned</option>
                <option value="signed">signed</option>
              </select>
            </div>
          </div>

          {mode === "expression" ? (
            <div className="space-y-1.5">
              <Label htmlFor="boc-expr">Expression</Label>
              <Input
                id="boc-expr"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                placeholder="e.g. 0xF0 & ~0b1010 ^ 12"
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Operators: <code className="font-mono">~ &amp; | ^ &lt;&lt; &gt;&gt; &gt;&gt;&gt;</code> · Operands: <code className="font-mono">0x</code>hex <code className="font-mono">0b</code>bin <code className="font-mono">0o</code>oct decimal · Parentheses supported · Precedence: NOT &gt; shift &gt; AND &gt; XOR &gt; OR
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Operation</Label>
                <select
                  value={chainOp}
                  onChange={(e) => setChainOp(e.target.value as ChainOp)}
                  className="h-9 w-full text-sm rounded border bg-background px-2"
                >
                  {OPERATIONS.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.label} ({op.symbol}) — {op.arity === 1 ? "1 operand" : "2+ operands"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="boc-chain">Operands (space / newline / comma separated)</Label>
                <Textarea
                  id="boc-chain"
                  value={chainInputs}
                  onChange={(e) => setChainInputs(e.target.value)}
                  placeholder={"0xff\n0b1010\n10"}
                  className="min-h-[80px] resize-y font-mono text-xs"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {activeResult && (
        <>
          {activeResult.error ? (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> {activeResult.error}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <ArrowRight className="h-4 w-4" /> Result ({width === 0 ? "BigInt" : `${width}-bit ${signed}`})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <BaseRow label="BIN" value={activeResult.bases.bin} mono />
                    <BaseRow label="OCT" value={activeResult.bases.oct} mono />
                    <BaseRow label="DEC" value={activeResult.bases.dec} mono />
                    <BaseRow label="HEX" value={activeResult.bases.hex} mono />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <CopyButton
                      getText={() => { handleSaveHistory(); return activeResult.bases.hex; }}
                      label="Copy hex"
                    />
                    <CopyButton
                      getText={() => activeResult.bases.bin}
                      label="Copy bin"
                    />
                    <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ expression: mode === "expression" ? expression : `${chainInputs} [${chainOp}]`, width, signed }); }} />
                    <ClearButton onClick={handleClear} />
                  </div>
                </CardContent>
              </Card>

              {bitGrid.length > 0 && (
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Grid3x3 className="h-4 w-4" /> Bit-column grid
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="text-[11px] font-mono">
                        <tbody>
                          {bitGrid.map((row, i) => (
                            <tr key={i}>
                              <td className="pr-3 text-muted-foreground text-right align-middle">{row.label}</td>
                              <td className="whitespace-nowrap">
                                {row.bits.split("").map((bit, j) => (
                                  <span
                                    key={j}
                                    className={
                                      "inline-block w-5 h-5 leading-5 text-center mr-px rounded " +
                                      (bit === "1"
                                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                        : "bg-muted text-muted-foreground")
                                    }
                                  >{bit}</span>
                                ))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {width > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Each column is one bit position (MSB → LSB, {width} bits total). Green = set bit.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {activeResult.steps.length > 0 && (
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <ListOrdered className="h-4 w-4" /> Step-by-step evaluation
                    </h3>
                    <ol className="space-y-1 text-xs font-mono">
                      {activeResult.steps.map((s, i) => (
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
            </>
          )}
        </>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Cpu className="h-4 w-4" /> Truth table — {OP_LABELS[chainOp]} ({OP_SYMBOLS[chainOp]})
          </h3>
          <div className="overflow-x-auto">
            <table className="text-xs font-mono">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="px-3 text-right">a</th>
                  <th className="px-3 text-right">b</th>
                  <th className="px-3 text-right">result</th>
                  <th className="px-3 text-left">expression</th>
                </tr>
              </thead>
              <tbody>
                {truthTable.map((row, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 text-right">{row.a}</td>
                    <td className="px-3 text-right">{chainOp === "NOT" ? "—" : row.b}</td>
                    <td className={"px-3 text-right " + (row.result === 1 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>{row.result}</td>
                    <td className="px-3 text-left text-muted-foreground">{row.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Operation reference</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {OPERATIONS.map((op) => (
              <div key={op.id} className="rounded border bg-background px-3 py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] w-16">{op.label}</Badge>
                  <span className="font-mono">{op.symbol}</span>
                  <span className="text-muted-foreground text-[10px] ml-auto">{op.arity === 1 ? "unary" : "binary"}</span>
                </div>
                <p className="text-muted-foreground text-[10px] mt-1">{op.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {!activeResult && (
        <EmptyState
          title="Enter an expression or operands to evaluate"
          hint="Type a bitwise expression like 0xF0 & ~0b1010 ^ 12, or switch to Chain mode to apply a single gate to multiple operands. Mixed bases (0x/0b/0o/decimal) are auto-detected."
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
                  <Badge variant="outline" className="mr-2 text-[10px]">
                    {h.width === 0 ? "BigInt" : `${h.width}-bit`}
                  </Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.signed}</Badge>
                  <span className="font-mono text-muted-foreground mr-2 break-all">{h.expression}</span>
                  <ArrowRight className="inline h-3 w-3 text-muted-foreground" />
                  <span className="font-mono text-foreground ml-2">0x{h.result}</span>
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
            <strong className="text-foreground">Privacy:</strong> All evaluation runs locally with BigInt precision. History is stored in localStorage on this device only.
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
