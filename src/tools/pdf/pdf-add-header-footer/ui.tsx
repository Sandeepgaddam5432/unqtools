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
import { FileText, Upload, Download, AlignLeft, AlignCenter, AlignRight } from "lucide-react";

export default function PdfHeaderFooter() {
  const [pdfBuf, setPdfBuf] = useState<ArrayBuffer | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [headerAlign, setHeaderAlign] = useState<"left" | "center" | "right">("center");
  const [footerAlign, setFooterAlign] = useState<"left" | "center" | "right">("center");
  const [includePageNum, setIncludePageNum] = useState(true);
  const [includeDate, setIncludeDate] = useState(false);
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
      
      const today = new Date().toLocaleDateString();
      const margin = 40;
      const fontSize = 10;
      
      for (const idx of target) {
        const page = pdf.getPage(idx);
        const { width, height } = page.getSize();
        
        let hText = headerText;
        if (includeDate) hText += (hText ? " | " : "") + today;
        let fText = footerText;
        if (includePageNum) fText += (fText ? " | " : "") + `Page ${idx + 1} of ${total}`;
        
        const getX = (align: string, text: string) => {
          const tw = text.length * fontSize * 0.5;
          if (align === "left") return margin;
          if (align === "right") return width - margin - tw;
          return (width - tw) / 2;
        };
        
        if (hText) page.drawText(hText, { x: getX(headerAlign, hText), y: height - margin, size: fontSize, color: rgb(0.3, 0.3, 0.3) });
        if (fText) page.drawText(fText, { x: getX(footerAlign, fText), y: margin / 2, size: fontSize, color: rgb(0.3, 0.3, 0.3) });
      }
      
      const result = await pdf.save();
      setOutput(result);
      toast.success(`Headers/footers added to ${target.length} pages`);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }, [pdfBuf, headerText, footerText, headerAlign, footerAlign, includePageNum, includeDate, pages]);

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Header</Label>
            <Input value={headerText} onChange={e => setHeaderText(e.target.value)} placeholder="Header text…" />
            <div className="flex gap-2">
              {(["left","center","right"] as const).map(a => (
                <Button key={a} variant={headerAlign===a?"default":"outline"} size="sm" onClick={() => setHeaderAlign(a)}>
                  {a === "left" ? <AlignLeft className="h-4 w-4"/> : a === "center" ? <AlignCenter className="h-4 w-4"/> : <AlignRight className="h-4 w-4"/>}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Footer</Label>
            <Input value={footerText} onChange={e => setFooterText(e.target.value)} placeholder="Footer text…" />
            <div className="flex gap-2">
              {(["left","center","right"] as const).map(a => (
                <Button key={a} variant={footerAlign===a?"default":"outline"} size="sm" onClick={() => setFooterAlign(a)}>
                  {a === "left" ? <AlignLeft className="h-4 w-4"/> : a === "center" ? <AlignCenter className="h-4 w-4"/> : <AlignRight className="h-4 w-4"/>}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={includePageNum} onCheckedChange={setIncludePageNum} id="pagenum" />
            <Label htmlFor="pagenum" className="text-sm cursor-pointer">Page numbers</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={includeDate} onCheckedChange={setIncludeDate} id="date" />
            <Label htmlFor="date" className="text-sm cursor-pointer">Date</Label>
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
      <Button onClick={process} disabled={busy || !pdfBuf} className="gap-1.5">{busy ? "Processing…" : <><FileText className="h-4 w-4" />Add Header/Footer</>}</Button>
      {output && <Card><CardContent className="p-4 flex items-center justify-between">
        <div><p className="text-sm font-medium">PDF ready ({formatBytes(output.length)})</p></div>
        <Button onClick={() => { const b = new Blob([output], {type:"application/pdf"}); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href=u; a.download=`hf-${pdfName}`; a.click(); URL.revokeObjectURL(u); }} className="gap-1.5"><Download className="h-4 w-4" />Download</Button>
      </CardContent></Card>}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> 100% local with pdf-lib. No uploads.</p></CardContent></Card>
    </div>
  );
}
