import { useMemo, useState } from "preact/hooks";
import {
  Textarea,
  Button,
  Card,
  CopyButton,
  DownloadButton,
  ToastContainer,
  toast,
  Switch,
  Select,
} from "../../../components/ui";
import { removeDuplicateLines, DEFAULT_OPTIONS, type DedupeOptions } from "./logic";

const KEEP_OPTIONS = [
  { value: "first", label: "Keep first" },
  { value: "last", label: "Keep last" },
];
const SORT_OPTIONS = [
  { value: "alphabetical", label: "Alphabetical" },
  { value: "numeric", label: "Numeric" },
  { value: "length", label: "Length" },
  { value: "locale", label: "Locale" },
];

export default function DuplicateLinesRemover() {
  const [input, setInput] = useState("");
  const [opts, setOpts] = useState<DedupeOptions>(DEFAULT_OPTIONS);
  const result = useMemo(() => removeDuplicateLines(input, opts), [input, opts]);
  const update = (p: Partial<DedupeOptions>) => setOpts((o) => ({ ...o, ...p }));

  return (
    <div class="space-y-4">
      <ToastContainer />
      <Textarea
        id="dl-input"
        label="Input lines"
        placeholder="One item per line…"
        value={input}
        onInput={(e) => setInput((e.currentTarget as HTMLTextAreaElement).value)}
        hint={`${input.split("\n").length} lines`}
        class="min-h-[160px] resize-y font-mono text-sm"
      />
      <Card class="flex flex-wrap gap-4 !p-4">
        <Switch
          checked={opts.caseSensitive}
          onChange={(v) => update({ caseSensitive: v })}
          label="Case sensitive"
        />
        <Switch
          checked={opts.trim}
          onChange={(v) => update({ trim: v })}
          label="Trim before comparing"
        />
        <Switch checked={opts.sort} onChange={(v) => update({ sort: v })} label="Sort result" />
        {opts.sort && (
          <div class="flex flex-col gap-1.5">
            <label for="dl-sort" class="text-sm font-medium text-fg">
              Sort by
            </label>
            <Select
              id="dl-sort"
              value={opts.sortMode}
              onChange={(v) => update({ sortMode: v as DedupeOptions["sortMode"] })}
              options={SORT_OPTIONS}
              class="w-36"
            />
          </div>
        )}
        <div class="flex flex-col gap-1.5">
          <label for="dl-keep" class="text-sm font-medium text-fg">
            Keep
          </label>
          <Select
            id="dl-keep"
            value={opts.keep}
            onChange={(v) => update({ keep: v as "first" | "last" })}
            options={KEEP_OPTIONS}
            class="w-32"
          />
        </div>
      </Card>
      <Button
        variant="ghost"
        onClick={() => {
          setInput("apple\nbanana\napple\ncherry\nbanana\ndate");
          toast("Sample loaded", "info");
        }}
      >
        Load sample
      </Button>
      {input && (
        <div class="flex flex-wrap gap-4 text-sm text-fg-muted">
          <span>
            <strong class="text-fg">{result.originalCount}</strong> original
          </span>
          <span>
            <strong class="text-fg">{result.remainingCount}</strong> remaining
          </span>
          <span>
            <strong class="text-danger">{result.removedCount}</strong> removed
          </span>
        </div>
      )}
      <Textarea
        id="dl-output"
        label="Output"
        value={result.output}
        readonly
        hint={`${result.remainingCount} lines`}
        class="min-h-[160px] resize-y font-mono text-sm"
      />
      <div class="flex gap-2">
        <CopyButton getText={() => result.output} />
        <DownloadButton filename="deduped.txt" getText={() => result.output} />
      </div>
    </div>
  );
}
