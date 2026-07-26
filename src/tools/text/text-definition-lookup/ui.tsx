"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  DICTIONARY, lookupWord, searchWords, formatEntry, allWords, validateWord,
  wordOfDay, dictionaryToCsv, type WordEntry,
} from "./logic";

export default function TextDefinitionLookupUI() {
  const [query, setQuery] = useState("serendipity");
  const [error, setError] = useState("");

  const entry = useMemo(() => lookupWord(query), [query]);
  const suggestions = useMemo(() => {
    if (entry) return [];
    return searchWords(query).slice(0, 8);
  }, [query, entry]);
  const wotd = useMemo(() => wordOfDay(), []);
  const allWordsList = useMemo(() => allWords(), []);

  const report = useMemo(() => (entry ? formatEntry(entry) : "No entry found."), [entry]);
  const csv = useMemo(() => dictionaryToCsv(), []);

  const onLookup = useCallback((word: string) => {
    setError("");
    const v = validateWord(word);
    if (!v.ok) {
      setError(v.reason ?? "Invalid word");
      return;
    }
    setQuery(word);
  }, []);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">Look up a word</Label>
          <div className="flex gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. serendipity" onKeyDown={(e) => { if (e.key === "Enter") onLookup(query); }} />
            <button type="button" onClick={() => onLookup(query)} className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground">Look up</button>
          </div>
          <p className="text-xs text-muted-foreground">
            Word of the day: <button type="button" onClick={() => onLookup(wotd.word)} className="text-primary underline">{wotd.word}</button> · Dictionary size: {DICTIONARY.length} entries
          </p>
        </CardContent>
      </Card>

      {entry ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-2xl font-bold">{entry.word}</h3>
                {entry.phonetic && <p className="text-sm text-muted-foreground font-mono">{entry.phonetic}</p>}
              </div>
              <div className="flex gap-2">
                <CopyButton getText={() => report} label="Copy entry" />
                <DownloadButton getText={() => report} filename={`${entry.word}.txt`} />
              </div>
            </div>
            <div className="space-y-2">
              {entry.definitions.map((d, i) => (
                <div key={i} className="rounded-md border border-border p-2">
                  <p className="text-xs italic text-muted-foreground">{d.partOfSpeech}</p>
                  <p className="text-sm">{d.text}</p>
                  {d.example && <p className="text-xs text-muted-foreground mt-1">"{d.example}"</p>}
                </div>
              ))}
            </div>
            {entry.synonyms.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Synonyms</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {entry.synonyms.map((s) => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-400">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {entry.antonyms.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Antonyms</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {entry.antonyms.map((s) => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-700 dark:text-red-400">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {entry.etymology && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Etymology</p>
                <p className="text-xs mt-1">{entry.etymology}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        suggestions.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-medium">Word not found. Did you mean…</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s: WordEntry) => (
                  <button key={s.word} type="button" onClick={() => onLookup(s.word)} className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-primary">
                    {s.word}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Browse dictionary ({allWordsList.length})</p>
            <DownloadButton getText={() => csv} filename="dictionary.csv" mime="text/csv" label="Download CSV" />
          </div>
          <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto">
            {allWordsList.map((w) => (
              <button key={w} type="button" onClick={() => onLookup(w)} className="text-xs px-2 py-0.5 rounded border border-border hover:border-primary">
                {w}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> dictionary lookups happen locally against a curated offline list of {DICTIONARY.length} entries. No network calls.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
