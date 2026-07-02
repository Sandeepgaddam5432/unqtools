/**
 * Slider — accessible range input with live value display.
 */

export interface SliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  label?: string;
  id?: string;
  /** Optional formatter (e.g. (v) => `${v}%`) */
  format?: (v: number) => string;
}

export function Slider({ min, max, step = 1, value, onChange, label, id, format }: SliderProps) {
  const sliderId = id ?? `sl-${Math.random().toString(36).slice(2, 9)}`;
  const display = format ? format(value) : String(value);
  return (
    <div class="flex flex-col gap-2">
      {label && (
        <div class="flex items-center justify-between">
          <label for={sliderId} class="text-sm font-medium">
            {label}
          </label>
          <span class="text-unq-text-muted font-mono text-sm tabular-nums">{display}</span>
        </div>
      )}
      <input
        id={sliderId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onInput={(e) => onChange(Number((e.currentTarget as HTMLInputElement).value))}
        class="unq-slider w-full"
        style={`--unq-slider-pct: ${((value - min) / (max - min)) * 100}%`}
        aria-label={label}
      />
    </div>
  );
}
