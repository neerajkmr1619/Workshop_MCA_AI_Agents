import { describe, expect, it } from "vitest";
import { type LessonRef, discoverLessons, resolveLesson } from "@/runner/registry";

const LESSONS: LessonRef[] = [
  { id: "foundational-models", module: "module-1", path: "/l/module-1/foundational-models.ts" },
  { id: "prompting", module: "module-1", path: "/l/module-1/prompting.ts" },
  { id: "tools", module: "module-1", path: "/l/module-1/tools.ts" },
];

describe("resolveLesson", () => {
  it("finds a lesson by its exact id", () => {
    const result = resolveLesson("prompting", LESSONS);
    expect(result).toEqual({ kind: "found", lesson: LESSONS[1] });
  });

  it("finds a lesson by an unambiguous prefix", () => {
    const result = resolveLesson("tool", LESSONS);
    expect(result).toEqual({ kind: "found", lesson: LESSONS[2] });
  });

  it("reports every match for an ambiguous prefix", () => {
    const customLessons: LessonRef[] = [
      { id: "prompting-basic", module: "module-1", path: "/l/module-1/prompting-basic.ts" },
      { id: "prompting-advanced", module: "module-1", path: "/l/module-1/prompting-advanced.ts" },
    ];
    const result = resolveLesson("prompting", customLessons);
    expect(result.kind).toBe("ambiguous");
    if (result.kind !== "ambiguous") throw new Error("expected ambiguous");
    expect(result.matches.map((m) => m.id)).toEqual([
      "prompting-basic",
      "prompting-advanced",
    ]);
  });

  it("prefers an exact id over a prefix that also matches", () => {
    const lessons: LessonRef[] = [
      { id: "tool", module: "module-1", path: "/l/module-1/tool.ts" },
      { id: "tools", module: "module-1", path: "/l/module-1/tools.ts" },
    ];
    const result = resolveLesson("tool", lessons);
    expect(result).toEqual({ kind: "found", lesson: lessons[0] });
  });

  it("reports not-found for an unknown query", () => {
    expect(resolveLesson("unknown", LESSONS)).toEqual({ kind: "not-found", query: "unknown" });
  });

  it("ignores surrounding whitespace and case", () => {
    expect(resolveLesson("  TOOLS  ", LESSONS)).toEqual({
      kind: "found",
      lesson: LESSONS[2],
    });
  });
});

describe("discoverLessons", () => {
  it("finds the real Module 1 lessons on disk, sorted by id", async () => {
    const lessons = await discoverLessons();
    const moduleOne = lessons.filter((l) => l.module === "module-1");
    expect(moduleOne.map((l) => l.id)).toEqual([
      "foundational-models",
      "memory",
      "personal-chef",
      "prompting",
      "tools",
      "web-search",
    ]);
  });
});
