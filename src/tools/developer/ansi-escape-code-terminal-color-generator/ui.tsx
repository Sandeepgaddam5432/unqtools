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
  History, Palette, Type, Code2, Terminal, Eye, FileCode, AlertTriangle, CheckCircle2, Wand2,
} from "lucide-react";
import {
  DEFAULT_CONFIG,
  PRESETS,
  ESCAPE_LABELS,
  ESCAPE_PREFIXES,
  STYLE_DEFS,
  STANDARD_16_COLORS,
  TERMINAL_SUPPORT_NOTES,
  hexToRgb,
  rgbToHex,
  x256ToRgb,
  x256Grid,
  colorToSgrParams,
  generateSgrParams,
  generateEscape,
  generateLanguageSnippets,
  decodeAnsi,
  stripAnsi,
  buildPreviewSegments,
  colorToCss,
  validateConfig,
  computeStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type AnsiConfig,
  type ColorSpec,
  type ColorMode,
  type EscapeFormat,
  type SgrStyle,
  type HistoryEntry,
} from "./logic";

const COLOR_MODE_LABELS: Record<ColorMode, string> = {
  none: "None",
  standard16: "Standard 16",
  bright16: "Bright 16",
  x256: "256-color",
  truecolor: "Truecolor (24-bit)",
};

export default function AnsiEscapeCodeTerminalColorGenerator() {
  const [config, setConfig] = useState<AnsiConfig>(DEFAULT_CONFIG);
  const [decodeInput, setDecodeInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed) {
        setConfig({ ...DEFAULT_CONFIG, ...parsed });
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const validation = useMemo(() => validateConfig(config), [config]);
  const escape = useMemo(() => generateEscape(config), [config]);
  const snippets = useMemo(() => generateLanguageSnippets(config), [config]);
  const stats = useMemo(() => computeStats(config), [config]);
  const previewSegs = useMemo(() => buildPreviewSegments(config), [config]);
  const decodeResult = useMemo(() => decodeAnsi(decodeInput), [decodeInput]);
  const palette = useMemo(() => x256Grid(), []);

  const updateField = useCallback(
    <K extends keyof AnsiConfig>(key: K, value: AnsiConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const updateColor = useCallback((which: "fg" | "bg", patch: Partial<ColorSpec>) => {
    setConfig((prev) => ({ ...prev, [which]: { ...prev[which], ...patch } }));
  }, []);

  const toggleStyle = useCallback((style: SgrStyle) => {
    setConfig((prev) => ({
      ...prev,
      styles: prev.styles.includes(style)
        ? prev.styles.filter((s) => s !== style)
        : [...prev.styles, style],
    }));
  }, []);

  const loadPreset = useCallback((id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const cloned = JSON.parse(JSON.stringify(preset.config)) as AnsiConfig;
    setConfig(cloned);
    toast.success(`Loaded preset: ${preset.label}`);
  }, []);

  const handleSaveHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      text: config.text,
      fgMode: config.fg.mode,
      bgMode: config.bg.mode,
      styleCount: config.styles.length,
      escapeFormat: config.escapeFormat,
    });
    setHistory(loadHistory());
  }, [config]);

  const handleClear = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    toast.info("Reset to defaults");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const applyHexToFg = useCallback((hex: string) => {
    const rgb = hexToRgb(hex);
    if (!rgb) { toast.error("Invalid hex"); return; }
    updateColor("fg", { mode: "truecolor", rgb });
  }, [updateColor]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Text + escape format */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <Type className="h-4 w-4 text-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Sample text & escape format</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ansi-text" className="text-xs">Sample text</Label>
              <Input
                id="ansi-text"
                value={config.text}
                onChange={(e) => updateField("text", e.target.value)}
                className="h-8 text-xs font-mono"
                placeholder="Hello, ANSI!"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ansi-fmt" className="text-xs">Escape format</Label>
              <select
                id="ansi-fmt"
                value={config.escapeFormat}
                onChange={(e) => updateField("escapeFormat", e.target.value as EscapeFormat)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(ESCAPE_LABELS) as EscapeFormat[]).map((f) => (
                  <option key={f} value={f}>{ESCAPE_LABELS[f]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            <Toggle label="Auto-reset" checked={config.appendReset} onChange={(v) => updateField("appendReset", v)} />
            <Toggle label="Bash \\[ \\] wrap" checked={config.wrapBash} onChange={(v) => updateField("wrapBash", v)} />
            <Toggle label="Visible ^[ marker" checked={config.showVisibleEsc} onChange={(v) => updateField("showVisibleEsc", v)} />
          </div>
          <div>
            <Label className="text-xs">Presets</Label>
            <div className="flex flex-wrap gap-1 pt-1">
              {PRESETS.map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => loadPreset(p.id)}
                  title={p.description}
                >{p.label}</Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Styles */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-1.5">
            <Wand2 className="h-4 w-4 text-foreground" />
            <h3 className="text-sm font-semibold text-foreground">SGR styles</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {STYLE_DEFS.map((s) => (
              <button
                key={s.id}
                onClick={() => toggleStyle(s.id)}
                className={`px-3 py-1.5 rounded text-xs border transition ${
                  config.styles.includes(s.id)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted border-border"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ColorPicker
          title="Foreground"
          spec={config.fg}
          onChange={(patch) => updateColor("fg", patch)}
          onHex={applyHexToFg}
        />
        <ColorPicker
          title="Background"
          spec={config.bg}
          onChange={(patch) => updateColor("bg", patch)}
          onHex={(hex) => {
            const rgb = hexToRgb(hex);
            if (!rgb) { toast.error("Invalid hex"); return; }
            updateColor("bg", { mode: "truecolor", rgb });
          }}
        />
      </div>

      {/* 256 palette */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Palette className="h-4 w-4" /> 256-color palette
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setPaletteOpen((o) => !o)}>
              {paletteOpen ? "Hide" : "Show"}
            </Button>
          </div>
          {paletteOpen && (
            <div
              className="grid gap-0.5 max-h-[260px] overflow-auto"
              style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}
            >
              {palette.map((c) => (
                <button
                  key={c.id}
                  title={`256 id ${c.id} · ${c.hex}`}
                  onClick={() => {
                    updateColor("fg", { mode: "x256", index: c.id });
                    toast.success(`FG set to 256-color ${c.id}`);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    updateColor("bg", { mode: "x256", index: c.id });
                    toast.success(`BG set to 256-color ${c.id}`);
                  }}
                  className="h-5 w-5 rounded-sm border border-border/40"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          )}
          {paletteOpen && (
            <p className="text-[10px] text-muted-foreground">
              Left-click: set foreground · Right-click: set background
            </p>
          )}
        </CardContent>
      </Card>

      {/* Validation */}
      {validation.errors.length > 0 && (
        <ErrorBanner message={`Errors: ${validation.errors.join("; ")}`} />
      )}
      {validation.warnings.length > 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Warnings:</strong>
            <ul className="list-disc ml-4 mt-1">
              {validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* Preview */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Eye className="h-4 w-4" /> Live preview
              {validation.errors.length === 0 && (
                <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> valid
                </Badge>
              )}
            </h3>
            <div className="flex flex-wrap gap-2">
              <CopyButton
                getText={() => { handleSaveHistory(); return escape; }}
                label="Copy sequence"
              />
              <DownloadButton
                getText={() => escape}
                filename="ansi-escape.txt"
                mime="text/plain"
                label="Download"
              />
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(config); }} />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Styles" value={stats.styleCount} />
            <Stat label="FG" value={COLOR_MODE_LABELS[config.fg.mode]} />
            <Stat label="BG" value={COLOR_MODE_LABELS[config.bg.mode]} />
            <Stat label="SGR params" value={stats.totalSgrParams} />
          </div>
          <div className="rounded-lg bg-black p-4 font-mono text-sm overflow-x-auto">
            {previewSegs.map((seg, i) => {
              const fg = colorToCss(seg.fg);
              const bg = colorToCss(seg.bg);
              const style: React.CSSProperties = {
                color: fg ?? "#ffffff",
                backgroundColor: bg ?? undefined,
                fontWeight: seg.styles.includes("bold") ? 700 : 400,
                fontStyle: seg.styles.includes("italic") ? "italic" : "normal",
                textDecoration: [
                  seg.styles.includes("underline") ? "underline" : "",
                  seg.styles.includes("strikethrough") ? "line-through" : "",
                ].filter(Boolean).join(" ") || undefined,
                opacity: seg.styles.includes("faint") ? 0.5 : 1,
              };
              if (seg.styles.includes("inverse")) {
                style.color = bg ?? "#000000";
                style.backgroundColor = fg ?? "#ffffff";
              }
              if (seg.styles.includes("blink")) {
                style.animation = "pulse 1s steps(2) infinite";
              }
              if (seg.styles.includes("hidden")) {
                style.visibility = "hidden";
              }
              return <span key={i} style={style}>{seg.text}</span>;
            })}
          </div>
          <div className="rounded-lg bg-muted/50 border p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Escape sequence</div>
            <pre className="text-xs font-mono whitespace-pre-wrap break-all">{escape}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Language snippets */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Code2 className="h-4 w-4" /> Language snippets
          </h3>
          <div className="space-y-2">
            {snippets.map((s) => (
              <div key={s.id} className="rounded border bg-background">
                <div className="flex items-center justify-between px-3 py-1.5 border-b">
                  <span className="text-xs font-medium">{s.label}</span>
                  <CopyButton getText={() => s.code} label="Copy" size="icon-sm" />
                </div>
                <pre className="px-3 py-2 text-xs font-mono overflow-x-auto">{s.code}</pre>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reverse decoder */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Terminal className="h-4 w-4" /> Reverse decoder
          </h3>
          <Textarea
            value={decodeInput}
            onChange={(e) => setDecodeInput(e.target.value)}
            placeholder={"Paste an ANSI-escaped string here, e.g. \\x1b[1;31mHello\\x1b[0m"}
            className="min-h-[70px] resize-y font-mono text-xs"
          />
          {decodeInput && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant={decodeResult.ok ? "secondary" : "destructive"} className="text-[10px]">
                  {decodeResult.ok ? "OK" : "Issues"}
                </Badge>
                <Badge variant="outline" className="text-[10px]">{decodeResult.segments.length} segments</Badge>
                <CopyButton
                  getText={() => stripAnsi(decodeInput)}
                  label="Copy stripped"
                  size="icon-sm"
                />
              </div>
              {decodeResult.errors.map((e, i) => (
                <div key={i} className="text-xs text-destructive flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" /> {e}
                </div>
              ))}
              {decodeResult.segments.length > 0 && (
                <div className="rounded border bg-background divide-y max-h-[300px] overflow-auto">
                  {decodeResult.segments.map((s, i) => (
                    <div key={i} className="px-3 py-1.5 text-xs">
                      <div className="font-mono text-[10px] text-muted-foreground">{s.raw.replace(/\x1b/g, "\\x1b")}</div>
                      <div className="text-foreground">{s.description}</div>
                    </div>
                  ))}
                </div>
              )}
              {decodeResult.strippedText && (
                <div className="rounded bg-muted/50 p-2 text-xs">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Stripped: </span>
                  <span className="font-mono">{decodeResult.strippedText}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Terminal support notes */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <FileCode className="h-4 w-4" /> Terminal support notes
          </h3>
          <div className="space-y-1">
            {TERMINAL_SUPPORT_NOTES.map((n) => (
              <div key={n.id} className="rounded border bg-background px-3 py-1.5 text-xs">
                <strong className="text-foreground">{n.feature}:</strong>{" "}
                <span className="text-muted-foreground">{n.note}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* History */}
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
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.fgMode}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.styleCount} styles</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.escapeFormat}</Badge>
                  <span className="font-mono text-foreground">{h.text || "(empty)"}</span>
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
            <strong className="text-foreground">Privacy:</strong> All escape-sequence generation runs locally. History is stored in localStorage on this device only. 24-bit truecolor, italic, and blink are not supported by every terminal — see notes above.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ColorPicker({
  title,
  spec,
  onChange,
  onHex,
}: {
  title: string;
  spec: ColorSpec;
  onChange: (patch: Partial<ColorSpec>) => void;
  onHex: (hex: string) => void;
}) {
  const hex = spec.mode === "truecolor"
    ? rgbToHex(spec.rgb)
    : spec.mode === "x256"
      ? rgbToHex(x256ToRgb(spec.index))
      : spec.mode === "standard16" || spec.mode === "bright16"
        ? STANDARD_16_COLORS[spec.index]?.hex ?? "#000000"
        : "#000000";
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <div className="h-5 w-5 rounded border border-border" style={{ backgroundColor: hex }} />
          <span className="text-[10px] font-mono text-muted-foreground">{hex}</span>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Mode</Label>
          <select
            value={spec.mode}
            onChange={(e) => onChange({ mode: e.target.value as ColorMode })}
            className="h-8 w-full text-xs rounded border bg-background px-2"
          >
            {(["none", "standard16", "bright16", "x256", "truecolor"] as ColorMode[]).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        {spec.mode === "standard16" && (
          <div className="grid grid-cols-8 gap-1">
            {STANDARD_16_COLORS.slice(0, 8).map((c, i) => (
              <button
                key={c.name}
                title={c.name}
                onClick={() => onChange({ index: i })}
                className={`h-7 rounded-sm border ${spec.index === i ? "ring-2 ring-primary" : "border-border/40"}`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        )}
        {spec.mode === "bright16" && (
          <div className="grid grid-cols-8 gap-1">
            {STANDARD_16_COLORS.slice(8, 16).map((c, i) => (
              <button
                key={c.name}
                title={c.name}
                onClick={() => onChange({ index: i })}
                className={`h-7 rounded-sm border ${spec.index === i ? "ring-2 ring-primary" : "border-border/40"}`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        )}
        {spec.mode === "x256" && (
          <div className="space-y-1">
            <Label className="text-xs">256-color index (0–255)</Label>
            <Input
              type="number"
              min={0}
              max={255}
              value={spec.index}
              onChange={(e) => onChange({ index: Math.max(0, Math.min(255, Number(e.target.value) || 0)) })}
              className="h-8 text-xs font-mono"
            />
          </div>
        )}
        {spec.mode === "truecolor" && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {(["r", "g", "b"] as const).map((ch) => (
                <div key={ch}>
                  <Label className="text-[10px] uppercase">{ch}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={255}
                    value={spec.rgb[ch]}
                    onChange={(e) => onChange({
                      rgb: { ...spec.rgb, [ch]: Math.max(0, Math.min(255, Number(e.target.value) || 0)) },
                    })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Or pick a hex color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={hex}
                  onChange={(e) => onHex(e.target.value)}
                  className="h-8 w-12 rounded border border-border"
                />
                <Input
                  value={hex}
                  onChange={(e) => onHex(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        )}
        {spec.mode !== "none" && (
          <div className="text-[10px] font-mono text-muted-foreground">
            SGR: {colorToSgrParams(spec, title === "Background").join(";") || "(none)"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Toggle({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void; }) {
  return (
    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
