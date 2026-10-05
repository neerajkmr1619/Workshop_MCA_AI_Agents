import { HumanMessage, createAgent } from "langchain";
import { step, type LessonMeta } from "@/runner/step";

export const meta: LessonMeta = {
  title: "Prompting — system prompts",
  requires: ["OPENAI_API_KEY"],
};

const QUESTION = new HumanMessage(
  "What coffee should I order if I like smooth, nutty flavors with no bitterness?",
);

step(1, "Add a system prompt to guide agent responses", async () => {
  const agent = createAgent({
    model: "gpt-5-nano",
    systemPrompt:
      "You are an expert barista and coffee concierge. Recommend coffee drinks and brewing styles tailored to the user's taste preferences.",
  });
  const response = await agent.invoke({ messages: [QUESTION] });
  console.log(response.messages.at(-1)?.text);
});
