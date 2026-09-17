import { afterEach, describe, expect, it } from "vitest";
import { MissingEnvError, isPlaceholder, requireEnv } from "@/lib/env";

const TEST_VAR = "WORKSHOP_TEST_KEY";

afterEach(() => {
  delete process.env[TEST_VAR];
});

describe("isPlaceholder", () => {
  it("treats an undefined value as a placeholder", () => {
    expect(isPlaceholder(undefined)).toBe(true);
  });

  it("treats empty and whitespace-only values as placeholders", () => {
    expect(isPlaceholder("")).toBe(true);
    expect(isPlaceholder("   ")).toBe(true);
  });

  it("treats the example.env asterisk style as a placeholder", () => {
    expect(isPlaceholder("****")).toBe(true);
  });

  it("treats the your_..._here style as a placeholder", () => {
    expect(isPlaceholder("your_openai_api_key_here")).toBe(true);
    expect(isPlaceholder("YOUR_TAVILY_API_KEY_HERE")).toBe(true);
  });

  it("accepts a value that looks like a real key", () => {
    expect(isPlaceholder("sk-proj-abc123")).toBe(false);
  });
});

describe("requireEnv", () => {
  it("returns the value when it is set", () => {
    process.env[TEST_VAR] = "sk-real-value";
    expect(requireEnv(TEST_VAR)).toBe("sk-real-value");
  });

  it("throws MissingEnvError naming the variable when it is absent", () => {
    expect(() => requireEnv(TEST_VAR)).toThrow(MissingEnvError);
    expect(() => requireEnv(TEST_VAR)).toThrow(TEST_VAR);
  });

  it("throws when the value is still a placeholder", () => {
    process.env[TEST_VAR] = "your_key_here";
    expect(() => requireEnv(TEST_VAR)).toThrow(MissingEnvError);
  });

  it("includes the supplied hint in the error message", () => {
    expect(() => requireEnv(TEST_VAR, "Get one at https://example.com")).toThrow(
      /Get one at https:\/\/example\.com/,
    );
  });
});
