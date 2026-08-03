"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ErrorBanner } from "../../_shared";
import { toast } from "sonner";
import { applyBackground, identifyImageType, sizeStr } from "./logic";
import { ImageIcon, FileText, Upload, Download, RotateCw, SlidersHorizontal } from "lucide-react";

export default function PdfBackgroundImageTool() {
  const [pdfBuf, setPdfBuf] = useState<ArrayBuffer | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [imgBuf, setImgBuf] = useState<ArrayBuffer | null>(null);
  const [imgName, setImgName] = useState("");
  const [imgFmt, setImgFmt] = useState<"png" | "jpg">("png");
  const [pages, setPages] = useState("all");
  const [opacity, setOpacity] = useState(100);
  const [scale, setScale] = useState("fit");
  const [position, setPosition] = useState("center");
  const [rotation, setRotation] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pdfRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const loadPdf = useCallback(async (file: File) => {
    setPdfBuf(await file.arrayBuffer());
    setPdfName(file.name); setOutput(null);
    toast.success(`PDF: ${file.name}`);
  }, []);

  const loadImg = useCallback(async (file: File) => {
    const buf = await file.arrayBuffer();
    const fmt = identifyImageType(buf);
    if (!fmt) { toast.error("Use PNG or JPG only"); return; }
    setImgBuf(buf); setImgName(file.name); setImgFmt(fmt);
    // Create preview
    const url = URL.createObjectURL(new Blob([buf], { type: `image/${fmt === "jpg" ? "jpeg" : "png"}`}));
    setPreview(url);
  }, []);

  const process = useCallback(async () => {
    if (!pdfBuf || !imgBuf) return;
    setBusy(true); setError(null);
    const res = await applyBackground(pdfBuf, imgBuf, imgFmt, {
      pages: pages as any, opacity: opacity / 100, scale: scale as any,
      position: position as any, rotation,
    });
    if (res.ok) {
      setOutput(res.outputBytes);
      toast.success(`Background on ${res.pagesModified}/${res.totalPages} pages`);
    } else setError(res.error);
    setBusy(false);
  }, [pdfBuf, imgBuf, imgFmt, pages, opacity, scale, position, rotation]);

  const download = useCallback(() => {
    if (!output) return;
    const blob = new Blob([output], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `bg-${pdfName}`;
    a.click(); URL.revokeObjectURL(url);
  }, [output, pdfName]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-dashed border-primary/30">
          <CardContent className="p-6 text-center space-y-2">
            <FileText className="h-10 w-10 mx-auto text-primary/50" />
            <p className="text-sm font-medium">PDF</p>
            <input ref={pdfRef} type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && loadPdf(e.target.files[0])} />
            <Button size="sm" variant="outline" onClick={() => pdfRef.current?.click()} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Select PDF
            </Button>
            {pdfName && <Badge variant="secondary" className="text-xs">{pdfName}</Badge>}
          </CardContent>
        </Card>
        <Card className="border-dashed border-primary/30">
          <CardContent className="p-6 text-center space-y-2">
            <ImageIcon className="h-10 w-10 mx-auto text-primary/50" />
            <p className="text-sm font-medium">Background Image</p>
            <input ref={imgRef} type="file" accept=".png,.jpg,.jpeg" className="hidden" onChange={(e) => e.target.files?.[0] && loadImg(e.target.files[0])} />
            <Button size="sm" variant="outline" onClick={() => imgRef.current?.click()} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Select Image
            </Button>
            {imgName && <Badge variant="secondary" className="text-xs">{imgName} ({imgFmt.toUpperCase()})</Badge>}
            {preview && <img src={preview} className="max-h-20 mx-auto rounded border mt-2" alt="preview" />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Options</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Pages</Label>
              <Select value={pages} onValueChange={setPages}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="first">First</SelectItem>
                  <SelectItem value="last">Last</SelectItem>
                  <SelectItem value="odd">Odd</SelectItem>
                  <SelectItem value="even">Even</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Scale</Label>
              <Select value={scale} onValueChange={setScale}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fit">Fit</SelectItem>
                  <SelectItem value="fill">Fill</SelectItem>
                  <SelectItem value="stretch">Stretch</SelectItem>
                  <SelectItem value="original">Original</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Position</Label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="top-left">Top Left</SelectItem>
                  <SelectItem value="top-right">Top Right</SelectItem>
                  <SelectItem value="bottom-left">Bottom Left</SelectItem>
                  <SelectItem value="bottom-right">Bottom Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Opacity: {opacity}%</Label>
              <Slider value={[opacity]} onValueChange={([v]) => setOpacity(v)} min={0} max={100} step={5} className="mt-2" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs flex items-center gap-1">
                <RotateCw className="h-3 w-3" /> Rotation: {rotation}°
              </Label>
              <Slider value={[rotation]} onValueChange={([v]) => setRotation(v)} min={0} max={360} step={15} className="mt-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      <div className="flex gap-2">
        <Button onClick={process} disabled={busy || !pdfBuf || !imgBuf} className="gap-1.5">
          {busy ? "Processing…" : "Apply Background"}
        </Button>
        {output && (
          <Button variant="outline" onClick={download} className="gap-1.5">
            <Download className="h-4 w-4" /> Download
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> 100% local with pdf-lib. No uploads.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
