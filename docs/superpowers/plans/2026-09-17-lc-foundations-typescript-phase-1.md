# LangChain Foundations TypeScript Port — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the project scaffolding, step runner, and all seven Module 1 lessons for the TypeScript port of the LangChain Academy "Introduction to LangChain" course.

**Architecture:** One `.ts` file per lesson, run with `tsx` through a CLI that imports the lesson module and executes its registered `step()` blocks. Teaching code is deliberately duplicated across lessons; only the runner, environment handling, printing, and path helpers are shared. Tests are hermetic — no network, no API keys.

**Tech Stack:** Node.js 20+, TypeScript 5.9, tsx, Vitest, `langchain` 1.5.x, `@langchain/langgraph` 1.4.x, `@langchain/openai` / `anthropic` / `google-genai` / `ollama` / `tavily`, Zod, dotenv.

**Spec:** `docs/superpowers/specs/2026-09-17-lc-foundations-typescript-design.md`

## Global Constraints

These apply to every task. They were verified against the shipped `.d.ts` files of the pinned package versions — do not "correct" them from memory of older LangChain versions.

- **Node.js >= 20.** `package.json` sets `"engines": { "node": ">=20" }`.
- **ESM only.** `package.json` sets `"type": "module"`.
- **`initChatModel` returns a `Promise`** in JavaScript, unlike Python. Always `await initChatModel(...)`.
- **Import nearly everything from the `langchain` root.** `createAgent`, `tool`, `initChatModel`, `createMiddleware`, `HumanMessage`, `AIMessage`, `SystemMessage`, `ToolMessage`, and `FakeToolCallingModel` are all re-exported there.
- **`MemorySaver`**, not `InMemorySaver`, from `@langchain/langgraph`.
- **`createAgent` takes one object:** `{ model, tools, systemPrompt, stateSchema, contextSchema, checkpointer, responseFormat, middleware }`.
- **Message fields stay snake_case:** `response_metadata`, `tool_calls`, `usage_metadata`. Message *methods* are camelCase: `getType()`. Text is the `.text` getter.
- **`tool(fn, fields)`** — the function's second parameter is `ToolRuntime<TState, TContext>`.
- **Stream mode is `streamMode: "messages"`** (camelCase option, snake-free string value).
- **Model IDs are unchanged from the Python course:** `gpt-5-nano`, `claude-sonnet-4-6`, `gemini-3.1-flash-lite`, `gpt-audio`, `qwen3:4b` (Ollama).
- **Path alias `@/*` → `src/*`.** Lessons import shared helpers as `@/runner/step`, `@/lib/print`.
- **Steps must stand alone.** A step may never read a variable another step assigned. Read-only setup goes at module scope; anything reconfigured per step is built inside that step.
- **No network calls at module scope.** Every API call lives inside a `step()` body, so importing a lesson is safe in tests.

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `vitest.config.ts` | Toolchain |
| `src/lib/paths.ts` | Project-root-relative paths to `resources/` and `lessons/` |
| `src/lib/env.ts` | `.env` loading, placeholder detection, friendly missing-key errors |
| `src/lib/env-report.ts` | Pure environment-audit logic (no I/O) |
| `src/lib/print.ts` | Message and JSON console formatting — replaces Python's `pprint` |
| `src/runner/step.ts` | `step()` registration, `LessonMeta` type, step execution |
| `src/runner/registry.ts` | Lesson discovery on disk and ID resolution |
| `src/runner/cli.ts` | Argument parsing, wiring registry → module import → steps |
| `src/check-env.ts` | CLI shell that prints the environment report |
| `lessons/module-1/*.ts` | The seven lessons |
| `studio/module-1/` | `agent.ts` + `langgraph.json` for LangGraph Studio |
| `tests/` | Vitest suites |

---

### Task 1: Toolchain and path helpers

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.env.example`
- Create: `src/lib/paths.ts`
- Test: `tests/lib/paths.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `projectRoot: string`, `resourcesDir: string`, `lessonsDir: string`, `resource(name: string): string`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "workshop-lc101",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "lesson": "tsx src/runner/cli.ts",
    "lessons": "tsx src/runner/cli.ts --list",
    "check-env": "tsx src/check-env.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@langchain/anthropic": "^1.5.10",
    "@langchain/core": "^1.2.11",
    "@langchain/google-genai": "^2.3.2",
    "@langchain/langgraph": "^1.4.15",
    "@langchain/ollama": "^1.3.0",
    "@langchain/openai": "^1.5.13",
    "@langchain/tavily": "^1.2.0",
    "dotenv": "^17.0.0",
    "langchain": "^1.5.11",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.9.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

`module: "Preserve"` with `moduleResolution: "bundler"` lets lessons write extensionless relative imports, which reads better in teaching code than NodeNext's mandatory `.js` suffixes. `noUncheckedIndexedAccess` is deliberately left off so lesson code like `messages[1]` stays clean.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "Preserve",
    "moduleResolution": "bundler",
    "types": ["node"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "lessons", "studio", "tests", "*.config.ts"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
  },
});
```

- [ ] **Step 4: Create `tests/setup.ts`**

Placeholder credentials so importing a lesson never throws in tests. `??=` leaves any real value alone.

```ts
process.env.OPENAI_API_KEY ??= "test-openai-key";
process.env.ANTHROPIC_API_KEY ??= "test-anthropic-key";
process.env.GOOGLE_API_KEY ??= "test-google-key";
process.env.TAVILY_API_KEY ??= "test-tavily-key";
process.env.LANGSMITH_TRACING = "false";
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
.env
.DS_Store
dist/
*.tsbuildinfo
.langgraph_api/
recordings/
```

- [ ] **Step 6: Create `.env.example`**

```bash
# Required for every lesson
OPENAI_API_KEY='your_openai_api_key_here'

# Required for web search lessons (1.2 web search, 1.5 personal chef)
TAVILY_API_KEY='your_tavily_api_key_here'

# Optional — only lesson 1.1 uses these
ANTHROPIC_API_KEY='your_anthropic_api_key_here'
GOOGLE_API_KEY='your_google_api_key_here'

# Optional — tracing and evaluation
LANGSMITH_API_KEY='your_langsmith_api_key_here'
#LANGSMITH_TRACING=true
LANGSMITH_PROJECT=workshop-lc101
#LANGSMITH_ENDPOINT=https://eu.api.smith.langchain.com

# Optional — lesson 1.2 tools runs a local model
OLLAMA_HOST='http://localhost:11434'
```

- [ ] **Step 7: Write the failing test**

Create `tests/lib/paths.test.ts`:

```ts
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
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `npm install && npx vitest run tests/lib/paths.test.ts`
Expected: FAIL — cannot resolve `@/lib/paths`.

- [ ] **Step 9: Write `src/lib/paths.ts`**

```ts
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const thisDir = dirname(fileURLToPath(import.meta.url));

/** Repository root — this file lives at <root>/src/lib/paths.ts. */
export const projectRoot = resolve(thisDir, "..", "..");

export const resourcesDir = join(projectRoot, "resources");
export const lessonsDir = join(projectRoot, "lessons");

/** Absolute path to a file in resources/, e.g. resource("moon.png"). */
export function resource(name: string): string {
  return join(resourcesDir, name);
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `npx vitest run tests/lib/paths.test.ts && npm run typecheck`
Expected: 4 tests PASS, typecheck clean.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore .env.example src/lib/paths.ts tests/
git commit -m "feat: project scaffolding and path helpers"
```

---

### Task 2: Environment loading and validation

**Files:**
- Create: `src/lib/env.ts`
- Test: `tests/lib/env.test.ts`

**Interfaces:**
- Consumes: `projectRoot` from `@/lib/paths`
- Produces: `isPlaceholder(value: string | undefined): boolean`, `loadEnv(): void`, `requireEnv(name: string, hint?: string): string`, `class MissingEnvError extends Error`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/env.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/env.test.ts`
Expected: FAIL — cannot resolve `@/lib/env`.

- [ ] **Step 3: Write `src/lib/env.ts`**

```ts
import { join } from "node:path";
import { config } from "dotenv";
import { projectRoot } from "@/lib/paths";

/**
 * True when a variable is absent or still holds a template value from
 * .env.example. Catches "", "   ", "****", and "your_..._here".
 */
export function isPlaceholder(value: string | undefined): boolean {
  if (value === undefined) return true;
  const trimmed = value.trim();
  if (trimmed === "") return true;
  if (/^\*+$/.test(trimmed)) return true;
  if (/^your[_-].*[_-]here$/i.test(trimmed)) return true;
  if (/^(changeme|placeholder|todo|x{3,})$/i.test(trimmed)) return true;
  return false;
}

let loaded = false;

/** Load <root>/.env into process.env. Idempotent; never throws. */
export function loadEnv(): void {
  if (loaded) return;
  config({ path: join(projectRoot, ".env"), quiet: true });
  loaded = true;
}

export class MissingEnvError extends Error {
  constructor(public readonly variable: string, message: string) {
    super(message);
    this.name = "MissingEnvError";
  }
}

/**
 * Read a required variable, or fail with a message that says what to do
 * instead of a provider stack trace.
 */
export function requireEnv(name: string, hint?: string): string {
  loadEnv();
  const value = process.env[name];
  if (isPlaceholder(value)) {
    const lines = [
      `Missing required environment variable: ${name}`,
      ``,
      `Add it to your .env file at the project root:`,
      `  ${name}='...'`,
      ``,
      `Copy .env.example to .env if you have not already:`,
      `  cp .env.example .env`,
    ];
    if (hint) lines.push(``, hint);
    throw new MissingEnvError(name, lines.join("\n"));
  }
  return value as string;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/env.test.ts`
Expected: 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/env.ts tests/lib/env.test.ts
git commit -m "feat: env loading with placeholder detection and friendly errors"
```

---

### Task 3: Console printing helpers

**Files:**
- Create: `src/lib/print.ts`
- Test: `tests/lib/print.test.ts`

**Interfaces:**
- Consumes: `BaseMessage` from `@langchain/core/messages`
- Produces: `formatMessage(message: BaseMessage): string`, `printMessages(messages: BaseMessage[]): void`, `printJson(value: unknown): void`, `heading(text: string): void`

`formatMessage` is pure and holds all the logic; the `print*` functions are thin `console.log` wrappers. That split is what makes this testable without capturing stdout.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/print.test.ts`:

```ts
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "langchain";
import { describe, expect, it } from "vitest";
import { formatMessage } from "@/lib/print";

describe("formatMessage", () => {
  it("labels a human message and shows its text", () => {
    const line = formatMessage(new HumanMessage("What is the capital of the Moon?"));
    expect(line).toContain("HUMAN");
    expect(line).toContain("What is the capital of the Moon?");
  });

  it("labels an AI message", () => {
    expect(formatMessage(new AIMessage("Luna City."))).toContain("AI");
  });

  it("labels a system message", () => {
    expect(formatMessage(new SystemMessage("You are helpful."))).toContain("SYSTEM");
  });

  it("labels a tool message", () => {
    const message = new ToolMessage({ content: "42", tool_call_id: "call_1" });
    expect(formatMessage(message)).toContain("TOOL");
  });

  it("renders tool calls made by an AI message", () => {
    const message = new AIMessage({
      content: "",
      tool_calls: [{ id: "call_1", name: "square_root", args: { x: 467 } }],
    });
    const line = formatMessage(message);
    expect(line).toContain("square_root");
    expect(line).toContain("467");
  });

  it("marks an AI message that has no text content", () => {
    const message = new AIMessage({
      content: "",
      tool_calls: [{ id: "call_1", name: "square_root", args: { x: 1 } }],
    });
    expect(formatMessage(message)).toContain("(no text content)");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/print.test.ts`
Expected: FAIL — cannot resolve `@/lib/print`.

- [ ] **Step 3: Write `src/lib/print.ts`**

```ts
import type { AIMessage, BaseMessage } from "@langchain/core/messages";
import { inspect } from "node:util";

/**
 * One readable block per message. Replaces the Python course's
 * `pprint(response["messages"])`.
 */
export function formatMessage(message: BaseMessage): string {
  const role = message.getType().toUpperCase();
  const text = message.text.trim();
  const lines = [`[${role}] ${text === "" ? "(no text content)" : text}`];

  const toolCalls = (message as AIMessage).tool_calls ?? [];
  for (const call of toolCalls) {
    lines.push(`  → tool call: ${call.name}(${JSON.stringify(call.args)})`);
  }

  return lines.join("\n");
}

export function printMessages(messages: BaseMessage[]): void {
  for (const message of messages) {
    console.log(formatMessage(message));
  }
}

/** Deep, colourised dump for inspecting raw response structures. */
export function printJson(value: unknown): void {
  console.log(inspect(value, { depth: 6, colors: true, maxStringLength: 2000 }));
}

export function heading(text: string): void {
  console.log(`\n${"─".repeat(60)}\n${text}\n${"─".repeat(60)}`);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/print.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/print.ts tests/lib/print.test.ts
git commit -m "feat: message and JSON printing helpers"
```

---

### Task 4: Step registration and execution

**Files:**
- Create: `src/runner/step.ts`
- Test: `tests/runner/step.test.ts`

**Interfaces:**
- Consumes: `heading` from `@/lib/print`
- Produces:
  - `interface LessonMeta { title: string; requires?: string[]; optional?: string[] }`
  - `interface Step { n: number; title: string; fn: () => void | Promise<void> }`
  - `step(n: number, title: string, fn: () => void | Promise<void>): void`
  - `getSteps(): Step[]`
  - `clearSteps(): void`
  - `runSteps(steps: Step[], options?: { only?: number }): Promise<void>`
  - `class UnknownStepError extends Error`

- [ ] **Step 1: Write the failing test**

Create `tests/runner/step.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  UnknownStepError,
  clearSteps,
  getSteps,
  runSteps,
  step,
} from "@/runner/step";

beforeEach(() => {
  clearSteps();
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/runner/step.test.ts`
Expected: FAIL — cannot resolve `@/runner/step`.

- [ ] **Step 3: Write `src/runner/step.ts`**

```ts
import { heading } from "@/lib/print";

/** Declared by every lesson module as `export const meta`. */
export interface LessonMeta {
  /** Human-readable lesson title, shown when the lesson runs. */
  title: string;
  /** Environment variables the lesson cannot run without. */
  requires?: string[];
  /** Variables that unlock some steps but are not fatal if absent. */
  optional?: string[];
}

export interface Step {
  n: number;
  title: string;
  fn: () => void | Promise<void>;
}

export class UnknownStepError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownStepError";
  }
}

const registry: Step[] = [];

/**
 * Register one step of a lesson. Called at module scope; the runner imports
 * the lesson module and then executes whatever was registered.
 */
export function step(n: number, title: string, fn: () => void | Promise<void>): void {
  if (registry.some((s) => s.n === n)) {
    throw new Error(`Duplicate step number ${n} ("${title}")`);
  }
  registry.push({ n, title, fn });
}

export function getSteps(): Step[] {
  return [...registry].sort((a, b) => a.n - b.n);
}

export function clearSteps(): void {
  registry.length = 0;
}

export async function runSteps(
  steps: Step[],
  options: { only?: number } = {},
): Promise<void> {
  let selected = steps;

  if (options.only !== undefined) {
    selected = steps.filter((s) => s.n === options.only);
    if (selected.length === 0) {
      const available = steps.map((s) => s.n).join(", ");
      throw new UnknownStepError(
        `No step ${options.only} in this lesson. Available steps: ${available}`,
      );
    }
  }

  for (const s of selected) {
    heading(`Step ${s.n}: ${s.title}`);
    await s.fn();
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/runner/step.test.ts`
Expected: 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/runner/step.ts tests/runner/step.test.ts
git commit -m "feat: step registration and execution"
```

---

### Task 5: Lesson discovery and ID resolution

**Files:**
- Create: `src/runner/registry.ts`
- Test: `tests/runner/registry.test.ts`

**Interfaces:**
- Consumes: `lessonsDir` from `@/lib/paths`
- Produces:
  - `interface LessonRef { id: string; module: string; path: string }`
  - `type Resolution = { kind: "found"; lesson: LessonRef } | { kind: "ambiguous"; matches: LessonRef[] } | { kind: "not-found"; query: string }`
  - `resolveLesson(query: string, lessons: LessonRef[]): Resolution`
  - `discoverLessons(dir?: string): Promise<LessonRef[]>`

`resolveLesson` is pure and takes the lesson list as an argument, so it is tested with fixtures rather than the filesystem.

- [ ] **Step 1: Write the failing test**

Create `tests/runner/registry.test.ts`:

```ts
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
```

Note: the `discoverLessons` test passes only once Tasks 7–13 have created the lesson files. Until then it fails on a short list — that is expected and is the signal that Module 1 is incomplete. Re-run it at the end of Task 13.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/runner/registry.test.ts`
Expected: FAIL — cannot resolve `@/runner/registry`.

- [ ] **Step 3: Write `src/runner/registry.ts`**

```ts
import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { lessonsDir } from "@/lib/paths";

export interface LessonRef {
  /** Filename without extension, e.g. "1.1-prompting". */
  id: string;
  /** Containing directory, e.g. "module-1". */
  module: string;
  /** Absolute path to the lesson file. */
  path: string;
}

export type Resolution =
  | { kind: "found"; lesson: LessonRef }
  | { kind: "ambiguous"; matches: LessonRef[] }
  | { kind: "not-found"; query: string };

/**
 * Match a user-supplied lesson query. An exact id always wins; otherwise a
 * prefix match resolves when it is unique.
 */
export function resolveLesson(query: string, lessons: LessonRef[]): Resolution {
  const needle = query.trim().toLowerCase();

  const exact = lessons.find((l) => l.id.toLowerCase() === needle);
  if (exact) return { kind: "found", lesson: exact };

  const matches = lessons.filter((l) => l.id.toLowerCase().startsWith(needle));
  if (matches.length === 1) return { kind: "found", lesson: matches[0] };
  if (matches.length > 1) return { kind: "ambiguous", matches };

  return { kind: "not-found", query };
}

/** Walk lessons/<module-*>/<id>.ts and build the lesson list. */
export async function discoverLessons(dir: string = lessonsDir): Promise<LessonRef[]> {
  const lessons: LessonRef[] = [];
  const modules = await readdir(dir, { withFileTypes: true });

  for (const moduleDir of modules) {
    if (!moduleDir.isDirectory()) continue;
    const files = await readdir(join(dir, moduleDir.name));
    for (const file of files) {
      if (!file.endsWith(".ts")) continue;
      lessons.push({
        id: basename(file, ".ts"),
        module: moduleDir.name,
        path: join(dir, moduleDir.name, file),
      });
    }
  }

  return lessons.sort((a, b) =>
    a.module === b.module ? a.id.localeCompare(b.id) : a.module.localeCompare(b.module),
  );
}
```

- [ ] **Step 4: Run the resolution tests to verify they pass**

Run: `npx vitest run tests/runner/registry.test.ts -t resolveLesson`
Expected: 6 tests PASS. The `discoverLessons` test still fails until Task 13.

- [ ] **Step 5: Commit**

```bash
git add src/runner/registry.ts tests/runner/registry.test.ts
git commit -m "feat: lesson discovery and id resolution"
```

---

### Task 6: Lesson runner CLI

**Files:**
- Create: `src/runner/cli.ts`
- Test: `tests/runner/cli.test.ts`

**Interfaces:**
- Consumes: `discoverLessons`, `resolveLesson` from `@/runner/registry`; `getSteps`, `runSteps`, `clearSteps`, `LessonMeta` from `@/runner/step`; `requireEnv`, `loadEnv` from `@/lib/env`; `heading` from `@/lib/print`
- Produces: `parseArgs(argv: string[]): CliOptions` where `interface CliOptions { query?: string; only?: number; list: boolean }`; `main(argv: string[]): Promise<number>`

Only `parseArgs` is unit-tested. `main` is exercised end-to-end by running a real lesson in Task 7.

- [ ] **Step 1: Write the failing test**

Create `tests/runner/cli.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/runner/cli.test.ts`
Expected: FAIL — cannot resolve `@/runner/cli`.

- [ ] **Step 3: Write `src/runner/cli.ts`**

```ts
import { pathToFileURL } from "node:url";
import { MissingEnvError, loadEnv, requireEnv } from "@/lib/env";
import { heading } from "@/lib/print";
import { discoverLessons, resolveLesson } from "@/runner/registry";
import { UnknownStepError, clearSteps, getSteps, runSteps } from "@/runner/step";
import type { LessonMeta } from "@/runner/step";

export interface CliOptions {
  query?: string;
  only?: number;
  list: boolean;
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { query: undefined, only: undefined, list: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--list" || arg === "-l") {
      options.list = true;
      continue;
    }

    if (arg === "--step" || arg === "-s") {
      const value = argv[i + 1];
      const parsed = Number(value);
      if (value === undefined || !Number.isInteger(parsed)) {
        throw new Error(`--step expects a number, got ${value ?? "nothing"}`);
      }
      options.only = parsed;
      i += 1;
      continue;
    }

    if (arg.startsWith("--step=")) {
      const value = arg.slice("--step=".length);
      const parsed = Number(value);
      if (!Number.isInteger(parsed)) {
        throw new Error(`--step expects a number, got ${value}`);
      }
      options.only = parsed;
      continue;
    }

    if (!arg.startsWith("-") && options.query === undefined) {
      options.query = arg;
    }
  }

  return options;
}

function printLessonList(lessons: Awaited<ReturnType<typeof discoverLessons>>): void {
  let currentModule = "";
  for (const lesson of lessons) {
    if (lesson.module !== currentModule) {
      currentModule = lesson.module;
      console.log(`\n${currentModule}`);
    }
    console.log(`  ${lesson.id}`);
  }
  console.log(`\nRun one with:  npm run lesson <id>`);
  console.log(`A single step:  npm run lesson <id> -- --step 2\n`);
}

export async function main(argv: string[]): Promise<number> {
  loadEnv();

  let options: CliOptions;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }

  const lessons = await discoverLessons();

  if (options.list || options.query === undefined) {
    printLessonList(lessons);
    return options.list ? 0 : 1;
  }

  const resolution = resolveLesson(options.query, lessons);

  if (resolution.kind === "not-found") {
    console.error(`No lesson matching "${resolution.query}".`);
    console.error(`Run \`npm run lessons\` to see the full list.`);
    return 1;
  }

  if (resolution.kind === "ambiguous") {
    console.error(`"${options.query}" matches more than one lesson:`);
    for (const match of resolution.matches) console.error(`  ${match.id}`);
    return 1;
  }

  const { lesson } = resolution;

  clearSteps();
  const imported: { meta?: LessonMeta } = await import(pathToFileURL(lesson.path).href);
  const meta = imported.meta;

  if (!meta) {
    console.error(`${lesson.id} does not export \`meta\`. Every lesson must.`);
    return 1;
  }

  try {
    for (const variable of meta.requires ?? []) requireEnv(variable);
  } catch (error) {
    if (error instanceof MissingEnvError) {
      console.error(`\n${error.message}\n`);
      return 1;
    }
    throw error;
  }

  heading(`${lesson.id} — ${meta.title}`);

  try {
    await runSteps(getSteps(), { only: options.only });
  } catch (error) {
    if (error instanceof UnknownStepError) {
      console.error(`\n${error.message}\n`);
      return 1;
    }
    throw error;
  }

  return 0;
}

process.exitCode = await main(process.argv.slice(2));
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/runner/cli.test.ts`
Expected: 6 tests PASS.

Note: `cli.ts` ends with a top-level `await main(...)`, which runs on import. The test imports only `parseArgs`, so it would trigger that too. Verify the test passes; if the top-level call interferes, guard it with `if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)` and re-run.

- [ ] **Step 5: Commit**

```bash
git add src/runner/cli.ts tests/runner/cli.test.ts
git commit -m "feat: lesson runner CLI"
```

---

### Task 7: Environment check command

**Files:**
- Create: `src/lib/env-report.ts`, `src/check-env.ts`
- Test: `tests/lib/env-report.test.ts`

**Interfaces:**
- Consumes: `isPlaceholder` from `@/lib/env`
- Produces:
  - `interface EnvFinding { level: "ok" | "warn" | "error"; message: string }`
  - `buildEnvReport(input: { env: NodeJS.ProcessEnv; nodeVersion: string }): EnvFinding[]`
  - `hasErrors(findings: EnvFinding[]): boolean`

This is the port of `env_utils.py`. All logic is pure and takes `env` plus `nodeVersion` as arguments, so it tests without touching the real process.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/env-report.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/env-report.test.ts`
Expected: FAIL — cannot resolve `@/lib/env-report`.

- [ ] **Step 3: Write `src/lib/env-report.ts`**

```ts
import { isPlaceholder } from "@/lib/env";

export interface EnvFinding {
  level: "ok" | "warn" | "error";
  message: string;
}

const MINIMUM_NODE_MAJOR = 20;

const REQUIRED_KEYS = [
  { name: "OPENAI_API_KEY", why: "every lesson uses an OpenAI model" },
  { name: "TAVILY_API_KEY", why: "lessons 1.2 web search and 1.5 personal chef" },
];

const OPTIONAL_KEYS = [
  { name: "ANTHROPIC_API_KEY", why: "lesson 1.1, model providers" },
  { name: "GOOGLE_API_KEY", why: "lesson 1.1, model providers" },
];

export function buildEnvReport(input: {
  env: NodeJS.ProcessEnv;
  nodeVersion: string;
}): EnvFinding[] {
  const { env, nodeVersion } = input;
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

  return findings;
}

export function hasErrors(findings: EnvFinding[]): boolean {
  return findings.some((f) => f.level === "error");
}
```

- [ ] **Step 4: Write `src/check-env.ts`**

```ts
import { loadEnv } from "@/lib/env";
import { buildEnvReport, hasErrors } from "@/lib/env-report";
import { heading } from "@/lib/print";

const SYMBOL = { ok: "✓", warn: "!", error: "✗" } as const;

loadEnv();

const findings = buildEnvReport({ env: process.env, nodeVersion: process.version });

heading("Environment check");
for (const finding of findings) {
  console.log(`${SYMBOL[finding.level]} ${finding.message}`);
}

if (hasErrors(findings)) {
  console.log(`\nSomething needs fixing. Copy .env.example to .env and fill in the keys:`);
  console.log(`  cp .env.example .env\n`);
  process.exitCode = 1;
} else {
  console.log(`\nYou are ready. Try:  npm run lessons\n`);
}
```

- [ ] **Step 5: Run the tests and the command to verify both work**

Run: `npx vitest run tests/lib/env-report.test.ts && npm run check-env`
Expected: 10 tests PASS. `npm run check-env` prints a report; its exit code depends on your own `.env`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/env-report.ts src/check-env.ts tests/lib/env-report.test.ts
git commit -m "feat: environment check command"
```

---

### Task 8: Lesson 1.1 — Foundational models

**Files:**
- Create: `lessons/module-1/1.1-foundational-models.ts`
- Create: `tests/lessons/module-1.test.ts`

**Interfaces:**
- Consumes: `step`, `LessonMeta` from `@/runner/step`; `printJson`, `printMessages` from `@/lib/print`
- Produces: `export const meta: LessonMeta`

Ports `notebooks/module-1/1.1_foundational_models.ipynb`. Steps 3 and 4 need optional provider keys and are skipped with a clear message when those are absent, so the lesson still runs with only an OpenAI key.

- [ ] **Step 1: Write the failing test**

Create `tests/lessons/module-1.test.ts`. This is the smoke-test suite that every later Module 1 task extends.

```ts
import { describe, expect, it } from "vitest";
import { clearSteps, getSteps } from "@/runner/step";
import type { LessonMeta } from "@/runner/step";

const LESSONS = ["1.1-foundational-models"];

describe.each(LESSONS)("lesson %s", (id) => {
  it("imports, exports meta, and registers steps", async () => {
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lessons/module-1.test.ts`
Expected: FAIL — cannot resolve the lesson module.

- [ ] **Step 3: Write `lessons/module-1/1.1-foundational-models.ts`**

```ts
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AIMessage, HumanMessage, createAgent, initChatModel } from "langchain";
import { isPlaceholder } from "@/lib/env";
import { printJson, printMessages } from "@/lib/print";
import { step, type LessonMeta } from "@/runner/step";

export const meta: LessonMeta = {
  title: "Foundational models — invoking, customising, providers, and streaming",
  requires: ["OPENAI_API_KEY"],
  optional: ["ANTHROPIC_API_KEY", "GOOGLE_API_KEY"],
};

const QUESTION = "What's the capital of the Moon?";

step(1, "Initialise and invoke a model", async () => {
  // initChatModel is async in JavaScript, unlike the Python course.
  const model = await initChatModel("gpt-5-nano");
  const response = await model.invoke(QUESTION);

  console.log(response.text);
  console.log("\nResponse metadata:");
  printJson(response.response_metadata);
});

step(2, "Customise the model with provider kwargs", async () => {
  const model = await initChatModel("gpt-5-nano", { temperature: 1.0 });
  const response = await model.invoke(QUESTION);
  console.log(response.text);
});

step(3, "Swap the provider — Anthropic", async () => {
  if (isPlaceholder(process.env.ANTHROPIC_API_KEY)) {
    console.log("Skipped: set ANTHROPIC_API_KEY in .env to run this step.");
    return;
  }
  const model = await initChatModel("claude-sonnet-4-6");
  const response = await model.invoke(QUESTION);
  console.log(response.text);
});

step(4, "Swap the provider — Google", async () => {
  if (isPlaceholder(process.env.GOOGLE_API_KEY)) {
    console.log("Skipped: set GOOGLE_API_KEY in .env to run this step.");
    return;
  }
  const model = new ChatGoogleGenerativeAI({ model: "gemini-3.1-flash-lite" });
  const response = await model.invoke(QUESTION);
  console.log(response.text);
});

step(5, "Initialise and invoke an agent", async () => {
  const agent = createAgent({ model: "gpt-5-nano" });
  const response = await agent.invoke({
    messages: [new HumanMessage(QUESTION)],
  });

  printMessages(response.messages);
  console.log("\nFinal answer:");
  console.log(response.messages.at(-1)?.text);
});

step(6, "Seed an agent with prior conversation turns", async () => {
  const agent = createAgent({ model: "gpt-5-nano" });
  const response = await agent.invoke({
    messages: [
      new HumanMessage(QUESTION),
      new AIMessage("The capital of the Moon is Luna City."),
      new HumanMessage("Interesting, tell me more about Luna City"),
    ],
  });

  printMessages(response.messages);
});

step(7, "Stream the output token by token", async () => {
  const agent = createAgent({ model: "gpt-5-nano" });
  const stream = await agent.stream(
    { messages: [new HumanMessage("Tell me all about Luna City, capital of the Moon")] },
    { streamMode: "messages" },
  );

  for await (const [token] of stream) {
    if (token.text) process.stdout.write(token.text);
  }
  console.log();
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lessons/module-1.test.ts && npm run typecheck`
Expected: 1 test PASS, typecheck clean.

- [ ] **Step 5: Run the lesson for real**

Run: `npm run lesson 1.1-foundational-models -- --step 1`
Expected: the model answers, then metadata prints. This is the first end-to-end proof that the CLI, registry, step runner, and env handling all work together. Needs a real `OPENAI_API_KEY`.

If step 7's stream tuple destructuring does not typecheck, print the chunk directly and adjust — `streamMode: "messages"` yields `[message, metadata]` pairs, but confirm against the installed types rather than forcing the shape.

- [ ] **Step 6: Commit**

```bash
git add lessons/module-1/1.1-foundational-models.ts tests/lessons/module-1.test.ts
git commit -m "feat: lesson 1.1 foundational models"
```

---

### Task 9: Lesson 1.1 — Prompting

**Files:**
- Create: `lessons/module-1/1.1-prompting.ts`
- Modify: `tests/lessons/module-1.test.ts` — add `"1.1-prompting"` to the `LESSONS` array

**Interfaces:**
- Consumes: `step`, `LessonMeta` from `@/runner/step`; `zod`
- Produces: `export const meta: LessonMeta`

Ports `notebooks/module-1/1.1_prompting.ipynb`. The Pydantic `CapitalInfo` model becomes a Zod object passed as `responseFormat`.

- [ ] **Step 1: Add the lesson to the smoke-test list**

In `tests/lessons/module-1.test.ts`, change the `LESSONS` constant to:

```ts
const LESSONS = ["1.1-foundational-models", "1.1-prompting"];
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lessons/module-1.test.ts`
Expected: FAIL — cannot resolve `1.1-prompting`.

- [ ] **Step 3: Write `lessons/module-1/1.1-prompting.ts`**

```ts
import { HumanMessage, createAgent } from "langchain";
import { z } from "zod";
import { step, type LessonMeta } from "@/runner/step";

export const meta: LessonMeta = {
  title: "Prompting — system prompts, few-shot examples, and structured output",
  requires: ["OPENAI_API_KEY"],
};

const QUESTION = new HumanMessage("What's the capital of the Moon?");

step(1, "No system prompt", async () => {
  const agent = createAgent({ model: "gpt-5-nano" });
  const response = await agent.invoke({ messages: [QUESTION] });
  console.log(response.messages.at(-1)?.text);
});

step(2, "Add a system prompt", async () => {
  const agent = createAgent({
    model: "gpt-5-nano",
    systemPrompt:
      "You are a science fiction writer, create a capital city at the users request.",
  });
  const response = await agent.invoke({ messages: [QUESTION] });
  console.log(response.messages.at(-1)?.text);
});

step(3, "Few-shot examples in the system prompt", async () => {
  const agent = createAgent({
    model: "gpt-5-nano",
    systemPrompt: `
You are a science fiction writer, create a space capital city at the users request.

User: What is the capital of mars?
Scifi Writer: Marsialis

User: What is the capital of Venus?
Scifi Writer: Venusovia
`,
  });
  const response = await agent.invoke({ messages: [QUESTION] });
  console.log(response.messages.at(-1)?.text);
});

step(4, "Ask for a specific structure in prose", async () => {
  const agent = createAgent({
    model: "gpt-5-nano",
    systemPrompt: `
You are a science fiction writer, create a space capital city at the users request.

Please keep to the below structure.

Name: The name of the capital city

Location: Where it is based

Vibe: 2-3 words to describe its vibe

Economy: Main industries
`,
  });
  const response = await agent.invoke({ messages: [QUESTION] });
  console.log(response.messages.at(-1)?.text);
});

step(5, "Structured output with a Zod schema", async () => {
  // The Python course uses a Pydantic BaseModel here; Zod is the TS equivalent.
  const capitalInfo = z.object({
    name: z.string(),
    location: z.string(),
    vibe: z.string(),
    economy: z.string(),
  });

  const agent = createAgent({
    model: "gpt-5-nano",
    systemPrompt:
      "You are a science fiction writer, create a capital city at the users request.",
    responseFormat: capitalInfo,
  });

  const response = await agent.invoke({
    messages: [new HumanMessage("What is the capital of The Moon?")],
  });

  const info = response.structuredResponse;
  console.log(info);
  console.log(`\n${info.name} is a city located at ${info.location}`);
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lessons/module-1.test.ts && npm run typecheck`
Expected: 2 tests PASS, typecheck clean.

If `response.structuredResponse` does not typecheck, check the installed types for the exact property name on the agent result and use that — the spec's parity table lists `responseFormat`, but the *result* property name must be read off the types, not assumed.

- [ ] **Step 5: Run the lesson for real**

Run: `npm run lesson 1.1-prompting -- --step 5`
Expected: a parsed object with `name`, `location`, `vibe`, `economy`, then the formatted sentence.

- [ ] **Step 6: Commit**

```bash
git add lessons/module-1/1.1-prompting.ts tests/lessons/module-1.test.ts
git commit -m "feat: lesson 1.1 prompting"
```

---

### Task 10: Lesson 1.2 — Tools

**Files:**
- Create: `lessons/module-1/1.2-tools.ts`
- Modify: `tests/lessons/module-1.test.ts` — add `"1.2-tools"`
- Test: `tests/lessons/tools.test.ts`

**Interfaces:**
- Consumes: `tool` from `langchain`; `ChatOllama` from `@langchain/ollama`
- Produces: `export const meta: LessonMeta`, `export const squareRoot` (exported so its logic is unit-testable)

Ports `notebooks/module-1/1.2_tools.ipynb`, which runs a local Ollama model. The lesson detects an unreachable Ollama daemon and prints setup instructions instead of a connection error.

- [ ] **Step 1: Write the failing tests**

In `tests/lessons/module-1.test.ts` change `LESSONS` to:

```ts
const LESSONS = ["1.1-foundational-models", "1.1-prompting", "1.2-tools"];
```

Create `tests/lessons/tools.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { squareRoot } from "../../lessons/module-1/1.2-tools";

describe("squareRoot tool", () => {
  it("is named so the model can call it", () => {
    expect(squareRoot.name).toBe("square_root");
  });

  it("has a description", () => {
    expect(squareRoot.description).toBeTruthy();
  });

  it("computes a square root", async () => {
    await expect(squareRoot.invoke({ x: 16 })).resolves.toBe(4);
  });

  it("computes the square root of the lesson's example value", async () => {
    const result = (await squareRoot.invoke({ x: 467 })) as number;
    expect(result).toBeCloseTo(21.6102, 3);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lessons/tools.test.ts`
Expected: FAIL — cannot resolve the lesson module.

- [ ] **Step 3: Write `lessons/module-1/1.2-tools.ts`**

```ts
import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, createAgent, tool } from "langchain";
import { z } from "zod";
import { printMessages, printJson } from "@/lib/print";
import { step, type LessonMeta } from "@/runner/step";

export const meta: LessonMeta = {
  title: "Tools — defining them, naming them, and giving them to an agent",
  requires: [],
};

/** The @tool decorator in Python becomes the tool() function here. */
export const squareRoot = tool(
  ({ x }) => x ** 0.5,
  {
    name: "square_root",
    description: "Calculate the square root of a number",
    schema: z.object({ x: z.number() }),
  },
);

const OLLAMA_MODEL = "qwen3:4b";

async function ollamaIsRunning(): Promise<boolean> {
  const host = process.env.OLLAMA_HOST ?? "http://localhost:11434";
  try {
    const response = await fetch(`${host}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function explainOllama(): void {
  console.log(`This step runs a local model with Ollama, which is not reachable.`);
  console.log(`\n  1. Install Ollama:  https://ollama.com/download`);
  console.log(`  2. Pull the model:  ollama pull ${OLLAMA_MODEL}`);
  console.log(`  3. Re-run:          npm run lesson 1.2-tools\n`);
}

step(1, "Inspect a tool's name, description, and schema", async () => {
  console.log(`name:        ${squareRoot.name}`);
  console.log(`description: ${squareRoot.description}`);
  console.log(`\nJSON schema the model sees:`);
  printJson(squareRoot.schema);
});

step(2, "Invoke a tool directly, without a model", async () => {
  const result = await squareRoot.invoke({ x: 467 });
  console.log(`square_root(467) = ${result}`);
});

step(3, "Give the tool to an agent running a local model", async () => {
  if (!(await ollamaIsRunning())) {
    explainOllama();
    return;
  }

  const agent = createAgent({
    model: new ChatOllama({ model: OLLAMA_MODEL }),
    tools: [squareRoot],
    systemPrompt:
      "You are an arithmetic wizard. Use your tools to calculate the square root of any number.",
  });

  const response = await agent.invoke({
    messages: [new HumanMessage("What is the square root of 467?")],
  });

  console.log(response.messages.at(-1)?.text);
});

step(4, "See the tool call the model made", async () => {
  if (!(await ollamaIsRunning())) {
    explainOllama();
    return;
  }

  const agent = createAgent({
    model: new ChatOllama({ model: OLLAMA_MODEL }),
    tools: [squareRoot],
    systemPrompt: "You are an arithmetic wizard. Use your tools.",
  });

  const response = await agent.invoke({
    messages: [new HumanMessage("What is the square root of 467?")],
  });

  // printMessages renders tool calls inline, which is the point of this step.
  printMessages(response.messages);
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lessons/ && npm run typecheck`
Expected: 4 tool tests PASS, 3 smoke tests PASS, typecheck clean.

- [ ] **Step 5: Run the lesson for real**

Run: `npm run lesson 1.2-tools -- --step 2`
Expected: `square_root(467) = 21.610182...`. No API key or Ollama needed for step 2.

- [ ] **Step 6: Commit**

```bash
git add lessons/module-1/1.2-tools.ts tests/lessons/
git commit -m "feat: lesson 1.2 tools"
```

---

### Task 11: Lesson 1.2 — Web search

**Files:**
- Create: `lessons/module-1/1.2-web-search.ts`
- Modify: `tests/lessons/module-1.test.ts` — add `"1.2-web-search"`

**Interfaces:**
- Consumes: `TavilySearch` from `@langchain/tavily`
- Produces: `export const meta: LessonMeta`

Ports `notebooks/module-1/1.2_web_search.ipynb`. The Python course wraps `TavilyClient` in a hand-written `@tool`; `@langchain/tavily` ships `TavilySearch` as a ready-made tool, so the lesson shows both — the packaged tool and a hand-rolled wrapper, which is the teaching point.

- [ ] **Step 1: Add the lesson to the smoke-test list**

```ts
const LESSONS = [
  "1.1-foundational-models",
  "1.1-prompting",
  "1.2-tools",
  "1.2-web-search",
];
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lessons/module-1.test.ts`
Expected: FAIL — cannot resolve `1.2-web-search`.

- [ ] **Step 3: Write `lessons/module-1/1.2-web-search.ts`**

```ts
import { TavilySearch } from "@langchain/tavily";
import { HumanMessage, createAgent, tool } from "langchain";
import { z } from "zod";
import { printMessages } from "@/lib/print";
import { step, type LessonMeta } from "@/runner/step";

export const meta: LessonMeta = {
  title: "Web search — giving an agent access to current information",
  requires: ["OPENAI_API_KEY", "TAVILY_API_KEY"],
};

const QUESTION = "Who is the current mayor of San Francisco?";

/** The packaged Tavily tool — the usual way to do this in TypeScript. */
const tavilySearch = new TavilySearch({ maxResults: 5 });

/**
 * A hand-written equivalent, matching the Python course's @tool wrapper.
 * Useful to see that a tool is just a function plus a schema.
 */
const webSearch = tool(
  async ({ query }) => tavilySearch.invoke({ query }),
  {
    name: "web_search",
    description: "Search the web for information",
    schema: z.object({ query: z.string() }),
  },
);

step(1, "Ask without web search — the model relies on training data", async () => {
  const agent = createAgent({ model: "gpt-5-nano" });
  const response = await agent.invoke({
    messages: [new HumanMessage("How up to date is your training knowledge?")],
  });
  console.log(response.messages.at(-1)?.text);
});

step(2, "Call the search tool directly", async () => {
  const results = await webSearch.invoke({ query: QUESTION });
  console.log(results);
});

step(3, "Give the agent the search tool", async () => {
  const agent = createAgent({ model: "gpt-5-nano", tools: [webSearch] });
  const response = await agent.invoke({ messages: [new HumanMessage(QUESTION)] });

  printMessages(response.messages);
  console.log("\nFinal answer:");
  console.log(response.messages.at(-1)?.text);
});

step(4, "Use the packaged TavilySearch tool instead", async () => {
  const agent = createAgent({ model: "gpt-5-nano", tools: [tavilySearch] });
  const response = await agent.invoke({ messages: [new HumanMessage(QUESTION)] });
  console.log(response.messages.at(-1)?.text);
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lessons/module-1.test.ts && npm run typecheck`
Expected: 4 tests PASS, typecheck clean.

- [ ] **Step 5: Run the lesson for real**

Run: `npm run lesson 1.2-web-search -- --step 3`
Expected: the transcript shows a `web_search` tool call followed by an answer naming the current mayor.

- [ ] **Step 6: Commit**

```bash
git add lessons/module-1/1.2-web-search.ts tests/lessons/module-1.test.ts
git commit -m "feat: lesson 1.2 web search"
```

---

### Task 12: Lesson 1.3 — Memory

**Files:**
- Create: `lessons/module-1/1.3-memory.ts`
- Modify: `tests/lessons/module-1.test.ts` — add `"1.3-memory"`

**Interfaces:**
- Consumes: `MemorySaver` from `@langchain/langgraph`
- Produces: `export const meta: LessonMeta`

Ports `notebooks/module-1/1.3_memory.ipynb`. Python's `InMemorySaver` is `MemorySaver` in TypeScript.

- [ ] **Step 1: Add the lesson to the smoke-test list**

```ts
const LESSONS = [
  "1.1-foundational-models",
  "1.1-prompting",
  "1.2-tools",
  "1.2-web-search",
  "1.3-memory",
];
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lessons/module-1.test.ts`
Expected: FAIL — cannot resolve `1.3-memory`.

- [ ] **Step 3: Write `lessons/module-1/1.3-memory.ts`**

```ts
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage, createAgent } from "langchain";
import { printMessages } from "@/lib/print";
import { step, type LessonMeta } from "@/runner/step";

export const meta: LessonMeta = {
  title: "Short-term memory — checkpointers and thread ids",
  requires: ["OPENAI_API_KEY"],
};

const INTRO = "Hello my name is Seán and my favourite colour is green";
const RECALL = "What's my favourite colour?";

step(1, "Without a checkpointer the agent forgets between invocations", async () => {
  const agent = createAgent({ model: "gpt-5-nano" });

  await agent.invoke({ messages: [new HumanMessage(INTRO)] });

  // A second, entirely separate invocation — nothing carries over.
  const response = await agent.invoke({ messages: [new HumanMessage(RECALL)] });

  console.log(response.messages.at(-1)?.text);
  console.log("\nThe agent cannot answer — each invoke starts from scratch.");
});

step(2, "Add a checkpointer and reuse a thread id", async () => {
  // Python calls this InMemorySaver; in TypeScript it is MemorySaver.
  const agent = createAgent({ model: "gpt-5-nano", checkpointer: new MemorySaver() });
  const config = { configurable: { thread_id: "1" } };

  await agent.invoke({ messages: [new HumanMessage(INTRO)] }, config);
  const response = await agent.invoke({ messages: [new HumanMessage(RECALL)] }, config);

  console.log(response.messages.at(-1)?.text);
});

step(3, "Inspect the full thread — earlier turns are replayed to the model", async () => {
  const agent = createAgent({ model: "gpt-5-nano", checkpointer: new MemorySaver() });
  const config = { configurable: { thread_id: "1" } };

  await agent.invoke({ messages: [new HumanMessage(INTRO)] }, config);
  const response = await agent.invoke({ messages: [new HumanMessage(RECALL)] }, config);

  printMessages(response.messages);
});

step(4, "A different thread id is a different conversation", async () => {
  const agent = createAgent({ model: "gpt-5-nano", checkpointer: new MemorySaver() });

  await agent.invoke(
    { messages: [new HumanMessage(INTRO)] },
    { configurable: { thread_id: "1" } },
  );

  const response = await agent.invoke(
    { messages: [new HumanMessage(RECALL)] },
    { configurable: { thread_id: "2" } },
  );

  console.log(response.messages.at(-1)?.text);
  console.log("\nThread 2 never heard the introduction.");
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lessons/module-1.test.ts && npm run typecheck`
Expected: 5 tests PASS, typecheck clean.

- [ ] **Step 5: Run the lesson for real**

Run: `npm run lesson 1.3-memory -- --step 2`
Expected: the agent answers "green".

- [ ] **Step 6: Commit**

```bash
git add lessons/module-1/1.3-memory.ts tests/lessons/module-1.test.ts
git commit -m "feat: lesson 1.3 memory"
```

---

### Task 13: Lesson 1.4 — Multimodal messages

**Files:**
- Create: `lessons/module-1/1.4-multimodal-messages.ts`
- Copy: `resources/moon.png` from the Python repo
- Modify: `tests/lessons/module-1.test.ts` — add `"1.4-multimodal-messages"`

**Interfaces:**
- Consumes: `resource` from `@/lib/paths`
- Produces: `export const meta: LessonMeta`

Ports `notebooks/module-1/1.4_multimodal_messages.ipynb`. The notebook's `ipywidgets` upload becomes a file read, and its `sounddevice` microphone capture becomes a `.wav` file path with an optional recording helper — the two changes the spec calls out.

- [ ] **Step 1: Copy the image resource**

```bash
mkdir -p resources
cp /Users/neerajkumar/Documents/MyProjects/lca-lc-foundations/notebooks/module-1/resources/moon.png resources/moon.png
```

- [ ] **Step 2: Add the lesson to the smoke-test list**

```ts
const LESSONS = [
  "1.1-foundational-models",
  "1.1-prompting",
  "1.2-tools",
  "1.2-web-search",
  "1.3-memory",
  "1.4-multimodal-messages",
];
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/lessons/module-1.test.ts`
Expected: FAIL — cannot resolve `1.4-multimodal-messages`.

- [ ] **Step 4: Write `lessons/module-1/1.4-multimodal-messages.ts`**

```ts
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { HumanMessage, createAgent } from "langchain";
import { resource } from "@/lib/paths";
import { step, type LessonMeta } from "@/runner/step";

export const meta: LessonMeta = {
  title: "Multimodal messages — text, image, and audio content blocks",
  requires: ["OPENAI_API_KEY"],
};

const SCIFI_PROMPT =
  "You are a science fiction writer, create a capital city at the users request.";

/** Read a file and base64-encode it, which is how binary content blocks travel. */
async function encodeBase64(path: string): Promise<string> {
  const bytes = await readFile(path);
  return bytes.toString("base64");
}

step(1, "Text content as an explicit content block", async () => {
  const agent = createAgent({ model: "gpt-5-nano", systemPrompt: SCIFI_PROMPT });

  // A plain string is shorthand for exactly this.
  const question = new HumanMessage({
    content: [{ type: "text", text: "What is the capital of The Moon?" }],
  });

  const response = await agent.invoke({ messages: [question] });
  console.log(response.messages.at(-1)?.text);
});

step(2, "Image input from a file", async () => {
  // The Python notebook uses an ipywidgets upload button; in Node we read
  // straight from disk.
  const imagePath = resource("moon.png");
  const imageBase64 = await encodeBase64(imagePath);

  const agent = createAgent({ model: "gpt-5-nano", systemPrompt: SCIFI_PROMPT });

  const question = new HumanMessage({
    content: [
      { type: "text", text: "Tell me about this capital" },
      { type: "image", base64: imageBase64, mime_type: "image/png" },
    ],
  });

  const response = await agent.invoke({ messages: [question] });
  console.log(response.messages.at(-1)?.text);
});

step(3, "Audio input from a .wav file", async () => {
  // The Python notebook records from the microphone with sounddevice. Node has
  // no equivalent, so this step reads a wav file you provide.
  const audioPath = resource("question.wav");

  if (!existsSync(audioPath)) {
    console.log(`No audio file at ${audioPath}.`);
    console.log(`\nRecord five seconds of yourself asking a question:`);
    console.log(`  macOS (needs sox):  sox -d -r 44100 -c 1 resources/question.wav trim 0 5`);
    console.log(`  ffmpeg (macOS):     ffmpeg -f avfoundation -i ":0" -t 5 resources/question.wav`);
    console.log(`  ffmpeg (Linux):     ffmpeg -f alsa -i default -t 5 resources/question.wav`);
    console.log(`\nThen re-run:  npm run lesson 1.4-multimodal-messages -- --step 3\n`);
    return;
  }

  const audioBase64 = await encodeBase64(audioPath);
  const agent = createAgent({ model: "gpt-audio" });

  const question = new HumanMessage({
    content: [
      { type: "text", text: "Tell me about this audio file" },
      { type: "audio", base64: audioBase64, mime_type: "audio/wav" },
    ],
  });

  const response = await agent.invoke({ messages: [question] });
  console.log(response.messages.at(-1)?.text);
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/lessons/module-1.test.ts && npm run typecheck`
Expected: 6 tests PASS, typecheck clean.

If the `image` or `audio` content-block shape does not typecheck, read the installed `@langchain/core` message content-block types and use the shape they define. Do not cast to `any` to force it through — the correct block shape is part of what this lesson teaches.

- [ ] **Step 6: Run the lesson for real**

Run: `npm run lesson 1.4-multimodal-messages -- --step 2`
Expected: the model describes the moon image.

- [ ] **Step 7: Commit**

```bash
git add resources/moon.png lessons/module-1/1.4-multimodal-messages.ts tests/lessons/module-1.test.ts
git commit -m "feat: lesson 1.4 multimodal messages"
```

---

### Task 14: Lesson 1.5 — Personal chef, and the Studio config

**Files:**
- Create: `lessons/module-1/1.5-personal-chef.ts`
- Create: `studio/module-1/agent.ts`, `studio/module-1/langgraph.json`
- Modify: `package.json` — add the `studio:m1` script and `@langchain/langgraph-cli` dev dependency
- Modify: `tests/lessons/module-1.test.ts` — add `"1.5-personal-chef"`
- Test: `tests/studio/module-1.test.ts`

**Interfaces:**
- Consumes: `TavilySearch` from `@langchain/tavily`; `MemorySaver` from `@langchain/langgraph`
- Produces: `export const meta: LessonMeta` from the lesson; `export const agent` from `studio/module-1/agent.ts`

This is the Module 1 capstone. It pairs with the Studio config because both wrap the same agent — the notebook's `1.5_personal_chef.py` exists solely to give `langgraph.json` a graph to point at.

- [ ] **Step 1: Add both to the test lists**

In `tests/lessons/module-1.test.ts`:

```ts
const LESSONS = [
  "1.1-foundational-models",
  "1.1-prompting",
  "1.2-tools",
  "1.2-web-search",
  "1.3-memory",
  "1.4-multimodal-messages",
  "1.5-personal-chef",
];
```

Create `tests/studio/module-1.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { projectRoot } from "@/lib/paths";

describe("module-1 studio config", () => {
  it("exports a compiled agent graph", async () => {
    const { agent } = await import("../../studio/module-1/agent");
    expect(agent).toBeDefined();
    expect(typeof agent.invoke).toBe("function");
  });

  it("points langgraph.json at that exported graph", async () => {
    const raw = await readFile(join(projectRoot, "studio/module-1/langgraph.json"), "utf8");
    const config = JSON.parse(raw) as { graphs: Record<string, string> };
    expect(config.graphs.agent).toBe("./agent.ts:agent");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lessons/module-1.test.ts tests/studio/module-1.test.ts`
Expected: FAIL — neither module resolves.

- [ ] **Step 3: Write `lessons/module-1/1.5-personal-chef.ts`**

```ts
import { MemorySaver } from "@langchain/langgraph";
import { TavilySearch } from "@langchain/tavily";
import { HumanMessage, createAgent, tool } from "langchain";
import { z } from "zod";
import { printMessages } from "@/lib/print";
import { step, type LessonMeta } from "@/runner/step";

export const meta: LessonMeta = {
  title: "Project: Personal Chef — tools, a system prompt, and memory together",
  requires: ["OPENAI_API_KEY", "TAVILY_API_KEY"],
};

const tavilySearch = new TavilySearch({ maxResults: 5 });

const webSearch = tool(
  async ({ query }) => tavilySearch.invoke({ query }),
  {
    name: "web_search",
    description: "Search the web for information",
    schema: z.object({ query: z.string() }),
  },
);

const SYSTEM_PROMPT = `
You are a personal chef. The user will give you a list of ingredients they have left over in their house.

Using the web search tool, search the web for recipes that can be made with the ingredients they have.

Return recipe suggestions and eventually the recipe instructions to the user, if requested.
`;

/** Everything Module 1 taught, in one agent. */
function createChef() {
  return createAgent({
    model: "gpt-5-nano",
    tools: [webSearch],
    systemPrompt: SYSTEM_PROMPT,
    checkpointer: new MemorySaver(),
  });
}

step(1, "Ask the chef what to cook", async () => {
  const chef = createChef();
  const config = { configurable: { thread_id: "1" } };

  const response = await chef.invoke(
    {
      messages: [
        new HumanMessage("I have some leftover chicken and rice. What can I make?"),
      ],
    },
    config,
  );

  console.log(response.messages.at(-1)?.text);
});

step(2, "See how the chef researched the answer", async () => {
  const chef = createChef();
  const config = { configurable: { thread_id: "1" } };

  const response = await chef.invoke(
    {
      messages: [
        new HumanMessage("I have some leftover chicken and rice. What can I make?"),
      ],
    },
    config,
  );

  printMessages(response.messages);
});

step(3, "Follow up — memory keeps the suggestions in context", async () => {
  const chef = createChef();
  const config = { configurable: { thread_id: "1" } };

  await chef.invoke(
    {
      messages: [
        new HumanMessage("I have some leftover chicken and rice. What can I make?"),
      ],
    },
    config,
  );

  const response = await chef.invoke(
    { messages: [new HumanMessage("Give me the full instructions for the first one.")] },
    config,
  );

  console.log(response.messages.at(-1)?.text);
});
```

- [ ] **Step 4: Write `studio/module-1/agent.ts`**

```ts
import { TavilySearch } from "@langchain/tavily";
import { createAgent, tool } from "langchain";
import { z } from "zod";
import { loadEnv } from "@/lib/env";

loadEnv();

const tavilySearch = new TavilySearch({ maxResults: 5 });

const webSearch = tool(
  async ({ query }) => tavilySearch.invoke({ query }),
  {
    name: "web_search",
    description: "Search the web for information",
    schema: z.object({ query: z.string() }),
  },
);

/**
 * The graph LangGraph Studio loads. Studio supplies its own persistence, so
 * this agent deliberately has no checkpointer.
 */
export const agent = createAgent({
  model: "gpt-5-nano",
  tools: [webSearch],
  systemPrompt: `
You are a personal chef. The user will give you a list of ingredients they have left over in their house.

Using the web search tool, search the web for recipes that can be made with the ingredients they have.

Return recipe suggestions and eventually the recipe instructions to the user, if requested.
`,
});
```

- [ ] **Step 5: Write `studio/module-1/langgraph.json`**

```json
{
  "node_version": "20",
  "dependencies": ["../.."],
  "graphs": {
    "agent": "./agent.ts:agent"
  },
  "env": "../../.env"
}
```

- [ ] **Step 6: Add the Studio script and dependency to `package.json`**

Add to `"scripts"`:

```json
"studio:m1": "cd studio/module-1 && npx @langchain/langgraph-cli dev"
```

Add to `"devDependencies"`:

```json
"@langchain/langgraph-cli": "^1.4.6"
```

Then run `npm install`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck`
Expected: every suite PASSES — including the `discoverLessons` test from Task 5, which now sees all seven Module 1 lessons. Typecheck clean.

- [ ] **Step 8: Run the lesson and Studio for real**

Run: `npm run lesson 1.5-personal-chef -- --step 1`
Expected: recipe suggestions built from a web search.

Run: `npm run studio:m1`
Expected: Studio starts and serves the `agent` graph. Stop it with Ctrl-C.

- [ ] **Step 9: Commit**

```bash
git add lessons/module-1/1.5-personal-chef.ts studio/ tests/ package.json package-lock.json
git commit -m "feat: lesson 1.5 personal chef and module 1 studio config"
```

---

### Task 15: README

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: every command established by Tasks 1–14
- Produces: nothing code-facing

- [ ] **Step 1: Write `README.md`**

````markdown
# Introduction to LangChain — TypeScript

A Node.js + TypeScript port of [LangChain Academy's Introduction to LangChain](https://academy.langchain.com/courses/foundation-introduction-to-langchain-python), which is taught in Python. Same curriculum, same lesson order, TypeScript throughout.

## Setup

Requires **Node.js 20 or newer**.

```bash
npm install
cp .env.example .env   # then fill in your keys
npm run check-env      # verifies Node, keys, and tracing config
```

You need an `OPENAI_API_KEY` ([get one](https://openai.com/index/openai-api/)) and a
`TAVILY_API_KEY` ([generous free tier](https://tavily.com)). Anthropic and Google keys
are optional — only lesson 1.1 uses them, and it skips those steps without them.

## Running lessons

```bash
npm run lessons                          # list every lesson
npm run lesson 1.3-memory                # run all of a lesson
npm run lesson 1.3-memory -- --step 2    # run one step
```

Lesson IDs accept unambiguous prefixes: `npm run lesson 1.3` works, but `1.1` is
ambiguous (two lessons share it) and will list the candidates.

Each step is self-contained, so `--step 3` runs without needing steps 1 and 2 first.

## Lessons

### Module 1 — Create Agent

| Lesson | Topic |
|---|---|
| `1.1-foundational-models` | Invoking models, provider swapping, streaming |
| `1.1-prompting` | System prompts, few-shot examples, structured output |
| `1.2-tools` | Defining tools, binding them to an agent (local Ollama model) |
| `1.2-web-search` | Giving an agent current information via Tavily |
| `1.3-memory` | Checkpointers and thread ids |
| `1.4-multimodal-messages` | Text, image, and audio content blocks |
| `1.5-personal-chef` | Project: everything above in one agent |

Modules 2 and 3 land in later phases.

## LangGraph Studio

```bash
npm run studio:m1
```

Serves the Module 1 personal-chef agent so you can step through it visually.

## Development

```bash
npm test          # vitest — hermetic, no API keys or network needed
npm run typecheck # tsc --noEmit
```

## Differences from the Python course

Three places where TypeScript needed a different approach:

- **Lessons are `.ts` scripts, not notebooks.** Each lesson splits into numbered
  `step()` blocks that mirror the notebook's cells.
- **`initChatModel` is async here.** Always `await` it. The Python version is
  synchronous.
- **Lesson 1.4 reads files instead of using notebook widgets.** The image comes from
  `resources/moon.png`; audio comes from a `.wav` path, and the lesson prints a
  `sox` / `ffmpeg` command for recording one.

Naming follows TypeScript conventions: `create_agent` → `createAgent`,
`system_prompt` → `systemPrompt`, `InMemorySaver` → `MemorySaver`. Message *fields*
stay snake_case (`response_metadata`, `tool_calls`), matching LangChain JS.
````

- [ ] **Step 2: Verify every documented command actually works**

Run each in order and confirm it behaves as the README claims:

```bash
npm run check-env
npm run lessons
npm run lesson 1.3
npm test
npm run typecheck
```

Expected: `npm run lesson 1.3` resolves to `1.3-memory` by prefix. Fix the README if any command's real behaviour differs — the README is wrong, not the code.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README for phase 1"
```

---

## Self-Review

**Spec coverage.** Walked each spec section against the plan:

| Spec requirement | Task |
|---|---|
| Layout (`src/lib`, `src/runner`, `lessons`, `studio`, `tests`) | 1–14 |
| Step runner with `--step`, standalone steps | 4, 6 |
| Lesson IDs, prefix and ambiguity resolution | 5 |
| Self-contained lessons, shared infrastructure only | 8–14 (each lesson redefines `webSearch`) |
| `printMessages` replacing `pprint` | 3 |
| Env validation, friendly missing-key errors | 2 |
| `check-env` as the `env_utils.py` port | 7 |
| Lesson 1.2 Ollama degradation | 10 |
| Lesson 1.4 file-based image and audio | 13 |
| Import smoke tests for every lesson | 8, extended by 9–14 |
| Runner, env-checker, and pure-tool unit tests | 4, 5, 6, 7, 10 |
| Module 1 Studio config | 14 |
| All seven Module 1 lessons | 8–14 |

No gaps. Out-of-phase spec items (Modules 2 and 3, the TS MCP server, Chinook/PDF resources) are correctly absent.

**Placeholder scan.** No "TBD", "TODO", or "add error handling" steps. Every code step carries real code. Three steps instruct the implementer to read installed types rather than guess — Task 8 step 5 (stream tuple), Task 9 step 4 (`structuredResponse` property name), Task 13 step 5 (content-block shape). These are deliberate: they name the exact uncertainty and forbid casting around it, rather than asserting a shape I could not verify without installing.

**Type consistency.** Checked identifiers across task boundaries: `step`/`getSteps`/`clearSteps`/`runSteps`/`LessonMeta` (Task 4) match every lesson's usage; `LessonRef`/`resolveLesson`/`discoverLessons` (Task 5) match Task 6's CLI; `isPlaceholder` (Task 2) is reused by Task 7's report and Task 8's optional-key skip; `resource()` (Task 1) is used in Task 13; `heading` (Task 3) is used in Tasks 4, 6, and 7; `printMessages`/`printJson` names are consistent throughout. `MemorySaver` is used in Tasks 12 and 14, never `InMemorySaver`.

One known cross-task dependency, flagged in place: the `discoverLessons` test written in Task 5 does not pass until Task 14 creates the seventh lesson. Task 5 step 4 runs only the `resolveLesson` tests; Task 14 step 7 runs the full suite.
