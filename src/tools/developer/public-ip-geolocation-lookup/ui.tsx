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
  MapPin, ShieldAlert, Server, FileJson, Network,
} from "lucide-react";
import {
  PROVIDERS,
  PROVIDER_LABELS,
  detectIpFamily,
  detectTargetType,
  normalizeTarget,
  isPrivateTarget,
  buildMyIpUrl,
  buildGeolocateUrl,
  generateMyIpCommands,
  generateGeolocateCommands,
  generateProviderComparison,
  generateBulkCurl,
  reverseDnsCommands,
  parseGeolocationResponse,
  formatGoogleMapsUrl,
  formatOsmUrl,
  renderMarkdown,
  renderCsv,
  accuracyCaveat,
  parseBulk,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ProviderId,
  type HistoryEntry,
  type GeneratedCommand,
  type UnifiedGeolocation,
} from "./logic";

type Tab = "commands" | "parse" | "bulk";

const TABS: { id: Tab; label: string }[] = [
  { id: "commands", label: "Commands" },
  { id: "parse", label: "Response Parser" },
  { id: "bulk", label: "Bulk Lookup" },
];

export default function PublicIpGeolocationLookup() {
  const [tab, setTab] = useState<Tab>("commands");
  const [target, setTarget] = useState("8.8.8.8");
  const [provider, setProvider] = useState<ProviderId>("ipinfo");
  const [token, setToken] = useState("");
  const [parseInput, setParseInput] = useState("");
  const [parseProviderHint, setParseProviderHint] = useState<ProviderId | "">("");
  const [bulkInput, setBulkInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.target) setTarget(p.target);
      if (p.provider) setProvider(p.provider);
      if (p.tab) setTab(p.tab);
      if (p.token) setToken(p.token);
      if (p.target || p.provider || p.tab !== "commands") toast.info("Loaded from share link");
    }
  }, []);

  const targetType = useMemo(() => detectTargetType(target), [target]);
  const isMyIpTab = useMemo(() => !target.trim(), [target]);
  const myIpCommands = useMemo(
    () => generateMyIpCommands(provider, token || undefined),
    [provider, token],
  );
  const geolocateCommands = useMemo(
    () => generateGeolocateCommands(target, provider, token || undefined),
    [target, provider, token],
  );
  const comparisonCommands = useMemo(
    () => generateProviderComparison(target, token || undefined),
    [target, token],
  );
  const reverseCommands = useMemo(() => {
    if (targetType === "ipv4" || targetType === "ipv6") {
      return reverseDnsCommands(normalizeTarget(target));
    }
    return [];
  }, [target, targetType]);

  const commands: GeneratedCommand[] = isMyIpTab ? myIpCommands : geolocateCommands;

  const parsed: UnifiedGeolocation | null = useMemo(() => {
    if (!parseInput.trim()) return null;
    return parseGeolocationResponse(parseInput, parseProviderHint || undefined);
  }, [parseInput, parseProviderHint]);

  const bulkTargets = useMemo(() => parseBulk(bulkInput), [bulkInput]);
  const bulkScript = useMemo(
    () => generateBulkCurl(bulkTargets, provider, token || undefined),
    [bulkTargets, provider, token],
  );

  const handleSaveHistory = useCallback(
    (action: HistoryEntry["action"]) => {
      saveHistory({
        ts: Date.now(),
        target: target || "(my ip)",
        type: isMyIpTab ? "invalid" : detectTargetType(target),
        action,
        provider,
      });
      setHistory(loadHistory());
    },
    [target, isMyIpTab, provider],
  );

  const handleClear = useCallback(() => {
    setTarget("");
    setToken("");
    setParseInput("");
    setBulkInput("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

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
              <div className="space-y-1.5">
                <Label htmlFor="pipgl-target">Target IP or domain (leave empty for "what is my IP")</Label>
                <Input
                  id="pipgl-target"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="8.8.8.8 or cloudflare.com (or empty for your own IP)"
                  className="font-mono text-sm"
                />
                {target && (
                  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">Type: {targetType}</Badge>
                    <Badge variant="outline" className="text-[10px]">Family: {detectIpFamily(target)}</Badge>
                    {isPrivateTarget(target) && (
                      <Badge variant="destructive" className="text-[10px]">Private/reserved — no geolocation</Badge>
                    )}
                  </div>
                )}
                {!target && (
                  <p className="text-[11px] text-muted-foreground">
                    Empty target = "what is my IP" commands — your public IPv4/IPv6.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pipgl-provider" className="text-xs">Provider</Label>
                  <select
                    id="pipgl-provider"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as ProviderId)}
                    className="h-9 w-full text-sm rounded border bg-background px-2"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pipgl-token" className="text-xs">API token / key (optional)</Label>
                  <Input
                    id="pipgl-token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="leave empty for free tier"
                    className="font-mono text-xs h-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {commands.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Terminal className="h-4 w-4" />
                  {isMyIpTab
                    ? `"What is my IP" commands — ${PROVIDER_LABELS[provider]}`
                    : `Geolocate ${normalizeTarget(target) || "—"} — ${PROVIDER_LABELS[provider]}`}
                </h3>
                <div className="space-y-2">
                  {commands.map((c, i) => (
                    <CommandCard key={i} cmd={c} onSave={() => handleSaveHistory("generate")} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <ShareButton
                    getUrl={() => {
                      handleSaveHistory("generate");
                      return buildShareUrl(target, provider, tab, token);
                    }}
                  />
                  <ClearButton onClick={handleClear} />
                </div>
              </CardContent>
            </Card>
          )}

          {reverseCommands.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Network className="h-4 w-4" /> Reverse DNS
                </h3>
                <div className="space-y-2">
                  {reverseCommands.map((c, i) => (
                    <CommandCard key={i} cmd={c} onSave={() => handleSaveHistory("generate")} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {comparisonCommands.length > 0 && !isMyIpTab && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Server className="h-4 w-4" /> Compare all providers for {normalizeTarget(target)}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Same target across all 6 providers — run them side by side to compare accuracy.
                </p>
                <div className="space-y-2">
                  {comparisonCommands.map((c, i) => (
                    <CommandCard key={i} cmd={c} onSave={() => handleSaveHistory("generate")} />
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
                  <strong className="text-foreground">Accuracy:</strong> IP geolocation is approximate — typically only country/region/city accurate, never street-level. CGNAT, mobile carriers, VPNs, proxies, and anycast IPs can place an IP far from the actual user. Treat coordinates as a city centroid hint.
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
                <Label htmlFor="pipgl-parse">Paste a geolocation JSON response</Label>
                <Textarea
                  id="pipgl-parse"
                  value={parseInput}
                  onChange={(e) => setParseInput(e.target.value)}
                  placeholder={'{ "ip": "8.8.8.8", "city": "Ashburn", ... }'}
                  className="min-h-[160px] resize-y font-mono text-xs"
                />
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Label className="text-xs">Provider hint:</Label>
                  <select
                    value={parseProviderHint}
                    onChange={(e) => setParseProviderHint(e.target.value as ProviderId | "")}
                    className="h-8 text-xs rounded border bg-background px-2"
                  >
                    <option value="">Auto-detect</option>
                    {PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {parsed && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <FileJson className="h-4 w-4" /> Parsed result
                  </h3>
                  <Badge variant="outline" className="text-[10px]">
                    {PROVIDER_LABELS[parsed.provider]}
                  </Badge>
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <Field label="IP" value={parsed.ip} />
                  <Field label="Hostname" value={parsed.hostname} />
                  <Field label="Country" value={[parsed.country, parsed.countryCode].filter(Boolean).join(" ")} />
                  <Field label="Region" value={parsed.region} />
                  <Field label="City" value={parsed.city} />
                  <Field label="Postal" value={parsed.postal} />
                  <Field label="Latitude" value={parsed.lat !== undefined ? String(parsed.lat) : undefined} />
                  <Field label="Longitude" value={parsed.lon !== undefined ? String(parsed.lon) : undefined} />
                  <Field label="Accuracy radius" value={parsed.accuracyRadiusKm !== undefined ? `~${parsed.accuracyRadiusKm} km` : undefined} />
                  <Field label="Timezone" value={parsed.timezone} />
                  <Field label="ISP" value={parsed.isp} />
                  <Field label="Organization" value={parsed.org} />
                  <Field label="ASN" value={parsed.asn} />
                  <Field label="AS" value={parsed.as} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {parsed.isProxy && <Badge variant="destructive" className="text-[10px]">Proxy</Badge>}
                  {parsed.isVpn && <Badge variant="destructive" className="text-[10px]">VPN</Badge>}
                  {parsed.isHosting && <Badge variant="secondary" className="text-[10px]">Hosting / datacenter</Badge>}
                  {parsed.isMobile && <Badge variant="secondary" className="text-[10px]">Mobile</Badge>}
                </div>
                {parsed.lat !== undefined && parsed.lon !== undefined && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Map links:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={formatGoogleMapsUrl(parsed.lat, parsed.lon)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Google Maps ↗
                      </a>
                      <a
                        href={formatOsmUrl(parsed.lat, parsed.lon)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        OpenStreetMap ↗
                      </a>
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                  <ShieldAlert className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  {accuracyCaveat(parsed)}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <CopyButton
                    getText={() => { handleSaveHistory("parse"); return renderMarkdown(parsed); }}
                    label="Copy as Markdown"
                  />
                  <DownloadButton
                    getText={() => renderCsv(parsed)}
                    filename="ip-geolocation.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                  <ShareButton
                    getUrl={() => buildShareUrl(target, provider, tab, token)}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {!parsed && (
            <EmptyState
              title="Paste a JSON response to parse"
              hint="Copy the response body from any provider (ipinfo.io, ip-api.com, ipgeolocation.io, ipapi.co, KeyCDN, HackerTarget) and the parser will normalize it into a unified card."
              icon={<FileJson className="h-8 w-8" />}
            />
          )}
        </>
      )}

      {tab === "bulk" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="pipgl-bulk">Bulk targets (one per line, comma, or whitespace)</Label>
                <Textarea
                  id="pipgl-bulk"
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder={"8.8.8.8\n1.1.1.1\n9.9.9.9"}
                  className="min-h-[120px] resize-y font-mono text-xs"
                />
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Label className="text-xs">Provider:</Label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as ProviderId)}
                    className="h-8 text-xs rounded border bg-background px-2"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                  <Badge variant="outline" className="text-[10px]">{bulkTargets.length} targets</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {bulkTargets.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Terminal className="h-4 w-4" /> Generated bulk curl script
                </h3>
                <pre className="text-[11px] font-mono bg-muted p-3 rounded border overflow-auto max-h-[400px] whitespace-pre-wrap break-all">
                  {bulkScript}
                </pre>
                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    getText={() => { handleSaveHistory("bulk"); return bulkScript; }}
                    label="Copy script"
                  />
                  <DownloadButton
                    getText={() => bulkScript}
                    filename="bulk-ip-geolocation.sh"
                    mime="application/x-sh"
                    label="Download .sh"
                  />
                  <ShareButton
                    getUrl={() => buildShareUrl(target, provider, tab, token)}
                  />
                </div>
              </CardContent>
            </Card>
          )}
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
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.action}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{PROVIDER_LABELS[h.provider]}</Badge>
                  <span className="font-mono text-muted-foreground">{h.target}</span>
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
            <strong className="text-foreground">Privacy:</strong> 100% client-side — this tool generates commands and parses pasted output only. It never sends queries or your IP to any server. History stores operation metadata only (target + action + provider), never the JSON body or your location data.
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

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xs font-mono ${value ? "text-foreground" : "text-muted-foreground/50"}`}>
        {value || "—"}
      </div>
    </div>
  );
}
