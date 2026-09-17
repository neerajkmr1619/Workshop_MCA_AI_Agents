import { loadEnv } from "@/lib/env";
import { buildEnvReport, hasErrors } from "@/lib/env-report";
import { heading } from "@/lib/print";

const SYMBOL = { ok: "✓", warn: "!", error: "✗" } as const;

loadEnv();

const findings = buildEnvReport({ env: process.env, nodeVersion: process.version });

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
