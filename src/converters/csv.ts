import type { PageObjectResponse } from "@notionhq/client";
import {
  extractPropertyValue,
  type PropertySchema,
} from "../notion/databases.ts";

/**
 * Convert database entries into a CSV string.
 *
 * Uses the property schema for column ordering (title column first,
 * then alphabetical). Properly escapes fields containing commas,
 * newlines, or double quotes.
 */
export function entriesToCsv(
  entries: PageObjectResponse[],
  schema: PropertySchema
): string {
  // Order columns: title property first, then alphabetically
  const columns = sortColumns(schema);
  const lines: string[] = [];

  // Header row
  lines.push(columns.map((c) => escapeField(c)).join(","));

  // Data rows
  for (const entry of entries) {
    const row = columns.map((colName) => {
      const prop = entry.properties[colName];
      if (!prop) return "";
      return escapeField(extractPropertyValue(prop));
    });
    lines.push(row.join(","));
  }

  return lines.join("\n") + "\n";
}

/**
 * Sort column names: title column first, then alphabetical.
 */
function sortColumns(schema: PropertySchema): string[] {
  let titleCol: string | null = null;
  const others: string[] = [];

  for (const [name, meta] of schema) {
    if (meta.type === "title") {
      titleCol = name;
    } else {
      others.push(name);
    }
  }

  others.sort((a, b) => a.localeCompare(b));
  return titleCol ? [titleCol, ...others] : others;
}

/**
 * Escape a CSV field per RFC 4180:
 *   - If the field contains a comma, newline, or double-quote, wrap in double quotes
 *   - Double quotes within the field are escaped by doubling them
 */
function escapeField(value: string): string {
  if (
    value.includes(",") ||
    value.includes("\n") ||
    value.includes("\r") ||
    value.includes('"')
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
