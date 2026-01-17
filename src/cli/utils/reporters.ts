/**
 * Output Formatters for CLI
 * Supports JSON, table, and CSV output formats
 */

export type OutputFormat = "json" | "table" | "csv";

export interface ReporterOptions {
  format: OutputFormat;
  pretty?: boolean;
}

/**
 * Format data as JSON
 */
export function formatJSON(data: unknown, pretty = true): string {
  return JSON.stringify(data, replacer, pretty ? 2 : 0);
}

/**
 * JSON replacer to handle special types
 */
function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }
  if (value instanceof Float32Array) {
    return Array.from(value);
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    return value.toString();
  }
  return value;
}

/**
 * Format data as a table
 */
export function formatTable(
  data: Record<string, unknown>[] | Record<string, unknown>,
  headers?: string[],
): string {
  // Handle single object
  if (!Array.isArray(data)) {
    return formatKeyValueTable(data);
  }

  if (data.length === 0) return "(no data)";

  // Get all keys if headers not provided
  const keys = headers ?? Object.keys(data[0]);

  // Calculate column widths
  const widths = keys.map((key) =>
    Math.max(key.length, ...data.map((row) => formatValue(row[key]).length)),
  );

  // Build header row
  const headerRow = keys.map((key, i) => key.padEnd(widths[i])).join(" | ");
  const separator = widths.map((w) => "-".repeat(w)).join("-+-");

  // Build data rows
  const dataRows = data.map((row) =>
    keys.map((key, i) => formatValue(row[key]).padEnd(widths[i])).join(" | "),
  );

  return [headerRow, separator, ...dataRows].join("\n");
}

/**
 * Format key-value pairs as a table
 */
function formatKeyValueTable(data: Record<string, unknown>): string {
  const entries = Object.entries(data);
  if (entries.length === 0) return "(no data)";

  const keyWidth = Math.max(...entries.map(([k]) => k.length));
  const valueWidth = Math.max(...entries.map(([, v]) => formatValue(v).length));

  const separator = "-".repeat(keyWidth) + "-+-" + "-".repeat(valueWidth);

  const rows = entries.map(
    ([key, value]) =>
      `${key.padEnd(keyWidth)} | ${formatValue(value).padEnd(valueWidth)}`,
  );

  return [separator, ...rows, separator].join("\n");
}

/**
 * Format data as CSV
 */
export function formatCSV(
  data: Record<string, unknown>[] | Record<string, unknown>,
  headers?: string[],
): string {
  // Handle single object
  if (!Array.isArray(data)) {
    const entries = Object.entries(data);
    return entries
      .map(([key, value]) => `${key},${escapeCSV(value)}`)
      .join("\n");
  }

  if (data.length === 0) return "";

  // Get all keys if headers not provided
  const keys = headers ?? Object.keys(data[0]);

  // Build header row
  const headerRow = keys.join(",");

  // Build data rows
  const dataRows = data.map((row) =>
    keys.map((key) => escapeCSV(row[key])).join(","),
  );

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Format a single value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value.toString();
    return value.toFixed(4);
  }
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Escape a value for CSV
 */
function escapeCSV(value: unknown): string {
  const str = formatValue(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Report data in the specified format
 */
export function report(data: unknown, options: ReporterOptions): void {
  const { format, pretty } = options;

  switch (format) {
    case "json":
      console.log(formatJSON(data, pretty));
      break;
    case "table":
      if (typeof data === "object" && data !== null) {
        console.log(
          formatTable(
            data as Record<string, unknown>[] | Record<string, unknown>,
          ),
        );
      } else {
        console.log(formatJSON(data, pretty));
      }
      break;
    case "csv":
      if (typeof data === "object" && data !== null) {
        console.log(
          formatCSV(
            data as Record<string, unknown>[] | Record<string, unknown>,
          ),
        );
      } else {
        console.log(String(data));
      }
      break;
  }
}

/**
 * Print a header for command output
 */
export function printHeader(title: string): void {
  const line = "=".repeat(title.length + 4);
  console.log(line);
  console.log(`  ${title}  `);
  console.log(line);
  console.log();
}

/**
 * Print a section header
 */
export function printSection(title: string): void {
  console.log(`\n--- ${title} ---\n`);
}

/**
 * Format timing in human-readable format
 */
export function formatTiming(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}µs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Create a simple progress bar
 */
export function progressBar(
  current: number,
  total: number,
  width = 30,
): string {
  const percent = current / total;
  const filled = Math.round(width * percent);
  const empty = width - filled;
  return `[${"#".repeat(filled)}${"-".repeat(empty)}] ${(percent * 100).toFixed(0)}%`;
}
