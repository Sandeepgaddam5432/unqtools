"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState } from "../../_shared";
import { mergeCidrs } from "./logic";

export default function SubnetCidrMerger() {
  const [input, setInput] = useState("");

  const result = useMemo(() => {
    if (!input.trim()) return null;
    const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return mergeCidrs(lines);
  }, [input]);

  const outputText = useMemo(() => {
    if (!result) return "";
    return result.ranges.map((r) => `${r.cidr}\t${r.start} - ${r.end}\t(${r.count})`).join("\n");
  }, [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-2">
          <Label htmlFor="cidr-input" className="text-xs text-muted-foreground">
            CIDR blocks (one per line)
          </Label>
          <Textarea
            id="cidr-input"
            placeholder={"192.168.0.0/24\n192.168.1.0/24\n10.0.0.0/8"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="font-mono text-sm min-h-[140px]"
          />
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              className="text-primary hover:underline cursor-pointer"
              onClick={() => setInput("192.168.0.0/24\n192.168.1.0/24\n192.168.2.0/23")}
            >
              Load sample
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:underline cursor-pointer"
              onClick={() => setInput("")}
            >
              Clear
            </button>
          </div>
        </CardContent>
      </Card>

      {result && result.errors.length > 0 && (
        <ErrorBanner message={`${result.errors.length} invalid line(s) skipped: ${result.errors[0].error}`} />
      )}

      {result && result.ranges.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {result.inputCount} inputs
              </Badge>
              <Badge variant="outline" className="text-xs">
                {result.uniqueCount} merged range(s)
              </Badge>
              <CopyButton getText={() => outputText} />
              <DownloadButton getText={() => outputText} filename="merged-cidrs.txt" />
            </div>
            <div className="space-y-1">
              {result.ranges.map((r, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_auto] gap-2 items-center text-xs py-1.5 border-b border-border/40 last:border-0"
                >
                  <div>
                    <code className="font-mono text-foreground">{r.cidr}</code>
                    <div className="text-muted-foreground mt-0.5">
                      {r.start} – {r.end} ({r.count} addresses)
                    </div>
                  </div>
                  <CopyButton getText={() => r.cidr} label="" size="icon-sm" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {result && result.ranges.length === 0 && result.errors.length === 0 && (
        <EmptyState title="No CIDR blocks to merge" hint="Add at least one CIDR per line." />
      )}

      {!result && (
        <EmptyState
          title="Paste CIDR blocks to merge"
          hint="Overlapping and adjacent ranges will be summarized into the minimal set of CIDRs."
        />
      )}
    </div>
  );
}
