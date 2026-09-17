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

const SYSTEM_PROMPT = `
You are a personal chef. The user will give you a list of ingredients they have left over in their house.

Using the web search tool, search the web for recipes that can be made with the ingredients they have.

Return recipe suggestions and eventually the recipe instructions to the user, if requested.
`;

/**
 * Built inside each step rather than at module scope: the TavilySearch
 * constructor requires TAVILY_API_KEY, and throwing at import time would
 * bypass the runner's friendly missing-key message.
 */
function createSearchTools() {
  const tavilySearch = new TavilySearch({ maxResults: 5 });

  const webSearch = tool(
    async ({ query }) => tavilySearch.invoke({ query }),
    {
      name: "web_search",
      description: "Search the web for information",
      schema: z.object({ query: z.string() }),
    },
  );

  return { webSearch };
}

/** Everything Module 1 taught, in one agent. Each step builds its own. */
function createChef() {
  const { webSearch } = createSearchTools();

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
