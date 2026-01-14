/**
 * Stat Grid Component
 * Grid of labeled statistics with consistent styling
 */

export interface StatItem {
  /** Label text */
  label: string;
  /** Value to display */
  value: string | number;
  /** Optional color class for the value (e.g., 'text-green-400') */
  color?: string;
}

export interface StatGridProps {
  /** Array of stat items to display */
  stats: StatItem[];
  /** Number of columns (2 or 3) */
  columns?: 2 | 3;
}

export function StatGrid({ stats, columns = 2 }: StatGridProps) {
  const gridClass = columns === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className={`grid ${gridClass} gap-2 text-xs`}>
      {stats.map((stat, index) => (
        <div key={index} className="p-2 bg-zinc-800 rounded">
          <div className="text-zinc-500">{stat.label}</div>
          <div className={`font-mono ${stat.color || 'text-zinc-300'}`}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}
