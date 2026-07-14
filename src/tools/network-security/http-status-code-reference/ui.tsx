"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { search, byCategory, CATEGORY_LABELS, CATEGORY_COLORS, type StatusCodeCategory, type StatusCodeInfo } from "./logic";
import { Search } from "lucide-react";

const CATEGORIES: StatusCodeCategory[] = ["1xx", "2xx", "3xx", "4xx", "5xx"];

export default function HttpStatusCodeReference() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusCodeCategory | "all">("all");

  const results = useMemo(() => {
    let list = search(query);
    if (filter !== "all") list = list.filter((s) => s.category === filter);
    return list;
  }, [query, filter]);

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
              <StatusCodeRow key={s.code} info={s} />
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

function StatusCodeRow({ info }: { info: StatusCodeInfo }) {
  return (
    <div className="rounded-md border p-3 hover:bg-muted/30 transition-colors">
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
      </div>
      <p className="text-xs text-muted-foreground mb-1.5">{info.description}</p>
      <p className="text-[11px] text-muted-foreground/80">
        <strong className="text-foreground/80">Use case:</strong> {info.useCase}
      </p>
    </div>
  );
}
