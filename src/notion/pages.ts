import type { Client } from "@notionhq/client";
import type {
  BlockObjectResponse,
  GetPageResponse,
  PageObjectResponse,
} from "@notionhq/client";

/** A block with its recursively-fetched children attached. */
export type BlockWithChildren = BlockObjectResponse & {
  children: BlockWithChildren[];
};

/**
 * Fetch all child blocks of a given block/page ID, with pagination.
 * For blocks that `has_children`, recursively fetches their children too.
 */
export async function fetchBlockChildren(
  client: Client,
  blockId: string
): Promise<BlockWithChildren[]> {
  const blocks: BlockWithChildren[] = [];
  let cursor: string | undefined;

  do {
    const response = await client.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of response.results) {
      // The API can return partial blocks; skip them
      if (!("type" in block)) continue;

      const typed = block as BlockObjectResponse;

      // Don't recurse into child_page / child_database blocks --
      // their content is pulled separately as distinct resources.
      const shouldRecurse =
        typed.has_children &&
        typed.type !== "child_page" &&
        typed.type !== "child_database";

      const children = shouldRecurse
        ? await fetchBlockChildren(client, typed.id)
        : [];

      blocks.push(Object.assign(typed, { children }) as BlockWithChildren);
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return blocks;
}

/** Helper to narrow a GetPageResponse to a full PageObjectResponse. */
export function isFullPage(page: GetPageResponse): page is PageObjectResponse {
  return "properties" in page;
}

/**
 * Retrieve page metadata (title, dates, etc.) from the Notion API.
 */
export async function fetchPage(
  client: Client,
  pageId: string
): Promise<PageObjectResponse> {
  const page = await client.pages.retrieve({ page_id: pageId });
  if (!isFullPage(page)) {
    throw new Error(`Received partial page object for ${pageId}`);
  }
  return page;
}

/**
 * Extract the title string from a page's properties.
 */
export function getPageTitle(page: PageObjectResponse): string {
  for (const prop of Object.values(page.properties)) {
    if (prop.type === "title" && prop.title.length > 0) {
      return prop.title.map((t) => t.plain_text).join("");
    }
  }
  return "Untitled";
}
