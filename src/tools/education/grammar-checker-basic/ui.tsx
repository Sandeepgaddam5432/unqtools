"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { checkGrammar, summary, type GrammarIssue } from "./logic";

const TYPE_COLOR: Record<GrammarIssue["type"], string> = {
  capitalization: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  spacing: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  spelling: "bg-red-500/15 text-red-700 dark:text-red-300",
  punctuation: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  "double-word": "bg-orange-500/15 text-orange-700 dark:text-orange-300",
};

export default function GrammarCheckerBasic() {
  const [text, setText] = useState("i went to teh store , and bought 2  apples.");
  const issues = useMemo(() => checkGrammar(text), [text]);
  const s = useMemo(() => summary(issues), [issues]);

  const report = useMemo(() => {
    const lines = [
      `Total issues: ${issues.length}`,
      "",
      `Capitalization: ${s.capitalization}`,
      `Spacing: ${s.spacing}`,
      `Spelling: ${s.spelling}`,
      `Punctuation: ${s.punctuation}`,
      `Double words: ${s["double-word"]}`,
      "",
      ...issues.map((i, idx) => `${idx + 1}. [${i.type}] ${i.message}  —  "${i.excerpt}"`),
    ];
    return lines.join("\n");
  }, [issues, s]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="gc-text" className="text-xs text-muted-foreground">Text to check</Label>
          <textarea
            id="gc-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          />
          <div className="flex flex-wrap gap-2 text-[10px]">
            <Badge variant="outline" className={TYPE_COLOR.capitalization}>Capitalization: {s.capitalization}</Badge>
            <Badge variant="outline" className={TYPE_COLOR.spacing}>Spacing: {s.spacing}</Badge>
            <Badge variant="outline" className={TYPE_COLOR.spelling}>Spelling: {s.spelling}</Badge>
            <Badge variant="outline" className={TYPE_COLOR.punctuation}>Punctuation: {s.punctuation}</Badge>
            <Badge variant="outline" className={TYPE_COLOR["double-word"]}>Double words: {s["double-word"]}</Badge>
            <div className="ml-auto flex gap-2">
              <CopyButton getText={() => report} label="Copy report" />
              <DownloadButton getText={() => report} filename="grammar-report.txt" label="Download" />
            </div>
          </div>
        </CardContent>
      </Card>

      {issues.length === 0 ? (
        <Card><CardContent className="p-4"><p className="text-xs text-emerald-600">No issues detected. Looks clean!</p></CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-semibold">Issues ({issues.length})</p>
            <div className="space-y-1.5 max-h-[400px] overflow-auto">
              {issues.map((i, idx) => (
                <div key={idx} className="rounded border bg-background px-2 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${TYPE_COLOR[i.type]}`}>{i.type}</Badge>
                    <span>{i.message}</span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">"{i.excerpt}"{i.fix && <span className="ml-2 text-emerald-600">→ {i.fix}</span>}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all checks run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
