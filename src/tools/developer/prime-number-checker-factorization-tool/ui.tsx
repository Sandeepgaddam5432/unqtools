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
  History, Binary, Sigma, CheckCircle2, AlertTriangle,
  Calculator, GitBranch, ListOrdered,
} from "lucide-react";
import {
  parseBigInt,
  formatBigInt,
  isPrimeDetailed,
  factorize,
  factorTree,
  divisorCount,
  divisorSum,
  eulerTotient,
  computeStats,
  sieveOfEratosthenes,
  nextPrime,
  previousPrime,
  primeGaps,
  twinPrimes,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Operation,
  type FactorTreeNode,
  type HistoryEntry,
} from "./logic";

const OPERATIONS: { op: Operation; label: string; hint: string }[] = [
  { op: "is-prime", label: "Is prime?", hint: "n" },
  { op: "factorize", label: "Factorize", hint: "n" },
  { op: "sieve", label: "Sieve (primes ≤ n)", hint: "limit (e.g. 1000)" },
  { op: "next-prime", label: "Next prime", hint: "n" },
  { op: "prev-prime", label: "Previous prime", hint: "n" },
  { op: "prime-gap", label: "Prime gaps (start,end)", hint: "start, end" },
  { op: "twin-primes", label: "Twin primes (start,end)", hint: "start, end" },
];

export default function PrimeNumberCheckerFactorizationTool() {
  const [operation, setOperation] = useState<Operation>("is-prime");
  const [inputText, setInputText] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setOperation(p.operation);
      if (p.input) setInputText(p.input);
      if (p.operation || p.input) toast.info("Loaded from share link");
    }
  }, []);

  const parsedInputs = useMemo<(bigint | null)[]>(() => {
    if (!inputText.trim()) return [];
    return inputText
      .split(/[\s,;]+/)
      .filter((s) => s.length > 0)
      .map((s) => {
        try {
          return parseBigInt(s);
        } catch {
          return null;
        }
      });
  }, [inputText]);

  const hasInvalid = parsedInputs.some((v) => v === null);

  const result = useMemo(() => {
    if (parsedInputs.length === 0 || hasInvalid) return null;
    const vals = parsedInputs as bigint[];
    try {
      switch (operation) {
        case "is-prime": {
          if (vals.length < 1) return { error: "Need an input n" };
          const r = isPrimeDetailed(vals[0]);
          return {
            value: r.label === "prime" ? "PRIME" : r.label === "composite" ? "COMPOSITE" : r.label.toUpperCase(),
            detail: `${formatBigInt(vals[0])} · certainty: ${r.certainty}${r.witness ? ` · witness: ${formatBigInt(r.witness)}` : ""}${r.rounds ? ` · rounds: ${r.rounds}` : ""}`,
            primality: r,
          };
        }
        case "factorize": {
          if (vals.length < 1) return { error: "Need an input n" };
          const r = factorize(vals[0]);
          return {
            value: r.exponentForm,
            detail: r.verified ? "Verified by re-multiplication ✓" : "WARNING: factorization not verified",
            factorization: r,
            tree: factorTree(vals[0]),
            stats: computeStats(vals[0]),
          };
        }
        case "sieve": {
          if (vals.length < 1) return { error: "Need a limit" };
          const limit = Number(vals[0]);
          if (!Number.isSafeInteger(limit) || limit < 0) {
            return { error: "Sieve limit must be a non-negative integer ≤ 2^53 − 1" };
          }
          if (limit > 5_000_000) {
            return { error: "Sieve limit capped at 5,000,000 to keep memory reasonable" };
          }
          const primes = sieveOfEratosthenes(limit);
          return {
            value: `${primes.length} primes ≤ ${limit}`,
            detail: `First: ${primes[0] ?? "—"}, Last: ${primes[primes.length - 1] ?? "—"}`,
            primes,
          };
        }
        case "next-prime": {
          if (vals.length < 1) return { error: "Need an input n" };
          const np = nextPrime(vals[0]);
          return { value: formatBigInt(np), detail: `nextPrime(${formatBigInt(vals[0])})` };
        }
        case "prev-prime": {
          if (vals.length < 1) return { error: "Need an input n" };
          const pp = previousPrime(vals[0]);
          if (pp === null) return { error: `No prime strictly less than ${formatBigInt(vals[0])}` };
          return { value: formatBigInt(pp), detail: `previousPrime(${formatBigInt(vals[0])})` };
        }
        case "prime-gap": {
          if (vals.length < 2) return { error: "Need start, end" };
          const gaps = primeGaps(vals[0], vals[1]);
          return {
            value: `${gaps.length} gaps ≥ 2 found`,
            detail: `range [${formatBigInt(vals[0])}, ${formatBigInt(vals[1])}]`,
            gaps,
          };
        }
        case "twin-primes": {
          if (vals.length < 2) return { error: "Need start, end" };
          const pairs = twinPrimes(vals[0], vals[1]);
          return {
            value: `${pairs.length} twin-prime pairs found`,
            detail: `range [${formatBigInt(vals[0])}, ${formatBigInt(vals[1])}]`,
            twinPairs: pairs,
          };
        }
        default:
          return { error: "Unknown operation" };
      }
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Calculation error" };
    }
  }, [operation, parsedInputs, hasInvalid]);

  const handleSaveHistory = useCallback(() => {
    if (result && !result.error && inputText.trim()) {
      saveHistory({
        ts: Date.now(),
        operation,
        input: inputText.trim(),
        result: typeof result.value === "string" ? result.value : "",
      });
      setHistory(loadHistory());
    }
  }, [result, inputText, operation]);

  const handleClear = useCallback(() => {
    setInputText("");
    setOperation("is-prime");
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 pt-1">
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
            <Label htmlFor="pn-input">
              Input <span className="text-muted-foreground text-[11px]">— hint: {opMeta.hint}</span>
            </Label>
            <Input
              id="pn-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={opMeta.hint}
              className="font-mono text-sm"
            />
            {hasInvalid && (
              <div className="text-[11px] text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Some inputs are not valid integers.
              </div>
            )}
          </div>
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
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Detail</div>
                <div className="font-mono text-xs text-muted-foreground break-all">{result.detail}</div>
              </div>
              <div className="rounded border bg-background px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Value</div>
                <div className="font-mono text-base text-foreground break-all">{result.value}</div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <CopyButton
                  getText={() => { handleSaveHistory(); return typeof result.value === "string" ? result.value : ""; }}
                  label="Copy result"
                />
                <ShareButton
                  getUrl={() => {
                    handleSaveHistory();
                    return buildShareUrl({ operation, input: inputText.trim() });
                  }}
                />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        )
      )}

      {!inputText.trim() && (
        <EmptyState
          title="Pick an operation and enter a number"
          hint="BigInt-exact primality (deterministic Miller–Rabin), Pollard's rho factorization, sieve, prime gaps, twin primes, divisor count/sum, and Euler's totient — all client-side."
          icon={<Calculator className="h-8 w-8" />}
        />
      )}

      {result && !result.error && result.factorization && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ListOrdered className="h-4 w-4" /> Prime factors ({result.factorization.factors.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-1 pr-3">#</th>
                    <th className="py-1 pr-3">prime p</th>
                    <th className="py-1 pr-3">exponent e</th>
                    <th className="py-1 pr-3">p^e</th>
                  </tr>
                </thead>
                <tbody>
                  {result.factorization.factors.map((f, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="py-1 pr-3 text-muted-foreground">{i + 1}</td>
                      <td className="py-1 pr-3">{formatBigInt(f.prime, true)}</td>
                      <td className="py-1 pr-3">{f.exponent}</td>
                      <td className="py-1 pr-3">{formatBigInt(f.prime ** BigInt(f.exponent), true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Exponent form: <span className="font-mono text-foreground">{result.factorization.exponentForm}</span>
              {" · "}
              {result.factorization.verified
                ? <span className="text-emerald-600 dark:text-emerald-400">verified by re-multiplication ✓</span>
                : <span className="text-destructive">NOT verified ✗</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {result && !result.error && result.tree && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <GitBranch className="h-4 w-4" /> Factor tree
            </h3>
            <FactorTreeView node={result.tree} />
          </CardContent>
        </Card>
      )}

      {result && !result.error && result.stats && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Sigma className="h-4 w-4" /> Derived statistics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <StatBox label="τ(n) — divisor count" value={formatBigInt(result.stats.divisorCount, true)} />
              <StatBox label="σ(n) — divisor sum" value={formatBigInt(result.stats.divisorSum, true)} />
              <StatBox label="φ(n) — Euler totient" value={formatBigInt(result.stats.eulerTotient, true)} />
            </div>
          </CardContent>
        </Card>
      )}

      {result && !result.error && result.primality && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Binary className="h-4 w-4" /> Primality details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <StatBox label="Verdict" value={result.primality.isPrime ? "prime" : "composite"} />
              <StatBox label="Certainty" value={result.primality.certainty} />
              <StatBox
                label="Witness / rounds"
                value={
                  result.primality.witness
                    ? `${formatBigInt(result.primality.witness)}${result.primality.rounds ? ` (${result.primality.rounds})` : ""}`
                    : result.primality.rounds ? `${result.primality.rounds} rounds` : "—"
                }
              />
            </div>
          </CardContent>
        </Card>
      )}

      {result && !result.error && result.primes && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ListOrdered className="h-4 w-4" /> Primes ({result.primes.length})
            </h3>
            <div className="flex flex-wrap gap-1 max-h-[300px] overflow-auto">
              {result.primes.slice(0, 5000).map((p, i) => (
                <Badge key={i} variant="outline" className="text-[10px] font-mono">
                  {p.toString()}
                </Badge>
              ))}
              {result.primes.length > 5000 && (
                <span className="text-[10px] text-muted-foreground">… ({result.primes.length - 5000} more)</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {result && !result.error && result.gaps && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Binary className="h-4 w-4" /> Prime gaps ({result.gaps.length})
            </h3>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {result.gaps.map((g, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs font-mono">
                  <Badge variant="outline" className="mr-2 text-[10px]">gap {g.gap.toString()}</Badge>
                  <span className="text-muted-foreground">{formatBigInt(g.lower, true)}</span>
                  <span className="text-muted-foreground mx-1">→</span>
                  <span className="text-foreground">{formatBigInt(g.upper, true)}</span>
                </div>
              ))}
              {result.gaps.length === 0 && (
                <div className="text-[11px] text-muted-foreground">No gaps ≥ 2 found in this range.</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {result && !result.error && result.twinPairs && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Binary className="h-4 w-4" /> Twin prime pairs ({result.twinPairs.length})
            </h3>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {result.twinPairs.map((p, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs font-mono">
                  <Badge variant="outline" className="mr-2 text-[10px]">gap 2</Badge>
                  <span className="text-foreground">({formatBigInt(p.lower, true)}, {formatBigInt(p.upper, true)})</span>
                </div>
              ))}
              {result.twinPairs.length === 0 && (
                <div className="text-[11px] text-muted-foreground">No twin primes in this range.</div>
              )}
            </div>
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
                    setInputText(h.input);
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-accent"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.operation}</Badge>
                  <span className="font-mono text-foreground">{h.input}</span>
                  <span className="text-muted-foreground"> = </span>
                  <span className="font-mono text-foreground break-all">{h.result}</span>
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
            <strong className="text-foreground">Privacy:</strong> All arithmetic runs locally with native BigInt. History is stored in localStorage on this device only. RSA-size semiprimes are computationally infeasible to factor — Pollard's rho works best when at least one factor is small-to-medium.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm text-foreground break-all">{value}</div>
    </div>
  );
}

function FactorTreeView({ node, depth = 0 }: { node: FactorTreeNode; depth?: number }) {
  const indent = { paddingLeft: `${depth * 16}px` };
  if (node.isPrime) {
    return (
      <div style={indent} className="font-mono text-xs py-0.5">
        <Badge variant="secondary" className="text-[10px] mr-2">prime</Badge>
        <span className="text-foreground">{formatBigInt(node.value, true)}</span>
      </div>
    );
  }
  if (!node.factor || !node.quotient) {
    return (
      <div style={indent} className="font-mono text-xs py-0.5 text-muted-foreground">
        {formatBigInt(node.value, true)} (unit / non-factorable)
      </div>
    );
  }
  return (
    <div>
      <div style={indent} className="font-mono text-xs py-0.5">
        <Badge variant="outline" className="text-[10px] mr-2">composite</Badge>
        <span className="text-foreground">{formatBigInt(node.value, true)}</span>
        <span className="text-muted-foreground"> = </span>
        <span className="text-emerald-600 dark:text-emerald-400">{formatBigInt(node.factor, true)}</span>
        <span className="text-muted-foreground"> × </span>
        <span className="text-blue-600 dark:text-blue-400">{formatBigInt(node.quotient, true)}</span>
      </div>
      {node.factorChild && <FactorTreeView node={node.factorChild} depth={depth + 1} />}
      {node.quotientChild && <FactorTreeView node={node.quotientChild} depth={depth + 1} />}
    </div>
  );
}
