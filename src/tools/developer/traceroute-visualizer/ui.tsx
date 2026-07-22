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
  DEFAULT_OPTIONS,
  OS_LABELS,
  generateTracerouteCommand,
  generateTracerouteCommands,
  generateMtrCommand,
  detectFormat,
  parseAuto,
  computeHopStats,
  analyzePath,
  isPrivateIp,
  isIpv6,
  validateHost,
  formatRtt,
  renderTable,
  renderGraph,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type OS,
  type TracerouteOptions,
  type Hop,
  type TraceFormat,
  type HistoryEntry,
} from "./logic";
import {
  Route, History, Terminal, AlertTriangle, CheckCircle2,
  Globe, Network, Activity, Zap, Server,
} from "lucide-react";

const FORMAT_LABELS: Record<TraceFormat, string> = {
  windows: "Windows tracert",
  linux: "Linux/macOS traceroute",
  mtr: "mtr --report",
  unknown: "Unknown",
};

const FORMAT_COLORS: Record<TraceFormat, string> = {
  windows: "text-blue-600 dark:text-blue-400",
  linux: "text-emerald-600 dark:text-emerald-400",
  mtr: "text-purple-600 dark:text-purple-400",
  unknown: "text-muted-foreground",
};

export default function TracerouteVisualizer() {
  const [host, setHost] = useState("example.com");
  const [maxHops, setMaxHops] = useState(DEFAULT_OPTIONS.maxHops);
  const [timeoutMs, setTimeoutMs] = useState(DEFAULT_OPTIONS.timeoutMs);
  const [queriesPerHop, setQueriesPerHop] = useState(DEFAULT_OPTIONS.queriesPerHop);
  const [resolveHostnames, setResolveHostnames] = useState(true);
  const [ipv4, setIpv4] = useState(false);
  const [ipv6, setIpv6] = useState(false);
  const [selectedOs, setSelectedOs] = useState<OS>("linux");
  const [showMtr, setShowMtr] = useState(false);
  const [output, setOutput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.host) setHost(p.host);
      if (p.output) {
        setOutput(p.output);
        toast.info("Loaded trace from share link");
      }
    }
  }, []);

  const options: TracerouteOptions = useMemo(
    () => ({
      ...DEFAULT_OPTIONS,
      maxHops, timeoutMs, queriesPerHop, resolveHostnames, ipv4, ipv6,
    }),
    [maxHops, timeoutMs, queriesPerHop, resolveHostnames, ipv4, ipv6],
  );

  const hostValid = useMemo(() => validateHost(host), [host]);
  const cmds = useMemo(
    () => generateTracerouteCommands(hostValid.ok ? host : "example.com", options),
    [host, hostValid, options],
  );
  const cmdForSelected = cmds[selectedOs];
  const mtrCmd = useMemo(
    () => generateMtrCommand(hostValid.ok ? host : "example.com", { count: 10, resolveHostnames, ipv4, ipv6, wide: true }),
    [host, hostValid, resolveHostnames, ipv4, ipv6],
  );

  const parseResult = useMemo(() => (output.trim() ? parseAuto(output) : null), [output]);
  const detectedFormat = useMemo(() => (output.trim() ? detectFormat(output) : "unknown"), [output]);
  const hops = parseResult?.hops ?? [];
  const hopStats = useMemo(() => hops.map(computeHopStats), [hops]);
  const analysis = useMemo(() => analyzePath(hops), [hops]);
  const tableText = useMemo(() => renderTable(hops), [hops]);
  const graphText = useMemo(() => renderGraph(hops), [hops]);
  const csvText = useMemo(() => renderCsv(hops), [hops]);
  const jsonText = useMemo(() => renderJson(hops), [hops]);

  const maxAvg = useMemo(() => {
    const avgs = hopStats.map((s) => s.avgMs ?? 0);
    return avgs.length === 0 ? 1 : Math.max(1, ...avgs);
  }, [hopStats]);

  const handleClear = useCallback(() => {
    setOutput("");
    toast.info("Cleared output");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (hops.length === 0) return;
    saveHistory({
      ts: Date.now(),
      host: parseResult?.host ?? host,
      format: detectedFormat,
      hopCount: hops.length,
      slowestRtt: analysis.slowestRtt,
      endToEndMs: analysis.endToEndMs,
    });
    setHistory(loadHistory());
  }, [hops, parseResult, host, detectedFormat, analysis]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-3">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
            <p>
              <strong className="text-foreground">Honesty note:</strong> Browsers cannot
              run native traceroute — that requires the OS CLI. Generate a command below,
              run it in your terminal, then paste the output back into the box to parse
              and visualize the path. 100% client-side — no packets are sent.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tv-host">Target host or IP</Label>
            <Input
              id="tv-host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="example.com  or  8.8.8.8  or  2606:4700::1111"
              className="font-mono text-sm"
            />
            {host && !hostValid.ok && (
              <p className="text-xs text-red-600 dark:text-red-400">{hostValid.error}</p>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <NumField label="Max hops" value={maxHops} min={1} max={64} onChange={setMaxHops} />
            <NumField label="Timeout (ms)" value={timeoutMs} min={100} max={30000} onChange={setTimeoutMs} />
            <NumField label="Queries/hop" value={queriesPerHop} min={1} max={16} onChange={setQueriesPerHop} />
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Resolve</Label>
              <div className="flex items-center h-8 gap-2">
                <input
                  type="checkbox"
                  id="tv-resolve"
                  checked={resolveHostnames}
                  onChange={(e) => setResolveHostnames(e.target.checked)}
                />
                <Label htmlFor="tv-resolve" className="text-xs cursor-pointer">hostnames</Label>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={ipv4} onChange={(e) => { setIpv4(e.target.checked); if (e.target.checked) setIpv6(false); }} />
              IPv4 (-4)
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={ipv6} onChange={(e) => { setIpv6(e.target.checked); if (e.target.checked) setIpv4(false); }} />
              IPv6 (-6)
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Terminal className="h-4 w-4" /> Trace command
            </h3>
            <div className="flex gap-1">
              <Button
                variant={!showMtr && selectedOs === "windows" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setSelectedOs("windows"); setShowMtr(false); }}
              >Windows</Button>
              <Button
                variant={!showMtr && selectedOs === "linux" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setSelectedOs("linux"); setShowMtr(false); }}
              >Linux</Button>
              <Button
                variant={!showMtr && selectedOs === "macos" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setSelectedOs("macos"); setShowMtr(false); }}
              >macOS</Button>
              <Button
                variant={showMtr ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowMtr(true)}
              >mtr</Button>
            </div>
          </div>
          <pre className="text-xs font-mono bg-muted rounded p-3 overflow-auto whitespace-pre-wrap break-all">
            {showMtr ? (mtrCmd || "# enter a target host above") : (cmdForSelected || "# enter a target host above")}
          </pre>
          <p className="text-[11px] text-muted-foreground">
            {showMtr
              ? "mtr combines traceroute + ping in real time. --report runs N cycles and prints a summary."
              : `${OS_LABELS[selectedOs]} — run in your terminal, then paste the output below.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => showMtr ? mtrCmd : cmdForSelected} label="Copy command" />
            <CopyButton
              getText={() => { handleSaveHistory(); return output; }}
              label="Copy output"
              disabled={!output}
            />
            <ShareButton getUrl={() => buildShareUrl({ host, output })} disabled={!output} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label htmlFor="tv-output">Paste traceroute / tracert / mtr output here</Label>
          <Textarea
            id="tv-output"
            value={output}
            onChange={(e) => setOutput(e.target.value)}
            placeholder={"traceroute to example.com (93.184.216.34), 30 hops max, 60 byte packets\n 1  192.168.1.1 (192.168.1.1)  0.521 ms  0.489 ms  0.503 ms\n 2  10.0.0.1 (10.0.0.1)  4.221 ms  4.189 ms  4.203 ms\n ..."}
            className="min-h-[160px] resize-y font-mono text-xs"
          />
          {output.trim() && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Detected format:</span>
              <Badge variant="outline" className={`text-[10px] ${FORMAT_COLORS[detectedFormat]}`}>
                {FORMAT_LABELS[detectedFormat]}
              </Badge>
              {parseResult && parseResult.host && (
                <Badge variant="secondary" className="text-[10px]">→ {parseResult.host}</Badge>
              )}
              <ClearButton onClick={handleClear} label="Clear output" />
            </div>
          )}
        </CardContent>
      </Card>

      {hops.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Network className="h-4 w-4" /> Path analysis
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                <Stat label="Hops" value={analysis.hopCount} />
                <Stat label="End-to-end" value={analysis.endToEndMs !== null ? formatRtt(analysis.endToEndMs) : "—"} />
                <Stat label="Slowest hop" value={analysis.slowestHop ?? "—"} highlight={analysis.slowestHop !== null ? "bad" : undefined} />
                <Stat label="Slowest RTT" value={analysis.slowestRtt !== null ? formatRtt(analysis.slowestRtt) : "—"} highlight={analysis.slowestRtt !== null ? "bad" : undefined} />
                <Stat label="Biggest jump" value={analysis.biggestJumpMs !== null ? `${formatRtt(analysis.biggestJumpMs)} @ hop ${analysis.biggestJumpHop}` : "—"} />
                <Stat label="Timeouts" value={`${analysis.timeouts}/${analysis.hopCount}`} highlight={analysis.timeouts > 0 ? "bad" : "good"} />
                <Stat label="Timeout %" value={`${analysis.timeoutPct.toFixed(0)}%`} highlight={analysis.timeoutPct > 0 ? "bad" : "good"} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Activity className="h-4 w-4" /> Latency graph
              </h3>
              <div className="space-y-1 max-h-[400px] overflow-auto">
                {hopStats.map((s) => {
                  const isSlowest = analysis.slowestHop === s.hop;
                  const isJump = analysis.biggestJumpHop === s.hop;
                  return (
                    <div key={s.hop} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-muted-foreground w-8 text-right">{s.hop}</span>
                      <span className="font-mono text-muted-foreground w-16 text-right">
                        {s.avgMs === null ? "*" : formatRtt(s.avgMs)}
                      </span>
                      <div className="flex-1 h-4 bg-muted rounded relative overflow-hidden">
                        {s.avgMs !== null && (
                          <div
                            className="h-full rounded transition-all"
                            style={{
                              width: `${Math.max(2, (s.avgMs / maxAvg) * 100)}%`,
                              backgroundColor: isSlowest
                                ? "rgb(220 38 38)"
                                : isJump
                                  ? "rgb(245 158 11)"
                                  : s.avgMs < 50
                                    ? "rgb(16 185 129)"
                                    : s.avgMs < 200
                                      ? "rgb(245 158 11)"
                                      : "rgb(239 68 68)",
                            }}
                          />
                        )}
                      </div>
                      <div className="flex gap-1 w-32 justify-end">
                        {s.timeout && <Badge variant="destructive" className="text-[9px]">timeout</Badge>}
                        {s.isPrivate && <Badge variant="outline" className="text-[9px]">private</Badge>}
                        {s.isIpv6 && <Badge variant="outline" className="text-[9px]">ipv6</Badge>}
                        {isSlowest && <Badge variant="destructive" className="text-[9px]">slowest</Badge>}
                        {isJump && <Badge variant="outline" className="text-[9px] text-amber-600 dark:text-amber-400">jump</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Server className="h-4 w-4" /> Hop table ({hops.length} hops)
              </h3>
              <div className="overflow-auto max-h-[500px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-1.5 px-2 font-medium">#</th>
                      <th className="py-1.5 px-2 font-medium">Hostname</th>
                      <th className="py-1.5 px-2 font-medium">IP</th>
                      <th className="py-1.5 px-2 font-medium text-right">RTT × {queriesPerHop}</th>
                      <th className="py-1.5 px-2 font-medium text-right">Avg</th>
                      <th className="py-1.5 px-2 font-medium text-right">Loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hops.map((h, i) => {
                      const s = hopStats[i];
                      const isSlowest = analysis.slowestHop === h.hop;
                      return (
                        <tr key={h.hop} className={`border-b ${isSlowest ? "bg-red-50 dark:bg-red-950/20" : ""}`}>
                          <td className="py-1.5 px-2 font-mono">{h.hop}</td>
                          <td className="py-1.5 px-2 font-mono">
                            {h.timeout ? <span className="text-red-600 dark:text-red-400">* * *</span> : (
                              <span>
                                {h.hostname || h.ip}
                                {h.asInfo && <Badge variant="outline" className="ml-1 text-[9px]">{h.asInfo}</Badge>}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 font-mono text-muted-foreground">
                            {h.ip && (
                              <span className={isPrivateIp(h.ip) ? "text-amber-600 dark:text-amber-400" : isIpv6(h.ip) ? "text-purple-600 dark:text-purple-400" : ""}>
                                {h.ip}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 font-mono text-right">
                            {h.rtts.map((r, j) => (
                              <span key={j} className="inline-block ml-1">
                                {r === null ? <span className="text-red-600 dark:text-red-400">*</span> : formatRtt(r)}
                              </span>
                            ))}
                          </td>
                          <td className="py-1.5 px-2 font-mono text-right">
                            {s.avgMs !== null ? formatRtt(s.avgMs) : "—"}
                          </td>
                          <td className={`py-1.5 px-2 font-mono text-right ${s.lossPct > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                            {s.lossPct.toFixed(0)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => tableText} label="Copy table" />
                <CopyButton getText={() => graphText} label="Copy graph" />
                <DownloadButton getText={() => csvText} filename="traceroute.csv" mime="text/csv" label="Download CSV" />
                <DownloadButton getText={() => jsonText} filename="traceroute.json" mime="application/json" label="Download JSON" />
                <DownloadButton getText={() => `${tableText}\n\n${graphText}`} filename="traceroute.txt" mime="text/plain" label="Download text" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Route className="h-4 w-4" /> ASCII graph preview
              </h3>
              <pre className="text-[10px] font-mono bg-muted rounded p-3 overflow-auto whitespace-pre">{graphText}</pre>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste traceroute / tracert / mtr output to visualize"
          hint="Generate a command above, run it in your terminal, then paste the output into the box. The parser auto-detects Windows, Linux/macOS and mtr formats."
          icon={<Zap className="h-8 w-8" />}
        />
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Globe className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono text-muted-foreground truncate max-w-[40%]">{h.host}</span>
                  <Badge variant="outline" className={`text-[10px] ${FORMAT_COLORS[h.format]}`}>{FORMAT_LABELS[h.format]}</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.hopCount} hops</Badge>
                  {h.endToEndMs !== null && (
                    <Badge variant="secondary" className="text-[10px]">e2e {formatRtt(h.endToEndMs)}</Badge>
                  )}
                  {h.slowestRtt !== null && (
                    <Badge variant="secondary" className="text-[10px]">slow {formatRtt(h.slowestRtt)}</Badge>
                  )}
                  <span className="ml-auto text-[10px] text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All command generation,
            parsing and visualization run locally in your browser. History is stored in
            localStorage on this device only. The tool never sends packets — it generates
            commands for your terminal and parses pasted output.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function NumField({
  label, value, min, max, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
          else if (e.target.value === "") onChange(min);
        }}
        className="h-8 text-sm"
      />
    </div>
  );
}

function Stat({
  label, value, highlight,
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
