"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  ELEMENTS,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  searchElements,
  filterByCategory,
  formatElement,
  getCategoryColor,
  listCategoriesWithCounts,
  findNeighbors,
  validateCompoundFormula,
  renderTextTable,
  renderCsv,
  renderJson,
  renderElementJson,
  computeSummaryStats,
  getByAtomicNumber,
  saveHistory,
  clearHistory,
  loadHistory,
  buildShareUrl,
  parseShareUrl,
  type ElementCategory,
  type Element,
  type HistoryEntry,
} from "./logic";
import { Atom, History, Search, X, FlaskConical } from "lucide-react";

export default function PeriodicTableReference() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ElementCategory | "">("");
  const [selectedZ, setSelectedZ] = useState<number>(0);
  const [compoundInput, setCompoundInput] = useState("H2O");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.z > 0) {
        setSelectedZ(p.z);
        toast.info("Loaded element from share link");
      }
    }
  }, []);

  const filtered = useMemo(
    () => filterByCategory(category, searchElements(query)),
    [query, category],
  );
  const categories = useMemo(() => listCategoriesWithCounts(), []);
  const stats = useMemo(() => computeSummaryStats(), []);
  const selected = useMemo(
    () => (selectedZ > 0 ? getByAtomicNumber(selectedZ) : null),
    [selectedZ],
  );
  const selectedNeighbors = useMemo(
    () => (selected ? findNeighbors(selected) : null),
    [selected],
  );
  const selectedFormatted = useMemo(
    () => (selected ? formatElement(selected) : null),
    [selected],
  );
  const compoundResult = useMemo(
    () => validateCompoundFormula(compoundInput),
    [compoundInput],
  );

  const handleSelectElement = useCallback((el: Element) => {
    setSelectedZ(el.z);
    saveHistory({ ts: Date.now(), z: el.z, symbol: el.symbol, name: el.name });
    setHistory(loadHistory());
  }, []);

  const handleClear = useCallback(() => {
    setQuery("");
    setCategory("");
    setSelectedZ(0);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const textTable = useMemo(() => renderTextTable(filtered), [filtered]);
  const csv = useMemo(() => renderCsv(filtered), [filtered]);
  const json = useMemo(() => renderJson(filtered), [filtered]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pt-search" className="text-xs">Search</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="pt-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="name, symbol, or atomic number (e.g. oxygen, O, 8)"
                  className="pl-8 text-xs h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pt-cat" className="text-xs">Filter by category</Label>
              <select
                id="pt-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as ElementCategory | "")}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.category} value={c.category}>
                    {c.label} ({c.count})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c.category}
                onClick={() => setCategory(category === c.category ? "" : c.category)}
                className="flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] hover:bg-accent"
                style={{ borderColor: c.color }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                {c.label} ({c.count})
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Atom className="h-4 w-4" /> Periodic Table — {filtered.length} / 118 elements
            </h3>
            <div className="flex flex-wrap gap-1.5">
              <CopyButton getText={() => textTable} label="Copy table" />
              <DownloadButton getText={() => textTable} filename="periodic-table.txt" label=".txt" />
              <DownloadButton getText={() => csv} filename="periodic-table.csv" mime="text/csv" label=".csv" />
              <DownloadButton getText={() => json} filename="periodic-table.json" mime="application/json" label=".json" />
              <ShareButton getUrl={() => selectedZ > 0 ? buildShareUrl(selectedZ) : buildShareUrl(0)} />
              <ClearButton onClick={handleClear} />
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="No elements match"
              hint="Try a different search or category filter."
              icon={<Search className="h-8 w-8" />}
            />
          ) : (
            <div className="grid grid-cols-[repeat(18,minmax(0,1fr))] gap-0.5 overflow-x-auto pb-2">
              {renderPeriodicGrid(filtered, handleSelectElement, selectedZ, category)}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && selectedFormatted && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: getCategoryColor(selected.category) }}
                />
                {selectedFormatted.header}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedZ(0)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                {selectedFormatted.details.map((d, i) => (
                  <div key={i} className="text-xs font-mono text-foreground">{d}</div>
                ))}
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Neighbors</div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <NeighborTile label="Up" el={selectedNeighbors?.up ?? null} onSelect={handleSelectElement} />
                    <NeighborTile label="Down" el={selectedNeighbors?.down ?? null} onSelect={handleSelectElement} />
                    <NeighborTile label="Left" el={selectedNeighbors?.left ?? null} onSelect={handleSelectElement} />
                    <NeighborTile label="Right" el={selectedNeighbors?.right ?? null} onSelect={handleSelectElement} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <CopyButton getText={() => renderElementJson(selected)} label="Copy JSON" />
                  <DownloadButton getText={() => renderElementJson(selected)} filename={`element-${selected.symbol.toLowerCase()}.json`} mime="application/json" label="Download JSON" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <FlaskConical className="h-4 w-4" /> Compound Formula Validator
          </h3>
          <Input
            value={compoundInput}
            onChange={(e) => setCompoundInput(e.target.value)}
            placeholder="e.g. H2O, NaCl, Ca(OH)2, H2SO4"
            className="text-xs font-mono h-9"
          />
          {compoundResult.valid ? (
            <div className="space-y-1">
              <Badge className="bg-emerald-600">Valid formula</Badge>
              <div className="flex flex-wrap gap-1.5">
                {compoundResult.tokens.map((t, i) => (
                  <Badge key={i} variant="outline" className="text-[11px] font-mono">
                    {t.symbol}: {t.count}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <Badge className="bg-red-600">Invalid: {compoundResult.error}</Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Atom className="h-4 w-4" /> Summary Statistics
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Total elements" value={stats.totalElements} />
            <Stat label="Categories" value={stats.byCategory.length} />
            <Stat label="Avg atomic mass" value={stats.avgMass.toFixed(2)} />
            <Stat label="Avg electronegativity" value={stats.avgElectronegativity?.toFixed(2) ?? "n/a"} />
            <Stat label="Lightest" value={stats.lightest ? `${stats.lightest.symbol} (${stats.lightest.mass})` : "-"} />
            <Stat label="Heaviest" value={stats.heaviest ? `${stats.heaviest.symbol} (${stats.heaviest.mass})` : "-"} />
            <Stat label="Most electronegative" value={stats.mostElectronegative?.symbol ?? "-"} />
            <Stat label="Oldest discovered (numbered year)" value={stats.oldestDiscovery ? `${stats.oldestDiscovery.symbol} (${stats.oldestDiscovery.discoveredYear})` : "-"} />
          </div>
          <div className="space-y-1 pt-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">By category</div>
            <div className="flex flex-wrap gap-1.5">
              {stats.byCategory.map((c) => (
                <Badge key={c.category} variant="outline" className="text-[10px] gap-1">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  {c.label}: {c.count}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recently viewed ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {history.slice(0, 10).map((h) => (
                <button
                  key={`${h.z}-${h.ts}`}
                  onClick={() => {
                    const el = getByAtomicNumber(h.z);
                    if (el) handleSelectElement(el);
                  }}
                  className="rounded border bg-background px-2 py-1 text-xs font-mono hover:bg-accent"
                >
                  {h.symbol} <span className="text-muted-foreground">({h.z})</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All element data is built-in and lives in the page. Your viewing history never leaves your browser — stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Render the periodic table as a CSS grid with 18 columns.
 *  f-block (lanthanides/actinides) shown in a separate row below. */
function renderPeriodicGrid(
  elements: Element[],
  onSelect: (el: Element) => void,
  selectedZ: number,
  activeCategory: ElementCategory | "",
): React.ReactNode {
  const main: Element[] = [];
  const fBlock: Element[] = [];
  for (const e of elements) {
    if (e.category === "lanthanide" || e.category === "actinide") {
      fBlock.push(e);
    } else {
      main.push(e);
    }
  }

  const cells: React.ReactNode[] = [];
  // 7 rows × 18 cols main grid
  const grid: (Element | null)[][] = Array.from({ length: 7 }, () => Array<Element | null>(18).fill(null));
  for (const e of main) {
    if (e.period >= 1 && e.period <= 7 && e.group >= 1 && e.group <= 18) {
      grid[e.period - 1][e.group - 1] = e;
    }
  }
  for (let p = 0; p < 7; p++) {
    for (let g = 0; g < 18; g++) {
      const el = grid[p][g];
      if (el) {
        cells.push(
          <ElementTile
            key={`m-${el.z}`}
            el={el}
            selected={el.z === selectedZ}
            dimmed={!!activeCategory && el.category !== activeCategory}
            onClick={() => onSelect(el)}
          />,
        );
      } else {
        cells.push(<div key={`empty-${p}-${g}`} className="aspect-square min-h-[28px]" />);
      }
    }
  }
  // Spacer row + f-block rows
  if (fBlock.length > 0) {
    cells.push(<div key="spacer" className="col-span-18 h-2" />);
    const lanth = fBlock.filter((e) => e.category === "lanthanide");
    const actin = fBlock.filter((e) => e.category === "actinide");
    // Place lanthanides in cols 4-15 (15..26 index 3..14) row 8
    for (let i = 0; i < 18; i++) {
      const idx = i - 3;
      const el = idx >= 0 && idx < lanth.length ? lanth[idx] : null;
      if (el) {
        cells.push(
          <ElementTile
            key={`l-${el.z}`}
            el={el}
            selected={el.z === selectedZ}
            dimmed={!!activeCategory && el.category !== activeCategory}
            onClick={() => onSelect(el)}
          />,
        );
      } else {
        cells.push(<div key={`l-empty-${i}`} className="aspect-square min-h-[28px]" />);
      }
    }
    for (let i = 0; i < 18; i++) {
      const idx = i - 3;
      const el = idx >= 0 && idx < actin.length ? actin[idx] : null;
      if (el) {
        cells.push(
          <ElementTile
            key={`a-${el.z}`}
            el={el}
            selected={el.z === selectedZ}
            dimmed={!!activeCategory && el.category !== activeCategory}
            onClick={() => onSelect(el)}
          />,
        );
      } else {
        cells.push(<div key={`a-empty-${i}`} className="aspect-square min-h-[28px]" />);
      }
    }
  }
  return cells;
}

function ElementTile({
  el,
  selected,
  dimmed,
  onClick,
}: {
  el: Element;
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  const color = CATEGORY_COLORS[el.category];
  return (
    <button
      onClick={onClick}
      title={`${el.name} (${el.z})`}
      className={`relative aspect-square min-h-[28px] rounded-sm border text-center transition-colors hover:scale-110 hover:z-10 ${selected ? "ring-2 ring-foreground" : ""} ${dimmed ? "opacity-30" : ""}`}
      style={{ backgroundColor: color + "40", borderColor: color }}
    >
      <div className="text-[7px] leading-none text-muted-foreground absolute top-0.5 left-0.5">{el.z}</div>
      <div className="text-[10px] font-bold leading-none text-foreground absolute inset-0 flex items-center justify-center">
        {el.symbol}
      </div>
    </button>
  );
}

function NeighborTile({
  label,
  el,
  onSelect,
}: {
  label: string;
  el: Element | null;
  onSelect: (el: Element) => void;
}) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {el ? (
        <button
          onClick={() => onSelect(el)}
          className="text-xs font-mono text-foreground hover:text-primary hover:underline"
        >
          {el.symbol} <span className="text-muted-foreground">({el.z})</span>
        </button>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
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
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

// Re-export for type compatibility
export type { ElementCategory, Element };
