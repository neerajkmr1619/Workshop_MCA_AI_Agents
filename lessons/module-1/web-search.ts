import { TavilySearch } from "@langchain/tavily";
import { HumanMessage, createAgent } from "langchain";
import { printMessages } from "@/lib/print";
import { step, type LessonMeta } from "@/runner/step";

export const meta: LessonMeta = {
  title: "Web search — giving an agent access to current information",
  requires: ["OPENAI_API_KEY", "TAVILY_API_KEY"],
};

const QUESTION = "What are the top-rated specialty coffee cafes in Gurugram?";

step(1, "Give the agent the web search tool", async () => {
  const tavilySearch = new TavilySearch({ maxResults: 5 });
  const agent = createAgent({
    model: "gpt-5-nano",
    tools: [tavilySearch],
  });

  const response = await agent.invoke({
    messages: [new HumanMessage(QUESTION)],
  });

  printMessages(response.messages);
  console.log("\nFinal answer:");
  console.log(response.messages.at(-1)?.text);
});
