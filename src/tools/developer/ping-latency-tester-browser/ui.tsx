"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  RunButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  DEFAULT_OPTIONS,
  OS_LABELS,
  LATENCY_CLASS_LABELS,
  DEFAULT_TARGETS,
  classifyLatency,
  normalizeTarget,
  validateTarget,
  generatePingCommand,
  generatePingCommands,
  buildFetchTimingPlan,
  computeStats,
  computeHistogram,
  formatLatency,
  renderStatsCsv,
  renderSamplesCsv,
  renderHistogramText,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  makeId,
  type OS,
  type PingOptions,
  type LatencySample,
  type HistoryEntry,
} from "./logic";
import {
  Activity, History, Terminal, Gauge, AlertTriangle, CheckCircle2,
  Play, Square, Trash2, Globe, Zap,
} from "lucide-react";

const LATENCY_CLASS_COLORS: Record<string, string> = {
  fast: "text-emerald-600 dark:text-emerald-400",
  good: "text-emerald-600 dark:text-emerald-400",
  moderate: "text-amber-600 dark:text-amber-400",
  slow: "text-red-600 dark:text-red-400",
};

export default function PingLatencyTesterBrowser() {
  const [target, setTarget] = useState("https://example.com");
  const [count, setCount] = useState(DEFAULT_OPTIONS.count);
  const [intervalMs, setIntervalMs] = useState(DEFAULT_OPTIONS.intervalMs);
  const [timeoutMs, setTimeoutMs] = useState(DEFAULT_OPTIONS.timeoutMs);
  const [payloadSize, setPayloadSize] = useState(DEFAULT_OPTIONS.payloadSize);
  const [selectedOs, setSelectedOs] = useState<OS>("linux");
  const [samples, setSamples] = useState<LatencySample[]>([]);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const stopRef = useRef(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.target) setTarget(p.target);
      setCount(p.count);
      setIntervalMs(p.intervalMs);
      setTimeoutMs(p.timeoutMs);
      setPayloadSize(p.payloadSize);
      if (p.target) toast.info("Loaded from share link");
    }
  }, []);

  const options: PingOptions = useMemo(
    () => ({
      ...DEFAULT_OPTIONS,
      count,
      intervalMs,
      timeoutMs,
      payloadSize,
      resolveHostnames: false,
      ipv4: false,
      ipv6: false,
      flood: false,
      quiet: false,
      timestamps: false,
    }),
    [count, intervalMs, timeoutMs, payloadSize],
  );

  const cmds = useMemo(
    () => generatePingCommands(target || "example.com", options),
    [target, options],
  );
  const cmdForSelected = cmds[selectedOs];

  const validTarget = useMemo(() => validateTarget(target), [target]);

  const stats = useMemo(() => computeStats(samples), [samples]);
  const successfulRtts = useMemo(
    () => samples.filter((s) => s.ok && s.rttMs !== null).map((s) => s.rttMs as number),
    [samples],
  );
  const buckets = useMemo(() => computeHistogram(successfulRtts, 8), [successfulRtts]);
  const histText = useMemo(() => renderHistogramText(buckets), [buckets]);

  const statsCsv = useMemo(() => renderStatsCsv(stats), [stats]);
  const samplesCsv = useMemo(() => renderSamplesCsv(samples), [samples]);

  const maxRtt = useMemo(() => {
    if (successfulRtts.length === 0) return 1;
    return Math.max(1, ...successfulRtts);
  }, [successfulRtts]);

  const handleRun = useCallback(async () => {
    const v = validateTarget(target);
    if (!v.ok || !v.normalized) {
      toast.error(v.error ?? "Invalid target");
      return;
    }
    setRunning(true);
    stopRef.current = false;
    setSamples([]);
    const plan = buildFetchTimingPlan(v.normalized, options, false);
    const collected: LatencySample[] = [];
    // Warm-up request — discard.
    try {
      await fetch(buildCacheBustUrl(v.normalized), {
        method: "HEAD", mode: "no-cors", cache: "no-store", redirect: "follow",
      });
    } catch {
      // ignore warm-up errors
    }
    for (let i = 0; i < plan.count; i++) {
      if (stopRef.current) break;
      const seq = i + 1;
      const t0 = performance.now();
      let ok = true;
      let error: string | undefined;
      try {
        await fetchWithTimeout(buildCacheBustUrl(v.normalized), plan.timeoutMs);
      } catch (e) {
        ok = false;
        error = e instanceof Error ? e.message : String(e);
      }
      const rtt = performance.now() - t0;
      collected.push({
        seq,
        rttMs: ok ? Math.round(rtt * 1000) / 1000 : null,
        ok,
        error,
        ts: Date.now(),
      });
      setSamples([...collected]);
      if (i < plan.count - 1 && !stopRef.current) {
        await new Promise((r) => setTimeout(r, plan.intervalMs));
      }
    }
    setRunning(false);
    const finalStats = computeStats(collected);
    saveHistory({
      ts: Date.now(),
      target: v.normalized,
      count: collected.length,
      avgMs: finalStats.avgMs,
      jitterMs: finalStats.jitterMs,
      lossPct: finalStats.lossPct,
    });
    setHistory(loadHistory());
    if (collected.length > 0) {
      toast.success(`Done — ${collected.length} samples, avg ${formatLatency(finalStats.avgMs)}`);
    }
  }, [target, options]);

  const handleStop = useCallback(() => {
    stopRef.current = true;
    setRunning(false);
    toast.info("Stopped");
  }, []);

  const handleClear = useCallback(() => {
    setSamples([]);
    toast.info("Cleared samples");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-3">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
            <p>
              <strong className="text-foreground">Honesty note:</strong> Browsers cannot send
              raw ICMP ping packets — that requires the OS CLI. The in-browser runner below
              measures HTTPS <em>fetch</em> round-trip latency (with cache-busting and no-store),
              which includes DNS + TLS + TCP overhead on the first request. For real ICMP ping,
              copy the command below and run it in your terminal.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="plt-target">Target host or URL</Label>
            <Input
              id="plt-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="https://example.com  or  8.8.8.8"
              className="font-mono text-sm"
            />
            {target && !validTarget.ok && (
              <p className="text-xs text-red-600 dark:text-red-400">{validTarget.error}</p>
            )}
            <div className="flex flex-wrap gap-1 pt-1">
              {DEFAULT_TARGETS.map((t) => (
                <Button
                  key={t.id}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setTarget(t.url)}
                >
                  <Globe className="h-3 w-3 mr-1" /> {t.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <NumField label="Count" value={count} min={1} max={100} onChange={setCount} />
            <NumField label="Interval (ms)" value={intervalMs} min={10} max={10000} onChange={setIntervalMs} />
            <NumField label="Timeout (ms)" value={timeoutMs} min={100} max={30000} onChange={setTimeoutMs} />
            <NumField label="Payload size (B)" value={payloadSize} min={0} max={65500} onChange={setPayloadSize} />
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {!running ? (
              <RunButton onClick={handleRun} label="Run fetch timing" disabled={!validTarget.ok} />
            ) : (
              <Button variant="destructive" size="sm" onClick={handleStop} className="gap-1.5">
                <Square className="h-3.5 w-3.5" /> Stop
              </Button>
            )}
            <ClearButton onClick={handleClear} disabled={samples.length === 0 || running} label="Clear samples" />
            <ShareButton getUrl={() => buildShareUrl({ target, count, intervalMs, timeoutMs, payloadSize })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Terminal className="h-4 w-4" /> ICMP ping command
            </h3>
            <div className="flex gap-1">
              {(Object.keys(OS_LABELS) as OS[]).map((o) => (
                <Button
                  key={o}
                  variant={selectedOs === o ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelectedOs(o)}
                >
                  {o === "windows" ? "Windows" : o === "linux" ? "Linux" : "macOS"}
                </Button>
              ))}
            </div>
          </div>
          <pre className="text-xs font-mono bg-muted rounded p-3 overflow-auto whitespace-pre-wrap break-all">
            {cmdForSelected || "# enter a target host above"}
          </pre>
          <p className="text-[11px] text-muted-foreground">
            {OS_LABELS[selectedOs]} — run in your terminal for real ICMP echo. Browsers can't send ICMP.
          </p>
        </CardContent>
      </Card>

      {samples.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Gauge className="h-4 w-4" /> Statistics ({samples.length} samples)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                <Stat label="Min" value={formatLatency(stats.minMs)} />
                <Stat label="Avg" value={formatLatency(stats.avgMs)} />
                <Stat label="Max" value={formatLatency(stats.maxMs)} />
                <Stat label="Stddev" value={formatLatency(stats.stddevMs)} />
                <Stat label="Jitter" value={formatLatency(stats.jitterMs)} />
                <Stat label="Success" value={`${stats.success}/${stats.count}`} />
                <Stat label="Failed" value={stats.failed} highlight={stats.failed > 0 ? "bad" : undefined} />
                <Stat label="Loss" value={`${stats.lossPct.toFixed(1)}%`} highlight={stats.lossPct > 0 ? "bad" : "good"} />
                {stats.avgMs !== null && (
                  <Stat
                    label="Class"
                    value={LATENCY_CLASS_LABELS[classifyLatency(stats.avgMs)].split(" ")[0]}
                    highlight={classifyLatency(stats.avgMs) === "slow" ? "bad" : "good"}
                  />
                )}
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground">Sparkline (RTT per sample)</h4>
                <div className="flex items-end gap-0.5 h-16 bg-muted rounded p-1 overflow-hidden">
                  {samples.map((s) => (
                    <div
                      key={s.seq}
                      className="flex-1 min-w-[2px] rounded-t"
                      style={{
                        height: s.ok && s.rttMs !== null
                          ? `${Math.max(2, (s.rttMs / maxRtt) * 100)}%`
                          : "2px",
                        backgroundColor: !s.ok
                          ? "rgb(220 38 38)"
                          : s.rttMs !== null && s.rttMs < 50
                            ? "rgb(16 185 129)"
                            : s.rttMs !== null && s.rttMs < 100
                              ? "rgb(34 197 94)"
                              : s.rttMs !== null && s.rttMs < 200
                                ? "rgb(245 158 11)"
                                : "rgb(239 68 68)",
                      }}
                      title={s.ok && s.rttMs !== null ? `#${s.seq}: ${formatLatency(s.rttMs)}` : `#${s.seq}: failed`}
                    />
                  ))}
                </div>
              </div>
              {buckets.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-muted-foreground">Histogram (8 buckets)</h4>
                  <pre className="text-[10px] font-mono bg-muted rounded p-2 overflow-auto">{histText}</pre>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <CopyButton getText={() => samplesCsv} label="Copy samples CSV" />
                <DownloadButton getText={() => samplesCsv} filename="ping-samples.csv" mime="text/csv" label="Download samples" />
                <DownloadButton getText={() => statsCsv} filename="ping-stats.csv" mime="text/csv" label="Download stats" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Activity className="h-4 w-4" /> Samples
              </h3>
              <div className="space-y-1 max-h-[300px] overflow-auto">
                {samples.map((s) => (
                  <div key={s.seq} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                    <Badge variant="outline" className="text-[10px] w-8 justify-center">#{s.seq}</Badge>
                    {s.ok && s.rttMs !== null ? (
                      <>
                        <span className={`font-mono font-medium ${LATENCY_CLASS_COLORS[classifyLatency(s.rttMs)]}`}>
                          {formatLatency(s.rttMs)}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {LATENCY_CLASS_LABELS[classifyLatency(s.rttMs)].split(" ")[0]}
                        </Badge>
                      </>
                    ) : (
                      <span className="font-mono text-red-600 dark:text-red-400">
                        ✗ {s.error ?? "failed"}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {new Date(s.ts).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Run a fetch-timing test to see latency statistics"
          hint="Enter a target host or URL, set count/interval/timeout, and click Run. Or copy the ICMP ping command above to run in your terminal."
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
                  <span className="font-mono text-muted-foreground truncate max-w-[60%]">{h.target}</span>
                  <Badge variant="outline" className="text-[10px]">avg {formatLatency(h.avgMs)}</Badge>
                  <Badge variant="outline" className="text-[10px]">jitter {formatLatency(h.jitterMs)}</Badge>
                  <Badge variant={h.lossPct > 0 ? "destructive" : "secondary"} className="text-[10px]">
                    {h.lossPct.toFixed(0)}% loss
                  </Badge>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {new Date(h.ts).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All command generation and
            statistics run locally. The fetch-timing runner sends HTTPS HEAD requests directly
            from your browser to the target host (cache-busted, no-store). History is stored in
            localStorage on this device only.
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

// Helper: cache-bust URL with a fresh timestamp each call.
function buildCacheBustUrl(baseUrl: string): string {
  const norm = normalizeTarget(baseUrl);
  const sep = norm.includes("?") ? "&" : "?";
  return `${norm}${sep}_=${Date.now()}`;
}

// Helper: fetch with timeout via AbortController.
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-store",
      redirect: "follow",
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}
