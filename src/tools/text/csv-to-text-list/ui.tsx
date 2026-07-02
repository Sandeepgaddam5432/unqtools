import { useMemo, useState } from "preact/hooks";
import {
  Textarea,
  Button,
  Card,
  CopyButton,
  ToastContainer,
  toast,
  Input,
  Switch,
} from "../../../components/ui";
import { csvToList, DEFAULT_OPTIONS, type CsvToListOptions } from "./logic";

export default function CsvToTextList() {
  const [input, setInput] = useState("");
  const [opts, setOpts] = useState<CsvToListOptions>(DEFAULT_OPTIONS);
  const output = useMemo(() => csvToList(input, opts), [input, opts]);
  const update = (p: Partial<CsvToListOptions>) => setOpts((o) => ({ ...o, ...p }));

  return (
    <div class="space-y-4">
      <ToastContainer />
      <Textarea
        id="cl-input"
        label="CSV input"
        placeholder="a,b,c\n1,2,3"
        value={input}
        onInput={(e) => setInput((e.currentTarget as HTMLTextAreaElement).value)}
        hint={`${input.length} chars`}
        class="min-h-[120px] resize-y font-mono text-sm"
      />
      <Card class="flex flex-wrap gap-4 !p-4">
        <div class="flex flex-col gap-1.5">
          <label for="cl-col" class="text-sm font-medium text-fg">
            Column (-1 = all)
          </label>
          <Input
            id="cl-col"
            type="number"
            min={-1}
            value={opts.column}
            onInput={(e) => update({ column: Number((e.currentTarget as HTMLInputElement).value) })}
            class="w-20"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="cl-delim" class="text-sm font-medium text-fg">
            Delimiter
          </label>
          <Input
            id="cl-delim"
            type="text"
            value={opts.delimiter}
            onInput={(e) => update({ delimiter: (e.currentTarget as HTMLInputElement).value })}
            class="w-20 font-mono"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="cl-quote" class="text-sm font-medium text-fg">
            Quote
          </label>
          <Input
            id="cl-quote"
            type="text"
            value={opts.quote}
            onInput={(e) => update({ quote: (e.currentTarget as HTMLInputElement).value })}
            class="w-16 font-mono"
          />
        </div>
        <Switch checked={opts.dedupe} onChange={(v) => update({ dedupe: v })} label="Dedupe" />
        <Switch checked={opts.trim} onChange={(v) => update({ trim: v })} label="Trim" />
        <Switch
          checked={opts.skipEmpty}
          onChange={(v) => update({ skipEmpty: v })}
          label="Skip empty"
        />
      </Card>
      <Button
        variant="ghost"
        onClick={() => {
          setInput("Name,City\nAlice,NYC\nBob,LA\nAlice,Chicago");
          toast("Sample loaded", "info");
        }}
      >
        Load sample
      </Button>
      <Textarea
        id="cl-output"
        label="Output"
        value={output}
        readonly
        class="min-h-[120px] resize-y font-mono text-sm"
      />
      {output && <CopyButton getText={() => output} />}
    </div>
  );
}
