"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, EmptyState } from "../../_shared";
import { searchPorts, classifyPort, PORT_RANGES, type PortInfo } from "./logic";

function ProtocolBadge({ p }: { p: PortInfo }) {
  const color =
    p.protocol === "tcp"
      ? "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400"
      : p.protocol === "udp"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      : "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400";
  return <Badge variant="outline" className={`text-[10px] uppercase ${color}`}>{p.protocol}</Badge>;
}

export default function PortRangeScannerRef() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => searchPorts(query), [query]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="port-search" className="text-xs text-muted-foreground">
            Search by port number, service, or description
          </Label>
          <Input
            id="port-search"
            placeholder="e.g. 443, HTTPS, mail"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="font-mono text-sm"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PORT_RANGES.map((r) => (
              <div key={r.range} className="rounded-md border bg-muted/30 p-2 text-xs">
                <div className="font-mono text-foreground">{r.range}</div>
                <div className="text-muted-foreground">{r.category}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{r.description}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Reference ({results.length} ports)</Label>
          </div>
          <div className="space-y-1 max-h-[420px] overflow-auto">
            {results.map((p) => {
              const range = classifyPort(p.port);
              return (
                <div
                  key={`${p.port}-${p.protocol}`}
                  className="grid grid-cols-[60px_1fr_auto] gap-3 items-center text-xs py-2 border-b border-border/40 last:border-0"
                >
                  <div>
                    <code className="font-mono text-foreground font-semibold">{p.port}</code>
                    <ProtocolBadge p={p} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.service}</span>
                      {p.encrypted && (
                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                          TLS
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground">{p.description}</div>
                    {range && <div className="text-[10px] text-muted-foreground mt-0.5">{range.category} port</div>}
                  </div>
                  <CopyButton getText={() => `${p.port}/${p.protocol} — ${p.service}`} label="" size="icon-sm" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {results.length === 0 && (
        <EmptyState title="No matching ports" hint="Try searching by service name (HTTP), number (80), or keyword (mail)." />
      )}
    </div>
  );
}
