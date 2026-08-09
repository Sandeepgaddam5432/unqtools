import { describe, expect, it } from "vitest";
import { opfPathFromContainer, parseOpfManifest, resolveHref, htmlToText } from "./logic";

describe("opfPathFromContainer", () => {
  it("extracts the full-path attribute", () => {
    const xml = `<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;
    expect(opfPathFromContainer(xml)).toBe("OEBPS/content.opf");
  });

  it("returns null when missing", () => {
    expect(opfPathFromContainer("<container/>")).toBeNull();
  });
});

describe("parseOpfManifest", () => {
  const opf = `<package>
    <manifest>
      <item id="c1" href="chap1.xhtml" media-type="application/xhtml+xml"/>
      <item id="c2" href="chap2.xhtml" media-type="application/xhtml+xml"/>
      <item id="img" href="cover.jpg" media-type="image/jpeg"/>
    </manifest>
    <spine>
      <itemref idref="c1"/>
      <itemref idref="c2"/>
    </spine>
  </package>`;

  it("maps xhtml ids to hrefs and ignores non-xhtml", () => {
    const { idToHref } = parseOpfManifest(opf);
    expect(idToHref["c1"]).toBe("chap1.xhtml");
    expect(idToHref["img"]).toBeUndefined();
  });

  it("reads spine order", () => {
    const { spine } = parseOpfManifest(opf);
    expect(spine).toEqual(["c1", "c2"]);
  });
});

describe("resolveHref", () => {
  it("joins OPF base directory with the href", () => {
    expect(resolveHref("OEBPS/content.opf", "chap1.xhtml")).toBe("OEBPS/chap1.xhtml");
    expect(resolveHref("content.opf", "chap1.xhtml")).toBe("chap1.xhtml");
  });
});

describe("htmlToText", () => {
  it("converts headings, lists and paragraphs to readable text", () => {
    const html = `<html><body>
      <h1>Chapter One</h1>
      <p>Hello <strong>world</strong>.</p>
      <ul><li>One</li><li>Two</li></ul>
    </body></html>`;
    const t = htmlToText(html);
    expect(t).toContain("# Chapter One");
    expect(t).toContain("Hello world.");
    expect(t).toContain("- One");
    expect(t).toContain("- Two");
  });

  it("decodes common entities", () => {
    expect(htmlToText("<p>a &amp; b &lt; c</p>")).toContain("a & b < c");
    expect(htmlToText("<p>caf&#233;</p>")).toContain("café");
  });

  it("handles tables into pipe-delimited rows", () => {
    const html = `<table><tr><td>A</td><td>B</td></tr></table>`;
    const t = htmlToText(html);
    expect(t).toContain("A | B");
  });
});
