import { TavilySearch } from "@langchain/tavily";
import { HumanMessage, createAgent, tool } from "langchain";
import { z } from "zod";
import { printMessages } from "@/lib/print";
import { step, type LessonMeta } from "@/runner/step";

export const meta: LessonMeta = {
  title: "Web search — giving an agent access to current information",
  requires: ["OPENAI_API_KEY", "TAVILY_API_KEY"],
};

const QUESTION = "Who won the 2026 FIFA worldcup?";

/**
 * Built inside each step rather than at module scope: the TavilySearch
 * constructor requires TAVILY_API_KEY, and throwing at import time would
 * bypass the runner's friendly missing-key message.
 */
function createSearchTools() {
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

  return { tavilySearch, webSearch };
}

step(1, "Ask without web search — the model relies on training data", async () => {
  const agent = createAgent({ model: "gpt-5-nano" });
  const response = await agent.invoke({
    messages: [new HumanMessage("How up to date is your training knowledge?")],
  });
  console.log(response.messages.at(-1)?.text);
});

step(2, "Call the search tool directly", async () => {
  const { webSearch } = createSearchTools();
  const results = await webSearch.invoke({ query: QUESTION });
  console.log(results);
});

step(3, "Give the agent the search tool", async () => {
  const { webSearch } = createSearchTools();
  const agent = createAgent({ model: "gpt-5-nano", tools: [webSearch] });
  const response = await agent.invoke({ messages: [new HumanMessage(QUESTION)] });

  printMessages(response.messages);
  console.log("\nFinal answer:");
  console.log(response.messages.at(-1)?.text);
});

step(4, "Use the packaged TavilySearch tool instead", async () => {
  const { tavilySearch } = createSearchTools();
  const agent = createAgent({ model: "gpt-5-nano", tools: [tavilySearch] });
  const response = await agent.invoke({ messages: [new HumanMessage(QUESTION)] });
  console.log(response.messages.at(-1)?.text);
});
