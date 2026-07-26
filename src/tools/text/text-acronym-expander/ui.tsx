"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  DEFAULT_DICTIONARY,
  buildDictionary,
  expandInline,
  batchExpand,
  buildGlossary,
  analyzeAcronyms,
  parseCustomDictionary,
  validateEntry,
  exportCsv,
  glossaryToMarkdown,
} from "./logic";

export default function AcronymExpanderUI() {
  const [text, setText] = useState(
    "NASA uses AI and ML APIs. The FBI and CIA report to the DOD. ASAP, send the FAQ to the CEO.",
  );
  const [customDict, setCustomDict] = useState("XYZ = eXample Zebras Yelling\nFOO,First Of Object");
  const [keepAcronym, setKeepAcronym] = useState(false);

  const mergedDict = useMemo(() => {
    const custom = parseCustomDictionary(customDict);
    const all = [...DEFAULT_DICTIONARY, ...custom];
    return buildDictionary(all);
  }, [customDict]);

  const expanded = useMemo(() => expandInline(text, mergedDict, { keepAcronym }), [text, mergedDict, keepAcronym]);
  const batched = useMemo(() => batchExpand(text, mergedDict, keepAcronym), [text, mergedDict, keepAcronym]);
  const glossary = useMemo(() => buildGlossary(text, mergedDict), [text, mergedDict]);
  const stats = useMemo(() => analyzeAcronyms(text, mergedDict), [text, mergedDict]);

  const validationErrors = useMemo(() => {
    const custom = parseCustomDictionary(customDict);
    return custom.flatMap((e, i) => validateEntry(e).map((err) => `Row ${i + 1}: ${err}`));
  }, [customDict]);

  const csv = useMemo(() => exportCsv(glossary.map((g) => ({ acronym: g.acronym, expansion: g.expansion, category: g.category }))), [glossary]);
  const md = useMemo(() => glossaryToMarkdown(glossary), [glossary]);

  return (
    <div className="space-y-4">
      {validationErrors.length > 0 && <ErrorBanner message={validationErrors.join("; ")} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">Input text</Label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full min-h-[120px] rounded-md border bg-background p-2 text-sm"
            aria-label="Input text"
          />
          <div className="flex flex-wrap gap-2 items-center">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={keepAcronym}
                onChange={(e) => setKeepAcronym(e.target.checked)}
              />
              Keep original acronym (e.g. "NASA (National Aeronautics…)")
            </label>
            <CopyButton getText={() => expanded} label="Copy expanded" />
            <DownloadButton getText={() => expanded} filename="expanded.txt" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">Expanded output</Label>
          <pre className="w-full min-h-[100px] rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{expanded}</pre>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">Statistics</p>
            <div className="text-sm space-y-1">
              <p>Total acronyms: <span className="font-bold">{stats.total}</span></p>
              <p>Unique: <span className="font-bold">{stats.unique}</span></p>
              <p>Recognized: <span className="font-bold text-emerald-600">{stats.recognized}</span></p>
              <p>Unrecognized: <span className="font-bold text-amber-600">{stats.unrecognized}</span></p>
            </div>
            {stats.unrecognizedList.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">Unrecognized:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {stats.unrecognizedList.map((a) => (
                    <span key={a} className="px-1.5 py-0.5 text-xs rounded bg-amber-500/15 text-amber-700 dark:text-amber-400">{a}</span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">Custom dictionary</p>
            <p className="text-xs text-muted-foreground">Format: <code>ACRONYM = Expansion</code> or <code>ACRONYM,Expansion</code></p>
            <textarea
              value={customDict}
              onChange={(e) => setCustomDict(e.target.value)}
              className="w-full min-h-[120px] rounded-md border bg-background p-2 font-mono text-xs"
              aria-label="Custom dictionary"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">Glossary ({glossary.length})</p>
            <div className="text-xs space-y-1 max-h-[200px] overflow-y-auto">
              {glossary.map((g) => (
                <div key={g.acronym} className="border-b border-border/30 py-1">
                  <span className="font-mono font-bold">{g.acronym}</span>{" "}
                  <span className="text-muted-foreground">×{g.count}</span>
                  <p className="text-foreground">{g.expansion}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-medium">Export</p>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => csv} label="Copy CSV" />
            <DownloadButton getText={() => csv} filename="glossary.csv" />
            <CopyButton getText={() => md} label="Copy Markdown" />
            <DownloadButton getText={() => md} filename="glossary.md" />
          </div>
          <pre className="w-full text-xs bg-muted/30 rounded-md p-2 max-h-[160px] overflow-auto whitespace-pre">{md}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all expansion happens locally. Built-in dictionary includes 80+ common acronyms; add your own via the custom dictionary panel.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
