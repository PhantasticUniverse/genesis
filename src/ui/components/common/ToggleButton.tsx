/**
 * Toggle Button Component
 * ON/OFF toggle button with consistent styling
 */

export interface ToggleButtonProps {
  /** Label text shown next to the toggle */
  label: string;
  /** Optional description shown below the label */
  description?: string;
  /** Current toggle state */
  value: boolean;
  /** Called when toggle is clicked */
  onChange: (value: boolean) => void;
  /** Whether the toggle is disabled */
  disabled?: boolean;
  /** Active state background color class (e.g., 'bg-cyan-600') */
  activeColor?: string;
}

export function ToggleButton({
  label,
  description,
  value,
  onChange,
  disabled = false,
  activeColor = "bg-cyan-600",
}: ToggleButtonProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <label className="text-sm text-zinc-400">{label}</label>
        {description && <p className="text-xs text-zinc-600">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        disabled={disabled}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          value ? `${activeColor} text-white` : "bg-zinc-700 text-zinc-400"
        }`}
      >
        {value ? "ON" : "OFF"}
      </button>
    </div>
  );
}
