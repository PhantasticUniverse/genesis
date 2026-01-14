/**
 * Range Slider Component
 * Labeled slider with value display and optional description
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
  /** Accent color class (e.g., 'accent-cyan-500') */
  accentColor?: string;
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
  accentColor = 'accent-cyan-500',
}: RangeSliderProps) {
  const displayValue = formatValue ? formatValue(value) : value.toFixed(2);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <label className="text-zinc-400">{label}</label>
        <span className="font-mono text-zinc-500">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className={`w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer ${accentColor} disabled:opacity-50 disabled:cursor-not-allowed`}
      />
      {description && (
        <p className="text-xs text-zinc-600">{description}</p>
      )}
    </div>
  );
}
