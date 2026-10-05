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

`npm run check-env` will report missing keys and exit non-zero until you supply them —
that is expected on a fresh checkout with no `.env` yet. Running any lesson without the
keys it needs prints a friendly "missing environment variable" message instead of a
stack trace.

## Running lessons

```bash
npm run lessons                          # list every lesson
npm run lesson memory                    # run all of a lesson
npm run lesson memory -- --step 1        # run one step
```

Lesson IDs accept unambiguous prefixes: `npm run lesson memo` works to run `memory`.

## Lessons

### Module 1 — Create Agent

| Lesson | Topic |
|---|---|
| `foundational-models` | Initialising and invoking a foundational chat model |
| `prompting` | System prompts and guiding agent behavior |
| `tools` | Defining tools and binding them to an agent |
| `web-search` | Giving an agent current information via Tavily |
| `memory` | Checkpointers and thread ids |
| `personal-chef` | Project: everything above in one agent |

Modules 2 and 3 are future phases and are not part of this repository yet.

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

Places where TypeScript needed a different approach:

- **Lessons are `.ts` scripts, not notebooks.** Each lesson splits into numbered
  `step()` blocks that mirror the notebook's cells, and each step can be run on its
  own with `--step`.
- **`initChatModel` is async here.** Always `await` it. The Python version is
  synchronous.
- **Lesson 1.4 reads files instead of using notebook widgets.** The Python notebook
  uses an `ipywidgets` upload button for the image and `sounddevice` to record audio
  from the microphone; neither has a Node equivalent. This port reads the image from
  `resources/moon.png` on disk, and reads audio from a `.wav` path — printing a
  `sox` / `ffmpeg` command you can run to record one if it isn't there yet.

Naming follows TypeScript/JavaScript conventions: `create_agent` → `createAgent`,
`system_prompt` → `systemPrompt`, `InMemorySaver` → `MemorySaver`. Message *fields*
stay snake_case (`response_metadata`, `tool_calls`), matching LangChain JS's own
wire format.
