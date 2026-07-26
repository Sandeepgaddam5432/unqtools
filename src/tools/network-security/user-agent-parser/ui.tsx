"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  parseUserAgent,
  buildUserAgent,
  bulkParse,
  getClientHints,
  getMyUserAgent,
  exportParsed,
  isLikelySpoofed,
  getConfidenceLabel,
  type ParsedUA,
} from "./logic";

export default function UserAgentParser() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ParsedUA | null>(null);
  const [bulkResults, setBulkResults] = useState<ParsedUA[]>([]);
  const [bulkInput, setBulkInput] = useState("");
  const [myUa, setMyUa] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"single" | "bulk" | "builder">("single");

  useEffect(() => {
    setMyUa(getMyUserAgent());
  }, []);

  const parse = useCallback(() => {
    setError(null);
    try {
      const r = parseUserAgent(input, getClientHints());
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    }
  }, [input]);

  const parseBulk = useCallback(() => {
    setError(null);
    try {
      const results = bulkParse(bulkInput);
      setBulkResults(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [bulkInput]);

  const useMyUa = useCallback(() => {
    setInput(myUa);
    setMode("single");
  }, [myUa]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Button variant={mode === "single" ? "default" : "outline"} size="sm" onClick={() => setMode("single")}>Single UA</Button>
            <Button variant={mode === "bulk" ? "default" : "outline"} size="sm" onClick={() => setMode("bulk")}>Bulk</Button>
            <Button variant={mode === "builder" ? "default" : "outline"} size="sm" onClick={() => setMode("builder")}>UA Builder</Button>
            {myUa && (
              <Button variant="ghost" size="sm" onClick={useMyUa}>Use my UA</Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            User-Agent strings are spoofable and being deprecated. Client Hints (navigator.userAgentData) provide more accurate detection for modern Chromium browsers. All parsing is 100% client-side.
          </p>
        </CardContent>
      </Card>

      {mode === "single" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label htmlFor="ua-input">User-Agent string</Label>
              <Textarea
                id="ua-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste any User-Agent string..."
                rows={3}
              />
              <Button onClick={parse} disabled={!input.trim()}>Parse</Button>
            </CardContent>
          </Card>

          {error && <ErrorBanner message={error} />}

          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Parsed Result</span>
                  <div className="flex gap-2">
                    <Badge variant={isLikelySpoofed(result.raw) ? "destructive" : "secondary"}>
                      {isLikelySpoofed(result.raw) ? "Spoofed" : "OK"}
                    </Badge>
                    <Badge variant="outline">
                      {getConfidenceLabel(result.confidence)} ({(result.confidence * 100).toFixed(0)}%)
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Browser">{result.browser.name} {result.browser.version}</Field>
                  <Field label="Engine">{result.engine.name} {result.engine.version}</Field>
                  <Field label="OS">{result.os.name} {result.os.version}</Field>
                  <Field label="CPU">{result.cpu.architecture || "Unknown"}</Field>
                  <Field label="Device">{result.device.vendor} {result.device.model} ({result.device.type})</Field>
                  <Field label="Bot">{result.bot.isBot ? `${result.bot.name} (${result.bot.category})` : "No"}</Field>
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
              <Label htmlFor="bulk-input">Paste User-Agents (one per line)</Label>
              <Textarea
                id="bulk-input"
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="Mozilla/5.0...\nMozilla/5.0...\n..."
                rows={6}
              />
              <div className="flex gap-2 flex-wrap">
                <Button onClick={parseBulk} disabled={!bulkInput.trim()}>Parse All</Button>
                <DownloadButton
                  getText={() => exportParsed(bulkResults, "csv")}
                  filename="ua-results.csv"
                  mime="text/csv"
                  disabled={bulkResults.length === 0}
                />
                <DownloadButton
                  getText={() => exportParsed(bulkResults, "json")}
                  filename="ua-results.json"
                  mime="application/json"
                  disabled={bulkResults.length === 0}
                />
              </div>
            </CardContent>
          </Card>

          {bulkResults.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Parsed {bulkResults.length} UAs</CardTitle></CardHeader>
              <CardContent className="p-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Browser</th>
                        <th className="text-left p-2">OS</th>
                        <th className="text-left p-2">Device</th>
                        <th className="text-left p-2">Bot</th>
                        <th className="text-left p-2">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkResults.map((r, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2">{r.browser.name} {r.browser.major}</td>
                          <td className="p-2">{r.os.name}</td>
                          <td className="p-2">{r.device.type}</td>
                          <td className="p-2">{r.bot.isBot ? r.bot.name : "—"}</td>
                          <td className="p-2">{(r.confidence * 100).toFixed(0)}%</td>
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

      {mode === "builder" && <UaBuilder />}
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

function UaBuilder() {
  const [browser, setBrowser] = useState("Chrome");
  const [browserVer, setBrowserVer] = useState("120.0.0.0");
  const [os, setOs] = useState("Windows");
  const [osVer, setOsVer] = useState("10.0");
  const [deviceType, setDeviceType] = useState("desktop");

  const built = buildUserAgent({
    browser: { name: browser, version: browserVer },
    os: { name: os, version: osVer },
    device: { vendor: "", model: "", type: deviceType },
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">UA Builder</CardTitle></CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Browser</Label>
            <select value={browser} onChange={(e) => setBrowser(e.target.value)} className="w-full border rounded px-2 py-1 text-sm">
              <option>Chrome</option>
              <option>Firefox</option>
              <option>Safari</option>
              <option>Edge</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Browser version</Label>
            <Input value={browserVer} onChange={(e) => setBrowserVer(e.target.value)} className="text-sm" />
          </div>
          <div>
            <Label className="text-xs">OS</Label>
            <select value={os} onChange={(e) => setOs(e.target.value)} className="w-full border rounded px-2 py-1 text-sm">
              <option>Windows</option>
              <option>macOS</option>
              <option>iOS</option>
              <option>Android</option>
              <option>Linux</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">OS version</Label>
            <Input value={osVer} onChange={(e) => setOsVer(e.target.value)} className="text-sm" />
          </div>
          <div>
            <Label className="text-xs">Device type</Label>
            <select value={deviceType} onChange={(e) => setDeviceType(e.target.value)} className="w-full border rounded px-2 py-1 text-sm">
              <option>desktop</option>
              <option>mobile</option>
              <option>tablet</option>
            </select>
          </div>
        </div>
        <div className="rounded-md border bg-muted/30 p-3 text-xs font-mono break-all">
          {built}
        </div>
        <CopyButton getText={() => built} label="Copy UA" />
      </CardContent>
    </Card>
  );
}
