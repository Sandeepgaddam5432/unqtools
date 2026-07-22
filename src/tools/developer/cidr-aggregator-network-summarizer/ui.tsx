"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  aggregate,
  allCidrs,
  cidrToString,
  cidrToInterval,
  ipToString,
  formatBig,
  renderExport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  SAMPLE_INPUTS,
  type ExportFormat,
  type HistoryEntry,
} from "./logic";
import { History, Network, Layers, AlertCircle, CheckCircle2, FileText } from "lucide-react";

const FORMATS: { id: ExportFormat; label: string }[] = [
  { id: "cidr", label: "CIDR list" },
  { id: "range", label: "IP ranges" },
  { id: "cisco", label: "Cisco ACL" },
  { id: "pfsense", label: "pfSense alias" },
  { id: "nginx", label: "nginx allow" },
];

export default function CidrAggregatorNetworkSummarizer() {
  const [input, setInput] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [format, setFormat] = useState<ExportFormat>("cidr");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.input) setInput(p.input);
      if (p.exclusions) setExclusions(p.exclusions);
      if (p.format) setFormat(p.format);
      if (p.input || p.exclusions) toast.info("Loaded from share link");
    }
  }, []);

  const result = useMemo(() => aggregate(input, exclusions), [input, exclusions]);

  const exportBlocks = useMemo(() => allCidrs(result), [result]);
  const exportText = useMemo(
    () => renderExport(exportBlocks, format),
    [exportBlocks, format],
  );

  const handleSaveHistory = useCallback(() => {
    if (result.totalInput > 0) {
      saveHistory({
        ts: Date.now(),
        input,
        exclusions,
        totalInput: result.totalInput,
        totalOutput: result.totalOutput,
        addressesSaved: result.addressesSaved.toString(),
      });
      setHistory(loadHistory());
    }
  }, [input, exclusions, result]);

  const handleClear = useCallback(() => {
    setInput("");
    setExclusions("");
    setFormat("cidr");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const hasResult = result.totalInput > 0 || result.totalOutput > 0;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ca-input">Input — IPs, dashed ranges, and/or CIDRs (one per line)</Label>
            <Textarea
              id="ca-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={"192.168.0.0/24\n192.168.1.0/24\n10.0.0.5-10.0.0.10\n2001:db8::/32"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {SAMPLE_INPUTS.map((s) => (
                <Button
                  key={s.label}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => {
                    setInput(s.value);
                    if (s.exclusions) setExclusions(s.exclusions);
                  }}
                >
                  + {s.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ca-excl">Exclusions / subtractions (optional — same formats, one per line)</Label>
            <Textarea
              id="ca-excl"
              value={exclusions}
              onChange={(e) => setExclusions(e.target.value)}
              placeholder={"192.168.1.128/25\n2001:db8:1::/64"}
              className="min-h-[60px] resize-y font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {hasResult ? (
        <>
          {/* Summary stats */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Network className="h-4 w-4" /> Before / After
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Input entries" value={String(result.totalInput)} />
                <Stat label="Output CIDRs" value={String(result.totalOutput)} highlight={result.totalOutput < result.totalInput ? "good" : undefined} />
                <Stat label="Prefixes saved" value={String(Math.max(0, result.prefixesSaved))} highlight={result.prefixesSaved > 0 ? "good" : undefined} />
                <Stat label="Addresses saved" value={formatBig(result.addressesSaved)} highlight={result.addressesSaved > BigInt(0) ? "good" : undefined} />
              </div>
              {result.ipv4 && (
                <FamilySummary
                  familyLabel="IPv4"
                  familyIcon={<Network className="h-3.5 w-3.5" />}
                  inputCount={result.ipv4.inputIntervals.length}
                  inputCidrs={result.ipv4.inputCidrs.length}
                  outputCidrs={result.ipv4.cidrs.length}
                  inputAddresses={result.ipv4.inputAddresses}
                  outputAddresses={result.ipv4.outputAddresses}
                  excludedAddresses={result.ipv4.excludedAddresses}
                />
              )}
              {result.ipv6 && (
                <FamilySummary
                  familyLabel="IPv6"
                  familyIcon={<Layers className="h-3.5 w-3.5" />}
                  inputCount={result.ipv6.inputIntervals.length}
                  inputCidrs={result.ipv6.inputCidrs.length}
                  outputCidrs={result.ipv6.cidrs.length}
                  inputAddresses={result.ipv6.inputAddresses}
                  outputAddresses={result.ipv6.outputAddresses}
                  excludedAddresses={result.ipv6.excludedAddresses}
                />
              )}
            </CardContent>
          </Card>

          {/* Parse errors */}
          {result.errors.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-500" /> {result.errors.length} parse error(s)
                </h3>
                <div className="space-y-1 max-h-[160px] overflow-auto">
                  {result.errors.map((e, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <Badge variant="outline" className="mr-2 text-[10px]">line {e.index}</Badge>
                      <span className="font-mono text-muted-foreground mr-2">{e.line}</span>
                      <span className="text-amber-600 dark:text-amber-400">{e.error}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Output */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Aggregated output ({exportBlocks.length})
                </h3>
                <div className="flex flex-wrap gap-1">
                  {FORMATS.map((f) => (
                    <Button
                      key={f.id}
                      size="sm"
                      variant={format === f.id ? "default" : "outline"}
                      className="h-7 text-[11px]"
                      onClick={() => setFormat(f.id)}
                    >
                      {f.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1 max-h-[400px] overflow-auto">
                {exportText.split("\n").map((line, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs font-mono">
                    {line || <span className="text-muted-foreground italic">(empty)</span>}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => { handleSaveHistory(); return exportText; }} label="Copy output" />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return exportText; }}
                  filename={`cidr-aggregated-${format}.txt`}
                  mime="text/plain"
                  label="Download"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input, exclusions, format); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          {/* Per-family CIDR detail */}
          {(result.ipv4 || result.ipv6) && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Output CIDR blocks detail
                </h3>
                {result.ipv4 && (
                  <FamilyCidrList familyLabel="IPv4" blocks={result.ipv4.cidrs} />
                )}
                {result.ipv6 && (
                  <FamilyCidrList familyLabel="IPv6" blocks={result.ipv6.cidrs} />
                )}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title="Paste IPs, ranges, or CIDRs to aggregate"
          hint="One per line. Supports IPv4 and IPv6, mixed in the same paste. Click a preset sample above to try it."
          icon={<Network className="h-8 w-8" />}
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
                  type="button"
                  onClick={() => { setInput(h.input); setExclusions(h.exclusions); }}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{h.totalInput} → {h.totalOutput}</Badge>
                    <Badge variant="outline" className="text-[10px]">saved {formatBig(BigInt(h.addressesSaved))}</Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <div className="font-mono text-muted-foreground mt-1 truncate">{h.input.slice(0, 120)}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All aggregation runs locally with BigInt math — your IP lists never leave the browser. Huge ranges like 0.0.0.0/0 are counted mathematically without enumerating every address.
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
  value: string;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function FamilySummary({
  familyLabel,
  familyIcon,
  inputCount,
  inputCidrs,
  outputCidrs,
  inputAddresses,
  outputAddresses,
  excludedAddresses,
}: {
  familyLabel: string;
  familyIcon: React.ReactNode;
  inputCount: number;
  inputCidrs: number;
  outputCidrs: number;
  inputAddresses: bigint;
  outputAddresses: bigint;
  excludedAddresses: bigint;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2 text-xs space-y-1">
      <div className="flex items-center gap-2">
        {familyIcon}
        <span className="font-medium text-foreground">{familyLabel}</span>
        <Badge variant="outline" className="text-[10px]">{inputCount} in</Badge>
        <Badge variant="secondary" className="text-[10px]">{outputCidrs} CIDRs out</Badge>
        {excludedAddresses > BigInt(0) && (
          <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400">
            {formatBig(excludedAddresses)} excluded
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        <span>input prefixes: <span className="font-mono text-foreground">{inputCidrs}</span></span>
        <span>input addresses: <span className="font-mono text-foreground">{formatBig(inputAddresses)}</span></span>
        <span>output addresses: <span className="font-mono text-foreground">{formatBig(outputAddresses)}</span></span>
      </div>
    </div>
  );
}

function FamilyCidrList({
  familyLabel,
  blocks,
}: {
  familyLabel: string;
  blocks: { family: "ipv4" | "ipv6"; network: bigint; prefix: number }[];
}) {
  if (blocks.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic">
        {familyLabel}: no blocks (fully excluded)
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-foreground">{familyLabel} ({blocks.length})</div>
      <div className="space-y-1 max-h-[200px] overflow-auto">
        {blocks.map((b, i) => {
          const iv = cidrToInterval(b);
          return (
            <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs font-mono">
              <Badge variant="outline" className="text-[10px] mr-2">/{b.prefix}</Badge>
              <span className="text-foreground">{cidrToString(b)}</span>
              <span className="text-muted-foreground ml-2">
                ({ipToString(iv.start, b.family)} – {ipToString(iv.end, b.family)})
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
