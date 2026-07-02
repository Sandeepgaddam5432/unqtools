/**
 * Color Picker / Converter — Preact island UI.
 */
import { useMemo, useState } from "preact/hooks";
import { Input, Button, Card, CopyButton, ToastContainer, toast } from "../../../components/ui";
import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
  rgbToCss,
  hslToCss,
  checkContrast,
  generateShades,
  complementary,
  type RGB,
} from "./logic";

export default function ColorPicker() {
  const [hex, setHex] = useState<string>("#3B82F6");
  const [rgb, setRgb] = useState<RGB>({ r: 59, g: 130, b: 246 });
  const [fgHex, setFgHex] = useState<string>("#FFFFFF");
  const [bgHex, setBgHex] = useState<string>("#3B82F6");

  function updateFromHex(newHex: string) {
    setHex(newHex);
    const r = hexToRgb(newHex);
    if (r) setRgb(r);
  }

  function updateFromRgb(field: keyof RGB, value: number) {
    const newRgb = { ...rgb, [field]: value };
    setRgb(newRgb);
    setHex(rgbToHex(newRgb));
  }

  const hsl = useMemo(() => rgbToHsl(rgb), [rgb]);
  const hsv = useMemo(() => rgbToHsv(rgb), [rgb]);
  const shades = useMemo(() => generateShades(rgb, 11), [rgb]);
  const comp = useMemo(() => complementary(rgb), [rgb]);

  const contrast = useMemo(() => {
    const fg = hexToRgb(fgHex);
    const bg = hexToRgb(bgHex);
    if (!fg || !bg) return null;
    return checkContrast(fg, bg);
  }, [fgHex, bgHex]);

  function loadSample() {
    updateFromHex("#FF6B35");
    setFgHex("#FFFFFF");
    setBgHex("#FF6B35");
    toast("Sample loaded", "info");
  }

  return (
    <div class="space-y-4">
      <ToastContainer />

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card class="!p-4 lg:col-span-1">
          <label class="mb-2 block text-sm font-medium">Color picker</label>
          <input
            type="color"
            value={hex.slice(0, 7)}
            onInput={(e) => updateFromHex((e.currentTarget as HTMLInputElement).value)}
            class="h-32 w-full cursor-pointer rounded-unq border border-unq-border"
            aria-label="Color picker"
          />
          <div
            class="mt-3"
            style={{ backgroundColor: rgbToCss(rgb), height: "48px" }}
            class="rounded-unq border border-unq-border"
          />
        </Card>

        <Card class="!p-4 lg:col-span-2">
          <p class="mb-3 text-sm font-semibold">Color values</p>

          <div class="space-y-3">
            <div>
              <label class="text-xs text-unq-muted">HEX</label>
              <div class="flex gap-2">
                <Input
                  value={hex}
                  onInput={(e) => updateFromHex((e.currentTarget as HTMLInputElement).value)}
                  class="font-mono"
                />
                <CopyButton getText={() => hex} />
              </div>
            </div>

            <div>
              <label class="text-xs text-unq-muted">RGB</label>
              <div class="grid grid-cols-3 gap-2">
                <Input
                  type="number"
                  min={0}
                  max={255}
                  value={rgb.r}
                  onInput={(e) =>
                    updateFromRgb("r", Number((e.currentTarget as HTMLInputElement).value))
                  }
                />
                <Input
                  type="number"
                  min={0}
                  max={255}
                  value={rgb.g}
                  onInput={(e) =>
                    updateFromRgb("g", Number((e.currentTarget as HTMLInputElement).value))
                  }
                />
                <Input
                  type="number"
                  min={0}
                  max={255}
                  value={rgb.b}
                  onInput={(e) =>
                    updateFromRgb("b", Number((e.currentTarget as HTMLInputElement).value))
                  }
                />
              </div>
              <div class="mt-1 flex items-center justify-between">
                <code class="text-xs">{rgbToCss(rgb)}</code>
                <CopyButton getText={() => rgbToCss(rgb)} />
              </div>
            </div>

            <div>
              <label class="text-xs text-unq-muted">HSL</label>
              <code class="block text-xs">{hslToCss(hsl)}</code>
              <div class="mt-1 flex justify-end">
                <CopyButton getText={() => hslToCss(hsl)} />
              </div>
            </div>

            <div>
              <label class="text-xs text-unq-muted">HSV</label>
              <code class="block text-xs">
                hsv({hsv.h}, {hsv.s}%, {hsv.v}%)
              </code>
            </div>
          </div>
        </Card>
      </div>

      <Card class="!p-4">
        <p class="mb-3 text-sm font-semibold">Shades & tints</p>
        <div class="grid grid-cols-11 gap-1">
          {shades.map((s) => (
            <div key={s.pct} class="text-center">
              <div
                class="h-12 cursor-pointer rounded-unq border border-unq-border"
                style={{ backgroundColor: s.hex }}
                onClick={() => updateFromHex(s.hex)}
                title={`${s.pct}% — ${s.hex}`}
              />
              <p class="mt-1 text-[10px] text-unq-muted">{s.pct}%</p>
            </div>
          ))}
        </div>
      </Card>

      <Card class="!p-4">
        <p class="mb-3 text-sm font-semibold">Complementary color</p>
        <div class="flex items-center gap-4">
          <div
            class="h-16 w-16 rounded-unq border border-unq-border"
            style={{ backgroundColor: rgbToCss(rgb) }}
            title="Original"
          />
          <span class="text-2xl">→</span>
          <div
            class="h-16 w-16 cursor-pointer rounded-unq border border-unq-border"
            style={{ backgroundColor: rgbToCss(comp) }}
            onClick={() => updateFromHex(rgbToHex(comp))}
            title="Complementary"
          />
          <div class="ml-2">
            <p class="text-xs text-unq-muted">Complement</p>
            <code class="text-sm">{rgbToHex(comp)}</code>
            <div class="mt-1">
              <CopyButton getText={() => rgbToHex(comp)} />
            </div>
          </div>
        </div>
      </Card>

      <Card class="!p-4">
        <p class="mb-3 text-sm font-semibold">WCAG contrast checker</p>
        <div class="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-unq-muted">Foreground</label>
            <div class="flex gap-2">
              <input
                type="color"
                value={fgHex.slice(0, 7)}
                onInput={(e) => setFgHex((e.currentTarget as HTMLInputElement).value)}
                class="h-10 w-12 rounded border border-unq-border"
              />
              <Input
                value={fgHex}
                onInput={(e) => setFgHex((e.currentTarget as HTMLInputElement).value)}
                class="font-mono"
              />
            </div>
          </div>
          <div>
            <label class="text-xs text-unq-muted">Background</label>
            <div class="flex gap-2">
              <input
                type="color"
                value={bgHex.slice(0, 7)}
                onInput={(e) => setBgHex((e.currentTarget as HTMLInputElement).value)}
                class="h-10 w-12 rounded border border-unq-border"
              />
              <Input
                value={bgHex}
                onInput={(e) => setBgHex((e.currentTarget as HTMLInputElement).value)}
                class="font-mono"
              />
            </div>
          </div>
        </div>

        {contrast && (
          <>
            <div class="unq-card mb-3 p-4" style={{ backgroundColor: bgHex, color: fgHex }}>
              <p class="text-3xl font-bold">The quick brown fox jumps over the lazy dog.</p>
              <p class="mt-1 text-lg">1234567890</p>
            </div>

            <div class="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
              <div
                class={`unq-card p-2 ${contrast.aaNormal ? "border-unq-success" : "border-unq-danger"}`}
              >
                <p class="text-base font-bold">{contrast.ratio}:1</p>
                <p class="text-unq-muted">AA normal</p>
                <p>{contrast.aaNormal ? "✓ Pass" : "✗ Fail"}</p>
              </div>
              <div
                class={`unq-card p-2 ${contrast.aaLarge ? "border-unq-success" : "border-unq-danger"}`}
              >
                <p class="text-base font-bold">{contrast.ratio}:1</p>
                <p class="text-unq-muted">AA large</p>
                <p>{contrast.aaLarge ? "✓ Pass" : "✗ Fail"}</p>
              </div>
              <div
                class={`unq-card p-2 ${contrast.aaaNormal ? "border-unq-success" : "border-unq-danger"}`}
              >
                <p class="text-base font-bold">{contrast.ratio}:1</p>
                <p class="text-unq-muted">AAA normal</p>
                <p>{contrast.aaaNormal ? "✓ Pass" : "✗ Fail"}</p>
              </div>
              <div
                class={`unq-card p-2 ${contrast.aaaLarge ? "border-unq-success" : "border-unq-danger"}`}
              >
                <p class="text-base font-bold">{contrast.ratio}:1</p>
                <p class="text-unq-muted">AAA large</p>
                <p>{contrast.aaaLarge ? "✓ Pass" : "✗ Fail"}</p>
              </div>
            </div>
          </>
        )}
      </Card>

      <Card class="!p-4">
        <Button variant="ghost" onClick={loadSample}>
          Load sample
        </Button>
      </Card>

      <Card class="!p-4 text-xs text-unq-muted">
        <p>
          <strong>Privacy:</strong> all color math runs locally in your browser. Conversions are
          mathematically exact. WCAG contrast uses the official relative-luminance formula.
        </p>
      </Card>
    </div>
  );
}
