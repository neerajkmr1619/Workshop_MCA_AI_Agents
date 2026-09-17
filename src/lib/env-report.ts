import { isPlaceholder } from "@/lib/env";

export interface EnvFinding {
  level: "ok" | "warn" | "error";
  message: string;
}

const MINIMUM_NODE_MAJOR = 20;

const REQUIRED_KEYS = [
  { name: "OPENAI_API_KEY", why: "every lesson in the course" },
  { name: "TAVILY_API_KEY", why: "lessons 1.2 web search and 1.5 personal chef" },
];

const OPTIONAL_KEYS = [
  { name: "ANTHROPIC_API_KEY", why: "lesson 1.1 (model providers)" },
  { name: "GOOGLE_API_KEY", why: "lesson 1.1 (model providers)" },
];

export function buildEnvReport(input: {
  env: NodeJS.ProcessEnv;
  nodeVersion: string;
  /**
   * Parsed contents of the .env file, when one exists. Passed in rather than
   * read here so this function stays pure and unit-testable against
   * fabricated inputs — real file I/O belongs in the caller (src/check-env.ts).
   */
  dotenvValues?: Record<string, string>;
}): EnvFinding[] {
  const { env, nodeVersion, dotenvValues } = input;
  const findings: EnvFinding[] = [];

  const major = Number.parseInt(nodeVersion.replace(/^v/, "").split(".")[0] ?? "0", 10);
  if (Number.isNaN(major) || major < MINIMUM_NODE_MAJOR) {
    findings.push({
      level: "error",
      message: `Node ${nodeVersion} is too old. This course needs Node ${MINIMUM_NODE_MAJOR} or newer.`,
    });
  } else {
    findings.push({ level: "ok", message: `Node ${nodeVersion}` });
  }

  for (const key of REQUIRED_KEYS) {
    if (isPlaceholder(env[key.name])) {
      findings.push({
        level: "error",
        message: `${key.name} is not set — required for ${key.why}.`,
      });
    } else {
      findings.push({ level: "ok", message: `${key.name} is set` });
    }
  }

  for (const key of OPTIONAL_KEYS) {
    if (isPlaceholder(env[key.name])) {
      findings.push({
        level: "warn",
        message: `${key.name} is not set — optional, used by ${key.why}.`,
      });
    } else {
      findings.push({ level: "ok", message: `${key.name} is set` });
    }
  }

  const tracingOn = (env.LANGSMITH_TRACING ?? "").toLowerCase() === "true";
  if (tracingOn && isPlaceholder(env.LANGSMITH_API_KEY)) {
    findings.push({
      level: "warn",
      message:
        "LANGSMITH_TRACING is true but LANGSMITH_API_KEY is not set. Set the key or turn tracing off.",
    });
  }

  if (dotenvValues) {
    for (const [name, dotenvValue] of Object.entries(dotenvValues)) {
      const shellValue = env[name];
      if (shellValue !== undefined && shellValue !== dotenvValue) {
        findings.push({
          level: "warn",
          message: `${name} is set in your shell environment, which takes precedence over the value in .env.`,
        });
      }
    }
  }

  return findings;
}

export function hasErrors(findings: EnvFinding[]): boolean {
  return findings.some((f) => f.level === "error");
}
