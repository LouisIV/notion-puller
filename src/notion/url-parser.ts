/**
 * Parse a Notion reference string into a normalized UUID.
 *
 * Accepted formats:
 *   - Raw 32-char hex (no dashes):  `abc123def456...`
 *   - UUID with dashes:             `abc123de-f456-...`
 *   - Notion page URL:              `https://www.notion.so/workspace/Page-Title-abc123def456...`
 *   - Notion DB URL with view:      `https://www.notion.so/workspace/abc123def456...?v=...`
 *   - Notion URL with path ID:      `https://www.notion.so/abc123def456...`
 */

const UUID_BARE = /^[0-9a-f]{32}$/i;
const UUID_DASHED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Add dashes to a bare 32-char hex string to form a standard UUID. */
function toDashedUuid(hex: string): string {
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/** Extract the last 32 hex chars from a URL path segment (Notion appends the ID at the end of slugs). */
function extractIdFromPath(path: string): string | null {
  // Remove query string and hash
  const clean = path.split("?")[0]!.split("#")[0]!;

  // Get the last path segment
  const segments = clean.split("/").filter(Boolean);
  const last = segments.at(-1);
  if (!last) return null;

  // The ID is the last 32 hex chars of the segment (may follow a title slug with a dash separator)
  const match = last.match(/([0-9a-f]{32})$/i);
  if (match) return match[1]!;

  // Or it could be a dashed UUID
  const dashedMatch = last.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
  );
  if (dashedMatch) return dashedMatch[1]!.replace(/-/g, "");

  return null;
}

export interface ParsedReference {
  /** Normalized UUID with dashes */
  id: string;
}

/**
 * Parse any supported Notion reference format into a normalized UUID.
 * Throws if the input cannot be parsed.
 */
export function parseNotionReference(input: string): ParsedReference {
  const trimmed = input.trim();

  // Bare 32-char hex
  if (UUID_BARE.test(trimmed)) {
    return { id: toDashedUuid(trimmed) };
  }

  // Already a dashed UUID
  if (UUID_DASHED.test(trimmed)) {
    return { id: trimmed.toLowerCase() };
  }

  // URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw new Error(`Invalid URL: ${trimmed}`);
    }

    if (!url.hostname.includes("notion")) {
      throw new Error(`Not a Notion URL: ${trimmed}`);
    }

    const hex = extractIdFromPath(url.pathname);
    if (!hex) {
      throw new Error(
        `Could not extract a Notion ID from URL: ${trimmed}`
      );
    }

    return { id: toDashedUuid(hex) };
  }

  throw new Error(
    `Unrecognized Notion reference: "${trimmed}". Expected a page/database ID or Notion URL.`
  );
}
