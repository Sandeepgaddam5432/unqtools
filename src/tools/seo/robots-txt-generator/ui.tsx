"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CopyButton, DownloadButton, EmptyState, ClearButton } from "../../_shared";
import { toast } from "sonner";
import {
  USER_AGENT_PRESETS,
  validateInput,
  generateRobotsTxt,
  computeStats,
  loadHistory,
  saveHistory,
  clearHistory,
  type RobotsGroup,
  type HistoryEntry,
} from "./logic";
import { History, Plus, X, Bot } from "lucide-react";

export default function RobotsTxtGenerator() {
  const [groups, setGroups] = useState<RobotsGroup[]>([
    { userAgent: "*", rules: [{ path: "/private/", allow: false }] },
  ]);
  const [sitemaps, setSitemaps] = useState<string[]>([]);
  const [newSitemap, setNewSitemap] = useState("");
  const [comments, setComments] = useState<string[]>([]);
  const [newComment, setNewComment] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const input = useMemo(() => ({ groups, sitemaps, comments }), [groups, sitemaps, comments]);
  const validation = useMemo(() => validateInput(input), [input]);
  const stats = useMemo(() => computeStats(input), [input]);
  const output = useMemo(() => {
    try {
      return generateRobotsTxt(input);
    } catch {
      return "";
    }
  }, [input]);

  const addGroup = useCallback(() => {
    setGroups((prev) => [...prev, { userAgent: "*", rules: [] }]);
  }, []);
  const removeGroup = useCallback((i: number) => {
    setGroups((prev) => prev.filter((_, idx) => idx !== i));
  }, []);
  const updateGroupUa = useCallback((i: number, ua: string) => {
    setGroups((prev) => prev.map((g, idx) => (idx === i ? { ...g, userAgent: ua } : g)));
  }, []);
  const addRule = useCallback((i: number) => {
    setGroups((prev) =>
      prev.map((g, idx) =>
        idx === i ? { ...g, rules: [...g.rules, { path: "/", allow: false }] } : g,
      ),
    );
  }, []);
  const removeRule = useCallback((gi: number, ri: number) => {
    setGroups((prev) =>
      prev.map((g, idx) =>
        idx === gi ? { ...g, rules: g.rules.filter((_, ridx) => ridx !== ri) } : g,
      ),
    );
  }, []);
  const updateRule = useCallback((gi: number, ri: number, key: "path" | "allow", value: string | boolean) => {
    setGroups((prev) =>
      prev.map((g, idx) =>
        idx === gi
          ? {
              ...g,
              rules: g.rules.map((r, ridx) => (ridx === ri ? { ...r, [key]: value } : r)),
            }
          : g,
      ),
    );
  }, []);
  const updateCrawlDelay = useCallback((i: number, value: string) => {
    const n = parseFloat(value);
    setGroups((prev) =>
      prev.map((g, idx) => (idx === i ? { ...g, crawlDelay: isNaN(n) ? undefined : n } : g)),
    );
  }, []);

  const addSitemap = useCallback(() => {
    if (!newSitemap.trim()) return;
    setSitemaps((prev) => [...prev, newSitemap.trim()]);
    setNewSitemap("");
  }, [newSitemap]);
  const removeSitemap = useCallback((i: number) => {
    setSitemaps((prev) => prev.filter((_, idx) => idx !== i));
  }, []);

  const addComment = useCallback(() => {
    if (!newComment.trim()) return;
    setComments((prev) => [...prev, newComment.trim()]);
    setNewComment("");
  }, [newComment]);

  const handleCopy = useCallback(() => {
    if (output) {
      saveHistory({ ts: Date.now(), snippet: output.slice(0, 200) });
      setHistory(loadHistory());
    }
  }, [output]);

  const handleClear = useCallback(() => {
    setGroups([{ userAgent: "*", rules: [] }]);
    setSitemaps([]);
    setComments([]);
    toast.info("Form cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">User-agent groups</h3>
            <Button size="sm" variant="outline" onClick={addGroup} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add group
            </Button>
          </div>
          {groups.map((g, gi) => (
            <div key={gi} className="rounded-md border p-3 space-y-2">
              <div className="flex items-end gap-2">
                <div className="space-y-1.5 flex-1">
                  <Label htmlFor={`ua-${gi}`}>User-agent</Label>
                  <Select value={g.userAgent} onValueChange={(v) => updateGroupUa(gi, v)}>
                    <SelectTrigger id={`ua-${gi}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {USER_AGENT_PRESETS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="icon" variant="ghost" onClick={() => removeGroup(gi)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {g.rules.map((r, ri) => (
                  <div key={ri} className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={r.allow}
                        onCheckedChange={(v) => updateRule(gi, ri, "allow", v)}
                        aria-label="Allow / Disallow toggle"
                      />
                      <span className="text-xs w-16">{r.allow ? "Allow" : "Disallow"}</span>
                    </div>
                    <Input
                      value={r.path}
                      onChange={(e) => updateRule(gi, ri, "path", e.target.value)}
                      placeholder="/path/ or /*.pdf$"
                      className="font-mono text-xs"
                    />
                    <Button size="icon" variant="ghost" onClick={() => removeRule(gi, ri)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="ghost" onClick={() => addRule(gi)} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add rule
                </Button>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t">
                <Label htmlFor={`cd-${gi}`} className="text-xs">Crawl-delay (s)</Label>
                <Input
                  id={`cd-${gi}`}
                  type="number"
                  min={0}
                  max={30}
                  value={g.crawlDelay ?? ""}
                  onChange={(e) => updateCrawlDelay(gi, e.target.value)}
                  className="w-24"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Sitemaps</h3>
          <div className="flex gap-2">
            <Input
              value={newSitemap}
              onChange={(e) => setNewSitemap(e.target.value)}
              placeholder="https://example.com/sitemap.xml"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSitemap();
                }
              }}
            />
            <Button size="sm" variant="outline" onClick={addSitemap} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          {sitemaps.length > 0 && (
            <div className="space-y-1">
              {sitemaps.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="font-mono flex-1 truncate">{s}</span>
                  <Button size="icon" variant="ghost" onClick={() => removeSitemap(i)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Comments</h3>
          <div className="flex gap-2">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Comment text (without #)"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addComment();
                }
              }}
            />
            <Button size="sm" variant="outline" onClick={addComment} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          {comments.length > 0 && (
            <div className="space-y-1">
              {comments.map((c, i) => (
                <div key={i} className="text-xs text-muted-foreground font-mono"># {c}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Groups</div>
          <div className="text-lg font-semibold">{stats.groupCount}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Rules</div>
          <div className="text-lg font-semibold">{stats.totalRules}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Sitemaps</div>
          <div className="text-lg font-semibold">{stats.sitemapCount}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Comments</div>
          <div className="text-lg font-semibold">{stats.commentCount}</div>
        </CardContent></Card>
      </div>

      {validation.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 space-y-1">
          {validation.warnings.map((w, i) => <div key={i}>• {w}</div>)}
        </div>
      )}

      {output ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Generated robots.txt</Label>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => { handleCopy(); return output; }} />
              <DownloadButton getText={() => output} filename="robots.txt" />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs break-all">
            {output}
          </pre>
        </div>
      ) : (
        <EmptyState
          title="Add at least one rule or sitemap"
          hint="Use the controls above to build robots.txt directives."
          icon={<Bot className="h-8 w-8" />}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs font-mono">
                  {h.snippet.slice(0, 80)}…
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> robots.txt generation runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
