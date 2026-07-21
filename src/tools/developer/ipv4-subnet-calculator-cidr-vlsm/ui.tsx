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
  parseIpCidr,
  parseIPv4,
  parseCidrOrMask,
  computeSubnet,
  splitSubnet,
  allocateVlsm,
  checkContainment,
  parseVlsmRequirements,
  renderVlsmCsv,
  renderSplitCsv,
  renderJson,
  formatBinaryDotted,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SubnetToolMode,
  type HistoryEntry,
} from "./logic";
import { History, Network, Split, Layers, GitCompare, AlertTriangle, CheckCircle2 } from "lucide-react";

const TABS: { id: SubnetToolMode; label: string; icon: typeof Network }[] = [
  { id: "subnet", label: "Subnet", icon: Network },
  { id: "split", label: "Split", icon: Split },
  { id: "vlsm", label: "VLSM", icon: Layers },
  { id: "containment", label: "Containment", icon: GitCompare },
];

export default function IPv4SubnetCalculatorCidrVlsm() {
  const [mode, setMode] = useState<SubnetToolMode>("subnet");
  const [ipInput, setIpInput] = useState("192.168.1.1");
  const [maskInput, setMaskInput] = useState("/24");
  const [splitCount, setSplitCount] = useState(4);
  const [vlsmInput, setVlsmInput] = useState("LAN-A 50\nLAN-B 25\nMGMT 5");
  const [ip2Input, setIp2Input] = useState("192.168.1.128");
  const [mask2Input, setMask2Input] = useState("/25");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setMode(p.mode);
      setIpInput(p.ip);
      setMaskInput(`/${p.cidr}`);
      setSplitCount(p.count);
      setVlsmInput(p.vlsm || "LAN-A 50\nLAN-B 25\nMGMT 5");
      setIp2Input(p.ip2);
      setMask2Input(`/${p.cidr2}`);
      toast.info("Loaded from share link");
    }
  }, []);

  // ---- Parsed inputs ----
  const ipCidr = useMemo(() => {
    if (maskInput.trim().startsWith("/") || /^\d+$/.test(maskInput.trim()) || maskInput.includes(".")) {
      // Combine ip + mask
      const combined = `${ipInput} ${maskInput}`.trim();
      const withSlash = maskInput.trim().startsWith("/")
        ? `${ipInput}${maskInput}`.trim()
        : combined;
      return parseIpCidr(withSlash);
    }
    return parseIpCidr(`${ipInput} ${maskInput}`.trim());
  }, [ipInput, maskInput]);

  const ipCidr2 = useMemo(() => {
    const withSlash = mask2Input.trim().startsWith("/")
      ? `${ip2Input}${mask2Input}`.trim()
      : `${ip2Input} ${mask2Input}`.trim();
    return parseIpCidr(withSlash);
  }, [ip2Input, mask2Input]);

  const vlsmReqs = useMemo(() => parseVlsmRequirements(vlsmInput), [vlsmInput]);

  // ---- Results ----
  const subnetInfo = useMemo(() => {
    if (!ipCidr.ok) return null;
    try {
      return computeSubnet(ipCidr.ip, ipCidr.cidr);
    } catch {
      return null;
    }
  }, [ipCidr]);

  const splitResult = useMemo(() => {
    if (!ipCidr.ok) return null;
    try {
      return splitSubnet(ipCidr.ip, ipCidr.cidr, splitCount);
    } catch {
      return null;
    }
  }, [ipCidr, splitCount]);

  const vlsmResult = useMemo(() => {
    if (!ipCidr.ok || !vlsmReqs.ok) return null;
    try {
      return allocateVlsm(ipCidr.ip, ipCidr.cidr, vlsmReqs.reqs);
    } catch {
      return null;
    }
  }, [ipCidr, vlsmReqs]);

  const containmentResult = useMemo(() => {
    if (!ipCidr.ok || !ipCidr2.ok) return null;
    try {
      return checkContainment(ipCidr.ip, ipCidr.cidr, ipCidr2.ip, ipCidr2.cidr);
    } catch {
      return null;
    }
  }, [ipCidr, ipCidr2]);

  const handleSaveHistory = useCallback(
    (summary: string) => {
      const input =
        mode === "vlsm"
          ? `${ipInput}/${ipCidr.ok ? ipCidr.cidr : "?"} | ${vlsmInput.slice(0, 60)}`
          : mode === "containment"
            ? `${ipInput}/${ipCidr.ok ? ipCidr.cidr : "?"} vs ${ip2Input}/${ipCidr2.ok ? ipCidr2.cidr : "?"}`
            : `${ipInput}/${ipCidr.ok ? ipCidr.cidr : "?"}`;
      saveHistory({ ts: Date.now(), mode, input, summary });
      setHistory(loadHistory());
    },
    [mode, ipInput, ip2Input, vlsmInput, ipCidr, ipCidr2],
  );

  const handleClear = useCallback(() => {
    setIpInput("192.168.1.1");
    setMaskInput("/24");
    setSplitCount(4);
    setVlsmInput("");
    setIp2Input("192.168.1.128");
    setMask2Input("/25");
    toast.info("Reset to defaults");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const csvOutput = useMemo(() => {
    if (mode === "vlsm" && vlsmResult) return renderVlsmCsv(vlsmResult.subnets);
    if (mode === "split" && splitResult) return renderSplitCsv(splitResult.subnets);
    return "";
  }, [mode, vlsmResult, splitResult]);

  const jsonOutput = useMemo(() => {
    if (mode === "subnet" && subnetInfo) return renderJson(subnetInfo);
    if (mode === "split" && splitResult) return renderJson(splitResult);
    if (mode === "vlsm" && vlsmResult) return renderJson(vlsmResult);
    if (mode === "containment" && containmentResult) return renderJson(containmentResult);
    return "";
  }, [mode, subnetInfo, splitResult, vlsmResult, containmentResult]);

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
          {mode === "subnet" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ipv4-ip" className="text-xs">IPv4 address</Label>
                <Input
                  id="ipv4-ip"
                  value={ipInput}
                  onChange={(e) => setIpInput(e.target.value)}
                  placeholder="192.168.1.1"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ipv4-mask" className="text-xs">CIDR / mask (/24, 24, 255.255.255.0, 0.0.0.255)</Label>
                <Input
                  id="ipv4-mask"
                  value={maskInput}
                  onChange={(e) => setMaskInput(e.target.value)}
                  placeholder="/24"
                  className="font-mono text-sm"
                />
              </div>
              {!ipCidr.ok && (
                <p className="text-[11px] text-destructive sm:col-span-2">{ipCidr.error}</p>
              )}
            </div>
          )}
          {mode === "split" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="split-ip" className="text-xs">Parent IP</Label>
                <Input
                  id="split-ip"
                  value={ipInput}
                  onChange={(e) => setIpInput(e.target.value)}
                  placeholder="192.168.1.0"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="split-mask" className="text-xs">Parent CIDR/mask</Label>
                <Input
                  id="split-mask"
                  value={maskInput}
                  onChange={(e) => setMaskInput(e.target.value)}
                  placeholder="/24"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="split-count" className="text-xs">Split count</Label>
                <Input
                  id="split-count"
                  type="number"
                  min={1}
                  value={splitCount}
                  onChange={(e) => setSplitCount(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                  className="font-mono text-sm"
                />
              </div>
              {!ipCidr.ok && (
                <p className="text-[11px] text-destructive sm:col-span-3">{ipCidr.error}</p>
              )}
            </div>
          )}
          {mode === "vlsm" && (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="vlsm-ip" className="text-xs">Parent block IP</Label>
                  <Input
                    id="vlsm-ip"
                    value={ipInput}
                    onChange={(e) => setIpInput(e.target.value)}
                    placeholder="192.168.1.0"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="vlsm-mask" className="text-xs">Parent CIDR/mask</Label>
                  <Input
                    id="vlsm-mask"
                    value={maskInput}
                    onChange={(e) => setMaskInput(e.target.value)}
                    placeholder="/24"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="vlsm-reqs" className="text-xs">
                  Requirements (one per line: <code>name hosts</code> — also accepts <code>name:hosts</code>, comma-separated)
                </Label>
                <Textarea
                  id="vlsm-reqs"
                  value={vlsmInput}
                  onChange={(e) => setVlsmInput(e.target.value)}
                  placeholder={"LAN-A 50\nLAN-B 25\nMGMT 5"}
                  className="min-h-[100px] resize-y font-mono text-xs"
                />
                {!vlsmReqs.ok && (
                  <p className="text-[11px] text-destructive">{vlsmReqs.error}</p>
                )}
              </div>
            </div>
          )}
          {mode === "containment" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Block 1 IP</Label>
                <Input value={ipInput} onChange={(e) => setIpInput(e.target.value)} className="font-mono text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Block 1 CIDR</Label>
                <Input value={maskInput} onChange={(e) => setMaskInput(e.target.value)} className="font-mono text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Block 2 IP</Label>
                <Input value={ip2Input} onChange={(e) => setIp2Input(e.target.value)} className="font-mono text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Block 2 CIDR</Label>
                <Input value={mask2Input} onChange={(e) => setMask2Input(e.target.value)} className="font-mono text-sm" />
              </div>
              {(!ipCidr.ok || !ipCidr2.ok) && (
                <p className="text-[11px] text-destructive col-span-2 sm:col-span-4">
                  {!ipCidr.ok ? `Block 1: ${ipCidr.error}` : ""}
                  {!ipCidr2.ok ? ` Block 2: ${ipCidr2.error}` : ""}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {mode === "subnet" && subnetInfo && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Network className="h-4 w-4" /> {subnetInfo.networkAddress}/{subnetInfo.cidr}
                </h3>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">Class {subnetInfo.ipClass}</Badge>
                  {subnetInfo.isPrivate && <Badge variant="secondary" className="text-[10px]">Private (RFC 1918)</Badge>}
                  {subnetInfo.isLoopback && <Badge variant="secondary" className="text-[10px]">Loopback</Badge>}
                  {subnetInfo.isLinkLocal && <Badge variant="secondary" className="text-[10px]">Link-local</Badge>}
                  {subnetInfo.isReserved && !subnetInfo.isPrivate && !subnetInfo.isLoopback && !subnetInfo.isLinkLocal && (
                    <Badge variant="secondary" className="text-[10px]">Reserved</Badge>
                  )}
                  {!subnetInfo.isReserved && !subnetInfo.isPrivate && (
                    <Badge variant="secondary" className="text-[10px]">Public</Badge>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="Network" value={subnetInfo.networkAddress} mono />
                <Stat label="Broadcast" value={subnetInfo.broadcastAddress} mono />
                <Stat label="First host" value={subnetInfo.firstHost} mono />
                <Stat label="Last host" value={subnetInfo.lastHost} mono />
                <Stat label="Subnet mask" value={subnetInfo.subnetMask} mono />
                <Stat label="Wildcard" value={subnetInfo.wildcardMask} mono />
                <Stat label="Usable hosts" value={String(subnetInfo.hostCount)} />
                <Stat label="Total addresses" value={String(subnetInfo.totalAddresses)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Binary visualization</h3>
              <BinaryRow label="IP" binary={subnetInfo.ipBinary} cidr={subnetInfo.cidr} />
              <BinaryRow label="Mask" binary={subnetInfo.maskBinary} cidr={subnetInfo.cidr} />
              <BinaryRow label="Network" binary={subnetInfo.networkBinary} cidr={subnetInfo.cidr} />
              <BinaryRow label="Wildcard" binary={subnetInfo.wildcardBinary} cidr={subnetInfo.cidr} invert />
            </CardContent>
          </Card>
        </>
      )}

      {mode === "split" && splitResult && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Split className="h-4 w-4" />
                {splitResult.parent.networkAddress}/{splitResult.parent.cidr} → {splitResult.count} × /{splitResult.newPrefix}
              </h3>
              <Badge variant="outline" className="text-[10px]">
                {splitResult.count} subnets · {splitResult.subnets[0]?.hostCount ?? 0} hosts each
              </Badge>
            </div>
            {splitResult.error ? (
              <div className="rounded border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-2 text-xs text-red-700 dark:text-red-300 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                {splitResult.error}
              </div>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-auto">
                {splitResult.subnets.map((s, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-2 text-xs grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div>
                      <span className="text-[9px] uppercase text-muted-foreground">#</span>
                      <div className="font-mono font-medium">{i + 1}</div>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase text-muted-foreground">Network</span>
                      <div className="font-mono">{s.networkAddress}/{s.cidr}</div>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase text-muted-foreground">Broadcast</span>
                      <div className="font-mono">{s.broadcastAddress}</div>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase text-muted-foreground">Mask</span>
                      <div className="font-mono">{s.subnetMask}</div>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase text-muted-foreground">Hosts</span>
                      <div className="font-mono">{s.hostCount}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "vlsm" && vlsmResult && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="h-4 w-4" />
                {vlsmResult.parent.networkAddress}/{vlsmResult.parent.cidr} → {vlsmResult.subnets.length} VLSM subnets
              </h3>
              <div className="flex flex-wrap gap-1">
                {vlsmResult.fits ? (
                  <Badge variant="secondary" className="text-[10px] bg-emerald-100 dark:bg-emerald-950/40">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Fits
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px]">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Overflow
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px]">
                  {vlsmResult.wastePercent.toFixed(1)}% unused
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Stat label="Total available" value={String(vlsmResult.totalAvailable)} />
              <Stat label="Allocated" value={String(vlsmResult.totalUsed)} />
              <Stat label="Waste %" value={`${vlsmResult.wastePercent.toFixed(1)}%`} />
            </div>
            <div className="space-y-1 max-h-[400px] overflow-auto">
              {vlsmResult.subnets.map((s, i) => (
                <div
                  key={i}
                  className={`rounded border px-3 py-2 text-xs grid grid-cols-2 sm:grid-cols-6 gap-2 ${
                    s.overflow
                      ? "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30"
                      : "bg-background"
                  }`}
                >
                  <div>
                    <span className="text-[9px] uppercase text-muted-foreground">Name</span>
                    <div className="font-mono font-medium">{s.name}</div>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-muted-foreground">Required / Allocated</span>
                    <div className="font-mono">{s.requiredHosts} / {s.allocatedHosts}</div>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-muted-foreground">Network</span>
                    <div className="font-mono">{s.networkAddress}/{s.cidr}</div>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-muted-foreground">Host range</span>
                    <div className="font-mono text-[10px]">{s.firstHost} – {s.lastHost}</div>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-muted-foreground">Mask</span>
                    <div className="font-mono text-[10px]">{s.subnetMask}</div>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-muted-foreground">Waste</span>
                    <div className={`font-mono ${s.waste > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {s.overflow ? "OVERFLOW" : `+${s.waste}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {mode === "containment" && containmentResult && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <GitCompare className="h-4 w-4" /> Block comparison
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded border bg-background px-3 py-2">
                <div className="text-[9px] uppercase text-muted-foreground">Block 1</div>
                <div className="font-mono text-sm font-medium">
                  {containmentResult.block1.network}/{containmentResult.block1.cidr}
                </div>
              </div>
              <div className="rounded border bg-background px-3 py-2">
                <div className="text-[9px] uppercase text-muted-foreground">Block 2</div>
                <div className="font-mono text-sm font-medium">
                  {containmentResult.block2.network}/{containmentResult.block2.cidr}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat
                label="Overlap"
                value={containmentResult.overlap ? "Yes" : "No"}
                highlight={containmentResult.overlap ? "bad" : "good"}
              />
              <Stat
                label="Block 1 ⊇ Block 2"
                value={containmentResult.block1ContainsBlock2 ? "Yes" : "No"}
                highlight={containmentResult.block1ContainsBlock2 ? "good" : undefined}
              />
              <Stat
                label="Block 2 ⊇ Block 1"
                value={containmentResult.block2ContainsBlock1 ? "Yes" : "No"}
                highlight={containmentResult.block2ContainsBlock1 ? "good" : undefined}
              />
              <Stat
                label="Identical"
                value={containmentResult.identical ? "Yes" : "No"}
                highlight={containmentResult.identical ? "good" : undefined}
              />
            </div>
            {containmentResult.identical && (
              <div className="rounded border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                The two blocks cover exactly the same address range.
              </div>
            )}
            {containmentResult.overlap && !containmentResult.block1ContainsBlock2 && !containmentResult.block2ContainsBlock1 && !containmentResult.identical && (
              <div className="rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Blocks overlap but neither contains the other. (With aligned CIDR blocks this is unusual — verify your inputs.)
              </div>
            )}
            {!containmentResult.overlap && (
              <div className="rounded border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Blocks are disjoint — no overlap.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {subnetInfo && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {mode === "subnet" && (
                <CopyButton
                  getText={() => {
                    handleSaveHistory(`${subnetInfo.networkAddress}/${subnetInfo.cidr}`);
                    return `${subnetInfo.networkAddress}/${subnetInfo.cidr}\n${subnetInfo.subnetMask} (mask)\n${subnetInfo.wildcardMask} (wildcard)\n${subnetInfo.firstHost} – ${subnetInfo.lastHost}\n${subnetInfo.hostCount} usable hosts`;
                  }}
                  label="Copy summary"
                />
              )}
              {csvOutput && (
                <CopyButton getText={() => csvOutput} label="Copy CSV" />
              )}
              {csvOutput && (
                <DownloadButton
                  getText={() => csvOutput}
                  filename={`${mode}-subnets.csv`}
                  mime="text/csv"
                  label="Download CSV"
                />
              )}
              {jsonOutput && (
                <DownloadButton
                  getText={() => jsonOutput}
                  filename={`${mode}-result.json`}
                  mime="application/json"
                  label="Download JSON"
                />
              )}
              <ShareButton
                getUrl={() => {
                  handleSaveHistory(`${mode} result`);
                  const cidr = ipCidr.ok ? ipCidr.cidr : 24;
                  const cidr2 = ipCidr2.ok ? ipCidr2.cidr : 24;
                  return buildShareUrl(mode, ipInput, cidr, {
                    count: splitCount,
                    vlsm: mode === "vlsm" ? vlsmInput : undefined,
                    ip2: ip2Input,
                    cidr2,
                  });
                }}
              />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      )}

      {!subnetInfo && mode === "subnet" && (
        <EmptyState
          title="Enter an IPv4 address and mask"
          hint="Accepts CIDR (/24), bare integer (24), dotted mask (255.255.255.0), or inverse mask (0.0.0.255). Switch tabs for VLSM, split, or containment."
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
            <strong className="text-foreground">Privacy:</strong> All subnet math (CIDR, VLSM, split, containment) runs locally in your browser. History is stored in localStorage on this device only.
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
  highlight,
  mono,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: "good" | "bad";
  mono?: boolean;
}) {
  const color =
    highlight === "bad"
      ? "text-red-600 dark:text-red-400"
      : highlight === "good"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-foreground";
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${color} ${mono ? "font-mono" : ""}`}>{value}</div>
      {hint && <div className="text-[9px] text-muted-foreground font-mono">{hint}</div>}
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
  // Color the network bits (first `cidr`) differently from host bits (rest).
  const netBits = invert ? binary.slice(0, cidr) : binary.slice(0, cidr);
  const hostBits = invert ? binary.slice(cidr) : binary.slice(cidr);
  const netColor = invert
    ? "text-muted-foreground"
    : "text-emerald-700 dark:text-emerald-400 font-bold";
  const hostColor = invert
    ? "text-purple-700 dark:text-purple-400 font-bold"
    : "text-muted-foreground";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-[10px] uppercase text-muted-foreground">{label}</span>
      <span className="font-mono">
        <span className={netColor}>{netBits}</span>
        <span className={hostColor}>{hostBits}</span>
      </span>
      <span className="text-[10px] text-muted-foreground font-mono ml-auto hidden sm:inline">
        {formatBinaryDotted(binary)}
      </span>
    </div>
  );
}
