/**
 * Markdown Preview — pure logic.
 * Markdown to HTML conversion with GitHub-flavored features.
 */

export function mdToHtml(md: string): string {
  let html = md;
  // Code blocks (fenced)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => `<pre><code class="language-${lang}">${escapeHtml(code.trimEnd())}</code></pre>`);
  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Headers
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  // Bold and italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  // Links
  html = html.replace(/\[([^]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // Images
  html = html.replace(/!\[([^]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  // Blockquote
  html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");
  // Unordered lists
  html = html.replace(/^(\s*)[-*] (.+)$/gm, "$1<li>$2</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, (match) => match.includes("<ul>") ? match : `<ul>${match}</ul>`);
  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
  // Horizontal rule
  html = html.replace(/^---$/gm, "<hr/>");
  // Line breaks
  html = html.replace(/\n\n/g, "</p><p>");
  html = `<p>${html}</p>`;
  // Clean up empty p tags
  html = html.replace(/<p>\s*<\/p>/g, "");
  return html;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function getWordCount(md: string): number {
  return md.split(/\s+/).filter(Boolean).length;
}

export function getReadingTime(md: string): number {
  return Math.ceil(getWordCount(md) / 200);
}

export function getTableOfContents(md: string): { level: number; text: string; id: string }[] {
  const headers: { level: number; text: string; id: string }[] = [];
  const lines = md.split("\n");
  for (const line of lines) {
    const m = line.match(/^(#{1,4})\s+(.+)$/);
    if (m) {
      const level = m[1].length;
      const text = m[2].trim();
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      headers.push({ level, text, id });
    }
  }
  return headers;
}

export function getMarkdownStats(md: string): { words: number; chars: number; lines: number; headers: number; links: number; images: number; codeBlocks: number } {
  return {
    words: getWordCount(md),
    chars: md.length,
    lines: md.split("\n").length,
    headers: (md.match(/^#{1,4}\s/gm) || []).length,
    links: (md.match(/\[([^]]+)\]\(([^)]+)\)/g) || []).length,
    images: (md.match(/!\[/g) || []).length,
    codeBlocks: (md.match(/```/g) || []).length / 2,
  };
}
