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
  History, ArrowLeftRight, Terminal, AlertCircle, Cpu,
  ChevronRight, BookOpen,
} from "lucide-react";
import {
  CIDR_MAX_ADDRESSES,
  RESOLVERS,
  getResolver,
  buildReverseZone,
  enumerateCidr,
  generateCommand,
  generateAllCommands,
  generateCidrCommands,
  buildFcrdnsChain,
  buildHostnameChain,
  parsePtrRecord,
  generateBashScript,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CommandTool,
  type ResolverId,
  type DigFlag,
  type GeneratedCommand,
  type HistoryEntry,
} from "./logic";

type Tab = "single" | "cidr" | "fcrdns" | "parse";

const TABS: { id: Tab; label: string }[] = [
  { id: "single", label: "Single IP" },
  { id: "cidr", label: "CIDR Range" },
  { id: "fcrdns", label: "FCrDNS Chain" },
  { id: "parse", label: "PTR Parser" },
];

const ALL_TOOLS: { id: CommandTool; label: string }[] = [
  { id: "dig", label: "dig" },
  { id: "nslookup", label: "nslookup" },
  { id: "kdig", label: "kdig (DoH)" },
  { id: "host", label: "host" },
];

const ALL_FLAGS: { id: DigFlag; label: string; hint: string }[] = [
  { id: "short", label: "+short", hint: "Terse output (answer values only)" },
  { id: "answer", label: "+noall +answer", hint: "Show only the answer section" },
  { id: "multi", label: "+multi", hint: "Human-readable line wrapping" },
  { id: "dnssec", label: "+dnssec", hint: "Set DO bit, request RRSIG/NSEC" },
];

export default function ReverseDnsPtrLookupGenerator() {
  const [tab, setTab] = useState<Tab>("single");
  const [ip, setIp] = useState("192.0.2.1");
  const [cidr, setCidr] = useState("192.0.2.0/30");
  const [hostname, setHostname] = useState("example.com");
  const [parseInput, setParseInput] = useState("1.2.0.192.in-addr.arpa. 3600 IN PTR host.example.com.");
  const [tool, setTool] = useState<CommandTool>("dig");
  const [resolverId, setResolverId] = useState<ResolverId>("google");
  const [customServer, setCustomServer] = useState("");
  const [flags, setFlags] = useState<DigFlag[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.ip) setIp(p.ip);
      if (p.tool) setTool(p.tool);
      if (p.resolver) setResolverId(p.resolver);
      if (p.customServer !== undefined) setCustomServer(p.customServer);
      if (p.flags && p.flags.length > 0) setFlags(p.flags);
      if (p.ip || p.tool) toast.info("Loaded from share link");
    }
  }, []);

  const zoneResult = useMemo(() => buildReverseZone(ip), [ip]);
  const cidrResult = useMemo(() => enumerateCidr(cidr), [cidr]);
  const fcrdns = useMemo(() => buildFcrdnsChain(ip, resolverId, customServer), [ip, resolverId, customServer]);
  const parseResult = useMemo(() => parsePtrRecord(parseInput), [parseInput]);
  const hostnameCmds = useMemo(() => buildHostnameChain(hostname, resolverId, customServer), [hostname, resolverId, customServer]);

  const singleCommands: GeneratedCommand[] = useMemo(
    () => generateAllCommands(ip, resolverId, customServer, flags),
    [ip, resolverId, customServer, flags],
  );

  const cidrCommands = useMemo(
    () => generateCidrCommands(cidr, tool, resolverId, customServer, flags),
    [cidr, tool, resolverId, customServer, flags],
  );

  const singleForTool = useMemo(
    () => generateCommand({ tool, ip, resolver: resolverId, customServer, flags }) ?? null,
    [tool, ip, resolverId, customServer, flags],
  );

  const bashScript = useMemo(() => {
    if (!cidrResult.ok) return "";
    return generateBashScript(cidrResult.ips, tool, resolverId, customServer, flags);
  }, [cidrResult, tool, resolverId, customServer, flags]);

  const handleToggleFlag = useCallback((f: DigFlag) => {
    setFlags((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }, []);

  const handleSaveHistory = useCallback((action: HistoryEntry["action"], count: number) => {
    saveHistory({ ts: Date.now(), action, resolver: resolverId, count });
    setHistory(loadHistory());
  }, [resolverId]);

  const handleClear = useCallback(() => {
    setIp("192.0.2.1");
    setCidr("192.0.2.0/30");
    setHostname("example.com");
    setTool("dig");
    setResolverId("google");
    setCustomServer("");
    setFlags([]);
    toast.info("Reset to defaults");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const shareUrl = useMemo(
    () => buildShareUrl({ ip, tool, resolver: resolverId, customServer, flags }),
    [ip, tool, resolverId, customServer, flags],
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
              <strong className="text-foreground">Honesty note:</strong> Reverse DNS requires the network.
              This tool generates <code className="font-mono">dig -x</code> /{" "}
              <code className="font-mono">nslookup -type=PTR</code> /{" "}
              <code className="font-mono">kdig</code> (DoH) / <code className="font-mono">host</code> commands
              for you to run in your terminal — it never sends queries itself. PTR records are maintained by
              the IP owner/ISP, so many addresses legitimately have no PTR.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <ArrowLeftRight className="h-4 w-4" /> Settings
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Resolver">
              <select
                value={resolverId}
                onChange={(e) => setResolverId(e.target.value as ResolverId)}
                className="h-8 text-xs rounded border bg-background px-2 w-full"
              >
                {RESOLVERS.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}{r.server ? ` (${r.server})` : ""}</option>
                ))}
              </select>
            </Field>
            {resolverId === "custom" && (
              <Field label="Custom resolver IP/host">
                <Input
                  value={customServer}
                  onChange={(e) => setCustomServer(e.target.value)}
                  placeholder="1.2.3.4 or dns.example.com"
                  className="font-mono text-sm h-8"
                />
              </Field>
            )}
            <Field label="Preferred tool (used by CIDR + FCrDNS)">
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
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">dig flags (optional)</Label>
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
          <div className="flex flex-wrap gap-2">
            <ShareButton getUrl={() => { handleSaveHistory("reverse", 1); return shareUrl; }} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {tab === "single" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <Field label="IP address (IPv4 or IPv6)">
                <Input
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  placeholder="192.0.2.1 or 2001:db8::1"
                  className="font-mono text-sm h-8"
                />
              </Field>
              {zoneResult.ok ? (
                <div className="rounded border bg-muted/40 px-3 py-2 space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-mono">{zoneResult.version}</Badge>
                    <span className="font-mono text-foreground break-all">{zoneResult.zone}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={zoneResult.isPrivate ? "destructive" : "outline"} className="text-[10px]">
                      {zoneResult.classification}
                    </Badge>
                  </div>
                  {zoneResult.note && (
                    <p className="text-muted-foreground">{zoneResult.note}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-destructive">{zoneResult.error}</p>
              )}
            </CardContent>
          </Card>

          {zoneResult.ok && singleCommands.length > 0 ? (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Terminal className="h-4 w-4" /> Generated Commands ({singleCommands.length})
                </h3>
                <div className="space-y-2">
                  {singleCommands.map((c, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-mono">{c.tool}</Badge>
                        <code className="font-mono text-xs text-foreground flex-1 break-all">{c.command}</code>
                        <CopyButton getText={() => { handleSaveHistory("reverse", 1); return c.command; }} label="" size="icon-sm" />
                      </div>
                      <p className="text-[11px] text-muted-foreground">{c.explanation}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <CopyButton
                    getText={() => { handleSaveHistory("reverse", singleCommands.length); return singleCommands.map((c) => c.command).join("\n\n"); }}
                    label="Copy all"
                  />
                  <DownloadButton
                    getText={() => singleCommands.map((c) => `# ${c.tool} — ${c.explanation}\n${c.command}`).join("\n\n")}
                    filename="reverse-dns-commands.sh"
                    mime="text/x-shellscript"
                    label="Download .sh"
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              title="Enter a valid IPv4 or IPv6 address"
              hint="The tool builds the in-addr.arpa / ip6.arpa reverse-zone name and generates dig / nslookup / kdig / host commands."
              icon={<ArrowLeftRight className="h-8 w-8" />}
            />
          )}

          {singleForTool && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ChevronRight className="h-4 w-4" /> Hostname → IP → PTR chain (using {tool})
                </h3>
                <Field label="Hostname">
                  <Input
                    value={hostname}
                    onChange={(e) => setHostname(e.target.value)}
                    placeholder="example.com"
                    className="font-mono text-sm h-8"
                  />
                </Field>
                {hostnameCmds.length > 0 && (
                  <div className="space-y-2">
                    {hostnameCmds.map((c, i) => (
                      <div key={i} className="rounded border bg-background px-3 py-2 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-mono">{c.tool}</Badge>
                          <code className="font-mono text-xs text-foreground flex-1 break-all">{c.command}</code>
                          <CopyButton getText={() => c.command} label="" size="icon-sm" />
                        </div>
                        <p className="text-[11px] text-muted-foreground">{c.explanation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {tab === "cidr" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <Field label="CIDR range (IPv4 or IPv6)">
                <Input
                  value={cidr}
                  onChange={(e) => setCidr(e.target.value)}
                  placeholder="192.0.2.0/30  or  2001:db8::/126"
                  className="font-mono text-sm h-8"
                />
              </Field>
              <p className="text-[11px] text-muted-foreground">
                Cap: {CIDR_MAX_ADDRESSES} addresses (use /24 or smaller for IPv4, /120 or smaller for IPv6).
              </p>
              {cidrResult.ok ? (
                <div className="rounded border bg-muted/40 px-3 py-2 space-y-1 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{cidrResult.version}</Badge>
                    <Badge variant="outline" className="text-[10px]">/{cidrResult.prefix}</Badge>
                    <span className="text-foreground">{cidrResult.count} address(es)</span>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {cidrResult.ips.slice(0, 16).map((ipStr) => (
                      <Badge key={ipStr} variant="outline" className="text-[10px] font-mono">{ipStr}</Badge>
                    ))}
                    {cidrResult.ips.length > 16 && (
                      <span className="text-[10px] text-muted-foreground">…+{cidrResult.ips.length - 16} more</span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-destructive">{cidrResult.error}</p>
              )}
            </CardContent>
          </Card>

          {cidrCommands.ok && cidrCommands.commands.length > 0 ? (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Terminal className="h-4 w-4" /> {tool} commands ({cidrCommands.count})
                </h3>
                <div className="space-y-1 max-h-[400px] overflow-auto">
                  {cidrCommands.commands.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                      <code className="font-mono text-foreground flex-1 break-all">{c.command}</code>
                      <CopyButton getText={() => c.command} label="" size="icon-sm" />
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <CopyButton
                    getText={() => { handleSaveHistory("batch", cidrCommands.count); return bashScript; }}
                    label="Copy batch script"
                  />
                  <DownloadButton
                    getText={() => { handleSaveHistory("batch", cidrCommands.count); return bashScript; }}
                    filename="reverse-dns-batch.sh"
                    mime="text/x-shellscript"
                    label="Download .sh"
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              title="Enter a CIDR to enumerate addresses"
              hint="Each address gets its own PTR query. The 256-address cap keeps output sane."
              icon={<Terminal className="h-8 w-8" />}
            />
          )}
        </>
      )}

      {tab === "fcrdns" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Cpu className="h-4 w-4" /> Forward-Confirmed Reverse DNS (FCrDNS)
            </h3>
            <Field label="IP address">
              <Input
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="192.0.2.1"
                className="font-mono text-sm h-8"
              />
            </Field>
            {fcrdns.ok ? (
              <div className="space-y-2">
                <div className="rounded border bg-muted/40 px-3 py-2 text-xs">
                  <p className="text-foreground">{fcrdns.explanation}</p>
                  <p className="text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">Reverse-zone:</span>{" "}
                    <code className="font-mono">{fcrdns.zone}</code>
                  </p>
                </div>
                {fcrdns.steps.map((s) => (
                  <div key={s.step} className="rounded border bg-background px-3 py-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">Step {s.step}</Badge>
                      <Badge variant="outline" className="text-[10px] font-mono">{s.tool}</Badge>
                    </div>
                    <p className="text-xs text-foreground">{s.description}</p>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs text-foreground flex-1 break-all">{s.command}</code>
                      <CopyButton
                        getText={() => { handleSaveHistory("fcrdns", fcrdns.steps.length); return s.command; }}
                        label=""
                        size="icon-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-destructive">{fcrdns.error}</p>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "parse" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> PTR Zone-Record Parser
            </h3>
            <Field label="PTR record line (zone-file format)">
              <Textarea
                value={parseInput}
                onChange={(e) => setParseInput(e.target.value)}
                placeholder="1.2.0.192.in-addr.arpa. 3600 IN PTR host.example.com."
                className="min-h-[60px] resize-y font-mono text-xs"
              />
            </Field>
            {parseResult && (
              <div className="space-y-2">
                <div className="rounded border bg-background px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Parsed Fields</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
                    <FieldRow label="name" value={parseResult.name || "(empty)"} />
                    <FieldRow label="TTL" value={parseResult.ttl || "(none)"} />
                    <FieldRow label="class" value={parseResult.class || "(none)"} />
                    <FieldRow label="type" value={parseResult.type || "(none)"} />
                    <FieldRow label="target" value={parseResult.target || "(empty)"} />
                  </div>
                </div>
                {parseResult.notes.length > 0 && (
                  <div className="rounded border bg-muted/40 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Notes</p>
                    <ul className="text-xs text-muted-foreground list-disc ml-4 mt-0.5">
                      {parseResult.notes.map((n, i) => <li key={i}>{n}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <ShareButton getUrl={() => shareUrl} />
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
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{h.action}</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.resolver}</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All reverse-zone construction, command generation, FCrDNS chains, and PTR parsing run locally.
            History stores only metadata (action + resolver + count + timestamp) — never the queried IP address.
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

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs font-mono">
      <span className="text-foreground">{label}</span>
      <span className="text-muted-foreground"> = </span>
      <span className="text-foreground break-all">{value}</span>
    </div>
  );
}
