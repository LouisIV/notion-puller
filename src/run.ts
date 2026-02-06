import type { Client } from "@notionhq/client";
import type { CliOptions } from "./cli.ts";
import { createNotionClient, detectResourceType } from "./notion/client.ts";
import { parseNotionReference } from "./notion/url-parser.ts";
import {
  fetchBlockChildren,
  fetchPage,
  getPageTitle,
  type BlockWithChildren,
} from "./notion/pages.ts";
import {
  fetchDatabase,
  getDatabaseTitle,
  findRelationTargets,
  type DatabaseData,
} from "./notion/databases.ts";
import { blocksToMarkdown } from "./converters/markdown.ts";
import { entriesToCsv } from "./converters/csv.ts";
import { sanitizeFilename, writeOutputFile } from "./output/writer.ts";

export async function run(
  reference: string,
  options: CliOptions
): Promise<void> {
  const { id } = parseNotionReference(reference);
  const client = createNotionClient(options.token);

  const type = options.type ?? (await detectResourceType(client, id));
  console.log(`Detected resource type: ${type}`);

  const visited = new Set<string>();

  if (type === "page") {
    await pullPage(client, id, options.output, options.depth, visited);
  } else {
    await pullDatabase(client, id, options.output, options.depth, visited);
  }

  console.log(`\nDone! Output written to ${options.output}/`);
}

// ---------------------------------------------------------------------------
// Page pulling
// ---------------------------------------------------------------------------

async function pullPage(
  client: Client,
  pageId: string,
  outputDir: string,
  maxDepth: number,
  visited: Set<string>
): Promise<void> {
  if (visited.has(pageId)) return;
  visited.add(pageId);

  console.log(`Fetching page ${pageId}...`);
  const page = await fetchPage(client, pageId);
  const title = getPageTitle(page);
  console.log(`  Page: ${title}`);

  const blocks = await fetchBlockChildren(client, pageId);
  console.log(`  Fetched ${countBlocks(blocks)} blocks`);

  const markdown = blocksToMarkdown(blocks, page);
  const filename = `${sanitizeFilename(title)}.md`;
  const path = await writeOutputFile(outputDir, filename, markdown);
  console.log(`  Wrote ${path}`);

  // Recursively pull child pages and child databases
  if (maxDepth > 0) {
    const pageDir = `${outputDir}/${sanitizeFilename(title)}`;
    await pullChildResources(client, blocks, pageDir, maxDepth - 1, visited);
  }
}

// ---------------------------------------------------------------------------
// Database pulling
// ---------------------------------------------------------------------------

async function pullDatabase(
  client: Client,
  databaseId: string,
  outputDir: string,
  maxDepth: number,
  visited: Set<string>
): Promise<void> {
  if (visited.has(databaseId)) {
    console.log(`Skipping already-visited database ${databaseId}`);
    return;
  }
  visited.add(databaseId);

  console.log(`Fetching database ${databaseId}...`);
  const data: DatabaseData = await fetchDatabase(client, databaseId);
  const dbTitle = getDatabaseTitle(data.database);
  const dbDir = sanitizeFilename(dbTitle);
  console.log(`  Database: ${dbTitle} (${data.entries.length} entries)`);

  // Write CSV index
  const csv = entriesToCsv(data.entries, data.propertySchema);
  const csvPath = await writeOutputFile(outputDir, `${dbDir}/_index.csv`, csv);
  console.log(`  Wrote ${csvPath}`);

  // For each entry, check if it has page content and write markdown
  let mdCount = 0;
  for (const entry of data.entries) {
    const blocks = await fetchBlockChildren(client, entry.id);
    if (blocks.length === 0) continue;

    const title = getPageTitle(entry);
    const markdown = blocksToMarkdown(blocks, entry);
    const filename = `${sanitizeFilename(title)}.md`;
    await writeOutputFile(outputDir, `${dbDir}/${filename}`, markdown);
    mdCount++;

    // Recursively pull child resources inside each database entry
    if (maxDepth > 0) {
      const entryDir = `${outputDir}/${dbDir}/${sanitizeFilename(title)}`;
      await pullChildResources(client, blocks, entryDir, maxDepth - 1, visited);
    }
  }
  if (mdCount > 0) {
    console.log(`  Wrote ${mdCount} markdown files for entries with content`);
  }

  // Follow relations (if within depth limit)
  if (maxDepth > 0) {
    const relations = findRelationTargets(data.dataSource);
    for (const rel of relations) {
      if (visited.has(rel.targetDatabaseId)) {
        console.log(
          `  Skipping related database "${rel.propertyName}" (already visited)`
        );
        continue;
      }
      console.log(
        `  Following relation "${rel.propertyName}" → ${rel.targetDatabaseId}`
      );
      await pullDatabase(
        client,
        rel.targetDatabaseId,
        outputDir,
        maxDepth - 1,
        visited
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Child resource discovery
// ---------------------------------------------------------------------------

/**
 * Scan a block tree for child_page and child_database blocks,
 * and recursively pull each one.
 */
async function pullChildResources(
  client: Client,
  blocks: BlockWithChildren[],
  outputDir: string,
  maxDepth: number,
  visited: Set<string>
): Promise<void> {
  for (const block of blocks) {
    if (block.type === "child_page") {
      await pullPage(client, block.id, outputDir, maxDepth, visited);
    } else if (block.type === "child_database") {
      await pullDatabase(client, block.id, outputDir, maxDepth, visited);
    }

    // Also check nested blocks (e.g. inside toggles, columns, etc.)
    if (block.children.length > 0) {
      await pullChildResources(client, block.children, outputDir, maxDepth, visited);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countBlocks(blocks: BlockWithChildren[]): number {
  let count = 0;
  for (const block of blocks) {
    count += 1 + countBlocks(block.children);
  }
  return count;
}
