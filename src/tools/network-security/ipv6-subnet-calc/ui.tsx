"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { computeSubnet } from "./logic";

export default function Ipv6SubnetCalc() {
  const [cidr, setCidr] = useState("2001:db8::/64");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    const r = computeSubnet(cidr);
    if ("error" in r) { setError(r.error); return null; }
    setError(null);
    return r;
  }, [cidr]);

  const report = result ? [
    `Network (compressed): ${result.network}`,
    `Network (expanded):   ${result.networkExpanded}`,
    `Prefix:               /${result.prefix}`,
    `Total addresses:      ${result.totalAddresses}`,
    `First host:           ${result.firstHost}`,
    `Last host:            ${result.lastHost}`,
    `Reverse DNS zone:     ${result.reverseDns}`,
  ].join("\n") : "";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">IPv6 CIDR</Label>
          <input type="text" className="w-full rounded-md border px-2 py-1 text-sm font-mono" value={cidr} onChange={(e) => setCidr(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setCidr("2001:db8::/64")}>/64 example</Button>
            <Button size="sm" variant="ghost" onClick={() => setCidr("::1/128")}>Loopback /128</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Subnet info</Label>
              <div className="flex gap-2">
                <CopyButton getText={() => report} />
                <DownloadButton getText={() => report} filename="ipv6-subnet.txt" />
              </div>
            </div>
            <pre className="text-xs overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap break-all">{report}</pre>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
