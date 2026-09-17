import { describe, expect, it } from "vitest";
import { buildEnvReport, hasErrors } from "@/lib/env-report";

const GOOD_ENV = {
  OPENAI_API_KEY: "sk-real",
  TAVILY_API_KEY: "tvly-real",
} as NodeJS.ProcessEnv;

function messagesAt(level: "ok" | "warn" | "error", env: NodeJS.ProcessEnv, node = "v20.11.0") {
  return buildEnvReport({ env, nodeVersion: node })
    .filter((f) => f.level === level)
    .map((f) => f.message);
}

describe("buildEnvReport", () => {
  it("reports an error when Node is older than 20", () => {
    expect(messagesAt("error", GOOD_ENV, "v18.19.0").join(" ")).toMatch(/Node/i);
  });

  it("accepts Node 20 and newer", () => {
    expect(messagesAt("error", GOOD_ENV, "v22.3.0").join(" ")).not.toMatch(/Node/i);
  });

  it("errors when OPENAI_API_KEY is missing", () => {
    expect(messagesAt("error", {} as NodeJS.ProcessEnv).join(" ")).toMatch(/OPENAI_API_KEY/);
  });

  it("errors when OPENAI_API_KEY is still a placeholder", () => {
    const env = { OPENAI_API_KEY: "your_openai_api_key_here" } as NodeJS.ProcessEnv;
    expect(messagesAt("error", env).join(" ")).toMatch(/OPENAI_API_KEY/);
  });

  it("warns rather than errors when an optional key is missing", () => {
    const report = buildEnvReport({ env: GOOD_ENV, nodeVersion: "v20.11.0" });
    const anthropic = report.find((f) => f.message.includes("ANTHROPIC_API_KEY"));
    expect(anthropic?.level).toBe("warn");
  });

  it("warns when tracing is on but the LangSmith key is a placeholder", () => {
    const env = { ...GOOD_ENV, LANGSMITH_TRACING: "true" } as NodeJS.ProcessEnv;
    expect(messagesAt("warn", env).join(" ")).toMatch(/LANGSMITH_API_KEY/);
  });

  it("does not warn about tracing when it is off", () => {
    const env = { ...GOOD_ENV, LANGSMITH_TRACING: "false" } as NodeJS.ProcessEnv;
    expect(messagesAt("warn", env).join(" ")).not.toMatch(/LANGSMITH_API_KEY/);
  });

  it("reports ok for a fully configured required key", () => {
    expect(messagesAt("ok", GOOD_ENV).join(" ")).toMatch(/OPENAI_API_KEY/);
  });
});

describe("buildEnvReport — shell/.env conflicts", () => {
  it("warns when a shell value differs from the .env value", () => {
    const env = { ...GOOD_ENV, OPENAI_API_KEY: "sk-shell" } as NodeJS.ProcessEnv;
    const report = buildEnvReport({
      env,
      nodeVersion: "v20.11.0",
      dotenvValues: { OPENAI_API_KEY: "sk-dotenv" },
    });
    const warnings = report.filter((f) => f.level === "warn").map((f) => f.message);
    expect(warnings.join(" ")).toMatch(/OPENAI_API_KEY/);
    expect(warnings.join(" ")).toMatch(/shell/i);
  });

  it("does not warn when the shell value matches the .env value", () => {
    const env = { ...GOOD_ENV } as NodeJS.ProcessEnv;
    const report = buildEnvReport({
      env,
      nodeVersion: "v20.11.0",
      dotenvValues: { OPENAI_API_KEY: env.OPENAI_API_KEY as string },
    });
    expect(report.filter((f) => f.level === "warn").map((f) => f.message).join(" ")).not.toMatch(
      /takes precedence/,
    );
  });

  it("does not warn about a variable in .env but absent from the shell", () => {
    const env = { ...GOOD_ENV } as NodeJS.ProcessEnv;
    const report = buildEnvReport({
      env,
      nodeVersion: "v20.11.0",
      dotenvValues: { SOME_OTHER_VAR: "value" },
    });
    expect(report.filter((f) => f.level === "warn").map((f) => f.message).join(" ")).not.toMatch(
      /takes precedence/,
    );
  });

  it("does not warn when no dotenvValues are provided at all", () => {
    const report = buildEnvReport({ env: GOOD_ENV, nodeVersion: "v20.11.0" });
    expect(report.filter((f) => f.level === "warn").map((f) => f.message).join(" ")).not.toMatch(
      /takes precedence/,
    );
  });
});

describe("hasErrors", () => {
  it("is true when any finding is an error", () => {
    expect(hasErrors([{ level: "error", message: "boom" }])).toBe(true);
  });

  it("is false for ok and warn findings only", () => {
    expect(
      hasErrors([
        { level: "ok", message: "fine" },
        { level: "warn", message: "meh" },
      ]),
    ).toBe(false);
  });
});
