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
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  STYLE_LABELS,
  THEME_LABELS,
  THEME_COLORS,
  SAMPLE_TIMEZONES,
  STYLE_OPTIONS,
  THEME_OPTIONS,
  ONFINISH_OPTIONS,
  parseTargetDateTime,
  validateTimezone,
  validateConfig,
  computeCountdown,
  formatCountdown,
  formatTargetLabel,
  generateEmbedSnippet,
  generateStandaloneHtml,
  generateIcsEvent,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  defaultConfig,
  type TimerConfig,
  type Style,
  type Theme,
  type OnFinish,
  type TimezoneMode,
  type HistoryEntry,
} from "./logic";
import {
  History, Timer, FileCode, Calendar, ExternalLink, Eye, Code2,
  Sparkles, Info, RefreshCw,
} from "lucide-react";

type Output = "preview" | "embed" | "standalone" | "ics" | "text";

const OUTPUTS: { id: Output; label: string; icon: React.ReactNode }[] = [
  { id: "preview", label: "Live preview", icon: <Eye className="h-3.5 w-3.5" /> },
  { id: "embed", label: "Embed snippet", icon: <Code2 className="h-3.5 w-3.5" /> },
  { id: "standalone", label: "Standalone HTML", icon: <FileCode className="h-3.5 w-3.5" /> },
  { id: "ics", label: "ICS calendar", icon: <Calendar className="h-3.5 w-3.5" /> },
  { id: "text", label: "Plain text", icon: <Sparkles className="h-3.5 w-3.5" /> },
];

function nowIsoLocal(): string {
  // Local datetime-local input format: YYYY-MM-DDTHH:MM
  const d = new Date();
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  const hh = d.getHours().toString().padStart(2, "0");
  const mi = d.getMinutes().toString().padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mi}`;
}

function isoLocalToIso(local: string): string {
  if (!local) return "";
  // Treat the local-typed value as a local-time input; convert to ISO.
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

export default function CountdownTimerGenerator() {
  const [cfg, setCfg] = useState<TimerConfig>(() => defaultConfig());
  // Local datetime input value (YYYY-MM-DDTHH:MM)
  const [targetLocal, setTargetLocal] = useState<string>(() => {
    const d = new Date(cfg.targetIso);
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    const hh = d.getHours().toString().padStart(2, "0");
    const mi = d.getMinutes().toString().padStart(2, "0");
    return `${y}-${m}-${day}T${hh}:${mi}`;
  });
  const [output, setOutput] = useState<Output>("preview");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (Object.keys(parsed).length > 0) {
        setCfg((prev) => ({ ...prev, ...parsed }));
        if (parsed.targetIso) {
          const d = new Date(parsed.targetIso);
          const y = d.getFullYear();
          const m = (d.getMonth() + 1).toString().padStart(2, "0");
          const day = d.getDate().toString().padStart(2, "0");
          const hh = d.getHours().toString().padStart(2, "0");
          const mi = d.getMinutes().toString().padStart(2, "0");
          setTargetLocal(`${y}-${m}-${day}T${hh}:${mi}`);
        }
        toast.info("Loaded from share link");
      }
    }
  }, []);

  // Tick the live preview every second.
  useEffect(() => {
    if (output !== "preview") return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [output]);

  // Sync targetLocal → cfg.targetIso
  useEffect(() => {
    const iso = isoLocalToIso(targetLocal);
    if (iso) setCfg((prev) => ({ ...prev, targetIso: iso }));
  }, [targetLocal]);

  const validation = useMemo(() => validateConfig(cfg), [cfg]);
  const parts = useMemo(() => {
    if (!validation.ok) return null;
    return computeCountdown(cfg, new Date(nowTick));
  }, [cfg, nowTick, validation.ok]);

  const liveText = useMemo(() => {
    if (!parts) return "";
    return formatCountdown(cfg, parts);
  }, [cfg, parts]);

  const embedSnippet = useMemo(() => {
    if (!validation.ok) return "";
    return generateEmbedSnippet(cfg);
  }, [cfg, validation.ok]);

  const standalone = useMemo(() => {
    if (!validation.ok) return "";
    return generateStandaloneHtml(cfg);
  }, [cfg, validation.ok]);

  const ics = useMemo(() => {
    if (!validation.ok) return "";
    try { return generateIcsEvent(cfg); } catch { return ""; }
  }, [cfg, validation.ok]);

  const targetLabel = useMemo(() => formatTargetLabel(cfg), [cfg]);

  const update = useCallback(<K extends keyof TimerConfig>(key: K, value: TimerConfig[K]) => {
    setCfg((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleRecordHistory = useCallback(() => {
    if (!validation.ok) return;
    saveHistory({
      ts: Date.now(),
      title: cfg.title,
      targetIso: cfg.targetIso,
      style: cfg.style,
      theme: cfg.theme,
      recurringAnnual: cfg.recurringAnnual,
    });
    setHistory(loadHistory());
  }, [cfg, validation.ok]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleReset = useCallback(() => {
    const fresh = defaultConfig();
    setCfg(fresh);
    const d = new Date(fresh.targetIso);
    setTargetLocal(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}T${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`);
    toast.info("Reset to defaults");
  }, []);

  const themeColors = THEME_COLORS[cfg.theme];

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cd-title" className="text-sm font-semibold">Title</Label>
              <Input
                id="cd-title"
                value={cfg.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="Countdown to event"
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cd-target" className="text-sm font-semibold">Target date &amp; time</Label>
              <Input
                id="cd-target"
                type="datetime-local"
                value={targetLocal}
                onChange={(e) => setTargetLocal(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Style">
              <select
                value={cfg.style}
                onChange={(e) => update("style", e.target.value as Style)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {STYLE_OPTIONS.map((s) => <option key={s} value={s}>{STYLE_LABELS[s]}</option>)}
              </select>
            </Field>
            <Field label="Theme">
              <select
                value={cfg.theme}
                onChange={(e) => update("theme", e.target.value as Theme)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {THEME_OPTIONS.map((t) => <option key={t} value={t}>{THEME_LABELS[t]}</option>)}
              </select>
            </Field>
            <Field label="Timezone mode">
              <select
                value={cfg.timezoneMode}
                onChange={(e) => update("timezoneMode", e.target.value as TimezoneMode)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                <option value="visitor">Visitor-local (auto)</option>
                <option value="fixed">Fixed IANA zone</option>
              </select>
            </Field>
            {cfg.timezoneMode === "fixed" ? (
              <Field label="Fixed zone">
                <select
                  value={cfg.fixedTimezone}
                  onChange={(e) => update("fixedTimezone", e.target.value)}
                  className="h-8 w-full text-xs rounded border bg-background px-2"
                >
                  {SAMPLE_TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="On finish">
                <select
                  value={cfg.onFinish}
                  onChange={(e) => update("onFinish", e.target.value as OnFinish)}
                  className="h-8 w-full text-xs rounded border bg-background px-2"
                >
                  {ONFINISH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            )}
          </div>

          {cfg.timezoneMode === "visitor" && (
            <Field label="On finish behavior">
              <select
                value={cfg.onFinish}
                onChange={(e) => update("onFinish", e.target.value as OnFinish)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {ONFINISH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
          )}

          {cfg.onFinish === "message" && (
            <div className="space-y-1.5">
              <Label htmlFor="cd-msg" className="text-xs">Finished message</Label>
              <Input
                id="cd-msg"
                value={cfg.finishedMessage ?? ""}
                onChange={(e) => update("finishedMessage", e.target.value)}
                placeholder="🎉 The wait is over!"
                className="text-xs"
              />
            </div>
          )}
          {cfg.onFinish === "redirect" && (
            <div className="space-y-1.5">
              <Label htmlFor="cd-url" className="text-xs">Redirect URL</Label>
              <Input
                id="cd-url"
                value={cfg.redirectUrl ?? ""}
                onChange={(e) => update("redirectUrl", e.target.value)}
                placeholder="https://example.com/launch"
                className="font-mono text-xs"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={cfg.showLabels}
                onChange={(e) => update("showLabels", e.target.checked)}
              />
              Show unit labels
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={cfg.countUpAfterTarget}
                onChange={(e) => update("countUpAfterTarget", e.target.checked)}
              />
              Count up after target
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={cfg.recurringAnnual}
                onChange={(e) => update("recurringAnnual", e.target.checked)}
              />
              Recurring annual (auto-roll)
            </label>
          </div>

          {!validation.ok && (
            <ErrorBanner message={validation.errors.join(" ")} />
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={handleReset}>
              <RefreshCw className="h-3 w-3 mr-1" /> Reset
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => {
                const future = new Date();
                future.setMonth(future.getMonth() + 1);
                const y = future.getFullYear();
                const m = (future.getMonth() + 1).toString().padStart(2, "0");
                const d = future.getDate().toString().padStart(2, "0");
                const hh = future.getHours().toString().padStart(2, "0");
                const mi = future.getMinutes().toString().padStart(2, "0");
                setTargetLocal(`${y}-${m}-${d}T${hh}:${mi}`);
              }}
            >+1 month</Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => {
                const future = new Date();
                future.setDate(future.getDate() + 7);
                const y = future.getFullYear();
                const m = (future.getMonth() + 1).toString().padStart(2, "0");
                const d = future.getDate().toString().padStart(2, "0");
                const hh = future.getHours().toString().padStart(2, "0");
                const mi = future.getMinutes().toString().padStart(2, "0");
                setTargetLocal(`${y}-${m}-${d}T${hh}:${mi}`);
              }}
            >+1 week</Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => {
                // New Year's Eve of next year.
                const future = new Date(new Date().getFullYear() + 1, 11, 31, 23, 59, 0, 0);
                setTargetLocal(`${future.getFullYear()}-12-31T23:59`);
                update("title", "New Year's Eve");
              }}
            >New Year&apos;s Eve</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-1">
            {OUTPUTS.map((o) => (
              <Button
                key={o.id}
                variant={output === o.id ? "default" : "outline"}
                size="sm"
                className="gap-1.5"
                onClick={() => setOutput(o.id)}
                disabled={!validation.ok && o.id !== "preview"}
              >
                {o.icon}
                {o.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {output === "preview" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Eye className="h-4 w-4" /> Live preview
              </h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-[10px]">{STYLE_LABELS[cfg.style]}</Badge>
                <Badge variant="outline" className="text-[10px]">{THEME_LABELS[cfg.theme]}</Badge>
                {cfg.recurringAnnual && <Badge variant="outline" className="text-[10px]">annual</Badge>}
                {cfg.countUpAfterTarget && <Badge variant="outline" className="text-[10px]">count-up</Badge>}
              </div>
            </div>

            {/* Static preview using current cfg & computed parts. The actual embed runs its own setInterval. */}
            <div className="rounded-lg border bg-muted/20 p-6 flex items-center justify-center overflow-x-auto">
              <div
                ref={previewRef}
                role="timer"
                aria-live="polite"
                aria-atomic="true"
                style={{
                  background: themeColors.bg,
                  color: themeColors.fg,
                  padding: "1rem 1.25rem",
                  borderRadius: "0.5rem",
                  display: "inline-block",
                  minWidth: "280px",
                  textAlign: "center",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                }}
              >
                <div style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  marginBottom: "0.5rem",
                  color: themeColors.accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}>{cfg.title}</div>
                {parts && parts.isFinished && !cfg.countUpAfterTarget ? (
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: themeColors.accent }}>
                    {cfg.onFinish === "message" ? (cfg.finishedMessage || "Countdown finished") : "Reached target"}
                  </div>
                ) : parts && (
                  cfg.style === "simple" ? (
                    <div style={{ fontSize: "1.25rem", fontWeight: 600, color: themeColors.fg }}>
                      {pad2(parts.days)}d {pad2(parts.hours)}h {pad2(parts.minutes)}m {pad2(parts.seconds)}s {parts.isFinished ? "since" : "until"}
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", alignItems: "flex-start" }}>
                      {[
                        { v: parts.days, l: "Days" },
                        { v: parts.hours, l: "Hours" },
                        { v: parts.minutes, l: "Minutes" },
                        { v: parts.seconds, l: "Seconds" },
                      ].map((u) => (
                        <div key={u.l} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "3rem" }}>
                          <div style={{
                            fontSize: "1.75rem",
                            fontWeight: 700,
                            color: themeColors.fg,
                            background: "rgba(0,0,0,0.15)",
                            padding: "0.4rem 0.5rem",
                            borderRadius: "0.35rem",
                            minWidth: "2.5rem",
                            textAlign: "center",
                          }}>{pad2(u.v)}</div>
                          {cfg.showLabels && (
                            <div style={{
                              fontSize: "0.65rem",
                              marginTop: "0.25rem",
                              color: themeColors.label,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}>{u.l}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="rounded border bg-background p-3 text-xs space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Target</div>
              <div className="font-mono text-foreground">{targetLabel}</div>
              {parts && (
                <div className="text-muted-foreground">
                  {parts.isFinished
                    ? (cfg.countUpAfterTarget
                      ? `Target reached ${Math.abs(parts.days)}d ${pad2(parts.hours)}h ${pad2(parts.minutes)}m ${pad2(parts.seconds)}s ago`
                      : "Target reached")
                    : `${parts.days}d ${pad2(parts.hours)}h ${pad2(parts.minutes)}m ${pad2(parts.seconds)}s remaining`}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => { handleRecordHistory(); return liveText; }} label="Copy live text" />
              <ShareButton getUrl={() => { handleRecordHistory(); return buildShareUrl(cfg); }} />
              <ClearButton onClick={handleReset} label="Reset" />
            </div>
          </CardContent>
        </Card>
      )}

      {output === "embed" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Code2 className="h-4 w-4" /> Embeddable HTML snippet
              </h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleRecordHistory(); return embedSnippet; }} label="Copy snippet" />
                <DownloadButton
                  getText={() => embedSnippet}
                  filename="countdown-widget.html"
                  mime="text/html"
                  label="Download .html"
                />
                <ShareButton getUrl={() => buildShareUrl(cfg)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste this into any HTML page or CMS post. Zero dependencies, zero tracking, watermark-free. The widget updates itself every second.
            </p>
            <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono overflow-auto max-h-[400px]">
              {embedSnippet}
            </pre>
          </CardContent>
        </Card>
      )}

      {output === "standalone" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <FileCode className="h-4 w-4" /> Standalone HTML page
              </h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleRecordHistory(); return standalone; }} label="Copy page" />
                <DownloadButton
                  getText={() => standalone}
                  filename="countdown-standalone.html"
                  mime="text/html"
                  label="Download .html"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              A complete <code>&lt;!DOCTYPE html&gt;</code> page with the widget centered. Save as <code>.html</code> and open directly in any browser.
            </p>
            <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono overflow-auto max-h-[400px]">
              {standalone}
            </pre>
          </CardContent>
        </Card>
      )}

      {output === "ics" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> ICS calendar event
              </h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleRecordHistory(); return ics; }} label="Copy ICS" />
                <DownloadButton
                  getText={() => ics}
                  filename="countdown-event.ics"
                  mime="text/calendar"
                  label="Download .ics"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Import into Google Calendar, Apple Calendar, Outlook, or any calendar app that supports the iCalendar (.ics) standard. The event is a 1-hour block starting at the target time.
            </p>
            <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono overflow-auto max-h-[400px]">
              {ics}
            </pre>
          </CardContent>
        </Card>
      )}

      {output === "text" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> Plain-text countdown
              </h3>
              <CopyButton getText={() => { handleRecordHistory(); return liveText; }} label="Copy text" />
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-center font-mono text-sm text-foreground">
              {liveText}
            </div>
            <p className="text-xs text-muted-foreground">
              Updates every second while on the preview tab. Useful for email, chat, status lines, or anywhere plain text is preferred.
            </p>
          </CardContent>
        </Card>
      )}

      {!validation.ok && (
        <EmptyState
          title="Fix the configuration to enable outputs"
          hint={validation.errors.join(" ") || "Target date/time is required."}
          icon={<Timer className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{h.style}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.theme}</Badge>
                    {h.recurringAnnual && <Badge variant="outline" className="text-[10px]">annual</Badge>}
                    <span className="text-foreground font-medium truncate">{h.title}</span>
                    <span className="ml-auto text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground mt-0.5">{h.targetIso}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All countdown math and code generation runs locally. The exported widget has zero external dependencies, no tracking, and no watermark. History (last 20) is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div>{children}</div>
    </div>
  );
}
