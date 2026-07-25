"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState } from "../../_shared";
import { splitStartEnd, summarizeSplit } from "./logic";

export default function Ipv4RangeSplitter() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const result = useMemo(() => {
    if (!start.trim() || !end.trim()) return null;
    return splitStartEnd(start, end);
  }, [start, end]);

  const summary = useMemo(() => (result ? summarizeSplit(result) : null), [result]);
  const outputText = useMemo(() => (result ? result.cidrs.join("\n") : ""), [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="start-ip" className="text-xs text-muted-foreground">Start IP</Label>
              <Input
                id="start-ip"
                placeholder="192.168.1.0"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="end-ip" className="text-xs text-muted-foreground">End IP</Label>
              <Input
                id="end-ip"
                placeholder="192.168.1.255"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              className="text-primary hover:underline cursor-pointer"
              onClick={() => { setStart("192.168.1.0"); setEnd("192.168.1.255"); }}
            >
              Load /24 sample
            </button>
            <button
              type="button"
              className="text-primary hover:underline cursor-pointer"
              onClick={() => { setStart("10.0.0.1"); setEnd("10.0.4.100"); }}
            >
              Load mixed sample
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:underline cursor-pointer"
              onClick={() => { setStart(""); setEnd(""); }}
            >
              Clear
            </button>
          </div>
        </CardContent>
      </Card>

      {result && !result.isValid && <ErrorBanner message={result.error ?? "Invalid range"} />}

      {result?.isValid && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">{result.count} addresses</Badge>
              <Badge variant="outline" className="text-xs">{result.blockCount} CIDR block(s)</Badge>
              {summary && (
                <Badge variant="outline" className="text-xs">
                  /{summary.largestPrefix} – /{summary.smallestPrefix}
                </Badge>
              )}
              <CopyButton getText={() => outputText} />
              <DownloadButton getText={() => outputText} filename="cidr-list.txt" />
            </div>
            <div className="space-y-1 max-h-72 overflow-auto">
              {result.cidrs.map((c, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_auto] gap-2 items-center text-xs py-1.5 border-b border-border/40 last:border-0"
                >
                  <code className="font-mono">{c}</code>
                  <CopyButton getText={() => c} label="" size="icon-sm" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!result && (
        <EmptyState
          title="Enter an IPv4 range to split"
          hint="Provide a start and end IP. The tool emits the minimal set of CIDR blocks that cover exactly that range."
        />
      )}
    </div>
  );
}
