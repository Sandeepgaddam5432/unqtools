"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { search, byCategory, CATEGORY_LABELS, CATEGORY_COLORS, getCodeDetails, toCurlCommand, filterByServer, SUPPORTED_SERVERS, exportAsCsv, exportAsMarkdown, type StatusCodeCategory, type StatusCodeInfo } from "./logic";
import { Search, Star, Download, Server } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES: StatusCodeCategory[] = ["1xx", "2xx", "3xx", "4xx", "5xx"];

export default function HttpStatusCodeReference() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusCodeCategory | "all">("all");
  const [serverFilter, setServerFilter] = useState<string>("all");
  const [expandedCode, setExpandedCode] = useState<number | null>(null);

  const results = useMemo(() => {
    let list = search(query);
    if (filter !== "all") list = list.filter((s) => s.category === filter);
    if (serverFilter !== "all") {
      const serverCodes = new Set(filterByServer(serverFilter).map((s) => s.code));
      list = list.filter((s) => serverCodes.has(s.code));
    }
    return list;
  }, [query, filter, serverFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const cat of CATEGORIES) c[cat] = byCategory(cat).length;
    c.all = Object.values(c).reduce((a, b) => a + b, 0) - (c.all || 0);
    return c;
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="http-search" className="text-xs text-muted-foreground">
              Search by code, name, or description
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="http-search"
                placeholder="e.g. 404, not found, rate limit"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 font-mono text-sm"
                aria-label="Search status codes"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                filter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={filter === "all"}
            >
              All ({counts.all || 0})
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(cat)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                  filter === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
                aria-pressed={filter === cat}
              >
                {cat} ({counts[cat] || 0})
              </button>
            ))}
          </div>

          {/* Server filter + export (extras) */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
            <div className="flex items-center gap-1.5">
              <Server className="h-3 w-3 text-muted-foreground" />
              <select
                value={serverFilter}
                onChange={(e) => setServerFilter(e.target.value)}
                className="h-7 rounded-md border border-input bg-background px-2 text-xs cursor-pointer"
                aria-label="Filter by server software"
              >
                <option value="all">All servers</option>
                {SUPPORTED_SERVERS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => { navigator.clipboard.writeText(exportAsCsv()); toast.success("CSV copied"); }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border bg-background hover:bg-muted cursor-pointer">
              <Download className="h-2.5 w-2.5" /> CSV
            </button>
            <button type="button" onClick={() => { navigator.clipboard.writeText(exportAsMarkdown()); toast.success("Markdown copied"); }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border bg-background hover:bg-muted cursor-pointer">
              <Download className="h-2.5 w-2.5" /> Markdown
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">
              {results.length} {results.length === 1 ? "result" : "results"}
            </Label>
          </div>
          <div className="space-y-2">
            {results.map((s) => (
              <StatusCodeRow key={s.code} info={s} expanded={expandedCode === s.code} onToggle={() => setExpandedCode(expandedCode === s.code ? null : s.code)} />
            ))}
            {results.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No status codes match your search.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> this is a
            static reference. All search happens locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusCodeRow({ info, expanded, onToggle }: { info: StatusCodeInfo; expanded: boolean; onToggle: () => void }) {
  const details = getCodeDetails(info.code);
  return (
    <div className="rounded-md border p-3 hover:bg-muted/30 transition-colors cursor-pointer" onClick={onToggle}>
      <div className="flex items-center gap-3 mb-1.5">
        <Badge variant="outline" className={`font-mono font-bold text-sm ${CATEGORY_COLORS[info.category]}`}>
          {info.code}
        </Badge>
        <span className="font-semibold text-sm">{info.name}</span>
        {!info.isOfficial && (
          <Badge variant="outline" className="text-[9px] text-muted-foreground px-1 py-0">
            unofficial
          </Badge>
        )}
        {details?.serverSoftware && details.serverSoftware.length > 0 && details.serverSoftware[0] !== "all" && (
          <Badge variant="outline" className="text-[9px] px-1 py-0">{details.serverSoftware.join(", ")}</Badge>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">{expanded ? "▲" : "▼"}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-1.5">{info.description}</p>
      <p className="text-[11px] text-muted-foreground/80">
        <strong className="text-foreground/80">Use case:</strong> {info.useCase}
      </p>
      {expanded && details && (
        <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
          {details.commonCauses.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-foreground mb-1">Common causes:</p>
              <ul className="text-[10px] text-muted-foreground space-y-0.5 ml-3 list-disc">
                {details.commonCauses.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
          {details.howToFix.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-foreground mb-1">How to fix:</p>
              <ul className="text-[10px] text-muted-foreground space-y-0.5 ml-3 list-disc">
                {details.howToFix.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(toCurlCommand(info.code)); toast.success("curl command copied"); }}
              className="text-[10px] text-primary hover:underline cursor-pointer">Copy as curl</button>
            <a href={details.ianaUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
              className="text-[10px] text-primary hover:underline cursor-pointer">IANA registry ↗</a>
          </div>
        </div>
      )}
    </div>
  );
}
