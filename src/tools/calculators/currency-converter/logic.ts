/**
 * Currency Converter — pure logic, fully offline.
 * Uses a built-in reference-rate table (rates per 1 USD). Honest note:
 * these are approximate reference values, not live market rates.
 */

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  /** units per 1 USD (reference only) */
  perUsd: number;
}

export const CURRENCIES: Currency[] = [
  { code: "USD", name: "US Dollar", symbol: "$", perUsd: 1 },
  { code: "EUR", name: "Euro", symbol: "€", perUsd: 0.92 },
  { code: "GBP", name: "British Pound", symbol: "£", perUsd: 0.79 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", perUsd: 150.2 },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", perUsd: 7.21 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", perUsd: 83.4 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", perUsd: 1.52 },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", perUsd: 1.36 },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", perUsd: 0.88 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", perUsd: 1.34 },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", perUsd: 7.81 },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", perUsd: 1.66 },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", perUsd: 10.5 },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", perUsd: 10.8 },
  { code: "DKK", name: "Danish Krone", symbol: "kr", perUsd: 6.86 },
  { code: "PLN", name: "Polish Zloty", symbol: "zł", perUsd: 3.99 },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč", perUsd: 23.2 },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft", perUsd: 356 },
  { code: "RON", name: "Romanian Leu", symbol: "lei", perUsd: 4.58 },
  { code: "BGN", name: "Bulgarian Lev", symbol: "лв", perUsd: 1.8 },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", perUsd: 32.5 },
  { code: "RUB", name: "Russian Ruble", symbol: "₽", perUsd: 92 },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", perUsd: 5.1 },
  { code: "MXN", name: "Mexican Peso", symbol: "Mex$", perUsd: 17.3 },
  { code: "ARS", name: "Argentine Peso", symbol: "AR$", perUsd: 890 },
  { code: "ZAR", name: "South African Rand", symbol: "R", perUsd: 18.6 },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", perUsd: 3.67 },
  { code: "SAR", name: "Saudi Riyal", symbol: "ر.س", perUsd: 3.75 },
  { code: "KRW", name: "South Korean Won", symbol: "₩", perUsd: 1350 },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", perUsd: 15800 },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", perUsd: 4.72 },
  { code: "THB", name: "Thai Baht", symbol: "฿", perUsd: 36.4 },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", perUsd: 56.5 },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫", perUsd: 25000 },
  { code: "ILS", name: "Israeli Shekel", symbol: "₪", perUsd: 3.68 },
];

export function getCurrency(code: string): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

/** Convert an amount from one currency to another. */
export function convert(
  amount: number,
  from: string,
  to: string,
): { value: number; from: string; to: string; fromSymbol: string; toSymbol: string } {
  const f = getCurrency(from);
  const t = getCurrency(to);
  const value = (amount / f.perUsd) * t.perUsd;
  return {
    value,
    from: from,
    to: to,
    fromSymbol: f.symbol,
    toSymbol: t.symbol,
  };
}

/** Format a number with thousands separators and fixed decimals. */
export function formatMoney(value: number, decimals = 2): string {
  const fixed = Number.isFinite(value) ? value : 0;
  return fixed.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

/** Build a conversion table from one base currency to all others. */
export function convertToAll(
  amount: number,
  from: string,
): { code: string; name: string; symbol: string; value: number }[] {
  const f = getCurrency(from);
  return CURRENCIES.map((c) => ({
    code: c.code,
    name: c.name,
    symbol: c.symbol,
    value: (amount / f.perUsd) * c.perUsd,
  }));
}

/** CSV export of a conversion table. */
export function tableToCsv(rows: { code: string; name: string; symbol: string; value: number }[]): string {
  const header = "code,currency,symbol,value";
  const body = rows.map((r) => `${r.code},"${r.name}","${r.symbol}",${r.value}`);
  return [header, ...body].join("\n");
}
