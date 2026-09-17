import { describe, expect, it, vi } from "vitest";
import type { LessonMeta } from "@/runner/step";

const LESSONS = [
  "1.1-foundational-models",
  "1.1-prompting",
  "1.2-tools",
  "1.2-web-search",
  "1.3-memory",
];

describe.each(LESSONS)("lesson %s", (id) => {
  it("imports, exports meta, and registers steps", async () => {
    vi.resetModules();
    const { getSteps, clearSteps } = await import("@/runner/step");
    clearSteps();

    const imported = (await import(`../../lessons/module-1/${id}.ts`)) as {
      meta?: LessonMeta;
    };

    expect(imported.meta, "lesson must export `meta`").toBeDefined();
    expect(imported.meta?.title).toBeTruthy();

    const steps = getSteps();
    expect(steps.length).toBeGreaterThan(0);

    const numbers = steps.map((s) => s.n);
    expect(numbers, "step numbers must be unique and ordered").toEqual(
      [...new Set(numbers)].sort((a, b) => a - b),
    );
  });
});
