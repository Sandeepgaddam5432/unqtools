"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { validateMask, type MaskResult } from "./logic";

export default function SubnetMaskValidator() {
  const [input, setInput] = useState("");
  const result = useMemo<MaskResult | null>(() => (input.trim() ? validateMask(input) : null), [input]);

  const summary = useMemo(() => {
    if (!result || !result.isValid) return "";
    const lines = [
      `Input: ${result.input}`,
      `CIDR: /${result.cidr}`,
      `Dotted: ${result.dotted}`,
      `Wildcard: ${result.wildcard}`,
      `Network bits: ${result.networkBits}`,
      `Host bits: ${result.hostBits}`,
      `Total hosts: ${result.totalHosts}`,
      `Usable hosts: ${result.usableHosts}`,
    ];
    return lines.join("\n");
  }, [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="smv-input" className="text-xs text-muted-foreground">
              Enter a subnet mask (CIDR like <code className="font-mono">24</code> or dotted like <code className="font-mono">255.255.255.0</code>)
            </Label>
            <Input
              id="smv-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="24 or 255.255.255.0"
              className="font-mono"
            />
          </div>
          {result && !result.isValid && result.errors.length > 0 && (
            <ErrorBanner message={result.errors.join("; ")} />
          )}
        </CardContent>
      </Card>

      {result && result.isValid && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-emerald-600">Valid</Badge>
              <span className="text-xs text-muted-foreground">Parsed successfully</span>
              <div className="ml-auto flex gap-2">
                <CopyButton getText={() => summary} label="Copy" />
                <DownloadButton getText={() => summary} filename="subnet-mask.txt" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Cell label="CIDR" value={`/${result.cidr}`} />
              <Cell label="Dotted" value={result.dotted ?? "-"} />
              <Cell label="Wildcard" value={result.wildcard ?? "-"} />
              <Cell label="Network bits" value={String(result.networkBits)} />
              <Cell label="Host bits" value={String(result.hostBits)} />
              <Cell label="Total hosts" value={String(result.totalHosts)} />
              <Cell label="Usable hosts" value={String(result.usableHosts)} />
              <Cell label="Input" value={result.input} />
            </div>
            <div className="rounded border bg-muted/30 p-2 text-[11px] font-mono whitespace-pre-wrap break-words text-muted-foreground">
              {summary}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all validation runs locally in your browser. No data is uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm text-foreground break-all">{value}</div>
    </div>
  );
}
