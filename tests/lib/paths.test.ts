import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lessonsDir, projectRoot, resource, resourcesDir } from "@/lib/paths";

describe("paths", () => {
  it("resolves the project root to the directory holding package.json", () => {
    expect(existsSync(join(projectRoot, "package.json"))).toBe(true);
  });

  it("points resourcesDir at <root>/resources", () => {
    expect(resourcesDir).toBe(join(projectRoot, "resources"));
  });

  it("points lessonsDir at <root>/lessons", () => {
    expect(lessonsDir).toBe(join(projectRoot, "lessons"));
  });

  it("builds a path to a named resource file", () => {
    expect(resource("moon.png")).toBe(join(projectRoot, "resources", "moon.png"));
  });
});
