import { describe, expect, it } from "vitest";
import { parseArgs } from "@/runner/cli";

describe("parseArgs", () => {
  it("reads the lesson query", () => {
    expect(parseArgs(["1.1-prompting"])).toEqual({
      query: "1.1-prompting",
      only: undefined,
      list: false,
    });
  });

  it("reads --step as a number", () => {
    expect(parseArgs(["1.1-prompting", "--step", "3"]).only).toBe(3);
  });

  it("accepts --step=3 form", () => {
    expect(parseArgs(["1.1-prompting", "--step=3"]).only).toBe(3);
  });

  it("recognises --list with no query", () => {
    expect(parseArgs(["--list"])).toEqual({ query: undefined, only: undefined, list: true });
  });

  it("rejects a non-numeric --step", () => {
    expect(() => parseArgs(["1.1", "--step", "abc"])).toThrow(/--step expects a number/i);
  });

  it("rejects --step with no value", () => {
    expect(() => parseArgs(["1.1", "--step"])).toThrow(/--step expects a number/i);
  });
});
