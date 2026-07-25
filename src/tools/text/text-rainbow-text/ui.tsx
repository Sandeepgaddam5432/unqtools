"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton, DownloadButton } from "../../_shared";
import {
  rainbowHtml,
  rainbowStats,
  palettePreview,
  findPreset,
  PRESETS,
  PALETTES,
  validateRainbow,
  DEFAULT_OPTIONS,
  type RainbowOptions,
  type RainbowPalette,
  type OutputFormat,
} from "./logic";

const PALETTE_KEYS = Object.keys(PALETTES) as Array<Exclude<RainbowPalette, "custom">>;

export default function TextRainbowText() {
  const [input, setInput] = useState("");
  const [opts, setOpts] = useState<RainbowOptions>(DEFAULT_OPTIONS);
  const [customColor, setCustomColor] = useState("#00ff00");
  const [error, setError] = useState<string | null>(null);

  const html = useMemo(() => {
    const v = validateRainbow(opts);
    if ("error" in v) { setError(v.error); return ""; }
    setError(null);
    return rainbowHtml(input, opts);
  }, [input, opts]);
  const stats = useMemo(() => (input ? rainbowStats(input, opts) : null), [input, opts]);
  const preview = useMemo(() => palettePreview(opts), [opts]);

  const addCustomColor = () => {
    if (opts.customColors.includes(customColor)) return;
    setOpts({ ...opts, palette: "custom", customColors: [...opts.customColors, customColor] });
  };
  const removeCustomColor = (c: string) => {
    setOpts({ ...opts, customColors: opts.customColors.filter((x) => x !== c) });
  };

  const applyPreset = (id: string) => {
    const p = findPreset(id);
    if (p) setOpts((o) => ({ ...o, ...p.options }));
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <Label htmlFor="rt-input">Input text</Label>
        <Textarea id="rt-input" placeholder="Type text to rainbow-color…" value={input} onChange={(e) => setInput(e.target.value)} className="min-h-[100px] resize-y" />
        <div>
          <Label className="text-xs text-muted-foreground">Presets</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {PRESETS.map((p) => (
              <Button key={p.id} variant="outline" size="sm" onClick={() => applyPreset(p.id)}>{p.label}</Button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-sm font-medium">Color palette</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {PALETTE_KEYS.map((p) => (
              <Button key={p} variant={opts.palette === p ? "default" : "outline"} size="sm" onClick={() => setOpts({ ...opts, palette: p })}>{p}</Button>
            ))}
            <Button variant={opts.palette === "custom" ? "default" : "outline"} size="sm" onClick={() => setOpts({ ...opts, palette: "custom" })}>custom</Button>
          </div>
        </div>
        {opts.palette === "custom" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)} className="h-8 w-12 rounded border" />
              <Button size="sm" variant="outline" onClick={addCustomColor}>Add color</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {opts.customColors.map((c) => (
                <div key={c} className="flex items-center gap-1 rounded border px-2 py-1 text-xs">
                  <span className="inline-block h-3 w-3 rounded" style={{ background: c }} />
                  <span className="font-mono">{c}</span>
                  <button onClick={() => removeCustomColor(c)} className="ml-1 text-destructive">×</button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={opts.animate} onChange={(e) => setOpts({ ...opts, animate: e.target.checked })} />
            Animate
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={opts.perChar} onChange={(e) => setOpts({ ...opts, perChar: e.target.checked })} />
            Per-character
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={opts.reverse} onChange={(e) => setOpts({ ...opts, reverse: e.target.checked })} />
            Reverse
          </label>
          <div>
            <Label className="text-xs text-muted-foreground">Format</Label>
            <select value={opts.format} onChange={(e) => setOpts({ ...opts, format: e.target.value as OutputFormat })} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="html">HTML</option>
              <option value="markdown">Markdown</option>
            </select>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setInput("Rainbow Text Generator")}>Load sample</Button>
        {stats && <p className="text-xs text-muted-foreground">{stats.chars} chars · {stats.lines} lines · {stats.colors} colors</p>}
      </CardContent></Card>
      {html && (
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-medium">Preview</Label>
            <div className="flex gap-2">
              <CopyButton getText={() => html} />
              <DownloadButton getText={() => html} filename="rainbow.html" mime="text/html" />
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 p-4 text-xl font-bold break-words" dangerouslySetInnerHTML={{ __html: html }} />
        </CardContent></Card>
      )}
      {html && (
        <Card><CardContent className="p-4">
          <Label className="text-sm font-medium mb-2 block">HTML code</Label>
          <Textarea readOnly value={html} className="min-h-[100px] resize-y font-mono text-xs" />
        </CardContent></Card>
      )}
      <Card><CardContent className="p-4">
        <Label className="text-xs text-muted-foreground mb-1 block">Palette preview</Label>
        <div className="flex flex-wrap gap-1">
          {preview.map((c) => (
            <div key={c} className="h-6 w-6 rounded border" style={{ background: c }} title={c} />
          ))}
        </div>
      </CardContent></Card>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all color generation runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
