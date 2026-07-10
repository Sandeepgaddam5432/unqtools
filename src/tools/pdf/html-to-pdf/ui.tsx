"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Download, Globe } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { htmlToPdf } from "./logic";
export default function HtmlToPdf() {
  const [html, setHtml] = useState("");
  const [pageSize, setPageSize] = useState<"a4" | "letter">("a4");
  const [orient, setOrient] = useState<"portrait" | "landscape">("portrait");
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState(""); const [working, setWorking] = useState(false);
  async function run() { setWorking(true); setError(""); setResult(null); const r = await htmlToPdf(html, { pageSize, orientation: orient, margin: 50 }); setWorking(false); if (r.ok) { setResult(r.output); toast.success("PDF created!"); } else setError(r.error); }
  return (
    <div className="space-y-4">
      <div className="space-y-1.5"><Label htmlFor="htp-text">HTML content</Label><Textarea id="htp-text" value={html} onChange={(e) => setHtml(e.target.value)} placeholder={"<h1>Title</h1>\n<p>Hello <strong>world</strong></p>\n<ul>\n  <li>Item 1</li>\n  <li>Item 2</li>\n</ul>"} className="min-h-[200px] resize-y font-mono text-sm" /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="htp-page">Page size</Label><select id="htp-page" value={pageSize} onChange={(e) => setPageSize(e.target.value as "a4" | "letter")} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="a4">A4</option><option value="letter">Letter</option></select></div>
        <div className="space-y-1.5"><Label htmlFor="htp-orient">Orientation</Label><select id="htp-orient" value={orient} onChange={(e) => setOrient(e.target.value as "portrait" | "landscape")} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></div>
      </div>
      <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setHtml("<h1>Sample Document</h1>\n<p>This is a <strong>bold</strong> and <em>italic</em> paragraph.</p>\n<h2>Features</h2>\n<ul>\n  <li>Headings</li>\n  <li>Lists</li>\n  <li>Tables</li>\n</ul>\n<table border=\"1\" cellpadding=\"5\">\n  <tr><th>Name</th><th>Value</th></tr>\n  <tr><td>A</td><td>1</td></tr>\n  <tr><td>B</td><td>2</td></tr>\n</table>")}>Load sample</Button></div>
      <ActionBar><RunButton onClick={() => void run()} disabled={!html.trim()} loading={working} label="Convert to PDF" /><ClearButton onClick={() => { setHtml(""); setResult(null); setError(""); }} disabled={!html && !result && !error} label="Clear" /></ActionBar>
      {error && <ErrorBanner message={error} />}
      {result && (<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4"><div><p className="text-sm font-medium flex items-center gap-1.5"><Globe className="h-4 w-4" />PDF ready</p><p className="text-xs text-muted-foreground">{formatBytes(result.length)}</p></div><Button onClick={() => downloadBytes(result, "html-output.pdf")} className="gap-1.5"><Download className="h-4 w-4" /> Download</Button></div>)}
      <p className="text-xs text-muted-foreground">Privacy: conversion runs 100% locally. Output is rasterized — text is not selectable. For selectable text, use Text to PDF.</p>
    </div>
  );
}
