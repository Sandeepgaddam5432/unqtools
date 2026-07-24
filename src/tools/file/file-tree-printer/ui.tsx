"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { buildTreeFromPaths, printTree, treeToCsv, treeToJson, COMMON_IGNORES, type TreeOptions } from "./logic";

export default function FileTreePrinter() {
  const [tree, setTree] = useState<{ name: string; size: number; isDirectory: boolean; children?: unknown[] } | null>(null);
  const [options, setOptions] = useState<TreeOptions>({
    style: "unicode",
    maxDepth: 100,
    includeHidden: false,
    showSize: false,
    sort: "name",
    excludes: [...COMMON_IGNORES],
    markdownWrap: false,
  });
  const [result, setResult] = useState<ReturnType<typeof printTree> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"text" | "csv" | "json">("text");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const paths: { path: string; size: number }[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i]!;
        // webkitRelativePath is set when using webkitdirectory
        const path = (f as unknown as { webkitRelativePath?: string }).webkitRelativePath || f.name;
        paths.push({ path, size: f.size });
      }
      const built = buildTreeFromPaths(paths);
      // Rename root to folder name
      const rootName = paths[0]!.path.split("/")[0] || "root";
      setTree({ ...built, name: rootName } as typeof tree);
      setError(null);
    } catch (e) {
      setError(`Failed to read files: ${(e as Error).message}`);
    }
  }, []);

  const generate = useCallback(() => {
    if (!tree) {
      setError("Pick a folder first.");
      return;
    }
    const r = printTree(tree as never, options);
    setResult(r);
    setError(null);
  }, [tree, options]);

  const getExportText = useCallback((): string => {
    if (!tree) return "";
    if (exportFormat === "csv") return treeToCsv(tree as never, options);
    if (exportFormat === "json") return treeToJson(tree as never, options);
    return result?.text ?? "";
  }, [tree, result, options, exportFormat]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              ref={inputRef}
              type="file"
              // @ts-expect-error webkitdirectory is non-standard
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button size="sm" onClick={() => inputRef.current?.click()}>Pick folder</Button>
            <Button size="sm" variant="ghost" onClick={() => { setTree(null); setResult(null); setError(null); }}>Clear</Button>
            {tree && <Badge variant="outline">Folder: {tree.name}</Badge>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Tree style</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={options.style} onChange={(e) => setOptions({ ...options, style: e.target.value as TreeOptions["style"] })}>
                <option value="unicode">Unicode (├── └──)</option>
                <option value="ascii">ASCII (|-- `--)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Max depth</Label>
              <Input type="number" min="1" value={options.maxDepth} onChange={(e) => setOptions({ ...options, maxDepth: Number(e.target.value) })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Sort by</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={options.sort} onChange={(e) => setOptions({ ...options, sort: e.target.value as TreeOptions["sort"] })}>
                <option value="name">Name (A-Z)</option>
                <option value="size">Size (largest first)</option>
                <option value="type">Type (extension)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Exclude patterns (comma-separated)</Label>
              <Input value={(options.excludes ?? []).join(", ")} onChange={(e) => setOptions({ ...options, excludes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.includeHidden ?? false} onChange={(e) => setOptions({ ...options, includeHidden: e.target.checked })} /><span>Show hidden files (.dotfiles)</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.showSize ?? false} onChange={(e) => setOptions({ ...options, showSize: e.target.checked })} /><span>Show file sizes</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.markdownWrap ?? false} onChange={(e) => setOptions({ ...options, markdownWrap: e.target.checked })} /><span>Wrap in markdown fence</span></label>
          </div>

          <Button size="sm" variant="ghost" onClick={() => setOptions({ ...options, excludes: [...COMMON_IGNORES] })}>Reset excludes to common preset</Button>

          <div className="flex gap-2">
            <Button size="sm" onClick={generate} disabled={!tree}>Generate tree</Button>
            <Button size="sm" variant="ghost" onClick={() => setExportFormat("text")} disabled={!result}>Export: Text</Button>
            <Button size="sm" variant="ghost" onClick={() => setExportFormat("csv")} disabled={!tree}>Export: CSV</Button>
            <Button size="sm" variant="ghost" onClick={() => setExportFormat("json")} disabled={!tree}>Export: JSON</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Files</p><p className="text-lg font-bold">{result.fileCount}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Directories</p><p className="text-lg font-bold">{result.dirCount}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total size</p><p className="text-lg font-bold">{(result.totalSize / 1024).toFixed(1)} KB</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Truncated</p><p className="text-lg font-bold">{result.truncated ? "Yes" : "No"}</p></CardContent></Card>
          </div>

          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>)}
            </CardContent></Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Output ({exportFormat})</CardTitle>
                <div className="flex gap-2">
                  <CopyButton getText={getExportText} />
                  <DownloadButton getText={getExportText} filename={`file-tree.${exportFormat === "text" ? "txt" : exportFormat}`} mime={exportFormat === "json" ? "application/json" : exportFormat === "csv" ? "text/csv" : "text/plain"} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="text-xs overflow-x-auto p-4 bg-muted/40 rounded-b-lg max-h-[500px] overflow-auto"><code>{getExportText()}</code></pre>
            </CardContent>
          </Card>
        </>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> folder is read locally via webkitdirectory. Nothing is uploaded. Works best in Chrome/Edge.</p></CardContent></Card>
    </div>
  );
}
