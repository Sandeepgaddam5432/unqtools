"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, EmptyState } from "../../_shared";
import { MailCheck, Play } from "lucide-react";
import {
  validateEmail,
  validateEmailList,
  resultsToCsv,
  summarize,
  type EmailResult,
} from "./logic";

export default function EmailValidatorTool() {
  const [input, setInput] = useState("user@example.com\nfirst.last+tag@example.co\nnot-an-email");
  const [results, setResults] = useState<EmailResult[] | null>(null);

  const summary = useMemo(() => (results ? summarize(results) : null), [results]);

  const run = () => {
    setResults(validateEmailList(input));
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Emails (one per line)</Label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={8}
            className="font-mono text-xs"
            placeholder="user@example.com&#10;another@example.org"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={run}>
            <Play className="h-3.5 w-3.5" /> Validate
          </Button>
          {summary && (
            <span className="text-xs text-muted-foreground">
              {summary.valid} valid · {summary.invalid} invalid of {summary.total}
            </span>
          )}
        </div>

        {results && results.length === 0 && (
          <EmptyState title="No emails to check" description="Add at least one email address." />
        )}

        {results && results.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Results</span>
              <div className="flex gap-1.5">
                <CopyButton getText={() => resultsToCsv(results)} label="Copy CSV" />
                <DownloadButton getText={() => resultsToCsv(results)} filename="email-results.csv" mime="text/csv" label="CSV" />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-xl border divide-y">
              {results.map((r, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2">
                  <span className={r.valid ? "text-emerald-600 dark:text-emerald-400 mt-0.5" : "text-rose-600 dark:text-rose-400 mt-0.5"}>
                    <MailCheck className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <span className={`text-sm font-medium break-all ${r.valid ? "" : "text-muted-foreground line-through"}`}>
                      {r.email}
                    </span>
                    {!r.valid && (
                      <p className="text-xs text-rose-600 dark:text-rose-400">{r.errors.join(" ")}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Fully offline syntax + format + TLD check. No emails are ever sent or stored.
        </p>
      </CardContent>
    </Card>
  );
}
