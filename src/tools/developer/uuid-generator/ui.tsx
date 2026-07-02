/**
 * UUID Generator — Preact island UI.
 */
import { useState } from "preact/hooks";
import {
  Input,
  Button,
  Toggle,
  Card,
  CopyButton,
  ToastContainer,
  toast,
} from "../../../components/ui";
import { generateUuids, type UuidOptions } from "./logic";

export default function UuidGenerator() {
  const [count, setCount] = useState<number>(10);
  const [hyphens, setHyphens] = useState<boolean>(true);
  const [uppercase, setUppercase] = useState<boolean>(false);
  const [braces, setBraces] = useState<boolean>(false);
  const [prefix, setPrefix] = useState<string>("");
  const [suffix, setSuffix] = useState<string>("");
  const [results, setResults] = useState<string[]>([]);

  function generate() {
    const opts: UuidOptions = {
      hyphens,
      uppercase,
      braces,
      prefix: prefix || undefined,
      suffix: suffix || undefined,
    };
    const n = Math.max(1, Math.min(count, 10_000));
    setResults(generateUuids(n, opts));
    toast(`Generated ${n} UUID${n === 1 ? "" : "s"}`, "success");
  }

  function copyAll() {
    if (results.length === 0) return;
    void navigator.clipboard.writeText(results.join("\n")).then(
      () => toast("All UUIDs copied", "success"),
      () => toast("Could not copy", "error"),
    );
  }

  function downloadAll() {
    if (results.length === 0) return;
    const blob = new Blob([results.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "uuids.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function clearAll() {
    setResults([]);
  }

  return (
    <div class="space-y-4">
      <ToastContainer />

      <Card class="!p-4">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            id="uuid-count"
            label="Count"
            type="number"
            min={1}
            max={10000}
            step={1}
            value={count}
            onInput={(e) => setCount(Number((e.currentTarget as HTMLInputElement).value))}
            hint="1–10,000"
          />
          <Input
            id="uuid-prefix"
            label="Prefix (optional)"
            type="text"
            value={prefix}
            onInput={(e) => setPrefix((e.currentTarget as HTMLInputElement).value)}
            placeholder="e.g. 0x, id-"
          />
          <Input
            id="uuid-suffix"
            label="Suffix (optional)"
            type="text"
            value={suffix}
            onInput={(e) => setSuffix((e.currentTarget as HTMLInputElement).value)}
            placeholder="e.g. -end"
          />
        </div>

        <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Toggle id="uuid-hyphens" label="Hyphens" checked={hyphens} onChange={setHyphens} />
          <Toggle id="uuid-upper" label="Uppercase" checked={uppercase} onChange={setUppercase} />
          <Toggle id="uuid-braces" label="Wrap in {braces}" checked={braces} onChange={setBraces} />
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <Button onClick={generate}>Generate</Button>
          <Button variant="outline" onClick={copyAll} disabled={results.length === 0}>
            Copy all
          </Button>
          <Button variant="outline" onClick={downloadAll} disabled={results.length === 0}>
            Download
          </Button>
          <Button variant="ghost" onClick={clearAll} disabled={results.length === 0}>
            Clear
          </Button>
        </div>
      </Card>

      {results.length > 0 && (
        <Card class="!p-4">
          <p class="mb-3 text-sm font-semibold">
            {results.length} UUID{results.length === 1 ? "" : "s"}
          </p>
          <div class="unq-card max-h-[480px] overflow-auto !p-2">
            <ul class="space-y-1">
              {results.map((uuid, i) => (
                <li
                  key={i}
                  class="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm hover:bg-unq-surface"
                >
                  <span class="break-all font-mono">{uuid}</span>
                  <CopyButton getText={() => uuid} />
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      <Card class="text-unq-muted !p-4 text-xs">
        <p>
          <strong>Privacy:</strong> all UUID generation happens locally using the browser's
          crypto.randomUUID() API. No network calls, no telemetry.
        </p>
      </Card>
    </div>
  );
}
