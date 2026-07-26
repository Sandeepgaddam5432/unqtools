/**
 * Crypto Price Widget — pure logic.
 *
 * Generates a self-contained HTML/JS embed snippet for a crypto price
 * widget. The widget can be styled (size, theme, colour), supports a
 * configurable coin list, refresh interval, and currency target.
 *
 * The generated snippet fetches prices from CoinGecko's free public API
 * (no key required). All generation is local — no network calls during
 * build, only when the user embeds the widget in their page.
 */

export type Theme = "light" | "dark";

export interface CryptoWidgetConfig {
  /** Coin IDs (CoinGecko slug). */
  coins: string[];
  /** Display currency (e.g. usd, eur, gbp). */
  currency: string;
  /** Refresh interval in seconds (15-3600). */
  refreshSeconds?: number;
  /** Width in pixels (responsive if 0). */
  width?: number;
  /** Height in pixels. */
  height?: number;
  theme?: Theme;
  accentColor?: string;
  showChange?: boolean;
  showSparkline?: boolean;
  locale?: string;
}

export interface WidgetResult {
  html: string;
  cssInline: string;
  config: CryptoWidgetConfig;
  estimatedBytes: number;
  warnings: string[];
}

const KNOWN_COINS: Record<string, { name: string; symbol: string }> = {
  bitcoin: { name: "Bitcoin", symbol: "BTC" },
  ethereum: { name: "Ethereum", symbol: "ETH" },
  tether: { name: "Tether", symbol: "USDT" },
  binancecoin: { name: "BNB", symbol: "BNB" },
  solana: { name: "Solana", symbol: "SOL" },
  ripple: { name: "XRP", symbol: "XRP" },
  "usd-coin": { name: "USD Coin", symbol: "USDC" },
  cardano: { name: "Cardano", symbol: "ADA" },
  dogecoin: { name: "Dogecoin", symbol: "DOGE" },
  avalanche: { name: "Avalanche", symbol: "AVAX" },
  polkadot: { name: "Polkadot", symbol: "DOT" },
  chainlink: { name: "Chainlink", symbol: "LINK" },
  polygon: { name: "Polygon", symbol: "MATIC" },
  litecoin: { name: "Litecoin", symbol: "LTC" },
  uniswap: { name: "Uniswap", symbol: "UNI" },
};

export function listKnownCoins(): { id: string; name: string; symbol: string }[] {
  return Object.entries(KNOWN_COINS).map(([id, v]) => ({ id, ...v }));
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function generateWidget(config: CryptoWidgetConfig): WidgetResult | { error: string } {
  if (!config.coins || config.coins.length === 0) return { error: "At least one coin is required." };
  if (config.coins.length > 10) return { error: "Maximum 10 coins per widget." };
  if (!config.currency || !/^[a-z]{3}$/i.test(config.currency)) return { error: "Currency must be a 3-letter ISO code." };
  const refresh = config.refreshSeconds ?? 60;
  if (refresh < 15 || refresh > 3600) return { error: "Refresh interval must be between 15 and 3600 seconds." };
  const warnings: string[] = [];
  for (const c of config.coins) {
    if (!KNOWN_COINS[c]) warnings.push(`"${c}" is not in the known list — widget will still try to fetch it.`);
  }
  if (refresh < 30) warnings.push("Refresh below 30s may hit CoinGecko rate limits (50 calls/min).");
  if (config.coins.length > 5) warnings.push("Many coins increases the API payload and load time.");

  const theme = config.theme ?? "light";
  const accent = config.accentColor ?? "#3b82f6";
  const width = config.width ?? 320;
  const height = config.height ?? 240;
  const showChange = config.showChange ?? true;
  const showSparkline = config.showSparkline ?? false;
  const locale = config.locale ?? "en-US";

  const cssInline = `
.cpw-root{font-family:system-ui,-apple-system,sans-serif;box-sizing:border-box;border:1px solid #e5e7eb;border-radius:12px;padding:12px;background:${theme === "dark" ? "#0f172a" : "#ffffff"};color:${theme === "dark" ? "#f1f5f9" : "#0f172a"};width:${width}px;max-width:100%;}
.cpw-title{font-size:12px;font-weight:600;color:${theme === "dark" ? "#94a3b8" : "#64748b"};margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em;}
.cpw-row{display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid ${theme === "dark" ? "#1e293b" : "#f1f5f9"};font-size:13px;}
.cpw-row:last-child{border-bottom:none;}
.cpw-left{display:flex;align-items:center;gap:6px;}
.cpw-symbol{font-weight:700;font-size:12px;color:${accent};}
.cpw-name{font-size:11px;color:${theme === "dark" ? "#94a3b8" : "#64748b"};}
.cpw-price{font-weight:600;font-variant-numeric:tabular-nums;}
.cpw-change{font-size:11px;margin-left:6px;}
.cpw-change.up{color:#10b981;}
.cpw-change.down{color:#ef4444;}
.cpw-foot{font-size:10px;color:${theme === "dark" ? "#64748b" : "#94a3b8"};margin-top:6px;text-align:right;}
`.trim();

  const coinsAttr = esc(config.coins.join(","));
  const currencyAttr = esc(config.currency.toLowerCase());

  const html = `<div class="cpw-root" data-coins="${coinsAttr}" data-currency="${currencyAttr}" data-locale="${esc(locale)}" data-show-change="${showChange}" data-show-sparkline="${showSparkline}" data-theme="${theme}">
  <div class="cpw-title">Crypto Prices</div>
  <div class="cpw-body">Loading…</div>
  <div class="cpw-foot">Updates every ${refresh}s · CoinGecko</div>
</div>
<script>
(function(){
  var root=document.currentScript.previousElementSibling;
  var coins=root.getAttribute("data-coins").split(",");
  var currency=root.getAttribute("data-currency");
  var locale=root.getAttribute("data-locale");
  var showChange=root.getAttribute("data-show-change")==="true";
  var body=root.querySelector(".cpw-body");
  function fmt(n){return new Intl.NumberFormat(locale,{style:"currency",currency:currency.toUpperCase(),maximumFractionDigits:n<1?6:2}).format(n);}
  function refresh(){
    var url="https://api.coingecko.com/api/v3/simple/price?ids="+coins.join(",")+"&vs_currencies="+currency+"&include_24hr_change=true";
    fetch(url).then(function(r){return r.json();}).then(function(data){
      var html="";
      coins.forEach(function(id){
        var d=data[id];
        if(!d){return;}
        var price=d[currency];
        var change=d[currency+"_24h_change"]||0;
        var cls=change>=0?"up":"down";
        html+='<div class="cpw-row"><div class="cpw-left"><span class="cpw-symbol">'+id.toUpperCase()+'</span><span class="cpw-name">'+id+'</span></div><div><span class="cpw-price">'+fmt(price)+'</span>'+(showChange?'<span class="cpw-change '+cls+'">'+(change>=0?"+":"")+change.toFixed(2)+'%</span>':'')+'</div></div>';
      });
      body.innerHTML=html;
    }).catch(function(){body.innerHTML="Failed to load prices.";});
  }
  refresh();
  setInterval(refresh,${refresh * 1000});
})();
</script>`;

  return {
    html,
    cssInline,
    config,
    estimatedBytes: html.length + cssInline.length,
    warnings,
  };
}

/** Build a single-file HTML page that contains the widget for previewing. */
export function buildPreviewPage(result: WidgetResult): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>Crypto Widget Preview</title>
<style>${result.cssInline}</style></head>
<body style="background:#f8fafc;padding:24px;display:flex;justify-content:center;">
${result.html}
</body></html>`;
}
