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


export const squareRoot_Neeraj = tool(
  ({ x }) => x ** 0.5,
  {
    name: "square_root_Neeraj",
    description: "Calculate the square root of a number",
    schema: z.object({ x: z.number() }),
  },
);

const OLLAMA_MODEL = "qwen3:4b";

async function ollamaIsRunning(): Promise<boolean> {
  const host = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
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

}

step(1, "Inspect a tool's name, description, and schema", async () => {
  console.log(`name:        ${squareRoot_Neeraj.name}`);
  console.log(`description: ${squareRoot_Neeraj.description}`);
  console.log(`\nJSON schema the model sees:`);
  printJson(toJsonSchema(squareRoot_Neeraj.schema));
});

step(2, "Invoke a tool directly, without a model", async () => {
  const result = await squareRoot_Neeraj.invoke({ x: 467 });
  console.log(`square_root(467) = ${result}`);
});

step(3, "Give the tool to an agent running a local model", async () => {
  if (!(await ollamaIsRunning())) {
    explainOllama();
    return;
  }

  const agent = createAgent({
    model: new ChatOllama({ model: OLLAMA_MODEL }),
    tools: [squareRoot_Neeraj],
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
    tools: [squareRoot_Neeraj],
    systemPrompt: "You are an arithmetic wizard. Use your tools.",
  });

  const response = await agent.invoke({
    messages: [new HumanMessage("What is the square root of 467?")],
  });


  printMessages(response.messages);
});
