"use client";

/**
 * HTML to PDF — 100x UI.
 * Page size (A4/Letter/A5), orientation, margins, zoom scale, JPEG quality,
 * page numbers toggle, sample loader, multi-page output. 100% client-side.
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Download, Globe } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import {
  htmlToPdf,
  type HtmlPageSize,
  type HtmlOrientation,
} from "./logic";

const SAMPLE = `<h1 style="font-size:28px;margin:0 0 8px">Invoice #1042</h1>
<p style="margin:0 0 16px;color:#666">Issued 9 August 2026 · UnQTools Sample Co.</p>
<table style="width:100%;border-collapse:collapse;font-size:14px">
  <tr style="background:#f3f4f6"><th style="padding:8px;text-align:left;border:1px solid #ddd">Item</th><th style="padding:8px;text-align:right;border:1px solid #ddd">Qty</th><th style="padding:8px;text-align:right;border:1px solid #ddd">Price</th></tr>
  <tr><td style="padding:8px;border:1px solid #ddd">PDF Pro (annual)</td><td style="padding:8px;text-align:right;border:1px solid #ddd">1</td><td style="padding:8px;text-align:right;border:1px solid #ddd">₹4,999</td></tr>
  <tr><td style="padding:8px;border:1px solid #ddd">Batch API add-on</td><td style="padding:8px;text-align:right;border:1px solid #ddd">2</td><td style="padding:8px;text-align:right;border:1px solid #ddd">₹999</td></tr>
</table>
<p style="margin-top:16px"><strong>Total: ₹6,997</strong> · GST (18%): ₹1,259</p>
<h2 style="margin-top:24px">Notes</h2>
<ul>
  <li>Payment due within 14 days.</li>
  <li>Thanks for choosing UnQTools!</li>
</ul>`;

export default function HtmlToPdf() {
  const [html, setHtml] = useState("");
  const [pageSize, setPageSize] = useState<HtmlPageSize>("a4");
  const [orient, setOrient] = useState<HtmlOrientation>("portrait");
  const [marginMm, setMarginMm] = useState(15);
  const [scale, setScale] = useState(2);
  const [quality, setQuality] = useState(85);
  const [pageNumbers, setPageNumbers] = useState(true);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function run() {
    setWorking(true);
    setError("");
    setResult(null);
    const r = await htmlToPdf(html, {
      pageSize,
      orientation: orient,
      marginMm,
      scale,
      quality: quality / 100,
      pageNumbers,
    });
    setWorking(false);
    if (r.ok) {
      setResult(r.output);
      toast.success("PDF created!");
    } else {
      setError(r.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="htp-text">HTML content</Label>
        <Textarea
          id="htp-text"
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          placeholder={"<h1>Title</h1>\n<p>Hello <strong>world</strong></p>\n<ul>\n  <li>Item 1</li>\n  <li>Item 2</li>\n</ul>"}
          className="min-h-[200px] resize-y font-mono text-sm"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="htp-page">Page size</Label>
          <select
            id="htp-page"
            value={pageSize}
            onChange={(e) => setPageSize(e.target.value as HtmlPageSize)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="a4">A4</option>
            <option value="letter">Letter</option>
            <option value="a5">A5</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="htp-orient">Orientation</Label>
          <select
            id="htp-orient"
            value={orient}
            onChange={(e) => setOrient(e.target.value as HtmlOrientation)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="htp-margin">Margin: {marginMm} mm</Label>
          <input
            id="htp-margin"
            type="range"
            min={0}
            max={40}
            value={marginMm}
            onChange={(e) => setMarginMm(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="htp-scale">Sharpness: {scale}×</Label>
          <input
            id="htp-scale"
            type="range"
            min={1}
            max={3}
            step={0.5}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="htp-quality">Quality: {quality}%</Label>
          <input
            id="htp-quality"
            type="range"
            min={50}
            max={100}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={pageNumbers}
              onChange={(e) => setPageNumbers(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Page numbers in margin
          </label>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setHtml(SAMPLE)}>
          Load invoice sample
        </Button>
        <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setHtml("<h1>Hello World</h1>\n<p>This is a <strong>bold</strong> and <em>italic</em> paragraph.</p>")}>
          Simple sample
        </Button>
      </div>

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!html.trim()} loading={working} label="Convert to PDF" />
        <ClearButton onClick={() => { setHtml(""); setResult(null); setError(""); }} disabled={!html && !result && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div>
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Globe className="h-4 w-4" /> PDF ready
            </p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(result.length)} · HTML is rendered with your browser engine, so styles and layouts match what
              you see.
            </p>
          </div>
          <Button onClick={() => downloadBytes(result, "html-output.pdf")} className="gap-1.5">
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: conversion runs 100% locally — nothing is uploaded. Long content is split across multiple pages with
        your chosen margins. External images/stylesheets may not load (browser security); inline styles always work.
      </p>
    </div>
  );
}
