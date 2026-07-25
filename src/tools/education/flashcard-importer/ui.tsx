"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState } from "../../_shared";
import { parseCsv, exportAnki, exportQuizlet, exportCsv, exportJson, validateDeck } from "./logic";

type Format = "anki" | "quizlet" | "csv" | "json";

const SAMPLE = `front,back,tags
"Hello","A common greeting",greeting;basic
"Goodbye","A farewell",greeting;basic
"Photosynthesis","Process plants use to make food",science;biology`;

export default function FlashcardImporter() {
  const [input, setInput] = useState("");
  const [format, setFormat] = useState<Format>("anki");

  const result = useMemo(() => (input.trim() ? parseCsv(input) : null), [input]);
  const issues = useMemo(() => (result ? validateDeck(result) : []), [result]);

  const output = useMemo(() => {
    if (!result || result.count === 0) return "";
    switch (format) {
      case "anki": return exportAnki(result.cards);
      case "quizlet": return exportQuizlet(result.cards);
      case "csv": return exportCsv(result.cards);
      case "json": return exportJson(result.cards);
    }
  }, [result, format]);

  const fileExt = format === "anki" ? "txt" : format === "json" ? "json" : format === "csv" ? "csv" : "txt";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-2">
          <Label htmlFor="csv-input" className="text-xs text-muted-foreground">
            CSV input (header: front, back, tags)
          </Label>
          <Textarea
            id="csv-input"
            placeholder={SAMPLE}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="font-mono text-xs min-h-[160px]"
          />
          <div className="flex gap-2 text-xs">
            <button type="button" className="text-primary hover:underline cursor-pointer" onClick={() => setInput(SAMPLE)}>Load sample</button>
            <button type="button" className="text-muted-foreground hover:underline cursor-pointer" onClick={() => setInput("")}>Clear</button>
          </div>
        </CardContent>
      </Card>

      {result && result.errors.length > 0 && (
        <ErrorBanner message={`${result.errors.length} line(s) skipped: ${result.errors[0]}`} />
      )}

      {result && result.count > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">{result.count} cards</Badge>
              {issues.map((i) => (
                <Badge key={i} variant="outline" className="text-xs border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">{i}</Badge>
              ))}
              <div className="ml-auto flex items-center gap-1">
                {(["anki", "quizlet", "csv", "json"] as Format[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`px-2 py-1 text-xs rounded-md border cursor-pointer ${
                      format === f ? "border-primary bg-primary/10" : "border-border bg-muted/40 hover:bg-muted"
                    }`}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 max-h-72 overflow-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">{output}</pre>
            </div>
            <div className="flex items-center gap-2">
              <CopyButton getText={() => output} />
              <DownloadButton getText={() => output} filename={`flashcards.${fileExt}`} mime={format === "json" ? "application/json" : "text/plain"} />
            </div>
          </CardContent>
        </Card>
      )}

      {result && result.count === 0 && (
        <EmptyState title="No valid cards found" hint="Check that each line has at least 2 columns separated by commas." />
      )}

      {!result && (
        <EmptyState
          title="Paste CSV flashcards to convert"
          hint="Convert between Anki (TSV), Quizlet (TSV), CSV, and JSON formats. Quoted fields with commas are supported."
        />
      )}
    </div>
  );
}
