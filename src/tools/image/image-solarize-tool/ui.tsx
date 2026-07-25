"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  applyToRgba, computeBrightnessDelta, buildCssFilter, buildSolarizeFilename,
  validateSolarizeOptions, getPreset, DEFAULT_OPTIONS,
  type SolarizeOptions, type SolarizePreset,
} from "./logic";
import { toast } from "sonner";

const PRESETS: SolarizePreset[] = ["classic", "harsh", "subtle", "inverted", "two-tone"];

export default function ImageSolarizeTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [inputName, setInputName] = useState("image.png");
  const [opts, setOpts] = useState<SolarizeOptions>(DEFAULT_OPTIONS);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [brightnessDelta, setBrightnessDelta] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof SolarizeOptions>(key: K, value: SolarizeOptions[K]) =>
    setOpts((p) => ({ ...p, [key]: value }));

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setInputName(file.name); setError(null); setPreviewUrl(null); setBrightnessDelta(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateSolarizeOptions(opts);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const original = new Uint8ClampedArray(data.data);
    const result = applyToRgba(data.data, canvas.width, canvas.height, opts);
    data.data.set(result);
    ctx.putImageData(data, 0, 0);
    setBrightnessDelta(computeBrightnessDelta(original, result));
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [image, opts, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = buildSolarizeFilename(inputName, opts); a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Image downloaded");
    }, "image/png");
  }, [inputName, opts]);

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
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button key={p} variant="outline" size="sm" onClick={() => setOpts(getPreset(p))}>{p}</Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={opts.usePerChannel} onCheckedChange={(v) => update("usePerChannel", v)} id="pc" />
              <Label htmlFor="pc" className="text-sm cursor-pointer">Per-channel thresholds</Label>
            </div>
            {!opts.usePerChannel ? (
              <div>
                <Label className="text-xs text-muted-foreground">Threshold: {opts.threshold}</Label>
                <Slider value={[opts.threshold]} onValueChange={(v) => update("threshold", v[0]!)} min={0} max={255} step={1} />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs text-muted-foreground">Red: {opts.perChannel.r}</Label><Slider value={[opts.perChannel.r]} onValueChange={(v) => update("perChannel", { ...opts.perChannel, r: v[0]! })} min={0} max={255} step={1} /></div>
                <div><Label className="text-xs text-muted-foreground">Green: {opts.perChannel.g}</Label><Slider value={[opts.perChannel.g]} onValueChange={(v) => update("perChannel", { ...opts.perChannel, g: v[0]! })} min={0} max={255} step={1} /></div>
                <div><Label className="text-xs text-muted-foreground">Blue: {opts.perChannel.b}</Label><Slider value={[opts.perChannel.b]} onValueChange={(v) => update("perChannel", { ...opts.perChannel, b: v[0]! })} min={0} max={255} step={1} /></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-muted-foreground">Intensity: {opts.intensity}%</Label><Slider value={[opts.intensity]} onValueChange={(v) => update("intensity", v[0]!)} min={0} max={100} step={5} /></div>
              <div><Label className="text-xs text-muted-foreground">Smoothness: {opts.smoothness}</Label><Slider value={[opts.smoothness]} onValueChange={(v) => update("smoothness", v[0]!)} min={0} max={100} step={5} /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={apply}>Solarize</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
              <DownloadButton getText={async () => { await new Promise((r) => setTimeout(r, 0)); return ""; }} filename={buildSolarizeFilename(inputName, opts)} disabled={!previewUrl} mime="image/png" label="Download (shared)" />
              <CopyButton getText={() => buildCssFilter(opts)} label="Copy CSS filter" />
            </div>
            {brightnessDelta !== null && (
              <p className="text-xs text-muted-foreground">Mean brightness delta: {brightnessDelta.toFixed(1)}</p>
            )}
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Solarized preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> solarize runs locally via Canvas API.</p>
        </CardContent>
      </Card>
    </div>
  );
}
