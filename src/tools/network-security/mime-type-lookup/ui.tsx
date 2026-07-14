"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { search, detectFromFilename, CATEGORY_COLORS, type MimeCategory, type MimeEntry } from "./logic";
import { Search, FileText } from "lucide-react";

export default function MimeTypeLookup() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => search(query), [query]);

  const detected = useMemo(() => {
    if (!query.trim() || !query.includes(".")) return null;
    return detectFromFilename(query);
  }, [query]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-2">
          <Label htmlFor="mime-search" className="text-xs text-muted-foreground">
            Search by MIME type, extension, or filename
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="mime-search"
              placeholder="e.g. image/png, .jpg, photo.jpg, json"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 font-mono text-sm"
              aria-label="Search MIME types"
            />
          </div>
        </CardContent>
      </Card>

      {detected && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Filename detected as:</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`font-mono ${CATEGORY_COLORS[detected.category]}`}>
                    {detected.mimeType}
                  </Badge>
                  <span className="text-sm">{detected.description}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {detected.isBinary ? "binary" : "text"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">
              {results.length} {results.length === 1 ? "type" : "types"}
            </Label>
          </div>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {results.map((m) => (
              <MimeRow key={m.mimeType} entry={m} />
            ))}
            {results.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No MIME types match your search.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> lookup is
            local — no network requests.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MimeRow({ entry }: { entry: MimeEntry }) {
  return (
    <div className="rounded-md border p-3 hover:bg-muted/30 transition-colors">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <Badge variant="outline" className={`font-mono text-xs ${CATEGORY_COLORS[entry.category]}`}>
          {entry.mimeType}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {entry.isBinary ? "binary" : "text"}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-1">{entry.description}</p>
      {entry.extensions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {entry.extensions.map((ext) => (
            <code
              key={ext}
              className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground font-mono"
            >
              .{ext}
            </code>
          ))}
        </div>
      )}
      {entry.aliases && entry.aliases.length > 0 && (
        <div className="mt-1.5 text-[10px] text-muted-foreground">
          Aliases: {entry.aliases.map((a) => (
            <code key={a} className="font-mono">{a}</code>
          )).reduce((acc: React.ReactNode[], el, i) => {
            if (i === 0) return [el];
            return [...acc, ", ", el];
          }, [])}
        </div>
      )}
    </div>
  );
}
