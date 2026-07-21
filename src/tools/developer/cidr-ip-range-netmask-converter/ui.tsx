"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  convertCidr,
  convertMask,
  convertRange,
  parseBatch,
  convertBatch,
  buildIpv4MaskTable,
  buildIpv6MaskTable,
  renderConvertCsv,
  renderBatchCsv,
  renderMaskTableCsv,
  renderJson,
  detectFamily,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ToolMode,
  type IpFamily,
  type HistoryEntry,
  type ConvertResult,
  type MaskEquivalenceRow,
} from "./logic";
import { History, Network, ArrowLeftRight, List, BookOpen, AlertTriangle, CheckCircle2 } from "lucide-react";

const TABS: { id: ToolMode; label: string; icon: typeof Network }[] = [
  { id: "convert", label: "Convert", icon: Network },
  { id: "range", label: "Range → CIDR", icon: ArrowLeftRight },
  { id: "batch", label: "Batch", icon: List },
  { id: "reference", label: "Reference", icon: BookOpen },
];

export default function CidrIpRangeNetmaskConverter() {
  const [mode, setMode] = useState<ToolMode>("convert");
  const [family, setFamily] = useState<IpFamily>("ipv4");
  const [input, setInput] = useState("192.168.1.0/24");
  const [batchInput, setBatchInput] = useState("192.168.1.0/24\n10.0.0.0 - 10.0.0.5\n2001:db8::/32");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setMode(p.mode);
      setFamily(p.family);
      setInput(p.input);
      if (p.batch) setBatchInput(p.batch);
      toast.info("Loaded from share link");
    }
  }, []);

  // ---- Convert result ----
  const convertResult = useMemo<ConvertResult | null>(() => {
    if (mode !== "convert") return null;
    // Auto-detect family from input (unless the input has no family markers).
    const detected = detectFamily(input);
    const fam = detected !== family ? detected : family;
    // If input looks like a mask (dotted with 4 octets and no slash), use mask conversion.
    const trimmed = input.trim();
    if (fam === "ipv4" && !trimmed.includes("/") && /^\d+\.\d+\.\d+\.\d+$/.test(trimmed)) {
      // Could be a mask. Try mask conversion; if it fails, fall through to CIDR.
      const r = convertMask(trimmed, "ipv4");
      if (!r.error) return r;
    }
    if (fam === "ipv6" && !trimmed.includes("/") && trimmed.includes(":")) {
      const r = convertMask(trimmed, "ipv6");
      if (!r.error) return r;
    }
    const r = convertCidr(trimmed);
    return r;
  }, [mode, input, family]);

  // ---- Range → CIDR result ----
  const rangeResult = useMemo<{ results: ConvertResult[]; error?: string } | null>(() => {
    if (mode !== "range") return null;
    return convertRange(input);
  }, [mode, input]);

  // ---- Batch result ----
  const batchResult = useMemo(() => {
    if (mode !== "batch") return null;
    const lines = parseBatch(batchInput);
    return convertBatch(lines);
  }, [mode, batchInput]);

  const maskTable = useMemo<MaskEquivalenceRow[]>(
    () => (family === "ipv4" ? buildIpv4MaskTable() : buildIpv6MaskTable()),
    [family],
  );

  const handleSaveHistory = useCallback(
    (summary: string) => {
      saveHistory({ ts: Date.now(), mode, input, summary });
      setHistory(loadHistory());
    },
    [mode, input],
  );

  const handleClear = useCallback(() => {
    setInput(family === "ipv4" ? "192.168.1.0/24" : "2001:db8::/32");
    setBatchInput("192.168.1.0/24\n10.0.0.0 - 10.0.0.5\n2001:db8::/32");
    toast.info("Reset to defaults");
  }, [family]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const csvOutput = useMemo(() => {
    if (mode === "convert" && convertResult && !convertResult.error) return renderConvertCsv(convertResult);
    if (mode === "range" && rangeResult && rangeResult.results.length > 0) {
      return rangeResult.results.map((r) => renderConvertCsv(r)).join("\n\n");
    }
    if (mode === "batch" && batchResult) return renderBatchCsv(batchResult);
    if (mode === "reference") return renderMaskTableCsv(maskTable);
    return "";
  }, [mode, convertResult, rangeResult, batchResult, maskTable]);

  const jsonOutput = useMemo(() => {
    if (mode === "convert" && convertResult && !convertResult.error) return renderJson(convertResult);
    if (mode === "range" && rangeResult) return renderJson(rangeResult);
    if (mode === "batch" && batchResult) return renderJson(batchResult);
    return "";
  }, [mode, convertResult, rangeResult, batchResult]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Mode tabs */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <Button
                  key={t.id}
                  size="sm"
                  variant={mode === t.id ? "default" : "outline"}
                  onClick={() => setMode(t.id)}
                  className="h-8 text-xs gap-1.5"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Input */}
      {mode !== "reference" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            {mode === "batch" ? (
              <div className="space-y-1">
                <Label htmlFor="cidr-batch" className="text-xs">
                  Batch input (one CIDR, range, or IP per line; # for comments)
                </Label>
                <Textarea
                  id="cidr-batch"
                  value={batchInput}
                  onChange={(e) => setBatchInput(e.target.value)}
                  placeholder={"192.168.1.0/24\n10.0.0.0 - 10.0.0.5\n2001:db8::/32"}
                  className="min-h-[120px] resize-y font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Family is auto-detected per line. Bare IPs are treated as /32 (IPv4) or /128 (IPv6).
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="cidr-input" className="text-xs">
                    {mode === "convert" ? "CIDR / mask / IP" : "Range (start – end)"}
                  </Label>
                  <Input
                    id="cidr-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={mode === "convert" ? "192.168.1.0/24 or 255.255.255.0" : "192.168.100.0 - 192.168.103.255"}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Family</Label>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={family === "ipv4" ? "default" : "outline"}
                      onClick={() => setFamily("ipv4")}
                      className="h-8 text-xs"
                    >IPv4</Button>
                    <Button
                      size="sm"
                      variant={family === "ipv6" ? "default" : "outline"}
                      onClick={() => setFamily("ipv6")}
                      className="h-8 text-xs"
                    >IPv6</Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Convert result */}
      {mode === "convert" && convertResult && (
        <Card>
          <CardContent className="p-4 space-y-3">
            {convertResult.error ? (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" /> {convertResult.error}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Conversion result
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] uppercase">{convertResult.family}</Badge>
                    <Badge variant="secondary" className="text-[10px] font-mono">/{convertResult.cidrInt}</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <Stat label="CIDR" value={convertResult.cidr} mono />
                  <Stat label="Network" value={convertResult.network} mono />
                  <Stat label="First address" value={convertResult.first} mono />
                  <Stat label="Last address" value={convertResult.last} mono />
                  <Stat label="Netmask" value={convertResult.mask} mono />
                  <Stat label="Wildcard" value={convertResult.wildcard} mono />
                  <Stat label="Host count" value={formatBig(convertResult.hostCount)} mono />
                  <Stat label="Total addresses" value={formatBig(convertResult.totalAddresses)} mono />
                </div>
              </>
            )}
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => convertResult.cidr} label="Copy CIDR" disabled={!!convertResult.error} />
              <CopyButton getText={() => `${convertResult.first} - ${convertResult.last}`} label="Copy range" disabled={!!convertResult.error} />
              <CopyButton getText={() => convertResult.mask} label="Copy mask" disabled={!!convertResult.error} />
              <CopyButton getText={() => convertResult.wildcard} label="Copy wildcard" disabled={!!convertResult.error} />
              <DownloadButton
                getText={() => csvOutput}
                filename={`cidr-convert-${convertResult.cidrInt}.csv`}
                label="Download CSV"
                disabled={!csvOutput}
              />
              <DownloadButton
                getText={() => jsonOutput}
                filename={`cidr-convert-${convertResult.cidrInt}.json`}
                label="Download JSON"
                mime="application/json"
                disabled={!jsonOutput}
              />
              <ShareButton
                getUrl={() => {
                  handleSaveHistory(`/${convertResult.cidrInt} ${convertResult.family}`);
                  return buildShareUrl("convert", convertResult.family, input);
                }}
                disabled={!!convertResult.error}
              />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Range → CIDR result */}
      {mode === "range" && rangeResult && (
        <Card>
          <CardContent className="p-4 space-y-3">
            {rangeResult.error ? (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" /> {rangeResult.error}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <ArrowLeftRight className="h-4 w-4" /> Range → minimal CIDR set
                  </h3>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {rangeResult.results.length} block{rangeResult.results.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  {rangeResult.results.map((r, i) => (
                    <div key={i} className="rounded border bg-background px-2 py-1.5 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] font-mono">#{i + 1}</Badge>
                        <span className="font-mono font-semibold">{r.cidr}</span>
                        <span className="text-muted-foreground font-mono">{r.first} – {r.last}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="flex flex-wrap gap-2">
              <CopyButton
                getText={() => rangeResult.results.map((r) => r.cidr).join("\n")}
                label="Copy CIDR list"
                disabled={!!rangeResult.error || rangeResult.results.length === 0}
              />
              <DownloadButton
                getText={() => csvOutput}
                filename="cidr-range.csv"
                label="Download CSV"
                disabled={!csvOutput}
              />
              <DownloadButton
                getText={() => jsonOutput}
                filename="cidr-range.json"
                label="Download JSON"
                mime="application/json"
                disabled={!jsonOutput}
              />
              <ShareButton
                getUrl={() => {
                  handleSaveHistory(`${rangeResult.results.length} blocks`);
                  return buildShareUrl("range", family, input);
                }}
                disabled={!!rangeResult.error}
              />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Batch result */}
      {mode === "batch" && batchResult && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <List className="h-4 w-4" /> Batch result
              </h3>
              <div className="flex gap-1.5">
                <Badge variant="secondary" className="text-[10px]">{batchResult.okCount} OK</Badge>
                {batchResult.errCount > 0 && (
                  <Badge variant="destructive" className="text-[10px]">{batchResult.errCount} errors</Badge>
                )}
              </div>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="p-1.5">#</th>
                    <th className="p-1.5">Input</th>
                    <th className="p-1.5">CIDR</th>
                    <th className="p-1.5">Family</th>
                    <th className="p-1.5">Range</th>
                    <th className="p-1.5">Mask</th>
                    <th className="p-1.5">Wildcard</th>
                    <th className="p-1.5">Hosts</th>
                    <th className="p-1.5">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {batchResult.results.map((r, i) => (
                    <tr key={i} className={`border-b hover:bg-muted/30 ${r.ok ? "" : "bg-destructive/5"}`}>
                      <td className="p-1.5 font-mono text-muted-foreground">{r.index}</td>
                      <td className="p-1.5 font-mono text-muted-foreground truncate max-w-[180px]">{r.line}</td>
                      {r.ok && r.result ? (
                        <>
                          <td className="p-1.5 font-mono font-semibold">{r.result.cidr}</td>
                          <td className="p-1.5"><Badge variant="outline" className="text-[10px] uppercase">{r.result.family}</Badge></td>
                          <td className="p-1.5 font-mono text-muted-foreground text-[10px]">{r.result.first} – {r.result.last}</td>
                          <td className="p-1.5 font-mono text-muted-foreground">{r.result.mask}</td>
                          <td className="p-1.5 font-mono text-muted-foreground">{r.result.wildcard}</td>
                          <td className="p-1.5 font-mono text-muted-foreground">{formatBig(r.result.hostCount)}</td>
                          <td className="p-1.5 font-mono text-muted-foreground">{formatBig(r.result.totalAddresses)}</td>
                        </>
                      ) : (
                        <td colSpan={7} className="p-1.5 text-destructive text-[10px]">{r.error}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton
                getText={() => batchResult.cidrList.join("\n")}
                label="Copy CIDR list"
                disabled={batchResult.cidrList.length === 0}
              />
              <DownloadButton
                getText={() => csvOutput}
                filename="cidr-batch.csv"
                label="Download CSV"
                disabled={!csvOutput}
              />
              <DownloadButton
                getText={() => jsonOutput}
                filename="cidr-batch.json"
                label="Download JSON"
                mime="application/json"
                disabled={!jsonOutput}
              />
              <ShareButton
                getUrl={() => {
                  handleSaveHistory(`${batchResult.okCount} ok`);
                  return buildShareUrl("batch", family, input, { batch: batchInput });
                }}
              />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reference table */}
      {mode === "reference" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> Netmask equivalence — {family.toUpperCase()}
              </h3>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={family === "ipv4" ? "default" : "outline"}
                  onClick={() => setFamily("ipv4")}
                  className="h-8 text-xs"
                >IPv4</Button>
                <Button
                  size="sm"
                  variant={family === "ipv6" ? "default" : "outline"}
                  onClick={() => setFamily("ipv6")}
                  className="h-8 text-xs"
                >IPv6</Button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="p-1.5">CIDR</th>
                    <th className="p-1.5">Mask</th>
                    <th className="p-1.5">Wildcard</th>
                    <th className="p-1.5">Hosts</th>
                    <th className="p-1.5">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {maskTable.map((r) => (
                    <tr key={r.cidr} className="border-b hover:bg-muted/30">
                      <td className="p-1.5 font-mono font-semibold">/{r.cidr}</td>
                      <td className="p-1.5 font-mono text-muted-foreground">{r.mask}</td>
                      <td className="p-1.5 font-mono text-muted-foreground">{r.wildcard}</td>
                      <td className="p-1.5 font-mono text-muted-foreground">{formatBig(r.hostCount)}</td>
                      <td className="p-1.5 font-mono text-muted-foreground">{formatBig(r.totalAddresses)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              <DownloadButton
                getText={() => csvOutput || renderMaskTableCsv(maskTable)}
                filename={`netmask-equivalence-${family}.csv`}
                label="Download CSV"
              />
              <ShareButton getUrl={() => buildShareUrl("reference", family, "")} />
            </div>
          </CardContent>
        </Card>
      )}

      {mode !== "reference" && !convertResult && !rangeResult && !batchResult && (
        <EmptyState
          title="Enter a CIDR, range, or mask"
          hint="Switch tabs for range → CIDR decomposition, batch conversion, or the netmask equivalence reference."
          icon={<Network className="h-8 w-8" />}
        />
      )}

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-2 py-1.5 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{h.mode}</Badge>
                    <span className="font-mono text-muted-foreground truncate flex-1">{h.input}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <div className="text-[10px] text-foreground mt-0.5">{h.summary}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All conversions run locally in your browser (32-bit math for IPv4, BigInt for IPv6). History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold text-foreground ${mono ? "font-mono break-all" : ""}`}>{value}</div>
    </div>
  );
}

/** Format a BigInt-as-string with thin spaces every 3 digits for readability. */
function formatBig(s: string): string {
  if (!s) return "0";
  const neg = s.startsWith("-");
  const digits = neg ? s.slice(1) : s;
  const withSep = digits.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
  return neg ? `-${withSep}` : withSep;
}
