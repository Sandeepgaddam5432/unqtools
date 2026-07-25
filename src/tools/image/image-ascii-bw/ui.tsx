"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { validateAscii, luma, lumaToChar, computeHeight, DEFAULT_RAMP } from "./logic";

export default function ImageAsciiBw() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [width, setWidth] = useState(80);
  const [ramp, setRamp] = useState(DEFAULT_RAMP);
  const [invert, setInvert] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const effectiveRamp = useMemo(() => (invert ? [...ramp].reverse().join("") : ramp), [ramp, invert]);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const img = new Image();
    img.onload = () => { setImage(img); setError(null); };
    img.onerror = () => setError("Could not load image");
    img.src = URL.createObjectURL(file);
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateAscii({ width, ramp: effectiveRamp });
    if ("error" in v) { setError(v.error); return; }
    setError(null);
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
    const lines: string[] = [];
    for (let oy = 0; oy < outH; oy++) {
      let line = "";
      for (let ox = 0; ox < outW; ox++) {
        const sx = Math.floor((ox / outW) * canvas.width);
        const sy = Math.floor((oy / outH) * canvas.height);
        const i = (sy * canvas.width + sx) * 4;
        const y = luma(px[i]!, px[i + 1]!, px[i + 2]!);
        line += lumaToChar(y, v.ramp);
      }
      lines.push(line);
    }
    setOutput(lines.join("\n"));
  }, [image, width, effectiveRamp, ramp]);

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
              <Label className="text-xs text-muted-foreground">Width: {width} chars</Label>
              <input type="range" min={20} max={200} value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Character ramp</Label>
              <input type="text" value={ramp} onChange={(e) => setRamp(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
              Invert (light on dark)
            </label>
            <Button size="sm" onClick={apply}>Generate ASCII</Button>
          </CardContent>
        </Card>
      )}
      {output && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">ASCII output</Label>
              <div className="flex gap-2">
                <CopyButton getText={() => output} />
                <DownloadButton getText={() => output} filename="ascii.txt" />
              </div>
            </div>
            <Textarea readOnly value={output} className="min-h-[200px] resize-y font-mono text-xs leading-tight" />
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
