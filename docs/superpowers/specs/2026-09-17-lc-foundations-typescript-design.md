# LangChain Foundations — TypeScript Port

**Date:** 2026-09-17
**Status:** Approved for planning
**Source:** `/Users/neerajkumar/Documents/MyProjects/lca-lc-foundations` (Python)
**Target:** `/Users/neerajkumar/Documents/MyProjects/WorkShop-LC101` (Node.js + TypeScript)

## Goal

Port LangChain Academy's "Introduction to LangChain" course from Python Jupyter
notebooks to a Node.js + TypeScript workshop repository. The port teaches the same
concepts in the same order; it is not a rewrite of the curriculum.

## Source material

21 notebooks across three modules, roughly 48 KB of code, plus supporting files:

| Module | Lessons | Concepts |
|---|---|---|
| 1 — Create Agent | 7 | foundational models, prompting, tools, web search, memory, multimodal, personal chef |
| 2 — Advanced Agent | 7 | MCP, travel agent, runtime context, state, multi-agent, wedding planner, RAG + SQL bonuses |
| 3 — Production Agent | 6 | message management, HITL, dynamic models/prompts/tools, email agent |

Also: `env_utils.py` (setup verifier), two `langgraph.json` Studio configs, a Python
MCP server, `Chinook.db`, an employee-handbook PDF, and `moon.png`.

The `agent-chat-ui` directory in module 3 is already a TypeScript Next.js app. It is
out of scope — it is copied or referenced, not ported.

## Verified API parity

Package versions and exports were checked against the npm registry and the shipped
type definitions, not assumed.

| Python | TypeScript | Notes |
|---|---|---|
| `langchain` 1.3 | `langchain` 1.5.11 | |
| `create_agent(...)` | `createAgent({...})` | same option set |
| `model=`, `tools=`, `system_prompt=` | `model`, `tools`, `systemPrompt` | camelCase rename only |
| `state_schema=`, `context_schema=` | `stateSchema`, `contextSchema` | |
| `response_format=`, `checkpointer=` | `responseFormat`, `checkpointer` | |
| `@tool` + `ToolRuntime` | `tool(fn, fields)`, second arg `ToolRuntime<TState, TContext>` | direct parity |
| `InMemorySaver` | `MemorySaver` | `@langchain/langgraph` 1.4.15 |
| `Command(update=...)` | `new Command({ update: ... })` | |
| `@wrap_model_call`, `@before_agent` | `createMiddleware({ wrapModelCall, beforeAgent })` | decorator → factory |
| `@dynamic_prompt` | `dynamicSystemPromptMiddleware` | |
| `HumanInTheLoopMiddleware` | `humanInTheLoopMiddleware` | |
| `SummarizationMiddleware` | `summarizationMiddleware` | |
| Pydantic `BaseModel` | Zod object | |
| `@dataclass` context | Zod object with `.default()` per field | |
| `TavilyClient` | `@langchain/tavily` 1.2.0 | |
| `ChatOllama` | `@langchain/ollama` 1.3.0 | |
| `SQLDatabase.from_uri` | `SqlDatabase` from `@langchain/community` 1.1.29 | |
| `PyPDFLoader` | `PDFLoader` from `@langchain/community` | |
| `InMemoryVectorStore` | `MemoryVectorStore` | |
| `langgraph dev` | `@langchain/langgraph-cli` 1.4.6 | |

### Known gaps

Three places where the JS side is not a drop-in equivalent.

1. **`MultiServerMCPClient.get_prompt()` does not exist in JS.** The JS client exposes
   `getTools`, `listResources`, `listResourceTemplates`, `readResource`, and
   `getClient`. Lesson 2.1 fetches an MCP prompt, so it will reach the underlying MCP
   SDK client via `client.getClient("local_server")` and call `getPrompt` there.

2. **MCP tool interceptors differ.** Python's `tool_interceptors=[RetryMCPInterceptor()]`
   (lesson 2.4) has no direct JS analogue; JS offers `beforeToolCall` hooks on the
   client and a first-class `toolRetryMiddleware` in `langchain`. Lesson 2.4 will use
   `toolRetryMiddleware`, which is simpler than the Python original and teaches the
   idiomatic JS answer.

3. **Lesson 1.4 relies on notebook-only hardware I/O.** `ipywidgets.FileUpload` and
   `sounddevice` microphone capture have no Node equivalent. Replacement below.

## Architecture

### Lesson format: runnable scripts with a step runner

One `.ts` file per lesson, executed with `tsx`. Each lesson is divided into numbered
`step()` blocks that mirror the notebook's cells.

```ts
step(1, "Initialise and invoke a model", async () => {
  const model = await initChatModel("gpt-5-nano");
  const res = await model.invoke("What's the capital of the Moon?");
  console.log(res.text);
});
```

```
npm run lessons                            # list every lesson
npm run lesson 1.1-prompting               # run all steps
npm run lesson 1.1-prompting -- --step 3   # run only step 3
```

**Steps must stand alone.** `--step 3` runs step 3 without running steps 1 and 2, so a
step may not depend on a variable another step assigned. Shared, read-only setup
(imports, tool definitions, system prompts) lives at module scope; anything a step
mutates or reconfigures, that step builds for itself. Where the notebook rebuilds an
agent across cells — lesson 1.1 constructs three models in sequence — each step
constructs its own.

Lesson IDs are full slugs. `1.1` is ambiguous (`1.1-foundational-models` and
`1.1-prompting` both exist), so the CLI resolves unambiguous prefixes and lists
candidates for ambiguous ones.

### Code sharing: self-contained lessons, shared infrastructure

Teaching code is deliberately duplicated. The `webSearch` tool is defined inline in
each of the five lessons that use it, because seeing the definition is the lesson.
Only non-teaching infrastructure is shared: the step runner, environment loading and
validation, console printing helpers, resource paths, and the MCP server.

### Layout

```
WorkShop-LC101/
├── package.json, tsconfig.json, vitest.config.ts
├── .env.example, .gitignore, README.md
├── src/
│   ├── runner/step.ts        # step() registration + execution
│   ├── runner/cli.ts         # argument parsing, lesson resolution
│   ├── runner/registry.ts    # lesson id → module path
│   ├── lib/env.ts            # dotenv load, typed + validated access
│   ├── lib/print.ts          # message and JSON printers (replaces pprint)
│   └── check-env.ts          # port of env_utils.py
├── lessons/
│   ├── module-1/             # 7 lessons
│   ├── module-2/             # 7 lessons
│   └── module-3/             # 6 lessons
├── resources/
│   ├── Chinook.db, acmecorp-employee-handbook.pdf, moon.png
│   └── mcp-server.ts         # TS port of 2.1_mcp_server.py
├── studio/
│   ├── module-1/             # langgraph.json + agent.ts
│   └── module-3/             # langgraph.json + agent.ts
└── tests/
```

### Step runner mechanics

Lesson modules call `step()` at module scope. Importing a lesson registers its steps
as a side effect into a module-scoped array; the CLI then imports the lesson and
executes the registered steps in order, filtered by `--step`.

Registration must not perform I/O. Step bodies hold every API call, so importing a
lesson is safe with placeholder credentials — which is what makes the hermetic test
suite possible.

### Printing

The Python notebooks lean on `pprint(response)` to show message lists. `src/lib/print.ts`
provides `printMessages(messages)` — one readable line per message with role, content,
and any tool calls — and `printJson(value)` for raw structures. This is the single
most repeated idiom in the source material, so it is worth a shared helper.

## Handling the awkward lessons

- **1.2 tools** uses `ChatOllama("qwen3:4b")`, requiring a local Ollama daemon. Kept as
  is. If Ollama is unreachable the lesson prints a setup hint naming
  `ollama pull qwen3:4b` rather than surfacing a connection error.
- **1.4 multimodal** reads the image from `resources/moon.png` instead of a file-upload
  widget. Audio reads a `.wav` path, with an optional `--record` flag that shells out
  to `sox` or `ffmpeg` and explains how to install one if neither is present.
- **2.1 MCP** ports `2.1_mcp_server.py` to `resources/mcp-server.ts` using
  `@modelcontextprotocol/sdk`, preserving its tool, resource, and prompt. The lesson
  spawns it with `tsx` over stdio. The second half of that lesson spawns the Python
  `mcp_server_time` server via `uvx`, which works unchanged from a JS client.
- **Bonus RAG and SQL** copy `Chinook.db` and the handbook PDF verbatim.

## Error handling

A missing API key produces one clear line naming the variable and pointing at
`.env.example` — not a stack trace. `src/lib/env.ts` validates on load, so this
happens once at startup rather than deep inside a provider call. Lessons needing an
optional provider (Anthropic, Google, Ollama, Tavily) state which key they need in
their startup banner.

`src/check-env.ts` ports `env_utils.py`: it verifies the Node version, that
dependencies are installed, that required variables are set and not left at
placeholder values, warns when a shell variable conflicts with the `.env` value, and
warns when `LANGSMITH_TRACING=true` without a valid key.

## Testing

Vitest, no network calls, runs without API keys.

- **Import smoke tests** for every lesson module. This catches the failure that
  actually occurs in a course repo: a lesson that stops compiling after a dependency
  bump. Test setup injects placeholder environment variables; constructing a model
  performs no network I/O, so this stays hermetic.
- **Step runner unit tests**: registration, ordering, `--step` filtering, ambiguous
  and unambiguous lesson-ID resolution.
- **Env checker unit tests**: placeholder detection, conflict detection, the
  tracing-without-key warning.
- **Pure tool logic** driven by `FakeToolCallingModel` (exported from `langchain`):
  the `authenticate` tool's both branches, `squareRoot`, and the state-update
  `Command` tools.

Typechecking via `tsc --noEmit` runs alongside the suite.

## Scope and phasing

**Phase 1 (this plan):** project scaffolding — `package.json`, `tsconfig.json`,
runner, env checker, printing helpers, README, test setup — plus all 7 Module 1
lessons, the Module 1 Studio config, and their tests.

**Phase 2:** Module 2 (7 lessons, the TS MCP server, Chinook and PDF resources).

**Phase 3:** Module 3 (6 lessons, Module 3 Studio config, agent-chat-ui wiring).

Phase 1 is reviewed before Phase 2 begins, so that house style and porting idioms are
settled once rather than corrected across 21 files.

## Non-goals

- Changing the curriculum, lesson order, or prompts.
- Porting `agent-chat-ui` (already TypeScript).
- Supporting Python and TypeScript from one source.
- Model-provider abstraction beyond what `initChatModel` already gives.
