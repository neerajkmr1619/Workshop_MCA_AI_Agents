import { MemorySaver } from "@langchain/langgraph";
import { TavilySearch } from "@langchain/tavily";
import { HumanMessage, createAgent } from "langchain";
import { printMessages } from "@/lib/print";
import { step, type LessonMeta } from "@/runner/step";

export const meta: LessonMeta = {
  title: "Project: Personal Chef & Coffee Search — tools, prompt, and memory together",
  requires: ["OPENAI_API_KEY", "TAVILY_API_KEY"],
};

const SYSTEM_PROMPT = `
You are a personal chef and coffee concierge.
When the user asks for coffee, cafe, or recipe suggestions, use the web search tool to find top matching options.
Remember their preferences (such as taking filter coffee with oat milk and no sugar) across turns so you don't need to ask them again.
`;

function createAssistant() {
  const tavilySearch = new TavilySearch({ maxResults: 5 });

  return createAgent({
    model: "gpt-5-nano",
    tools: [tavilySearch],
    systemPrompt: SYSTEM_PROMPT,
    checkpointer: new MemorySaver(),
  });
}

step(1, "Personal assistant searches the web and remembers coffee preferences", async () => {
  const assistant = createAssistant();
  const config = { configurable: { thread_id: "session-coffee-42" } };

  // Turn 1: User specifies coffee preference
  console.log("Turn 1: Initial request with preference ('Filter, oat milk, no sugar')...");
  await assistant.invoke(
    {
      messages: [
        new HumanMessage(
          "Where can I get coffee in CP, Delhi? I prefer filter coffee with oat milk, no sugar.",
        ),
      ],
    },
    config,
  );

  // Turn 2: Follow-up — uses memory of preference and performs web search
  console.log("\nTurn 2: Follow-up request ('Coffee again?')...");
  const response = await assistant.invoke(
    {
      messages: [new HumanMessage("Coffee again? Find top cafés for me.")],
    },
    config,
  );

  // printMessages(response.messages);
  console.log("\nFinal answer:");
  console.log(response.messages.at(-1)?.text);
});
