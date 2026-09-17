import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage, createAgent } from "langchain";
import { printMessages } from "@/lib/print";
import { step, type LessonMeta } from "@/runner/step";

export const meta: LessonMeta = {
  title: "Short-term memory — checkpointers and thread ids",
  requires: ["OPENAI_API_KEY"],
};

const INTRO = "Hello my name is Seán and my favourite colour is green";
const RECALL = "What's my favourite colour?";

step(1, "Without a checkpointer the agent forgets between invocations", async () => {
  const agent = createAgent({ model: "gpt-5-nano" });

  await agent.invoke({ messages: [new HumanMessage(INTRO)] });

  // A second, entirely separate invocation — nothing carries over.
  const response = await agent.invoke({ messages: [new HumanMessage(RECALL)] });

  console.log(response.messages.at(-1)?.text);
  console.log("\nThe agent cannot answer — each invoke starts from scratch.");
});

step(2, "Add a checkpointer and reuse a thread id", async () => {
  // Python calls this InMemorySaver; in TypeScript it is MemorySaver.
  const agent = createAgent({ model: "gpt-5-nano", checkpointer: new MemorySaver() });
  const config = { configurable: { thread_id: "1" } };

  await agent.invoke({ messages: [new HumanMessage(INTRO)] }, config);
  const response = await agent.invoke({ messages: [new HumanMessage(RECALL)] }, config);

  console.log(response.messages.at(-1)?.text);
});

step(3, "Inspect the full thread — earlier turns are replayed to the model", async () => {
  const agent = createAgent({ model: "gpt-5-nano", checkpointer: new MemorySaver() });
  const config = { configurable: { thread_id: "1" } };

  await agent.invoke({ messages: [new HumanMessage(INTRO)] }, config);
  const response = await agent.invoke({ messages: [new HumanMessage(RECALL)] }, config);

  printMessages(response.messages);
});

step(4, "A different thread id is a different conversation", async () => {
  const agent = createAgent({ model: "gpt-5-nano", checkpointer: new MemorySaver() });

  await agent.invoke(
    { messages: [new HumanMessage(INTRO)] },
    { configurable: { thread_id: "1" } },
  );

  const response = await agent.invoke(
    { messages: [new HumanMessage(RECALL)] },
    { configurable: { thread_id: "2" } },
  );

  console.log(response.messages.at(-1)?.text);
  console.log("\nThread 2 never heard the introduction.");
});
