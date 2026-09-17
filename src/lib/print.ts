import type { AIMessage, BaseMessage } from "langchain";
import { inspect } from "node:util";

/**
 * One readable block per message. Replaces the Python course's
 * `pprint(response["messages"])`.
 */
export function formatMessage(message: BaseMessage): string {
  const role = message.getType().toUpperCase();
  const text = message.text.trim();
  const lines = [`[${role}] ${text === "" ? "(no text content)" : text}`];

  const toolCalls = (message as AIMessage).tool_calls ?? [];
  for (const call of toolCalls) {
    lines.push(`  → tool call: ${call.name}(${JSON.stringify(call.args)})`);
  }

  return lines.join("\n");
}

export function printMessages(messages: BaseMessage[]): void {
  for (const message of messages) {
    console.log(formatMessage(message));
  }
}

/** Deep, colourised dump for inspecting raw response structures. */
export function printJson(value: unknown): void {
  console.log(inspect(value, { depth: 6, colors: true, maxStringLength: 2000 }));
}

export function heading(text: string): void {
  console.log(`\n${"─".repeat(60)}\n${text}\n${"─".repeat(60)}`);
}
