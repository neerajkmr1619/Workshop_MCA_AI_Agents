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
 * The graph LangGraph Studio loads. `langgraph-cli` imports this module and
 * reads the `agent` export directly, so — unlike the lesson file — the
 * agent (and its tools) must be constructed at module scope here; the key
 * arrives via langgraph.json's "env": "../../.env" pointer read by loadEnv()
 * above, not via a lazily-invoked factory.
 *
 * Studio supplies its own persistence layer, so this agent deliberately has
 * no checkpointer of its own.
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
