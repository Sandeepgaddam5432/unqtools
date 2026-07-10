"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Download, FileCode } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { markdownToPdf } from "./logic";
export default function MarkdownToPdf() {
  const [md, setMd] = useState("");
  const [pageSize, setPageSize] = useState<"a4" | "letter">("a4");
  const [orient, setOrient] = useState<"portrait" | "landscape">("portrait");
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState(""); const [working, setWorking] = useState(false);
  async function run() { setWorking(true); setError(""); setResult(null); const r = await markdownToPdf(md, { pageSize, orientation: orient, margin: 50 }); setWorking(false); if (r.ok) { setResult(r.output); toast.success("PDF created!"); } else setError(r.error); }
  return (
    <div className="space-y-4">
      <div className="space-y-1.5"><Label htmlFor="mdtp-text">Markdown content</Label><Textarea id="mdtp-text" value={md} onChange={(e) => setMd(e.target.value)} placeholder={"# Heading\n\n**Bold** and *italic* text.\n\n- List item 1\n- List item 2"} className="min-h-[200px] resize-y font-mono text-sm" /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="mdtp-page">Page size</Label><select id="mdtp-page" value={pageSize} onChange={(e) => setPageSize(e.target.value as "a4" | "letter")} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="a4">A4</option><option value="letter">Letter</option></select></div>
        <div className="space-y-1.5"><Label htmlFor="mdtp-orient">Orientation</Label><select id="mdtp-orient" value={orient} onChange={(e) => setOrient(e.target.value as "portrait" | "landscape")} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></div>
      </div>
      <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setMd("# Sample Document\n\nThis is **bold** and this is *italic*.\n\n## Features\n\n- Headings\n- Lists\n- Code blocks\n\n```\nconst x = 42;\n```\n\n> A blockquote example.\n\n---\n\n1. First\n2. Second\n3. Third\n\n[Visit UnQTools](https://unqtools.pages.dev)")}>Load sample</Button></div>
      <ActionBar><RunButton onClick={() => void run()} disabled={!md.trim()} loading={working} label="Convert to PDF" /><ClearButton onClick={() => { setMd(""); setResult(null); setError(""); }} disabled={!md && !result && !error} label="Clear" /></ActionBar>
      {error && <ErrorBanner message={error} />}
      {result && (<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4"><div><p className="text-sm font-medium flex items-center gap-1.5"><FileCode className="h-4 w-4" />PDF ready</p><p className="text-xs text-muted-foreground">{formatBytes(result.length)}</p></div><Button onClick={() => downloadBytes(result, "markdown-output.pdf")} className="gap-1.5"><Download className="h-4 w-4" /> Download</Button></div>)}
      <p className="text-xs text-muted-foreground">Privacy: conversion runs 100% locally in your browser.</p>
    </div>
  );
}
