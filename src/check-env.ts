import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "dotenv";
import { loadEnv } from "@/lib/env";
import { buildEnvReport, hasErrors } from "@/lib/env-report";
import { heading } from "@/lib/print";
import { projectRoot } from "@/lib/paths";

const SYMBOL = { ok: "✓", warn: "!", error: "✗" } as const;

loadEnv();

/** Parsed contents of .env, or undefined when the file does not exist. */
function readDotenvValues(): Record<string, string> | undefined {
  try {
    const contents = readFileSync(join(projectRoot, ".env"), "utf8");
    return parse(contents);
  } catch {
    return undefined;
  }
}

const findings = buildEnvReport({
  env: process.env,
  nodeVersion: process.version,
  dotenvValues: readDotenvValues(),
});

heading("Environment check");
for (const finding of findings) {
  console.log(`${SYMBOL[finding.level]} ${finding.message}`);
}

if (hasErrors(findings)) {
  console.log(`\nSomething needs fixing. Copy .env.example to .env and fill in the keys:`);
  console.log(`  cp .env.example .env\n`);
  process.exitCode = 1;
} else {
  console.log(`\nYou are ready. Try:  npm run lessons\n`);
}
