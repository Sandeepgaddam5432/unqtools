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
  History, Globe, Terminal, Search as SearchIcon,
  AlertCircle, BookOpen, Calendar, ShieldAlert, Server,
  CheckCircle2, Clock,
} from "lucide-react";
import {
  TLD_WHOIS_SERVERS,
  RIR_PRESETS,
  EPP_STATUS_CODES,
  getWhoisServer,
  getEppStatus,
  normalizeDomain,
  toPunycode,
  detectTargetType,
  detectRir,
  extractTld,
  buildRdapUrl,
  generateWhoisCommands,
  generateAvailabilityCheck,
  parseWhoisResponse,
  computeExpiryCountdown,
  parseBulk,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type TargetType,
  type HistoryEntry,
  type GeneratedCommand,
  type ParsedWhois,
} from "./logic";

type Tab = "commands" | "parse" | "availability";

const TABS: { id: Tab; label: string }[] = [
  { id: "commands", label: "Command Generator" },
  { id: "parse", label: "WHOIS Parser" },
  { id: "availability", label: "Availability Checker" },
];

export default function WhoisDomainIpLookup() {
  const [tab, setTab] = useState<Tab>("commands");
  const [target, setTarget] = useState("example.com");
  const [hideLegal, setHideLegal] = useState(false);
  const [parseInput, setParseInput] = useState("");
  const [parseTypeHint, setParseTypeHint] = useState<TargetType>("domain");
  const [bulkInput, setBulkInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.target) setTarget(p.target);
      if (p.tab) setTab(p.tab);
      if (p.target || p.tab) toast.info("Loaded from share link");
    }
  }, []);

  const targetType = useMemo(() => detectTargetType(target), [target]);
  const commands: GeneratedCommand[] = useMemo(
    () => generateWhoisCommands(target, { hideLegal }),
    [target, hideLegal],
  );
  const availability = useMemo(() => generateAvailabilityCheck(target), [target]);
  const parseResult: ParsedWhois | null = useMemo(
    () => (parseInput.trim() ? parseWhoisResponse(parseInput, parseTypeHint) : null),
    [parseInput, parseTypeHint],
  );
  const bulkTargets = useMemo(() => parseBulk(bulkInput), [bulkInput]);

  // Stats for display
  const tldEntry = useMemo(
    () => (targetType === "domain" ? getWhoisServer(extractTld(target)) : undefined),
    [target, targetType],
  );
  const rirId = useMemo(
    () => (targetType === "ipv4" || targetType === "ipv6" ? detectRir(target) : undefined),
    [target, targetType],
  );
  const rirEntry = useMemo(
    () => (rirId ? RIR_PRESETS.find((r) => r.id === rirId) : undefined),
    [rirId],
  );
  const punycode = useMemo(() => toPunycode(target), [target]);
  const expiryDays = useMemo(
    () => parseResult?.expiryDate ? computeExpiryCountdown(parseResult.expiryDate) : null,
    [parseResult?.expiryDate],
  );

  const handleSaveHistory = useCallback((action: HistoryEntry["action"]) => {
    if (!target.trim()) return;
    saveHistory({ ts: Date.now(), target: target.trim(), type: targetType, action });
    setHistory(loadHistory());
  }, [target, targetType]);

  const handleClear = useCallback(() => {
    setTarget("example.com");
    setHideLegal(false);
    setParseInput("");
    setBulkInput("");
    setParseTypeHint("domain");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const shareUrl = useMemo(
    () => buildShareUrl({ target, tab }),
    [target, tab],
  );

  const rdapUrl = useMemo(() => buildRdapUrl(target), [target]);

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
              <strong className="text-foreground">Honesty note:</strong> WHOIS / RDAP lookups require the network.
              This tool generates <code className="font-mono">whois</code> CLI commands, RDAP URLs, and{" "}
              <code className="font-mono">curl</code> snippets for you to run, and parses pasted WHOIS text —
              it never sends queries itself.
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
                <Field label="Domain or IP">
                  <Input
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="example.com or 8.8.8.8"
                    className="font-mono text-sm h-8"
                  />
                </Field>
                <Field label="Detected type">
                  <div className="h-8 flex items-center gap-2">
                    {targetType === "invalid" ? (
                      <Badge variant="destructive" className="text-[11px]">invalid</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[11px]">{targetType}</Badge>
                    )}
                    {targetType === "domain" && tldEntry && (
                      <Badge variant="outline" className="text-[10px] font-mono">.{extractTld(target)} → {tldEntry.server}</Badge>
                    )}
                    {(targetType === "ipv4" || targetType === "ipv6") && rirEntry && (
                      <Badge variant="outline" className="text-[10px]">{rirEntry.id}</Badge>
                    )}
                  </div>
                </Field>
              </div>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={hideLegal} onChange={(e) => setHideLegal(e.target.checked)} />
                <code className="font-mono">-H</code> hide legal disclaimers
              </label>
              {targetType === "domain" && punycode !== target.toLowerCase() && (
                <div className="rounded border bg-muted/40 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">IDN → punycode: </span>
                  <code className="font-mono text-foreground">{punycode}</code>
                </div>
              )}
              {rirEntry && (
                <div className="rounded border bg-muted/40 px-3 py-2 text-xs space-y-0.5">
                  <div className="flex items-center gap-1.5 text-foreground font-medium">
                    <Server className="h-3 w-3" /> {rirEntry.label}
                  </div>
                  <div className="text-muted-foreground">
                    WHOIS: <code className="font-mono">{rirEntry.whoisServer}</code> · RDAP: <code className="font-mono">{rirEntry.rdapUrl}</code>
                  </div>
                  <div className="text-muted-foreground">Region: {rirEntry.region}</div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <ShareButton getUrl={() => { handleSaveHistory("generate"); return shareUrl; }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          {commands.length > 0 ? (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Globe className="h-4 w-4" /> Generated Commands ({commands.length})
                </h3>
                <div className="space-y-2">
                  {commands.map((c, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{c.tool}</Badge>
                        <span className="font-medium text-foreground">{c.label}</span>
                      </div>
                      <pre className="font-mono text-[11px] text-foreground whitespace-pre-wrap break-all bg-muted/40 rounded px-2 py-1">{c.command}</pre>
                      <p className="text-[11px] text-muted-foreground">{c.explanation}</p>
                      <div className="pt-1">
                        <CopyButton getText={() => c.command} label="Copy" size="sm" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              title="Enter a domain or IP to generate WHOIS commands"
              hint="Try example.com, 8.8.8.8, or 2606:4700:4700::1111"
              icon={<Terminal className="h-8 w-8" />}
            />
          )}
        </>
      )}

      {tab === "parse" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <SearchIcon className="h-4 w-4" /> Paste raw WHOIS text
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Field label="Response type hint">
                  <select
                    value={parseTypeHint}
                    onChange={(e) => setParseTypeHint(e.target.value as TargetType)}
                    className="h-8 text-xs rounded border bg-background px-2 w-full"
                  >
                    <option value="domain">Domain</option>
                    <option value="ipv4">IPv4</option>
                    <option value="ipv6">IPv6</option>
                  </select>
                </Field>
              </div>
              <Textarea
                value={parseInput}
                onChange={(e) => setParseInput(e.target.value)}
                placeholder={"Paste the output of: whois example.com"}
                className="min-h-[160px] resize-y font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => {
                    handleSaveHistory("parse");
                    return parseResult ? JSON.stringify(parseResult, null, 2) : "";
                  }}
                  label="Copy parsed JSON"
                  disabled={!parseResult}
                />
                <DownloadButton
                  getText={() => JSON.stringify(parseResult, null, 2)}
                  filename="whois-parsed.json"
                  mime="application/json"
                  label="Download JSON"
                  disabled={!parseResult}
                />
                <ShareButton getUrl={() => { handleSaveHistory("parse"); return shareUrl; }} />
                <ClearButton onClick={() => setParseInput("")} />
              </div>
            </CardContent>
          </Card>

          {parseResult && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4" /> Parsed Card
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {parseResult.registrar && (
                    <ParsedField label="Registrar" value={parseResult.registrar} icon={<Server className="h-3 w-3" />} />
                  )}
                  {parseResult.organization && (
                    <ParsedField label="Organization" value={parseResult.organization} icon={<Server className="h-3 w-3" />} />
                  )}
                  {parseResult.createdDate && (
                    <ParsedField label="Created" value={parseResult.createdDate} icon={<Calendar className="h-3 w-3" />} />
                  )}
                  {parseResult.updatedDate && (
                    <ParsedField label="Updated" value={parseResult.updatedDate} icon={<Calendar className="h-3 w-3" />} />
                  )}
                  {parseResult.expiryDate && (
                    <ParsedField
                      label="Expiry"
                      value={parseResult.expiryDate}
                      icon={<Clock className="h-3 w-3" />}
                      badge={expiryDays !== null ? `${expiryDays}d left` : undefined}
                      badgeTone={expiryDays !== null && expiryDays < 30 ? "bad" : expiryDays !== null && expiryDays < 90 ? "warn" : "good"}
                    />
                  )}
                  {parseResult.cidrRange && (
                    <ParsedField label="CIDR range" value={parseResult.cidrRange} icon={<Globe className="h-3 w-3" />} />
                  )}
                  {parseResult.originAs && (
                    <ParsedField label="Origin AS" value={parseResult.originAs} icon={<Server className="h-3 w-3" />} />
                  )}
                  {parseResult.abuseContact && (
                    <ParsedField label="Abuse contact" value={parseResult.abuseContact} icon={<ShieldAlert className="h-3 w-3" />} />
                  )}
                  {parseResult.dnssec && (
                    <ParsedField
                      label="DNSSEC"
                      value={parseResult.dnssec}
                      icon={<ShieldAlert className="h-3 w-3" />}
                      badge={parseResult.dnssec.toLowerCase().startsWith("signed") ? "signed" : "unsigned"}
                      badgeTone={parseResult.dnssec.toLowerCase().startsWith("signed") ? "good" : "warn"}
                    />
                  )}
                </div>

                {parseResult.nameServers.length > 0 && (
                  <div>
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Nameservers ({parseResult.nameServers.length})</Label>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {parseResult.nameServers.map((ns) => (
                        <Badge key={ns} variant="outline" className="text-[10px] font-mono">{ns}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {parseResult.statuses.length > 0 && (
                  <div>
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Status codes ({parseResult.statuses.length})</Label>
                    <div className="space-y-1 pt-1">
                      {parseResult.statuses.map((st, i) => {
                        const expl = getEppStatus(st);
                        return (
                          <div key={i} className="rounded border bg-background px-2 py-1.5 text-xs">
                            <div className="flex items-center gap-2">
                              <code className="font-mono text-foreground">{st}</code>
                              {expl && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px]"
                                >
                                  {expl.category}
                                </Badge>
                              )}
                            </div>
                            {expl && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                <span className="font-medium text-foreground">{expl.short}.</span> {expl.explanation}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {parseResult.notes.length > 0 && (
                  <div className="space-y-1">
                    {parseResult.notes.map((n, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                        <span>{n}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {tab === "availability" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Domain Availability Checker
              </h3>
              <Field label="Domain to check">
                <Input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="example.com"
                  className="font-mono text-sm h-8"
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <ShareButton getUrl={() => { handleSaveHistory("availability"); return shareUrl; }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          {availability.commands.length > 0 ? (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Terminal className="h-4 w-4" /> Check Commands for {availability.domain}
                </h3>
                <div className="space-y-2">
                  {availability.commands.map((c, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{c.tool}</Badge>
                        <span className="font-medium text-foreground">{c.label}</span>
                      </div>
                      <pre className="font-mono text-[11px] text-foreground whitespace-pre-wrap break-all bg-muted/40 rounded px-2 py-1">{c.command}</pre>
                      <p className="text-[11px] text-muted-foreground">{c.explanation}</p>
                      <div className="pt-1">
                        <CopyButton getText={() => c.command} label="Copy" size="sm" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 pt-2">
                  {availability.notes.map((n, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                      <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                      <span>{n}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              title="Enter a domain to check availability"
              hint="Generates whois, dig, and RDAP HTTP-status commands."
              icon={<CheckCircle2 className="h-8 w-8" />}
            />
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Globe className="h-4 w-4" /> Bulk Lookup
              </h3>
              <Textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder={"example.com\ngoogle.com\ncloudflare.com"}
                className="min-h-[100px] resize-y font-mono text-xs"
              />
              {bulkTargets.length > 0 && (
                <div className="space-y-1 max-h-[300px] overflow-auto">
                  {bulkTargets.map((t) => {
                    const tt = detectTargetType(t);
                    const rurl = buildRdapUrl(t);
                    return (
                      <div key={t} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                        <Badge variant={tt === "invalid" ? "destructive" : "secondary"} className="text-[10px]">{tt}</Badge>
                        <code className="font-mono text-foreground truncate flex-1">{t}</code>
                        {rurl && (
                          <a
                            href={rurl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-[10px]"
                          >
                            RDAP ↗
                          </a>
                        )}
                        <CopyButton getText={() => `whois ${t}`} label="whois" size="sm" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {rdapUrl && tab === "commands" && (
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">RDAP quick link:</strong>{" "}
              <a
                href={rdapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-mono break-all"
              >
                {rdapUrl} ↗
              </a>
            </p>
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
                <button
                  key={i}
                  type="button"
                  onClick={() => { setTarget(h.target); setTab(h.action === "parse" ? "parse" : h.action === "availability" ? "availability" : "commands"); }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/40"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.type}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.action}</Badge>
                  <code className="font-mono text-foreground">{h.target}</code>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All command generation and parsing runs locally.
            History stores only operation metadata (target + type + action + timestamp) — never pasted WHOIS text or contact data.
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

function ParsedField({
  label,
  value,
  icon,
  badge,
  badgeTone,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  badge?: string;
  badgeTone?: "good" | "warn" | "bad";
}) {
  const badgeColor = badgeTone === "bad"
    ? "bg-red-500/10 text-red-700 dark:text-red-300"
    : badgeTone === "warn"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : badgeTone === "good"
        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : "";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}{label}
      </div>
      <div className="text-foreground font-mono text-xs mt-0.5 break-all">{value}</div>
      {badge && (
        <span className={`inline-block mt-1 text-[10px] rounded px-1.5 py-0.5 ${badgeColor}`}>{badge}</span>
      )}
    </div>
  );
}
