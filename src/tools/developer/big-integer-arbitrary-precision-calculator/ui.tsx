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
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  History, Calculator, Sigma, ShieldCheck, Hash,
} from "lucide-react";
import {
  PRESETS,
  evaluateExpression,
  formatBigValue,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
} from "./logic";

const OP_CHEATSHEET: { op: string; desc: string }[] = [
  { op: "+ - * /", desc: "add, subtract, multiply, divide" },
  { op: "%", desc: "integer modulo (always non-negative)" },
  { op: "** or ^", desc: "exponent (negative exp → fraction)" },
  { op: "!", desc: "postfix factorial" },
  { op: "gcd(a, b)", desc: "greatest common divisor" },
  { op: "lcm(a, b)", desc: "least common multiple" },
  { op: "factorial(n)", desc: "alias for n!" },
  { op: "fib(n)", desc: "Fibonacci F(n)" },
  { op: "modpow(a, b, m)", desc: "a^b mod m" },
  { op: "isprime(n)", desc: "Miller-Rabin primality test" },
  { op: "abs / min / max", desc: "helpers" },
  { op: "0x 0b 0o", desc: "hex / binary / octal literals" },
];

export default function BigIntegerCalculator() {
  const [expr, setExpr] = useState("2^256");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showFullValue, setShowFullValue] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.expression) {
        setExpr(p.expression);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const result = useMemo(() => evaluateExpression(expr), [expr]);

  const handleSaveHistory = useCallback(() => {
    if (result.ok && result.decimal) {
      saveHistory({
        ts: Date.now(),
        expression: expr,
        decimal: result.decimal,
        digitCount: result.digitCount ?? 0,
      });
      setHistory(loadHistory());
    }
  }, [result, expr]);

  const handleClear = useCallback(() => {
    setExpr("");
    setShowFullValue(false);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleShare = useCallback(() => {
    handleSaveHistory();
    return buildShareUrl(expr);
  }, [expr, handleSaveHistory]);

  const handleInsertPreset = useCallback((p: string) => {
    setExpr(p);
    setShowFullValue(false);
  }, []);

  const loadFromHistory = useCallback((h: HistoryEntry) => {
    setExpr(h.expression);
    setShowFullValue(false);
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="bigint-expr">Expression</Label>
            <Textarea
              id="bigint-expr"
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              placeholder="2^256  ·  10!  ·  gcd(12, 18)  ·  (2^1000) + (3 * 5!)  ·  1/3 + 1/6"
              className="min-h-[80px] resize-y font-mono text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <Button
                  key={p}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] font-mono"
                  onClick={() => handleInsertPreset(p)}
                >{p}</Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {result.ok && result.value ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Calculator className="h-4 w-4" /> Result
              </h3>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px]">{result.label}</Badge>
                {result.digitCount !== undefined && (
                  <Badge variant="secondary" className="text-[10px]">{result.digitCount} digits</Badge>
                )}
              </div>
            </div>

            <div className="rounded border bg-background p-3 space-y-2">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Exact value</div>
                <div className="font-mono text-sm break-all max-h-[200px] overflow-auto">
                  {result.decimal}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Grouped</div>
                  <div className="font-mono text-foreground break-all">{result.grouped}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Scientific</div>
                  <div className="font-mono text-foreground">{result.scientific}</div>
                </div>
              </div>
            </div>

            {result.value.kind === "frac" && (
              <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                <strong>Exact fraction:</strong> {formatBigValue(result.value)}
              </div>
            )}

            {result.binary && result.binary !== "(fraction)" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <BaseBox label="Binary" value={result.binary} icon={<Hash className="h-3 w-3" />} />
                <BaseBox label="Octal" value={result.octal ?? ""} icon={<Hash className="h-3 w-3" />} />
                <BaseBox label="Hex" value={result.hex ?? ""} icon={<Hash className="h-3 w-3" />} />
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <CopyButton getText={() => { handleSaveHistory(); return result.decimal ?? ""; }} label="Copy exact value" />
              <CopyButton getText={() => result.grouped ?? ""} label="Copy grouped" />
              <DownloadButton
                getText={() => result.decimal ?? ""}
                filename="bigint-result.txt"
                mime="text/plain"
                label="Download .txt"
              />
              <ShareButton getUrl={handleShare} />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      ) : (
        result.error && <ErrorBanner message={result.error} />
      )}

      <Card>
        <CardContent className="p-3">
          <details>
            <summary className="text-xs font-medium text-foreground cursor-pointer flex items-center gap-1.5">
              <Sigma className="h-3.5 w-3.5" /> Operators &amp; functions cheat-sheet
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-2">
              {OP_CHEATSHEET.map((o) => (
                <div key={o.op} className="text-[11px] flex gap-2">
                  <code className="font-mono text-primary">{o.op}</code>
                  <span className="text-muted-foreground">— {o.desc}</span>
                </div>
              ))}
            </div>
          </details>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {history.slice(0, 20).map((h, i) => (
                <button
                  key={i}
                  onClick={() => loadFromHistory(h)}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-foreground truncate flex-1">{h.expression}</code>
                    <Badge variant="outline" className="text-[10px] flex-shrink-0">{h.digitCount} digits</Badge>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground truncate mt-0.5">{h.decimal}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(h.ts).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Privacy &amp; bounds:
            </strong>{" "}
            All arithmetic runs locally via native BigInt. Factorial is capped at {`50,000`}; Fibonacci at {`1,000,000`} to avoid memory exhaustion. History stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function BaseBox({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="font-mono text-foreground break-all text-[11px] max-h-[80px] overflow-auto">{value}</div>
    </div>
  );
}
