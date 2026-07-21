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
  History, ArrowLeftRight, AlertTriangle, Layers, Hash, Binary,
} from "lucide-react";
import {
  WORD_SIZES,
  ENDIANNESS_LABELS,
  ENDIANNESS_SHORT,
  parseHexInput,
  convertEndianness,
  batchConvert,
  groupBytes,
  formatCArray,
  buildByteCells,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type WordSize,
  type Endianness,
  type HistoryEntry,
} from "./logic";

function formatFloat(n: number | null): string {
  if (n === null) return "—";
  if (Number.isNaN(n)) return "NaN";
  if (!Number.isFinite(n)) return n > 0 ? "+Infinity" : "-Infinity";
  // Show enough digits for float64 precision
  if (Number.isInteger(n)) return n.toString();
  return n.toString();
}

function formatBytes(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

export default function EndiannessByteOrderConverter() {
  const [inputHex, setInputHex] = useState("");
  const [wordSize, setWordSize] = useState<WordSize>(32);
  const [batchMode, setBatchMode] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p) {
        if (p.inputHex) setInputHex(p.inputHex);
        setWordSize(p.wordSize);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const parsed = useMemo(() => {
    if (!inputHex.trim()) return null;
    try {
      const bytes = parseHexInput(inputHex);
      if (batchMode) {
        return { kind: "batch" as const, bytes, result: batchConvert(bytes, wordSize) };
      }
      return { kind: "single" as const, bytes, result: convertEndianness(bytes, wordSize) };
    } catch (e) {
      return { kind: "error" as const, error: e instanceof Error ? e.message : "parse error" };
    }
  }, [inputHex, wordSize, batchMode]);

  const handleSaveHistory = useCallback(() => {
    if (!parsed || parsed.kind !== "single") return;
    const r = parsed.result;
    saveHistory({
      ts: Date.now(),
      inputHex: r.input.map((b) => b.toString(16).padStart(2, "0")).join(""),
      wordSize,
      beUnsigned: r.bigEndian.asIntUnsigned,
      leUnsigned: r.littleEndian.asIntUnsigned,
    });
    setHistory(loadHistory());
  }, [parsed, wordSize]);

  const handleClear = useCallback(() => {
    setInputHex("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  // Build share state
  const shareState = useMemo(() => {
    let hex = "";
    if (parsed && parsed.kind !== "error") {
      hex = parsed.bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return { inputHex: hex, wordSize };
  }, [parsed, wordSize]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs">Word size:</Label>
            {WORD_SIZES.map((w) => (
              <Button
                key={w}
                variant={wordSize === w ? "default" : "outline"}
                size="sm"
                onClick={() => setWordSize(w)}
              >{w}-bit</Button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <Label className="text-xs">Mode:</Label>
              <Button
                variant={!batchMode ? "default" : "outline"}
                size="sm"
                onClick={() => setBatchMode(false)}
              >Single word</Button>
              <Button
                variant={batchMode ? "default" : "outline"}
                size="sm"
                onClick={() => setBatchMode(true)}
              >Batch (split bytes)</Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eboc-input">Hex bytes</Label>
            <Textarea
              id="eboc-input"
              value={inputHex}
              onChange={(e) => setInputHex(e.target.value)}
              placeholder={"e.g. 0x0A0B0C0D or 0A 0B 0C 0D or 0A:0B:0C:0D"}
              className="min-h-[60px] resize-y font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Accepts <code>0x</code> prefix, space / colon / dash / underscore / comma separators, upper or lowercase. Odd-length hex is rejected.
            </p>
          </div>
        </CardContent>
      </Card>

      {parsed && parsed.kind === "error" && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> {parsed.error}
            </p>
          </CardContent>
        </Card>
      )}

      {parsed && parsed.kind === "single" && !parsed.result.error && (
        <>
          {parsed.result.warnings.length > 0 && (
            <Card>
              <CardContent className="p-3 space-y-1">
                {parsed.result.warnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-px flex-shrink-0" /> {w}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Byte visualization */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="h-4 w-4" /> Byte layout ({parsed.result.input.length} bytes)
              </h3>
              <div className="overflow-x-auto">
                <table className="text-[11px] font-mono border-collapse">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="px-2 py-1 text-right border-b">idx</th>
                      <th className="px-2 py-1 border-b">hex</th>
                      <th className="px-2 py-1 border-b">BE role</th>
                      <th className="px-2 py-1 border-b">LE role</th>
                      <th className="px-2 py-1 border-b">PDP role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildByteCells(parsed.result.input, wordSize).map((cell) => (
                      <tr key={cell.index} className="border-b border-border/40">
                        <td className="px-2 py-1 text-right text-muted-foreground">{cell.index}</td>
                        <td className="px-2 py-1 font-bold text-foreground">{cell.hex}</td>
                        <td className="px-2 py-1">
                          <Badge variant="outline" className="text-[9px]">{cell.endianRole.be}</Badge>
                        </td>
                        <td className="px-2 py-1">
                          <Badge variant="outline" className="text-[9px]">{cell.endianRole.le}</Badge>
                        </td>
                        <td className="px-2 py-1">
                          <Badge variant="outline" className="text-[9px]">{cell.endianRole.pdp}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                B0 = least-significant byte, B{wordSize / 8 - 1} = most-significant byte. Roles show where each input byte lands when re-interpreted in each endianness.
              </p>
            </CardContent>
          </Card>

          {/* Decode results for all three endiannesses */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <DecodeCard
              title="Big-endian (BE)"
              short="BE"
              color="bg-blue-500/10"
              result={parsed.result.bigEndian}
              wordSize={wordSize}
            />
            <DecodeCard
              title="Little-endian (LE)"
              short="LE"
              color="bg-emerald-500/10"
              result={parsed.result.littleEndian}
              wordSize={wordSize}
            />
            <DecodeCard
              title="Middle-endian (PDP-11)"
              short="PDP"
              color="bg-amber-500/10"
              result={parsed.result.pdpMiddle}
              wordSize={wordSize}
            />
          </div>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return formatBytes(parsed.result.input); }}
                  label="Copy bytes"
                />
                <CopyButton getText={() => parsed.result.bigEndian.asIntUnsigned} label="Copy BE uint" />
                <CopyButton getText={() => parsed.result.littleEndian.asIntUnsigned} label="Copy LE uint" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(shareState); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          {/* C array export */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Hash className="h-4 w-4" /> C array export
              </h3>
              <pre className="rounded border bg-muted/40 p-3 text-[11px] font-mono overflow-x-auto">
{formatCArray(parsed.result.input, "data")}
              </pre>
              <CopyButton getText={() => formatCArray(parsed.result.input, "data")} label="Copy C array" />
            </CardContent>
          </Card>
        </>
      )}

      {parsed && parsed.kind === "batch" && (
        <>
          {parsed.result.warnings.length > 0 && (
            <Card>
              <CardContent className="p-3 space-y-1">
                {parsed.result.warnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-px flex-shrink-0" /> {w}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="h-4 w-4" /> Batch decode ({parsed.result.words.length} words × {wordSize}-bit)
              </h3>
              <div className="overflow-x-auto">
                <table className="text-[11px] font-mono border-collapse w-full">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="px-2 py-1 text-right border-b">#</th>
                      <th className="px-2 py-1 border-b text-left">bytes</th>
                      <th className="px-2 py-1 border-b text-right">BE unsigned</th>
                      <th className="px-2 py-1 border-b text-right">LE unsigned</th>
                      <th className="px-2 py-1 border-b text-right">PDP unsigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.result.words.map((w, i) => (
                      <tr key={i} className="border-b border-border/40">
                        <td className="px-2 py-1 text-right text-muted-foreground">{i}</td>
                        <td className="px-2 py-1">{formatBytes(w.input)}</td>
                        <td className="px-2 py-1 text-right">{w.bigEndian.asIntUnsigned}</td>
                        <td className="px-2 py-1 text-right">{w.littleEndian.asIntUnsigned}</td>
                        <td className="px-2 py-1 text-right">{w.pdpMiddle.asIntUnsigned}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!inputHex.trim() && (
        <EmptyState
          title="Paste hex bytes to convert endianness"
          hint="Enter hex bytes like 0x0A0B0C0D, choose a word size (16/32/64-bit), and instantly see the value interpreted as big-endian, little-endian and middle-endian (PDP-11) — plus signed/unsigned integer and float32/float64 decodings for each."
          icon={<ArrowLeftRight className="h-8 w-8" />}
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
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{h.wordSize}-bit</Badge>
                  <span className="font-mono text-muted-foreground">{h.inputHex.toUpperCase()}</span>
                  <ArrowLeftRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono text-foreground text-[10px]">BE={h.beUnsigned}</span>
                  <span className="font-mono text-muted-foreground text-[10px]">LE={h.leUnsigned}</span>
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All byte swaps and float decodings run locally with BigInt precision. History is stored in localStorage on this device only — your bytes never leave the browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function DecodeCard({
  title,
  short,
  color,
  result,
  wordSize,
}: {
  title: string;
  short: string;
  color: string;
  result: {
    bytes: number[];
    hex: string;
    groupedHex: string;
    asIntUnsigned: string;
    asIntSigned: string;
    asFloat32: number | null;
    asFloat64: number | null;
    float32Hex: string | null;
    float64Hex: string | null;
  };
  wordSize: WordSize;
}) {
  return (
    <Card>
      <CardContent className={`p-4 space-y-2 ${color} rounded-md`}>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px]">{short}</Badge>
          {title}
        </h3>
        <div className="space-y-1.5">
          <Row label="bytes" value={result.groupedHex} mono />
          <Row label={`uint${wordSize}`} value={result.asIntUnsigned} mono />
          <Row label={`int${wordSize}`} value={result.asIntSigned} mono />
          {result.asFloat32 !== null && (
            <>
              <Row label="float32" value={formatFloat(result.asFloat32)} mono />
              {result.float32Hex && <Row label="f32 hex" value={"0x" + result.float32Hex} mono small />}
            </>
          )}
          {result.asFloat64 !== null && (
            <>
              <Row label="float64" value={formatFloat(result.asFloat64)} mono />
              {result.float64Hex && <Row label="f64 hex" value={"0x" + result.float64Hex} mono small />}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, mono, small }: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded border bg-background px-2 py-1">
      <Badge variant="outline" className="text-[9px] w-16 justify-center">{label}</Badge>
      <span className={`break-all ${mono ? "font-mono" : ""} ${small ? "text-[10px] text-muted-foreground" : "text-xs"}`}>
        {value}
      </span>
    </div>
  );
}
