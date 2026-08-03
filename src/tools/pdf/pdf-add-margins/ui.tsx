"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ErrorBanner } from "../../_shared";
import { toast } from "sonner";
import { formatBytes } from "./logic";
import { Maximize2, Upload, Download, FileText } from "lucide-react";

export default function PdfMargins() {
  const [pdfBuf, setPdfBuf] = useState<ArrayBuffer | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [top, setTop] = useState([36]);
  const [bottom, setBottom] = useState([36]);
  const [left, setLeft] = useState([36]);
  const [right, setRight] = useState([36]);
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const loadPdf = useCallback(async (f: File) => {
    setPdfBuf(await f.arrayBuffer()); setPdfName(f.name); setOutput(null);
    toast.success(`Loaded: ${f.name}`);
  }, []);

  const process = useCallback(async () => {
    if (!pdfBuf) return;
    setBusy(true); setError(null);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const pdf = await PDFDocument.load(pdfBuf);
      const total = pdf.getPageCount();
      
      for (let i = 0; i < total; i++) {
        const page = pdf.getPage(i);
        const { width, height } = page.getSize();
        page.setCropBox(left[0], bottom[0], width - left[0] - right[0], height - top[0] - bottom[0]);
      }
      
      const result = await pdf.save();
      setOutput(result);
      toast.success(`Margins added to ${total} pages`);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }, [pdfBuf, top, bottom, left, right]);

  return (
    <div className="space-y-4">
      <Card className="border-dashed border-primary/30">
        <CardContent className="p-6 text-center space-y-2">
          <FileText className="h-10 w-10 mx-auto text-primary/50" />
          <input ref={ref} type="file" accept=".pdf" className="hidden" onChange={e => e.target.files?.[0] && loadPdf(e.target.files[0])} />
          <Button variant="outline" onClick={() => ref.current?.click()} className="gap-2"><Upload className="h-4 w-4" />Select PDF</Button>
          {pdfName && <Badge variant="secondary">{pdfName}</Badge>}
        </CardContent>
      </Card>
      <Card><CardContent className="p-4 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Maximize2 className="h-4 w-4 text-primary" />Margin Settings (points)</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Top: {top[0]}pt</Label>
            <Slider value={top} onValueChange={setTop} min={0} max={144} step={6} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Bottom: {bottom[0]}pt</Label>
            <Slider value={bottom} onValueChange={setBottom} min={0} max={144} step={6} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Left: {left[0]}pt</Label>
            <Slider value={left} onValueChange={setLeft} min={0} max={144} step={6} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Right: {right[0]}pt</Label>
            <Slider value={right} onValueChange={setRight} min={0} max={144} step={6} />
          </div>
        </div>
      </CardContent></Card>
      {error && <ErrorBanner message={error} />}
      <Button onClick={process} disabled={busy || !pdfBuf} className="gap-1.5">{busy ? "Processing…" : <><Maximize2 className="h-4 w-4" />Add Margins</>}</Button>
      {output && <Card><CardContent className="p-4 flex items-center justify-between">
        <div><p className="text-sm font-medium">PDF ready ({formatBytes(output.length)})</p></div>
        <Button onClick={() => { const b = new Blob([output], {type:"application/pdf"}); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href=u; a.download=`margins-${pdfName}`; a.click(); URL.revokeObjectURL(u); }} className="gap-1.5"><Download className="h-4 w-4" />Download</Button>
      </CardContent></Card>}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> 100% local with pdf-lib. No uploads.</p></CardContent></Card>
    </div>
  );
}
