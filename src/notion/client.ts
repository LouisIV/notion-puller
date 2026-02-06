import { Client } from "@notionhq/client";

/**
 * Create a Notion SDK client.
 *
 * Token resolution order:
 *   1. Explicit `token` argument (from --token flag)
 *   2. NOTION_TOKEN environment variable
 *
 * Throws if no token is available.
 */
export function createNotionClient(token?: string): Client {
  const resolved = token ?? process.env.NOTION_TOKEN;

  if (!resolved) {
    throw new Error(
      "No Notion token provided. Pass --token or set the NOTION_TOKEN environment variable.\n" +
        "Create an integration at https://www.notion.so/my-integrations"
    );
  }

  return new Client({ auth: resolved });
}

/**
 * Detect whether an ID refers to a page or a database by trying the
 * page endpoint first, then falling back to database.
 */
export async function detectResourceType(
  client: Client,
  id: string
): Promise<"page" | "database"> {
  try {
    await client.pages.retrieve({ page_id: id });
    return "page";
  } catch {
    // If page retrieval fails, try database
    try {
      await client.databases.retrieve({ database_id: id });
      return "database";
    } catch {
      throw new Error(
        `Could not find a Notion page or database with ID: ${id}\n` +
          "Make sure the integration has access to this resource."
      );
    }
  }
}
