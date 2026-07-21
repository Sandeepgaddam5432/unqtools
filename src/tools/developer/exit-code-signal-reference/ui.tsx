"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  History, Search, Terminal, AlertCircle, CheckCircle2, Info,
  Code2, Zap, ShieldAlert,
} from "lucide-react";
import {
  EXIT_CODES,
  SIGNALS,
  RESERVED_RANGES,
  SAFE_CUSTOM_RANGES,
  SCRIPT_SNIPPETS,
  EXIT_CATEGORY_LABELS,
  SIGNAL_ACTION_LABELS,
  smartSearch,
  computeStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  renderExitTable,
  renderSignalTable,
  type DecodedExit,
  type SignalEntry,
  type HistoryEntry,
} from "./logic";

export default function ExitCodeSignalReference() {
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"lookup" | "exits" | "signals" | "snippets">("lookup");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.query) {
        setQuery(p.query);
        toast.info(`Loaded "${p.query}" from share link`);
      }
    }
  }, []);

  const stats = useMemo(() => computeStats(), []);
  const result = useMemo(() => smartSearch(query), [query]);

  const handleLookup = useCallback((q: string) => {
    if (!q.trim()) return;
    const r = smartSearch(q);
    const summary =
      r.decoded?.summary ?? r.signal?.description ?? `No match for "${q}"`;
    const kind: "code" | "signal" = /^-?\d+$/.test(q.trim()) ? "code" : "signal";
    saveHistory({ ts: Date.now(), query: q.trim(), kind, summary });
    setHistory(loadHistory());
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleClear = useCallback(() => {
    setQuery("");
  }, []);

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    if (tab === "lookup" && query.trim()) handleLookup(query);
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Search className="h-4 w-4" /> Lookup
            </h3>
            <span className="text-[10px] text-muted-foreground">
              {stats.totalExitCodes} exit codes · {stats.totalSignals} signals · {SCRIPT_SNIPPETS.length} snippets
            </span>
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleLookup(query); }}
            placeholder="Enter a code (137, 139) or a signal name (SIGKILL, KILL, 9)…"
            className="font-mono text-sm"
            autoFocus
          />
          <div className="flex flex-wrap gap-1.5">
            {["137", "139", "143", "130", "127", "255", "SIGKILL", "SIGTERM"].map((q) => (
              <Button
                key={q}
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] font-mono"
                onClick={() => { setQuery(q); handleLookup(q); }}
              >{q}</Button>
            ))}
            <ClearButton onClick={handleClear} />
            <ShareButton getUrl={() => buildShareUrl(query)} />
          </div>
        </CardContent>
      </Card>

      {/* Tab strip */}
      <div className="flex flex-wrap gap-1">
        {([
          { id: "lookup", label: "Lookup result", icon: Search },
          { id: "exits", label: `Exit codes (${stats.totalExitCodes})`, icon: Terminal },
          { id: "signals", label: `Signals (${stats.totalSignals})`, icon: Zap },
          { id: "snippets", label: "Bash snippets", icon: Code2 },
        ] as const).map((t) => {
          const Icon = t.icon;
          return (
            <Button
              key={t.id}
              variant={activeTab === t.id ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => handleTabChange(t.id)}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </Button>
          );
        })}
      </div>

      {activeTab === "lookup" && (
        <LookupResult
          query={query}
          decoded={result.decoded}
          signal={result.signal}
          exitCodes={result.exitCodes}
          signals={result.signals}
        />
      )}

      {activeTab === "exits" && (
        <ExitCodeTable
          rows={result.exitCodes.length > 0 && query.trim() ? result.exitCodes : EXIT_CODES}
        />
      )}

      {activeTab === "signals" && (
        <SignalTable
          rows={result.signals.length > 0 && query.trim() ? result.signals : SIGNALS}
        />
      )}

      {activeTab === "snippets" && <Snippets />}

      {/* Reserved / safe range guide */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4" /> Choosing your own exit codes
          </h3>
          <p className="text-xs text-muted-foreground">
            Avoid the reserved ranges below — they collide with shell conventions, sysexits.h, and the 128+N signal rule.
            Use the green ranges (3–63, 79–125, 160–199, 200–254) for your own application codes.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {RESERVED_RANGES.map((r) => (
              <div
                key={`${r.start}-${r.end}`}
                className={`rounded border px-2 py-1.5 text-[11px] ${
                  r.reserved
                    ? "border-red-300/50 bg-red-50/30 dark:bg-red-950/20"
                    : "border-emerald-300/50 bg-emerald-50/30 dark:bg-emerald-950/20"
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-mono font-medium text-foreground">
                    {r.start === r.end ? r.start : `${r.start}–${r.end}`}
                  </span>
                  <Badge variant={r.reserved ? "destructive" : "secondary"} className="text-[9px] h-4">
                    {r.reserved ? "Reserved" : "Safe"}
                  </Badge>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{r.label}</div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground pt-1">
            Safe ranges for custom codes: {SAFE_CUSTOM_RANGES.map((r) => r.start === r.end ? `${r.start}` : `${r.start}–${r.end}`).join(", ")}
          </div>
        </CardContent>
      </Card>

      {/* Recent history */}
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
              {history.slice(0, 8).map((h, i) => (
                <button
                  key={i}
                  onClick={() => { setQuery(h.query); handleLookup(h.query); setActiveTab("lookup"); }}
                  className="w-full text-left rounded border bg-background px-3 py-1.5 text-xs hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px]">{h.kind}</Badge>
                    <span className="font-mono text-foreground">{h.query}</span>
                    <span className="text-muted-foreground truncate flex-1">{h.summary}</span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Pure client-side lookup — no network calls, no ads, no tracking.
            History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function LookupResult({
  query,
  decoded,
  signal,
  exitCodes,
  signals,
}: {
  query: string;
  decoded?: DecodedExit;
  signal?: SignalEntry;
  exitCodes: typeof EXIT_CODES;
  signals: typeof SIGNALS;
}) {
  if (!query.trim()) {
    return (
      <EmptyState
        title="Enter a code or signal name"
        hint="Try 137 (SIGKILL / Docker OOM), 139 (SIGSEGV), 143 (SIGTERM), or type a name like SIGKILL / KILL / 9."
        icon={<Terminal className="h-8 w-8" />}
      />
    );
  }

  if (!decoded && !signal) {
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <span className="font-medium text-foreground">No exact match for &quot;{query}&quot;</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Try one of the example chips above (137, SIGKILL, …), or browse the Exit codes / Signals tabs for the full tables.
          </p>
          {(exitCodes.length > 0 || signals.length > 0) && (
            <div className="text-xs text-muted-foreground pt-1">
              Found {exitCodes.length} exit-code matches and {signals.length} signal matches in the tables above.
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {decoded && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-mono font-bold text-foreground">{decoded.wrappedCode}</h3>
                  {decoded.entry && (
                    <Badge variant="outline" className="font-mono text-[11px]">{decoded.entry.name}</Badge>
                  )}
                  {decoded.entry && (
                    <Badge variant="secondary" className="text-[10px]">
                      {EXIT_CATEGORY_LABELS[decoded.entry.category]}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{decoded.summary}</p>
              </div>
              <CopyButton getText={() => decoded.summary} label="" size="icon-sm" />
            </div>

            {decoded.wrapped && (
              <div className="rounded border border-amber-300/50 bg-amber-50/30 dark:bg-amber-950/20 px-3 py-2 text-xs flex items-start gap-2">
                <Info className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">Wrapped mod 256:</span> input <code className="font-mono">{decoded.code}</code> is outside the 0–255 byte range, so the kernel reports <code className="font-mono">{decoded.wrappedCode}</code>. Remember: <code>exit 256</code> → 0, <code>exit -1</code> → 255.
                </div>
              </div>
            )}

            {decoded.signal && (
              <SignalDetail signal={decoded.signal} compact />
            )}

            {decoded.note && (
              <div className="rounded border border-blue-300/50 bg-blue-50/30 dark:bg-blue-950/20 px-3 py-2 text-xs flex items-start gap-2">
                <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>{decoded.note}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className={`rounded border px-3 py-2 text-xs ${decoded.reserved ? "border-red-300/50 bg-red-50/30 dark:bg-red-950/20" : "border-emerald-300/50 bg-emerald-50/30 dark:bg-emerald-950/20"}`}>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Reserved?</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {decoded.reserved ? <AlertCircle className="h-3 w-3 text-red-500" /> : <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                  <span className="font-medium">{decoded.reserved ? "Yes — avoid for custom meanings" : "No"}</span>
                </div>
              </div>
              <div className={`rounded border px-3 py-2 text-xs ${decoded.safeForCustom ? "border-emerald-300/50 bg-emerald-50/30 dark:bg-emerald-950/20" : "border-red-300/50 bg-red-50/30 dark:bg-red-950/20"}`}>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Safe for custom use?</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {decoded.safeForCustom ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <AlertCircle className="h-3 w-3 text-red-500" />}
                  <span className="font-medium">{decoded.safeForCustom ? "Yes" : "No"}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {signal && decoded && !decoded.signal && (
        <Card>
          <CardContent className="p-4">
            <SignalDetail signal={signal} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SignalDetail({ signal, compact }: { signal: SignalEntry; compact?: boolean }) {
  return (
    <div className={`rounded border bg-muted/30 ${compact ? "p-2" : "p-3"} space-y-2`}>
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        <h4 className="font-mono font-semibold text-foreground">{signal.name}</h4>
        <Badge variant="outline" className="text-[10px]">#{signal.number}</Badge>
        {signal.keyboard && (
          <Badge variant="secondary" className="text-[10px]">{signal.keyboard}</Badge>
        )}
      </div>
      {!compact && (
        <p className="text-xs text-muted-foreground">{signal.description}</p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
        <div>
          <div className="text-[9px] uppercase text-muted-foreground">Action</div>
          <div className="font-medium">{SIGNAL_ACTION_LABELS[signal.action]}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase text-muted-foreground">Catchable</div>
          <div className="flex items-center gap-1">
            {signal.catchable ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <AlertCircle className="h-3 w-3 text-red-500" />}
            <span className="font-medium">{signal.catchable ? "Yes" : "No"}</span>
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase text-muted-foreground">Ignorable</div>
          <div className="flex items-center gap-1">
            {signal.ignorable ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <AlertCircle className="h-3 w-3 text-red-500" />}
            <span className="font-medium">{signal.ignorable ? "Yes" : "No"}</span>
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase text-muted-foreground">Exit code (128+N)</div>
          <div className="font-mono font-medium">{128 + signal.number}</div>
        </div>
      </div>
      {!compact && signal.note && (
        <div className="rounded border border-blue-300/50 bg-blue-50/30 dark:bg-blue-950/20 px-2 py-1.5 text-[11px] flex items-start gap-1.5">
          <Info className="h-3 w-3 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>{signal.note}</div>
        </div>
      )}
    </div>
  );
}

function ExitCodeTable({ rows }: { rows: typeof EXIT_CODES }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Terminal className="h-4 w-4" /> Exit codes ({rows.length})
          </h3>
          <div className="flex gap-1.5">
            <CopyButton getText={() => renderExitTable()} label="Copy TSV" size="sm" />
            <DownloadButton
              getText={() => renderExitTable()}
              filename="exit-codes.tsv"
              mime="text/tab-separated-values"
              label="Download TSV"
              size="sm"
            />
          </div>
        </div>
        <div className="max-h-[600px] overflow-auto rounded border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/50 backdrop-blur">
              <tr className="text-left">
                <th className="px-2 py-1.5 font-mono font-semibold">Code</th>
                <th className="px-2 py-1.5 font-semibold">Name</th>
                <th className="px-2 py-1.5 font-semibold">Category</th>
                <th className="px-2 py-1.5 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.code} className="border-t hover:bg-muted/30 align-top">
                  <td className="px-2 py-1.5 font-mono font-semibold text-foreground">{e.code}</td>
                  <td className="px-2 py-1.5 font-mono text-foreground">{e.name}</td>
                  <td className="px-2 py-1.5">
                    <Badge variant="outline" className="text-[9px]">{EXIT_CATEGORY_LABELS[e.category]}</Badge>
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{e.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function SignalTable({ rows }: { rows: typeof SIGNALS }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Zap className="h-4 w-4" /> Signals ({rows.length})
          </h3>
          <div className="flex gap-1.5">
            <CopyButton getText={() => renderSignalTable()} label="Copy TSV" size="sm" />
            <DownloadButton
              getText={() => renderSignalTable()}
              filename="unix-signals.tsv"
              mime="text/tab-separated-values"
              label="Download TSV"
              size="sm"
            />
          </div>
        </div>
        <div className="max-h-[600px] overflow-auto rounded border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/50 backdrop-blur">
              <tr className="text-left">
                <th className="px-2 py-1.5 font-mono font-semibold">#</th>
                <th className="px-2 py-1.5 font-semibold">Name</th>
                <th className="px-2 py-1.5 font-semibold">Action</th>
                <th className="px-2 py-1.5 font-semibold text-center">Catchable</th>
                <th className="px-2 py-1.5 font-semibold text-center">Ignorable</th>
                <th className="px-2 py-1.5 font-semibold">Keyboard</th>
                <th className="px-2 py-1.5 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.number} className="border-t hover:bg-muted/30 align-top">
                  <td className="px-2 py-1.5 font-mono font-semibold text-foreground">{s.number}</td>
                  <td className="px-2 py-1.5 font-mono text-foreground">{s.name}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{SIGNAL_ACTION_LABELS[s.action]}</td>
                  <td className="px-2 py-1.5 text-center">
                    {s.catchable
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 inline" />
                      : <AlertCircle className="h-3.5 w-3.5 text-red-500 inline" />}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {s.ignorable
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 inline" />
                      : <AlertCircle className="h-3.5 w-3.5 text-red-500 inline" />}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-muted-foreground">{s.keyboard ?? "—"}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{s.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Snippets() {
  return (
    <div className="space-y-3">
      {SCRIPT_SNIPPETS.map((snip) => (
        <Card key={snip.id}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Code2 className="h-3.5 w-3.5" /> {snip.title}
              </h4>
              <CopyButton getText={() => snip.code} label="Copy" size="sm" />
            </div>
            <p className="text-xs text-muted-foreground">{snip.description}</p>
            <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono overflow-x-auto whitespace-pre">
              {snip.code}
            </pre>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
