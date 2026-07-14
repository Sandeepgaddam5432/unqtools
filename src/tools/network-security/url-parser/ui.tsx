"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner, EmptyState } from "../../_shared";
import { parseUrl, getEffectivePort, isHttps } from "./logic";
import { Link2, ShieldCheck, ShieldAlert } from "lucide-react";

export default function UrlParser() {
  const [input, setInput] = useState("");

  const parsed = useMemo(() => (input.trim() ? parseUrl(input) : null), [input]);

  const rows = useMemo(() => {
    if (!parsed?.isValid) return [];
    const port = getEffectivePort(parsed);
    return [
      { label: "Protocol", value: parsed.protocol, hint: "" },
      { label: "Username", value: parsed.username || "—", hint: "" },
      { label: "Password", value: parsed.password ? "•".repeat(parsed.password.length) : "—", hint: "" },
      { label: "Hostname", value: parsed.hostname, hint: "" },
      { label: "Port", value: parsed.port || `(${port ?? "default"})`, hint: "" },
      { label: "Host", value: parsed.host, hint: "hostname + port" },
      { label: "Origin", value: parsed.origin, hint: "scheme + host" },
      { label: "Pathname", value: parsed.pathname, hint: "" },
      { label: "Search", value: parsed.search || "—", hint: "query string" },
      { label: "Hash", value: parsed.hash || "—", hint: "fragment" },
    ];
  }, [parsed]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-2">
          <Label htmlFor="url-input" className="text-xs text-muted-foreground">
            URL to parse
          </Label>
          <Input
            id="url-input"
            placeholder="https://user:pass@example.com:8443/path?q=1#hash"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="font-mono text-sm"
            aria-label="URL input"
          />
          <button
            type="button"
            onClick={() => setInput("https://user:pass@example.com:8443/path/to/page?a=1&b=two&tag=x&tag=y#section")}
            className="text-xs text-primary hover:underline cursor-pointer"
          >
            Load sample
          </button>
        </CardContent>
      </Card>

      {parsed && !parsed.isValid && <ErrorBanner message={parsed.error ?? "Invalid URL"} />}

      {parsed?.isValid && (
        <>
          {/* Security summary */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  {isHttps(parsed) ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                  )}
                  <span className="text-sm">
                    {isHttps(parsed) ? "Secure (HTTPS)" : "Insecure (HTTP)"}
                  </span>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  port {getEffectivePort(parsed) ?? "—"}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {parsed.searchParams.length} query {parsed.searchParams.length === 1 ? "param" : "params"}
                </Badge>
                {parsed.hash && (
                  <Badge variant="outline" className="text-xs">has fragment</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Components table */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-semibold">Components</Label>
              <div className="space-y-1">
                {rows.map((r) => (
                  <div
                    key={r.label}
                    className="grid grid-cols-[100px_1fr_auto] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0"
                  >
                    <code className="font-semibold text-foreground">{r.label}</code>
                    <code className="text-muted-foreground font-mono break-all">{r.value}</code>
                    {r.value !== "—" && r.value && (
                      <CopyButton getText={() => r.value} label="" size="icon-sm" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Full URL */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Full URL (canonical)</Label>
                <CopyButton getText={() => parsed.href} label="Copy" size="sm" />
              </div>
              <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs break-all">
                {parsed.href}
              </pre>
            </CardContent>
          </Card>

          {/* Query params */}
          {parsed.searchParams.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <Label className="text-sm font-semibold">Query parameters</Label>
                <div className="grid grid-cols-1 gap-2">
                  {parsed.searchParams.map((p, i) => (
                    <div
                      key={`${p.key}-${i}`}
                      className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center text-xs rounded-md border bg-muted/20 p-2"
                    >
                      <code className="font-semibold text-foreground break-all">{p.key}</code>
                      <code className="text-muted-foreground font-mono break-all">{p.value}</code>
                      <CopyButton getText={() => p.value} label="" size="icon-sm" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!parsed && (
        <EmptyState
          title="Paste a URL to decompose"
          hint="URLs are parsed locally using the browser's native URL API. Nothing leaves your browser."
          icon={<Link2 className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> URL parsing
            happens entirely in your browser via the native <code>URL()</code>
            {" "}API. Nothing is logged or transmitted.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
