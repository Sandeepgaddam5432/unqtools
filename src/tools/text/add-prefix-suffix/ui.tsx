/**
 * Add Prefix/Suffix to Lines — Preact island UI.
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
  Input,
  Switch,
  Select,
} from "../../../components/ui";
import { addPrefixSuffix, DEFAULT_OPTIONS, PRESETS, type PrefixSuffixOptions } from "./logic";

const ESCAPE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "json", label: "JSON" },
  { value: "html", label: "HTML" },
  { value: "sql", label: "SQL" },
];

export default function AddPrefixSuffix() {
  const [input, setInput] = useState("");
  const [opts, setOpts] = useState<PrefixSuffixOptions>(DEFAULT_OPTIONS);

  const output = useMemo(() => addPrefixSuffix(input, opts), [input, opts]);

  function loadSample() {
    setInput("apple\nbanana\ncherry\ndate\nelderberry");
    toast("Sample loaded", "info");
  }

  function clear() {
    setInput("");
  }

  function update(patch: Partial<PrefixSuffixOptions>) {
    setOpts((o) => ({ ...o, ...patch }));
  }

  function applyPreset(p: { prefix: string; suffix: string }) {
    setOpts((o) => ({ ...o, prefix: p.prefix, suffix: p.suffix, reverse: false }));
    toast(`Preset applied: ${p.prefix}…${p.suffix}`, "info");
  }

  return (
    <div class="space-y-4">
      <ToastContainer />

      <Textarea
        id="aps-input"
        label="Input lines"
        placeholder="One item per line…"
        value={input}
        onInput={(e) => setInput((e.currentTarget as HTMLTextAreaElement).value)}
        hint={`${input.split("\n").length} lines`}
        class="min-h-[160px] resize-y font-mono text-sm"
      />

      <Card class="!p-4">
        <div class="flex flex-wrap gap-4">
          <div class="flex flex-col gap-1.5">
            <label for="aps-prefix" class="text-sm font-medium text-unq-text">
              Prefix
            </label>
            <Input
              id="aps-prefix"
              type="text"
              value={opts.prefix}
              onInput={(e) => update({ prefix: (e.currentTarget as HTMLInputElement).value })}
              class="w-40 font-mono"
              placeholder="(none)"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="aps-suffix" class="text-sm font-medium text-unq-text">
              Suffix
            </label>
            <Input
              id="aps-suffix"
              type="text"
              value={opts.suffix}
              onInput={(e) => update({ suffix: (e.currentTarget as HTMLInputElement).value })}
              class="w-40 font-mono"
              placeholder="(none)"
            />
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              type="button"
              class="duration-normal text-unq-text-2 ease-apple rounded-full border border-unq-border px-3 py-1 text-xs transition-all hover:border-unq-accent hover:text-unq-accent"
              onClick={() => applyPreset(p)}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div class="mt-4 flex flex-wrap gap-4">
          <Switch
            checked={opts.skipEmpty}
            onChange={(v) => update({ skipEmpty: v })}
            label="Skip empty lines"
          />
          <Switch
            checked={opts.trimLines}
            onChange={(v) => update({ trimLines: v })}
            label="Trim each line"
          />
          <Switch
            checked={opts.reverse}
            onChange={(v) => update({ reverse: v })}
            label="Reverse (strip)"
          />
        </div>

        <div class="mt-4 flex flex-wrap gap-4">
          <div class="flex flex-col gap-1.5">
            <label for="aps-start" class="text-sm font-medium text-unq-text">
              Counter start
            </label>
            <Input
              id="aps-start"
              type="number"
              value={opts.counterStart}
              onInput={(e) =>
                update({ counterStart: Number((e.currentTarget as HTMLInputElement).value) || 1 })
              }
              class="w-24"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="aps-step" class="text-sm font-medium text-unq-text">
              Counter step
            </label>
            <Input
              id="aps-step"
              type="number"
              value={opts.counterStep}
              onInput={(e) =>
                update({ counterStep: Number((e.currentTarget as HTMLInputElement).value) || 1 })
              }
              class="w-24"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="aps-pad" class="text-sm font-medium text-unq-text">
              Counter padding
            </label>
            <Input
              id="aps-pad"
              type="number"
              min={0}
              max={10}
              value={opts.counterPadding}
              onInput={(e) =>
                update({ counterPadding: Number((e.currentTarget as HTMLInputElement).value) || 0 })
              }
              class="w-24"
            />
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-4">
          <div class="flex flex-col gap-1.5">
            <label for="aps-regex" class="text-sm font-medium text-unq-text">
              Only wrap lines matching (regex)
            </label>
            <Input
              id="aps-regex"
              type="text"
              value={opts.matchRegex}
              onInput={(e) => update({ matchRegex: (e.currentTarget as HTMLInputElement).value })}
              class="w-48 font-mono"
              placeholder="(all lines)"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="aps-escape" class="text-sm font-medium text-unq-text">
              Escape content for
            </label>
            <Select
              id="aps-escape"
              value={opts.escape}
              onChange={(v) => update({ escape: v as PrefixSuffixOptions["escape"] })}
              options={ESCAPE_OPTIONS}
              class="w-32"
            />
          </div>
        </div>

        <p class="text-unq-text-3 mt-3 text-xs">
          Use <code class="font-mono text-unq-accent">{"{n}"}</code> in prefix/suffix for the line
          counter.
        </p>
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
        id="aps-output"
        label="Output"
        value={output}
        readonly
        hint={`${output.split("\n").length} lines`}
        class="min-h-[200px] resize-y font-mono text-sm"
      />

      <div class="flex gap-2">
        <CopyButton getText={() => output} />
        <DownloadButton filename="prefixed.txt" getText={() => output} />
      </div>
    </div>
  );
}
