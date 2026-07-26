"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { parseEmailHeaders, exportAnalysis, formatDelay, type EmailAnalysis } from "./logic";

export default function EmailHeaderAnalyzer() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<EmailAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(() => {
    setError(null);
    if (!input.trim()) {
      setError("Please paste email headers to analyze.");
      setResult(null);
      return;
    }
    const r = parseEmailHeaders(input);
    if (r.error) {
      setError(r.error);
      setResult(null);
    } else {
      setResult(r);
    }
  }, [input]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="headers-input">Paste raw email headers</Label>
          <Textarea
            id="headers-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"From: sender@example.com\nTo: recipient@example.com\nSubject: Hello\nReceived: ..."}
            rows={10}
          />
          <Button onClick={analyze}>Analyze</Button>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Email Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Field label="From">{result.from}</Field>
                <Field label="To">{result.to.join(", ")}</Field>
                <Field label="Subject">{result.subject}</Field>
                <Field label="Date">{result.date}</Field>
                <Field label="Message-ID">{result.messageId}</Field>
                <Field label="Hops">{result.receivedHops.length}</Field>
                <Field label="Total delay">{formatDelay(result.totalDelayMs)}</Field>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={result.auth.spf.result === "pass" ? "default" : result.auth.spf.result === "fail" ? "destructive" : "secondary"}>
                  SPF: {result.auth.spf.result}
                </Badge>
                <Badge variant={result.auth.dkim.result === "pass" ? "default" : result.auth.dkim.result === "fail" ? "destructive" : "secondary"}>
                  DKIM: {result.auth.dkim.result}
                </Badge>
                <Badge variant={result.auth.dmarc.result === "pass" ? "default" : result.auth.dmarc.result === "fail" ? "destructive" : "secondary"}>
                  DMARC: {result.auth.dmarc.result}
                </Badge>
              </div>
              {result.suspicious.length > 0 && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs space-y-1">
                  <p className="font-medium text-amber-700 dark:text-amber-400">Suspicious indicators:</p>
                  {result.suspicious.map((s, i) => <p key={i}>• {s}</p>)}
                </div>
              )}
              <div className="flex gap-2">
                <CopyButton getText={() => JSON.stringify(result, null, 2)} label="Copy JSON" />
                <DownloadButton
                  getText={() => exportAnalysis(result, "csv")}
                  filename="email-analysis.csv"
                  mime="text/csv"
                />
              </div>
            </CardContent>
          </Card>

          {result.receivedHops.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Received Hops ({result.receivedHops.length})</CardTitle></CardHeader>
              <CardContent className="p-4 space-y-2 text-xs">
                {result.receivedHops.map((hop, i) => (
                  <div key={i} className="border-l-2 border-primary/40 pl-3 py-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Hop {i + 1}</span>
                      {hop.delayMs !== undefined && (
                        <Badge variant="outline">+{formatDelay(hop.delayMs)}</Badge>
                      )}
                    </div>
                    {hop.from && <div className="text-muted-foreground">From: {hop.from}</div>}
                    {hop.by && <div className="text-muted-foreground">By: {hop.by}</div>}
                    {hop.with && <div className="text-muted-foreground">With: {hop.with}</div>}
                    {hop.for && <div className="text-muted-foreground">For: {hop.for}</div>}
                    {hop.timestamp && <div className="text-muted-foreground">{hop.timestamp}</div>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-sm">All Headers ({result.headers.length})</CardTitle></CardHeader>
            <CardContent className="p-4">
              <div className="space-y-1 max-h-96 overflow-y-auto text-xs">
                {result.headers.map((h, i) => (
                  <div key={i} className="grid grid-cols-[120px_1fr] gap-2 py-1 border-b">
                    <div className="font-medium text-muted-foreground">{h.name}</div>
                    <div className="break-all">{h.value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium break-all">{children}</div>
    </div>
  );
}
