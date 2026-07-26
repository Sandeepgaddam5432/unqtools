"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton } from "../../_shared";
import { calculateCidr, splitSubnet, type CidrResult } from "./logic";

export default function CidrIpCalculator() {
  const [input, setInput] = useState("192.168.1.0/24");
  const [result, setResult] = useState<CidrResult | null>(null);
  const [splitPrefix, setSplitPrefix] = useState(25);
  const [splitResults, setSplitResults] = useState<CidrResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const calc = useCallback(() => {
    setError(null);
    const r = calculateCidr(input);
    if (r.error) {
      setError(r.error);
      setResult(null);
    } else {
      setResult(r);
    }
  }, [input]);

  const doSplit = useCallback(() => {
    setError(null);
    const subnets = splitSubnet(input, splitPrefix);
    if (subnets.length === 0) {
      setError("Could not split — check that the new prefix is larger than the input prefix.");
      setSplitResults([]);
    } else {
      setSplitResults(subnets);
    }
  }, [input, splitPrefix]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="cidr-input">CIDR (e.g. 192.168.1.0/24 or ::1/128)</Label>
          <Input
            id="cidr-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="192.168.1.0/24"
            onKeyDown={(e) => e.key === "Enter" && calc()}
          />
          <Button onClick={calc}>Calculate</Button>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !result.error && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              Result
              <Badge>IPv{result.version}</Badge>
              <Badge variant="outline">{result.ipType}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Network">{result.network}</Field>
              <Field label="Broadcast">{result.broadcast}</Field>
              <Field label="First host">{result.firstHost}</Field>
              <Field label="Last host">{result.lastHost}</Field>
              <Field label="Host count">{result.hostCount.toLocaleString()}</Field>
              <Field label="Prefix">/{result.prefix}</Field>
              {result.subnetMask && <Field label="Subnet mask">{result.subnetMask}</Field>}
              {result.wildcard && <Field label="Wildcard">{result.wildcard}</Field>}
              {result.ptr && <Field label="PTR (reverse DNS)">{result.ptr}</Field>}
            </div>
            <div className="flex flex-wrap gap-1">
              {result.isPrivate && <Badge>Private</Badge>}
              {result.isLoopback && <Badge variant="secondary">Loopback</Badge>}
              {result.isMulticast && <Badge variant="secondary">Multicast</Badge>}
              {result.isLinkLocal && <Badge variant="secondary">Link-local</Badge>}
              {result.isReserved && <Badge variant="destructive">Reserved</Badge>}
            </div>
            <CopyButton getText={() => JSON.stringify(result, null, 2)} label="Copy JSON" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">Subnet Splitter</CardTitle></CardHeader>
        <CardContent className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">Split the parent CIDR into smaller subnets.</p>
          <div className="flex gap-2 items-end">
            <div>
              <Label className="text-xs">New prefix</Label>
              <Input
                type="number"
                min={1}
                max={128}
                value={splitPrefix}
                onChange={(e) => setSplitPrefix(parseInt(e.target.value) || 0)}
                className="w-24"
              />
            </div>
            <Button onClick={doSplit}>Split</Button>
          </div>

          {splitResults.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Network</th>
                    <th className="text-left p-2">First host</th>
                    <th className="text-left p-2">Last host</th>
                    <th className="text-left p-2">Hosts</th>
                  </tr>
                </thead>
                <tbody>
                  {splitResults.map((r, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">{i + 1}</td>
                      <td className="p-2 font-mono">{r.network}/{r.prefix}</td>
                      <td className="p-2 font-mono">{r.firstHost}</td>
                      <td className="p-2 font-mono">{r.lastHost}</td>
                      <td className="p-2">{r.hostCount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium font-mono">{children}</div>
    </div>
  );
}
