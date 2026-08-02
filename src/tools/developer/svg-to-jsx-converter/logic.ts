/**
 * SVG to JSX Converter — pure logic.
 */
export function svgToJsx(svg: string, componentName: string = "SvgComponent"): string {
  let jsx = svg;
  // Convert HTML attributes to camelCase
  jsx = jsx.replace(/class=/g, "className=");
  jsx = jsx.replace(/for=/g, "htmlFor=");
  jsx = jsx.replace(/stroke-width=/g, "strokeWidth=");
  jsx = jsx.replace(/stroke-linecap=/g, "strokeLinecap=");
  jsx = jsx.replace(/stroke-linejoin=/g, "strokeLinejoin=");
  jsx = jsx.replace(/stroke-dasharray=/g, "strokeDasharray=");
  jsx = jsx.replace(/stroke-dashoffset=/g, "strokeDashoffset=");
  jsx = jsx.replace(/fill-rule=/g, "fillRule=");
  jsx = jsx.replace(/clip-rule=/g, "clipRule=");
  jsx = jsx.replace(/clip-path=/g, "clipPath=");
  jsx = jsx.replace(/fill-opacity=/g, "fillOpacity=");
  jsx = jsx.replace(/stop-color=/g, "stopColor=");
  jsx = jsx.replace(/stop-opacity=/g, "stopOpacity=");
  jsx = jsx.replace(/font-family=/g, "fontFamily=");
  jsx = jsx.replace(/font-size=/g, "fontSize=");
  jsx = jsx.replace(/font-weight=/g, "fontWeight=");
  jsx = jsx.replace(/text-anchor=/g, "textAnchor=");
  jsx = jsx.replace(/xlink:href=/g, "xlinkHref=");
  // Self-close tags
  jsx = jsx.replace(/<(rect|circle|ellipse|line|polyline|polygon|path|image|use|stop|br|hr|input|meta|link)([^>]*?)(?!\/)>/g, "<$1$2 />");
  // Remove XML declaration and comments
  jsx = jsx.replace(/<\?xml[^?]*\?>/g, "");
  jsx = jsx.replace(/<!--[\s\S]*?-->/g, "");
  jsx = jsx.trim();
  return `import React from "react";\n\nexport default function ${componentName}(props: React.SVGProps<SVGSVGElement>) {\n  return (\n    ${jsx.replace(/<svg/, "<svg {...props}")}\n  );\n}\n`;
}
export function validateSvg(svg: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!svg.includes("<svg")) errors.push("Missing <svg> tag");
  if (!svg.includes("</svg>")) errors.push("Missing </svg> tag");
  if (!svg.includes("xmlns")) errors.push("Missing xmlns attribute");
  return { valid: errors.length === 0, errors };
}
export function optimizeSvg(svg: string): string {
  return svg.replace(/<!--[^]*?-->/g, "").replace(/\s{2,}/g, " ").replace(/\s+\/>/g, "/>").trim();
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
    const result = validateSvg(input);
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
