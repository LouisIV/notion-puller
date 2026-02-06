import type { RichTextItemResponse } from "@notionhq/client";

/**
 * Render an array of Notion rich text items into a markdown string.
 *
 * Handles annotations (bold, italic, strikethrough, code, underline),
 * links, mentions, and inline equations.
 */
export function renderRichText(items: RichTextItemResponse[]): string {
  return items.map(renderRichTextItem).join("");
}

function renderRichTextItem(item: RichTextItemResponse): string {
  let text: string;

  switch (item.type) {
    case "text":
      text = item.text.content;
      break;
    case "mention":
      text = renderMention(item);
      break;
    case "equation":
      // Inline equation: $expression$
      return `$${item.equation.expression}$`;
  }

  // Apply annotations
  text = applyAnnotations(text, item.annotations);

  // Wrap in link if present
  if (item.href) {
    text = `[${text}](${item.href})`;
  }

  return text;
}

function renderMention(item: RichTextItemResponse): string {
  if (item.type !== "mention") return item.plain_text;

  const mention = item.mention;

  switch (mention.type) {
    case "page":
      // Link to the page -- use plain_text as the display name
      return item.plain_text;
    case "database":
      return item.plain_text;
    case "user":
      return item.plain_text;
    case "date": {
      const d = mention.date;
      return d.end ? `${d.start} → ${d.end}` : d.start;
    }
    case "link_preview":
      return item.plain_text;
    default:
      return item.plain_text;
  }
}

interface Annotations {
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  underline: boolean;
  code: boolean;
  color: string;
}

function applyAnnotations(text: string, ann: Annotations): string {
  if (!text) return text;

  // Code is applied first and is exclusive (no nesting of other marks inside backticks)
  if (ann.code) {
    return `\`${text}\``;
  }

  if (ann.strikethrough) {
    text = `~~${text}~~`;
  }

  // Bold + italic combined
  if (ann.bold && ann.italic) {
    text = `***${text}***`;
  } else if (ann.bold) {
    text = `**${text}**`;
  } else if (ann.italic) {
    text = `*${text}*`;
  }

  // Underline has no standard markdown; use HTML tag
  if (ann.underline) {
    text = `<u>${text}</u>`;
  }

  return text;
}
