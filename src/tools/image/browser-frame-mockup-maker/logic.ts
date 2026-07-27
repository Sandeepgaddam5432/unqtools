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
