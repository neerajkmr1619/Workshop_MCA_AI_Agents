import { initChatModel } from "langchain";
import { printJson } from "@/lib/print";
import { step, type LessonMeta } from "@/runner/step";

export const meta: LessonMeta = {
  title: "Foundational models — initialise and invoke a model",
  requires: ["OPENAI_API_KEY"],
};

const QUESTION = "What are three popular specialty coffee brewing methods and how do they differ?";

step(1, "Initialise and invoke a model", async () => {
  const model = await initChatModel("gpt-5-nano");
  const response = await model.invoke(QUESTION);

  console.log(response.text);
  console.log("\nResponse metadata:");
  printJson(response.response_metadata);
});
