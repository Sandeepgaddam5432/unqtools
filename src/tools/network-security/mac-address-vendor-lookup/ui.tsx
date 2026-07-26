"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  lookupMac, bulkLookup, reverseLookup, generateRandomMac, isValidMac,
  exportResults, getAllVendors, formatMac, normalizeMac,
  type LookupResult,
} from "./logic";

export default function MacAddressVendorLookup() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [bulkInput, setBulkInput] = useState("");
  const [bulkResults, setBulkResults] = useState<LookupResult[]>([]);
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorResults, setVendorResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"single" | "bulk" | "reverse" | "random">("single");

  const lookup = useCallback(() => {
    setError(null);
    if (!isValidMac(input)) {
      setError("Invalid MAC address. Expected 12 hex digits (e.g. 00:1B:44:00:00:00).");
      setResult(null);
      return;
    }
    setResult(lookupMac(input));
  }, [input]);

  const lookupBulk = useCallback(() => {
    setError(null);
    setBulkResults(bulkLookup(bulkInput));
  }, [bulkInput]);

  const searchVendor = useCallback(() => {
    setVendorResults(reverseLookup(vendorSearch));
  }, [vendorSearch]);

  const generateMac = useCallback(() => {
    const mac = generateRandomMac({ locallyAdministered: false });
    setInput(mac);
    setResult(lookupMac(mac));
  }, []);

  const allVendors = getAllVendors();

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2 flex-wrap">
            <Button variant={mode === "single" ? "default" : "outline"} size="sm" onClick={() => setMode("single")}>Single Lookup</Button>
            <Button variant={mode === "bulk" ? "default" : "outline"} size="sm" onClick={() => setMode("bulk")}>Bulk Lookup</Button>
            <Button variant={mode === "reverse" ? "default" : "outline"} size="sm" onClick={() => setMode("reverse")}>Reverse Lookup</Button>
            <Button variant={mode === "random" ? "default" : "outline"} size="sm" onClick={() => setMode("random")}>Random MAC</Button>
          </div>
        </CardContent>
      </Card>

      {mode === "single" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label htmlFor="mac-input">MAC address</Label>
              <Input
                id="mac-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="00:1B:44:00:00:00"
                onKeyDown={(e) => e.key === "Enter" && lookup()}
              />
              <div className="flex gap-2 flex-wrap">
                <Button onClick={lookup} disabled={!input.trim()}>Look up</Button>
                <Button variant="outline" onClick={generateMac}>Random MAC</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Supports colon (AA:BB:CC:DD:EE:FF), dash (AA-BB-CC-DD-EE-FF), dot (AABB.CCDD.EEFF), and continuous (AABBCCDDEEFF) formats.
              </p>
            </CardContent>
          </Card>

          {error && <ErrorBanner message={error} />}

          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  Vendor Lookup Result
                  <Badge variant={result.found ? "default" : "secondary"}>
                    {result.found ? "Found" : "Not in DB"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Vendor">{result.vendor}</Field>
                  <Field label="OUI prefix">{result.oui}</Field>
                  <Field label="Country">{result.country || "—"}</Field>
                  <Field label="Registry">{result.registry || "—"}</Field>
                  <Field label="Locally administered">{result.isLocallyAdministered ? "Yes" : "No"}</Field>
                  <Field label="Multicast">{result.isMulticast ? "Yes" : "No"}</Field>
                  <Field label="Universal">{result.isUniversal ? "Yes" : "No"}</Field>
                  <Field label="Normalized">{formatMac(normalizeMac(input), "colon")}</Field>
                </div>
                <CopyButton getText={() => JSON.stringify(result, null, 2)} label="Copy JSON" />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {mode === "bulk" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label htmlFor="bulk-mac">Paste MACs (one per line)</Label>
              <Textarea
                id="bulk-mac"
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="00:1B:44:00:00:00\n00:1A:11:00:00:00\n..."
                rows={6}
              />
              <div className="flex gap-2 flex-wrap">
                <Button onClick={lookupBulk} disabled={!bulkInput.trim()}>Look up All</Button>
                <DownloadButton
                  getText={() => exportResults(bulkResults, "csv")}
                  filename="mac-vendors.csv"
                  mime="text/csv"
                  disabled={bulkResults.length === 0}
                />
                <DownloadButton
                  getText={() => exportResults(bulkResults, "json")}
                  filename="mac-vendors.json"
                  mime="application/json"
                  disabled={bulkResults.length === 0}
                />
              </div>
            </CardContent>
          </Card>

          {bulkResults.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Looked up {bulkResults.length} MACs</CardTitle></CardHeader>
              <CardContent className="p-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">MAC</th>
                        <th className="text-left p-2">OUI</th>
                        <th className="text-left p-2">Vendor</th>
                        <th className="text-left p-2">Country</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkResults.map((r, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2 font-mono">{r.input}</td>
                          <td className="p-2 font-mono">{r.oui}</td>
                          <td className="p-2">{r.vendor}</td>
                          <td className="p-2">{r.country || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {mode === "reverse" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Reverse Lookup (Vendor → OUI)</CardTitle></CardHeader>
          <CardContent className="p-4 space-y-3">
            <Label htmlFor="vendor-search">Vendor name</Label>
            <Input
              id="vendor-search"
              value={vendorSearch}
              onChange={(e) => setVendorSearch(e.target.value)}
              placeholder="Apple"
              onKeyDown={(e) => e.key === "Enter" && searchVendor()}
            />
            <Button onClick={searchVendor} disabled={!vendorSearch.trim()}>Search</Button>
            <p className="text-xs text-muted-foreground">Or pick from {allVendors.length} known vendors:</p>
            <select
              onChange={(e) => { setVendorSearch(e.target.value); setVendorResults(reverseLookup(e.target.value)); }}
              className="w-full border rounded px-2 py-1 text-sm"
              defaultValue=""
            >
              <option value="">— Pick a vendor —</option>
              {allVendors.map((v) => <option key={v.oui} value={v.name}>{v.name}</option>)}
            </select>

            {vendorResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{vendorResults.length} OUI prefixes for "{vendorSearch}":</p>
                <div className="flex flex-wrap gap-1">
                  {vendorResults.map((oui) => (
                    <Badge key={oui} variant="outline" className="font-mono">{oui}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "random" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Random MAC Generator</CardTitle></CardHeader>
          <CardContent className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">Generate a random MAC address. Useful for testing.</p>
            <Button onClick={generateMac}>Generate Random MAC</Button>
            {result && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm font-mono">
                {formatMac(normalizeMac(result.input), "colon")}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{children}</div>
    </div>
  );
}
