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
  AUDIENCE_PRESETS,
  parsePillarAndClusters,
  parseTargetKeywords,
  buildClusterMap,
  buildContentBriefs,
  computeSummaryStats,
  filterByCluster,
  renderText,
  renderCsv,
  renderClusterMapJson,
  buildInternalLinkMatrix,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type AudienceLevel,
  type HistoryEntry,
} from "./logic";
import { Network, History, Filter, Link2 } from "lucide-react";

export default function TopicClusterBuilder() {
  const [pillarText, setPillarText] = useState("SEO");
  const [clustersText, setClustersText] = useState(
    "keyword research\non-page SEO\nlink building\ntechnical SEO\nlocal SEO",
  );
  const [keywordsCsv, setKeywordsCsv] = useState(
    "keyword research,best SEO tools\non-page SEO,on page optimization",
  );
  const [audience, setAudience] = useState<AudienceLevel>("intermediate");
  const [filterCluster, setFilterCluster] = useState<string>("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.pillar) setPillarText(p.pillar);
      if (p.clusters) setClustersText(p.clusters);
      if (p.keywords) setKeywordsCsv(p.keywords);
      if (p.audience) setAudience(p.audience);
      if (window.location.hash.length > 1) toast.info("Loaded from share link");
    }
  }, []);

  const parsed = useMemo(
    () => parsePillarAndClusters(pillarText, clustersText),
    [pillarText, clustersText],
  );
  const keywordsMap = useMemo(() => parseTargetKeywords(keywordsCsv), [keywordsCsv]);

  const inputs = useMemo(
    () => ({
      pillarTopic: parsed.pillar,
      clusters: parsed.clusters,
      targetKeywords: keywordsMap,
      audienceLevel: audience,
    }),
    [parsed, keywordsMap, audience],
  );

  const map = useMemo(() => buildClusterMap(inputs), [inputs]);
  const briefs = useMemo(() => buildContentBriefs(inputs), [inputs]);
  const stats = useMemo(() => computeSummaryStats(map, briefs, audience), [map, briefs, audience]);
  const matrix = useMemo(() => buildInternalLinkMatrix(parsed.clusters), [parsed.clusters]);

  const filteredMap = useMemo(() => filterByCluster(map, filterCluster), [map, filterCluster]);

  const textOut = useMemo(() => renderText(filteredMap, briefs), [filteredMap, briefs]);
  const csvOut = useMemo(() => renderCsv(filteredMap), [filteredMap]);
  const jsonOut = useMemo(() => renderClusterMapJson(filteredMap), [filteredMap]);

  const handleSaveHistory = useCallback(() => {
    if (map.clusters.length > 0) {
      saveHistory({
        ts: Date.now(),
        pillar: parsed.pillar,
        clusterCount: map.clusters.length,
        audience,
      });
      setHistory(loadHistory());
    }
  }, [map.clusters.length, parsed.pillar, audience]);

  const handleClear = useCallback(() => {
    setPillarText("");
    setClustersText("");
    setKeywordsCsv("");
    setAudience("intermediate");
    setFilterCluster("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const shareInputs = {
    pillar: pillarText,
    clusters: clustersText,
    keywords: keywordsCsv,
    audience,
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tcb-pillar" className="text-xs">Pillar topic</Label>
            <Input
              id="tcb-pillar"
              value={pillarText}
              onChange={(e) => setPillarText(e.target.value)}
              placeholder="SEO"
              className="text-sm font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tcb-clusters" className="text-xs">Cluster topics (one per line or comma-separated)</Label>
            <Textarea
              id="tcb-clusters"
              value={clustersText}
              onChange={(e) => setClustersText(e.target.value)}
              placeholder={"keyword research\non-page SEO\nlink building\ntechnical SEO\nlocal SEO"}
              className="min-h-[100px] resize-y font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tcb-kw" className="text-xs">Target keywords CSV — <code>cluster,keyword</code> per line (optional)</Label>
            <Textarea
              id="tcb-kw"
              value={keywordsCsv}
              onChange={(e) => setKeywordsCsv(e.target.value)}
              placeholder={"keyword research,best SEO tools\non-page SEO,on page optimization"}
              className="min-h-[70px] resize-y font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Audience level</Label>
            <div className="flex flex-wrap gap-2">
              {AUDIENCE_PRESETS.map((a) => (
                <Button
                  key={a.value}
                  variant={audience === a.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAudience(a.value)}
                  className="h-8 text-xs"
                >
                  {a.label} (~{a.wordCount})
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {map.clusters.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Network className="h-4 w-4" /> Pillar: <span className="font-mono">{map.pillar || "—"}</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Clusters" value={stats.totalClusters} />
                <Stat label="Subtopics" value={stats.totalSubtopics} />
                <Stat label="Internal links" value={stats.totalInternalLinks} />
                <Stat label="Total word count" value={stats.totalWordCount.toLocaleString()} />
              </div>
              <div className="text-[11px] text-muted-foreground">
                Audience: <Badge variant="outline" className="text-[10px] ml-1">{audience}</Badge>
                {" · "}Word count per cluster: <strong>{AUDIENCE_PRESETS.find((a) => a.value === audience)?.wordCount}</strong>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Filter className="h-4 w-4" /> Clusters ({filteredMap.clusters.length})
                </h3>
                <select
                  value={filterCluster}
                  onChange={(e) => setFilterCluster(e.target.value)}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="">All clusters</option>
                  {map.clusters.map((c) => (
                    <option key={c.topic} value={c.topic}>{c.topic}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                {filteredMap.clusters.map((c) => (
                  <div key={c.topic} className="rounded border bg-background p-3 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-foreground">{c.title}</div>
                      <Badge variant="secondary" className="text-[10px] whitespace-nowrap">{c.wordCount} words</Badge>
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      <span className="text-[10px] uppercase tracking-wide">Topic:</span> <span className="font-mono">{c.topic}</span>
                      {c.keyword && (
                        <>
                          {" · "}
                          <span className="text-[10px] uppercase tracking-wide">Keyword:</span> <span className="font-mono">{c.keyword}</span>
                        </>
                      )}
                    </div>
                    <div className="mt-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Subtopics ({c.subtopics.length})</div>
                      <ul className="space-y-0.5">
                        {c.subtopics.map((s, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-muted-foreground mt-0.5">·</span>
                            <span>{s.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {matrix.nodes.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Link2 className="h-4 w-4" /> Internal link matrix (cluster ↔ cluster)
                </h3>
                <div className="overflow-x-auto">
                  <table className="text-[11px]">
                    <thead>
                      <tr>
                        <th className="px-2 py-1 text-left text-muted-foreground"></th>
                        {matrix.nodes.map((n) => (
                          <th key={n} className="px-2 py-1 text-left font-medium text-muted-foreground whitespace-nowrap">
                            {n.length > 12 ? n.slice(0, 10) + "…" : n}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.nodes.map((rowNode, i) => (
                        <tr key={rowNode}>
                          <td className="px-2 py-1 font-medium text-muted-foreground whitespace-nowrap">
                            {rowNode.length > 12 ? rowNode.slice(0, 10) + "…" : rowNode}
                          </td>
                          {matrix.matrix[i].map((cell, j) => (
                            <td key={j} className="px-2 py-1 text-center">
                              {cell ? (
                                <Badge variant="default" className="text-[9px] h-4">↔</Badge>
                              ) : (
                                <span className="text-muted-foreground">·</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Each cluster links to its adjacent neighbors. Pillar page links to/from every cluster (not shown in matrix).
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Content briefs</h3>
              <div className="space-y-2 max-h-[400px] overflow-auto">
                {briefs.map((b) => (
                  <div key={b.cluster} className="rounded border bg-background p-2 text-xs">
                    <div className="font-semibold text-foreground">{b.title}</div>
                    <div className="text-muted-foreground text-[11px]">
                      {b.keyword ? `Keyword: ${b.keyword} · ` : ""}Word count: {b.wordCount}
                    </div>
                    <div className="mt-1 font-mono text-[10px] space-y-0.5">
                      {b.headers.map((h, i) => (
                        <div key={i} className="text-muted-foreground">
                          <span className="text-foreground">{h.level === 1 ? "H1" : h.level === 2 ? "H2" : "H3"}:</span> {h.text}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => { handleSaveHistory(); return textOut; }} label="Copy report" />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return textOut; }}
                  filename="topic-cluster-report.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csvOut}
                  filename="topic-cluster.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return jsonOut; }}
                  filename="topic-cluster-map.json"
                  mime="application/json"
                  label="Download JSON"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(shareInputs); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a pillar topic and cluster topics to build a cluster map"
          hint="The pillar page is the hub; clusters are supporting pages. Subtopics are generated deterministically based on audience level."
          icon={<Network className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.pillar || "—"}</Badge>
                  <Badge variant="outline" className="mr-2">{h.clusterCount} clusters</Badge>
                  <Badge variant="outline" className="mr-2">{h.audience}</Badge>
                  <span className="text-muted-foreground ml-2">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All cluster generation runs locally. Subtopic templates are deterministic (no AI). History is stored in localStorage on this device only.
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
