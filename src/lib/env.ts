import { join } from "node:path";
import { config } from "dotenv";
import { projectRoot } from "@/lib/paths";

/**
 * True when a variable is absent or still holds a template value from
 * .env.example. Catches "", "   ", "****", and "your_..._here".
 */
export function isPlaceholder(value: string | undefined): boolean {
  if (value === undefined) return true;
  const trimmed = value.trim();
  if (trimmed === "") return true;
  if (/^\*+$/.test(trimmed)) return true;
  if (/^your[_-].*[_-]here$/i.test(trimmed)) return true;
  if (/^(changeme|placeholder|todo|x{3,})$/i.test(trimmed)) return true;
  return false;
}

let loaded = false;

/** Load <root>/.env into process.env. Idempotent; never throws. */
export function loadEnv(): void {
  if (loaded) return;
  config({ path: join(projectRoot, ".env"), quiet: true });
  loaded = true;
}

export class MissingEnvError extends Error {
  constructor(public readonly variable: string, message: string) {
    super(message);
    this.name = "MissingEnvError";
  }
}

/**
 * Read a required variable, or fail with a message that says what to do
 * instead of a provider stack trace.
 */
export function requireEnv(name: string, hint?: string): string {
  loadEnv();
  const value = process.env[name];
  if (isPlaceholder(value)) {
    const lines = [
      `Missing required environment variable: ${name}`,
      ``,
      `Add it to your .env file at the project root:`,
      `  ${name}='...'`,
      ``,
      `Copy .env.example to .env if you have not already:`,
      `  cp .env.example .env`,
    ];
    if (hint) lines.push(``, hint);
    throw new MissingEnvError(name, lines.join("\n"));
  }
  return value as string;
}
