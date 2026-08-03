"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ErrorBanner } from "../../_shared";
import { toast } from "sonner";
import { formatBytes } from "./logic";
import { Stamp, Upload, Download, FileText } from "lucide-react";

export default function PdfStampTool() {
  const [pdfBuf, setPdfBuf] = useState<ArrayBuffer | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [stampText, setStampText] = useState("CONFIDENTIAL");
  const [fontSize, setFontSize] = useState([48]);
  const [opacity, setOpacity] = useState([50]);
  const [rotation, setRotation] = useState([45]);
  const [color, setColor] = useState("#ff0000");
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
      const { PDFDocument, rgb, degrees } = await import("pdf-lib");
      const pdf = await PDFDocument.load(pdfBuf);
      const total = pdf.getPageCount();
      const target = pages === "all" ? Array.from({length: total}, (_, i) => i) :
                     pages === "first" ? [0] : pages === "last" ? [total-1] :
                     pages === "odd" ? Array.from({length: total}, (_, i) => i).filter(i => i%2===0) :
                     Array.from({length: total}, (_, i) => i).filter(i => i%2===1);
      
      const r = parseInt(color.slice(1,3), 16) / 255;
      const g = parseInt(color.slice(3,5), 16) / 255;
      const b = parseInt(color.slice(5,7), 16) / 255;
      
      for (const idx of target) {
        const page = pdf.getPage(idx);
        const { width, height } = page.getSize();
        page.drawText(stampText, {
          x: width / 2 - (stampText.length * fontSize[0] * 0.3),
          y: height / 2,
          size: fontSize[0],
          color: rgb(r, g, b),
          opacity: opacity[0] / 100,
          rotate: degrees(rotation[0]),
        });
      }
      const result = await pdf.save();
      setOutput(result);
      toast.success(`Stamp applied to ${target.length} pages`);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }, [pdfBuf, stampText, fontSize, opacity, rotation, color, pages]);

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
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Stamp Text</Label>
          <Input value={stampText} onChange={e => setStampText(e.target.value)} placeholder="CONFIDENTIAL" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Font Size: {fontSize[0]}</Label>
            <Slider value={fontSize} onValueChange={setFontSize} min={12} max={120} step={1} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Opacity: {opacity[0]}%</Label>
            <Slider value={opacity} onValueChange={setOpacity} min={10} max={100} step={5} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Rotation: {rotation[0]}°</Label>
            <Slider value={rotation} onValueChange={setRotation} min={0} max={360} step={15} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Color</Label>
            <Input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-9 cursor-pointer" />
          </div>
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
      </CardContent></Card>
      {error && <ErrorBanner message={error} />}
      <Button onClick={process} disabled={busy || !pdfBuf} className="gap-1.5">{busy ? "Processing…" : <><Stamp className="h-4 w-4" />Apply Stamp</>}</Button>
      {output && <Card><CardContent className="p-4 flex items-center justify-between">
        <div><p className="text-sm font-medium">PDF ready ({formatBytes(output.length)})</p></div>
        <Button onClick={() => { const b = new Blob([output], {type:"application/pdf"}); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href=u; a.download=`stamped-${pdfName}`; a.click(); URL.revokeObjectURL(u); }} className="gap-1.5"><Download className="h-4 w-4" />Download</Button>
      </CardContent></Card>}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> 100% local with pdf-lib. No uploads.</p></CardContent></Card>
    </div>
  );
}
