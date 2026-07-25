"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  process, measurePerLine, toCsv, charWidthTable, autoFitFontSize,
  truncateToWidth, wrapToWidth, lineHeight, boxHeight, validateOptions,
  FONT_LABELS, PRESETS, ALL_FONTS, type FontFamily, type MeasureOptions,
} from "./logic";

export default function TextWidthMeasurer() {
  const [input, setInput] = useState("The quick brown fox jumps over the lazy dog");
  const [font, setFont] = useState<FontFamily>("arial");
  const [fontSize, setFontSize] = useState(16);
  const [fontWeight, setFontWeight] = useState(400);
  const [italic, setItalic] = useState(false);
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [maxWidth, setMaxWidth] = useState(200);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const opts: MeasureOptions = { font, fontSize, fontWeight, italic, letterSpacing };

  const v = useMemo(() => validateOptions(opts), [opts]);
  useEffect(() => {
    if ("error" in v) setError(v.error);
    else setError(null);
  }, [v]);

  const result = useMemo(() => (error ? null : process(input, opts)), [input, opts, error]);

  const canvasWidth = useMemo(() => {
    if (typeof document === "undefined" || error) return null;
    const canvas = canvasRef.current ?? document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.font = `${italic ? "italic " : ""}${fontWeight} ${fontSize}px ${font}`;
    return Math.round(ctx.measureText(input).width);
  }, [input, font, fontSize, fontWeight, italic, error]);

  const lines = useMemo(() => input.split("\n"), [input]);
  const perLine = useMemo(() => measurePerLine(input, opts), [input, opts]);
  const charTable = useMemo(() => charWidthTable(input.slice(0, 80), opts), [input, opts]);
  const autoFit = useMemo(() => autoFitFontSize(input, font, maxWidth), [input, font, maxWidth]);
  const truncated = useMemo(() => truncateToWidth(input, opts, maxWidth), [input, opts, maxWidth]);
  const wrapped = useMemo(() => wrapToWidth(input, opts, maxWidth), [input, opts, maxWidth]);

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input text</Label>
            <textarea className="rounded-md border bg-background px-3 py-2 text-sm min-h-[100px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Font</Label>
              <select className="h-9 rounded-md border bg-background px-3 text-sm" value={font} onChange={(e) => setFont(e.target.value as FontFamily)}>
                {ALL_FONTS.map((f) => <option key={f} value={f}>{FONT_LABELS[f]}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Font size (px)</Label><Input type="number" min={1} value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value) || 1)} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Font weight</Label><Input type="number" step={100} min={100} max={900} value={fontWeight} onChange={(e) => setFontWeight(parseInt(e.target.value) || 400)} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Letter spacing (px)</Label><Input type="number" value={letterSpacing} onChange={(e) => setLetterSpacing(Number(e.target.value) || 0)} /></div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={italic} onChange={(e) => setItalic(e.target.checked)} /><span>Italic</span></label>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button key={p.label} size="sm" variant="outline" onClick={() => { setFont(p.font); setFontSize(p.fontSize); setFontWeight(p.fontWeight); }}>{p.label}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Estimated width</p><p className="text-lg font-bold">{result.width}px</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Canvas width</p><p className="text-lg font-bold text-emerald-600">{canvasWidth ?? 0}px</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Char count</p><p className="text-lg font-bold">{result.charCount}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Width / char</p><p className="text-lg font-bold">{result.widthPerChar.toFixed(1)}px</p></CardContent></Card>
        </div>
      )}

      {result && !error && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Per-line breakdown ({perLine.length})</Badge>
              <DownloadButton getText={() => toCsv(perLine, lines)} filename="text-width.csv" mime="text/csv" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/80"><tr><th className="p-2 text-left">Line</th><th className="p-2 text-right">Chars</th><th className="p-2 text-right">Width (px)</th><th className="p-2 text-right">Per char</th></tr></thead>
                <tbody>
                  {perLine.map((r, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="p-2 font-mono max-w-[200px] truncate">{lines[i] || <span className="text-muted-foreground">(empty)</span>}</td>
                      <td className="p-2 text-right font-mono">{r.charCount}</td>
                      <td className="p-2 text-right font-mono">{r.width}</td>
                      <td className="p-2 text-right font-mono">{r.widthPerChar.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Container width (px)</Label>
          <Input type="number" value={maxWidth} onChange={(e) => setMaxWidth(Number(e.target.value) || 0)} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-md border border-border/50 p-3"><p className="text-xs text-muted-foreground">Auto-fit font size</p><p className="text-lg font-bold">{autoFit}px</p></div>
            <div className="rounded-md border border-border/50 p-3"><p className="text-xs text-muted-foreground">Truncated</p><p className="text-sm font-mono break-all">{truncated}</p></div>
            <div className="rounded-md border border-border/50 p-3"><p className="text-xs text-muted-foreground">Wrapped lines</p><p className="text-sm font-mono">{wrapped.length}</p></div>
          </div>
          <div className="text-xs text-muted-foreground">Line height: {lineHeight(opts)}px · Box height (3 lines): {boxHeight(3, opts)}px</div>
        </CardContent>
      </Card>

      {charTable.length > 0 && !error && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Per-char width table (first 80 chars)</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-xs font-mono">
              {charTable.map((e, i) => (
                <div key={i} className="flex items-center gap-2 rounded border border-border/50 px-2 py-1">
                  <span className="font-bold w-6 text-center">{e.char === " " ? "·" : e.char}</span>
                  <span className="text-muted-foreground">{e.widthPx}px</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all measurements run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
