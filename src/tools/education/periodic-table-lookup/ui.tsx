"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { ELEMENTS, search, toMarkdown, type Element } from "./logic";

const CATEGORY_COLORS: Record<string, string> = {
  "nonmetal": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "noble gas": "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  "alkali metal": "bg-red-500/15 text-red-700 dark:text-red-300",
  "alkaline earth metal": "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  "transition metal": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "post-transition metal": "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  "metalloid": "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  "halogen": "bg-pink-500/15 text-pink-700 dark:text-pink-300",
};

export default function PeriodicTableLookup() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Element | null>(null);
  const results = useMemo(() => search(query), [query]);
  const md = useMemo(() => (selected ? toMarkdown(selected) : ""), [selected]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="ptl-search" className="text-xs text-muted-foreground">Search by name, symbol, number, or category</Label>
          <Input id="ptl-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Iron, Fe, 26, noble gas" className="font-mono" />
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-mono font-bold">{selected.symbol}</span>
              <div>
                <p className="text-sm font-semibold">{selected.name}</p>
                <p className="text-[10px] text-muted-foreground">#{selected.number}</p>
              </div>
              <Badge variant="outline" className={`ml-auto text-[10px] ${CATEGORY_COLORS[selected.category] ?? ""}`}>{selected.category}</Badge>
              <div className="flex gap-2">
                <CopyButton getText={() => md} label="Copy MD" />
                <DownloadButton getText={() => md} filename={`element-${selected.symbol.toLowerCase()}.md`} mime="text/markdown" label="Download" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Cell label="Atomic number" value={String(selected.number)} />
              <Cell label="Atomic mass" value={`${selected.atomicMass} u`} />
              <Cell label="Group" value={String(selected.group ?? "n/a")} />
              <Cell label="Period" value={String(selected.period)} />
            </div>
            <div className="rounded border bg-muted/30 p-2 text-xs">
              <span className="text-muted-foreground">Electron configuration:</span>{" "}
              <span className="font-mono">{selected.electronConfig}</span>
            </div>
            <p className="text-xs text-muted-foreground">{selected.summary}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-semibold">All elements ({results.length})</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
            {results.map((e) => (
              <button
                key={e.number}
                onClick={() => setSelected(e)}
                className={`rounded border p-2 text-left hover:bg-muted/40 ${selected?.number === e.number ? "border-primary" : "bg-background"}`}
              >
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] text-muted-foreground">{e.number}</span>
                  <span className="font-mono font-bold">{e.symbol}</span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{e.name}</p>
                <Badge variant="outline" className={`mt-1 text-[9px] ${CATEGORY_COLORS[e.category] ?? ""}`}>{e.category}</Badge>
              </button>
            ))}
            {results.length === 0 && <p className="text-xs text-muted-foreground">No matches.</p>}
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> static reference data; all search runs locally.</p></CardContent></Card>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}
