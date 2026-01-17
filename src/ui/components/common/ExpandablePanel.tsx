/**
 * Expandable Panel Component
 * Reusable collapsible panel with consistent styling
 */

import { useState, type ReactNode } from "react";

export interface ExpandablePanelProps {
  /** Panel title */
  title: string;
  /** Title color class (e.g., 'text-cyan-400') */
  titleColor?: string;
  /** Optional badge shown next to the title */
  badge?: ReactNode;
  /** Optional status badge (e.g., "Active", "3 Species") */
  statusBadge?: {
    text: string;
    color: string;
  };
  /** Whether the panel is expanded by default */
  defaultExpanded?: boolean;
  /** Panel contents */
  children: ReactNode;
  /** Additional class names for the container */
  className?: string;
}

export function ExpandablePanel({
  title,
  titleColor = "text-zinc-300",
  badge,
  statusBadge,
  defaultExpanded = false,
  children,
  className = "",
}: ExpandablePanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      className={`p-4 bg-zinc-900 rounded-lg border border-zinc-800 ${className}`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <h3 className={`font-medium ${titleColor}`}>{title}</h3>
          {badge}
          {statusBadge && (
            <span
              className={`text-xs px-2 py-0.5 rounded ${statusBadge.color}`}
            >
              {statusBadge.text}
            </span>
          )}
        </div>
        <span className="text-zinc-500">{isExpanded ? "−" : "+"}</span>
      </button>

      {isExpanded && <div className="mt-4">{children}</div>}
    </div>
  );
}
