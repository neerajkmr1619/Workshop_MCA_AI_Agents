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

  // `structuredResponse` is the property langchain's createAgent result carries
  // when `responseFormat` is set — verified against
  // node_modules/langchain/dist/agents/ReactAgent.d.ts and runtime.d.ts.
  const info = response.structuredResponse;
  console.log(info);
  console.log(`\n${info.name} is a city located at ${info.location}`);
});
