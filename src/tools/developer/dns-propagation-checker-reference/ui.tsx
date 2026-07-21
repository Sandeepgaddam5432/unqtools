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
  History, Globe, Terminal, AlertCircle, Cpu, Clock,
  MapPin, ChevronRight,
} from "lucide-react";
import {
  HISTORY_MAX,
  RECORD_TYPES,
  REGIONS,
  REGION_LABELS,
  RESOLVERS,
  getResolver,
  resolversByRegion,
  normalizeDomain,
  isValidDomain,
  generateCommand,
  generateCommands,
  generateAuthoritativeCompare,
  computeEta,
  generateBashScript,
  generatePowershellScript,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type RecordType,
  type Region,
  type CommandTool,
  type MatchMode,
  type DigFlag,
  type GeneratedCommand,
  type HistoryEntry,
  type CommandOptions,
} from "./logic";

type Tab = "commands" | "eta" | "authoritative";

const TABS: { id: Tab; label: string }[] = [
  { id: "commands", label: "Propagation Commands" },
  { id: "eta", label: "TTL ETA" },
  { id: "authoritative", label: "Auth vs Recursive" },
];

const ALL_TOOLS: { id: CommandTool; label: string }[] = [
  { id: "dig", label: "dig" },
  { id: "kdig", label: "kdig (DoH)" },
  { id: "resolve-dnsname", label: "PowerShell Resolve-DnsName" },
];

const ALL_MATCH_MODES: { id: MatchMode; label: string; hint: string }[] = [
  { id: "exact", label: "exact", hint: "Answer must equal the expected value (uses grep -Fx)" },
  { id: "contains", label: "contains", hint: "Expected value must appear anywhere in the answer (uses grep -F)" },
  { id: "regex", label: "regex", hint: "Answer is tested against a JavaScript regex (uses grep -E)" },
];

const ALL_FLAGS: { id: DigFlag["id"]; label: string; hint: string }[] = [
  { id: "short", label: "+short", hint: "Terse output (answer values only)" },
  { id: "answer", label: "+noall +answer", hint: "Show only the answer section" },
  { id: "dnssec", label: "+dnssec", hint: "Set DO bit, request RRSIG/NSEC" },
  { id: "multi", label: "+multi", hint: "Human-readable line wrapping" },
  { id: "trace", label: "+trace", hint: "Iterative root→authoritative traversal" },
];

export default function DnsPropagationCheckerReference() {
  const [tab, setTab] = useState<Tab>("commands");
  const [domain, setDomain] = useState("example.com");
  const [recordType, setRecordType] = useState<RecordType>("A");
  const [tool, setTool] = useState<CommandTool>("dig");
  const [matchMode, setMatchMode] = useState<MatchMode>("exact");
  const [expected, setExpected] = useState("93.184.216.34");
  const [ttl, setTtl] = useState(3600);
  const [selectedRegions, setSelectedRegions] = useState<Region[]>([]);
  const [flags, setFlags] = useState<DigFlag["id"][]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.domain !== undefined) setDomain(p.domain);
      if (p.recordType) setRecordType(p.recordType);
      if (p.tool) setTool(p.tool);
      if (p.matchMode) setMatchMode(p.matchMode);
      if (p.expected !== undefined) setExpected(p.expected);
      if (p.regions && p.regions.length > 0) setSelectedRegions(p.regions);
      if (p.flags && p.flags.length > 0) setFlags(p.flags);
      if (p.domain || p.recordType) toast.info("Loaded from share link");
    }
  }, []);

  const normalizedDomain = useMemo(() => normalizeDomain(domain), [domain]);
  const domainValid = useMemo(() => isValidDomain(domain), [domain]);
  const activeResolvers = useMemo(
    () => resolversByRegion(selectedRegions),
    [selectedRegions],
  );

  const commandOpts: CommandOptions = useMemo(
    () => ({
      domain,
      recordType,
      tool,
      matchMode,
      expected,
      flags: flags.map((id) => ({ id })),
    }),
    [domain, recordType, tool, matchMode, expected, flags],
  );

  const commands: GeneratedCommand[] = useMemo(
    () => (domainValid ? generateCommands(activeResolvers, commandOpts) : []),
    [activeResolvers, commandOpts, domainValid],
  );

  const eta = useMemo(() => computeEta(ttl), [ttl]);
  const authCompare = useMemo(
    () => (domainValid ? generateAuthoritativeCompare(domain, recordType, getResolver("google")!) : []),
    [domain, recordType, domainValid],
  );

  const bashScript = useMemo(
    () => generateBashScript(commands, domain, recordType),
    [commands, domain, recordType],
  );
  const powershellScript = useMemo(
    () => generatePowershellScript(commands, domain, recordType),
    [commands, domain, recordType],
  );
  const csvExport = useMemo(() => renderCsv(commands), [commands]);
  const jsonExport = useMemo(() => renderJson(commands), [commands]);

  const handleToggleRegion = useCallback((r: Region) => {
    setSelectedRegions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }, []);

  const handleToggleFlag = useCallback((f: DigFlag["id"]) => {
    setFlags((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }, []);

  const handleSaveHistory = useCallback((action: HistoryEntry["action"], count: number) => {
    saveHistory({ ts: Date.now(), action, recordType, count });
    setHistory(loadHistory());
  }, [recordType]);

  const handleClear = useCallback(() => {
    setDomain("example.com");
    setRecordType("A");
    setTool("dig");
    setMatchMode("exact");
    setExpected("93.184.216.34");
    setTtl(3600);
    setSelectedRegions([]);
    setFlags([]);
    toast.info("Reset to defaults");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const shareUrl = useMemo(
    () => buildShareUrl({
      domain,
      recordType,
      tool,
      matchMode,
      expected,
      regions: selectedRegions,
      flags,
    }),
    [domain, recordType, tool, matchMode, expected, selectedRegions, flags],
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

      <Card>
        <CardContent className="p-3">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong className="text-foreground">Honesty note:</strong> DNS propagation checking requires the network.
              This tool generates <code className="font-mono">dig</code> /{" "}
              <code className="font-mono">kdig</code> (DoH) /{" "}
              <code className="font-mono">Resolve-DnsName</code> (PowerShell) commands for you to run in your terminal
              against {RESOLVERS.length}+ global resolvers — it never sends queries itself. "Location" reflects the
              resolver's advertised region; anycast and geo-DNS mean some differences are expected, not failures.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Globe className="h-4 w-4" /> Query settings
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Domain">
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                className={`font-mono text-sm h-8 ${domainValid ? "" : "border-destructive"}`}
              />
            </Field>
            <Field label="Record type">
              <select
                value={recordType}
                onChange={(e) => setRecordType(e.target.value as RecordType)}
                className="h-8 text-xs rounded border bg-background px-2 w-full"
              >
                {RECORD_TYPES.map((r) => (
                  <option key={r.type} value={r.type}>{r.type} — {r.summary}</option>
                ))}
              </select>
            </Field>
            <Field label="Tool">
              <select
                value={tool}
                onChange={(e) => setTool(e.target.value as CommandTool)}
                className="h-8 text-xs rounded border bg-background px-2 w-full"
              >
                {ALL_TOOLS.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Match mode (expected vs actual)">
              <select
                value={matchMode}
                onChange={(e) => setMatchMode(e.target.value as MatchMode)}
                className="h-8 text-xs rounded border bg-background px-2 w-full"
              >
                {ALL_MATCH_MODES.map((m) => (
                  <option key={m.id} value={m.id}>{m.label} — {m.hint.slice(0, 50)}</option>
                ))}
              </select>
            </Field>
            <Field label={`Expected value (${matchMode})`}>
              <Input
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
                placeholder="93.184.216.34 (leave empty to skip matching)"
                className="font-mono text-sm h-8"
              />
            </Field>
            <Field label="Record TTL (seconds, for ETA tab)">
              <Input
                type="number"
                value={ttl}
                onChange={(e) => setTtl(Number(e.target.value) || 0)}
                placeholder="3600"
                className="font-mono text-sm h-8"
              />
            </Field>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Resolver regions (optional — leave empty for all {RESOLVERS.length})
            </Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {REGIONS.map((r) => (
                <label key={r.id} className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRegions.includes(r.id)}
                    onChange={() => handleToggleRegion(r.id)}
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>

          {tool !== "resolve-dnsname" && (
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">dig/kdig flags (optional)</Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {ALL_FLAGS.map((f) => (
                  <label key={f.id} className="flex items-center gap-1 text-xs cursor-pointer" title={f.hint}>
                    <input
                      type="checkbox"
                      checked={flags.includes(f.id)}
                      onChange={() => handleToggleFlag(f.id)}
                    />
                    <code className="font-mono">{f.label}</code>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <ShareButton getUrl={() => { handleSaveHistory("generate", commands.length); return shareUrl; }} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {tab === "commands" && (
        <>
          {!domainValid ? (
            <EmptyState
              title="Enter a valid domain"
              hint="Domain must have at least two labels (e.g. example.com) with only letters, digits, and hyphens."
              icon={<Globe className="h-8 w-8" />}
            />
          ) : commands.length === 0 ? (
            <EmptyState
              title="No resolvers match the selected regions"
              hint="Deselect all regions to use the full set."
              icon={<Globe className="h-8 w-8" />}
            />
          ) : (
            <>
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Terminal className="h-4 w-4" /> {commands.length} commands ({activeResolvers.length} resolvers)
                    </h3>
                    <Badge variant="outline" className="text-[10px]">{normalizedDomain} · {recordType}</Badge>
                  </div>
                  <div className="space-y-2 max-h-[600px] overflow-auto">
                    {commands.map((c, i) => (
                      <div key={i} className="rounded border bg-background px-3 py-2 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">{c.resolverId}</Badge>
                          <Badge variant="outline" className="text-[10px]">
                            <MapPin className="h-3 w-3 mr-0.5" />{REGION_LABELS[c.region]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{c.resolverLabel}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-xs text-foreground flex-1 break-all">{c.command}</code>
                          <CopyButton getText={() => { handleSaveHistory("generate", 1); return c.command; }} label="" size="icon-sm" />
                        </div>
                        {c.compareCommand && (
                          <div className="rounded bg-muted/40 px-2 py-1">
                            <div className="flex items-center gap-2">
                              <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <code className="font-mono text-[11px] text-muted-foreground flex-1 break-all">{c.compareCommand}</code>
                              <CopyButton getText={() => c.compareCommand} label="" size="icon-sm" />
                            </div>
                          </div>
                        )}
                        <p className="text-[11px] text-muted-foreground">{c.explanation}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Cpu className="h-4 w-4" /> Batch scripts & exports
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <CopyButton
                      getText={() => { handleSaveHistory("batch", commands.length); return bashScript; }}
                      label="Copy bash script"
                    />
                    <DownloadButton
                      getText={() => { handleSaveHistory("batch", commands.length); return bashScript; }}
                      filename="dns-propagation-batch.sh"
                      mime="text/x-shellscript"
                      label="Download .sh"
                    />
                    <CopyButton
                      getText={() => powershellScript}
                      label="Copy PowerShell"
                    />
                    <DownloadButton
                      getText={() => powershellScript}
                      filename="dns-propagation-batch.ps1"
                      mime="text/plain"
                      label="Download .ps1"
                    />
                    <DownloadButton
                      getText={() => csvExport}
                      filename="dns-propagation-plan.csv"
                      mime="text/csv"
                      label="Download CSV"
                    />
                    <DownloadButton
                      getText={() => jsonExport}
                      filename="dns-propagation-plan.json"
                      mime="application/json"
                      label="Download JSON"
                    />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {tab === "eta" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> TTL-based propagation ETA
            </h3>
            <p className="text-xs text-muted-foreground">
              TTL is set in the Query settings card above. The ETA estimates when most caching resolvers
              will have refreshed their answer after the authoritative record changes.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="TTL" value={eta.ttlSeconds + "s"} />
              <Stat label="~50% propagated" value={eta.p50Human} highlight="good" />
              <Stat label="~95% propagated" value={eta.p95Human} />
              <Stat label="Worst case" value={eta.worstHuman} highlight="bad" />
            </div>
            <div className="rounded border bg-muted/40 px-3 py-2 text-xs">
              <p className="text-foreground">{eta.explanation}</p>
            </div>
            <div className="rounded border bg-background px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Common TTL reference</p>
              <ul className="text-xs text-muted-foreground list-disc ml-4 mt-1">
                <li>60s — fast failover (CDN, GSLB)</li>
                <li>300s — 5 min, common for A records behind load balancers</li>
                <li>3600s — 1 hour, the classic default for A/MX records</li>
                <li>86400s — 1 day, common for NS/SOA records (slow propagation by design)</li>
                <li>604800s — 1 week, maximum recommended; DNSSEC DS records sometimes use this</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "authoritative" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Cpu className="h-4 w-4" /> Authoritative vs recursive comparison
            </h3>
            <p className="text-xs text-muted-foreground">
              Compare the source-of-truth answer from the authoritative NS against the cached answer
              from a recursive resolver. Run all three steps; if step 2 and step 3 differ, the recursive
              resolver is still serving a stale cached answer.
            </p>
            {!domainValid ? (
              <p className="text-xs text-destructive">Enter a valid domain first.</p>
            ) : (
              <div className="space-y-2">
                {authCompare.map((c, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">Step {i + 1}</Badge>
                    </div>
                    <p className="text-xs text-foreground">{c.explanation}</p>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs text-foreground flex-1 break-all">{c.command}</code>
                      <CopyButton getText={() => c.command} label="" size="icon-sm" />
                    </div>
                  </div>
                ))}
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
                <History className="h-4 w-4" /> Recent ({history.length} of {HISTORY_MAX})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{h.action}</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.recordType}</Badge>
                  <span className="text-muted-foreground">{h.count} cmd(s)</span>
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3 space-y-1">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All command generation, ETA computation, batch scripts,
            and exports run locally. History stores only metadata (action + record type + count + timestamp) — never the
            queried domain names.
          </p>
        </CardContent>
      </Card>
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

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
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
