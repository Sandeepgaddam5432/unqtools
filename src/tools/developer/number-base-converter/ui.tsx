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
  History, Binary, ArrowRight, Sigma, SigmaSquare, CheckCircle2, AlertTriangle,
} from "lucide-react";
import {
  BASE_PRESETS,
  BASE_LABELS,
  COMMON_BASES,
  BIT_WIDTHS,
  detectBase,
  validateDigits,
  convertBase,
  convertAllBases,
  buildExpansion,
  groupDigits,
  parseBatchInput,
  batchConvert,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SignedBitWidth,
  type HistoryEntry,
} from "./logic";

type Mode = "single" | "batch";

export default function NumberBaseConverter() {
  const [input, setInput] = useState("");
  const [fromBase, setFromBase] = useState(10);
  const [toBase, setToBase] = useState(16);
  const [signed, setSigned] = useState(false);
  const [bitWidth, setBitWidth] = useState<SignedBitWidth>(8);
  const [groupOutput, setGroupOutput] = useState(true);
  const [mode, setMode] = useState<Mode>("single");
  const [batchText, setBatchText] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.input) {
        setInput(p.input);
        setFromBase(p.fromBase);
        setToBase(p.toBase);
        setSigned(p.signed ?? false);
        if (p.bitWidth) setBitWidth(p.bitWidth);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const groupSize = toBase === 2 ? 4 : toBase === 16 ? 2 : 0;

  const singleResult = useMemo(() => {
    if (!input.trim()) return null;
    const r = convertBase(input, fromBase, toBase, {
      signed,
      bitWidth,
      groupSize: groupOutput ? groupSize : 0,
      uppercase: true,
    });
    return r;
  }, [input, fromBase, toBase, signed, bitWidth, groupOutput, groupSize]);

  const allBases = useMemo(() => {
    if (!input.trim()) return null;
    return convertAllBases(input, fromBase, { signed, bitWidth });
  }, [input, fromBase, signed, bitWidth]);

  const expansion = useMemo(() => {
    if (!input.trim()) return null;
    return buildExpansion(input, fromBase);
  }, [input, fromBase]);

  const validation = useMemo(() => {
    if (!input.trim()) return { valid: true, invalidChars: [] as string[] };
    return validateDigits(input.replace(/^[+-]/, "").split(".")[0] ?? "", fromBase);
  }, [input, fromBase]);

  const batchResults = useMemo(() => {
    if (mode !== "batch" || !batchText.trim()) return [];
    const lines = parseBatchInput(batchText);
    return batchConvert(lines, fromBase, toBase, {
      signed,
      bitWidth,
      groupSize: groupOutput ? groupSize : 0,
      uppercase: true,
    });
  }, [mode, batchText, fromBase, toBase, signed, bitWidth, groupOutput, groupSize]);

  const handleAutoDetect = useCallback(() => {
    const d = detectBase(input);
    if (d) {
      setFromBase(d.base);
      toast.success(`Detected base ${d.base} (${BASE_LABELS[d.base] ?? "?"})`);
    } else {
      toast.info("No prefix found — keeping current base");
    }
  }, [input]);

  const handleSaveHistory = useCallback(() => {
    if (singleResult && !singleResult.error) {
      saveHistory({
        ts: Date.now(),
        input,
        fromBase,
        toBase,
        result: singleResult.value,
      });
      setHistory(loadHistory());
    }
  }, [singleResult, input, fromBase, toBase]);

  const handleQuickChip = useCallback((b: number) => {
    setToBase(b);
  }, []);

  const handleClear = useCallback(() => {
    setInput("");
    setBatchText("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const batchCsv = useMemo(() => {
    if (batchResults.length === 0) return "";
    const lines = ["input,result"];
    for (const r of batchResults) {
      const val = r.outputs[0]?.value ?? r.error ?? "";
      lines.push(`"${r.input.replace(/"/g, '""')}","${val.replace(/"/g, '""')}"`);
    }
    return lines.join("\n");
  }, [batchResults]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={mode === "single" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("single")}
            >Single</Button>
            <Button
              variant={mode === "batch" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("batch")}
            >Batch</Button>
          </div>

          {mode === "single" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="nbc-input">Input value</Label>
                <div className="flex gap-2">
                  <Input
                    id="nbc-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="e.g. 255, 0xff, 0b1010, 0o17"
                    className="font-mono"
                  />
                  <Button variant="outline" size="sm" onClick={handleAutoDetect}>
                    Auto-detect
                  </Button>
                </div>
                {input && !validation.valid && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Invalid digit(s) {validation.invalidChars.join(", ")} for base {fromBase}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">From base</Label>
                  <select
                    value={fromBase}
                    onChange={(e) => setFromBase(Number(e.target.value))}
                    className="h-9 w-full text-sm rounded border bg-background px-2"
                  >
                    {BASE_PRESETS.map((p) => (
                      <option key={p.base} value={p.base}>{p.base} — {p.label}</option>
                    ))}
                    {Array.from({ length: 35 }, (_, i) => i + 2)
                      .filter((b) => !COMMON_BASES.includes(b))
                      .map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">To base</Label>
                  <select
                    value={toBase}
                    onChange={(e) => setToBase(Number(e.target.value))}
                    className="h-9 w-full text-sm rounded border bg-background px-2"
                  >
                    {BASE_PRESETS.map((p) => (
                      <option key={p.base} value={p.base}>{p.base} — {p.label}</option>
                    ))}
                    {Array.from({ length: 35 }, (_, i) => i + 2)
                      .filter((b) => !COMMON_BASES.includes(b))
                      .map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {COMMON_BASES.map((b) => (
                  <Button
                    key={b}
                    variant={toBase === b ? "default" : "ghost"}
                    size="sm"
                    className="h-6 text-[11px]"
                    onClick={() => handleQuickChip(b)}
                  >→ base {b}</Button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={signed}
                    onChange={(e) => setSigned(e.target.checked)}
                  />
                  Signed (two's complement)
                </label>
                {signed && (
                  <select
                    value={bitWidth}
                    onChange={(e) => setBitWidth(Number(e.target.value) as SignedBitWidth)}
                    className="h-7 text-xs rounded border bg-background px-2"
                  >
                    {BIT_WIDTHS.map((w) => (
                      <option key={w} value={w}>{w}-bit</option>
                    ))}
                  </select>
                )}
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupOutput}
                    onChange={(e) => setGroupOutput(e.target.checked)}
                  />
                  Group digits
                </label>
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="nbc-batch">Batch input (one per line or comma-separated)</Label>
              <Textarea
                id="nbc-batch"
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={"255\n1024\n0xff"}
                className="min-h-[100px] resize-y font-mono text-xs"
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">From base</Label>
                  <select
                    value={fromBase}
                    onChange={(e) => setFromBase(Number(e.target.value))}
                    className="h-9 w-full text-sm rounded border bg-background px-2"
                  >
                    {BASE_PRESETS.map((p) => (
                      <option key={p.base} value={p.base}>{p.base} — {p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">To base</Label>
                  <select
                    value={toBase}
                    onChange={(e) => setToBase(Number(e.target.value))}
                    className="h-9 w-full text-sm rounded border bg-background px-2"
                  >
                    {BASE_PRESETS.map((p) => (
                      <option key={p.base} value={p.base}>{p.base} — {p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {mode === "single" && singleResult && (
        <>
          {singleResult.error ? (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> {singleResult.error}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <ArrowRight className="h-4 w-4" /> Result (base {toBase})
                  </h3>
                  <div className="rounded border bg-background p-3 font-mono text-lg break-all">
                    {singleResult.value}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {singleResult.repeating && (
                      <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400">
                        repeating fractional part
                      </Badge>
                    )}
                    {singleResult.negative && (
                      <Badge variant="outline" className="text-[10px]">
                        negative input
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px]">
                      base {fromBase} → base {toBase}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <CopyButton
                      getText={() => { handleSaveHistory(); return singleResult.value; }}
                      label="Copy result"
                    />
                    <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ input, fromBase, toBase, signed, bitWidth }); }} />
                    <ClearButton onClick={handleClear} />
                  </div>
                </CardContent>
              </Card>

              {allBases && (
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Binary className="h-4 w-4" /> In all common bases
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {COMMON_BASES.map((b) => (
                        <div key={b} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                          <Badge variant="outline" className="text-[10px] w-12">{BASE_LABELS[b] ?? `b${b}`}</Badge>
                          <span className="font-mono text-foreground break-all">{allBases[String(b)] || "—"}</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                        <Badge variant="outline" className="text-[10px] w-12">Base58</Badge>
                        <span className="font-mono text-foreground break-all">{allBases["58"] || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                        <Badge variant="outline" className="text-[10px] w-12">Base64</Badge>
                        <span className="font-mono text-foreground break-all">{allBases["64"] || "—"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {expansion && expansion.terms.length > 0 && (
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Sigma className="h-4 w-4" /> Place-value expansion (base {fromBase})
                    </h3>
                    <p className="font-mono text-xs text-muted-foreground break-all">{expansion.text}</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {mode === "batch" && batchResults.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <SigmaSquare className="h-4 w-4" /> Batch results ({batchResults.length})
            </h3>
            <div className="space-y-1 max-h-[400px] overflow-auto">
              {batchResults.map((r, i) => (
                <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                  <span className="font-mono text-muted-foreground w-1/3 truncate">{r.input}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  {r.error ? (
                    <span className="text-destructive flex-1 truncate">
                      <AlertTriangle className="inline h-3 w-3 mr-1" />{r.error}
                    </span>
                  ) : (
                    <span className="font-mono text-foreground flex-1 break-all">
                      <CheckCircle2 className="inline h-3 w-3 mr-1 text-emerald-500" />
                      {r.outputs[0]?.value}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <CopyButton getText={() => batchResults.map((r) => r.error ? `${r.input}\tERROR: ${r.error}` : `${r.input}\t${r.outputs[0]?.value ?? ""}`).join("\n")} label="Copy TSV" />
              <DownloadButton getText={() => batchCsv} filename="base-conversions.csv" mime="text/csv" label="Download CSV" />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      )}

      {mode === "single" && !input.trim() && (
        <EmptyState
          title="Type a number to convert"
          hint="Pick from/to bases (2–36) or use 0x/0b/0o prefixes and click Auto-detect. BigInt precision handles values beyond 2^53."
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
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.fromBase}→{h.toBase}</Badge>
                  <span className="font-mono text-muted-foreground mr-2">{h.input}</span>
                  <ArrowRight className="inline h-3 w-3 text-muted-foreground" />
                  <span className="font-mono text-foreground ml-2 break-all">{h.result}</span>
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
            <strong className="text-foreground">Privacy:</strong> All conversions run locally with BigInt precision. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
