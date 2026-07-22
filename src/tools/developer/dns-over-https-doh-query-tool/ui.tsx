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
  History, Globe, Terminal, AlertCircle,
  FileJson, ShieldCheck, Server, Network,
} from "lucide-react";
import {
  RESOLVERS,
  RESOLVER_LABELS,
  RECORD_TYPES,
  RCODES,
  validateDnsName,
  normalizeDnsName,
  normalizeRecordType,
  base64UrlEncode,
  encodeDnsMessage,
  buildDnsQueryMessage,
  encodeDnsQueryBase64Url,
  decodeDnsHeader,
  buildDohUrl,
  generateCommands,
  generateComparisonCommands,
  buildPtrName,
  parseDohJsonResponse,
  recordTypeName,
  renderMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ResolverId,
  type DoHMode,
  type HttpMethod,
  type DnsRecordType,
  type HistoryEntry,
  type GeneratedCommand,
  type ParsedDohJson,
  type DohQueryOptions,
} from "./logic";

type Tab = "commands" | "parse" | "wire";

const TABS: { id: Tab; label: string }[] = [
  { id: "commands", label: "Command Generator" },
  { id: "parse", label: "JSON Parser" },
  { id: "wire", label: "Wire-Format Inspector" },
];

const DEFAULT_OPTS: DohQueryOptions = {
  resolver: "cloudflare",
  customUrl: "",
  mode: "json",
  method: "GET",
  doFlag: false,
  cdFlag: false,
};

export default function DnsOverHttpsDohQueryTool() {
  const [tab, setTab] = useState<Tab>("commands");
  const [name, setName] = useState("example.com");
  const [type, setType] = useState<DnsRecordType>("A");
  const [opts, setOpts] = useState<DohQueryOptions>(DEFAULT_OPTS);
  const [parseInput, setParseInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.name) setName(p.name);
      if (p.type) setType(p.type);
      setOpts((prev) => ({ ...prev, ...p.opts }));
      if (p.name || p.opts.resolver !== "cloudflare") toast.info("Loaded from share link");
    }
  }, []);

  const validName = useMemo(() => validateDnsName(name), [name]);
  const normalizedType = useMemo(() => normalizeRecordType(type) || "A", [type]);

  const url = useMemo(
    () => validName ? buildDohUrl(name, normalizedType, opts) : "",
    [name, normalizedType, opts, validName],
  );
  const commands: GeneratedCommand[] = useMemo(
    () => validName ? generateCommands(name, normalizedType, opts) : [],
    [name, normalizedType, opts, validName],
  );
  const comparisonCommands = useMemo(
    () => validName ? generateComparisonCommands(name, normalizedType, opts.mode, {
      doFlag: opts.doFlag, cdFlag: opts.cdFlag,
    }) : [],
    [name, normalizedType, opts.mode, opts.doFlag, opts.cdFlag, validName],
  );

  const queryMsg = useMemo(
    () => validName ? buildDnsQueryMessage(name, normalizedType, {
      doFlag: opts.doFlag, cdFlag: opts.cdFlag, id: 0,
    }) : null,
    [name, normalizedType, opts.doFlag, opts.cdFlag, validName],
  );
  const queryBytes = useMemo(
    () => queryMsg ? encodeDnsMessage(queryMsg) : new Uint8Array(0),
    [queryMsg],
  );
  const queryBase64 = useMemo(
    () => queryBytes.length > 0 ? base64UrlEncode(queryBytes) : "",
    [queryBytes],
  );
  const queryBase64Default = useMemo(
    () => validName ? encodeDnsQueryBase64Url(name, normalizedType, {
      doFlag: opts.doFlag, cdFlag: opts.cdFlag,
    }) : "",
    [name, normalizedType, opts.doFlag, opts.cdFlag, validName],
  );
  const decodedHeader = useMemo(
    () => queryBytes.length > 0 ? decodeDnsHeader(queryBytes) : null,
    [queryBytes],
  );

  const ptrName = useMemo(() => buildPtrName(name), [name]);

  const parsed: ParsedDohJson | null = useMemo(() => {
    if (!parseInput.trim()) return null;
    return parseDohJsonResponse(parseInput);
  }, [parseInput]);

  const handleSaveHistory = useCallback(() => {
    if (validName) {
      saveHistory({
        ts: Date.now(),
        name: normalizeDnsName(name),
        type: normalizedType,
        resolver: opts.resolver,
        mode: opts.mode,
      });
      setHistory(loadHistory());
    }
  }, [name, normalizedType, opts.resolver, opts.mode, validName]);

  const handleClear = useCallback(() => {
    setName("");
    setParseInput("");
    setOpts(DEFAULT_OPTS);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const updateOpts = (patch: Partial<DohQueryOptions>) => setOpts((prev) => ({ ...prev, ...patch }));

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
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

      {tab === "commands" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="doh-name">DNS name</Label>
                  <Input
                    id="doh-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="example.com (or 8.8.8.8 for reverse)"
                    className="font-mono text-sm"
                  />
                  {!validName && name && (
                    <p className="text-[11px] text-red-600 dark:text-red-400">
                      Not a valid DNS name.
                    </p>
                  )}
                  {ptrName && (
                    <p className="text-[11px] text-muted-foreground">
                      PTR name: <code className="font-mono">{ptrName}</code>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 ml-2 text-[11px]"
                        onClick={() => { setName(ptrName); setType("PTR"); }}
                      >
                        use PTR query
                      </Button>
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="doh-type" className="text-xs">Record type</Label>
                  <select
                    id="doh-type"
                    value={type}
                    onChange={(e) => setType(e.target.value as DnsRecordType)}
                    className="h-9 w-full text-sm rounded border bg-background px-2"
                  >
                    {RECORD_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="doh-resolver" className="text-xs">Resolver</Label>
                  <select
                    id="doh-resolver"
                    value={opts.resolver}
                    onChange={(e) => updateOpts({ resolver: e.target.value as ResolverId })}
                    className="h-9 w-full text-sm rounded border bg-background px-2"
                  >
                    {RESOLVERS.map((r) => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="doh-mode" className="text-xs">Mode</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={opts.mode === "json" ? "default" : "outline"}
                      size="sm"
                      className="h-9 flex-1"
                      onClick={() => updateOpts({ mode: "json" })}
                    >
                      JSON
                    </Button>
                    <Button
                      variant={opts.mode === "wire" ? "default" : "outline"}
                      size="sm"
                      className="h-9 flex-1"
                      onClick={() => updateOpts({ mode: "wire" })}
                    >
                      Wire (RFC 8484)
                    </Button>
                  </div>
                </div>
              </div>
              {opts.resolver === "custom" && (
                <div className="space-y-1.5">
                  <Label htmlFor="doh-custom" className="text-xs">
                    Custom DoH URL ({opts.mode === "json" ? "JSON endpoint" : "wire endpoint"})
                  </Label>
                  <Input
                    id="doh-custom"
                    value={opts.customUrl}
                    onChange={(e) => updateOpts({ customUrl: e.target.value })}
                    placeholder="https://dns.adguard-dns.com/dns-query"
                    className="font-mono text-xs h-9"
                  />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={opts.doFlag}
                    onChange={(e) => updateOpts({ doFlag: e.target.checked })}
                  />
                  <ShieldCheck className="h-3.5 w-3.5" />
                  DNSSEC OK (DO)
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={opts.cdFlag}
                    onChange={(e) => updateOpts({ cdFlag: e.target.checked })}
                  />
                  Checking Disabled (CD)
                </label>
                {opts.mode === "wire" && (
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <span className="text-muted-foreground">Method:</span>
                    <select
                      value={opts.method}
                      onChange={(e) => updateOpts({ method: e.target.value as HttpMethod })}
                      className="h-7 text-xs rounded border bg-background px-1"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                    </select>
                  </label>
                )}
              </div>
              {url && (
                <div className="rounded border bg-muted p-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    Generated DoH URL
                  </div>
                  <code className="text-[11px] font-mono text-foreground break-all">{url}</code>
                </div>
              )}
            </CardContent>
          </Card>

          {commands.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Terminal className="h-4 w-4" />
                  {opts.mode === "json" ? "JSON-mode commands" : `Wire-format ${opts.method} commands`}
                  <Badge variant="outline" className="text-[10px]">{RESOLVER_LABELS[opts.resolver]}</Badge>
                </h3>
                <div className="space-y-2">
                  {commands.map((c, i) => (
                    <CommandCard key={i} cmd={c} onSave={handleSaveHistory} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <ShareButton
                    getUrl={() => { handleSaveHistory(); return buildShareUrl(name, normalizedType, opts); }}
                  />
                  <ClearButton onClick={handleClear} />
                </div>
              </CardContent>
            </Card>
          )}

          {comparisonCommands.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Server className="h-4 w-4" /> Compare resolvers ({opts.mode} mode)
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Same <code className="font-mono">{normalizeDnsName(name)}</code> {normalizedType} query across all three presets — useful for spotting response differences and DNSSEC validation behavior.
                </p>
                <div className="space-y-2">
                  {comparisonCommands.map((c, i) => (
                    <CommandCard key={i} cmd={c} onSave={handleSaveHistory} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  <strong className="text-foreground">CORS note:</strong> Cloudflare's JSON endpoint allows browser fetches; Google's <code>/resolve</code> endpoint also allows CORS for JSON. Wire-format and Quad9 requests typically require <code>curl</code> in a terminal — the browser will block them as cross-origin.
                </span>
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {tab === "parse" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="doh-parse">Paste a DoH JSON response</Label>
                <Textarea
                  id="doh-parse"
                  value={parseInput}
                  onChange={(e) => setParseInput(e.target.value)}
                  placeholder={'{ "Status": 0, "TC": false, "RD": true, "RA": true, "AD": true, "Answer": [...] }'}
                  className="min-h-[200px] resize-y font-mono text-xs"
                />
              </div>
            </CardContent>
          </Card>

          {parsed && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <FileJson className="h-4 w-4" /> Parsed response
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant={parsed.status === 0 ? "default" : "destructive"}
                      className="text-[10px]"
                    >
                      {parsed.status} {parsed.statusText}
                    </Badge>
                    {parsed.truncated && <Badge variant="secondary" className="text-[10px]">TC</Badge>}
                    {parsed.recursionDesired && <Badge variant="outline" className="text-[10px]">RD</Badge>}
                    {parsed.recursionAvailable && <Badge variant="outline" className="text-[10px]">RA</Badge>}
                    {parsed.authenticatedData && (
                      <Badge variant="default" className="text-[10px] bg-emerald-600 hover:bg-emerald-600">
                        <ShieldCheck className="h-3 w-3 mr-1" /> AD
                      </Badge>
                    )}
                    {parsed.checkingDisabled && <Badge variant="outline" className="text-[10px]">CD</Badge>}
                  </div>
                </div>
                {parsed.notes.length > 0 && (
                  <div className="rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs">
                    {parsed.notes.map((n, i) => (
                      <p key={i} className="flex items-start gap-1.5 text-amber-800 dark:text-amber-200">
                        <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" /> {n}
                      </p>
                    ))}
                  </div>
                )}
                {parsed.comment && (
                  <div className="rounded border bg-muted p-2 text-xs">
                    <strong className="text-foreground">Comment:</strong> {parsed.comment}
                  </div>
                )}
                {parsed.answer.length > 0 && (
                  <Section title={`Answer (${parsed.answer.length})`}>
                    <AnswerTable rows={parsed.answer} />
                  </Section>
                )}
                {parsed.authority.length > 0 && (
                  <Section title={`Authority (${parsed.authority.length})`}>
                    <AnswerTable rows={parsed.authority} />
                  </Section>
                )}
                {parsed.additional.length > 0 && (
                  <Section title={`Additional (${parsed.additional.length})`}>
                    <AnswerTable rows={parsed.additional} />
                  </Section>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <CopyButton
                    getText={() => { handleSaveHistory(); return renderMarkdown(parsed); }}
                    label="Copy as Markdown"
                  />
                  <ShareButton
                    getUrl={() => buildShareUrl(name, normalizedType, opts)}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {!parsed && (
            <EmptyState
              title="Paste a DoH JSON response to parse"
              hint="Copy the JSON body from a Cloudflare or Google DoH JSON request (Accept: application/dns-json) and the parser will extract Status, flags (TC/RD/RA/AD/CD), and Answer/Authority/Additional sections."
              icon={<FileJson className="h-8 w-8" />}
            />
          )}
        </>
      )}

      {tab === "wire" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Network className="h-4 w-4" /> Wire-format query inspector
                </h3>
                <Badge variant="outline" className="text-[10px]">
                  {normalizeDnsName(name)} {normalizedType}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                This is the pure-JS DNS wire-format message that gets base64url-encoded into the <code>?dns=</code> parameter for RFC 8484 wire-mode DoH queries. Built from header + question + optional EDNS0 OPT record (added when DO=1).
              </p>
              {decodedHeader && (
                <div className="rounded border bg-muted p-2 text-xs">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Decoded header</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                    <HeaderField label="ID" value={`0x${decodedHeader.id.toString(16).padStart(4, "0")}`} />
                    <HeaderField label="QR" value={String(decodedHeader.qr)} />
                    <HeaderField label="Opcode" value={String(decodedHeader.opcode)} />
                    <HeaderField label="RD" value={String(decodedHeader.rd)} />
                    <HeaderField label="CD" value={String(decodedHeader.cd)} />
                    <HeaderField label="QDCOUNT" value={String(decodedHeader.qdCount)} />
                    <HeaderField label="ANCOUNT" value={String(decodedHeader.anCount)} />
                    <HeaderField label="ARCOUNT" value={String(decodedHeader.arCount)} />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Bytes (decimal)</Label>
                <pre className="text-[11px] font-mono bg-muted p-2 rounded border overflow-auto max-h-[120px]">
                  {Array.from(queryBytes).join(" ")}
                </pre>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bytes (hex)</Label>
                <pre className="text-[11px] font-mono bg-muted p-2 rounded border overflow-auto max-h-[120px]">
                  {Array.from(queryBytes).map((b) => b.toString(16).padStart(2, "0")).join(" ")}
                </pre>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Base64url (for ?dns= parameter)</Label>
                <pre className="text-[11px] font-mono bg-muted p-2 rounded border break-all whitespace-pre-wrap">
                  {queryBase64}
                </pre>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Base64url with default random ID (what the URL uses)</Label>
                <pre className="text-[11px] font-mono bg-muted p-2 rounded border break-all whitespace-pre-wrap">
                  {queryBase64Default}
                </pre>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => queryBase64} label="Copy base64url" />
                <CopyButton
                  getText={() => Array.from(queryBytes).map((b) => b.toString(16).padStart(2, "0")).join(" ")}
                  label="Copy hex"
                />
                <ShareButton
                  getUrl={() => { handleSaveHistory(); return buildShareUrl(name, normalizedType, opts); }}
                />
              </div>
            </CardContent>
          </Card>
        </>
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
                  <Badge variant="outline" className="mr-2 text-[10px]">{RESOLVER_LABELS[h.resolver]}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.mode}</Badge>
                  <span className="font-mono text-muted-foreground">{h.name} {h.type}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> 100% client-side — this tool generates URLs/commands and parses pasted JSON only. It never sends queries or your DNS history to any server. History stores operation metadata only (name + type + resolver), never any DNS response data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CommandCard({ cmd, onSave }: { cmd: GeneratedCommand; onSave: () => void }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">{cmd.tool}</Badge>
          <span className="text-xs font-medium text-foreground">{cmd.label}</span>
        </div>
        {!cmd.command.startsWith("#") && (
          <CopyButton
            getText={() => { onSave(); return cmd.command; }}
            label="Copy"
            size="icon-sm"
          />
        )}
      </div>
      <pre className="text-[11px] font-mono text-foreground whitespace-pre-wrap break-all bg-muted p-2 rounded">
        {cmd.command}
      </pre>
      <p className="text-[11px] text-muted-foreground mt-1.5">{cmd.explanation}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold text-foreground">{title}</div>
      {children}
    </div>
  );
}

function AnswerTable({ rows }: { rows: { name: string; type: number; TTL: number; data: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-left text-muted-foreground border-b">
            <th className="py-1 pr-2 font-medium">Name</th>
            <th className="py-1 pr-2 font-medium">Type</th>
            <th className="py-1 pr-2 font-medium">TTL</th>
            <th className="py-1 font-medium">Data</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="py-1 pr-2 font-mono align-top">{r.name}</td>
              <td className="py-1 pr-2 font-mono align-top">{recordTypeName(r.type)}</td>
              <td className="py-1 pr-2 font-mono align-top">{r.TTL}</td>
              <td className="py-1 font-mono break-all">{r.data}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HeaderField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span> <span className="text-foreground">{value}</span>
    </div>
  );
}
