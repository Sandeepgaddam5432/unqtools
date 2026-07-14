"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner, EmptyState } from "../../_shared";
import { calculateSubnet, formatHosts } from "./logic";
import { Network, Lock, Globe } from "lucide-react";

export default function IpSubnetCalculator() {
  const [input, setInput] = useState("");

  const result = useMemo(() => (input.trim() ? calculateSubnet(input) : null), [input]);

  const rows = useMemo(() => {
    if (!result?.isValid) return [];
    return [
      { label: "Network address", value: result.network },
      { label: "Broadcast address", value: result.broadcast },
      { label: "Subnet mask", value: result.mask },
      { label: "Wildcard mask", value: result.wildcard },
      { label: "CIDR", value: result.cidr },
      { label: "Prefix length", value: `/${result.prefix}` },
      { label: "First usable host", value: result.firstHost },
      { label: "Last usable host", value: result.lastHost },
      { label: "Total addresses", value: formatHosts(result.totalHosts) },
      { label: "Usable hosts", value: formatHosts(result.usableHosts) },
      { label: "IP class", value: result.ipClass },
    ];
  }, [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-2">
          <Label htmlFor="subnet-input" className="text-xs text-muted-foreground">
            IP / CIDR or IP + mask
          </Label>
          <Input
            id="subnet-input"
            placeholder="192.168.1.0/24  or  192.168.1.0 255.255.255.0"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="font-mono text-sm"
            aria-label="Subnet input"
          />
          <div className="flex gap-3 text-xs">
            <button
              type="button"
              onClick={() => setInput("192.168.1.0/24")}
              className="text-primary hover:underline cursor-pointer"
            >
              Sample /24
            </button>
            <button
              type="button"
              onClick={() => setInput("10.0.0.0/8")}
              className="text-primary hover:underline cursor-pointer"
            >
              Sample /8
            </button>
            <button
              type="button"
              onClick={() => setInput("172.16.5.10/30")}
              className="text-primary hover:underline cursor-pointer"
            >
              Sample /30
            </button>
          </div>
        </CardContent>
      </Card>

      {result && !result.isValid && <ErrorBanner message={result.error ?? "Invalid subnet"} />}

      {result?.isValid && (
        <>
          {/* Summary */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="font-mono text-xs">{result.cidr}</Badge>
                {result.isPrivate ? (
                  <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                    <Lock className="h-3 w-3" /> Private (RFC 1918)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400">
                    <Globe className="h-3 w-3" /> Public
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">Class {result.ipClass}</Badge>
                <Badge variant="outline" className="text-xs">
                  {formatHosts(result.usableHosts)} usable hosts
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Components table */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-semibold">Subnet details</Label>
              <div className="space-y-1">
                {rows.map((r) => (
                  <div
                    key={r.label}
                    className="grid grid-cols-[140px_1fr_auto] gap-2 items-center text-xs py-1.5 border-b border-border/40 last:border-0"
                  >
                    <span className="text-muted-foreground">{r.label}</span>
                    <code className="text-foreground font-mono break-all">{r.value}</code>
                    <CopyButton getText={() => r.value} label="" size="icon-sm" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Range visualization */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-semibold">Host range</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">Network</p>
                  <code className="text-xs font-mono">{result.network}</code>
                </div>
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">Usable hosts</p>
                  <code className="text-xs font-mono">{result.firstHost}</code>
                  <p className="text-[10px] text-muted-foreground my-1">to</p>
                  <code className="text-xs font-mono">{result.lastHost}</code>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">Broadcast</p>
                  <code className="text-xs font-mono">{result.broadcast}</code>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!result && (
        <EmptyState
          title="Enter a subnet to calculate"
          hint="Supports CIDR (192.168.1.0/24) or IP + mask (192.168.1.0 255.255.255.0). All math happens in your browser."
          icon={<Network className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all subnet
            math is done locally in your browser. No network requests are made.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
