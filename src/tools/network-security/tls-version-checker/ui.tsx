"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { TLS_VERSIONS, lookup, toMarkdown, type TLSInfo } from "./logic";

const STATUS_COLOR: Record<TLSInfo["status"], string> = {
  Deprecated: "bg-red-500/15 text-red-700 dark:text-red-300",
  "Supported (legacy)": "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  Recommended: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export default function TlsVersionChecker() {
  const [version, setVersion] = useState<string>("TLS 1.3");
  const info = useMemo(() => lookup(version), [version]);
  const md = useMemo(() => (info ? toMarkdown(info) : ""), [info]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tls-select" className="text-xs text-muted-foreground">
              Select a TLS version
            </Label>
            <select
              id="tls-select"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="h-9 w-full text-sm rounded border bg-background px-2"
            >
              {TLS_VERSIONS.map((t) => (
                <option key={t.version} value={t.version}>
                  {t.version} ({t.status})
                </option>
              ))}
            </select>
          </div>
          {!info && <ErrorBanner message="Unknown TLS version" />}
        </CardContent>
      </Card>

      {info && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-[11px] ${STATUS_COLOR[info.status]}`}>{info.status}</Badge>
              {info.deprecated && <Badge variant="outline" className="text-[11px]">Deprecated {info.deprecatedYear}</Badge>}
              <div className="ml-auto flex gap-2">
                <CopyButton getText={() => md} label="Copy MD" />
                <DownloadButton getText={() => md} filename={`tls-${info.version.replace(/\s+/g, "-").toLowerCase()}.md`} mime="text/markdown" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <Cell label="Version" value={info.version} />
              <Cell label="RFC" value={info.rfc} />
              <Cell label="Published" value={String(info.publishedYear)} />
              <Cell label="Key exchange" value={info.keyExchange.join(", ")} />
              <Cell label="Ciphers" value={info.ciphers.join(", ")} />
              <Cell label="Deprecated" value={info.deprecated ? `Yes (${info.deprecatedYear})` : "No"} />
            </div>
            <div className="rounded border bg-muted/30 p-3 text-xs text-foreground">
              {info.notes}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-semibold">All TLS versions</p>
          <div className="space-y-1.5">
            {TLS_VERSIONS.map((t) => (
              <button
                key={t.version}
                onClick={() => setVersion(t.version)}
                className={`w-full text-left rounded border px-3 py-2 text-xs hover:bg-muted/40 ${t.version === version ? "border-primary" : "bg-background"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{t.version}</span>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_COLOR[t.status]}`}>{t.status}</Badge>
                  <span className="ml-auto text-[10px] text-muted-foreground">{t.rfc}</span>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> static reference data. No network requests.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm text-foreground break-all">{value}</div>
    </div>
  );
}
