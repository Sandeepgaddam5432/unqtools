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
  parseInput,
  computeAll,
  computeSum,
  computeScheme,
  verifyValue,
  renderParityWorking,
  renderChecksumWorking,
  formatHex,
  formatBinary,
  byteToBinary,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  SCHEME_LABELS,
  type InputFormat,
  type SumWidth,
  type SumVariant,
  type Endianness,
  type CheckScheme,
  type HistoryEntry,
} from "./logic";
import { History, ShieldCheck, CheckCircle2, XCircle, Cpu } from "lucide-react";

const FORMATS: { value: InputFormat; label: string }[] = [
  { value: "ascii", label: "ASCII" },
  { value: "hex", label: "Hex" },
  { value: "binary", label: "Binary" },
];

const SUM_VARIANTS: { value: SumVariant; label: string }[] = [
  { value: "raw", label: "Raw sum" },
  { value: "ones-complement", label: "One's complement" },
  { value: "twos-complement", label: "Two's complement" },
  { value: "internet", label: "Internet (RFC 1071, 16-bit only)" },
];

const ENDIANNESS: { value: Endianness; label: string }[] = [
  { value: "big", label: "Big-endian" },
  { value: "little", label: "Little-endian" },
];

const SCHEMES: CheckScheme[] = [
  "lrc", "xor", "sum8", "sum16", "sum32",
  "ones8", "ones16", "ones32",
  "twos8", "twos16", "twos32",
  "internet", "fletcher16", "fletcher32", "adler32",
  "crc8", "crc16", "crc32",
];

export default function ChecksumParityBitCalculator() {
  const [input, setInput] = useState("");
  const [format, setFormat] = useState<InputFormat>("ascii");
  const [sumWidth, setSumWidth] = useState<SumWidth>(16);
  const [sumVariant, setSumVariant] = useState<SumVariant>("raw");
  const [endianness, setEndianness] = useState<Endianness>("big");
  const [verifyScheme, setVerifyScheme] = useState<CheckScheme>("crc32");
  const [verifyExpected, setVerifyExpected] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.input) {
        setInput(p.input);
        setFormat(p.format);
        if (p.input) toast.info("Loaded from share link");
      }
    }
  }, []);

  const bytes = useMemo(() => {
    if (!input) return [];
    try {
      const b = parseInput(input, format);
      queueMicrotask(() => setParseError(null));
      return b;
    } catch (e) {
      queueMicrotask(() => setParseError(e instanceof Error ? e.message : "Parse error"));
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, format]);

  const results = useMemo(() => (bytes.length > 0 ? computeAll(bytes) : null), [bytes]);
  const sumResult = useMemo(
    () => (bytes.length > 0 ? computeSum(bytes, sumWidth, sumVariant, endianness) : null),
    [bytes, sumWidth, sumVariant, endianness],
  );

  const verifyResult = useMemo(() => {
    if (bytes.length === 0 || !verifyExpected) return null;
    const expectedNum = parseInt(verifyExpected.replace(/^0x/i, ""), 16);
    if (Number.isNaN(expectedNum)) return null;
    const ok = verifyValue(bytes, verifyScheme, expectedNum);
    return { ok, expected: expectedNum, actual: computeScheme(bytes, verifyScheme).value };
  }, [bytes, verifyExpected, verifyScheme]);

  const handleSaveHistory = useCallback(() => {
    if (bytes.length > 0 && results) {
      saveHistory({
        ts: Date.now(),
        input,
        format,
        byteCount: bytes.length,
        crc32: results.crc32,
      });
      setHistory(loadHistory());
    }
  }, [bytes, results, input, format]);

  const handleClear = useCallback(() => {
    setInput("");
    setVerifyExpected("");
    setParseError(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const csv = useMemo(() => {
    if (!results) return "";
    const lines = [
      "scheme,value (dec),value (hex)",
      `lrc,${results.lrc},${formatHex(results.lrc, 8)}`,
      `xor,${results.xor},${formatHex(results.xor, 8)}`,
      `sum8,${results.sum8.value},${results.sum8.hex}`,
      `sum16,${results.sum16.value},${results.sum16.hex}`,
      `sum32,${results.sum32.value},${results.sum32.hex}`,
      `internet,${results.internet},${formatHex(results.internet, 16)}`,
      `fletcher16,${results.fletcher16},${formatHex(results.fletcher16, 16)}`,
      `fletcher32,${results.fletcher32},${formatHex(results.fletcher32, 32)}`,
      `adler32,${results.adler32},${formatHex(results.adler32, 32)}`,
      `crc8,${results.crc8},${formatHex(results.crc8, 8)}`,
      `crc16,${results.crc16},${formatHex(results.crc16, 16)}`,
      `crc32,${results.crc32},${formatHex(results.crc32, 32)}`,
    ];
    return lines.join("\n");
  }, [results]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Label className="text-xs">Input format:</Label>
            {FORMATS.map((f) => (
              <Button
                key={f.value}
                size="sm"
                variant={format === f.value ? "default" : "outline"}
                onClick={() => setFormat(f.value)}
                className="h-7 text-xs"
              >
                {f.label}
              </Button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpc-input">Data input</Label>
            <Textarea
              id="cpc-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                format === "ascii" ? "Hello, world!"
                  : format === "hex" ? "DE AD BE EF"
                    : "01001000 01101001"
              }
              className="min-h-[80px] resize-y font-mono text-xs"
            />
            <div className="text-[11px] text-muted-foreground">
              {bytes.length} bytes · {bytes.length * 8} bits
              {parseError && <span className="text-destructive ml-2">⚠ {parseError}</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {results && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> Checksums
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <ChecksumCard label="LRC (XOR)" value={results.lrc} width={8} />
                <ChecksumCard label="XOR" value={results.xor} width={8} />
                <ChecksumCard label="Sum 8-bit (raw)" value={results.sum8.value} width={8} />
                <ChecksumCard label="Sum 16-bit (raw)" value={results.sum16.value} width={16} />
                <ChecksumCard label="Sum 32-bit (raw)" value={results.sum32.value} width={32} />
                <ChecksumCard label="Internet (RFC 1071)" value={results.internet} width={16} />
                <ChecksumCard label="Fletcher-16" value={results.fletcher16} width={16} />
                <ChecksumCard label="Fletcher-32" value={results.fletcher32} width={32} />
                <ChecksumCard label="Adler-32" value={results.adler32} width={32} />
                <ChecksumCard label="CRC-8 (SMBUS)" value={results.crc8} width={8} />
                <ChecksumCard label="CRC-16 (ARC)" value={results.crc16} width={16} />
                <ChecksumCard label="CRC-32 (ISO-HDLC)" value={results.crc32} width={32} highlight />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Cpu className="h-4 w-4" /> Check digits
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <CheckDigitCard
                  label="Luhn (credit cards / IMEI)"
                  checkDigit={results.luhnValid ? "valid ✓" : `append ${results.luhnCheckDigit}`}
                  valid={results.luhnValid}
                />
                <CheckDigitCard
                  label="Verhoeff (Aadhaar-style)"
                  checkDigit={results.verhoeffValid ? "valid ✓" : `append ${results.verhoeffCheckDigit}`}
                  valid={results.verhoeffValid}
                />
                <CheckDigitCard
                  label="ISBN-10"
                  checkDigit={results.isbn10Valid ? "valid ✓" : `append ${results.isbn10CheckDigit}`}
                  valid={results.isbn10Valid}
                />
                <CheckDigitCard
                  label="ISBN-13"
                  checkDigit={results.isbn13Valid ? "valid ✓" : `append ${results.isbn13CheckDigit}`}
                  valid={results.isbn13Valid}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Cpu className="h-4 w-4" /> Parity
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Aggregate 1-bits" value={results.parity.aggregatePopcount} />
                <Stat label="Even parity" value={results.parity.aggregateEven} />
                <Stat label="Odd parity" value={results.parity.aggregateOdd} />
                <Stat label="Mark / Space" value="1 / 0" />
              </div>
              <div className="overflow-x-auto max-h-[300px] overflow-auto">
                <table className="text-[11px] font-mono w-full">
                  <thead className="sticky top-0 bg-background">
                    <tr className="text-left">
                      <th className="px-2 py-1">#</th>
                      <th className="px-2 py-1">byte</th>
                      <th className="px-2 py-1">binary</th>
                      <th className="px-2 py-1">1s</th>
                      <th className="px-2 py-1">even</th>
                      <th className="px-2 py-1">odd</th>
                      <th className="px-2 py-1">mark</th>
                      <th className="px-2 py-1">space</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.parity.perByte.slice(0, 64).map((p, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="px-2 py-0.5 text-muted-foreground">{i}</td>
                        <td className="px-2 py-0.5">0x{p.byte.toString(16).padStart(2, "0").toUpperCase()}</td>
                        <td className="px-2 py-0.5">{p.binary}</td>
                        <td className="px-2 py-0.5">{p.popcount}</td>
                        <td className="px-2 py-0.5">{p.even}</td>
                        <td className="px-2 py-0.5">{p.odd}</td>
                        <td className="px-2 py-0.5">{p.mark}</td>
                        <td className="px-2 py-0.5">{p.space}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {results.parity.perByte.length > 64 && (
                  <div className="text-[11px] text-muted-foreground p-2">
                    Showing first 64 of {results.parity.perByte.length} bytes.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Cpu className="h-4 w-4" /> Configurable sum checksum
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Width</Label>
                  <select
                    value={sumWidth}
                    onChange={(e) => setSumWidth(parseInt(e.target.value, 10) as SumWidth)}
                    className="mt-1 w-full h-8 text-xs rounded border bg-background px-2"
                  >
                    <option value={8}>8-bit</option>
                    <option value={16}>16-bit</option>
                    <option value={32}>32-bit</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Variant</Label>
                  <select
                    value={sumVariant}
                    onChange={(e) => setSumVariant(e.target.value as SumVariant)}
                    className="mt-1 w-full h-8 text-xs rounded border bg-background px-2"
                    disabled={sumWidth !== 16 && sumVariant === "internet"}
                  >
                    {SUM_VARIANTS.map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Endianness</Label>
                  <select
                    value={endianness}
                    onChange={(e) => setEndianness(e.target.value as Endianness)}
                    className="mt-1 w-full h-8 text-xs rounded border bg-background px-2"
                  >
                    {ENDIANNESS.map((e) => (
                      <option key={e.value} value={e.value}>{e.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {sumResult && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Raw sum" value={sumResult.raw} />
                  <Stat label="Value" value={sumResult.value} />
                  <Stat label="Hex" value={`0x${sumResult.hex}`} />
                  <Stat label="Binary" value={sumResult.binary} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> Verify mode
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Scheme</Label>
                  <select
                    value={verifyScheme}
                    onChange={(e) => setVerifyScheme(e.target.value as CheckScheme)}
                    className="mt-1 w-full h-8 text-xs rounded border bg-background px-2"
                  >
                    {SCHEMES.map((s) => (
                      <option key={s} value={s}>{SCHEME_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Expected value (hex)</Label>
                  <Input
                    value={verifyExpected}
                    onChange={(e) => setVerifyExpected(e.target.value)}
                    placeholder="0x..."
                    className="mt-1 h-8 font-mono text-xs"
                  />
                </div>
              </div>
              {verifyResult && (
                <div
                  className={`flex items-center gap-2 rounded border px-3 py-2 text-xs ${
                    verifyResult.ok
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-destructive/30 bg-destructive/10 text-destructive"
                  }`}
                >
                  {verifyResult.ok ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <span>
                    Expected 0x{verifyResult.expected.toString(16).toUpperCase()}
                    {" — actual 0x"}
                    {verifyResult.actual.toString(16).toUpperCase()}
                    {" — "}
                    {verifyResult.ok ? "MATCH" : "MISMATCH"}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Cpu className="h-4 w-4" /> Bit-level working
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <pre className="text-[10px] font-mono whitespace-pre-wrap rounded border bg-background p-3 overflow-auto max-h-[260px]">
                  {renderParityWorking(bytes)}
                </pre>
                <pre className="text-[10px] font-mono whitespace-pre-wrap rounded border bg-background p-3 overflow-auto max-h-[260px]">
                  {renderChecksumWorking(bytes, "crc32")}
                  {"\n\n"}
                  {renderChecksumWorking(bytes, "adler32")}
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return csv; }}
                  label="Copy CSV summary"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="checksum-summary.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input, format); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!results && (
        <EmptyState
          title="Enter data to compute parity & checksums"
          hint="Pick ASCII, hex, or binary input. Parity, LRC, sum/Fletcher/Adler/CRC, Luhn, Verhoeff, and ISBN check digits all compute live."
          icon={<ShieldCheck className="h-8 w-8" />}
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
                <button
                  key={i}
                  onClick={() => { setInput(h.input); setFormat(h.format); }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-accent"
                >
                  <Badge variant="outline" className="mr-2">{h.format}</Badge>
                  <Badge variant="outline" className="mr-2">{h.byteCount}B</Badge>
                  <span className="font-mono text-muted-foreground">
                    CRC-32: 0x{h.crc32.toString(16).toUpperCase().padStart(8, "0")}
                  </span>
                  <span className="text-muted-foreground ml-2 truncate">{h.input.slice(0, 60)}</span>
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
            <strong className="text-foreground">Privacy:</strong> All checksum & parity computation runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ChecksumCard({
  label,
  value,
  width,
  highlight,
}: {
  label: string;
  value: number;
  width: 8 | 16 | 32;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded border px-3 py-2 ${highlight ? "border-primary/40 bg-primary/5" : "bg-background"}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold text-foreground">
        0x{formatHex(value, width)}
      </div>
      <div className="font-mono text-[10px] text-muted-foreground">{value}</div>
    </div>
  );
}

function CheckDigitCard({
  label,
  checkDigit,
  valid,
}: {
  label: string;
  checkDigit: string;
  valid: boolean;
}) {
  return (
    <div className={`rounded border px-3 py-2 ${valid ? "border-emerald-500/30 bg-emerald-500/5" : "bg-background"}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold text-foreground flex items-center gap-1.5">
        {checkDigit}
        {valid && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground font-mono">{value}</div>
    </div>
  );
}

// Suppress unused-import lint for formatBinary / byteToBinary (used in exports above).
void formatBinary;
void byteToBinary;
