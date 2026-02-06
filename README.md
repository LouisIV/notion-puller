# notion-pull

Pull Notion pages and databases to local markdown and CSV files.

## Setup

### 1. Create a Notion Integration

1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **New integration**
3. Give it a name (e.g. "notion-pull")
4. Select the workspace you want to access
5. Copy the **Internal Integration Secret** (starts with `ntn_`)

### 2. Share Pages/Databases with the Integration

For each page or database you want to pull:

1. Open the page or database in Notion
2. Click the **...** menu in the top right
3. Scroll to **Connections** and click **Connect to**
4. Select your integration

### 3. Install

Requires [Bun](https://bun.sh) v1.0+.

```bash
# Clone and install
git clone <repo-url> && cd notion-pull
bun install

# Or install globally after building
bun run build
npm install -g .
```

## Usage

Set your token as an environment variable (recommended):

```bash
export NOTION_TOKEN=ntn_xxxxx
```

### Pull a Page

```bash
# By URL
bun run dev https://www.notion.so/My-Page-abc123def456

# By page ID
bun run dev abc123def456abc123def456abc123de

# By UUID
bun run dev abc123de-f456-abc1-23de-f456abc123de
```

### Pull a Database

```bash
# By URL
bun run dev https://www.notion.so/workspace/abc123def456?v=...

# By database ID
bun run dev abc123def456abc123def456abc123de
```

### Options

```
-t, --token <token>    Notion integration token (overrides NOTION_TOKEN)
-o, --output <dir>     Output directory (default: ./output)
--type <type>          Force type: "page" or "database" (auto-detected)
-d, --depth <number>   Max depth for following relations (default: 2)
-h, --help             Show help
```

### Examples

```bash
# Pull to a specific directory
bun run dev --output ./docs https://notion.so/my-workspace/My-Page-abc123

# Pull a database with token flag
bun run dev --token ntn_xxxxx --type database abc123def456

# Limit relation depth
bun run dev --depth 1 https://notion.so/my-workspace/abc123
```

## Output

### Pages

Each page is saved as a markdown file with YAML frontmatter:

```
output/
  My Page Title.md
```

```markdown
---
title: "My Page Title"
created: 2025-01-15T10:30:00.000Z
last_edited: 2025-02-01T14:22:00.000Z
---

# Heading

Page content here...
```

### Databases

Each database gets a directory with a CSV index and markdown files for entries that have page content:

```
output/
  My Database/
    _index.csv
    Entry One.md
    Entry Two.md
```

Related databases (via relation properties) are pulled recursively with cycle detection.

## Building

```bash
# Build distributable
bun run build

# Type check
bun run typecheck
```

## License

MIT
