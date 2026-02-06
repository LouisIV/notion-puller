import type { Client } from "@notionhq/client";
import type {
  DatabaseObjectResponse,
  DataSourceObjectResponse,
  GetDatabaseResponse,
  GetDataSourceResponse,
  PageObjectResponse,
  QueryDataSourceResponse,
} from "@notionhq/client";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Full database + data source metadata and all page entries. */
export interface DatabaseData {
  database: DatabaseObjectResponse;
  dataSource: DataSourceObjectResponse;
  /** Property schema: mapping from property name to property type. */
  propertySchema: PropertySchema;
  /** All pages (rows) in the data source. */
  entries: PageObjectResponse[];
}

export type PropertySchema = Map<
  string,
  { id: string; type: string; name: string }
>;

// ---------------------------------------------------------------------------
// Narrowing helpers
// ---------------------------------------------------------------------------

function isFullDatabase(
  db: GetDatabaseResponse
): db is DatabaseObjectResponse {
  return "data_sources" in db && "title" in db;
}

function isFullDataSource(
  ds: GetDataSourceResponse
): ds is DataSourceObjectResponse {
  return "properties" in ds && "title" in ds;
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

/**
 * Retrieve a database and its primary data source, then query all entries.
 *
 * Flow (v5 / API 2025-09-03):
 *   1. Retrieve the database to get the `data_sources` reference array
 *   2. Retrieve the first data source to get the property schema
 *   3. Query the data source to get all page entries
 */
export async function fetchDatabase(
  client: Client,
  databaseId: string
): Promise<DatabaseData> {
  // 1. Retrieve the database container
  const db = await client.databases.retrieve({ database_id: databaseId });
  if (!isFullDatabase(db)) {
    throw new Error(`Received partial database object for ${databaseId}`);
  }

  if (db.data_sources.length === 0) {
    throw new Error(`Database ${databaseId} has no data sources`);
  }

  // 2. Retrieve the primary (first) data source for properties
  const dataSourceRef = db.data_sources[0]!;
  const ds = await client.dataSources.retrieve({
    data_source_id: dataSourceRef.id,
  });
  if (!isFullDataSource(ds)) {
    throw new Error(
      `Received partial data source object for ${dataSourceRef.id}`
    );
  }

  // 3. Build property schema from the data source
  const propertySchema: PropertySchema = new Map();
  for (const [name, prop] of Object.entries(ds.properties)) {
    propertySchema.set(name, { id: prop.id, type: prop.type, name });
  }

  // 4. Query all entries from the data source
  const entries = await queryAllEntries(client, dataSourceRef.id);

  return { database: db, dataSource: ds, propertySchema, entries };
}

/**
 * Get the title of a database from its title rich text.
 */
export function getDatabaseTitle(db: DatabaseObjectResponse): string {
  if (db.title.length > 0) {
    return db.title.map((t) => t.plain_text).join("");
  }
  return "Untitled Database";
}

/**
 * Query all entries in a data source, handling pagination.
 */
async function queryAllEntries(
  client: Client,
  dataSourceId: string
): Promise<PageObjectResponse[]> {
  const entries: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response: QueryDataSourceResponse = await client.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const result of response.results) {
      if ("properties" in result && "object" in result && result.object === "page") {
        entries.push(result as PageObjectResponse);
      }
    }

    cursor = response.has_more
      ? (response.next_cursor ?? undefined)
      : undefined;
  } while (cursor);

  return entries;
}

// ---------------------------------------------------------------------------
// Property value extraction
// ---------------------------------------------------------------------------

/**
 * Extract the value of a page property as a flat string, suitable for CSV.
 */
export function extractPropertyValue(prop: PageObjectResponse["properties"][string]): string {
  switch (prop.type) {
    case "title":
      return prop.title.map((t) => t.plain_text).join("");
    case "rich_text":
      return prop.rich_text.map((t) => t.plain_text).join("");
    case "number":
      return prop.number != null ? String(prop.number) : "";
    case "select":
      return prop.select?.name ?? "";
    case "multi_select":
      return prop.multi_select.map((s) => s.name).join("; ");
    case "status":
      return prop.status?.name ?? "";
    case "date": {
      if (!prop.date) return "";
      return prop.date.end
        ? `${prop.date.start} → ${prop.date.end}`
        : prop.date.start;
    }
    case "checkbox":
      return prop.checkbox ? "true" : "false";
    case "url":
      return prop.url ?? "";
    case "email":
      return prop.email ?? "";
    case "phone_number":
      return prop.phone_number ?? "";
    case "formula": {
      const f = prop.formula;
      if (f.type === "string") return f.string ?? "";
      if (f.type === "number") return f.number != null ? String(f.number) : "";
      if (f.type === "boolean") return String(f.boolean);
      if (f.type === "date") {
        if (!f.date) return "";
        return f.date.end ? `${f.date.start} → ${f.date.end}` : f.date.start;
      }
      return "";
    }
    case "relation":
      return prop.relation.map((r) => r.id).join("; ");
    case "rollup": {
      const r = prop.rollup;
      if (r.type === "number") return r.number != null ? String(r.number) : "";
      if (r.type === "date") {
        if (!r.date) return "";
        return r.date.end ? `${r.date.start} → ${r.date.end}` : r.date.start;
      }
      if (r.type === "array") {
        return r.array
          .map((item: any) => {
            if (item && "plain_text" in item) return item.plain_text;
            if (item && "name" in item) return item.name;
            return JSON.stringify(item);
          })
          .join("; ");
      }
      return "";
    }
    case "people":
      return prop.people
        .map((p: any) => ("name" in p ? p.name : p.id))
        .join("; ");
    case "files":
      return prop.files
        .map((f: any) => {
          if (f.type === "external") return f.external.url;
          if (f.type === "file") return f.file.url;
          return "";
        })
        .join("; ");
    case "created_time":
      return prop.created_time;
    case "created_by":
      return "name" in prop.created_by ? ((prop.created_by as any).name ?? prop.created_by.id) : prop.created_by.id;
    case "last_edited_time":
      return prop.last_edited_time;
    case "last_edited_by":
      return "name" in prop.last_edited_by
        ? ((prop.last_edited_by as any).name ?? prop.last_edited_by.id)
        : prop.last_edited_by.id;
    case "unique_id":
      return prop.unique_id.prefix
        ? `${prop.unique_id.prefix}-${prop.unique_id.number}`
        : String(prop.unique_id.number);
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Relation discovery
// ---------------------------------------------------------------------------

/**
 * Find all relation property names in a data source schema
 * and return the target database IDs they point to.
 */
export function findRelationTargets(
  ds: DataSourceObjectResponse
): { propertyName: string; targetDatabaseId: string }[] {
  const targets: { propertyName: string; targetDatabaseId: string }[] = [];

  for (const [name, prop] of Object.entries(ds.properties)) {
    if (prop.type === "relation") {
      targets.push({
        propertyName: name,
        targetDatabaseId: prop.relation.database_id,
      });
    }
  }

  return targets;
}
