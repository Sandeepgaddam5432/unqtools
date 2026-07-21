"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  parseIpCidr,
  computeSubnet,
  subdivide,
  buildPrefixReferenceTable,
  renderSubnetCsv,
  renderSubdivideCsv,
  renderJson,
  formatBinaryHextets,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SubnetToolMode,
  type HistoryEntry,
  type SubnetInfo,
  type SubdivideResult,
  type PrefixReferenceRow,
} from "./logic";
import { History, Network, Split, BookOpen, AlertTriangle, CheckCircle2 } from "lucide-react";

const TABS: { id: SubnetToolMode; label: string; icon: typeof Network }[] = [
  { id: "subnet", label: "Subnet", icon: Network },
  { id: "subdivide", label: "Subdivide", icon: Split },
  { id: "reference", label: "Reference", icon: BookOpen },
];

export default function IPv6SubnetCalculator() {
  const [mode, setMode] = useState<SubnetToolMode>("subnet");
  const [ipInput, setIpInput] = useState("2001:db8::1");
  const [cidrInput, setCidrInput] = useState("32");
  const [childCidrInput, setChildCidrInput] = useState("64");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setMode(p.mode);
      setIpInput(p.ip);
      setCidrInput(String(p.cidr));
      setChildCidrInput(String(p.childCidr));
      toast.info("Loaded from share link");
    }
  }, []);

  const cidrNum = useMemo(() => {
    const n = Number.parseInt(cidrInput, 10);
    return Number.isFinite(n) && n >= 0 && n <= 128 ? n : null;
  }, [cidrInput]);

  const childCidrNum = useMemo(() => {
    const n = Number.parseInt(childCidrInput, 10);
    return Number.isFinite(n) && n >= 0 && n <= 128 ? n : null;
  }, [childCidrInput]);

  const ipCidr = useMemo(() => {
    if (cidrNum === null) return { ok: false as const, error: "Prefix length must be 0–128" };
    return parseIpCidr(`${ipInput}/${cidrNum}`);
  }, [ipInput, cidrNum]);

  const subnetInfo = useMemo<SubnetInfo | null>(() => {
    if (!ipCidr.ok) return null;
    try {
      return computeSubnet(ipCidr.ip, ipCidr.cidr);
    } catch {
      return null;
    }
  }, [ipCidr]);

  const subdivideResult = useMemo<SubdivideResult | null>(() => {
    if (!ipCidr.ok || childCidrNum === null) return null;
    try {
      return subdivide(ipCidr.ip, ipCidr.cidr, childCidrNum);
    } catch {
      return null;
    }
  }, [ipCidr, childCidrNum]);

  const referenceRows = useMemo<PrefixReferenceRow[]>(() => buildPrefixReferenceTable(), []);

  const handleSaveHistory = useCallback(
    (summary: string) => {
      const input = `${ipInput}/${cidrInput}`;
      saveHistory({ ts: Date.now(), mode, input, summary });
      setHistory(loadHistory());
    },
    [mode, ipInput, cidrInput],
  );

  const handleClear = useCallback(() => {
    setIpInput("2001:db8::1");
    setCidrInput("32");
    setChildCidrInput("64");
    toast.info("Reset to defaults");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const csvOutput = useMemo(() => {
    if (mode === "subnet" && subnetInfo) return renderSubnetCsv(subnetInfo);
    if (mode === "subdivide" && subdivideResult) return renderSubdivideCsv(subdivideResult.displayed);
    return "";
  }, [mode, subnetInfo, subdivideResult]);

  const jsonOutput = useMemo(() => {
    if (mode === "subnet" && subnetInfo) return renderJson(subnetInfo);
    if (mode === "subdivide" && subdivideResult) return renderJson(subdivideResult);
    return "";
  }, [mode, subnetInfo, subdivideResult]);

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
      <Card>
        <CardContent className="p-4 space-y-3">
          {mode !== "reference" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ipv6-ip" className="text-xs">IPv6 address</Label>
                <Input
                  id="ipv6-ip"
                  value={ipInput}
                  onChange={(e) => setIpInput(e.target.value)}
                  placeholder="2001:db8::1"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ipv6-cidr" className="text-xs">Prefix length (0–128)</Label>
                <Input
                  id="ipv6-cidr"
                  type="number"
                  min={0}
                  max={128}
                  value={cidrInput}
                  onChange={(e) => setCidrInput(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              {!ipCidr.ok && (
                <p className="text-[11px] text-destructive sm:col-span-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {ipCidr.error}
                </p>
              )}
            </div>
          )}
          {mode === "subdivide" && (
            <div className="space-y-1">
              <Label htmlFor="ipv6-child" className="text-xs">Child prefix length (must be longer than parent)</Label>
              <Input
                id="ipv6-child"
                type="number"
                min={0}
                max={128}
                value={childCidrInput}
                onChange={(e) => setChildCidrInput(e.target.value)}
                className="font-mono text-sm max-w-[200px]"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {mode === "subnet" && subnetInfo && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Subnet result
              </h3>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] font-mono">/{subnetInfo.cidr}</Badge>
                {subnetInfo.isOnNibbleBoundary && (
                  <Badge variant="secondary" className="text-[10px]">nibble boundary</Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Stat label="Network (compressed)" value={subnetInfo.networkCompressed} mono />
              <Stat label="Network (expanded)" value={subnetInfo.networkExpanded} mono small />
              <Stat label="First address" value={subnetInfo.firstAddress} mono />
              <Stat label="Last address" value={subnetInfo.lastAddress} mono />
              <Stat label="Total addresses" value={formatBig(subnetInfo.totalAddresses)} mono />
              <Stat label="Number of /64s" value={formatBig(subnetInfo.countOf64s)} mono />
              <Stat label="ip6.arpa zone" value={subnetInfo.ip6ArpaZone} mono small />
              <Stat label="Input (compressed)" value={subnetInfo.ipCompressed} mono />
              <Stat label="Input (expanded)" value={subnetInfo.ipExpanded} mono small />
            </div>

            <BinarySection info={subnetInfo} />

            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => subnetInfo.networkCompressed} label="Copy network" />
              <CopyButton getText={() => subnetInfo.firstAddress} label="Copy first" />
              <CopyButton getText={() => subnetInfo.lastAddress} label="Copy last" />
              <CopyButton getText={() => subnetInfo.ip6ArpaZone} label="Copy ip6.arpa" />
              <DownloadButton
                getText={() => csvOutput}
                filename={`ipv6-subnet-${subnetInfo.networkCompressed.replace(/[:.]/g, "-")}-${subnetInfo.cidr}.csv`}
                label="Download CSV"
                disabled={!csvOutput}
              />
              <DownloadButton
                getText={() => jsonOutput}
                filename={`ipv6-subnet-${subnetInfo.networkCompressed.replace(/[:.]/g, "-")}-${subnetInfo.cidr}.json`}
                label="Download JSON"
                mime="application/json"
                disabled={!jsonOutput}
              />
              <ShareButton
                getUrl={() => {
                  handleSaveHistory(`/${subnetInfo.cidr} subnet`);
                  return buildShareUrl("subnet", ipInput, subnetInfo.cidr);
                }}
              />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      )}

      {mode === "subdivide" && subdivideResult && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Split className="h-4 w-4" /> Subdivide /{subdivideResult.parent.cidr} → /{subdivideResult.childPrefix}
              </h3>
              <Badge variant="outline" className="text-[10px] font-mono">
                {formatBig(subdivideResult.childCount)} children
              </Badge>
            </div>

            {subdivideResult.error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4" /> {subdivideResult.error}
              </div>
            )}

            {subdivideResult.capped && !subdivideResult.error && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                Showing first {subdivideResult.displayedCount} of {formatBig(subdivideResult.childCount)} children.
              </div>
            )}

            {subdivideResult.displayed.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="p-1.5">#</th>
                      <th className="p-1.5">Network</th>
                      <th className="p-1.5">First</th>
                      <th className="p-1.5">Last</th>
                      <th className="p-1.5">Total</th>
                      <th className="p-1.5">/64s</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subdivideResult.displayed.slice(0, 200).map((c) => (
                      <tr key={c.index} className="border-b hover:bg-muted/30">
                        <td className="p-1.5 font-mono text-muted-foreground">{c.index}</td>
                        <td className="p-1.5 font-mono">
                          <span className="font-semibold">{c.networkCompressed}</span>
                          <span className="text-muted-foreground">/{c.cidr}</span>
                        </td>
                        <td className="p-1.5 font-mono text-muted-foreground">{c.firstAddress}</td>
                        <td className="p-1.5 font-mono text-muted-foreground">{c.lastAddress}</td>
                        <td className="p-1.5 font-mono text-muted-foreground">{formatBig(c.totalAddresses)}</td>
                        <td className="p-1.5 font-mono text-muted-foreground">{formatBig(c.countOf64s)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {subdivideResult.displayed.length > 200 && (
                  <p className="text-[11px] text-muted-foreground p-2">
                    Showing 200 of {subdivideResult.displayedCount} (download CSV for all).
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <CopyButton
                getText={() => subdivideResult.displayed.map((c) => `${c.networkCompressed}/${c.cidr}`).join("\n")}
                label="Copy CIDR list"
                disabled={subdivideResult.displayed.length === 0}
              />
              <DownloadButton
                getText={() => csvOutput}
                filename={`ipv6-subdivide-${subdivideResult.parent.cidr}-${subdivideResult.childPrefix}.csv`}
                label="Download CSV"
                disabled={!csvOutput}
              />
              <DownloadButton
                getText={() => jsonOutput}
                filename={`ipv6-subdivide-${subdivideResult.parent.cidr}-${subdivideResult.childPrefix}.json`}
                label="Download JSON"
                mime="application/json"
                disabled={!jsonOutput}
              />
              <ShareButton
                getUrl={() => {
                  handleSaveHistory(`/${subdivideResult.parent.cidr} → /${subdivideResult.childPrefix}`);
                  return buildShareUrl("subdivide", ipInput, subdivideResult.parent.cidr, {
                    childCidr: subdivideResult.childPrefix,
                  });
                }}
              />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      )}

      {mode === "reference" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> IPv6 prefix reference
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="p-1.5">Prefix</th>
                    <th className="p-1.5">Example</th>
                    <th className="p-1.5">Total addresses</th>
                    <th className="p-1.5">/64 count</th>
                    <th className="p-1.5">Nibble boundary</th>
                  </tr>
                </thead>
                <tbody>
                  {referenceRows.map((r) => (
                    <tr key={r.prefix} className="border-b hover:bg-muted/30">
                      <td className="p-1.5 font-mono font-semibold">/{r.prefix}</td>
                      <td className="p-1.5 font-mono text-muted-foreground">{r.example}</td>
                      <td className="p-1.5 font-mono text-muted-foreground">{formatBig(r.totalAddresses)}</td>
                      <td className="p-1.5 font-mono text-muted-foreground">{formatBig(r.countOf64s)}</td>
                      <td className="p-1.5">
                        {r.nibbleBoundary
                          ? <Badge variant="secondary" className="text-[10px]">yes</Badge>
                          : <Badge variant="outline" className="text-[10px]">no</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ShareButton getUrl={() => buildShareUrl("reference", "2001:db8::", 0)} />
          </CardContent>
        </Card>
      )}

      {mode !== "reference" && !subnetInfo && !subdivideResult && (
        <EmptyState
          title="Enter an IPv6 address and prefix length"
          hint="Accepts full, compressed (::), or embedded-IPv4 (::ffff:192.0.2.1) forms. Use the Subdivide tab to split a prefix into smaller child prefixes."
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
            <strong className="text-foreground">Privacy:</strong> All IPv6 math runs locally in your browser using BigInt 128-bit arithmetic. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  mono,
  small,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`${small ? "text-[11px]" : "text-sm"} font-semibold text-foreground ${mono ? "font-mono break-all" : ""}`}>
        {value}
      </div>
      {hint && <div className="text-[9px] text-muted-foreground font-mono">{hint}</div>}
    </div>
  );
}

function BinarySection({ info }: { info: SubnetInfo }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">128-bit binary (grouped into 16-bit hextets)</div>
      <BinaryRow label="IP" binary={info.ipBinary} cidr={info.cidr} />
      <BinaryRow label="Mask" binary={info.maskBinary} cidr={info.cidr} />
      <BinaryRow label="Network" binary={info.networkBinary} cidr={info.cidr} />
      <BinaryRow label="Wildcard" binary={info.wildcardBinary} cidr={info.cidr} invert />
    </div>
  );
}

function BinaryRow({
  label,
  binary,
  cidr,
  invert,
}: {
  label: string;
  binary: string;
  cidr: number;
  invert?: boolean;
}) {
  const grouped = formatBinaryHextets(binary);
  const tokens = grouped.split(" ");
  // Render with network bits emphasized.
  return (
    <div className="flex items-center gap-2 text-[10px] overflow-x-auto">
      <span className="w-16 text-[10px] uppercase text-muted-foreground flex-shrink-0">{label}</span>
      <span className="font-mono whitespace-nowrap">
        {tokens.map((tok, i) => {
          // Each token is 16 bits. Determine how many of its bits are "network" bits.
          const tokenStart = i * 16;
          const tokenEnd = tokenStart + 16;
          const netEnd = Math.min(cidr, tokenEnd);
          const netLen = Math.max(0, netEnd - tokenStart);
          const hostLen = 16 - netLen;
          const netPart = tok.slice(0, netLen);
          const hostPart = tok.slice(netLen);
          const netColor = invert
            ? "text-muted-foreground"
            : "text-emerald-700 dark:text-emerald-400 font-bold";
          const hostColor = invert
            ? "text-purple-700 dark:text-purple-400 font-bold"
            : "text-muted-foreground";
          return (
            <span key={i}>
              {i > 0 && <span className="text-muted-foreground"> </span>}
              {netPart && <span className={netColor}>{netPart}</span>}
              {hostPart && <span className={hostColor}>{hostPart}</span>}
              {hostLen === 0 && netLen === 16 && null}
            </span>
          );
        })}
      </span>
    </div>
  );
}

/** Format a BigInt-as-string with thousands separators for readability. */
function formatBig(s: string): string {
  if (!s) return "0";
  // Insert thin spaces every 3 digits from the right.
  const neg = s.startsWith("-");
  const digits = neg ? s.slice(1) : s;
  const withSep = digits.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
  return neg ? `-${withSep}` : withSep;
}
