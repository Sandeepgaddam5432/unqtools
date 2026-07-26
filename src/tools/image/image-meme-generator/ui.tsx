"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "../../_shared";
import { calculateMemeLayout, generateMemeText, MEME_TEMPLATES } from "./logic";
import { toast } from "sonner";

export default function ImageMemeGenerator() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("meme.png");
  const [topText, setTopText] = useState("TOP TEXT");
  const [bottomText, setBottomText] = useState("BOTTOM TEXT");
  const [fontSize, setFontSize] = useState(48);
  const [outlineWidth, setOutlineWidth] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) { setError("Choose an image file."); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-meme.png"); setError(null); };
    img.onerror = () => setError("Could not load image.");
    img.src = url;
  }, []);

  const generateMeme = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const layout = calculateMemeLayout({ width: image.naturalWidth, height: image.naturalHeight, topText, bottomText, fontSize, outlineWidth });
    if ("error" in layout) { setError(layout.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    ctx.font = `bold ${fontSize}px Impact, Arial Black, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    ctx.lineWidth = outlineWidth;

    const topLines = generateMemeText(topText, image.naturalWidth, fontSize);
    topLines.forEach((line, i) => {
      const y = layout.topText.y + i * fontSize * 1.1;
      ctx.strokeText(line, image.naturalWidth / 2, y);
      ctx.fillText(line, image.naturalWidth / 2, y);
    });

    if (bottomText) {
      const bottomLines = generateMemeText(bottomText, image.naturalWidth, fontSize);
      const startY = layout.bottomText!.y - (bottomLines.length - 1) * fontSize * 1.1;
      bottomLines.forEach((line, i) => {
        const y = startY + i * fontSize * 1.1;
        ctx.strokeText(line, image.naturalWidth / 2, y);
        ctx.fillText(line, image.naturalWidth / 2, y);
      });
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      toast.success("Meme generated!");
    });
  }, [image, topText, bottomText, fontSize, outlineWidth, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }, [fileName]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
          {image && <p className="text-xs text-muted-foreground">{image.naturalWidth} × {image.naturalHeight}px</p>}
        </CardContent>
      </Card>
      {image && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs text-muted-foreground">Top text</Label><Input value={topText} onChange={(e) => setTopText(e.target.value)} /></div>
              <div><Label className="text-xs text-muted-foreground">Bottom text</Label><Input value={bottomText} onChange={(e) => setBottomText(e.target.value)} /></div>
              <div><Label className="text-xs text-muted-foreground">Font size</Label><Input type="number" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} /></div>
              <div><Label className="text-xs text-muted-foreground">Outline width</Label><Input type="number" value={outlineWidth} onChange={(e) => setOutlineWidth(Number(e.target.value))} /></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={generateMeme}>Generate Meme</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            </div>
          </CardContent>
        </Card>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && <Card><CardContent className="p-4"><img src={previewUrl} alt="Meme preview" className="max-w-full rounded-md border" /></CardContent></Card>}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong>Privacy:</strong> all meme generation runs locally. No upload.</p></CardContent></Card>
    </div>
  );
}
