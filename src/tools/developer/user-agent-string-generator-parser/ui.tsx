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
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  UA_TEMPLATES,
  BROWSER_OPTIONS,
  OS_OPTIONS,
  DEVICE_CLASS_OPTIONS,
  EXPORT_FORMATS,
  MAX_COUNT,
  generateList,
  parseUA,
  explainTokens,
  detectBot,
  getCurrentUA,
  renderExport,
  exportFilename,
  exportMime,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  templateCount,
  uniqueBrowserCount,
  botCount,
  type GenerateOptions,
  type ExportFormat,
  type GeneratedUA,
  type ParsedUA,
  type HistoryEntry,
} from "./logic";
import {
  History, Globe, Wand2, Search, Smartphone, Bot as BotIcon,
  AlertTriangle, Cpu, Layers, Monitor, Tablet, Tv, Gamepad2,
} from "lucide-react";

type Mode = "generate" | "parse";

export default function UserAgentStringGeneratorParser() {
  const [mode, setMode] = useState<Mode>("generate");
  const [opts, setOpts] = useState<GenerateOptions>({ count: 10, deviceClass: "any" });
  const [list, setList] = useState<GeneratedUA[]>([]);
  const [exportFmt, setExportFmt] = useState<ExportFormat>("txt");
  const [parseInput, setParseInput] = useState<string>("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setMode(p.mode);
      setOpts(p.opts);
      if (p.mode === "parse" && p.ua) {
        setParseInput(p.ua);
      }
      toast.info("Loaded from share link");
    }
  }, []);

  const setOpt = useCallback(
    <K extends keyof GenerateOptions>(key: K, value: GenerateOptions[K]) => {
      setOpts((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const validation = useMemo(() => validateOptions(opts), [opts]);

  const handleGenerate = useCallback(() => {
    setError(null);
    const v = validateOptions(opts);
    if (!v.ok) {
      setError(v.error);
      toast.error(v.error);
      return;
    }
    const out = generateList(opts);
    if (out.length === 0) {
      const msg = "No templates matched the current filters.";
      setError(msg);
      toast.error(msg);
      return;
    }
    setList(out);
    const summary = `${out.length} UA${out.length === 1 ? "" : "s"} (${opts.deviceClass ?? "any"} / ${opts.browserKey ?? "any browser"} / ${opts.osFamily ?? "any OS"})`;
    saveHistory({
      ts: Date.now(),
      mode: "generate",
      summary,
      count: out.length,
      filter: `${opts.deviceClass ?? "any"}/${opts.browserKey ?? "any"}/${opts.osFamily ?? "any"}`,
      seed: opts.seed,
    });
    setHistory(loadHistory());
    toast.success(`Generated ${out.length} UA${out.length === 1 ? "" : "s"}`);
  }, [opts]);

  const parsed: ParsedUA | null = useMemo(
    () => (mode === "parse" && parseInput.trim() ? parseUA(parseInput) : null),
    [mode, parseInput],
  );

  const tokens = useMemo(
    () => (mode === "parse" && parseInput ? explainTokens(parseInput) : []),
    [mode, parseInput],
  );

  const botMatch = useMemo(
    () => (mode === "parse" && parseInput ? detectBot(parseInput) : null),
    [mode, parseInput],
  );

  const outputText = useMemo(() => {
    if (mode === "generate") return renderExport(list, exportFmt);
    return parseInput;
  }, [mode, list, exportFmt, parseInput]);

  const handleAutoDetect = useCallback(() => {
    const ua = getCurrentUA();
    if (!ua) {
      toast.error("navigator.userAgent is unavailable in this environment");
      return;
    }
    setMode("parse");
    setParseInput(ua);
    toast.success("Loaded your browser's UA");
  }, []);

  const handleClear = useCallback(() => {
    setList([]);
    setParseInput("");
    setError(null);
    toast.info("Cleared output");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSaveParseHistory = useCallback(() => {
    if (parseInput.trim()) {
      saveHistory({
        ts: Date.now(),
        mode: "parse",
        summary: parseInput.slice(0, 80),
        count: 1,
      });
      setHistory(loadHistory());
    }
  }, [parseInput]);

  const shareUrl = useMemo(() => {
    if (mode === "generate") return buildShareUrl(opts, "generate");
    return buildShareUrl({ count: 1 }, "parse", parseInput);
  }, [mode, opts, parseInput]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded border overflow-hidden">
              {(["generate", "parse"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 h-8 text-xs uppercase ${mode === m ? "bg-primary text-primary-foreground" : "bg-background"}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={handleAutoDetect} className="gap-1.5">
              <Search className="h-3.5 w-3.5" /> Auto-detect my UA
            </Button>
            <div className="ml-auto flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              <Badge variant="outline">{templateCount()} templates</Badge>
              <Badge variant="outline">{uniqueBrowserCount()} browsers</Badge>
              <Badge variant="outline">{botCount()} bots</Badge>
            </div>
          </div>

          {mode === "generate" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Field label={`Count (max ${MAX_COUNT.toLocaleString()})`}>
                <Input
                  type="number"
                  min={1}
                  max={MAX_COUNT}
                  value={opts.count}
                  onChange={(e) => setOpt("count", Math.max(1, Math.min(MAX_COUNT, Number(e.target.value) || 1)))}
                  className="h-8 text-xs"
                />
              </Field>
              <Field label="Device class">
                <select
                  value={opts.deviceClass ?? "any"}
                  onChange={(e) => setOpt("deviceClass", e.target.value as GenerateOptions["deviceClass"])}
                  className="h-8 w-full text-xs rounded border bg-background px-2"
                >
                  {DEVICE_CLASS_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </Field>
              <Field label="Browser">
                <select
                  value={opts.browserKey ?? ""}
                  onChange={(e) => setOpt("browserKey", e.target.value || undefined)}
                  className="h-8 w-full text-xs rounded border bg-background px-2"
                >
                  <option value="">Any browser</option>
                  {BROWSER_OPTIONS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </Field>
              <Field label="OS family">
                <select
                  value={opts.osFamily ?? ""}
                  onChange={(e) => setOpt("osFamily", e.target.value || undefined)}
                  className="h-8 w-full text-xs rounded border bg-background px-2"
                >
                  <option value="">Any OS</option>
                  {OS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Seed (optional)">
                <Input
                  type="text"
                  value={opts.seed ?? ""}
                  onChange={(e) => setOpt("seed", e.target.value || undefined)}
                  placeholder="random"
                  className="h-8 text-xs"
                />
              </Field>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="uap-parse" className="text-xs">User-Agent string to parse</Label>
              <Textarea
                id="uap-parse"
                value={parseInput}
                onChange={(e) => setParseInput(e.target.value)}
                placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                className="min-h-[80px] resize-y font-mono text-xs"
              />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {mode === "generate" && (
              <Button size="sm" onClick={handleGenerate} disabled={!validation.ok} className="gap-1.5">
                <Wand2 className="h-3.5 w-3.5" /> Generate
              </Button>
            )}
            {mode === "parse" && parseInput && (
              <Button size="sm" variant="outline" onClick={handleSaveParseHistory} className="gap-1.5">
                <History className="h-3.5 w-3.5" /> Save to history
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {/* Parse results */}
      {mode === "parse" && parsed && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Layers className="h-4 w-4" /> Parsed components
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
              <Stat label="Browser" value={`${parsed.browser.name}${parsed.browser.version ? ` ${parsed.browser.version}` : ""}`} icon={<Globe className="h-3 w-3" />} />
              <Stat label="Engine" value={`${parsed.engine.name}${parsed.engine.version ? ` ${parsed.engine.version}` : ""}`} icon={<Layers className="h-3 w-3" />} />
              <Stat label="OS" value={`${parsed.os.name}${parsed.os.version ? ` ${parsed.os.version}` : ""}`} icon={<Monitor className="h-3 w-3" />} />
              <Stat label="CPU" value={parsed.cpu.architecture} icon={<Cpu className="h-3 w-3" />} />
              <Stat
                label="Device"
                value={parsed.device.type === "unknown" ? "unknown" : `${parsed.device.type}${parsed.device.model ? ` (${parsed.device.model})` : ""}`}
                icon={deviceIcon(parsed.device.type)}
              />
              <Stat
                label="Bot"
                value={parsed.bot.isBot ? `${parsed.bot.name} (${parsed.bot.category})` : "No"}
                icon={<BotIcon className="h-3 w-3" />}
                highlight={parsed.bot.isBot ? "bad" : "good"}
              />
              <Stat label="Headless" value={parsed.isHeadless ? "Yes" : "No"} icon={<AlertTriangle className="h-3 w-3" />} highlight={parsed.isHeadless ? "bad" : "good"} />
              <Stat label="Vendor" value={parsed.device.vendor ?? "—"} icon={<Globe className="h-3 w-3" />} />
            </div>
            <div className="space-y-1 pt-2">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Token breakdown</Label>
              <div className="rounded border bg-background max-h-[260px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1 font-medium">Token</th>
                      <th className="text-left px-2 py-1 font-medium">Meaning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokens.map((t, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1 font-mono text-[10px] align-top whitespace-nowrap">{t.value}</td>
                        <td className="px-2 py-1 text-muted-foreground">{t.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {botMatch && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                <BotIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Bot detected:</strong> {botMatch.name} by {botMatch.vendor} — category: {botMatch.category}
                  {botMatch.version ? ` (version ${botMatch.version})` : ""}.
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <CopyButton getText={() => { handleSaveParseHistory(); return parseInput; }} label="Copy UA" />
              <ShareButton getUrl={() => shareUrl} />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate results */}
      {mode === "generate" && list.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Globe className="h-4 w-4" /> {list.length} generated UA{list.length === 1 ? "" : "s"}
              </h3>
              <select
                value={exportFmt}
                onChange={(e) => setExportFmt(e.target.value as ExportFormat)}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                {EXPORT_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <Textarea
              readOnly
              value={outputText}
              className="min-h-[280px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => outputText} label="Copy all" />
              <DownloadButton
                getText={() => outputText}
                filename={exportFilename(exportFmt)}
                mime={exportMime(exportFmt)}
                label="Download"
              />
              <ShareButton getUrl={() => shareUrl} />
              <ClearButton onClick={handleClear} />
            </div>
            {exportFmt === "txt" && (
              <div className="rounded border bg-background max-h-[240px] overflow-auto">
                {list.slice(0, 100).map((g, i) => (
                  <div key={i} className="border-b px-3 py-1.5 text-[11px] font-mono">
                    <Badge variant="outline" className="mr-2 text-[10px]">{g.template.deviceClass}</Badge>
                    <Badge variant="outline" className="mr-2 text-[10px]">{g.template.browser}</Badge>
                    <span className="text-foreground">{g.ua}</span>
                  </div>
                ))}
                {list.length > 100 && (
                  <div className="px-3 py-2 text-[10px] text-muted-foreground">
                    …and {list.length - 100} more — switch to TXT/CSV/JSON export to see all.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "generate" && list.length === 0 && (
        <EmptyState
          title="Generate realistic random User-Agent strings"
          hint={`Pick a count (1–${MAX_COUNT.toLocaleString()}), optionally filter by device class / browser / OS, and click Generate. Output is weighted by market share. ${templateCount()} templates across ${uniqueBrowserCount()} browsers and ${botCount()} bots. 100% client-side.`}
          icon={<Globe className="h-8 w-8" />}
        />
      )}

      {mode === "parse" && !parseInput && (
        <EmptyState
          title="Paste a User-Agent string to parse"
          hint="We'll break it down into browser, engine, OS, CPU, device, and bot info. Or click Auto-detect my UA to load your own browser's UA."
          icon={<Layers className="h-8 w-8" />}
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
                    <Badge variant="outline" className="text-[10px]">{h.mode}</Badge>
                    {h.filter && <Badge variant="outline" className="text-[10px]">{h.filter}</Badge>}
                    <Badge variant="outline" className="text-[10px]">×{h.count}</Badge>
                    {h.seed && <Badge variant="outline" className="text-[10px]">seed</Badge>}
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <code className="block mt-1 text-[10px] text-muted-foreground truncate">{h.summary}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All parsing and generation runs locally in your
            browser — nothing is uploaded. The auto-detect button reads navigator.userAgent locally. History
            (last {`${20}`}) is stored in localStorage on this device only, and the shareable URL encodes options
            in the fragment (after #) which browsers never transmit.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function deviceIcon(type: string): React.ReactNode {
  switch (type) {
    case "mobile": return <Smartphone className="h-3 w-3" />;
    case "tablet": return <Tablet className="h-3 w-3" />;
    case "console": return <Gamepad2 className="h-3 w-3" />;
    case "tv": return <Tv className="h-3 w-3" />;
    case "bot": return <BotIcon className="h-3 w-3" />;
    default: return <Monitor className="h-3 w-3" />;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div>{children}</div>
    </div>
  );
}

function Stat({
  label, value, icon, highlight,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  highlight?: "good" | "bad";
}) {
  const color = highlight === "bad"
    ? "text-amber-600 dark:text-amber-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}{label}
      </div>
      <div className={`text-sm font-medium ${color} truncate`}>{value}</div>
    </div>
  );
}

// Reference UA_TEMPLATES so the import is used (also re-exported for tests via logic.ts).
export const _TEMPLATE_COUNT = UA_TEMPLATES.length;
