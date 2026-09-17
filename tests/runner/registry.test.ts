import { describe, expect, it } from "vitest";
import { type LessonRef, discoverLessons, resolveLesson } from "@/runner/registry";

const LESSONS: LessonRef[] = [
  { id: "1.1-foundational-models", module: "module-1", path: "/l/module-1/1.1-foundational-models.ts" },
  { id: "1.1-prompting", module: "module-1", path: "/l/module-1/1.1-prompting.ts" },
  { id: "1.2-tools", module: "module-1", path: "/l/module-1/1.2-tools.ts" },
];

describe("resolveLesson", () => {
  it("finds a lesson by its exact id", () => {
    const result = resolveLesson("1.1-prompting", LESSONS);
    expect(result).toEqual({ kind: "found", lesson: LESSONS[1] });
  });

  it("finds a lesson by an unambiguous prefix", () => {
    const result = resolveLesson("1.2", LESSONS);
    expect(result).toEqual({ kind: "found", lesson: LESSONS[2] });
  });

  it("reports every match for an ambiguous prefix", () => {
    const result = resolveLesson("1.1", LESSONS);
    expect(result.kind).toBe("ambiguous");
    if (result.kind !== "ambiguous") throw new Error("expected ambiguous");
    expect(result.matches.map((m) => m.id)).toEqual([
      "1.1-foundational-models",
      "1.1-prompting",
    ]);
  });

  it("prefers an exact id over a prefix that also matches", () => {
    const lessons: LessonRef[] = [
      { id: "1.2", module: "module-1", path: "/l/module-1/1.2.ts" },
      { id: "1.2-tools", module: "module-1", path: "/l/module-1/1.2-tools.ts" },
    ];
    const result = resolveLesson("1.2", lessons);
    expect(result).toEqual({ kind: "found", lesson: lessons[0] });
  });

  it("reports not-found for an unknown query", () => {
    expect(resolveLesson("9.9", LESSONS)).toEqual({ kind: "not-found", query: "9.9" });
  });

  it("ignores surrounding whitespace and case", () => {
    expect(resolveLesson("  1.2-TOOLS  ", LESSONS)).toEqual({
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
      "1.1-foundational-models",
      "1.1-prompting",
      "1.2-tools",
      "1.2-web-search",
      "1.3-memory",
      "1.4-multimodal-messages",
      "1.5-personal-chef",
    ]);
  });
});
