/**
 * Stock Ticker Widget — pure logic.
 *
 * Generates an embeddable HTML/JS widget that displays a delayed
 * stock-quote ticker. Uses Yahoo Finance's public chart endpoint
 * (`query1.finance.yahoo.com/v8/finance/chart/SYMBOL`) which requires
 * no API key.
 *
 * The generator is fully local — no network calls happen during
 * snippet generation. The fetch runs only when the snippet is loaded
 * in a browser.
 */

export type Theme = "light" | "dark";

export interface StockWidgetConfig {
  /** Ticker symbols (e.g. AAPL, MSFT, TSLA). */
  symbols: string[];
  /** Refresh interval in seconds (30-3600). */
  refreshSeconds?: number;
  /** Display width in pixels. */
  width?: number;
  /** Display height in pixels. */
  height?: number;
  theme?: Theme;
  accentColor?: string;
  showChange?: boolean;
  locale?: string;
}

export interface WidgetResult {
  html: string;
  cssInline: string;
  config: StockWidgetConfig;
  estimatedBytes: number;
  warnings: string[];
}

const POPULAR_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "NFLX", "JPM", "V", "WMT", "DIS", "BABA", "INTC", "AMD"];

export function listPopularSymbols(): string[] {
  return POPULAR_SYMBOLS;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function validateSymbol(sym: string): boolean {
  return /^[A-Z]{1,8}([.\-][A-Z]{1,4})?$/.test(sym);
}

export function generateWidget(config: StockWidgetConfig): WidgetResult | { error: string } {
  if (!config.symbols || config.symbols.length === 0) return { error: "At least one symbol is required." };
  if (config.symbols.length > 10) return { error: "Maximum 10 symbols per widget." };
  for (const s of config.symbols) {
    if (!validateSymbol(s)) return { error: `Invalid ticker symbol: ${s}` };
  }
  const refresh = config.refreshSeconds ?? 60;
  if (refresh < 30 || refresh > 3600) return { error: "Refresh interval must be between 30 and 3600 seconds." };

  const warnings: string[] = [];
  if (refresh < 60) warnings.push("Refresh below 60s may be rate-limited by Yahoo Finance.");
  if (config.symbols.length > 5) warnings.push("Many symbols increases load time and risk of throttling.");

  const theme = config.theme ?? "light";
  const accent = config.accentColor ?? "#0ea5e9";
  const width = config.width ?? 320;
  const height = config.height ?? 220;
  const showChange = config.showChange ?? true;
  const locale = config.locale ?? "en-US";

  const cssInline = `
.stw-root{font-family:system-ui,-apple-system,sans-serif;box-sizing:border-box;border:1px solid #e5e7eb;border-radius:12px;padding:12px;background:${theme === "dark" ? "#0f172a" : "#ffffff"};color:${theme === "dark" ? "#f1f5f9" : "#0f172a"};width:${width}px;max-width:100%;}
.stw-title{font-size:12px;font-weight:600;color:${theme === "dark" ? "#94a3b8" : "#64748b"};margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em;}
.stw-row{display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid ${theme === "dark" ? "#1e293b" : "#f1f5f9"};font-size:13px;}
.stw-row:last-child{border-bottom:none;}
.stw-sym{font-weight:700;color:${accent};}
.stw-price{font-weight:600;font-variant-numeric:tabular-nums;}
.stw-change{font-size:11px;margin-left:6px;}
.stw-change.up{color:#10b981;}
.stw-change.down{color:#ef4444;}
.stw-foot{font-size:10px;color:${theme === "dark" ? "#64748b" : "#94a3b8"};margin-top:6px;text-align:right;}
`.trim();

  const symbolsAttr = esc(config.symbols.join(","));

  const html = `<div class="stw-root" data-symbols="${symbolsAttr}" data-locale="${esc(locale)}" data-show-change="${showChange}" data-theme="${theme}">
  <div class="stw-title">Stock Prices</div>
  <div class="stw-body">Loading…</div>
  <div class="stw-foot">Delayed · Yahoo Finance · ${refresh}s</div>
</div>
<script>
(function(){
  var root=document.currentScript.previousElementSibling;
  var symbols=root.getAttribute("data-symbols").split(",");
  var locale=root.getAttribute("data-locale");
  var showChange=root.getAttribute("data-show-change")==="true";
  var body=root.querySelector(".stw-body");
  function fmt(n){return new Intl.NumberFormat(locale,{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n);}
  function refresh(){
    var pending=0;var results={};
    symbols.forEach(function(sym){
      pending++;
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/"+sym+"?interval=1d&range=1d")
        .then(function(r){return r.json();})
        .then(function(d){
          var meta=d.chart&&d.chart.result&&d.chart.result[0]&&d.chart.result[0].meta;
          if(meta){results[sym]={price:meta.regularMarketPrice,prev:meta.chartPreviousClose};}
        })
        .catch(function(){})
        .finally(function(){
          pending--;
          if(pending===0){
            var html="";
            symbols.forEach(function(sym){
              var r=results[sym];
              if(!r){html+='<div class="stw-row"><span class="stw-sym">'+sym+'</span><span class="stw-price">—</span></div>';return;}
              var change=r.price-r.prev;
              var pct=r.prev?(change/r.prev*100):0;
              var cls=change>=0?"up":"down";
              html+='<div class="stw-row"><span class="stw-sym">'+sym+'</span><div><span class="stw-price">'+fmt(r.price)+'</span>'+(showChange?'<span class="stw-change '+cls+'">'+(change>=0?"+":"")+pct.toFixed(2)+'%</span>':'')+'</div></div>';
            });
            body.innerHTML=html;
          }
        });
    });
  }
  refresh();
  setInterval(refresh,${refresh * 1000});
})();
</script>`;

  return { html, cssInline, config, estimatedBytes: html.length + cssInline.length, warnings };
}

/** Build a single-file HTML page that contains the widget for previewing. */
export function buildPreviewPage(result: WidgetResult): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>Stock Widget Preview</title>
<style>${result.cssInline}</style></head>
<body style="background:#f8fafc;padding:24px;display:flex;justify-content:center;">
${result.html}
</body></html>`;
}

/** Format widget config as a plain-text description for sharing. */
export function describeConfig(config: StockWidgetConfig): string {
  const lines = [
    `Symbols: ${config.symbols.join(", ")}`,
    `Refresh: ${config.refreshSeconds ?? 60}s`,
    `Width × Height: ${config.width ?? 320} × ${config.height ?? 220}`,
    `Theme: ${config.theme ?? "light"}`,
    `Accent: ${config.accentColor ?? "#0ea5e9"}`,
    `Show change: ${config.showChange ?? true}`,
  ];
  return lines.join("\n");
}
