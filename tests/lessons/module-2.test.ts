import { describe, expect, it, vi } from "vitest";
import type { LessonMeta } from "@/runner/step";

const LESSONS = ["2.1-trip-graph"];

describe.each(LESSONS)("lesson %s", (id) => {
  it("imports, exports meta, and registers steps", async () => {
    vi.resetModules();
    const { getSteps, clearSteps } = await import("@/runner/step");
    clearSteps();

    const imported = (await import(`../../lessons/module-2/${id}.ts`)) as {
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

it.each(LESSONS)("imports with no credentials at all: %s", async (id) => {
  vi.resetModules();
  const saved = { ...process.env };
  for (const k of ["OPENAI_API_KEY", "TAVILY_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY"]) {
    delete process.env[k];
  }
  try {
    await expect(import(`../../lessons/module-2/${id}.ts`)).resolves.toBeDefined();
  } finally {
    Object.assign(process.env, saved);
  }
});
