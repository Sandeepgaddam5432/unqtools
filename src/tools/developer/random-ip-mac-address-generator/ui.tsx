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
  VENDOR_PRESETS,
  HONESTY_BANNER,
  generateIpv4Batch,
  generateIpv6Batch,
  generateMacBatch,
  computeSubnet,
  lookupIp,
  lookupMac,
  renderIpv4Csv,
  renderIpv6Csv,
  renderMacCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  ipv4ToNumber,
  numberToIpv4,
  type IpFamily,
  type Ipv4Scope,
  type MacFormat,
  type MacCase,
  type MacMode,
  type HistoryEntry,
} from "./logic";
import {
  Network,
  History,
  ShieldCheck,
  AlertTriangle,
  Wand2,
  ListChecks,
  Server,
  Cpu,
  Calculator,
  Search,
} from "lucide-react";

type Mode = "ipv4" | "ipv6" | "mac" | "subnet" | "lookup";

export default function RandomIpMacAddressGenerator() {
  const [mode, setMode] = useState<Mode>("ipv4");

  // ---- IPv4 ----
  const [v4Scope, setV4Scope] = useState<Ipv4Scope>("private");
  const [v4Cidr, setV4Cidr] = useState("");
  const [v4From, setV4From] = useState("");
  const [v4To, setV4To] = useState("");
  const [v4Count, setV4Count] = useState(10);
  const [v4Seed, setV4Seed] = useState("ip-seed-1");

  // ---- IPv6 ----
  const [v6Compressed, setV6Compressed] = useState(true);
  const [v6Cidr, setV6Cidr] = useState("");
  const [v6Count, setV6Count] = useState(10);
  const [v6Seed, setV6Seed] = useState("ip6-seed-1");

  // ---- MAC ----
  const [macFormat, setMacFormat] = useState<MacFormat>("colon");
  const [macCase, setMacCase] = useState<MacCase>("upper");
  const [macMode, setMacMode] = useState<MacMode>("random");
  const [macVendor, setMacVendor] = useState<string>("005056");
  const [macMulticast, setMacMulticast] = useState(false);
  const [macLaa, setMacLaa] = useState(false);
  const [macCount, setMacCount] = useState(10);
  const [macSeed, setMacSeed] = useState("mac-seed-1");

  // ---- Subnet ----
  const [subnetCidr, setSubnetCidr] = useState("192.168.1.0/24");

  // ---- Lookup ----
  const [lookupInput, setLookupInput] = useState("");

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.family === "ipv4" || p.family === "ipv6" || p.family === "mac") {
        setMode(p.family);
      }
      if (p.params.scope) setV4Scope(p.params.scope as Ipv4Scope);
      if (p.params.cidr && (p.family === "ipv4" || p.family === "ipv6")) {
        if (p.family === "ipv4") setV4Cidr(p.params.cidr);
        else setV6Cidr(p.params.cidr);
      }
      if (p.params.count) {
        const n = parseInt(p.params.count, 10);
        if (!Number.isNaN(n)) {
          if (p.family === "ipv4") setV4Count(n);
          else if (p.family === "ipv6") setV6Count(n);
          else if (p.family === "mac") setMacCount(n);
        }
      }
      if (p.params.seed) {
        if (p.family === "ipv4") setV4Seed(p.params.seed);
        else if (p.family === "ipv6") setV6Seed(p.params.seed);
        else if (p.family === "mac") setMacSeed(p.params.seed);
      }
      if (p.params.fmt) setMacFormat(p.params.fmt as MacFormat);
      if (p.params.case) setMacCase(p.params.case as MacCase);
      if (p.params.mmode) setMacMode(p.params.mmode as MacMode);
      if (p.params.vendor) setMacVendor(p.params.vendor);
      if (p.params.mcast) setMacMulticast(p.params.mcast === "true");
      if (p.params.laa) setMacLaa(p.params.laa === "true");
      if (Object.keys(p.params).length > 0) toast.info("Loaded from share link");
    }
  }, []);

  // ---- IPv4 generate ----
  const v4Rows = useMemo(() => {
    if (mode !== "ipv4") return [];
    return generateIpv4Batch({
      scope: v4Scope,
      cidr: v4Cidr || undefined,
      from: v4From || undefined,
      to: v4To || undefined,
      count: v4Count,
      seed: v4Seed,
    });
  }, [mode, v4Scope, v4Cidr, v4From, v4To, v4Count, v4Seed]);

  const v4Text = useMemo(() => v4Rows.map((r) => r.address).join("\n"), [v4Rows]);
  const v4Csv = useMemo(() => renderIpv4Csv(v4Rows), [v4Rows]);

  // ---- IPv6 generate ----
  const v6Rows = useMemo(() => {
    if (mode !== "ipv6") return [];
    return generateIpv6Batch({
      compressed: v6Compressed,
      cidr: v6Cidr || undefined,
      count: v6Count,
      seed: v6Seed,
    });
  }, [mode, v6Compressed, v6Cidr, v6Count, v6Seed]);

  const v6Text = useMemo(
    () => v6Rows.map((r) => (v6Compressed ? r.compressed : r.full)).join("\n"),
    [v6Rows, v6Compressed],
  );
  const v6Csv = useMemo(() => renderIpv6Csv(v6Rows), [v6Rows]);

  // ---- MAC generate ----
  const macRows = useMemo(() => {
    if (mode !== "mac") return [];
    return generateMacBatch({
      format: macFormat,
      case: macCase,
      mode: macMode,
      vendorPrefix: macVendor,
      multicast: macMulticast,
      locallyAdministered: macLaa,
      count: macCount,
      seed: macSeed,
    });
  }, [mode, macFormat, macCase, macMode, macVendor, macMulticast, macLaa, macCount, macSeed]);

  const macText = useMemo(() => macRows.map((r) => r.mac).join("\n"), [macRows]);
  const macCsv = useMemo(() => renderMacCsv(macRows), [macRows]);

  // ---- Subnet ----
  const subnetInfo = useMemo(() => {
    if (mode !== "subnet") return null;
    return computeSubnet(subnetCidr);
  }, [mode, subnetCidr]);

  // ---- Lookup ----
  const lookupResult = useMemo(() => {
    if (mode !== "lookup" || !lookupInput.trim()) return null;
    const ip = lookupIp(lookupInput);
    if (ip) return { kind: "ip" as const, data: ip };
    const mac = lookupMac(lookupInput);
    if (mac) return { kind: "mac" as const, data: mac };
    return null;
  }, [mode, lookupInput]);

  // ---- History helpers ----
  const handleHistory = useCallback((entry: HistoryEntry) => {
    saveHistory(entry);
    setHistory(loadHistory());
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleClear = useCallback(() => {
    setV4Cidr(""); setV4From(""); setV4To("");
    setV6Cidr("");
    setLookupInput("");
    setV4Seed(`ip-seed-${Date.now()}`);
    setV6Seed(`ip6-seed-${Date.now()}`);
    setMacSeed(`mac-seed-${Date.now()}`);
    toast.info("Cleared");
  }, []);

  const buildShare = useCallback(() => {
    if (mode === "ipv4") {
      return buildShareUrl("ipv4", {
        scope: v4Scope, cidr: v4Cidr, from: v4From, to: v4To,
        count: String(v4Count), seed: v4Seed,
      });
    }
    if (mode === "ipv6") {
      return buildShareUrl("ipv6", {
        cidr: v6Cidr, count: String(v6Count), seed: v6Seed,
        compressed: String(v6Compressed),
      });
    }
    if (mode === "mac") {
      return buildShareUrl("mac", {
        fmt: macFormat, case: macCase, mmode: macMode, vendor: macVendor,
        mcast: String(macMulticast), laa: String(macLaa),
        count: String(macCount), seed: macSeed,
      });
    }
    return buildShareUrl("ipv4", {});
  }, [mode, v4Scope, v4Cidr, v4From, v4To, v4Count, v4Seed,
      v6Cidr, v6Count, v6Seed, v6Compressed,
      macFormat, macCase, macMode, macVendor, macMulticast, macLaa, macCount, macSeed]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Mode tabs */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2">
            {([
              { id: "ipv4", label: "IPv4", icon: Network },
              { id: "ipv6", label: "IPv6", icon: Server },
              { id: "mac", label: "MAC", icon: Cpu },
              { id: "subnet", label: "Subnet", icon: Calculator },
              { id: "lookup", label: "Lookup", icon: Search },
            ] as { id: Mode; label: string; icon: React.ElementType }[]).map((t) => {
              const Icon = t.icon;
              return (
                <Button
                  key={t.id}
                  variant={mode === t.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode(t.id)}
                  className="gap-1.5"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Honesty banner */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <span>{HONESTY_BANNER}</span>
      </div>

      {mode === "ipv4" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Scope</Label>
                <select
                  value={v4Scope}
                  onChange={(e) => setV4Scope(e.target.value as Ipv4Scope)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  <option value="any">Any</option>
                  <option value="public">Public (routable)</option>
                  <option value="private">Private (RFC 1918)</option>
                  <option value="loopback">Loopback (127.x)</option>
                  <option value="link_local">Link-local (169.254.x)</option>
                  <option value="multicast">Multicast (224-239.x)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Count (1–10000)</Label>
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  value={v4Count}
                  onChange={(e) => setV4Count(Math.max(1, Math.min(10000, parseInt(e.target.value, 10) || 1)))}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CIDR (optional)</Label>
                <Input
                  value={v4Cidr}
                  onChange={(e) => setV4Cidr(e.target.value)}
                  placeholder="192.168.1.0/24"
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Seed (deterministic)</Label>
                <Input
                  value={v4Seed}
                  onChange={(e) => setV4Seed(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">From (optional)</Label>
                <Input
                  value={v4From}
                  onChange={(e) => setV4From(e.target.value)}
                  placeholder="10.0.0.50"
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">To (optional)</Label>
                <Input
                  value={v4To}
                  onChange={(e) => setV4To(e.target.value)}
                  placeholder="10.0.0.60"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            {v4Rows.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Network className="h-4 w-4" /> {v4Rows.length} IPv4 addresses
                  </h3>
                  <Badge variant="secondary" className="text-[10px]">
                    scope: {v4Scope}
                  </Badge>
                </div>
                <Textarea
                  readOnly
                  value={v4Text}
                  className="min-h-[200px] resize-y font-mono text-xs"
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  <CopyButton
                    getText={() => { handleHistory({ ts: Date.now(), action: "generate_ipv4", family: "ipv4", count: v4Rows.length }); return v4Text; }}
                    label="Copy all"
                  />
                  <DownloadButton
                    getText={() => v4Text}
                    filename="ipv4-addresses.txt"
                    mime="text/plain"
                    label="Download .txt"
                  />
                  <DownloadButton
                    getText={() => v4Csv}
                    filename="ipv4-addresses.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                  <DownloadButton
                    getText={() => renderJson(v4Rows)}
                    filename="ipv4-addresses.json"
                    mime="application/json"
                    label="Download JSON"
                  />
                  <ShareButton getUrl={() => buildShare()} />
                  <ClearButton onClick={handleClear} />
                </div>
              </>
            ) : (
              <EmptyState
                title="Pick a scope and generate IPv4s"
                hint="Choose public/private/loopback/etc., optionally constrain to a CIDR or from-to range. Same seed → same IPs (deterministic for test fixtures)."
                icon={<Network className="h-8 w-8" />}
              />
            )}
          </CardContent>
        </Card>
      )}

      {mode === "ipv6" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Count (1–10000)</Label>
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  value={v6Count}
                  onChange={(e) => setV6Count(Math.max(1, Math.min(10000, parseInt(e.target.value, 10) || 1)))}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CIDR (optional)</Label>
                <Input
                  value={v6Cidr}
                  onChange={(e) => setV6Cidr(e.target.value)}
                  placeholder="2001:db8::/32"
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Seed (deterministic)</Label>
                <Input
                  value={v6Seed}
                  onChange={(e) => setV6Seed(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Format</Label>
                <select
                  value={v6Compressed ? "compressed" : "full"}
                  onChange={(e) => setV6Compressed(e.target.value === "compressed")}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  <option value="compressed">Compressed (::, RFC 5952)</option>
                  <option value="full">Full (8 groups)</option>
                </select>
              </div>
            </div>

            {v6Rows.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Server className="h-4 w-4" /> {v6Rows.length} IPv6 addresses
                  </h3>
                  <Badge variant="secondary" className="text-[10px]">
                    {v6Compressed ? "RFC 5952 compressed" : "Full"}
                  </Badge>
                </div>
                <Textarea
                  readOnly
                  value={v6Text}
                  className="min-h-[200px] resize-y font-mono text-xs"
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  <CopyButton
                    getText={() => { handleHistory({ ts: Date.now(), action: "generate_ipv6", family: "ipv6", count: v6Rows.length }); return v6Text; }}
                    label="Copy all"
                  />
                  <DownloadButton
                    getText={() => v6Text}
                    filename="ipv6-addresses.txt"
                    mime="text/plain"
                    label="Download .txt"
                  />
                  <DownloadButton
                    getText={() => v6Csv}
                    filename="ipv6-addresses.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                  <DownloadButton
                    getText={() => renderJson(v6Rows)}
                    filename="ipv6-addresses.json"
                    mime="application/json"
                    label="Download JSON"
                  />
                  <ShareButton getUrl={() => buildShare()} />
                  <ClearButton onClick={handleClear} />
                </div>
              </>
            ) : (
              <EmptyState
                title="Generate random IPv6 addresses"
                hint="Full or RFC 5952 compressed form. Optionally constrain to a CIDR. BigInt-safe math samples uniformly across the 128-bit range."
                icon={<Server className="h-8 w-8" />}
              />
            )}
          </CardContent>
        </Card>
      )}

      {mode === "mac" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Mode</Label>
                <select
                  value={macMode}
                  onChange={(e) => setMacMode(e.target.value as MacMode)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  <option value="random">Fully random</option>
                  <option value="vendor">Vendor OUI prefix</option>
                  <option value="laa">Locally-administered (LAA)</option>
                </select>
              </div>
              {macMode === "vendor" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Vendor</Label>
                  <select
                    value={macVendor}
                    onChange={(e) => setMacVendor(e.target.value)}
                    className="h-9 w-full text-xs rounded border bg-background px-2"
                  >
                    {VENDOR_PRESETS.map((v) => (
                      <option key={v.prefix} value={v.prefix}>
                        {v.vendor} ({v.prefix})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Format</Label>
                <select
                  value={macFormat}
                  onChange={(e) => setMacFormat(e.target.value as MacFormat)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  <option value="colon">Colon (00:1A:2B:…)</option>
                  <option value="hyphen">Hyphen (00-1A-2B-…)</option>
                  <option value="dot">Dot (001A.2B3C.…)</option>
                  <option value="raw">Raw (001A2B3C…)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Case</Label>
                <select
                  value={macCase}
                  onChange={(e) => setMacCase(e.target.value as MacCase)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  <option value="upper">UPPERCASE</option>
                  <option value="lower">lowercase</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Count (1–10000)</Label>
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  value={macCount}
                  onChange={(e) => setMacCount(Math.max(1, Math.min(10000, parseInt(e.target.value, 10) || 1)))}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Seed (deterministic)</Label>
                <Input
                  value={macSeed}
                  onChange={(e) => setMacSeed(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5 flex items-end">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={macMulticast}
                    onChange={(e) => setMacMulticast(e.target.checked)}
                  />
                  Multicast (LSB)
                </label>
              </div>
              <div className="space-y-1.5 flex items-end">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={macLaa}
                    onChange={(e) => setMacLaa(e.target.checked)}
                    disabled={macMode === "laa"}
                  />
                  Locally-administered (LAA)
                </label>
              </div>
            </div>

            {macRows.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Cpu className="h-4 w-4" /> {macRows.length} MAC addresses
                  </h3>
                  <div className="flex gap-1">
                    <Badge variant="secondary" className="text-[10px]">{macFormat}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{macMode}</Badge>
                  </div>
                </div>
                <Textarea
                  readOnly
                  value={macText}
                  className="min-h-[200px] resize-y font-mono text-xs"
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  <CopyButton
                    getText={() => { handleHistory({ ts: Date.now(), action: "generate_mac", family: "mac", count: macRows.length }); return macText; }}
                    label="Copy all"
                  />
                  <DownloadButton
                    getText={() => macText}
                    filename="mac-addresses.txt"
                    mime="text/plain"
                    label="Download .txt"
                  />
                  <DownloadButton
                    getText={() => macCsv}
                    filename="mac-addresses.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                  <DownloadButton
                    getText={() => renderJson(macRows)}
                    filename="mac-addresses.json"
                    mime="application/json"
                    label="Download JSON"
                  />
                  <ShareButton getUrl={() => buildShare()} />
                  <ClearButton onClick={handleClear} />
                </div>
              </>
            ) : (
              <EmptyState
                title="Generate random MAC addresses"
                hint="Pick a vendor OUI prefix or generate fully random / LAA MACs. Choose format (colon/hyphen/dot/raw) and case. Multicast + LAA bits are controllable."
                icon={<Cpu className="h-8 w-8" />}
              />
            )}
          </CardContent>
        </Card>
      )}

      {mode === "subnet" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="subnet-cidr">CIDR (e.g. 192.168.1.0/24)</Label>
              <Input
                id="subnet-cidr"
                value={subnetCidr}
                onChange={(e) => setSubnetCidr(e.target.value)}
                placeholder="192.168.1.0/24"
                className="font-mono text-sm"
              />
            </div>
            {subnetInfo ? (
              <>
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground">Subnet info</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <Field label="CIDR" value={subnetInfo.cidr} mono />
                    <Field label="Network" value={subnetInfo.network} mono />
                    <Field label="Broadcast" value={subnetInfo.broadcast} mono />
                    <Field label="Mask" value={subnetInfo.mask} mono />
                    <Field label="Wildcard" value={subnetInfo.wildcard} mono />
                    <Field label="Prefix" value={`/${subnetInfo.prefix}`} mono />
                    <Field label="Host count" value={String(subnetInfo.hostCount)} mono />
                    <Field label="Address count" value={String(subnetInfo.addressCount)} mono />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    getText={() => { handleHistory({ ts: Date.now(), action: "subnet", family: null, count: 1 }); return JSON.stringify(subnetInfo, null, 2); }}
                    label="Copy JSON"
                  />
                  <ShareButton getUrl={() => buildShare()} />
                  <ClearButton onClick={() => setSubnetCidr("")} />
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Invalid CIDR — try something like 10.0.0.0/24.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "lookup" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="lookup-input">IP or MAC address to look up</Label>
              <Input
                id="lookup-input"
                value={lookupInput}
                onChange={(e) => setLookupInput(e.target.value)}
                placeholder="e.g. 8.8.8.8 or 00:50:56:00:00:01 or fe80::1"
                className="font-mono text-sm"
              />
            </div>
            {lookupResult ? (
              <div className="rounded-lg border p-3 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  {lookupResult.kind === "ip" ? <Network className="h-3.5 w-3.5" /> : <Cpu className="h-3.5 w-3.5" />}
                  {lookupResult.kind === "ip" ? "IP lookup" : "MAC lookup"}
                </div>
                {lookupResult.kind === "ip" ? (
                  <div className="space-y-1">
                    <div className="font-mono text-base text-foreground">{lookupResult.data.address}</div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[10px]">{lookupResult.data.family}</Badge>
                      {lookupResult.data.klass && (
                        <Badge variant="outline" className="text-[10px]">Class {lookupResult.data.klass}</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">scope: {lookupResult.data.scope}</Badge>
                      {lookupResult.data.isLoopback && <Badge variant="secondary" className="text-[10px]">loopback</Badge>}
                      {lookupResult.data.isPrivate && <Badge variant="secondary" className="text-[10px]">private</Badge>}
                      {lookupResult.data.isLinkLocal && <Badge variant="secondary" className="text-[10px]">link-local</Badge>}
                      {lookupResult.data.isMulticast && <Badge variant="secondary" className="text-[10px]">multicast</Badge>}
                      {lookupResult.data.isReserved && <Badge variant="secondary" className="text-[10px]">reserved</Badge>}
                    </div>
                    <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5 mt-1">
                      {lookupResult.data.notes.map((n, i) => <li key={i}>{n}</li>)}
                    </ul>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="font-mono text-base text-foreground">{lookupResult.data.mac}</div>
                    <div className="flex flex-wrap gap-1">
                      {lookupResult.data.vendor
                        ? <Badge variant="secondary" className="text-[10px]">{lookupResult.data.vendor}</Badge>
                        : <Badge variant="outline" className="text-[10px]">Unknown vendor</Badge>}
                      <Badge variant="outline" className="text-[10px]">
                        {lookupResult.data.isLaa ? "LAA (locally administered)" : "UAA (universal)"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {lookupResult.data.multicast ? "multicast" : "unicast"}
                      </Badge>
                    </div>
                    <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5 mt-1">
                      {lookupResult.data.notes.map((n, i) => <li key={i}>{n}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ) : lookupInput.trim() ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Could not parse as IPv4, IPv6, or MAC address.
              </div>
            ) : null}
            {lookupResult && (
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => {
                    handleHistory({
                      ts: Date.now(),
                      action: lookupResult.kind === "ip" ? "lookup_ip" : "lookup_mac",
                      family: lookupResult.kind === "ip" ? "ipv4" : "mac",
                      count: 1,
                    });
                    return JSON.stringify(lookupResult.data, null, 2);
                  }}
                  label="Copy JSON"
                />
                <ClearButton onClick={() => setLookupInput("")} />
              </div>
            )}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.action}</Badge>
                  {h.family && <Badge variant="outline" className="mr-2">{h.family}</Badge>}
                  <Badge variant="outline" className="mr-2">{h.count} items</Badge>
                  <span className="text-muted-foreground">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All address generation, OUI lookups, and subnet math runs locally. History stores only metadata (counts + timestamps) in localStorage on this device — never the addresses themselves.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm ${mono ? "font-mono" : ""} text-foreground`}>{value}</div>
    </div>
  );
}
