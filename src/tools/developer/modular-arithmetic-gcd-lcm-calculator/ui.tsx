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
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  History, Binary, Sigma, CheckCircle2, AlertTriangle, Calculator,
} from "lucide-react";
import {
  SIGN_CONVENTIONS,
  parseBigInt,
  formatBigInt,
  floorMod,
  mod,
  modAdd,
  modSub,
  modMul,
  modPow,
  gcd,
  gcdMulti,
  lcm,
  lcmMulti,
  extendedGcd,
  verifyBezout,
  modInverse,
  euclidSteps,
  extendedEuclidSteps,
  chineseRemainderTheorem,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Operation,
  type SignConvention,
  type HistoryEntry,
} from "./logic";

const OPERATIONS: { op: Operation; label: string; arity: number; hint: string }[] = [
  { op: "mod", label: "a mod m", arity: 2, hint: "a, m" },
  { op: "add", label: "(a + b) mod m", arity: 3, hint: "a, b, m" },
  { op: "sub", label: "(a − b) mod m", arity: 3, hint: "a, b, m" },
  { op: "mul", label: "(a · b) mod m", arity: 3, hint: "a, b, m" },
  { op: "pow", label: "a^b mod m", arity: 3, hint: "base, exp, m" },
  { op: "gcd", label: "gcd (2+ numbers)", arity: -1, hint: "a, b, …" },
  { op: "lcm", label: "lcm (2+ numbers)", arity: -1, hint: "a, b, …" },
  { op: "inverse", label: "a⁻¹ mod m", arity: 2, hint: "a, m" },
  { op: "ext-gcd", label: "ext-gcd(a, b) — Bézout", arity: 2, hint: "a, b" },
  { op: "crt", label: "CRT solver (r₁,m₁; r₂,m₂; …)", arity: -2, hint: "r₁,m₁,r₂,m₂,…" },
];

export default function ModularArithmeticGcdLcmCalculator() {
  const [operation, setOperation] = useState<Operation>("mod");
  const [inputsText, setInputsText] = useState("");
  const [convention, setConvention] = useState<SignConvention>("floor");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setOperation(p.operation);
      setConvention(p.convention);
      if (p.inputs.length > 0) setInputsText(p.inputs.join(", "));
      if (p.operation || p.inputs.length > 0) toast.info("Loaded from share link");
    }
  }, []);

  const parsedInputs = useMemo<(bigint | null)[]>(() => {
    if (!inputsText.trim()) return [];
    return inputsText
      .split(/[\s,;]+/)
      .filter((s) => s.length > 0)
      .map((s) => {
        try {
          return parseBigInt(s);
        } catch {
          return null;
        }
      });
  }, [inputsText]);

  const hasInvalid = parsedInputs.some((v) => v === null);

  const result = useMemo(() => {
    if (parsedInputs.length === 0 || hasInvalid) return null;
    const vals = parsedInputs as bigint[];
    try {
      switch (operation) {
        case "mod":
          if (vals.length < 2) return { error: "Need at least 2 inputs: a, m" };
          return { value: mod(vals[0], vals[1], convention).toString(), detail: `${formatBigInt(vals[0])} mod ${formatBigInt(vals[1])} (${convention})` };
        case "add":
          if (vals.length < 3) return { error: "Need 3 inputs: a, b, m" };
          return { value: modAdd(vals[0], vals[1], vals[2]).toString(), detail: `(${formatBigInt(vals[0])} + ${formatBigInt(vals[1])}) mod ${formatBigInt(vals[2])}` };
        case "sub":
          if (vals.length < 3) return { error: "Need 3 inputs: a, b, m" };
          return { value: modSub(vals[0], vals[1], vals[2]).toString(), detail: `(${formatBigInt(vals[0])} − ${formatBigInt(vals[1])}) mod ${formatBigInt(vals[2])}` };
        case "mul":
          if (vals.length < 3) return { error: "Need 3 inputs: a, b, m" };
          return { value: modMul(vals[0], vals[1], vals[2]).toString(), detail: `(${formatBigInt(vals[0])} · ${formatBigInt(vals[1])}) mod ${formatBigInt(vals[2])}` };
        case "pow":
          if (vals.length < 3) return { error: "Need 3 inputs: base, exp, m" };
          return { value: modPow(vals[0], vals[1], vals[2]).toString(), detail: `${formatBigInt(vals[0])}^${formatBigInt(vals[1])} mod ${formatBigInt(vals[2])}` };
        case "gcd":
          if (vals.length < 2) return { error: "Need at least 2 inputs" };
          return { value: gcdMulti(vals).toString(), detail: `gcd(${vals.map((v) => formatBigInt(v)).join(", ")})` };
        case "lcm":
          if (vals.length < 2) return { error: "Need at least 2 inputs" };
          return { value: lcmMulti(vals).toString(), detail: `lcm(${vals.map((v) => formatBigInt(v)).join(", ")})` };
        case "inverse": {
          if (vals.length < 2) return { error: "Need 2 inputs: a, m" };
          const inv = modInverse(vals[0], vals[1]);
          if (inv === null) {
            return { error: `No inverse: gcd(${formatBigInt(vals[0])}, ${formatBigInt(vals[1])}) = ${gcd(vals[0], vals[1])} ≠ 1` };
          }
          return { value: inv.toString(), detail: `${formatBigInt(vals[0])}⁻¹ mod ${formatBigInt(vals[1])}` };
        }
        case "ext-gcd": {
          if (vals.length < 2) return { error: "Need 2 inputs: a, b" };
          const r = extendedGcd(vals[0], vals[1]);
          const ok = verifyBezout(vals[0], vals[1], r.x, r.y, r.gcd);
          return {
            value: `gcd = ${formatBigInt(r.gcd)},  x = ${formatBigInt(r.x)},  y = ${formatBigInt(r.y)}`,
            detail: `${formatBigInt(vals[0])}·(${formatBigInt(r.x)}) + ${formatBigInt(vals[1])}·(${formatBigInt(r.y)}) = ${formatBigInt(r.gcd)} ${ok ? "✓" : "✗"}`,
            bezout: r,
          };
        }
        case "crt": {
          if (vals.length < 2 || vals.length % 2 !== 0) {
            return { error: "Need pairs: r₁,m₁,r₂,m₂,…" };
          }
          const congruences: { remainder: bigint; modulus: bigint }[] = [];
          for (let i = 0; i < vals.length; i += 2) {
            congruences.push({ remainder: vals[i], modulus: vals[i + 1] });
          }
          const r = chineseRemainderTheorem(congruences);
          if (!r.ok) return { error: r.error };
          return {
            value: `x ≡ ${formatBigInt(r.result)} (mod ${formatBigInt(r.modulus)})`,
            detail: congruences.map((c) => `x ≡ ${formatBigInt(c.remainder)} (mod ${formatBigInt(c.modulus)})`).join(",  "),
          };
        }
        default:
          return { error: "Unknown operation" };
      }
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Calculation error" };
    }
  }, [operation, parsedInputs, hasInvalid, convention]);

  const euclidTable = useMemo(() => {
    if (operation !== "ext-gcd" || parsedInputs.length < 2 || hasInvalid) return null;
    const vals = parsedInputs as bigint[];
    return euclidSteps(vals[0], vals[1]);
  }, [operation, parsedInputs, hasInvalid]);

  const extEuclidTable = useMemo(() => {
    if (operation !== "ext-gcd" || parsedInputs.length < 2 || hasInvalid) return null;
    const vals = parsedInputs as bigint[];
    return extendedEuclidSteps(vals[0], vals[1]);
  }, [operation, parsedInputs, hasInvalid]);

  const handleSaveHistory = useCallback(() => {
    if (result && !result.error && inputsText.trim()) {
      saveHistory({
        ts: Date.now(),
        operation,
        inputs: inputsText.split(/[\s,;]+/).filter(Boolean),
        result: result.value ?? "",
      });
      setHistory(loadHistory());
    }
  }, [result, inputsText, operation]);

  const handleClear = useCallback(() => {
    setInputsText("");
    setOperation("mod");
    setConvention("floor");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const opMeta = OPERATIONS.find((o) => o.op === operation)!;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs">Operation</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 pt-1">
              {OPERATIONS.map((o) => (
                <Button
                  key={o.op}
                  variant={operation === o.op ? "default" : "outline"}
                  size="sm"
                  className="text-[11px] h-8 justify-start"
                  onClick={() => setOperation(o.op)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ma-inputs">
              Inputs <span className="text-muted-foreground text-[11px]">— comma/space separated, hint: {opMeta.hint}</span>
            </Label>
            <Textarea
              id="ma-inputs"
              value={inputsText}
              onChange={(e) => setInputsText(e.target.value)}
              placeholder={opMeta.hint}
              className="min-h-[60px] resize-y font-mono text-sm"
            />
            {hasInvalid && (
              <div className="text-[11px] text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Some inputs are not valid integers.
              </div>
            )}
          </div>
          {(operation === "mod") && (
            <div className="flex items-center gap-3">
              <Label className="text-xs">Sign convention</Label>
              <select
                value={convention}
                onChange={(e) => setConvention(e.target.value as SignConvention)}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                {SIGN_CONVENTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        result.error ? (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{result.error}</span>
          </div>
        ) : (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Result
              </div>
              <div className="rounded border bg-background px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Expression</div>
                <div className="font-mono text-xs text-muted-foreground break-all">{result.detail}</div>
              </div>
              <div className="rounded border bg-background px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Value</div>
                <div className="font-mono text-base text-foreground break-all">{result.value}</div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <CopyButton
                  getText={() => { handleSaveHistory(); return result.value ?? ""; }}
                  label="Copy result"
                />
                <ShareButton
                  getUrl={() => {
                    handleSaveHistory();
                    return buildShareUrl({
                      operation,
                      inputs: inputsText.split(/[\s,;]+/).filter(Boolean),
                      convention,
                    });
                  }}
                />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        )
      )}

      {!inputsText.trim() && (
        <EmptyState
          title="Pick an operation and enter numbers"
          hint="BigInt-exact modular arithmetic, GCD/LCM, extended Euclidean with Bézout coefficients, modular inverse, and CRT solver — all client-side."
          icon={<Calculator className="h-8 w-8" />}
        />
      )}

      {euclidTable && euclidTable.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Binary className="h-4 w-4" /> Euclidean steps
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-1 pr-3">#</th>
                    <th className="py-1 pr-3">a</th>
                    <th className="py-1 pr-3">b</th>
                    <th className="py-1 pr-3">q = a div b</th>
                    <th className="py-1 pr-3">r = a mod b</th>
                  </tr>
                </thead>
                <tbody>
                  {euclidTable.map((s, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="py-1 pr-3 text-muted-foreground">{i + 1}</td>
                      <td className="py-1 pr-3">{formatBigInt(s.a, true)}</td>
                      <td className="py-1 pr-3">{formatBigInt(s.b, true)}</td>
                      <td className="py-1 pr-3">{formatBigInt(s.q, true)}</td>
                      <td className="py-1 pr-3">{formatBigInt(s.r, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The gcd is the divisor of the last step (where remainder = 0).
            </p>
          </CardContent>
        </Card>
      )}

      {extEuclidTable && extEuclidTable.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Sigma className="h-4 w-4" /> Extended Euclidean steps (Bézout coefficients)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-1 pr-3">#</th>
                    <th className="py-1 pr-3">a</th>
                    <th className="py-1 pr-3">b</th>
                    <th className="py-1 pr-3">q</th>
                    <th className="py-1 pr-3">r</th>
                    <th className="py-1 pr-3">x (next)</th>
                    <th className="py-1 pr-3">y (next)</th>
                  </tr>
                </thead>
                <tbody>
                  {extEuclidTable.map((s, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="py-1 pr-3 text-muted-foreground">{i + 1}</td>
                      <td className="py-1 pr-3">{formatBigInt(s.a, true)}</td>
                      <td className="py-1 pr-3">{formatBigInt(s.b, true)}</td>
                      <td className="py-1 pr-3">{formatBigInt(s.q, true)}</td>
                      <td className="py-1 pr-3">{formatBigInt(s.r, true)}</td>
                      <td className="py-1 pr-3">{formatBigInt(s.x, true)}</td>
                      <td className="py-1 pr-3">{formatBigInt(s.y, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The Bézout identity a·x + b·y = gcd is verified in the result card above.
            </p>
          </CardContent>
        </Card>
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
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setOperation(h.operation);
                    setInputsText(h.inputs.join(", "));
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-accent"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.operation}</Badge>
                  <span className="font-mono text-foreground">{h.inputs.join(", ")}</span>
                  <span className="text-muted-foreground"> = </span>
                  <span className="font-mono text-foreground">{h.result}</span>
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
            <strong className="text-foreground">Privacy:</strong> All arithmetic runs locally with native BigInt. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
