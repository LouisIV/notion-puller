# Notion Pull

## Technical

- Use Deno or Bun
- Write in Typescript
- Use TSDown

## Usage

- Allow user to specify a notion reference
  - Database ID
  - Page ID
  - Notion URL
- Pull all the data from the notion resource
  - All the blocks
  - All the databases
  - All the relationships
- Represent pages as markdown files
- Represent databases as CSV files

## Connecting To Notion

- Research what the best method may be
  - OAuth if simple would be ideal since it would not require storing API keys
  - API keys as a backup would be interesting

