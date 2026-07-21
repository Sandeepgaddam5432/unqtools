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
  History, Globe, Terminal, BookOpen, Search as SearchIcon,
  AlertCircle, Cpu, ArrowRight,
} from "lucide-react";
import {
  RESOLVERS,
  RECORD_TYPES,
  getRecordType,
  getResolver,
  normalizeDomain,
  buildQueryName,
  generateCommands,
  parseRecord,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type RecordType,
  type ResolverId,
  type CommandOptions,
  type DigFlag,
  type GeneratedCommand,
  type HistoryEntry,
} from "./logic";

type Tab = "reference" | "commands" | "parse";

const TABS: { id: Tab; label: string }[] = [
  { id: "reference", label: "Record Reference" },
  { id: "commands", label: "Command Generator" },
  { id: "parse", label: "Record Parser" },
];

const ALL_FLAGS: { id: DigFlag; label: string; hint: string }[] = [
  { id: "short", label: "+short", hint: "Terse output (answer values only)" },
  { id: "answer", label: "+noall +answer", hint: "Show only the answer section" },
  { id: "trace", label: "+trace", hint: "Iterative root→authoritative traversal" },
  { id: "dnssec", label: "+dnssec", hint: "Set DO bit, request RRSIG/NSEC" },
  { id: "multi", label: "+multi", hint: "Human-readable line wrapping" },
  { id: "cdflag", label: "+cdflag", hint: "Disable DNSSEC validation" },
];

export default function DnsRecordLookupReference() {
  const [tab, setTab] = useState<Tab>("commands");
  const [domain, setDomain] = useState("example.com");
  const [recordType, setRecordType] = useState<RecordType>("A");
  const [resolverId, setResolverId] = useState<ResolverId>("google");
  const [customServer, setCustomServer] = useState("");
  const [dkimSelector, setDkimSelector] = useState("default");
  const [flags, setFlags] = useState<DigFlag[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Parser state
  const [parseType, setParseType] = useState<RecordType>("SOA");
  const [parseInput, setParseInput] = useState("ns.icann.org. noc.dns.icann.org. 2025010101 7200 3600 1209600 3600");

  // Reference search
  const [refQuery, setRefQuery] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.domain) setDomain(p.domain);
      if (p.type && RECORD_TYPES.some((r) => r.type === (p.type as RecordType))) {
        setRecordType(p.type as RecordType);
      }
      if (p.resolver && RESOLVERS.some((r) => r.id === (p.resolver as ResolverId))) {
        setResolverId(p.resolver as ResolverId);
      }
      if (p.selector) setDkimSelector(p.selector);
      if (p.tab && TABS.some((t) => t.id === p.tab)) setTab(p.tab as Tab);
      if (p.domain || p.type) toast.info("Loaded from share link");
    }
  }, []);

  const refFiltered = useMemo(() => {
    const q = refQuery.trim().toLowerCase();
    if (!q) return RECORD_TYPES;
    return RECORD_TYPES.filter((r) =>
      r.type.toLowerCase().includes(q)
      || r.summary.toLowerCase().includes(q)
      || r.useCases.some((u) => u.toLowerCase().includes(q)),
    );
  }, [refQuery]);

  const activeReference = useMemo(() => getRecordType(recordType), [recordType]);

  const commandOpts: CommandOptions = useMemo(
    () => ({
      tool: "dig",
      domain,
      type: recordType,
      resolver: resolverId,
      customServer,
      dkimSelector,
      flags,
    }),
    [domain, recordType, resolverId, customServer, dkimSelector, flags],
  );

  const commands: GeneratedCommand[] = useMemo(
    () => generateCommands(commandOpts),
    [commandOpts],
  );

  const parseResult = useMemo(() => {
    if (!parseInput.trim()) return null;
    return parseRecord(parseType, parseInput);
  }, [parseType, parseInput]);

  const handleToggleFlag = useCallback((f: DigFlag) => {
    setFlags((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }, []);

  const handleSaveHistory = useCallback(() => {
    saveHistory({ ts: Date.now(), action: "generate", resolver: resolverId, count: commands.length });
    setHistory(loadHistory());
  }, [resolverId, commands.length]);

  const handleClear = useCallback(() => {
    setDomain("example.com");
    setRecordType("A");
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
    () => buildShareUrl({
      domain,
      type: recordType,
      resolver: resolverId,
      ...(resolverId === "custom" ? { server: customServer } : {}),
      ...(recordType === "DKIM" ? { selector: dkimSelector } : {}),
      ...(flags.length > 0 ? { flags: flags.join(",") } : {}),
      tab,
    }),
    [tab, domain, recordType, resolverId, customServer, dkimSelector, flags],
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
              <strong className="text-foreground">Honesty note:</strong> DNS lookups require the network.
              This tool generates <code className="font-mono">dig</code> / <code className="font-mono">nslookup</code> /{" "}
              <code className="font-mono">kdig</code> (DoH) / <code className="font-mono">delv</code> (DNSSEC) /{" "}
              <code className="font-mono">host</code> commands for you to run in your terminal — it never sends queries itself.
            </span>
          </div>
        </CardContent>
      </Card>

      {tab === "commands" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Terminal className="h-4 w-4" /> Command Generator
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Field label="Domain">
                  <Input
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="example.com"
                    className="font-mono text-sm h-8"
                  />
                </Field>
                <Field label="Record type">
                  <select
                    value={recordType}
                    onChange={(e) => setRecordType(e.target.value as RecordType)}
                    className="h-8 text-xs rounded border bg-background px-2 w-full"
                  >
                    {RECORD_TYPES.map((r) => (
                      <option key={r.type} value={r.type}>{r.type} — {r.summary.slice(0, 40)}</option>
                    ))}
                  </select>
                </Field>
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
                {recordType === "DKIM" && (
                  <Field label="DKIM selector">
                    <Input
                      value={dkimSelector}
                      onChange={(e) => setDkimSelector(e.target.value)}
                      placeholder="default"
                      className="font-mono text-sm h-8"
                    />
                  </Field>
                )}
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
              {activeReference && (
                <div className="rounded border bg-muted/40 px-3 py-2 text-xs">
                  <div className="flex items-center gap-1.5 text-foreground font-medium">
                    <BookOpen className="h-3 w-3" /> {activeReference.type} · {activeReference.rfc}
                  </div>
                  <p className="text-muted-foreground mt-0.5">{activeReference.summary}</p>
                  <p className="text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">Format:</span>{" "}
                    <code className="font-mono">{activeReference.format}</code>
                  </p>
                  {resolverId !== "authoritative" && resolverId !== "custom" && (
                    <p className="text-muted-foreground mt-1">{getResolver(resolverId).notes}</p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <ShareButton getUrl={() => { handleSaveHistory(); return shareUrl; }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          {commands.length > 0 ? (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Cpu className="h-4 w-4" /> Generated Commands ({commands.length})
                </h3>
                <div className="space-y-2">
                  {commands.map((c, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-mono">{c.tool}</Badge>
                        <code className="font-mono text-xs text-foreground flex-1 break-all">{c.command}</code>
                        <CopyButton getText={() => { handleSaveHistory(); return c.command; }} label="" size="icon-sm" />
                      </div>
                      <p className="text-[11px] text-muted-foreground">{c.explanation}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <CopyButton
                    getText={() => commands.map((c) => c.command).join("\n\n")}
                    label="Copy all commands"
                  />
                  <DownloadButton
                    getText={() => commands.map((c) => `# ${c.tool} — ${c.explanation}\n${c.command}`).join("\n\n")}
                    filename="dns-commands.sh"
                    mime="text/x-shellscript"
                    label="Download .sh"
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              title="Enter a domain to generate commands"
              hint="Pick a record type and resolver to generate ready-to-paste dig / nslookup / kdig / delv / host commands."
              icon={<Terminal className="h-8 w-8" />}
            />
          )}
        </>
      )}

      {tab === "reference" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <SearchIcon className="h-4 w-4 text-muted-foreground" />
              <Input
                value={refQuery}
                onChange={(e) => setRefQuery(e.target.value)}
                placeholder="Filter record types (e.g. mail, dnssec, alias)"
                className="text-sm"
              />
            </div>
            <div className="space-y-2 max-h-[600px] overflow-auto">
              {refFiltered.map((r) => (
                <div key={r.type} className="rounded border bg-background px-3 py-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-mono">{r.type}</Badge>
                    <span className="text-[10px] text-muted-foreground">{r.rfc}</span>
                    <button
                      className="text-xs text-primary hover:underline ml-auto flex items-center gap-1"
                      onClick={() => { setRecordType(r.type); setTab("commands"); }}
                    >
                      use <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-sm text-foreground">{r.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Format:</span>{" "}
                    <code className="font-mono">{r.format}</code>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Example:</span>{" "}
                    <code className="font-mono">{r.example}</code>
                  </p>
                  <div className="pt-1">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fields</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
                      {r.fields.map((f, i) => (
                        <div key={i} className="text-[11px] font-mono">
                          <span className="text-foreground">{f.name}</span>
                          <span className="text-muted-foreground"> — {f.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="pt-1">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Common use cases</p>
                    <ul className="text-xs text-muted-foreground list-disc ml-4 mt-0.5">
                      {r.useCases.map((u, i) => <li key={i}>{u}</li>)}
                    </ul>
                  </div>
                  {r.notes.length > 0 && (
                    <div className="pt-1">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Notes</p>
                      <ul className="text-xs text-muted-foreground list-disc ml-4 mt-0.5">
                        {r.notes.map((n, i) => <li key={i}>{n}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
              {refFiltered.length === 0 && (
                <p className="text-xs text-muted-foreground">No record types match "{refQuery}".</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "parse" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Cpu className="h-4 w-4" /> Record Parser
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Field label="Record type">
                <select
                  value={parseType}
                  onChange={(e) => setParseType(e.target.value as RecordType)}
                  className="h-8 text-xs rounded border bg-background px-2 w-full"
                >
                  {["SOA", "MX", "SRV", "CAA", "DS", "TXT", "DKIM", "DMARC"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="RDATA to parse">
                  <Input
                    value={parseInput}
                    onChange={(e) => setParseInput(e.target.value)}
                    placeholder="ns. host. 2025010101 7200 3600 1209600 3600"
                    className="font-mono text-xs h-8"
                  />
                </Field>
              </div>
            </div>
            {parseResult && (
              <div className="space-y-2">
                <div className="rounded border bg-background px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Parsed Fields</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
                    {parseResult.fields.map((f, i) => (
                      <div key={i} className="text-xs font-mono">
                        <span className="text-foreground">{f.name}</span>
                        <span className="text-muted-foreground"> = </span>
                        <span className="text-foreground break-all">{f.value}</span>
                      </div>
                    ))}
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

      <Card>
        <CardContent className="p-3 space-y-1">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All command generation, parsing, and reference lookups run locally.
            History stores only metadata (action + resolver + count + timestamp) — never the queried domains.
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
                  <Badge variant="outline" className="text-[10px]">{h.resolver}</Badge>
                  <span className="text-muted-foreground">{h.count} cmd(s)</span>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
