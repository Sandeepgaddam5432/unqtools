"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import { addBackgroundImage, detectImageType, formatSize, type PageSize } from "./logic";
import { Image, FileText, Upload, Download, Settings2, Eye } from "lucide-react";

export default function PdfBackgroundImage() {
  const [pdfBuf, setPdfBuf] = useState<ArrayBuffer | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [imgBuf, setImgBuf] = useState<ArrayBuffer | null>(null);
  const [imgName, setImgName] = useState("");
  const [imgType, setImgType] = useState<"png" | "jpg">("png");
  const [pages, setPages] = useState<PageSize>("all");
  const [opacity, setOpacity] = useState(100);
  const [scale, setScale] = useState<"fit" | "fill" | "stretch" | "original">("fit");
  const [position, setPosition] = useState<"center" | "top-left" | "top-right" | "bottom-left" | "bottom-right">("center");
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pdfRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const loadPdf = useCallback(async (file: File) => {
    setPdfBuf(await file.arrayBuffer());
    setPdfName(file.name);
    setOutput(null);
    toast.success(`PDF: ${file.name}`);
  }, []);

  const loadImg = useCallback(async (file: File) => {
    const buf = await file.arrayBuffer();
    const type = detectImageType(buf);
    if (!type) { toast.error("Unsupported image format. Use PNG or JPG."); return; }
    setImgBuf(buf);
    setImgName(file.name);
    setImgType(type);
  }, []);

  const process = useCallback(async () => {
    if (!pdfBuf || !imgBuf) return;
    setBusy(true); setError(null);
    const res = await addBackgroundImage(pdfBuf, imgBuf, imgType, {
      pages,
      opacity: opacity / 100,
      scale,
      position,
    });
    if (res.ok) {
      setOutput(res.pdfBytes);
      toast.success(`Background added to ${res.pagesModified}/${res.pageCount} pages`);
    } else setError(res.error);
    setBusy(false);
  }, [pdfBuf, imgBuf, imgType, pages, opacity, scale, position]);

  const download = useCallback(() => {
    if (!output) return;
    const blob = new Blob([output], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `bg-${pdfName}`;
    a.click(); URL.revokeObjectURL(url);
  }, [output, pdfName]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-dashed border-primary/30">
          <CardContent className="p-6 text-center space-y-2">
            <FileText className="h-10 w-10 mx-auto text-primary/50" />
            <p className="text-sm font-medium">PDF Document</p>
            <input ref={pdfRef} type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && loadPdf(e.target.files[0])} />
            <Button size="sm" variant="outline" onClick={() => pdfRef.current?.click()} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Select PDF
            </Button>
            {pdfName && <Badge variant="secondary" className="text-xs">{pdfName}</Badge>}
          </CardContent>
        </Card>
        <Card className="border-dashed border-primary/30">
          <CardContent className="p-6 text-center space-y-2">
            <Image className="h-10 w-10 mx-auto text-primary/50" />
            <p className="text-sm font-medium">Background Image</p>
            <input ref={imgRef} type="file" accept=".png,.jpg,.jpeg" className="hidden" onChange={(e) => e.target.files?.[0] && loadImg(e.target.files[0])} />
            <Button size="sm" variant="outline" onClick={() => imgRef.current?.click()} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Select Image
            </Button>
            {imgName && <Badge variant="secondary" className="text-xs">{imgName}</Badge>}
          </CardContent>
        </Card>
      </div>

      {/* Options */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Background Options</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Apply to Pages</Label>
              <Select value={String(pages)} onValueChange={(v) => setPages(v as PageSize)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pages</SelectItem>
                  <SelectItem value="first">First Page</SelectItem>
                  <SelectItem value="last">Last Page</SelectItem>
                  <SelectItem value="odd">Odd Pages</SelectItem>
                  <SelectItem value="even">Even Pages</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Scale Mode</Label>
              <Select value={scale} onValueChange={(v) => setScale(v as typeof scale)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fit">Fit (contain)</SelectItem>
                  <SelectItem value="fill">Fill (cover)</SelectItem>
                  <SelectItem value="stretch">Stretch</SelectItem>
                  <SelectItem value="original">Original Size</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Position</Label>
              <Select value={position} onValueChange={(v) => setPosition(v as typeof position)}>
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
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      <div className="flex gap-2">
        <Button onClick={process} disabled={busy || !pdfBuf || !imgBuf} className="gap-1.5">
          {busy ? "Adding Background…" : <><Image className="h-4 w-4" /> Add Background</>}
        </Button>
        {output && (
          <Button variant="outline" onClick={download} className="gap-1.5">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All processing uses pdf-lib and runs 100% locally. No files uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
