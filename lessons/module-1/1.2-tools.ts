import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, createAgent, tool } from "langchain";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
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
  printJson(toJsonSchema(squareRoot.schema));
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
