import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AIMessage, HumanMessage, createAgent, initChatModel } from "langchain";
import { isPlaceholder } from "@/lib/env";
import { printJson, printMessages } from "@/lib/print";
import { step, type LessonMeta } from "@/runner/step";

export const meta: LessonMeta = {
  title: "Foundational models — invoking, customising, providers, and streaming",
  requires: ["OPENAI_API_KEY"],
  optional: ["ANTHROPIC_API_KEY", "GOOGLE_API_KEY"],
};

const QUESTION = "What's the capital of the Moon?";

step(1, "Initialise and invoke a model", async () => {
  // initChatModel is async in JavaScript, unlike the Python course.
  const model = await initChatModel("gpt-5-nano");
  const response = await model.invoke(QUESTION);

  console.log(response.text);
  console.log("\nResponse metadata:");
  printJson(response.response_metadata);
});

step(2, "Customise the model with provider kwargs", async () => {
  const model = await initChatModel("gpt-5-nano", { temperature: 1.0 });
  const response = await model.invoke(QUESTION);
  console.log(response.text);
});

step(3, "Swap the provider — Anthropic", async () => {
  if (isPlaceholder(process.env.ANTHROPIC_API_KEY)) {
    console.log("Skipped: set ANTHROPIC_API_KEY in .env to run this step.");
    return;
  }
  const model = await initChatModel("claude-sonnet-4-6");
  const response = await model.invoke(QUESTION);
  console.log(response.text);
});

step(4, "Swap the provider — Google", async () => {
  if (isPlaceholder(process.env.GOOGLE_API_KEY)) {
    console.log("Skipped: set GOOGLE_API_KEY in .env to run this step.");
    return;
  }
  const model = new ChatGoogleGenerativeAI({ model: "gemini-3.1-flash-lite" });
  const response = await model.invoke(QUESTION);
  console.log(response.text);
});

step(5, "Initialise and invoke an agent", async () => {
  const agent = createAgent({ model: "gpt-5-nano" });
  const response = await agent.invoke({
    messages: [new HumanMessage(QUESTION)],
  });

  printMessages(response.messages);
  console.log("\nFinal answer:");
  console.log(response.messages.at(-1)?.text);
});

step(6, "Seed an agent with prior conversation turns", async () => {
  const agent = createAgent({ model: "gpt-5-nano" });
  const response = await agent.invoke({
    messages: [
      new HumanMessage(QUESTION),
      new AIMessage("The capital of the Moon is Luna City."),
      new HumanMessage("Interesting, tell me more about Luna City"),
    ],
  });

  printMessages(response.messages);
});

step(7, "Stream the output token by token", async () => {
  const agent = createAgent({ model: "gpt-5-nano" });
  const stream = await agent.stream(
    { messages: [new HumanMessage("Tell me all about Luna City, capital of the Moon")] },
    { streamMode: "messages" },
  );

  for await (const [token] of stream) {
    if (token.text) process.stdout.write(token.text);
  }
  console.log();
});
