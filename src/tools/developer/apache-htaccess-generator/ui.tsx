"use client";
import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton } from "../../_shared";
import { toast } from "sonner";
import { generateHtaccess, validateHtaccess, DEFAULTS } from "./logic";
import { Server, Plus, Trash2, Shield } from "lucide-react";

export default function ApacheHtaccessGenerator() {
  const [forceHttps, setForceHttps] = useState(true);
  const [forceWww, setForceWww] = useState(false);
  const [removeWww, setRemoveWww] = useState(false);
  const [enableGzip, setEnableGzip] = useState(true);
  const [enableCors, setEnableCors] = useState(false);
  const [corsOrigin, setCorsOrigin] = useState("*");
  const [disableDir, setDisableDir] = useState(true);
  const [blockIps, setBlockIps] = useState<string[]>([]);
  const [redirects, setRedirects] = useState<{ from: string; to: string; type: "301" | "302" }[]>([]);
  const [errorPages, setErrorPages] = useState<{ code: string; path: string }[]>([]);

  const output = useMemo(() => generateHtaccess({
    forceHttps, forceWww, removeWww, enableGzip, enableCors, corsOrigin,
    disableDirectoryListing: disableDir, blockIps, redirectRules: redirects, customErrorPages: errorPages,
  }), [forceHttps, forceWww, removeWww, enableGzip, enableCors, corsOrigin, disableDir, blockIps, redirects, errorPages]);

  const validation = useMemo(() => validateHtaccess(output), [output]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Server className="h-4 w-4 text-primary" />Options</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              ["Force HTTPS", forceHttps, setForceHttps],
              ["Force WWW", forceWww, setForceWww],
              ["Remove WWW", removeWww, setRemoveWww],
              ["Enable GZIP", enableGzip, setEnableGzip],
              ["Enable CORS", enableCors, setEnableCors],
              ["Disable Dir Listing", disableDir, setDisableDir],
            ].map(([label, val, setter]) => (
              <div key={label as string} className="flex items-center gap-2">
                <Switch checked={val as boolean} onCheckedChange={setter as (v: boolean) => void} id={label as string} />
                <Label htmlFor={label as string} className="text-sm cursor-pointer">{label as string}</Label>
              </div>
            ))}
          </div>
          {enableCors && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">CORS Origin</Label>
              <Input value={corsOrigin} onChange={e => setCorsOrigin(e.target.value)} placeholder="*" className="h-9" />
            </div>
          )}
          {/* Redirects */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Redirect Rules</Label>
              <Button variant="outline" size="sm" onClick={() => setRedirects([...redirects, { from: "", to: "", type: "301" }])} className="gap-1"><Plus className="h-3 w-3" />Add</Button>
            </div>
            {redirects.map((r, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select value={r.type} onChange={e => { const n = [...redirects]; n[i] = { ...n[i], type: e.target.value as "301" | "302" }; setRedirects(n); }} className="h-9 rounded border px-2 text-sm">
                  <option value="301">301</option><option value="302">302</option>
                </select>
                <Input value={r.from} onChange={e => { const n = [...redirects]; n[i] = { ...n[i], from: e.target.value }; setRedirects(n); }} placeholder="/old-path" className="h-9" />
                <Input value={r.to} onChange={e => { const n = [...redirects]; n[i] = { ...n[i], to: e.target.value }; setRedirects(n); }} placeholder="/new-path" className="h-9" />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRedirects(redirects.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
          {/* Block IPs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Block IPs</Label>
              <Button variant="outline" size="sm" onClick={() => setBlockIps([...blockIps, ""])} className="gap-1"><Plus className="h-3 w-3" />Add</Button>
            </div>
            {blockIps.map((ip, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input value={ip} onChange={e => { const n = [...blockIps]; n[i] = e.target.value; setBlockIps(n); }} placeholder="1.2.3.4" className="h-9" />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setBlockIps(blockIps.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Generated .htaccess</Label>
          <div className="flex gap-2">
            <CopyButton getText={() => output} />
            <DownloadButton getText={() => output} filename=".htaccess" mime="text/plain" />
          </div>
        </div>
        <pre className="rounded-lg border bg-muted/30 p-4 text-xs font-mono overflow-auto max-h-[500px] whitespace-pre-wrap">{output}</pre>
        {validation.warnings.length > 0 && (
          <div className="space-y-1">
            {validation.warnings.map((w, i) => <Badge key={i} variant="outline" className="text-xs text-amber-600 border-amber-500/30">{w}</Badge>)}
          </div>
        )}
      </div>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> 100% client-side generation. No server interaction.</p></CardContent></Card>
    </div>
  );
}
