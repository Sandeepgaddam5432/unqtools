"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  validateAscii,
  lumaToChar,
  computeHeight,
  buildLumaGrid,
  toHtml,
  toSvg,
  asciiStats,
  findRampPreset,
  RAMP_PRESETS,
  DEFAULT_OPTIONS,
  type AsciiOptions,
} from "./logic";
import { toast } from "sonner";

type ExportFormat = "txt" | "html" | "svg";

export default function ImageAsciiBw() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("ascii.txt");
  const [opts, setOpts] = useState<AsciiOptions>(DEFAULT_OPTIONS);
  const [rampPresetId, setRampPresetId] = useState("standard");
  const [format, setFormat] = useState<ExportFormat>("txt");
  const [output, setOutput] = useState("");
  const [stats, setStats] = useState<{ lines: number; chars: number; width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const previewHtml = useMemo(() => {
    if (!output || format !== "html") return "";
    return output;
  }, [output, format]);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const img = new Image();
    img.onload = () => { setImage(img); setError(null); setOutput(""); setStats(null); };
    img.onerror = () => setError("Could not load image");
    img.src = URL.createObjectURL(file);
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateAscii(opts);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    try {
      const canvas = canvasRef.current;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = data.data;
      const outW = v.width;
      const outH = computeHeight(outW, canvas.width, canvas.height);
      let result = "";
      if (format === "txt") {
        const grid = buildLumaGrid(px, canvas.width, canvas.height, outW, outH, v);
        const lines: string[] = [];
        for (let oy = 0; oy < outH; oy++) {
          let line = "";
          for (let ox = 0; ox < outW; ox++) line += lumaToChar(grid[oy]![ox]!, v.ramp);
          lines.push(line);
        }
        result = lines.join("\n");
      } else if (format === "html") {
        result = toHtml(px, canvas.width, canvas.height, v);
      } else {
        result = toSvg(px, canvas.width, canvas.height, v);
      }
      setOutput(result);
      setStats(format === "txt" ? asciiStats(result) : null);
      setFileName(file.name.replace(/\.[^.]+$/, "") + `-ascii.${format}`);
      toast.success("ASCII generated");
    } catch {
      setError("Generation failed — image may be too large");
    }
  }, [image, opts, format]);

  const applyPreset = useCallback((id: string) => {
    const p = findRampPreset(id);
    if (p) {
      setOpts((o) => ({ ...o, ramp: p.ramp }));
      setRampPresetId(id);
      toast.success(`Ramp preset: ${p.label}`);
    }
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
        </CardContent>
      </Card>
      {image && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Width: {opts.width} chars</Label>
              <input type="range" min={20} max={200} value={opts.width} onChange={(e) => setOpts({ ...opts, width: Number(e.target.value) })} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Ramp preset</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {RAMP_PRESETS.map((p) => (
                  <Button key={p.id} variant={rampPresetId === p.id ? "default" : "outline"} size="sm" onClick={() => applyPreset(p.id)}>{p.label}</Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Custom ramp</Label>
              <input type="text" value={opts.ramp} onChange={(e) => { setOpts({ ...opts, ramp: e.target.value }); setRampPresetId("custom"); }} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Brightness: {opts.brightness}</Label>
                <input type="range" min={-100} max={100} value={opts.brightness} onChange={(e) => setOpts({ ...opts, brightness: Number(e.target.value) })} className="w-full" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Contrast: {opts.contrast.toFixed(2)}</Label>
                <input type="range" min={0} max={300} value={Math.round(opts.contrast * 100)} onChange={(e) => setOpts({ ...opts, contrast: Number(e.target.value) / 100 })} className="w-full" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Gamma: {opts.gamma.toFixed(2)}</Label>
                <input type="range" min={10} max={300} value={Math.round(opts.gamma * 100)} onChange={(e) => setOpts({ ...opts, gamma: Number(e.target.value) / 100 })} className="w-full" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Dither</Label>
                <select value={opts.dither} onChange={(e) => setOpts({ ...opts, dither: e.target.value as AsciiOptions["dither"] })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="none">None</option>
                  <option value="floyd-steinberg">Floyd-Steinberg</option>
                  <option value="atkinson">Atkinson</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={opts.invert} onChange={(e) => setOpts({ ...opts, invert: e.target.checked })} />
                Invert
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={opts.color} onChange={(e) => setOpts({ ...opts, color: e.target.checked })} />
                Color output (HTML/SVG)
              </label>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Export format</Label>
              <div className="flex gap-1.5 mt-1">
                {(["txt", "html", "svg"] as ExportFormat[]).map((f) => (
                  <Button key={f} variant={format === f ? "default" : "outline"} size="sm" onClick={() => setFormat(f)}>{f.toUpperCase()}</Button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={apply}>Generate ASCII</Button>
              <CopyButton getText={() => output} disabled={!output} />
              <DownloadButton getText={() => output} filename={fileName} disabled={!output} mime={format === "html" ? "text/html" : format === "svg" ? "image/svg+xml" : "text/plain"} />
            </div>
            {stats && (
              <p className="text-xs text-muted-foreground">Lines: {stats.lines} · Width: {stats.width} · Chars: {stats.chars}</p>
            )}
          </CardContent>
        </Card>
      )}
      {output && format === "txt" && (
        <Card>
          <CardContent className="p-4">
            <Textarea readOnly value={output} className="min-h-[200px] resize-y font-mono text-xs leading-tight" />
          </CardContent>
        </Card>
      )}
      {previewHtml && (
        <Card>
          <CardContent className="p-4">
            <div className="rounded-md border bg-white p-4 overflow-auto" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </CardContent>
        </Card>
      )}
      {output && format === "svg" && (
        <Card>
          <CardContent className="p-4">
            <div className="rounded-md border p-4 overflow-auto" dangerouslySetInnerHTML={{ __html: output }} />
          </CardContent>
        </Card>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Privacy:</strong> ASCII conversion runs locally via the Canvas API.
        </p>
      </CardContent></Card>
    </div>
  );
}
