"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ErrorBanner } from "../../_shared";
import { toast } from "sonner";
import { formatBytes } from "./logic";
import { Hash, Upload, Download, FileText } from "lucide-react";

export default function PdfPageNumbers() {
  const [pdfBuf, setPdfBuf] = useState<ArrayBuffer | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [position, setPosition] = useState<"bottom-center" | "bottom-left" | "bottom-right" | "top-center" | "top-left" | "top-right">("bottom-center");
  const [format, setFormat] = useState("Page {n} of {total}");
  const [startNum, setStartNum] = useState(1);
  const [fontSize, setFontSize] = useState(10);
  const [pages, setPages] = useState("all");
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
      const { PDFDocument, rgb } = await import("pdf-lib");
      const pdf = await PDFDocument.load(pdfBuf);
      const total = pdf.getPageCount();
      const target = pages === "all" ? Array.from({length: total}, (_, i) => i) :
                     pages === "first" ? [0] : pages === "last" ? [total-1] :
                     pages === "odd" ? Array.from({length: total}, (_, i) => i).filter(i => i%2===0) :
                     Array.from({length: total}, (_, i) => i).filter(i => i%2===1);
      
      const margin = 30;
      let pageNum = startNum;
      
      for (const idx of target) {
        const page = pdf.getPage(idx);
        const { width, height } = page.getSize();
        const text = format.replace("{n}", String(pageNum)).replace("{total}", String(total));
        const tw = text.length * fontSize * 0.5;
        
        let x: number, y: number;
        const [vert, horiz] = position.split("-");
        y = vert === "bottom" ? margin / 2 : height - margin;
        if (horiz === "center") x = (width - tw) / 2;
        else if (horiz === "left") x = margin;
        else x = width - margin - tw;
        
        page.drawText(text, { x, y, size: fontSize, color: rgb(0.2, 0.2, 0.2) });
        pageNum++;
      }
      
      const result = await pdf.save();
      setOutput(result);
      toast.success(`Page numbers added to ${target.length} pages`);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }, [pdfBuf, position, format, startNum, fontSize, pages]);

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
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Position</Label>
            <Select value={position} onValueChange={v => setPosition(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bottom-center">Bottom Center</SelectItem><SelectItem value="bottom-left">Bottom Left</SelectItem>
                <SelectItem value="bottom-right">Bottom Right</SelectItem><SelectItem value="top-center">Top Center</SelectItem>
                <SelectItem value="top-left">Top Left</SelectItem><SelectItem value="top-right">Top Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Format</Label>
            <Input value={format} onChange={e => setFormat(e.target.value)} placeholder="Page {n} of {total}" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Starting Number</Label>
            <Input type="number" value={startNum} onChange={e => setStartNum(Number(e.target.value))} min={1} className="h-9" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Font Size: {fontSize}pt</Label>
            <Input type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} min={6} max={24} className="h-9" />
          </div>
          <div className="flex flex-col gap-1.5 col-span-2">
            <Label className="text-xs">Apply To</Label>
            <Select value={pages} onValueChange={setPages}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pages</SelectItem><SelectItem value="first">First</SelectItem>
                <SelectItem value="last">Last</SelectItem><SelectItem value="odd">Odd</SelectItem><SelectItem value="even">Even</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent></Card>
      {error && <ErrorBanner message={error} />}
      <Button onClick={process} disabled={busy || !pdfBuf} className="gap-1.5">{busy ? "Processing…" : <><Hash className="h-4 w-4" />Add Page Numbers</>}</Button>
      {output && <Card><CardContent className="p-4 flex items-center justify-between">
        <div><p className="text-sm font-medium">PDF ready ({formatBytes(output.length)})</p></div>
        <Button onClick={() => { const b = new Blob([output], {type:"application/pdf"}); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href=u; a.download=`numbered-${pdfName}`; a.click(); URL.revokeObjectURL(u); }} className="gap-1.5"><Download className="h-4 w-4" />Download</Button>
      </CardContent></Card>}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> 100% local with pdf-lib. No uploads.</p></CardContent></Card>
    </div>
  );
}
