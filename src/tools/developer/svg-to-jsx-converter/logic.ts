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
