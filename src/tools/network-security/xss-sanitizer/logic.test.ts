import { describe, it, expect } from "vitest";
import {
  encodeHtml, encodeAttribute, encodeJs, encodeCss, encodeUrl, encodeForContext,
  removeEventHandlers, removeJavascriptUrls, filterDataUris, stripDisallowedTags,
  stripDisallowedAttributes, sanitize, computeSeverity, sanitizeBatch, batchStats,
  renderBatchCsv, renderReport, getDefaults, DEFAULT_ALLOWED_TAGS,
} from "./logic";

describe("xss-sanitizer encodeHtml", () => {
  it("escapes &, <, >, quotes", () => {
    expect(encodeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#x27;s&lt;/a&gt;",
    );
  });
  it("escapes empty string", () => {
    expect(encodeHtml("")).toBe("");
  });
});

describe("xss-sanitizer encodeAttribute", () => {
  it("matches HTML encoding", () => {
    expect(encodeAttribute(`"onerror"`)).toBe("&quot;onerror&quot;");
  });
});

describe("xss-sanitizer encodeJs", () => {
  it("escapes backslashes and quotes", () => {
    expect(encodeJs(`"\\n'`)).toBe('\\"\\\\n\\\'');
  });
  it("escapes angle brackets as unicode", () => {
    expect(encodeJs("<script>")).toBe("\\u003cscript\\u003e");
  });
});

describe("xss-sanitizer encodeCss", () => {
  it("escapes braces and angle brackets", () => {
    expect(encodeCss("{<>&}")).toBe("\\7b \\3c \\3e \\26 \\7d ");
  });
});

describe("xss-sanitizer encodeUrl", () => {
  it("percent-encodes special characters", () => {
    expect(encodeUrl("hello world&foo")).toBe("hello%20world%26foo");
  });
  it("returns empty string for invalid input", () => {
    expect(encodeUrl("")).toBe("");
  });
});

describe("xss-sanitizer encodeForContext", () => {
  it("dispatches by context", () => {
    expect(encodeForContext("<", "html")).toBe("&lt;");
    expect(encodeForContext("<", "js")).toBe("\\u003c");
    expect(encodeForContext("<", "css")).toBe("\\3c ");
    expect(encodeForContext(" ", "url")).toBe("%20");
    expect(encodeForContext("<", "attribute")).toBe("&lt;");
  });
});

describe("xss-sanitizer removeEventHandlers", () => {
  it("removes onclick", () => {
    expect(removeEventHandlers('<a onclick="evil()">x</a>')).toBe("<a>x</a>");
  });
  it("removes multiple event handlers", () => {
    const out = removeEventHandlers('<img src="x" onerror="e()" onload="l()">');
    expect(out).not.toMatch(/on(error|load)/i);
  });
});

describe("xss-sanitizer removeJavascriptUrls", () => {
  it("neutralises javascript: href", () => {
    const out = removeJavascriptUrls('<a href="javascript:evil()">x</a>');
    expect(out).not.toMatch(/javascript:/i);
  });
});

describe("xss-sanitizer filterDataUris", () => {
  it("removes non-image data URIs when not allowed", () => {
    const out = filterDataUris('<img src="data:text/html,xxx">', false);
    expect(out).not.toMatch(/data:text\/html/);
  });
  it("keeps image data URIs when allowed", () => {
    const out = filterDataUris('<img src="data:image/png;base64,abc">', true);
    expect(out).toMatch(/data:image\/png/);
  });
});

describe("xss-sanitizer stripDisallowedTags", () => {
  it("keeps allowed tags", () => {
    expect(stripDisallowedTags("<p>hi</p>", ["p"])).toBe("<p>hi</p>");
  });
  it("removes script tags", () => {
    expect(stripDisallowedTags("<script>alert(1)</script>", ["p"])).toBe("alert(1)");
  });
});

describe("xss-sanitizer stripDisallowedAttributes", () => {
  it("keeps allowed attributes", () => {
    expect(stripDisallowedAttributes('<a href="x">y</a>', ["href"])).toBe('<a href="x">y</a>');
  });
  it("removes disallowed attributes", () => {
    expect(stripDisallowedAttributes('<a onclick="x" href="y">z</a>', ["href"])).toBe('<a href="y">z</a>');
  });
});

describe("xss-sanitizer sanitize", () => {
  it("removes inline event handlers and javascript: URLs", () => {
    const r = sanitize('<a href="javascript:evil()" onclick="x()">y</a>');
    expect(r.sanitized).not.toMatch(/javascript:/i);
    expect(r.sanitized).not.toMatch(/onclick/i);
    expect(r.severity).toBe("critical");
  });
  it("returns info severity for clean HTML", () => {
    const r = sanitize("<p>clean</p>");
    expect(r.severity).toBe("info");
  });
  it("respects custom allowlist", () => {
    const r = sanitize("<b>bold</b><i>italic</i>", { allowedTags: ["b"] });
    expect(r.sanitized).toContain("<b>bold</b>");
    expect(r.sanitized).not.toContain("<i>");
  });
});

describe("xss-sanitizer computeSeverity", () => {
  it("returns critical for javascript: URLs", () => {
    expect(computeSeverity({ removedEventHandlers: 0, removedJavascriptUrls: 1, removedDataUris: 0, removedTags: 0 })).toBe("critical");
  });
  it("returns high for event handlers", () => {
    expect(computeSeverity({ removedEventHandlers: 1, removedJavascriptUrls: 0, removedDataUris: 0, removedTags: 0 })).toBe("high");
  });
  it("returns low for removed tags", () => {
    expect(computeSeverity({ removedEventHandlers: 0, removedJavascriptUrls: 0, removedDataUris: 0, removedTags: 2 })).toBe("low");
  });
});

describe("xss-sanitizer sanitizeBatch / batchStats", () => {
  it("sanitizes multiple inputs", () => {
    const rs = sanitizeBatch([
      { html: "<p>ok</p>" },
      { html: '<a href="javascript:x">y</a>' },
    ]);
    expect(rs.length).toBe(2);
    const s = batchStats(rs);
    expect(s.count).toBe(2);
    expect(s.bySeverity.critical).toBe(1);
  });
});

describe("xss-sanitizer renderBatchCsv / renderReport", () => {
  it("renders CSV header", () => {
    expect(renderBatchCsv([]).split("\n")[0]).toContain("index,severity");
  });
  it("renders report", () => {
    const r = sanitize("<p>ok</p>");
    const text = renderReport(r);
    expect(text).toContain("XSS Sanitization Report");
    expect(text).toContain("Severity: info");
  });
});

describe("xss-sanitizer getDefaults / DEFAULT_ALLOWED_TAGS", () => {
  it("returns a non-empty allowlist", () => {
    const d = getDefaults();
    expect(d.allowedTags.length).toBeGreaterThan(0);
    expect(d.allowedAttributes.length).toBeGreaterThan(0);
  });
  it("DEFAULT_ALLOWED_TAGS includes <a>", () => {
    expect(DEFAULT_ALLOWED_TAGS).toContain("a");
  });
});
