/**
 * URL Encoder / Decoder — Preact island UI.
 */
import { useMemo, useState } from "preact/hooks";
import {
  Textarea,
  Button,
  Toggle,
  Select,
  CopyButton,
  Card,
  ToastContainer,
  toast,
  ErrorBanner,
} from "../../../components/ui";
import { encodeUrl, decodeUrl, parseUrl, type UrlMode } from "./logic";

type Mode = "encode" | "decode";

export default function UrlEncoderTool() {
  const [input, setInput] = useState<string>("");
  const [mode, setMode] = useState<Mode>("encode");
  const [urlMode, setUrlMode] = useState<UrlMode>("component");
  const [liveUpdate, setLiveUpdate] = useState<boolean>(true);
  const [output, setOutput] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  function run() {
    if (!input) {
      setOutput("");
      setError(null);
      return;
    }
    if (mode === "encode") {
      setOutput(encodeUrl(input, urlMode));
      setError(null);
    } else {
      const r = decodeUrl(input);
      if (r.ok) {
        setOutput(r.output);
        setError(null);
      } else {
        setError(r.error);
        setOutput("");
      }
    }
  }

  useMemo(() => {
    if (liveUpdate) run();
  }, [input, mode, urlMode, liveUpdate]);

  const parsed = useMemo(
    () => (mode === "decode" && input ? parseUrl(input) : null),
    [mode, input],
  );

  function loadSample() {
    setInput("https://example.com/search?q=hello world&lang=en&emoji=👍");
    toast("Sample loaded", "info");
  }

  function swap() {
    setMode((m) => (m === "encode" ? "decode" : "encode"));
    setInput(output);
    setOutput("");
  }

  return (
    <div class="space-y-4">
      <ToastContainer />

      <Card class="!p-4">
        <div class="flex flex-wrap items-end gap-4">
          <Select
            id="url-mode"
            label="Mode"
            value={mode}
            onChange={(e) => setMode((e.currentTarget as HTMLSelectElement).value as Mode)}
            options={[
              { value: "encode", label: "Encode" },
              { value: "decode", label: "Decode" },
            ]}
          />
          {mode === "encode" && (
            <Select
              id="url-submode"
              label="Encoding type"
              value={urlMode}
              onChange={(e) => setUrlMode((e.currentTarget as HTMLSelectElement).value as UrlMode)}
              options={[
                { value: "component", label: "encodeURIComponent (for query values)" },
                { value: "uri", label: "encodeURI (for full URLs)" },
              ]}
            />
          )}
          <Toggle id="url-live" label="Live update" checked={liveUpdate} onChange={setLiveUpdate} />
          <div class="ml-auto flex gap-2">
            <Button variant="outline" onClick={swap} disabled={!output}>
              ⇄ Swap
            </Button>
            {!liveUpdate && <Button onClick={run}>Run</Button>}
            <Button variant="ghost" onClick={loadSample}>
              Sample
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setInput("");
                setOutput("");
                setError(null);
              }}
              disabled={!input && !output}
            >
              Clear
            </Button>
          </div>
        </div>
      </Card>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Textarea
          id="url-input"
          label={mode === "encode" ? "Plain text / URL" : "Encoded URL"}
          placeholder={mode === "encode" ? "Enter text to encode…" : "Paste encoded URL…"}
          value={input}
          onInput={(e) => setInput((e.currentTarget as HTMLTextAreaElement).value)}
          class="min-h-[200px] break-all font-mono text-sm"
        />
        <div class="flex flex-col gap-1">
          <label for="url-output" class="text-sm font-medium">
            {mode === "encode" ? "Encoded output" : "Decoded text"}
          </label>
          <pre
            id="url-output"
            aria-live="polite"
            class="unq-input min-h-[200px] overflow-auto whitespace-pre-wrap break-all py-2 font-mono text-sm"
          >
            {output}
          </pre>
          {output && (
            <div class="flex items-center justify-end gap-2">
              <CopyButton getText={() => output} />
            </div>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {parsed && parsed.isValid && (
        <Card class="!p-4">
          <p class="mb-3 text-sm font-semibold">URL breakdown</p>
          <div class="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <div>
              <p class="text-unq-muted">Protocol</p>
              <p class="font-mono">{parsed.protocol}</p>
            </div>
            <div>
              <p class="text-unq-muted">Hostname</p>
              <p class="font-mono">{parsed.hostname}</p>
            </div>
            <div>
              <p class="text-unq-muted">Port</p>
              <p class="font-mono">{parsed.port || "—"}</p>
            </div>
            <div>
              <p class="text-unq-muted">Path</p>
              <p class="break-all font-mono">{parsed.pathname}</p>
            </div>
            <div>
              <p class="text-unq-muted">Search</p>
              <p class="break-all font-mono">{parsed.search || "—"}</p>
            </div>
            <div>
              <p class="text-unq-muted">Hash</p>
              <p class="font-mono">{parsed.hash || "—"}</p>
            </div>
          </div>
          {parsed.searchParams.length > 0 && (
            <div class="mt-4">
              <p class="mb-2 text-xs font-semibold">
                Query parameters ({parsed.searchParams.length})
              </p>
              <div class="unq-scroll-x">
                <table class="w-full text-xs">
                  <thead>
                    <tr class="text-unq-muted border-unq-border border-b text-left">
                      <th class="py-1 pr-2">Key</th>
                      <th class="py-1">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.searchParams.map((p, i) => (
                      <tr key={i} class="border-unq-border/40 border-b">
                        <td class="py-1 pr-2 font-mono">{p.key}</td>
                        <td class="break-all py-1 font-mono">{p.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      <Card class="text-unq-muted !p-4 text-xs">
        <p>
          <strong>Privacy:</strong> all encoding/decoding is local. Use{" "}
          <code>encodeURIComponent</code> for individual query parameter values,{" "}
          <code>encodeURI</code> for full URLs.
        </p>
      </Card>
    </div>
  );
}
