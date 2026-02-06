import type { BlockObjectResponse } from "@notionhq/client";
import type { BlockWithChildren } from "../notion/pages.ts";
import { renderRichText } from "./rich-text.ts";

/**
 * Render a single block (without its children) into markdown line(s).
 * Children are handled by the assembler, which calls back into this
 * for nested content with the appropriate indentation.
 */
export function renderBlock(block: BlockWithChildren): string {
  switch (block.type) {
    case "paragraph":
      return renderRichText(block.paragraph.rich_text);

    case "heading_1":
      return `# ${renderRichText(block.heading_1.rich_text)}`;

    case "heading_2":
      return `## ${renderRichText(block.heading_2.rich_text)}`;

    case "heading_3":
      return `### ${renderRichText(block.heading_3.rich_text)}`;

    case "bulleted_list_item":
      return `- ${renderRichText(block.bulleted_list_item.rich_text)}`;

    case "numbered_list_item":
      return `1. ${renderRichText(block.numbered_list_item.rich_text)}`;

    case "to_do": {
      const checkbox = block.to_do.checked ? "[x]" : "[ ]";
      return `- ${checkbox} ${renderRichText(block.to_do.rich_text)}`;
    }

    case "code": {
      const lang = block.code.language !== "plain text" ? block.code.language : "";
      const code = renderRichText(block.code.rich_text);
      const caption = renderRichText(block.code.caption);
      let result = `\`\`\`${lang}\n${code}\n\`\`\``;
      if (caption) {
        result += `\n*${caption}*`;
      }
      return result;
    }

    case "quote":
      return renderRichText(block.quote.rich_text)
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");

    case "callout": {
      const icon = renderIcon(block.callout.icon);
      const text = renderRichText(block.callout.rich_text);
      return `> ${icon}${text}`;
    }

    case "divider":
      return "---";

    case "image":
      return renderImage(block);

    case "video":
      return renderFileBlock(block.video, "video");

    case "audio":
      return renderFileBlock(block.audio, "audio");

    case "file":
      return renderFileBlock(block.file, "file");

    case "pdf":
      return renderFileBlock(block.pdf, "pdf");

    case "bookmark": {
      const caption = renderRichText(block.bookmark.caption);
      const label = caption || block.bookmark.url;
      return `[${label}](${block.bookmark.url})`;
    }

    case "embed": {
      const caption = renderRichText(block.embed.caption);
      const label = caption || "embed";
      return `[${label}](${block.embed.url})`;
    }

    case "link_preview":
      return `[${block.link_preview.url}](${block.link_preview.url})`;

    case "toggle":
      // Summary line in bold; children are rendered by the assembler
      return `**${renderRichText(block.toggle.rich_text)}**`;

    case "equation":
      return `$$\n${block.equation.expression}\n$$`;

    case "table":
      return renderTable(block);

    case "table_of_contents":
      return "<!-- table of contents -->";

    case "breadcrumb":
      return "";

    case "column_list":
      // Children (columns) are rendered by the assembler
      return "";

    case "column":
      // Children are rendered by the assembler
      return "";

    case "child_page":
      return `**[${block.child_page.title}](./${encodeURIComponent(block.child_page.title)}.md)**`;

    case "child_database":
      return `**[${block.child_database.title}](./${encodeURIComponent(block.child_database.title)}/_index.csv)**`;

    case "synced_block":
      // Children are rendered by the assembler
      return "";

    default:
      return `<!-- unsupported: ${block.type} -->`;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderIcon(icon: { type: string; [key: string]: any } | null): string {
  if (!icon) return "";
  if (icon.type === "emoji" && "emoji" in icon) return `${icon.emoji} `;
  return "";
}

function renderImage(block: BlockObjectResponse & { type: "image" }): string {
  const caption = renderRichText(block.image.caption);
  const url =
    block.image.type === "external"
      ? block.image.external.url
      : block.image.file.url;
  return `![${caption}](${url})`;
}

interface FileRef {
  type: string;
  caption: { type: "rich_text"; rich_text: Array<any> } extends infer _ ? any : never;
  [key: string]: any;
}

function renderFileBlock(file: FileRef, label: string): string {
  const caption = file.caption ? renderRichText(file.caption) : "";
  let url = "";
  if (file.type === "external") {
    url = file.external?.url ?? "";
  } else if (file.type === "file") {
    url = file.file?.url ?? "";
  }
  const display = caption || label;
  return url ? `[${display}](${url})` : display;
}

/**
 * Render a table block and its table_row children into a GFM pipe table.
 */
function renderTable(block: BlockWithChildren): string {
  const rows = block.children;
  if (rows.length === 0) return "";

  const lines: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.type !== "table_row") continue;

    const cells = row.table_row.cells.map((cell: any[]) =>
      renderRichText(cell).replace(/\|/g, "\\|")
    );

    lines.push(`| ${cells.join(" | ")} |`);

    // After the header row, add the separator
    if (i === 0) {
      lines.push(`| ${cells.map(() => "---").join(" | ")} |`);
    }
  }

  return lines.join("\n");
}

/** Check if a block type is a list item (used by the assembler for grouping). */
export function isListItem(type: string): boolean {
  return (
    type === "bulleted_list_item" ||
    type === "numbered_list_item" ||
    type === "to_do"
  );
}
