import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  UnknownStepError,
  clearSteps,
  getSteps,
  runSteps,
  step,
} from "@/runner/step";

beforeEach(() => {
  clearSteps();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("step registration", () => {
  it("starts with no registered steps", () => {
    expect(getSteps()).toEqual([]);
  });

  it("records each registered step in declaration order", () => {
    step(1, "first", () => {});
    step(2, "second", () => {});
    expect(getSteps().map((s) => s.title)).toEqual(["first", "second"]);
  });

  it("sorts steps by number even when declared out of order", () => {
    step(2, "second", () => {});
    step(1, "first", () => {});
    expect(getSteps().map((s) => s.n)).toEqual([1, 2]);
  });

  it("rejects a duplicate step number", () => {
    step(1, "first", () => {});
    expect(() => step(1, "also first", () => {})).toThrow(/duplicate step number 1/i);
  });
});

describe("runSteps", () => {
  it("runs every step in order when no filter is given", async () => {
    const ran: number[] = [];
    step(1, "one", () => void ran.push(1));
    step(2, "two", () => void ran.push(2));
    await runSteps(getSteps());
    expect(ran).toEqual([1, 2]);
  });

  it("awaits async step bodies", async () => {
    const ran: string[] = [];
    step(1, "async", async () => {
      await Promise.resolve();
      ran.push("done");
    });
    await runSteps(getSteps());
    expect(ran).toEqual(["done"]);
  });

  it("runs only the requested step", async () => {
    const ran: number[] = [];
    step(1, "one", () => void ran.push(1));
    step(2, "two", () => void ran.push(2));
    step(3, "three", () => void ran.push(3));
    await runSteps(getSteps(), { only: 2 });
    expect(ran).toEqual([2]);
  });

  it("throws UnknownStepError listing valid numbers for a bad --step", async () => {
    step(1, "one", () => {});
    step(2, "two", () => {});
    await expect(runSteps(getSteps(), { only: 9 })).rejects.toThrow(UnknownStepError);
    await expect(runSteps(getSteps(), { only: 9 })).rejects.toThrow(/1, 2/);
  });
});
