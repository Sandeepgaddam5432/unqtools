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
  binaryToGray,
  grayToBinary,
  binaryToGraySteps,
  grayToBinarySteps,
  parseInputValue,
  generateSequence,
  generateNaryGray,
  generateBalancedGray,
  buildTruthTable,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type InputBase,
  type HistoryEntry,
} from "./logic";
import { History, Binary, CheckCircle2, XCircle, Table2 } from "lucide-react";

type Tab = "convert" | "sequence" | "nary" | "balanced" | "truth";

const TABS: { id: Tab; label: string }[] = [
  { id: "convert", label: "Convert" },
  { id: "sequence", label: "Sequence" },
  { id: "nary", label: "N-ary" },
  { id: "balanced", label: "Balanced" },
  { id: "truth", label: "Truth table" },
];

export default function GrayCodeConverter() {
  const [tab, setTab] = useState<Tab>("convert");
  const [input, setInput] = useState("");
  const [base, setBase] = useState<InputBase>("decimal");
  const [width, setWidth] = useState(8);
  const [direction, setDirection] = useState<"bin2gray" | "gray2bin">("bin2gray");
  const [seqBits, setSeqBits] = useState(4);
  const [naryBase, setNaryBase] = useState(3);
  const [naryLen, setNaryLen] = useState(2);
  const [balancedBits, setBalancedBits] = useState(4);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.input) {
        setInput(p.input);
        setBase(p.base);
        setWidth(p.width);
        if (p.input) toast.info("Loaded from share link");
      }
    }
  }, []);

  const parsed = useMemo(() => parseInputValue(input, base, width), [input, base, width]);

  const convertResult = useMemo(() => {
    if (parsed.error || !input) return null;
    const v = parsed.value;
    if (direction === "bin2gray") {
      const g = binaryToGray(v);
      return {
        inputBinary: v.toString(2).padStart(width, "0"),
        outputBinary: g.toString(2).padStart(width, "0"),
        inputDecimal: String(v),
        outputDecimal: String(g),
      };
    }
    const b = grayToBinary(v);
    return {
      inputBinary: v.toString(2).padStart(width, "0"),
      outputBinary: b.toString(2).padStart(width, "0"),
      inputDecimal: String(v),
      outputDecimal: String(b),
    };
  }, [parsed, input, width, direction]);

  const steps = useMemo(() => {
    if (parsed.error || !input) return null;
    return direction === "bin2gray"
      ? binaryToGraySteps(parsed.value, width)
      : grayToBinarySteps(parsed.value, width);
  }, [parsed, input, width, direction]);

  const sequence = useMemo(() => {
    try {
      return generateSequence(seqBits);
    } catch {
      return null;
    }
  }, [seqBits]);

  const nary = useMemo(() => {
    try {
      return generateNaryGray(naryBase, naryLen);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Error" };
    }
  }, [naryBase, naryLen]);

  const balanced = useMemo(() => {
    try {
      return generateBalancedGray(balancedBits);
    } catch {
      return null;
    }
  }, [balancedBits]);

  const truthTable = useMemo(() => buildTruthTable(seqBits, false), [seqBits]);

  const handleSaveHistory = useCallback(() => {
    if (convertResult && input) {
      saveHistory({
        ts: Date.now(),
        input,
        base,
        width,
        result: convertResult.outputDecimal,
      });
      setHistory(loadHistory());
    }
  }, [convertResult, input, base, width]);

  const handleClear = useCallback(() => {
    setInput("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const csv = useMemo(() => {
    if (!sequence) return "";
    const lines = ["index,binary,gray,decimal,gray_decimal,changed_bit"];
    for (const e of sequence.entries) {
      lines.push([
        e.index,
        e.binary,
        e.gray,
        e.decimal,
        e.grayDecimal,
        e.changedBit ?? "",
      ].join(","));
    }
    return lines.join("\n");
  }, [sequence]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <Button
                key={t.id}
                size="sm"
                variant={tab === t.id ? "default" : "outline"}
                onClick={() => setTab(t.id)}
                className="h-7 text-xs"
              >
                {t.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {tab === "convert" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap gap-3">
                <div>
                  <Label className="text-xs">Input base</Label>
                  <div className="flex gap-1 mt-1">
                    <Button
                      size="sm"
                      variant={base === "decimal" ? "default" : "outline"}
                      onClick={() => setBase("decimal")}
                      className="h-7 text-xs"
                    >Decimal</Button>
                    <Button
                      size="sm"
                      variant={base === "binary" ? "default" : "outline"}
                      onClick={() => setBase("binary")}
                      className="h-7 text-xs"
                    >Binary</Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Direction</Label>
                  <div className="flex gap-1 mt-1">
                    <Button
                      size="sm"
                      variant={direction === "bin2gray" ? "default" : "outline"}
                      onClick={() => setDirection("bin2gray")}
                      className="h-7 text-xs"
                    >Binary → Gray</Button>
                    <Button
                      size="sm"
                      variant={direction === "gray2bin" ? "default" : "outline"}
                      onClick={() => setDirection("gray2bin")}
                      className="h-7 text-xs"
                    >Gray → Binary</Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Bit width</Label>
                  <Input
                    type="number"
                    min={1}
                    max={53}
                    value={width}
                    onChange={(e) => {
                      const w = parseInt(e.target.value, 10);
                      if (w >= 1 && w <= 53) setWidth(w);
                    }}
                    className="mt-1 h-7 w-20 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gcc-input">
                  {direction === "bin2gray" ? "Binary value" : "Gray value"}
                  {" ("}
                  {base}
                  {")"}
                </Label>
                <Textarea
                  id="gcc-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={base === "decimal" ? "42" : "101010"}
                  className="min-h-[60px] resize-y font-mono text-xs"
                />
                {parsed.error && (
                  <div className="text-xs text-destructive">⚠ {parsed.error}</div>
                )}
              </div>
            </CardContent>
          </Card>

          {convertResult && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Binary className="h-4 w-4" /> Result
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Input (dec)" value={convertResult.inputDecimal} />
                  <Stat label="Input (bin)" value={convertResult.inputBinary} />
                  <Stat
                    label={direction === "bin2gray" ? "Gray (dec)" : "Binary (dec)"}
                    value={convertResult.outputDecimal}
                    highlight="good"
                  />
                  <Stat
                    label={direction === "bin2gray" ? "Gray (bin)" : "Binary (bin)"}
                    value={convertResult.outputBinary}
                    highlight="good"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {steps && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Binary className="h-4 w-4" /> XOR step table
                </h3>
                <div className="overflow-x-auto">
                  <table className="text-[11px] font-mono w-full">
                    <thead>
                      <tr className="text-left">
                        <th className="px-2 py-1">pos</th>
                        <th className="px-2 py-1">
                          {direction === "bin2gray" ? "bᵢ" : "gᵢ"}
                        </th>
                        <th className="px-2 py-1">
                          {direction === "bin2gray" ? "gᵢ" : "bᵢ"}
                        </th>
                        <th className="px-2 py-1">explanation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {steps.steps.map((s, i) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="px-2 py-0.5">{s.position}</td>
                          <td className="px-2 py-0.5">
                            {direction === "bin2gray" ? s.binBit : s.grayBit}
                          </td>
                          <td className="px-2 py-0.5">
                            {direction === "bin2gray" ? s.grayBit : s.binBit}
                          </td>
                          <td className="px-2 py-0.5 text-muted-foreground">{s.explanation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {!convertResult && (
            <EmptyState
              title="Enter a value to convert"
              hint="Type a decimal or binary number, pick a bit width, and see the Gray-code conversion with XOR step working."
              icon={<Binary className="h-8 w-8" />}
            />
          )}
        </>
      )}

      {tab === "sequence" && sequence && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <Label className="text-xs">Bits (n)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={seqBits}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (n >= 1 && n <= 20) setSeqBits(n);
                    }}
                    className="mt-1 h-7 w-20 text-xs"
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {sequence.count} entries (2^{seqBits})
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat
                  label="Single-bit change"
                  value={sequence.singleBitChange ? "yes ✓" : "no ✗"}
                  highlight={sequence.singleBitChange ? "good" : "bad"}
                />
                <Stat
                  label="Wrap single-bit"
                  value={sequence.wrapSingleBitChange ? "yes ✓" : "no ✗"}
                  highlight={sequence.wrapSingleBitChange ? "good" : "bad"}
                />
                <Stat label="Balanced" value={sequence.balanced ? "yes ✓" : "no"} />
                <Stat label="Toggles (max/min)" value={`${sequence.maxToggle}/${sequence.minToggle}`} />
              </div>
              <div className="flex flex-wrap gap-1 text-[10px]">
                {sequence.toggleCounts.map((c, i) => (
                  <Badge key={i} variant="outline" className="text-[10px]">
                    bit {i}: {c}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Binary className="h-4 w-4" /> Sequence ({sequence.count})
              </h3>
              <div className="overflow-auto max-h-[400px]">
                <table className="text-[11px] font-mono w-full">
                  <thead className="sticky top-0 bg-background">
                    <tr className="text-left">
                      <th className="px-2 py-1">#</th>
                      <th className="px-2 py-1">binary</th>
                      <th className="px-2 py-1">Gray</th>
                      <th className="px-2 py-1">dec</th>
                      <th className="px-2 py-1">gray dec</th>
                      <th className="px-2 py-1">changed bit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sequence.entries.map((e) => (
                      <tr key={e.index} className="border-t border-border/50">
                        <td className="px-2 py-0.5 text-muted-foreground">{e.index}</td>
                        <td className="px-2 py-0.5">{e.binary}</td>
                        <td className="px-2 py-0.5 text-foreground font-semibold">{e.gray}</td>
                        <td className="px-2 py-0.5">{e.decimal}</td>
                        <td className="px-2 py-0.5">{e.grayDecimal}</td>
                        <td className="px-2 py-0.5">
                          {e.changedBit !== null ? (
                            <Badge variant="outline" className="text-[10px]">
                              bit {e.changedBit}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => { handleSaveHistory(); return csv; }} label="Copy CSV" />
                <DownloadButton getText={() => csv} filename={`gray-sequence-n${seqBits}.csv`} mime="text/csv" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input, base, width); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {tab === "nary" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <Label className="text-xs">Base (r)</Label>
                <Input
                  type="number"
                  min={2}
                  max={10}
                  value={naryBase}
                  onChange={(e) => {
                    const r = parseInt(e.target.value, 10);
                    if (r >= 2 && r <= 10) setNaryBase(r);
                  }}
                  className="mt-1 h-7 w-20 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Length (n)</Label>
                <Input
                  type="number"
                  min={1}
                  max={6}
                  value={naryLen}
                  onChange={(e) => {
                    const l = parseInt(e.target.value, 10);
                    if (l >= 1 && l <= 6) setNaryLen(l);
                  }}
                  className="mt-1 h-7 w-20 text-xs"
                />
              </div>
            </div>
            {"error" in nary ? (
              <div className="text-xs text-destructive">⚠ {nary.error}</div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <Stat label="Entries" value={nary.count} />
                  <Stat label="Single-digit change" value={nary.singleDigitChange ? "yes ✓" : "no ✗"} />
                  <Stat label="Base / length" value={`${nary.base} / ${nary.length}`} />
                </div>
                <div className="overflow-auto max-h-[400px]">
                  <table className="text-[11px] font-mono w-full">
                    <thead className="sticky top-0 bg-background">
                      <tr className="text-left">
                        <th className="px-2 py-1">#</th>
                        <th className="px-2 py-1">digits</th>
                        <th className="px-2 py-1">changed pos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nary.entries.map((e) => (
                        <tr key={e.index} className="border-t border-border/50">
                          <td className="px-2 py-0.5 text-muted-foreground">{e.index}</td>
                          <td className="px-2 py-0.5">{e.digits.join("")}</td>
                          <td className="px-2 py-0.5">
                            {e.changedPosition !== null ? (
                              <Badge variant="outline" className="text-[10px]">pos {e.changedPosition}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "balanced" && balanced && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <Label className="text-xs">Bits (n)</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={balancedBits}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (n >= 1 && n <= 20) setBalancedBits(n);
                  }}
                  className="mt-1 h-7 w-20 text-xs"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {balanced.count} entries
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat
                label="Balanced"
                value={balanced.balanced ? "yes ✓" : "no"}
                highlight={balanced.balanced ? "good" : undefined}
              />
              <Stat label="Single-bit change" value={balanced.singleBitChange ? "yes ✓" : "no ✗"} />
              <Stat label="Wrap single-bit" value={balanced.wrapSingleBitChange ? "yes ✓" : "no ✗"} />
              <Stat label="Toggles (max/min)" value={`${balanced.maxToggle}/${balanced.minToggle}`} />
            </div>
            <div className="flex flex-wrap gap-1 text-[10px]">
              {balanced.toggleCounts.map((c, i) => (
                <Badge key={i} variant="outline" className="text-[10px]">
                  bit {i}: {c}
                </Badge>
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Perfect balance is achievable when 2ⁿ/n is an even integer
              (n = 1, 2, 4, 8, …). For n = 4 the backtracking search finds a
              cycle where every bit toggles exactly 4 times.
            </div>
            <div className="overflow-auto max-h-[400px]">
              <table className="text-[11px] font-mono w-full">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-left">
                    <th className="px-2 py-1">#</th>
                    <th className="px-2 py-1">binary</th>
                    <th className="px-2 py-1">Gray</th>
                    <th className="px-2 py-1">changed bit</th>
                  </tr>
                </thead>
                <tbody>
                  {balanced.entries.map((e) => (
                    <tr key={e.index} className="border-t border-border/50">
                      <td className="px-2 py-0.5 text-muted-foreground">{e.index}</td>
                      <td className="px-2 py-0.5">{e.binary}</td>
                      <td className="px-2 py-0.5 text-foreground font-semibold">{e.gray}</td>
                      <td className="px-2 py-0.5">
                        {e.changedBit !== null ? (
                          <Badge variant="outline" className="text-[10px]">bit {e.changedBit}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "truth" && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Table2 className="h-4 w-4" /> Truth table (n={seqBits})
            </h3>
            <div className="overflow-auto max-h-[500px]">
              <table className="text-[11px] font-mono w-full">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-left">
                    <th className="px-2 py-1">#</th>
                    <th className="px-2 py-1">binary</th>
                    <th className="px-2 py-1">Gray</th>
                    <th className="px-2 py-1">changed bit</th>
                  </tr>
                </thead>
                <tbody>
                  {truthTable.rows.map((r) => (
                    <tr key={r.index} className="border-t border-border/50">
                      <td className="px-2 py-0.5 text-muted-foreground">{r.index}</td>
                      <td className="px-2 py-0.5">{r.binary}</td>
                      <td className="px-2 py-0.5 text-foreground font-semibold">{r.gray}</td>
                      <td className="px-2 py-0.5">
                        {r.changedBit !== null ? (
                          <Badge variant="outline" className="text-[10px]">bit {r.changedBit}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  onClick={() => {
                    setInput(h.input);
                    setBase(h.base);
                    setWidth(h.width);
                    setTab("convert");
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-accent"
                >
                  <Badge variant="outline" className="mr-2">{h.base}</Badge>
                  <Badge variant="outline" className="mr-2">{h.width}b</Badge>
                  <span className="font-mono text-muted-foreground">
                    {h.input} → {h.result}
                  </span>
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
            <strong className="text-foreground">Privacy:</strong> All conversion & sequence generation runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "good" | "bad";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold font-mono ${color}`}>{value}</div>
    </div>
  );
}

// Suppress unused-import lint for icons not yet referenced in JSX.
void CheckCircle2;
void XCircle;
