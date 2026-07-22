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
  History, Network, ShieldAlert, BookOpen, Search,
  AlertTriangle, Lock, Filter, Database,
} from "lucide-react";
import {
  PORTS,
  PORT_COUNT,
  DATASET_VERSION,
  DATASET_DATE,
  DATASET_SOURCE,
  CATEGORIES,
  PROTOCOLS,
  classifyRange,
  rangeLabel,
  findByPort,
  findByService,
  isNumericQuery,
  searchPorts,
  groupByRange,
  computeStats,
  securitySummary,
  explainCategory,
  explainEncrypted,
  formatAsText,
  formatAsMarkdown,
  formatAsCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PortEntry,
  type PortCategory,
  type Protocol,
  type HistoryEntry,
} from "./logic";

type ProtocolFilter = Protocol | "any";
type CategoryFilter = PortCategory | "any";
type SortKey = "port" | "service" | "category";

export default function WellKnownCommonPortsReference() {
  const [query, setQuery] = useState("");
  const [protocol, setProtocol] = useState<ProtocolFilter>("any");
  const [category, setCategory] = useState<CategoryFilter>("any");
  const [encryptedOnly, setEncryptedOnly] = useState(false);
  const [exploitedOnly, setExploitedOnly] = useState(false);
  const [useRange, setUseRange] = useState(false);
  const [rangeStart, setRangeStart] = useState<number>(8000);
  const [rangeEnd, setRangeEnd] = useState<number>(9000);
  const [groupBy, setGroupBy] = useState<"none" | "range" | "category">("none");
  const [sortKey, setSortKey] = useState<SortKey>("port");
  const [exportFormat, setExportFormat] = useState<"text" | "markdown" | "csv">("text");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.query) setQuery(p.query);
      if (p.protocol) setProtocol(p.protocol as ProtocolFilter);
      if (p.category) setCategory(p.category as CategoryFilter);
      if (p.query || p.protocol || p.category) toast.info("Loaded from share link");
    }
  }, []);

  const results = useMemo(() => {
    const r = searchPorts({
      query,
      protocol,
      category,
      encryptedOnly,
      commonlyExploitedOnly: exploitedOnly,
      rangeStart: useRange ? rangeStart : undefined,
      rangeEnd: useRange ? rangeEnd : undefined,
    });
    // Sort
    const sorted = r.slice().sort((a, b) => {
      if (sortKey === "port") return a.port - b.port || a.protocol.localeCompare(b.protocol);
      if (sortKey === "service") return a.service.localeCompare(b.service) || a.port - b.port;
      // category
      return a.category.localeCompare(b.category) || a.port - b.port;
    });
    return sorted;
  }, [query, protocol, category, encryptedOnly, exploitedOnly, useRange, rangeStart, rangeEnd, sortKey]);

  const stats = useMemo(() => computeStats(), []);
  const groupedByRange = useMemo(() => groupByRange(results), [results]);

  const groupedByCategory = useMemo(() => {
    const map = new Map<PortCategory, PortEntry[]>();
    for (const p of results) {
      if (!map.has(p.category)) map.set(p.category, []);
      map.get(p.category)!.push(p);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [results]);

  const handleSaveHistory = useCallback(() => {
    if (!query && protocol === "any" && category === "any" && !encryptedOnly && !exploitedOnly && !useRange) return;
    saveHistory({ ts: Date.now(), query, protocol: String(protocol), category: String(category) });
    setHistory(loadHistory());
  }, [query, protocol, category, encryptedOnly, exploitedOnly, useRange]);

  const handleClear = useCallback(() => {
    setQuery("");
    setProtocol("any");
    setCategory("any");
    setEncryptedOnly(false);
    setExploitedOnly(false);
    setUseRange(false);
    setGroupBy("none");
    toast.info("Filters cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const shareUrl = useMemo(
    () => buildShareUrl({ query, protocol: String(protocol), category: String(category) }),
    [query, protocol, category],
  );

  const exportText = useMemo(() => {
    if (results.length === 0) return "";
    if (exportFormat === "text") return formatAsText(results);
    if (exportFormat === "markdown") return formatAsMarkdown(results);
    return formatAsCsv(results);
  }, [results, exportFormat]);

  const exportFilename = useMemo(() => {
    const ext = exportFormat === "markdown" ? "md" : exportFormat === "csv" ? "csv" : "txt";
    return `common-ports.${ext}`;
  }, [exportFormat]);

  const categoryTone = (c: PortCategory): string => {
    const map: Record<PortCategory, string> = {
      web: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
      mail: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
      database: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
      remote: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
      "file-transfer": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      "name-resolution": "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
      security: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
      messaging: "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/30",
      network: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30",
      media: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30",
      printing: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
      directory: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
      other: "bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/30",
    };
    return map[c];
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Network className="h-4 w-4" /> Search {PORT_COUNT} common ports
            </h3>
            <Badge variant="outline" className="text-[10px]">
              v{DATASET_VERSION} · {DATASET_DATE}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Dataset: {DATASET_SOURCE}. Bundled and runs 100% offline — no lookup leaves your device.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="ports-search">Search by port number or service name</Label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="ports-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isNumericQuery(query) ? "443" : "https, ssh, mysql, dns, rdp…"}
                className="font-mono text-sm h-9 pl-8"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {isNumericQuery(query)
                ? "Numeric query — searching by port number."
                : "Two-way search — port → service and service → port."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <Filter className="h-3 w-3" /> Protocol
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {PROTOCOLS.map((p) => (
                <Button
                  key={p}
                  variant={protocol === p ? "default" : "outline"}
                  size="sm"
                  onClick={() => setProtocol(p)}
                  className="font-mono text-xs"
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant={category === "any" ? "default" : "outline"}
                size="sm"
                onClick={() => setCategory("any")}
                className="text-xs"
              >
                any
              </Button>
              {CATEGORIES.map((c) => (
                <Button
                  key={c}
                  variant={category === c ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategory(c)}
                  className="text-xs"
                >
                  {c}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={encryptedOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setEncryptedOnly((v) => !v)}
              className="gap-1.5 text-xs"
            >
              <Lock className="h-3 w-3" /> Encrypted only
            </Button>
            <Button
              variant={exploitedOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setExploitedOnly((v) => !v)}
              className="gap-1.5 text-xs"
            >
              <ShieldAlert className="h-3 w-3" /> Commonly exploited
            </Button>
            <Button
              variant={useRange ? "default" : "outline"}
              size="sm"
              onClick={() => setUseRange((v) => !v)}
              className="gap-1.5 text-xs"
            >
              <Filter className="h-3 w-3" /> Range view
            </Button>
          </div>

          {useRange && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground" htmlFor="ports-range-start">Start port</Label>
                <Input
                  id="ports-range-start"
                  type="number"
                  min={0}
                  max={65535}
                  value={rangeStart}
                  onChange={(e) => setRangeStart(parseInt(e.target.value, 10) || 0)}
                  className="font-mono text-sm h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground" htmlFor="ports-range-end">End port</Label>
                <Input
                  id="ports-range-end"
                  type="number"
                  min={0}
                  max={65535}
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(parseInt(e.target.value, 10) || 0)}
                  className="font-mono text-sm h-8"
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Group by</Label>
              <div className="flex gap-1.5">
                {(["none", "range", "category"] as const).map((g) => (
                  <Button key={g} variant={groupBy === g ? "default" : "outline"} size="sm" onClick={() => setGroupBy(g)} className="text-xs">
                    {g === "none" ? "none" : g === "range" ? "IANA range" : "category"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Sort by</Label>
              <div className="flex gap-1.5">
                {(["port", "service", "category"] as const).map((s) => (
                  <Button key={s} variant={sortKey === s ? "default" : "outline"} size="sm" onClick={() => setSortKey(s)} className="text-xs">
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <ShareButton getUrl={() => { handleSaveHistory(); return shareUrl; }} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Database className="h-4 w-4" /> Results ({results.length})
            </h3>
            {results.length > 0 && (
              <div className="flex items-center gap-1.5">
                {(["text", "markdown", "csv"] as const).map((f) => (
                  <Button
                    key={f}
                    variant={exportFormat === f ? "default" : "outline"}
                    size="sm"
                    onClick={() => setExportFormat(f)}
                    className="text-[11px] h-7"
                  >
                    {f}
                  </Button>
                ))}
                <DownloadButton
                  getText={() => exportText}
                  filename={exportFilename}
                  label="Export"
                  size="sm"
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Total ports" value={String(stats.total)} />
            <Stat label="Encrypted" value={String(stats.encryptedCount)} />
            <Stat label="Commonly exploited" value={String(stats.commonlyExploitedCount)} tone={stats.commonlyExploitedCount > 0 ? "warn" : undefined} />
            <Stat label="Showing" value={String(results.length)} tone={results.length === 0 ? "bad" : "good"} />
          </div>

          {results.length === 0 ? (
            <EmptyState
              title="No ports match your filters"
              hint="Try clearing the search box or relaxing protocol/category filters."
              icon={<Search className="h-8 w-8" />}
            />
          ) : groupBy === "none" ? (
            <div className="space-y-1 max-h-[600px] overflow-auto pr-1">
              {results.map((p, i) => (
                <PortRow key={`${p.port}-${p.protocol}-${i}`} p={p} categoryTone={categoryTone} />
              ))}
            </div>
          ) : groupBy === "range" ? (
            <div className="space-y-3">
              {(["well-known", "registered", "dynamic"] as const).map((r) => {
                const list = groupedByRange[r];
                if (list.length === 0) return null;
                return (
                  <div key={r} className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="text-[10px]">{rangeLabel(r)}</Badge>
                      <span className="text-muted-foreground">{list.length} ports</span>
                    </div>
                    <div className="space-y-1 max-h-[300px] overflow-auto pr-1">
                      {list.map((p, i) => (
                        <PortRow key={`${p.port}-${p.protocol}-${i}`} p={p} categoryTone={categoryTone} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {groupedByCategory.map(([cat, list]) => (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className={`text-[10px] ${categoryTone(cat)}`}>{cat}</Badge>
                    <span className="text-muted-foreground">{list.length} ports</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{explainCategory(cat)}</p>
                  <div className="space-y-1 max-h-[300px] overflow-auto pr-1">
                    {list.map((p, i) => (
                      <PortRow key={`${p.port}-${p.protocol}-${i}`} p={p} categoryTone={categoryTone} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /> Dataset reference
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Source" value="IANA + Wikipedia" />
            <Stat label="Version" value={`v${DATASET_VERSION}`} />
            <Stat label="Snapshot" value={DATASET_DATE} />
            <Stat label="Entries" value={String(PORT_COUNT)} />
          </div>
          <div className="text-[11px] text-muted-foreground">
            <p>
              The dataset combines the <strong>IANA Service Name & Port Registry</strong> (the
              authoritative assignment list) with curated entries from the <strong>Wikipedia
              TCP/UDP port list</strong>. Each entry includes the canonical service name,
              alternate aliases, description, protocol (TCP/UDP/both), IANA range (well-known
              0–1023, registered 1024–49151, dynamic 49152–65535), category, encryption flag
              with the encrypted alternative when one exists, and a security note for risky ports.
            </p>
            <p className="mt-1">
              The snapshot date is shown so you know how current the data is. For the live
              authoritative registry, visit <code className="font-mono">iana.org/assignments/service-names</code>.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <History className="h-4 w-4" /> Search history (max 20)
            </h3>
            {history.length > 0 && (
              <ClearButton onClick={handleClearHistory} label="Clear history" />
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Your last 20 search queries will appear here. The history stores only the query
              string + active filters — never any personally identifying data.
            </p>
          ) : (
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => { setQuery(h.query); setProtocol(h.protocol as ProtocolFilter); setCategory(h.category as CategoryFilter); }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/40"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {h.query ? <code className="font-mono text-foreground">{h.query}</code> : <span className="text-muted-foreground">(no query)</span>}
                    {h.protocol !== "any" && <Badge variant="outline" className="text-[9px] font-mono">{h.protocol}</Badge>}
                    {h.category !== "any" && <Badge variant="outline" className="text-[9px]">{h.category}</Badge>}
                    <span className="text-[10px] text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PortRow({
  p,
  categoryTone,
}: {
  p: PortEntry;
  categoryTone: (c: PortCategory) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="rounded border bg-background px-3 py-2 text-xs space-y-1 cursor-pointer hover:bg-muted/30"
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <code className="font-mono text-sm font-semibold text-foreground">{p.port}</code>
        <Badge variant="outline" className="text-[10px] font-mono">/{p.protocol}</Badge>
        <code className="font-mono text-foreground">{p.service}</code>
        {p.aliases?.map((a) => (
          <Badge key={a} variant="outline" className="text-[9px] font-mono">{a}</Badge>
        ))}
        <Badge variant="outline" className={`text-[9px] ${categoryTone(p.category)}`}>{p.category}</Badge>
        {p.encrypted ? (
          <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            <Lock className="h-2.5 w-2.5 mr-0.5 inline" />encrypted
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-700 dark:text-amber-300">
            cleartext
          </Badge>
        )}
        {p.commonlyExploited && (
          <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-700 dark:text-red-300">
            <ShieldAlert className="h-2.5 w-2.5 mr-0.5 inline" />exploited
          </Badge>
        )}
        <Badge variant="outline" className="text-[9px]">{rangeLabel(classifyRange(p.port)).split(" ")[0]}</Badge>
        <div className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <CopyButton getText={() => `${p.port}/${p.protocol} ${p.service}`} label="" size="sm" />
        </div>
      </div>
      <p className="text-foreground">{p.description}</p>
      {expanded && (
        <div className="space-y-1 pt-1 border-t border-border/50 mt-1">
          <p className="text-[11px] text-muted-foreground">{explainEncrypted(p)}</p>
          {p.securityNote && (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>{p.securityNote}</span>
            </div>
          )}
          <div className="rounded bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Security summary:</span> {securitySummary(p)}
          </div>
          {p.encryptedAlternative && (
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">Encrypted alternative:</span>{" "}
              <code className="font-mono text-foreground">{p.encryptedAlternative}</code>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "warn";
}) {
  const toneClass =
    tone === "bad"
      ? "text-red-700 dark:text-red-300"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-300"
        : tone === "good"
          ? "text-emerald-700 dark:text-emerald-300"
          : "text-foreground";
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
