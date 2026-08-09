"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { Wand2, Minus, FileCheck2 } from "lucide-react";
import { formatXml, minifyXml, validateXml, type FormatResult } from "./logic";

export default function XmlFormatterTool() {
  const [input, setInput] = useState('<root>\n  <item id="1">Hello</item>\n</root>');
  const [indent, setIndent] = useState("2");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ lines: number; bytes: number; chars: number } | null>(null);

  const run = (fn: (s: string) => FormatResult) => {
    const r = fn(input);
    if (r.ok) {
      setOutput(r.output);
      setStats(r.stats);
      setError(null);
    } else {
      setOutput("");
      setStats(null);
      setError(r.error);
    }
  };

  const validation = useMemo(() => validateXml(input), [input]);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">XML input</Label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={8}
            className="font-mono text-xs"
            placeholder="Paste XML here…"
          />
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Indent</Label>
            <Input
              type="number"
              min="0"
              max="8"
              className="w-20"
              value={indent}
              onChange={(e) => setIndent(e.target.value)}
            />
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => run((s) => formatXml(s, Number(indent)))}>
            <Wand2 className="h-3.5 w-3.5" /> Format
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => run((s) => minifyXml(s))}>
            <Minus className="h-3.5 w-3.5" /> Minify
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => run((s) => validateXml(s) as FormatResult)}>
            <FileCheck2 className="h-3.5 w-3.5" /> Validate
          </Button>
        </div>

        {error && <ErrorBanner message={error} />}

        {validation.ok && !error && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            ✓ Well-formed XML
          </p>
        )}

        {output && !error && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {stats?.lines} lines · {stats?.chars} chars · {stats?.bytes} bytes
              </span>
              <div className="flex gap-1.5">
                <CopyButton getText={() => output} label="Copy" />
                <DownloadButton getText={() => output} filename="formatted.xml" mime="application/xml" label="Download" />
              </div>
            </div>
            <Textarea readOnly value={output} rows={10} className="font-mono text-xs bg-muted/30" />
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Formatting, minification, and validation run 100% locally — nothing leaves your browser.
        </p>
      </CardContent>
    </Card>
  );
}
