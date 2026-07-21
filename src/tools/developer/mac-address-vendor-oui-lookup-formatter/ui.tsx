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
  History, Network, Wand2, Search as SearchIcon, ShieldAlert,
  AlertTriangle, CheckCircle2, Cpu, Tag,
} from "lucide-react";
import {
  DB_VERSION,
  OUI_REGISTRY,
  FORMAT_LABELS,
  BLOCK_LABELS,
  MODE_LABELS,
  validateMac,
  formatAll,
  formatOne,
  resolveMac,
  reverseSearch,
  formatOuiPrefix,
  generateRandomMacs,
  batchLookup,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type MacFormat,
  type MacCase,
  type MacInfo,
  type GeneratedMac,
  type RandomMacOptions,
  type HistoryEntry,
  type VendorSearchResult,
} from "./logic";

type Tab = "lookup" | "format" | "generate" | "reverse" | "batch";

const TABS: { id: Tab; label: string }[] = [
  { id: "lookup", label: "Vendor Lookup" },
  { id: "format", label: "Formatter" },
  { id: "generate", label: "Generator" },
  { id: "reverse", label: "Reverse Search" },
  { id: "batch", label: "Batch" },
];

export default function MacAddressVendorOuiLookupFormatter() {
  const [tab, setTab] = useState<Tab>("lookup");
  const [input, setInput] = useState("");
  const [caseMode, setCaseMode] = useState<MacCase>("upper");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Generator state
  const [genFormat, setGenFormat] = useState<MacFormat>("colon");
  const [genCase, setGenCase] = useState<MacCase>("upper");
  const [genMode, setGenMode] = useState<RandomMacOptions["mode"]>("random");
  const [genPrefix, setGenPrefix] = useState("005056");
  const [genCount, setGenCount] = useState(5);
  const [genSeed, setGenSeed] = useState("");
  const [generated, setGenerated] = useState<GeneratedMac[]>([]);

  // Reverse-search state
  const [vendorQuery, setVendorQuery] = useState("");
  const [vendorResults, setVendorResults] = useState<VendorSearchResult[]>([]);

  // Batch state
  const [batchText, setBatchText] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.mac) {
        setInput(p.mac);
        const fmt = (p.fmt as MacFormat | undefined);
        if (fmt && TABS.some((t) => t.id === "lookup")) {
          if (p.tab && TABS.some((t) => t.id === p.tab)) setTab(p.tab as Tab);
        }
      }
      if (p.vendor) {
        setTab("reverse");
        setVendorQuery(p.vendor);
      }
      if (p.mac || p.vendor) toast.info("Loaded from share link");
    }
  }, []);

  const validation = useMemo(() => validateMac(input), [input]);
  const info: MacInfo | null = useMemo(
    () => (validation.valid && validation.normalized ? resolveMac(input) : null),
    [input, validation.valid, validation.normalized],
  );
  const formats = useMemo(
    () => (validation.valid && validation.normalized ? formatAll(validation.normalized, caseMode) : null),
    [validation, caseMode],
  );

  const batchResult = useMemo(() => batchLookup(batchText), [batchText]);

  const handleGenerate = useCallback(() => {
    try {
      const out = generateRandomMacs(
        {
          format: genFormat,
          case: genCase,
          mode: genMode,
          vendorPrefix: genMode === "vendor" ? genPrefix : undefined,
          seed: genSeed || undefined,
        },
        genCount,
      );
      setGenerated(out);
      saveHistory({ ts: Date.now(), action: "generate", count: out.length });
      setHistory(loadHistory());
      toast.success(`Generated ${out.length} MAC(s)`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [genFormat, genCase, genMode, genPrefix, genCount, genSeed]);

  const handleReverse = useCallback(() => {
    const r = reverseSearch(vendorQuery);
    setVendorResults(r);
    if (r.length > 0) {
      saveHistory({ ts: Date.now(), action: "reverse", count: r.length });
      setHistory(loadHistory());
    }
  }, [vendorQuery]);

  const handleSaveLookupHistory = useCallback(() => {
    if (info) {
      saveHistory({ ts: Date.now(), action: "lookup", count: 1 });
      setHistory(loadHistory());
    }
  }, [info]);

  const handleClear = useCallback(() => {
    setInput("");
    setGenerated([]);
    setVendorResults([]);
    setBatchText("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const shareUrl = useMemo(
    () => buildShareUrl({
      ...(tab === "lookup" || tab === "format" ? { mac: input, fmt: "colon" } : {}),
      ...(tab === "reverse" ? { vendor: vendorQuery } : {}),
      tab,
    }),
    [tab, input, vendorQuery],
  );

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {TABS.map((t) => (
              <Button
                key={t.id}
                variant={tab === t.id ? "default" : "outline"}
                size="sm"
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {(tab === "lookup" || tab === "format") && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="mac-input">MAC address (any format — colon, hyphen, Cisco dot, bare hex, EUI-64)</Label>
              <Input
                id="mac-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="00:1A:2B:3C:4D:5E or 00-1A-2B-3C-4D-5E or 001A.2B3C.4D5E"
                className="font-mono text-sm"
              />
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {input && (
                  validation.valid
                    ? <Badge variant="secondary" className="text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" /> Valid · {validation.normalized}</Badge>
                    : <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="h-3 w-3" /> Invalid</Badge>
                )}
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  case:
                  <select
                    value={caseMode}
                    onChange={(e) => setCaseMode(e.target.value as MacCase)}
                    className="h-7 text-xs rounded border bg-background px-1"
                  >
                    <option value="upper">UPPER</option>
                    <option value="lower">lower</option>
                  </select>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "lookup" && info && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Network className="h-4 w-4" /> Vendor Resolution
              </h3>
              <ShareButton getUrl={() => { handleSaveLookupHistory(); return shareUrl; }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <InfoTile label="Normalized MAC" value={formatOne(info.normalized, "colon", caseMode)} mono />
              <InfoTile label="OUI (24-bit)" value={info.oui} mono />
              <InfoTile
                label="Vendor"
                value={info.vendor ?? "Unknown / locally-administered"}
                highlight={info.vendor ? "good" : "bad"}
              />
              <InfoTile label="Registry block" value={BLOCK_LABELS[info.block]} />
              <InfoTile label="Prefix bits" value={info.prefixBits > 0 ? `${info.prefixBits} bits` : "—"} />
              <InfoTile label="EUI-64 expansion" value={formatAll(info.normalized, caseMode).eui64} mono />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant={info.isLaa ? "secondary" : "outline"} className="text-[10px] gap-1">
                <Tag className="h-3 w-3" />
                {info.isLaa ? "Locally-Administered (LAA)" : "Universally-Administered (UAA)"}
              </Badge>
              <Badge variant={info.multicast ? "secondary" : "outline"} className="text-[10px] gap-1">
                <Cpu className="h-3 w-3" />
                {info.multicast ? "Multicast (I/G=1)" : "Unicast (I/G=0)"}
              </Badge>
              {info.isBroadcast && <Badge variant="destructive" className="text-[10px] gap-1"><ShieldAlert className="h-3 w-3" /> Broadcast</Badge>}
              {info.isNull && <Badge variant="outline" className="text-[10px] gap-1"><ShieldAlert className="h-3 w-3" /> Null</Badge>}
            </div>
            {info.notes.length > 0 && (
              <ul className="space-y-1 text-xs text-muted-foreground pt-1">
                {info.notes.map((n, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-primary">•</span> {n}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "lookup" && input && !info && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Could not parse MAC. {(validation.notes ?? []).join("; ")}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "lookup" && !input && (
        <EmptyState
          title="Enter a MAC address to look up its vendor"
          hint="Accepts colon, hyphen, Cisco dot, bare hex, and EUI-64 forms. Bundled IEEE OUI DB: 200+ vendors with MA-L / MA-M / MA-S / IAB longest-prefix matching."
          icon={<Network className="h-8 w-8" />}
        />
      )}

      {tab === "format" && formats && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Cpu className="h-4 w-4" /> Formatted Notations
            </h3>
            <div className="space-y-1.5">
              {(Object.keys(FORMAT_LABELS) as MacFormat[]).map((fmt) => {
                const value = formatOne(validation.normalized!, fmt, caseMode);
                return (
                  <div key={fmt} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                    <Badge variant="outline" className="text-[10px] w-32 justify-center">{FORMAT_LABELS[fmt].split(" ")[0]}</Badge>
                    <span className="font-mono text-foreground flex-1 truncate">{value}</span>
                    <CopyButton getText={() => value} label="" size="icon-sm" />
                  </div>
                );
              })}
              <div className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                <Badge variant="outline" className="text-[10px] w-32 justify-center">Bit-rev</Badge>
                <span className="font-mono text-foreground flex-1 truncate">{formats.invertedColon}</span>
                <CopyButton getText={() => formats.invertedColon} label="" size="icon-sm" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <ShareButton getUrl={() => shareUrl} />
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "format" && !formats && (
        <EmptyState
          title="Enter a MAC address to see all formats"
          hint="Converts between colon, hyphen, Cisco dot, bare hex, and EUI-64 — with upper/lower case toggle."
          icon={<Cpu className="h-8 w-8" />}
        />
      )}

      {tab === "generate" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Wand2 className="h-4 w-4" /> Random MAC Generator
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Field label="Output format">
                <select
                  value={genFormat}
                  onChange={(e) => setGenFormat(e.target.value as MacFormat)}
                  className="h-8 text-xs rounded border bg-background px-2 w-full"
                >
                  {(Object.keys(FORMAT_LABELS) as MacFormat[]).map((f) => (
                    <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Case">
                <select
                  value={genCase}
                  onChange={(e) => setGenCase(e.target.value as MacCase)}
                  className="h-8 text-xs rounded border bg-background px-2 w-full"
                >
                  <option value="upper">UPPER</option>
                  <option value="lower">lower</option>
                </select>
              </Field>
              <Field label="Mode">
                <select
                  value={genMode}
                  onChange={(e) => setGenMode(e.target.value as RandomMacOptions["mode"])}
                  className="h-8 text-xs rounded border bg-background px-2 w-full"
                >
                  {(Object.keys(MODE_LABELS) as RandomMacOptions["mode"][]).map((m) => (
                    <option key={m} value={m}>{MODE_LABELS[m]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Vendor prefix (vendor mode only)">
                <Input
                  value={genPrefix}
                  onChange={(e) => setGenPrefix(e.target.value)}
                  placeholder="005056"
                  className="font-mono text-xs h-8"
                />
              </Field>
              <Field label="Count (1-1000)">
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={genCount}
                  onChange={(e) => setGenCount(Math.max(1, Math.min(1000, parseInt(e.target.value || "1", 10))))}
                  className="text-xs h-8"
                />
              </Field>
              <Field label="Seed (optional, for reproducibility)">
                <Input
                  value={genSeed}
                  onChange={(e) => setGenSeed(e.target.value)}
                  placeholder="my-seed"
                  className="text-xs h-8"
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleGenerate} size="sm" className="gap-1.5">
                <Wand2 className="h-3.5 w-3.5" /> Generate
              </Button>
              <ShareButton getUrl={() => shareUrl} />
              <ClearButton onClick={handleClear} />
            </div>
            {generated.length > 0 && (
              <div className="space-y-1 max-h-[400px] overflow-auto">
                {generated.map((m) => (
                  <div key={m.index} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                    <span className="text-muted-foreground text-[10px] w-6">{m.index + 1}</span>
                    <span className="font-mono text-foreground flex-1 truncate">{m.mac}</span>
                    {m.vendor && <Badge variant="outline" className="text-[10px]">{m.vendor}</Badge>}
                    {m.locallyAdministered && <Badge variant="secondary" className="text-[10px]">LAA</Badge>}
                    {m.multicast && <Badge variant="secondary" className="text-[10px]">MC</Badge>}
                    <CopyButton getText={() => m.mac} label="" size="icon-sm" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "reverse" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <SearchIcon className="h-4 w-4" /> Reverse Search (Vendor → Prefixes)
            </h3>
            <div className="flex gap-2">
              <Input
                value={vendorQuery}
                onChange={(e) => setVendorQuery(e.target.value)}
                placeholder="e.g. Cisco, Apple, VMware"
                className="text-sm"
              />
              <Button onClick={handleReverse} size="sm">Search</Button>
            </div>
            {vendorResults.length > 0 && (
              <div className="space-y-2 max-h-[400px] overflow-auto">
                {vendorResults.map((r) => (
                  <div key={r.vendor} className="rounded border bg-background px-3 py-2 text-xs">
                    <div className="font-medium text-foreground">{r.vendor}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {r.prefixes.map((p, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] font-mono">
                          {p.formatted} ({p.block}, {p.bits}b)
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {vendorQuery && vendorResults.length === 0 && (
              <p className="text-xs text-muted-foreground">No matching vendors in the bundled DB.</p>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "batch" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Cpu className="h-4 w-4" /> Batch Lookup
            </h3>
            <Textarea
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder={"00:50:56:AB:CD:EF\n00:1A:2B:3C:4D:5E\n02:1A:2B:3C:4D:5E"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            <div className="grid grid-cols-3 gap-2 text-xs">
              <Stat label="Total" value={batchResult.total} />
              <Stat label="Valid" value={batchResult.ok.length} highlight={batchResult.ok.length > 0 ? "good" : undefined} />
              <Stat label="Invalid" value={batchResult.invalid.length} highlight={batchResult.invalid.length > 0 ? "bad" : undefined} />
            </div>
            {batchResult.ok.length > 0 && (
              <div className="space-y-1 max-h-[300px] overflow-auto">
                {batchResult.ok.map((info, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                    <span className="font-mono text-foreground flex-1 truncate">{formatOne(info.normalized, "colon")}</span>
                    {info.vendor
                      ? <Badge variant="outline" className="text-[10px]">{info.vendor}</Badge>
                      : <Badge variant="secondary" className="text-[10px]">unknown</Badge>}
                    {info.locallyAdministered && <Badge variant="secondary" className="text-[10px]">LAA</Badge>}
                    {info.multicast && <Badge variant="secondary" className="text-[10px]">MC</Badge>}
                  </div>
                ))}
              </div>
            )}
            {batchResult.invalid.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-destructive">Invalid lines:</p>
                {batchResult.invalid.map((inv, i) => (
                  <div key={i} className="rounded border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs">
                    <span className="font-mono">{inv.input}</span>
                    <span className="text-muted-foreground ml-2">— {inv.notes.join("; ")}</span>
                  </div>
                ))}
              </div>
            )}
            {batchResult.ok.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => renderCsv(batchResult.ok)} label="Copy CSV" />
                <DownloadButton getText={() => renderCsv(batchResult.ok)} filename="mac-vendors.csv" mime="text/csv" label="Download CSV" />
                <DownloadButton getText={() => renderJson(batchResult.ok)} filename="mac-vendors.json" mime="application/json" label="Download JSON" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3 space-y-1">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Bundled OUI DB:</strong> {OUI_REGISTRY.length} entries · {DB_VERSION}. 100% offline — no MACs are uploaded.
          </p>
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> History stores only operation metadata (action + count + timestamp), never the MAC addresses themselves.
          </p>
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
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{h.action}</Badge>
                  <span className="text-muted-foreground">{h.count} item(s)</span>
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoTile({
  label, value, mono, highlight,
}: { label: string; value: string; mono?: boolean; highlight?: "good" | "bad" }) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-medium ${color} ${mono ? "font-mono" : ""} truncate`} title={value}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: "good" | "bad" }) {
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
