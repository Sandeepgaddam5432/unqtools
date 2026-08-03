"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorBanner } from "../../_shared";
import { toast } from "sonner";
import { formatBytes } from "./logic";
import { Palette, Upload, Download, FileText } from "lucide-react";

export default function PdfAddBackground() {
  const [pdfBuf, setPdfBuf] = useState<ArrayBuffer | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [color, setColor] = useState("#f0f0f0");
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
      const { PDFDocument } = await import("pdf-lib");
      const pdf = await PDFDocument.load(pdfBuf);
      const total = pdf.getPageCount();
      const target = pages === "all" ? Array.from({length: total}, (_, i) => i) :
                     pages === "first" ? [0] : pages === "last" ? [total-1] :
                     pages === "odd" ? Array.from({length: total}, (_, i) => i).filter(i => i%2===0) :
                     Array.from({length: total}, (_, i) => i).filter(i => i%2===1);
      for (const idx of target) {
        const page = pdf.getPage(idx);
        const { width, height } = page.getSize();
        // Draw colored rectangle as background
        const r = parseInt(color.slice(1,3), 16) / 255;
        const g = parseInt(color.slice(3,5), 16) / 255;
        const b = parseInt(color.slice(5,7), 16) / 255;
        page.drawRectangle({ x: 0, y: 0, width, height, color: { type: 'rgb' as const, r, g, b } });
      }
      const result = await pdf.save();
      setOutput(result);
      toast.success(`Background applied to ${target.length} pages`);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }, [pdfBuf, color, pages]);

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
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs flex items-center gap-1"><Palette className="h-3 w-3" />Background Color</Label>
            <Input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-20 h-9 p-1 cursor-pointer" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Apply To</Label>
            <Select value={pages} onValueChange={setPages}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pages</SelectItem><SelectItem value="first">First</SelectItem>
                <SelectItem value="last">Last</SelectItem><SelectItem value="odd">Odd</SelectItem><SelectItem value="even">Even</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent></Card>
      {error && <ErrorBanner message={error} />}
      <Button onClick={process} disabled={busy || !pdfBuf} className="gap-1.5">{busy ? "Processing…" : <><Palette className="h-4 w-4" />Apply Background</>}</Button>
      {output && <Card><CardContent className="p-4 flex items-center justify-between">
        <div><p className="text-sm font-medium">PDF ready ({formatBytes(output.length)})</p></div>
        <Button onClick={() => { const b = new Blob([output], {type:"application/pdf"}); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href=u; a.download=`bg-${pdfName}`; a.click(); URL.revokeObjectURL(u); }} className="gap-1.5"><Download className="h-4 w-4" />Download</Button>
      </CardContent></Card>}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> 100% local with pdf-lib. No uploads.</p></CardContent></Card>
    </div>
  );
}
