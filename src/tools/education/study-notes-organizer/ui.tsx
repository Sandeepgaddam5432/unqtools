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
  parseNotes,
  validateNotes,
  groupBySubject,
  buildTagIndex,
  searchNotes,
  filterNotes,
  sortByDate,
  computeCounts,
  generateTagCloud,
  findDuplicates,
  renderText,
  renderHtml,
  renderMarkdown,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SortOrder,
  type HistoryEntry,
} from "./logic";
import { NotebookPen, History, Search, Tag, AlertTriangle } from "lucide-react";

type ExportFormat = "text" | "html" | "markdown" | "csv" | "json";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  text: "Text",
  html: "HTML",
  markdown: "Markdown",
  csv: "CSV",
  json: "JSON",
};

export default function StudyNotesOrganizer() {
  const [notesText, setNotesText] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [format, setFormat] = useState<ExportFormat>("text");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.notes.length > 0) {
        setNotesText(p.raw);
        toast.info(`Loaded ${p.notes.length} notes from share link`);
      }
    }
  }, []);

  const parsed = useMemo(() => parseNotes(notesText), [notesText]);
  const { valid, invalid } = useMemo(() => validateNotes(parsed.notes), [parsed]);
  const filtered = useMemo(() => {
    let list = filterNotes(valid, subjectFilter, tagFilter);
    list = searchNotes(list, searchQuery);
    return sortByDate(list, sortOrder);
  }, [valid, subjectFilter, tagFilter, searchQuery, sortOrder]);

  const subjectGroups = useMemo(() => groupBySubject(filtered), [filtered]);
  const tagIndex = useMemo(() => buildTagIndex(filtered), [filtered]);
  const counts = useMemo(() => computeCounts(filtered), [filtered]);
  const tagCloud = useMemo(() => generateTagCloud(filtered), [filtered]);
  const dups = useMemo(() => findDuplicates(valid), [valid]);

  const rendered = useMemo(() => {
    switch (format) {
      case "html": return renderHtml(filtered);
      case "markdown": return renderMarkdown(filtered);
      case "csv": return renderCsv(filtered);
      case "json": return renderJson(filtered);
      default: return renderText(filtered);
    }
  }, [format, filtered]);

  const handleSaveHistory = useCallback(() => {
    if (parsed.notes.length > 0) {
      saveHistory({
        ts: Date.now(),
        noteCount: parsed.notes.length,
        subjectCount: Object.keys(counts.bySubject).length,
        preview: notesText.slice(0, 200),
      });
      setHistory(loadHistory());
    }
  }, [parsed.notes.length, counts.bySubject, notesText]);

  const handleClear = useCallback(() => {
    setNotesText("");
    setSubjectFilter("");
    setTagFilter("");
    setSearchQuery("");
    setSortOrder("newest");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const ext = format === "markdown" ? "md" : format === "html" ? "html" : format === "json" ? "json" : format === "csv" ? "csv" : "txt";
  const mime = format === "html" ? "text/html" : format === "csv" ? "text/csv" : format === "json" ? "application/json" : format === "markdown" ? "text/markdown" : "text/plain";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sno-notes">Notes — one per line, format: subject|topic|title|content|tags|date</Label>
            <Textarea
              id="sno-notes"
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder={"Biology|Cells|Mitochondria|Powerhouse of the cell|bio,cells|2024-09-12\nBiology|Cells|Nucleus|Contains DNA|bio,cells,important|2024-09-13\nMath|Algebra|Quadratic|Solve ax^2+bx+c=0|math,algebra|2024-09-10"}
              className="min-h-[140px] resize-y font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Tip: wrap content with pipes in quotes: <code className="font-mono">"see ch.3 | p.12"</code>. Tags are comma-separated.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <Label htmlFor="sno-subject-filter" className="text-xs">Filter by subject</Label>
              <Input
                id="sno-subject-filter"
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                placeholder="e.g. Biology"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="sno-tag-filter" className="text-xs">Filter by tag</Label>
              <Input
                id="sno-tag-filter"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                placeholder="e.g. important"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="sno-search" className="text-xs">Search title + content</Label>
              <Input
                id="sno-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. DNA"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Label htmlFor="sno-sort" className="text-xs">Sort:</Label>
            <select
              id="sno-sort"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="h-8 text-xs rounded border bg-background px-2"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {parsed.issues.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> {parsed.issues.length} validation issue(s)
            </h3>
            <div className="space-y-1 max-h-32 overflow-auto">
              {parsed.issues.slice(0, 10).map((iss, i) => (
                <div key={i} className="text-xs text-amber-700 dark:text-amber-300 font-mono">
                  {iss.message}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {parsed.notes.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <NotebookPen className="h-4 w-4" /> {counts.total} notes · {Object.keys(counts.bySubject).length} subjects · {counts.totalWords} words
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total notes" value={counts.total} />
                <Stat label="Subjects" value={Object.keys(counts.bySubject).length} />
                <Stat label="Topics" value={Object.keys(counts.byTopic).length} />
                <Stat label="Tags" value={Object.keys(counts.byTag).length} />
              </div>

              {dups.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> {dups.length} duplicate group(s) — same subject + title
                  </div>
                  {dups.slice(0, 5).map((d, i) => (
                    <div key={i} className="text-xs font-mono text-muted-foreground pl-4">
                      [{d.count}×] {d.subject} / {d.title}
                    </div>
                  ))}
                </div>
              )}

              {tagCloud.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-foreground flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5" /> Tag cloud (top {tagCloud.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tagCloud.map((t) => {
                      const max = tagCloud[0].count || 1;
                      const scale = 0.85 + (t.count / max) * 0.6;
                      return (
                        <Badge
                          key={t.tag}
                          variant="secondary"
                          className="text-[11px]"
                          style={{ fontSize: `${scale}rem` }}
                        >
                          {t.tag} <span className="ml-1 opacity-60">×{t.count}</span>
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Search className="h-4 w-4" /> Filtered notes ({filtered.length})
                </h3>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Format:</Label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as ExportFormat)}
                    className="h-8 text-xs rounded border bg-background px-2"
                  >
                    {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((f) => (
                      <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {format === "text" && (
                <div className="space-y-3 max-h-[500px] overflow-auto">
                  {subjectGroups.map((sg) => (
                    <div key={sg.subject} className="rounded border bg-background px-3 py-2">
                      <div className="text-xs font-semibold text-foreground border-b pb-1 mb-2">
                        {sg.subject} <Badge variant="outline" className="ml-1 text-[10px]">{sg.notes.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {sg.topics.map((tg) => (
                          <div key={tg.topic}>
                            <div className="text-[11px] font-medium text-muted-foreground mb-1">
                              {tg.topic || "(no topic)"}
                            </div>
                            {tg.notes.map((n, i) => (
                              <div key={i} className="ml-3 mb-1.5 text-xs">
                                <div className="font-medium text-foreground">• {n.title}</div>
                                {n.content && (
                                  <div className="text-muted-foreground whitespace-pre-wrap">{n.content}</div>
                                )}
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {n.tags.map((t) => (
                                    <Badge key={t} variant="secondary" className="text-[9px] h-4">{t}</Badge>
                                  ))}
                                  {n.date && (
                                    <span className="text-[10px] text-muted-foreground">{n.date}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {format !== "text" && (
                <pre className="text-[11px] font-mono whitespace-pre-wrap break-words max-h-[500px] overflow-auto bg-muted/30 p-3 rounded border">
                  {rendered}
                </pre>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return rendered; }}
                  label={`Copy ${FORMAT_LABELS[format]}`}
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return rendered; }}
                  filename={`study-notes.${ext}`}
                  mime={mime}
                  label={`Download .${ext}`}
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(notesText); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste your study notes to organize them"
          hint="One note per line: subject|topic|title|content|tags|date. Tags are comma-separated. Wrap content with pipes in quotes."
          icon={<NotebookPen className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent exports ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.noteCount} notes</Badge>
                  <Badge variant="outline" className="mr-2">{h.subjectCount} subjects</Badge>
                  <span className="text-muted-foreground">· {new Date(h.ts).toLocaleString()}</span>
                  <div className="font-mono text-[10px] text-muted-foreground mt-1 truncate">{h.preview}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> 100% client-side. All parsing, search, and export run in your browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
