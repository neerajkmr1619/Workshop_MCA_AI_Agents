import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { HumanMessage, createAgent } from "langchain";
import { resource } from "@/lib/paths";
import { step, type LessonMeta } from "@/runner/step";

export const meta: LessonMeta = {
  title: "Multimodal messages — text, image, and audio content blocks",
  requires: ["OPENAI_API_KEY"],
};

const SCIFI_PROMPT =
  "You are a science fiction writer, create a capital city at the users request.";

/** Read a file and base64-encode it, which is how binary content blocks travel. */
async function encodeBase64(path: string): Promise<string> {
  const bytes = await readFile(path);
  return bytes.toString("base64");
}

step(1, "Text content as an explicit content block", async () => {
  const agent = createAgent({ model: "gpt-5-nano", systemPrompt: SCIFI_PROMPT });

  // A plain string is shorthand for exactly this.
  const question = new HumanMessage({
    content: [{ type: "text", text: "What is the capital of The Moon?" }],
  });

  const response = await agent.invoke({ messages: [question] });
  console.log(response.messages.at(-1)?.text);
});

step(2, "Image input from a file", async () => {
  // The Python notebook uses an ipywidgets upload button to let the student
  // pick a file in a browser widget; Node has no such widget, so this reads
  // the same image straight from disk instead.
  const imagePath = resource("moon.png");
  const imageBase64 = await encodeBase64(imagePath);

  const agent = createAgent({ model: "gpt-5-nano", systemPrompt: SCIFI_PROMPT });

  // Standard multimodal content blocks use `data` (base64 string) and
  // `mimeType` (camelCase) — confirmed against the installed
  // @langchain/core types (ContentBlock.Multimodal.Image, in
  // node_modules/@langchain/core/dist/messages/content/multimodal.d.ts) and
  // against the OpenAI provider's runtime converter, which reads exactly
  // these two fields (node_modules/@langchain/openai/dist/converters/completions.js,
  // convertStandardContentBlockToCompletionsContentPart). There is no
  // `base64` field and no `mime_type` (snake_case) field on this shape —
  // that spelling belongs only to a deprecated, different block type.
  const question = new HumanMessage({
    content: [
      { type: "text", text: "Tell me about this capital" },
      { type: "image", data: imageBase64, mimeType: "image/png" },
    ],
  });

  const response = await agent.invoke({ messages: [question] });
  console.log(response.messages.at(-1)?.text);
});

step(3, "Audio input from a .wav file", async () => {
  // The Python notebook records five seconds from the microphone with
  // sounddevice. Node has no built-in microphone API, so this step reads a
  // .wav file you provide (or record) ahead of time instead.
  const audioPath = resource("question.wav");

  if (!existsSync(audioPath)) {
    console.log(`No audio file at ${audioPath}.`);
    console.log(`\nRecord five seconds of yourself asking a question:`);
    console.log(`  macOS (needs sox):  sox -d -r 44100 -c 1 resources/question.wav trim 0 5`);
    console.log(`  ffmpeg (macOS):     ffmpeg -f avfoundation -i ":0" -t 5 resources/question.wav`);
    console.log(`  ffmpeg (Linux):     ffmpeg -f alsa -i default -t 5 resources/question.wav`);
    console.log(`\nThen re-run:  npm run lesson 1.4-multimodal-messages -- --step 3\n`);
    return;
  }

  const audioBase64 = await encodeBase64(audioPath);
  const agent = createAgent({ model: "gpt-audio" });

  // Same `data` + `mimeType` shape as the image block above
  // (ContentBlock.Multimodal.Audio).
  const question = new HumanMessage({
    content: [
      { type: "text", text: "Tell me about this audio file" },
      { type: "audio", data: audioBase64, mimeType: "audio/wav" },
    ],
  });

  const response = await agent.invoke({ messages: [question] });
  console.log(response.messages.at(-1)?.text);
});
