import type { PageObjectResponse } from "@notionhq/client";
import type { BlockWithChildren } from "../notion/pages.ts";
import { getPageTitle } from "../notion/pages.ts";
import { renderBlock, isListItem } from "./blocks.ts";

/**
 * Convert a page's block tree into a full markdown document.
 */
export function blocksToMarkdown(
  blocks: BlockWithChildren[],
  page?: PageObjectResponse
): string {
  const parts: string[] = [];

  if (page) {
    parts.push(buildFrontmatter(page));
  }

  parts.push(renderBlocks(blocks, 0));

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

function buildFrontmatter(page: PageObjectResponse): string {
  const title = getPageTitle(page);
  const lines = [
    "---",
    `title: "${escapeYaml(title)}"`,
    `created: ${page.created_time}`,
    `last_edited: ${page.last_edited_time}`,
    "---",
    "",
  ];
  return lines.join("\n");
}

function escapeYaml(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// ---------------------------------------------------------------------------
// Block tree walker
// ---------------------------------------------------------------------------

function renderBlocks(blocks: BlockWithChildren[], depth: number): string {
  const lines: string[] = [];
  const indent = "    ".repeat(depth);

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const prev = i > 0 ? blocks[i - 1]! : null;

    // Tables are fully rendered by the block renderer (includes children)
    if (block.type === "table") {
      lines.push(indentLines(renderBlock(block), indent));
      lines.push("");
      continue;
    }

    const rendered = renderBlock(block);

    // Skip empty renders (column_list, column, synced_block, breadcrumb)
    const hasContent = rendered.length > 0;

    // Blank line management:
    //   - No blank line between consecutive list items of the same type
    //   - Blank line before everything else
    const isList = isListItem(block.type);
    const prevIsList = prev ? isListItem(prev.type) : false;
    const needsBlankBefore = hasContent && !(isList && prevIsList);

    if (needsBlankBefore && lines.length > 0) {
      // Only add blank line if the last line isn't already blank
      if (lines.at(-1) !== "") {
        lines.push("");
      }
    }

    if (hasContent) {
      lines.push(indentLines(rendered, indent));
    }

    // Render children (for everything except tables, which handle their own)
    if (block.children.length > 0) {
      const childDepth = isList || block.type === "toggle" || block.type === "callout"
        ? depth + 1
        : depth;
      const childMd = renderBlocks(block.children, childDepth);
      if (childMd.trim()) {
        lines.push(childMd);
      }
    }
  }

  return lines.join("\n");
}

function indentLines(text: string, indent: string): string {
  if (!indent) return text;
  return text
    .split("\n")
    .map((line) => (line ? indent + line : line))
    .join("\n");
}
