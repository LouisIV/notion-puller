import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";

/**
 * Sanitize a string for use as a filename.
 * Removes or replaces characters that are unsafe on common filesystems.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_") // unsafe chars → underscore
    .replace(/\s+/g, " ")                     // collapse whitespace
    .replace(/^\.+/, "_")                     // no leading dots
    .trim()
    .slice(0, 200)                            // cap length
    || "Untitled";
}

/**
 * Write content to a file, creating parent directories as needed.
 */
export async function writeOutputFile(
  outputDir: string,
  relativePath: string,
  content: string
): Promise<string> {
  const fullPath = join(outputDir, relativePath);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf-8");
  return fullPath;
}
