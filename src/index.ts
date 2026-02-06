import { parseCli } from "./cli.ts";
import { run } from "./run.ts";

const { reference, options } = parseCli(process.argv);
await run(reference, options);
