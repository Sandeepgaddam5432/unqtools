import { describe, it, expect } from "vitest";
import { svgToJsx, validateSvg, optimizeSvg } from "./logic";

describe("SVG to JSX Converter", () => {
  it("converts class to className", () => {
    const result = svgToJsx('<svg class="icon"><path d="M0 0"/></svg>');
    expect(result).toContain("className");
  });
  it("converts stroke-width to strokeWidth", () => {
    const result = svgToJsx('<svg><path stroke-width="2" d="M0 0"/></svg>');
    expect(result).toContain("strokeWidth");
  });
  it("wraps in component", () => {
    const result = svgToJsx('<svg></svg>', "MyIcon");
    expect(result).toContain("function MyIcon");
  });
  it("validates SVG", () => {
    expect(validateSvg("<svg></svg>").valid).toBe(true);
    expect(validateSvg("not svg").valid).toBe(false);
  });
  it("optimizes SVG", () => {
    expect(optimizeSvg("<!-- comment --><svg>  </svg>")).not.toContain("comment");
  });
});
