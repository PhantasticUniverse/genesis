/**
 * Stat Grid Component - Bioluminescent Theme
 * Grid of labeled statistics with glass card styling
 */

export interface StatItem {
  /** Label text */
  label: string;
  /** Value to display */
  value: string | number;
  /** Optional color class for the value (e.g., 'text-bio-cyan') */
  color?: string;
}

export interface StatGridProps {
  /** Array of stat items to display */
  stats: StatItem[];
  /** Number of columns (2 or 3) */
  columns?: 2 | 3;
}

export function StatGrid({ stats, columns = 2 }: StatGridProps) {
  const gridClass = columns === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className={`grid ${gridClass} gap-3 text-xs`}>
      {stats.map((stat, index) => (
        <div key={index} className="stat-card">
          <div className="stat-label">{stat.label}</div>
          <div className={`stat-value ${stat.color || "text-bio-cyan"}`}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}
