import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const thisDir = dirname(fileURLToPath(import.meta.url));

/** Repository root — this file lives at <root>/src/lib/paths.ts. */
export const projectRoot = resolve(thisDir, "..", "..");

export const resourcesDir = join(projectRoot, "resources");
export const lessonsDir = join(projectRoot, "lessons");

/** Absolute path to a file in resources/, e.g. resource("moon.png"). */
export function resource(name: string): string {
  return join(resourcesDir, name);
}
