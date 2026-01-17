/**
 * Range Slider Component - Bioluminescent Theme
 * Custom styled slider with glowing thumb and gradient fill
 */

export interface RangeSliderProps {
  /** Label text shown above the slider */
  label: string;
  /** Current value */
  value: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Step increment */
  step: number;
  /** Called when value changes */
  onChange: (value: number) => void;
  /** Whether the slider is disabled */
  disabled?: boolean;
  /** Description text shown below the slider */
  description?: string;
  /** Format function for displaying the value */
  formatValue?: (value: number) => string;
  /** Accent color: 'cyan' | 'magenta' | 'amber' | 'green' */
  accent?: "cyan" | "magenta" | "amber" | "green";
}

export function RangeSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled = false,
  description,
  formatValue,
  accent = "cyan",
}: RangeSliderProps) {
  const displayValue = formatValue ? formatValue(value) : value.toFixed(2);

  // Calculate fill percentage
  const fillPercent = ((value - min) / (max - min)) * 100;

  // Accent color CSS variable
  const accentColor = {
    cyan: "var(--bio-cyan)",
    magenta: "var(--bio-magenta)",
    amber: "var(--bio-amber)",
    green: "var(--bio-green)",
  }[accent];

  const accentColorDim = {
    cyan: "var(--bio-cyan-dim)",
    magenta: "var(--bio-magenta-dim)",
    amber: "var(--bio-amber-dim)",
    green: "var(--bio-green-dim)",
  }[accent];

  const labelColorClass = {
    cyan: "text-bio-cyan",
    magenta: "text-bio-magenta",
    amber: "text-bio-amber",
    green: "text-bio-green",
  }[accent];

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label
          className={`text-xs font-display tracking-wider uppercase ${labelColorClass}`}
        >
          {label}
        </label>
        <span
          className="font-mono text-sm px-2 py-0.5 rounded bg-genesis-surface border border-[rgba(0,245,255,0.1)]"
          style={{ color: accentColor }}
        >
          {displayValue}
        </span>
      </div>

      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="genesis-slider w-full"
          style={{
            background: `linear-gradient(to right, ${accentColorDim} 0%, ${accentColor} ${fillPercent}%, var(--genesis-surface) ${fillPercent}%, var(--genesis-surface) 100%)`,
            // Override the thumb border color for accent
            // @ts-expect-error custom CSS property
            "--slider-accent": accentColor,
          }}
        />
      </div>

      {description && (
        <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
      )}
    </div>
  );
}
