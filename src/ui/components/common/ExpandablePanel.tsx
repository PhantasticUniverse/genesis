/**
 * Expandable Panel Component - Glass Morphism Style
 * Reusable collapsible panel with bioluminescent theme
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
  /** Accent color for glow effects: 'cyan' | 'magenta' | 'amber' | 'green' */
  accent?: "cyan" | "magenta" | "amber" | "green";
}

export function ExpandablePanel({
  title,
  titleColor = "text-bio-cyan",
  badge,
  statusBadge,
  defaultExpanded = false,
  children,
  className = "",
  accent = "cyan",
}: ExpandablePanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Get accent-specific classes
  const accentBorderClass = {
    cyan: "hover:border-[rgba(0,245,255,0.3)]",
    magenta: "hover:border-[rgba(255,0,255,0.3)]",
    amber: "hover:border-[rgba(255,170,0,0.3)]",
    green: "hover:border-[rgba(0,255,136,0.3)]",
  }[accent];

  const accentGlowClass = {
    cyan: "group-hover:text-bio-cyan",
    magenta: "group-hover:text-bio-magenta",
    amber: "group-hover:text-bio-amber",
    green: "group-hover:text-bio-green",
  }[accent];

  return (
    <div
      className={`glass-panel p-4 transition-all duration-300 ${accentBorderClass} ${className}`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="group w-full flex items-center justify-between text-left transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3
            className={`font-display text-sm tracking-wide ${titleColor} transition-all duration-300`}
          >
            {title}
          </h3>
          {badge}
          {statusBadge && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge.color}`}
            >
              {statusBadge.text}
            </span>
          )}
        </div>
        <svg
          className={`expand-icon w-4 h-4 text-zinc-500 ${accentGlowClass} ${isExpanded ? "expanded" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <div className={`panel-content ${isExpanded ? "expanded" : ""}`}>
        <div>
          <div className="pt-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
