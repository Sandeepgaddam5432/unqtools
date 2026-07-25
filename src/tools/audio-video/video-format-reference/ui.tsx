"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, EmptyState } from "../../_shared";
import { getAllFormats, getFormatById, type VideoFormatInfo } from "./logic";

export default function VideoFormatReference() {
  const formats = useMemo(() => getAllFormats(), []);
  const [selected, setSelected] = useState<string>("");

  const current = useMemo(() => (selected ? getFormatById(selected) : null), [selected]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Select a format</Label>
          <div className="flex flex-wrap gap-2">
            {formats.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelected(f.id)}
                className={`px-3 py-1 text-xs rounded-md border cursor-pointer transition-colors ${
                  selected === f.id ? "border-primary bg-primary/10 text-foreground" : "border-border bg-muted/40 hover:bg-muted"
                }`}
              >
                <span className="font-medium">{f.extension}</span>
                <span className="text-muted-foreground ml-1">{f.id.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {current ? <FormatDetail info={current} /> : (
        <EmptyState
          title="Pick a video format"
          hint="View codecs, streaming support, DRM, browser compatibility, and pros/cons for each container."
        />
      )}
    </div>
  );
}

function FormatDetail({ info }: { info: VideoFormatInfo }) {
  const summary = [
    { label: "Extension", value: info.extension },
    { label: "MIME type", value: info.mimeType },
    { label: "Container", value: info.container },
    { label: "Streaming-ready", value: info.streaming ? "Yes" : "No" },
    { label: "DRM support", value: info.drm ? "Yes" : "No" },
  ];

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">{info.name}</Badge>
          {info.streaming && (
            <Badge variant="outline" className="text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Streaming</Badge>
          )}
          {info.drm && (
            <Badge variant="outline" className="text-xs border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400">DRM</Badge>
          )}
        </div>

        <div className="space-y-1">
          {summary.map((r) => (
            <div key={r.label} className="grid grid-cols-[140px_1fr_auto] gap-2 items-center text-xs py-1.5 border-b border-border/40 last:border-0">
              <span className="text-muted-foreground">{r.label}</span>
              <code className="font-mono break-all">{r.value}</code>
              <CopyButton getText={() => r.value} label="" size="icon-sm" />
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Codecs</Label>
          <div className="flex flex-wrap gap-1">
            {info.codecs.map((c) => (
              <Badge key={c} variant="outline" className="text-[10px] border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400">{c}</Badge>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-emerald-700 dark:text-emerald-400">Pros</Label>
            <ul className="text-xs space-y-1">
              {info.pros.map((p, i) => <li key={i}>+ {p}</li>)}
            </ul>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-red-700 dark:text-red-400">Cons</Label>
            <ul className="text-xs space-y-1">
              {info.cons.map((c, i) => <li key={i}>– {c}</li>)}
            </ul>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Supported platforms</Label>
          <div className="flex flex-wrap gap-1">
            {info.supportedBy.map((s) => (
              <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Common use cases</Label>
          <div className="flex flex-wrap gap-1">
            {info.useCases.map((u) => (
              <Badge key={u} variant="outline" className="text-[10px] border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">{u}</Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
