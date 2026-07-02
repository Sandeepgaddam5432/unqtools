/**
 * Base64 Encoder / Decoder — Preact island UI.
 */
import { useMemo, useState } from "preact/hooks";
import {
  Textarea,
  Button,
  Toggle,
  Select,
  CopyButton,
  DownloadButton,
  Card,
  ToastContainer,
  toast,
  ErrorBanner,
} from "../../../components/ui";
import { encodeBase64, decodeBase64, type Base64Variant } from "./logic";

type Mode = "encode" | "decode";

export default function Base64Tool() {
  const [input, setInput] = useState<string>("");
  const [mode, setMode] = useState<Mode>("encode");
  const [variant, setVariant] = useState<Base64Variant>("standard");
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
      setOutput(encodeBase64(input, variant));
      setError(null);
    } else {
      const r = decodeBase64(input);
      if (r.ok) {
        setOutput(r.output);
        setError(null);
      } else {
        setError(r.error);
        setOutput("");
      }
    }
  }

  // Live update
  useMemo(() => {
    if (liveUpdate) run();
  }, [input, mode, variant, liveUpdate]);

  function loadSample() {
    if (mode === "encode") {
      setInput("Hello, World! 👍🌍");
    } else {
      setInput(encodeBase64("Hello, World! 👍🌍", variant));
    }
    toast("Sample loaded", "info");
  }

  function swap() {
    setMode((m) => (m === "encode" ? "decode" : "encode"));
    setInput(output);
    setOutput("");
  }

  const inputBytes = useMemo(() => new Blob([input]).size, [input]);
  const outputBytes = useMemo(() => new Blob([output]).size, [output]);

  return (
    <div class="space-y-4">
      <ToastContainer />

      <Card class="!p-4">
        <div class="flex flex-wrap items-end gap-4">
          <Select
            id="b64-mode"
            label="Mode"
            value={mode}
            onChange={(e) => setMode((e.currentTarget as HTMLSelectElement).value as Mode)}
            options={[
              { value: "encode", label: "Encode (Text → Base64)" },
              { value: "decode", label: "Decode (Base64 → Text)" },
            ]}
          />
          <Select
            id="b64-variant"
            label="Variant"
            value={variant}
            onChange={(e) =>
              setVariant((e.currentTarget as HTMLSelectElement).value as Base64Variant)
            }
            options={[
              { value: "standard", label: "Standard (+/)" },
              { value: "urlsafe", label: "URL-safe (-_)" },
            ]}
          />
          <Toggle id="b64-live" label="Live update" checked={liveUpdate} onChange={setLiveUpdate} />
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
          id="b64-input"
          label={mode === "encode" ? "Plain text" : "Base64 input"}
          placeholder={mode === "encode" ? "Type text to encode…" : "Paste Base64 to decode…"}
          value={input}
          onInput={(e) => setInput((e.currentTarget as HTMLTextAreaElement).value)}
          hint={`${inputBytes.toLocaleString()} bytes`}
          class="min-h-[300px] font-mono text-sm"
        />
        <div class="flex flex-col gap-1">
          <label for="b64-output" class="text-sm font-medium">
            {mode === "encode" ? "Base64 output" : "Decoded text"}
          </label>
          <pre
            id="b64-output"
            aria-live="polite"
            class="unq-input min-h-[300px] overflow-auto whitespace-pre-wrap break-all py-2 font-mono text-sm"
          >
            {output}
          </pre>
          {output && (
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs text-unq-muted">{outputBytes.toLocaleString()} bytes</p>
              <div class="flex gap-2">
                <CopyButton getText={() => output} />
                <DownloadButton
                  filename={mode === "encode" ? "encoded.txt" : "decoded.txt"}
                  getText={() => output}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card class="!p-4 text-xs text-unq-muted">
        <p>
          <strong>Privacy:</strong> all encoding/decoding is local. UTF-8 safe via
          TextEncoder/TextDecoder. URL-safe variant follows RFC 4648 §5.
        </p>
      </Card>
    </div>
  );
}
