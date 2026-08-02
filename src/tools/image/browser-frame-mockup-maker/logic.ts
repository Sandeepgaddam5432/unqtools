/**
 * Browser Frame Mockup Maker — pure logic.
 */

export type BrowserType = "chrome" | "safari" | "firefox" | "edge";

export interface MockupOptions {
  browser: BrowserType;
  url: string;
  bgColor: string;
  shadow: boolean;
  padding: number;
}

export function defaultOptions(): MockupOptions {
  return { browser: "chrome", url: "https://example.com", bgColor: "#f8fafc", shadow: true, padding: 24 };
}

export function generateChromeFrame(opts: MockupOptions): string {
  return `<div style="background:${opts.bgColor};padding:${opts.padding}px;border-radius:12px;${opts.shadow ? "box-shadow:0 8px 32px rgba(0,0,0,0.12);" : ""}">
  <div style="background:#dfe3e8;border-radius:8px 8px 0 0;padding:10px 14px;display:flex;align-items:center;gap:8px;">
    <span style="width:12px;height:12px;border-radius:50%;background:#ff5f57;"></span>
    <span style="width:12px;height:12px;border-radius:50%;background:#ffbd2e;"></span>
    <span style="width:12px;height:12px;border-radius:50%;background:#28c940;"></span>
    <div style="flex:1;background:#fff;border-radius:6px;padding:4px 12px;font-size:13px;color:#5f6368;margin-left:8px;">${opts.url}</div>
  </div>
  <div style="background:#fff;border-radius:0 0 8px 8px;overflow:hidden;">
    <!-- Your screenshot here -->
  </div>
</div>`;
}

export function generateSafariFrame(opts: MockupOptions): string {
  return `<div style="background:${opts.bgColor};padding:${opts.padding}px;border-radius:12px;${opts.shadow ? "box-shadow:0 8px 32px rgba(0,0,0,0.12);" : ""}}">
  <div style="background:#e8e8e8;border-radius:8px 8px 0 0;padding:8px 14px;display:flex;align-items:center;gap:6px;">
    <span style="width:12px;height:12px;border-radius:50%;background:#ff5f57;"></span>
    <span style="width:12px;height:12px;border-radius:50%;background:#ffbd2e;"></span>
    <span style="width:12px;height:12px;border-radius:50%;background:#28c940;"></span>
    <div style="flex:1;text-align:center;font-size:13px;color:#666;">${opts.url}</div>
  </div>
  <div style="background:#fff;border-radius:0 0 8px 8px;overflow:hidden;">
    <!-- Your screenshot here -->
  </div>
</div>`;
}

export function generateFirefoxFrame(opts: MockupOptions): string {
  return `<div style="background:${opts.bgColor};padding:${opts.padding}px;border-radius:12px;${opts.shadow ? "box-shadow:0 8px 32px rgba(0,0,0,0.12);" : ""}}">
  <div style="background:#f0f0f4;border-radius:8px 8px 0 0;padding:8px 14px;display:flex;align-items:center;gap:8px;">
    <span style="width:12px;height:12px;border-radius:50%;background:#ff5f57;"></span>
    <span style="width:12px;height:12px;border-radius:50%;background:#ffbd2e;"></span>
    <span style="width:12px;height:12px;border-radius:50%;background:#28c940;"></span>
    <div style="flex:1;background:#fff;border-radius:4px;padding:4px 8px;font-size:12px;color:#333;">${opts.url}</div>
  </div>
  <div style="background:#fff;border-radius:0 0 8px 8px;overflow:hidden;">
    <!-- Your screenshot here -->
  </div>
</div>`;
}

export function generateMockup(opts: MockupOptions): string {
  switch (opts.browser) {
    case "chrome": return generateChromeFrame(opts);
    case "safari": return generateSafariFrame(opts);
    case "firefox": return generateFirefoxFrame(opts);
    case "edge": return generateChromeFrame(opts); // Edge similar to Chrome
  }
}

export function getBrowserPresets(): { value: BrowserType; label: string }[] {
  return [{ value: "chrome", label: "Google Chrome" }, { value: "safari", label: "Safari" }, { value: "firefox", label: "Firefox" }, { value: "edge", label: "Microsoft Edge" }];
}

// ============================================================================
// Backward-compat stub exports (added to satisfy UI template imports).
// ============================================================================

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function getStats(input: string, output: string): {
  inputSize: number;
  outputSize: number;
} {
  return {
    inputSize: new Blob([input]).size,
    outputSize: new Blob([output]).size,
  };
}

export function validate(input: string): string[] {
  const issues: string[] = [];
  if (!input || input.trim().length === 0) {
    issues.push("Input is empty.");
  }
  return issues;
}

export function process(input: string): { output: string; error: string | null } {
  try {
    const result = generateChromeFrame(input);
    if (typeof result === "string") {
      return { output: result, error: null };
    }
    if (result && typeof result === "object") {
      const r = result as Record<string, unknown>;
      const output =
        (typeof r.output === "string" && r.output) ||
        (typeof r.html === "string" && r.html) ||
        (typeof r.result === "string" && r.result) ||
        (typeof r.text === "string" && r.text) ||
        (typeof r.code === "string" && r.code) ||
        (typeof r.value === "string" && r.value) ||
        JSON.stringify(result, null, 2);
      const error =
        (typeof r.error === "string" && r.error) ||
        (r.ok === false && typeof r.message === "string" && r.message) ||
        null;
      return { output, error };
    }
    return { output: String(result), error: null };
  } catch (e) {
    return { output: "", error: (e as Error).message };
  }
}
