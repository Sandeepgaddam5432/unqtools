"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  createAnnotation,
  moveAnnotation,
  resizeAnnotation,
  bringToFront,
  sendToBack,
  hitTest,
  serialize,
  deserialize,
  toSvgOverlay,
  COLOR_PALETTES,
  type Annotation,
  type AnnotationType,
} from "./logic";

export default function ImageAnnotationToolUI() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ w: 800, h: 600 });
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<AnnotationType>("arrow");
  const [color, setColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fontSize, setFontSize] = useState(18);
  const [text, setText] = useState("Label");
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const selected = annotations.find((a) => a.id === selectedId) ?? null;

  useEffect(() => {
    draw();
  }, [annotations, imageUrl, selectedId]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = imageSize.w;
    canvas.height = imageSize.h;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (imageRef.current) {
      ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
    }
    for (const a of annotations) {
      ctx.save();
      ctx.globalAlpha = a.opacity ?? 1;
      ctx.strokeStyle = a.color;
      ctx.fillStyle = a.color;
      ctx.lineWidth = a.strokeWidth ?? 2;
      const isSelected = a.id === selectedId;
      if (isSelected) {
        ctx.shadowColor = "#3b82f6";
        ctx.shadowBlur = 8;
      }
      if (a.type === "rect") {
        ctx.strokeRect(a.x, a.y, (a as any).width, (a as any).height);
      } else if (a.type === "ellipse") {
        const e = a as any;
        ctx.beginPath();
        ctx.ellipse(e.x + e.rx, e.y + e.ry, e.rx, e.ry, 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (a.type === "arrow") {
        const ar = a as any;
        ctx.beginPath();
        ctx.moveTo(ar.x, ar.y);
        ctx.lineTo(ar.x2, ar.y2);
        ctx.stroke();
        // Arrowhead
        const angle = Math.atan2(ar.y2 - ar.y, ar.x2 - ar.x);
        const hs = ar.headSize;
        ctx.beginPath();
        ctx.moveTo(ar.x2, ar.y2);
        ctx.lineTo(ar.x2 - hs * Math.cos(angle - Math.PI / 6), ar.y2 - hs * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(ar.x2 - hs * Math.cos(angle + Math.PI / 6), ar.y2 - hs * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      } else if (a.type === "line") {
        const l = a as any;
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
      } else if (a.type === "text") {
        const t = a as any;
        ctx.font = `${t.fontWeight} ${t.fontSize}px ${t.fontFamily}`;
        ctx.fillText(t.text, t.x, t.y);
      } else if (a.type === "sticker") {
        const s = a as any;
        ctx.font = `${s.size}px sans-serif`;
        ctx.fillText(s.emoji, s.x, s.y + s.size);
      } else if (a.type === "highlight") {
        ctx.globalAlpha = (a.opacity ?? 0.5) * 0.4;
        ctx.fillRect(a.x, a.y, (a as any).width, (a as any).height);
      }
      ctx.restore();
    }
  }, [annotations, imageUrl, selectedId, imageSize]);

  const onFile = useCallback((file: File) => {
    setError("");
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      const maxDim = 800;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      setImageSize({ w: Math.round(img.width * scale), h: Math.round(img.height * scale) });
      setTimeout(draw, 50);
    };
    img.src = url;
  }, [draw]);

  const onCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * imageSize.w;
    const y = ((e.clientY - rect.top) / rect.height) * imageSize.h;
    // Check if hit existing annotation
    const hit = [...annotations].reverse().find((a) => hitTest(a, x, y));
    if (hit) {
      setSelectedId(hit.id);
      setDragStart({ x, y });
      return;
    }
    // Create new annotation
    const partial: any = { color, strokeWidth };
    if (tool === "text") partial.text = text;
    if (tool === "text") partial.fontSize = fontSize;
    const ann = createAnnotation(tool, x, y, partial);
    setAnnotations([...annotations, ann]);
    setSelectedId(ann.id);
  }, [annotations, tool, color, strokeWidth, text, fontSize, imageSize]);

  const onCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!selectedId || !dragStart) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * imageSize.w;
    const y = ((e.clientY - rect.top) / rect.height) * imageSize.h;
    const dx = x - dragStart.x;
    const dy = y - dragStart.y;
    setAnnotations((prev) => prev.map((a) => (a.id === selectedId ? moveAnnotation(a, dx, dy) : a)));
    setDragStart({ x, y });
  }, [selectedId, dragStart, imageSize]);

  const onCanvasMouseUp = useCallback(() => setDragStart(null), []);

  const updateSelected = (changes: Partial<Annotation>) => {
    if (!selectedId) return;
    setAnnotations((prev) => prev.map((a) => (a.id === selectedId ? ({ ...a, ...changes } as Annotation) : a)));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setAnnotations((prev) => prev.filter((a) => a.id !== selectedId));
    setSelectedId(null);
  };

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "annotated.png";
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const downloadSvg = () => {
    const svg = toSvgOverlay(annotations, imageSize.w, imageSize.h);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "annotations.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">Upload image</Label>
          <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          <div className="flex flex-wrap gap-2">
            {(["arrow", "text", "rect", "ellipse", "line", "highlight", "sticker"] as AnnotationType[]).map((t) => (
              <Button key={t} size="sm" variant={tool === t ? "default" : "outline"} onClick={() => setTool(t)}>
                {t}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Color</Label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full h-9 rounded border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Stroke width</Label>
              <Input type="number" value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Font size</Label>
              <Input type="number" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} disabled={tool !== "text"} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Text</Label>
              <Input value={text} onChange={(e) => setText(e.target.value)} disabled={tool !== "text"} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {COLOR_PALETTES[0].colors.map((c) => (
              <button key={c} onClick={() => setColor(c)} className="w-6 h-6 rounded border" style={{ backgroundColor: c }} aria-label={`Color ${c}`} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <canvas
            ref={canvasRef}
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={onCanvasMouseUp}
            className="w-full rounded-md border bg-muted/30 cursor-crosshair"
            style={{ maxHeight: "70vh", objectFit: "contain" }}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={downloadPng} disabled={!imageUrl}>Download PNG</Button>
            <Button size="sm" variant="outline" onClick={downloadSvg}>Download SVG overlay</Button>
            <CopyButton getText={() => serialize(annotations)} label="Copy JSON" />
            <DownloadButton getText={() => serialize(annotations)} filename="annotations.json" />
            <Button size="sm" variant="outline" onClick={() => setAnnotations([])}>Clear all</Button>
          </div>
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">Selected: {selected.type} ({selected.id})</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setAnnotations(bringToFront(annotations, selected.id))}>Bring to front</Button>
              <Button size="sm" variant="outline" onClick={() => setAnnotations(sendToBack(annotations, selected.id))}>Send to back</Button>
              <Button size="sm" variant="outline" onClick={() => setAnnotations(annotations.map((a) => a.id === selected.id ? resizeAnnotation(a, 1.1) : a))}>Scale +</Button>
              <Button size="sm" variant="outline" onClick={() => setAnnotations(annotations.map((a) => a.id === selected.id ? resizeAnnotation(a, 0.9) : a))}>Scale −</Button>
              <Button size="sm" variant="destructive" onClick={deleteSelected}>Delete</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all annotation runs locally. Click to place, drag to move. SVG overlay export preserves vector quality for compositing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
