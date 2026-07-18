"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  parseCsvLinks,
  validateLinks,
  generatePhpRedirect,
  generateJsRedirect,
  generateHtmlMetaRefresh,
  generateHtaccessBlock,
  generateNginxBlock,
  generateRobotsTxt,
  generateSlugFromUrl,
  buildTrackingUrl,
  checkUrlShortenerCompat,
  computeSummaryStats,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CloakedLink,
  type HistoryEntry,
} from "./logic";
import { History, Link as LinkIcon, FileCode2, Server, Shield, CheckCircle2, AlertTriangle } from "lucide-react";

const SAMPLE_CSV = `awesomeservice,https://awesomeservice.com/?ref=123
hostingco,https://hostingco.com/?aff=456
seo-toolkit,https://seotoolkit.io/?ref=789`;

const TRACKING_PRESETS = [
  { src: "newsletter", label: "newsletter" },
  { src: "twitter", label: "twitter" },
  { src: "youtube", label: "youtube" },
  { src: "blog", label: "blog" },
];

export default function AffiliateLinkCloaker() {
  const [baseUrl, setBaseUrl] = useState("https://example.com/go/");
  const [csvText, setCsvText] = useState("");
  const [activeView, setActiveView] = useState<"report" | "php" | "js" | "html" | "htaccess" | "nginx" | "robots">("report");
  const [trackingParam, setTrackingParam] = useState("newsletter");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.baseUrl) setBaseUrl(p.baseUrl);
      if (p.csvText) setCsvText(p.csvText);
      if (p.baseUrl || p.csvText) toast.info("Loaded from share link");
    }
  }, []);

  const records = useMemo(() => parseCsvLinks(csvText), [csvText]);
  const links: CloakedLink[] = useMemo(
    () => validateLinks(baseUrl, records),
    [baseUrl, records],
  );
  const validLinks = useMemo(() => links.filter((l) => l.valid), [links]);
  const stats = useMemo(() => computeSummaryStats(links), [links]);

  const reportText = useMemo(() => renderTextReport(baseUrl, links), [baseUrl, links]);
  const csvOutput = useMemo(() => renderCsv(links), [links]);
  const htaccessText = useMemo(() => generateHtaccessBlock(baseUrl, links), [baseUrl, links]);
  const nginxText = useMemo(() => generateNginxBlock(baseUrl, links), [baseUrl, links]);
  const robotsText = useMemo(() => generateRobotsTxt(baseUrl), [baseUrl]);

  const phpText = useMemo(
    () => validLinks.map((l) => `# ${l.slug}\n${generatePhpRedirect(l.affiliateUrl)}`).join("\n\n"),
    [validLinks],
  );
  const jsText = useMemo(
    () => validLinks.map((l) => `# ${l.slug}\n${generateJsRedirect(l.affiliateUrl)}`).join("\n\n"),
    [validLinks],
  );
  const htmlText = useMemo(
    () => validLinks.map((l) => `# ${l.slug}\n${generateHtmlMetaRefresh(l.affiliateUrl)}`).join("\n"),
    [validLinks],
  );

  const viewText = useMemo(() => {
    switch (activeView) {
      case "report": return reportText;
      case "php": return phpText;
      case "js": return jsText;
      case "html": return htmlText;
      case "htaccess": return htaccessText;
      case "nginx": return nginxText;
      case "robots": return robotsText;
      default: return "";
    }
  }, [activeView, reportText, phpText, jsText, htmlText, htaccessText, nginxText, robotsText]);

  const handleSaveHistory = useCallback(() => {
    if (links.length > 0) {
      saveHistory({
        ts: Date.now(),
        baseUrl,
        linkCount: links.length,
        validCount: stats.valid,
      });
      setHistory(loadHistory());
    }
  }, [links.length, stats.valid, baseUrl]);

  const handleClear = useCallback(() => {
    setBaseUrl("https://example.com/go/");
    setCsvText("");
    setActiveView("report");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleAutoSlug = useCallback(() => {
    // For each line without a slug, auto-generate one from the affiliate URL.
    const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const updated: string[] = [];
    for (const line of lines) {
      const parts = line.split(",");
      if (parts.length < 2) continue;
      const slug = (parts[0] || "").trim();
      const url = (parts[1] || "").trim();
      if (!slug && url) {
        const newSlug = generateSlugFromUrl(url);
        updated.push(`${newSlug},${url}`);
      } else {
        updated.push(line);
      }
    }
    setCsvText(updated.join("\n"));
    toast.success("Auto-generated slugs");
  }, [csvText]);

  const handleAddTracking = useCallback(() => {
    if (!trackingParam.trim()) {
      toast.error("Enter a tracking parameter first");
      return;
    }
    // No state change — just show toast about clicking a link below.
    toast.info(`Tracking param "${trackingParam}" added — see preview below`);
  }, [trackingParam]);

  const handleLoadSample = useCallback(() => {
    setBaseUrl("https://example.com/go/");
    setCsvText(SAMPLE_CSV);
    toast.info("Loaded sample CSV");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="alc-base">Base URL (your cloaked-link directory)</Label>
            <Input
              id="alc-base"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://example.com/go/"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="alc-csv">Affiliate links (CSV: <code>slug,affiliate_url</code>)</Label>
            <Textarea
              id="alc-csv"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={"awesomeservice,https://awesomeservice.com/?ref=123\nhostingco,https://hostingco.com/?aff=456"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={handleLoadSample}>Load sample</Button>
              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={handleAutoSlug}>Auto-generate slugs from URLs</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {links.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <LinkIcon className="h-4 w-4" /> {stats.total} links ({stats.valid} valid, {stats.invalid} invalid)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total links" value={stats.total} />
                <Stat label="Valid" value={stats.valid} highlight="good" />
                <Stat label="Invalid" value={stats.invalid} highlight={stats.invalid > 0 ? "bad" : undefined} />
                <Stat label="Slug conflicts" value={stats.slugConflicts} highlight={stats.slugConflicts > 0 ? "bad" : undefined} />
              </div>
              <div className="space-y-1 pt-2 max-h-[300px] overflow-auto">
                {links.map((l, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      {l.valid
                        ? <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        : <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />}
                      <span className="font-mono font-medium text-foreground">{l.slug || "(empty)"}</span>
                      <Badge variant="outline" className="text-[10px]">{l.prettyUrl.length} chars</Badge>
                      {(() => {
                        const compat = checkUrlShortenerCompat(l.prettyUrl);
                        return compat.compatible
                          ? <Badge variant="secondary" className="text-[10px]">shortener-ok</Badge>
                          : <Badge variant="outline" className="text-[10px] text-amber-600">too long</Badge>;
                      })()}
                    </div>
                    <div className="font-mono text-muted-foreground text-[10px] truncate">{l.affiliateUrl}</div>
                    <div className="font-mono text-foreground text-[10px] truncate">→ {l.prettyUrl}</div>
                    {l.issues.length > 0 && (
                      <ul className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 ml-4 list-disc">
                        {l.issues.map((iss, j) => (
                          <li key={j}>{iss.field}: {iss.message}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Click-tracking preview</h3>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={trackingParam}
                  onChange={(e) => setTrackingParam(e.target.value)}
                  placeholder="newsletter"
                  className="h-8 text-xs font-mono w-40"
                />
                <Button variant="outline" size="sm" className="h-8" onClick={handleAddTracking}>Add ?src= to all</Button>
                {TRACKING_PRESETS.map((p) => (
                  <Button
                    key={p.src}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px]"
                    onClick={() => setTrackingParam(p.src)}
                  >{p.label}</Button>
                ))}
              </div>
              <div className="space-y-1">
                {validLinks.slice(0, 5).map((l) => (
                  <div key={l.slug} className="rounded border bg-background px-3 py-1 text-xs font-mono break-all">
                    {buildTrackingUrl(l.prettyUrl, trackingParam ? { src: trackingParam } : {})}
                  </div>
                ))}
                {validLinks.length > 5 && (
                  <div className="text-[10px] text-muted-foreground">+{validLinks.length - 5} more…</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Generated output</h3>
                <div className="flex flex-wrap gap-1">
                  <ViewTab active={activeView === "report"} onClick={() => setActiveView("report")} label="Report" icon={<FileCode2 className="h-3 w-3" />} />
                  <ViewTab active={activeView === "php"} onClick={() => setActiveView("php")} label="PHP" />
                  <ViewTab active={activeView === "js"} onClick={() => setActiveView("js")} label="JS" />
                  <ViewTab active={activeView === "html"} onClick={() => setActiveView("html")} label="HTML" />
                  <ViewTab active={activeView === "htaccess"} onClick={() => setActiveView("htaccess")} label=".htaccess" icon={<Server className="h-3 w-3" />} />
                  <ViewTab active={activeView === "nginx"} onClick={() => setActiveView("nginx")} label="nginx" icon={<Server className="h-3 w-3" />} />
                  <ViewTab active={activeView === "robots"} onClick={() => setActiveView("robots")} label="robots.txt" icon={<Shield className="h-3 w-3" />} />
                </div>
              </div>
              <Textarea
                readOnly
                value={viewText}
                className="min-h-[280px] resize-y font-mono text-[11px]"
              />
              <div className="flex flex-wrap gap-2 pt-1">
                <CopyButton
                  getText={() => { handleSaveHistory(); return viewText; }}
                  label={`Copy ${activeView}`}
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return reportText; }}
                  filename="affiliate-cloak-report.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csvOutput}
                  filename="affiliate-links.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <DownloadButton
                  getText={() => htaccessText}
                  filename=".htaccess"
                  mime="text/plain"
                  label="Download .htaccess"
                />
                <DownloadButton
                  getText={() => nginxText}
                  filename="nginx.conf"
                  mime="text/plain"
                  label="Download nginx.conf"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(baseUrl, csvText); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste affiliate links to generate redirect scripts"
          hint="CSV format: slug,affiliate_url — one per line. Generates PHP/JS/HTML redirects, .htaccess, nginx, and robots.txt rules. Click 'Load sample' for a quick demo."
          icon={<LinkIcon className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.linkCount} links</Badge>
                  <Badge variant="outline" className="mr-2">{h.validCount} valid</Badge>
                  <span className="font-mono text-muted-foreground">{h.baseUrl}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All parsing, validation, and redirect generation runs locally in your browser. History is stored in localStorage on this device only. No affiliate URLs are ever transmitted.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-7 px-2.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-background border hover:bg-accent"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
