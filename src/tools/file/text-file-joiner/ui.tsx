"use client";
import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState } from "../../_shared";
import {
  computeStats, joinFiles, previewLines, formatBytes, detectTextType,
  loadHistory, saveToHistory, clearHistory,
  DEFAULT_OPTIONS,
  type JoinOptions, type SeparatorMode, type TextJoinHistoryEntry,
} from "./logic";
import { Upload, FileText, ArrowUp, ArrowDown, X, History, FilePlus2 } from "lucide-react";

interface FileEntry {
  name: string;
  size: number;
  content: string;
}

export default function TextFileJoiner() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [options, setOptions] = useState<JoinOptions>(DEFAULT_OPTIONS);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<TextJoinHistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);

  const handleFiles = useCallback(async (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return;
    setError(null);
    setWorking(true);
    try {
      const entries: FileEntry[] = [];
      for (const file of Array.from(newFiles)) {
        const text = await file.text();
        entries.push({ name: file.name, size: file.size, content: text });
      }
      setFiles((prev) => [...prev, ...entries]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }, []);

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const moveFile = (idx: number, dir: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const update = <K extends keyof JoinOptions>(key: K, value: JoinOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const merged = useMemo(() => {
    if (files.length === 0) return null;
    return joinFiles(files.map((f) => ({ name: f.name, content: f.content })), options);
  }, [files, options]);

  const preview = merged ? previewLines(merged.text, 200) : "";

  const onMerge = () => {
    if (!merged) return;
    const entry: TextJoinHistoryEntry = {
      fileNames: files.map((f) => f.name),
      separator: options.separator,
      addHeaders: options.addFilenameHeaders,
      lineNumbers: options.addLineNumbers,
      mergedAt: new Date().toISOString(),
      totalCharacters: merged.totalCharacters,
    };
    setHistory(saveToHistory(entry));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            multiple
            accept=".txt,.log,.md,.markdown,.csv,.tsv,.json,.xml,.html,.css,.js,.ts,.py,.sh,.yaml,.yml,.ini,.conf,text/*"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="text-join-input"
            aria-label="Choose text files to merge"
          />
          <button
            type="button"
            onClick={() => document.getElementById("text-join-input")?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop text files here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">.txt · .log · .md · .csv · .json · and more</p>
          </button>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Files ({files.length})</Label>
              <button type="button" onClick={() => setShowHistory(!showHistory)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1">
                <History className="h-3 w-3" /> History ({history.length})
              </button>
            </div>
            {files.map((f, i) => {
              const stats = computeStats(f.name, f.size, f.content);
              return (
                <div key={i} className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => moveFile(i, -1)} disabled={i === 0} aria-label="Move up" className="p-0.5 hover:text-foreground cursor-pointer disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                    <button type="button" onClick={() => moveFile(i, 1)} disabled={i === files.length - 1} aria-label="Move down" className="p-0.5 hover:text-foreground cursor-pointer disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium"><FileText className="inline h-3 w-3 mr-1" />{f.name}</p>
                    <p className="text-[10px] text-muted-foreground">{detectTextType(f.name)} · {stats.lines} lines · {stats.words} words · {stats.characters} chars</p>
                  </div>
                  <Badge variant="outline" className="text-[9px]">{formatBytes(f.size)}</Badge>
                  <button type="button" onClick={() => removeFile(i)} aria-label={`Remove ${f.name}`} className="p-0.5 text-muted-foreground hover:text-red-600 cursor-pointer"><X className="h-3 w-3" /></button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {files.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-semibold">Merge options</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Separator</label>
                <select value={options.separator} onChange={(e) => update("separator", e.target.value as SeparatorMode)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Separator mode">
                  <option value="newline">Single newline</option>
                  <option value="double">Double newline (blank line)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              {options.separator === "custom" && (
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Custom separator (use \n for newline)</label>
                  <Input value={options.customSeparator} onChange={(e) => update("customSeparator", e.target.value.replace(/\\n/g, "\n"))} placeholder="---" className="h-8 text-xs" aria-label="Custom separator" />
                </div>
              )}
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={options.addFilenameHeaders} onChange={(e) => update("addFilenameHeaders", e.target.checked)} className="cursor-pointer" />
                <span>Add filename headers</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={options.addLineNumbers} onChange={(e) => update("addLineNumbers", e.target.checked)} className="cursor-pointer" />
                <span>Add line numbers</span>
              </label>
              {options.addLineNumbers && (
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Number format</label>
                  <select value={options.numberFormat} onChange={(e) => update("numberFormat", e.target.value as "%d" | "%03d" | "%05d")} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Number format">
                    <option value="%d">1, 2, 3</option>
                    <option value="%03d">001, 002, 003</option>
                    <option value="%05d">00001, 00002</option>
                  </select>
                </div>
              )}
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={options.removeEmptyLines} onChange={(e) => update("removeEmptyLines", e.target.checked)} className="cursor-pointer" />
                <span>Remove empty lines</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={options.trimWhitespace} onChange={(e) => update("trimWhitespace", e.target.checked)} className="cursor-pointer" />
                <span>Trim whitespace</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={options.dedupLines} onChange={(e) => update("dedupLines", e.target.checked)} className="cursor-pointer" />
                <span>Dedup lines</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={options.sortLines} onChange={(e) => update("sortLines", e.target.checked)} className="cursor-pointer" />
                <span>Sort lines</span>
                <select value={options.sortDirection} onChange={(e) => update("sortDirection", e.target.value as "asc" | "desc")} disabled={!options.sortLines} className="h-7 rounded-md border border-input bg-background px-1 text-xs cursor-pointer disabled:opacity-50" aria-label="Sort direction">
                  <option value="asc">asc</option>
                  <option value="desc">desc</option>
                </select>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {merged && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-semibold">Stats</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Files</p><p className="font-mono font-semibold">{merged.fileCount}</p></div>
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Total lines</p><p className="font-mono font-semibold">{merged.totalLines}</p></div>
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Total words</p><p className="font-mono font-semibold">{merged.totalWords}</p></div>
                <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Output size</p><p className="font-mono font-semibold">{formatBytes(merged.totalCharacters)}</p></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Preview (first 200 lines)</Label>
                <div className="flex gap-2">
                  <CopyButton getText={() => merged.text} label="Copy" size="sm" />
                  <DownloadButton getText={() => merged.text} filename="merged.txt" label="Download" size="sm" />
                  <button type="button" onClick={onMerge} className="text-xs text-primary hover:underline cursor-pointer">Save to history</button>
                </div>
              </div>
              <Textarea
                value={preview}
                readOnly
                className="min-h-[240px] font-mono text-xs resize-y"
                aria-label="Merged preview"
              />
            </CardContent>
          </Card>

          {showHistory && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">History ({history.length})</Label>
                  {history.length > 0 && (
                    <button type="button" onClick={() => { clearHistory(); setHistory([]); }} className="text-xs text-red-600 hover:underline cursor-pointer">Clear</button>
                  )}
                </div>
                {history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No history yet.</p>
                ) : (
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {history.map((h, i) => (
                      <div key={i} className="text-xs py-1 border-b border-border/40 last:border-0">
                        <p className="font-medium">{h.fileNames.join(" + ")}</p>
                        <p className="text-[10px] text-muted-foreground">{h.separator} · headers: {h.addHeaders ? "yes" : "no"} · numbers: {h.lineNumbers ? "yes" : "no"} · {formatBytes(h.totalCharacters)} · {new Date(h.mergedAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {working && (
        <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
          Reading files...
        </CardContent></Card>
      )}

      {error && <ErrorBanner message={error} />}

      {!files.length && !error && (
        <EmptyState title="Drop text files to merge" hint="Custom separators · filename headers · line numbering · dedup · sort · stats. 100% local." icon={<FilePlus2 className="h-8 w-8" />} />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all reading and merging runs in your browser. Files never leave your device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
