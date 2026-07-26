"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  generateUa,
  generateBotUa,
  generateCustomUa,
  generateBatch,
  batchToText,
  listBrowsers,
  listDevices,
  listBrowserVersions,
  BOTS,
  type BrowserType,
  type DeviceType,
  type UaResult,
} from "./logic";

type Mode = "browser" | "bot" | "custom" | "batch";

export default function UserAgentGenerator() {
  const [mode, setMode] = useState<Mode>("browser");

  // Browser mode state
  const [browser, setBrowser] = useState<BrowserType>("chrome");
  const [device, setDevice] = useState<DeviceType>("windows");
  const [version, setVersion] = useState<string>(listBrowserVersions("chrome").slice(-1)[0] ?? "120");
  const [result, setResult] = useState<UaResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<UaResult[]>([]);

  // Bot mode state
  const [botIdx, setBotIdx] = useState<number>(0);

  // Custom mode state
  const [customOs, setCustomOs] = useState("Windows NT 10.0; Win64; x64");
  const [customEngine, setCustomEngine] = useState("AppleWebKit/537.36 (KHTML, like Gecko)");
  const [customBrowser, setCustomBrowser] = useState("Chrome/120.0.0.0 Safari/537.36");

  const browsers = useMemo(() => listBrowsers(), []);
  const devices = useMemo(() => listDevices(), []);
  const versions = useMemo(() => listBrowserVersions(browser), [browser]);

  const pushHistory = useCallback((r: UaResult) => {
    setHistory((h) => [r, ...h].slice(0, 10));
  }, []);

  const runBrowser = useCallback(() => {
    setError(null);
    const r = generateUa({ browser, device, version });
    if ("error" in r) {
      setError(r.error);
      setResult(null);
      return;
    }
    setResult(r);
    pushHistory(r);
  }, [browser, device, version, pushHistory]);

  const runBot = useCallback(() => {
    setError(null);
    const bot = BOTS[botIdx];
    if (!bot) {
      setError("Pick a known bot.");
      return;
    }
    const r = generateBotUa(bot.name, bot.url);
    setResult(r);
    pushHistory(r);
  }, [botIdx, pushHistory]);

  const runCustom = useCallback(() => {
    setError(null);
    const r = generateCustomUa({ os: customOs, engine: customEngine, browser: customBrowser });
    setResult(r);
    pushHistory(r);
  }, [customOs, customEngine, customBrowser, pushHistory]);

  const runBatch = useCallback(() => {
    setError(null);
    const batch = generateBatch();
    setResult({
      ua: batchToText(batch),
      profile: { browser: "chrome", device: "windows", version: "0" },
      isBot: false,
      warnings: [`Generated ${batch.length} user agents across all browser × device combos.`],
    });
  }, []);

  const run = useCallback(() => {
    if (mode === "browser") return runBrowser();
    if (mode === "bot") return runBot();
    if (mode === "custom") return runCustom();
    if (mode === "batch") return runBatch();
  }, [mode, runBrowser, runBot, runCustom, runBatch]);

  const onBrowserChange = (b: BrowserType) => {
    setBrowser(b);
    const v = listBrowserVersions(b).slice(-1)[0];
    if (v) setVersion(v);
  };

  const clearAll = () => {
    setResult(null);
    setError(null);
    setHistory([]);
  };

  const outputText = result?.ua ?? "";
  const isBatch = mode === "batch" && result !== null;
  const batchLines = isBatch ? outputText.split("\n") : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Mode</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {(["browser", "bot", "custom", "batch"] as Mode[]).map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant={mode === m ? "default" : "outline"}
                  onClick={() => { setMode(m); setResult(null); setError(null); }}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {mode === "browser" && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Browser</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {browsers.map((b) => (
                    <Button
                      key={b}
                      size="sm"
                      variant={browser === b ? "default" : "outline"}
                      onClick={() => onBrowserChange(b)}
                    >
                      {b}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Device / OS</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {devices.map((d) => (
                    <Button
                      key={d}
                      size="sm"
                      variant={device === d ? "default" : "outline"}
                      onClick={() => setDevice(d)}
                    >
                      {d}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Version</Label>
                  <select
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  >
                    {versions.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Custom version</Label>
                  <Input
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="120"
                  />
                </div>
              </div>
            </div>
          )}

          {mode === "bot" && (
            <div>
              <Label className="text-xs text-muted-foreground">Known bot</Label>
              <select
                value={botIdx}
                onChange={(e) => setBotIdx(Number(e.target.value))}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                {BOTS.map((b, i) => (
                  <option key={b.name} value={i}>{b.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                URL: {BOTS[botIdx]?.url}
              </p>
            </div>
          )}

          {mode === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">OS token</Label>
                <Input value={customOs} onChange={(e) => setCustomOs(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Engine token</Label>
                <Input value={customEngine} onChange={(e) => setCustomEngine(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Browser token</Label>
                <Input value={customBrowser} onChange={(e) => setCustomBrowser(e.target.value)} />
              </div>
            </div>
          )}

          {mode === "batch" && (
            <p className="text-xs text-muted-foreground">
              Generates a UA for every supported browser × device combination using each browser's latest version. Linux + Safari is skipped (Safari does not run on Linux).
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={run}>
              {mode === "batch" ? "Generate batch" : "Generate UA"}
            </Button>
            <Button size="sm" variant="ghost" onClick={clearAll}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                {isBatch ? "Batch output" : "User-Agent string"}
              </CardTitle>
              <div className="flex gap-2">
                <CopyButton getText={() => outputText} />
                <DownloadButton getText={() => outputText} filename={isBatch ? "user-agents.txt" : "user-agent.txt"} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-3 p-4 pt-0">
              {isBatch ? (
                <pre className="text-xs overflow-x-auto rounded-md bg-muted/40 p-3 font-mono whitespace-pre-wrap break-all">
                  {batchLines.map((l, i) => `${i + 1}. ${l}`).join("\n")}
                </pre>
              ) : (
                <pre className="text-sm overflow-x-auto rounded-md bg-muted/40 p-3 font-mono whitespace-pre-wrap break-all">
                  {outputText}
                </pre>
              )}

              <div className="flex flex-wrap gap-2 text-xs">
                {!isBatch && (
                  <>
                    <Badge variant="outline">Browser: {result.profile.browser}</Badge>
                    <Badge variant="outline">Device: {result.profile.device}</Badge>
                    <Badge variant="outline">Version: {result.profile.version}</Badge>
                    <Badge variant={result.isBot ? "default" : "secondary"}>
                      {result.isBot ? "Bot" : "Browser"}
                    </Badge>
                  </>
                )}
                <Badge variant="outline">Length: {outputText.length} chars</Badge>
                {isBatch && <Badge variant="outline">{batchLines.length} user agents</Badge>}
              </div>

              {result.warnings.length > 0 && (
                <div className="text-xs text-yellow-700 dark:text-yellow-400 space-y-0.5">
                  {result.warnings.map((w, i) => (
                    <p key={i}>⚠️ {w}</p>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">History (last {history.length})</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setHistory([])}>Clear</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4 pt-0 space-y-1.5">
              {history.map((h, i) => (
                <div key={i} className="rounded-md border border-border/50 bg-muted/20 p-2 text-xs font-mono break-all">
                  <div className="flex gap-2 items-center mb-1">
                    <Badge variant="outline">{h.isBot ? "bot" : h.profile.browser}</Badge>
                    <Badge variant="outline">{h.profile.device}</Badge>
                  </div>
                  <span className="text-muted-foreground">{h.ua}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all UA generation runs locally in your browser. No data is uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
