/**
 * Add Line Breaks — Preact island UI.
 */
import { useMemo, useState } from "preact/hooks";
import {
  Textarea,
  Button,
  Card,
  CopyButton,
  DownloadButton,
  ToastContainer,
  toast,
  Select,
  Switch,
  Input,
} from "../../../components/ui";
import {
  addLineBreaks,
  DEFAULT_OPTIONS,
  type AddLineBreaksOptions,
  type BreakStrategy,
} from "./logic";

const STRATEGY_OPTIONS = [
  { value: "wrap", label: "Word wrap (column width)" },
  { value: "delimiter", label: "Split on delimiter" },
  { value: "chars", label: "Every N characters" },
  { value: "words", label: "Every N words" },
  { value: "sentences", label: "After each sentence" },
];

export default function AddLineBreaks() {
  const [input, setInput] = useState("");
  const [opts, setOpts] = useState<AddLineBreaksOptions>(DEFAULT_OPTIONS);

  const output = useMemo(() => addLineBreaks(input, opts), [input, opts]);
  const lineCount = output ? output.split(/\r\n|\r|\n/).length : 0;

  function loadSample() {
    setInput(
      "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump!",
    );
    toast("Sample loaded", "info");
  }

  function clear() {
    setInput("");
  }

  function update(patch: Partial<AddLineBreaksOptions>) {
    setOpts((o) => ({ ...o, ...patch }));
  }

  return (
    <div class="space-y-4">
      <ToastContainer />

      <Textarea
        id="alb-input"
        label="Input text"
        placeholder="Type or paste text here…"
        value={input}
        onInput={(e) => setInput((e.currentTarget as HTMLTextAreaElement).value)}
        hint={`${input.length.toLocaleString()} characters`}
        class="min-h-[160px] resize-y"
      />

      <Card class="!p-4">
        <div class="flex flex-wrap items-end gap-4">
          <div class="flex flex-col gap-1.5">
            <label for="alb-strategy" class="text-sm font-medium text-fg">
              Strategy
            </label>
            <Select
              id="alb-strategy"
              value={opts.strategy}
              onChange={(v) => update({ strategy: v as BreakStrategy })}
              options={STRATEGY_OPTIONS}
              class="w-56"
            />
          </div>

          {opts.strategy === "wrap" && (
            <>
              <div class="flex flex-col gap-1.5">
                <label for="alb-width" class="text-sm font-medium text-fg">
                  Column width
                </label>
                <Input
                  id="alb-width"
                  type="number"
                  min={1}
                  max={500}
                  value={opts.width}
                  onInput={(e) =>
                    update({ width: Number((e.currentTarget as HTMLInputElement).value) || 80 })
                  }
                  class="w-24"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-fg">Hard break</label>
                <Switch
                  checked={opts.hardBreak}
                  onChange={(v) => update({ hardBreak: v })}
                  label="Split words at width"
                />
              </div>
            </>
          )}

          {opts.strategy === "delimiter" && (
            <>
              <div class="flex flex-col gap-1.5">
                <label for="alb-delim" class="text-sm font-medium text-fg">
                  Delimiter
                </label>
                <Input
                  id="alb-delim"
                  type="text"
                  value={opts.delimiter}
                  onInput={(e) =>
                    update({ delimiter: (e.currentTarget as HTMLInputElement).value })
                  }
                  class="w-32"
                  placeholder=", "
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label for="alb-dpos" class="text-sm font-medium text-fg">
                  Position
                </label>
                <Select
                  id="alb-dpos"
                  value={opts.delimiterPosition}
                  onChange={(v) => update({ delimiterPosition: v as "before" | "after" })}
                  options={[
                    { value: "after", label: "Break after" },
                    { value: "before", label: "Break before" },
                  ]}
                  class="w-32"
                />
              </div>
            </>
          )}

          {(opts.strategy === "chars" || opts.strategy === "words") && (
            <div class="flex flex-col gap-1.5">
              <label for="alb-n" class="text-sm font-medium text-fg">
                {opts.strategy === "chars" ? "Characters per line" : "Words per line"}
              </label>
              <Input
                id="alb-n"
                type="number"
                min={1}
                max={1000}
                value={opts.n}
                onInput={(e) =>
                  update({ n: Number((e.currentTarget as HTMLInputElement).value) || 1 })
                }
                class="w-24"
              />
            </div>
          )}
        </div>

        <div class="mt-4 flex flex-wrap gap-4">
          <Switch
            checked={opts.preserveExistingBreaks}
            onChange={(v) => update({ preserveExistingBreaks: v })}
            label="Preserve existing breaks"
          />
          <Switch
            checked={opts.trimTrailing}
            onChange={(v) => update({ trimTrailing: v })}
            label="Trim trailing spaces"
          />
          <Switch
            checked={opts.collapseBlanks}
            onChange={(v) => update({ collapseBlanks: v })}
            label="Collapse blank lines"
          />
          <div class="flex flex-col gap-1.5">
            <label for="alb-le" class="text-sm font-medium text-fg">
              Line ending
            </label>
            <Select
              id="alb-le"
              value={opts.lineEnding}
              onChange={(v) => update({ lineEnding: v as "lf" | "crlf" })}
              options={[
                { value: "lf", label: "LF (Unix)" },
                { value: "crlf", label: "CRLF (Windows)" },
              ]}
              class="w-36"
            />
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-4">
          <div class="flex flex-col gap-1.5">
            <label for="alb-indent" class="text-sm font-medium text-fg">
              Indent
            </label>
            <Input
              id="alb-indent"
              type="text"
              value={opts.indent}
              onInput={(e) => update({ indent: (e.currentTarget as HTMLInputElement).value })}
              class="w-32"
              placeholder="(none)"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="alb-hang" class="text-sm font-medium text-fg">
              Hanging indent
            </label>
            <Input
              id="alb-hang"
              type="text"
              value={opts.hangingIndent}
              onInput={(e) =>
                update({ hangingIndent: (e.currentTarget as HTMLInputElement).value })
              }
              class="w-32"
              placeholder="(none)"
            />
          </div>
        </div>
      </Card>

      <div class="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={loadSample}>
          Load sample
        </Button>
        <Button variant="ghost" onClick={clear}>
          Clear
        </Button>
      </div>

      <Textarea
        id="alb-output"
        label="Output"
        value={output}
        readonly
        hint={`${lineCount.toLocaleString()} lines`}
        class="min-h-[200px] resize-y font-mono text-sm"
      />

      <div class="flex gap-2">
        <CopyButton getText={() => output} />
        <DownloadButton filename="line-broken.txt" getText={() => output} />
      </div>
    </div>
  );
}
