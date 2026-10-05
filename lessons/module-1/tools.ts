import { HumanMessage, createAgent, tool } from "langchain";
import { z } from "zod";
import { printMessages } from "@/lib/print";
import { step, type LessonMeta } from "@/runner/step";

export const meta: LessonMeta = {
  title: "Tools — defining a tool and giving it to an agent",
  requires: ["OPENAI_API_KEY"],
};

export const squareRoot = tool(
  ({ x }) => x ** 0.5,
  {
    name: "square_root",
    description: "Calculate the square root of a number",
    schema: z.object({ x: z.number() }),
  },
);

step(1, "Give the tool to an agent", async () => {
  const agent = createAgent({
    model: "gpt-5-nano",
    tools: [squareRoot],
    systemPrompt:
      "You are an arithmetic wizard. Use your tools to calculate the square root of any number.",
  });

  const response = await agent.invoke({
    messages: [new HumanMessage("What is the square root of 467?")],
  });

  printMessages(response.messages);
});
