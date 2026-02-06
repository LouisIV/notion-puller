import { Command } from "commander";

export interface CliOptions {
  token?: string;
  output: string;
  type?: "page" | "database";
  depth: number;
}

export interface CliResult {
  reference: string;
  options: CliOptions;
}

export function parseCli(argv: string[]): CliResult {
  const program = new Command();

  program
    .name("notion-pull")
    .description(
      "Pull Notion pages and databases to local markdown and CSV files"
    )
    .version("0.1.0")
    .argument("<reference>", "Notion page/database ID or URL")
    .option(
      "-t, --token <token>",
      "Notion integration token (or set NOTION_TOKEN env var)"
    )
    .option("-o, --output <dir>", "Output directory", "./output")
    .option(
      "--type <type>",
      "Force resource type: page or database (auto-detected by default)"
    )
    .option(
      "-d, --depth <number>",
      "Max depth for following database relations",
      "2"
    );

  program.parse(argv);

  const reference = program.args[0];
  if (!reference) {
    program.error("A Notion reference (page ID, database ID, or URL) is required.");
  }

  const opts = program.opts();

  return {
    reference,
    options: {
      token: opts.token,
      output: opts.output,
      type: opts.type as CliOptions["type"],
      depth: parseInt(opts.depth, 10),
    },
  };
}
