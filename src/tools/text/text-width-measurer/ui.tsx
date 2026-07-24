"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton } from "../../_shared";
import { process, measurePerLine, toCsv, type MeasureOptions, type MeasureResult } from "./logic";

const FONTS = ["Arial", "Helvetica", "Times New Roman", "Georgia", "Courier New", "Verdana"];

export default function TextWidthMeasurer() {
  const [input, setInput] = useState("The quick brown fox jumps over the lazy dog");
  const [font, setFont] = useState("Arial");
  const [fontSize, setFontSize] = useState(16);
  const [fontWeight, setFontWeight] = useState(400);
  const [italic, setItalic] = useState(false);
  const [result, setResult] = useState<MeasureResult | null>(null);
  const [canvasWidth, setCanvasWidth] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const opts: MeasureOptions = { font, fontSize, fontWeight, italic };

  const measureCanvas = useCallback((text: string, options: MeasureOptions): number => {
    if (typeof document === "undefined") return 0;
    const canvas = canvasRef.current ?? document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return 0;
    const style = `${options.italic ? "italic " : ""}${options.fontWeight ?? 400} ${options.fontSize}px ${options.font}`;
    ctx.font = style;
    return Math.round(ctx.measureText(text).width);
  }, []);

  const run = useCallback(() => {
    const r = process(input, opts);
    setResult(r);
    setCanvasWidth(measureCanvas(input, opts));
  }, [input, opts, measureCanvas]);

  useEffect(() => {
    run();
  }, [run]);

  const lines = input.split("\n");
  const perLine = measurePerLine(input, opts);

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input text</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Font</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={font} onChange={(e) => setFont(e.target.value)}>
                {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Font size (px)</Label>
              <Input type="number" min={1} value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value) || 1)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Font weight</Label>
              <Input type="number" step={100} min={100} max={900} value={fontWeight} onChange={(e) => setFontWeight(parseInt(e.target.value) || 400)} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm pb-2"><input type="checkbox" checked={italic} onChange={(e) => setItalic(e.target.checked)} /><span>Italic</span></label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Measure</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setResult(null); setCanvasWidth(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Estimated width</p><p className="text-lg font-bold">{result.width}px</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Canvas width</p><p className="text-lg font-bold text-emerald-600">{canvasWidth ?? 0}px</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Char count</p><p className="text-lg font-bold">{result.charCount}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Width per char</p><p className="text-lg font-bold">{result.widthPerChar.toFixed(1)}px</p></CardContent></Card>
          </div>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{perLine.length} lines</Badge>
                <DownloadButton getText={() => toCsv(perLine, lines)} filename="text-width.csv" mime="text/csv" />
              </div>
              <table className="w-full text-xs">
                <thead className="bg-muted/80"><tr><th className="p-2 text-left">Line</th><th className="p-2 text-right">Chars</th><th className="p-2 text-right">Width (px)</th></tr></thead>
                <tbody>
                  {perLine.map((r, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="p-2 font-mono max-w-[200px] truncate">{lines[i] || <span className="text-muted-foreground">(empty)</span>}</td>
                      <td className="p-2 text-right font-mono">{r.charCount}</td>
                      <td className="p-2 text-right font-mono">{r.width}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
