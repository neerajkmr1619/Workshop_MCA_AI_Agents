import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage, createAgent } from "langchain";
import { printMessages } from "@/lib/print";
import { step, type LessonMeta } from "@/runner/step";

export const meta: LessonMeta = {
  title: "Short-term memory — checkpointers and thread ids",
  requires: ["OPENAI_API_KEY"],
};

step(1, "It asks once, then it remembers coffee preferences across turns", async () => {
  const agent = createAgent({
    model: "gpt-5-nano",
    systemPrompt:
      "You are a helpful coffee assistant. When the user shares their coffee preferences, remember them and tailor future recommendations.",
    checkpointer: new MemorySaver(),
  });
  const config = { configurable: { thread_id: "coffee-user-1" } };

  // First turn: User states their coffee preference ("Filter, oat milk, no sugar")
  console.log("Turn 1: User states preference: 'Where can I get coffee? Filter, oat milk, no sugar.'");
  await agent.invoke(
    {
      messages: [
        new HumanMessage("Where can I get coffee? I take it as filter, oat milk, no sugar."),
      ],
    },
    config,
  );

  // Second turn: User asks again, agent recalls preference from memory
  console.log("\nTurn 2: Asking 'Coffee again?'...");
  const response = await agent.invoke(
    { messages: [new HumanMessage("Coffee again?")] },
    config,
  );

  printMessages(response.messages);
  console.log("\nFinal answer (recalled preference from memory):");
  console.log(response.messages.at(-1)?.text);
});
