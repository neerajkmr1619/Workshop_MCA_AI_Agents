import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "langchain";
import { describe, expect, it } from "vitest";
import { formatMessage } from "@/lib/print";

describe("formatMessage", () => {
  it("labels a human message and shows its text", () => {
    const line = formatMessage(new HumanMessage("What is the capital of the Moon?"));
    expect(line).toContain("HUMAN");
    expect(line).toContain("What is the capital of the Moon?");
  });

  it("labels an AI message", () => {
    expect(formatMessage(new AIMessage("Luna City."))).toContain("AI");
  });

  it("labels a system message", () => {
    expect(formatMessage(new SystemMessage("You are helpful."))).toContain("SYSTEM");
  });

  it("labels a tool message", () => {
    const message = new ToolMessage({ content: "42", tool_call_id: "call_1" });
    expect(formatMessage(message)).toContain("TOOL");
  });

  it("renders tool calls made by an AI message", () => {
    const message = new AIMessage({
      content: "",
      tool_calls: [{ id: "call_1", name: "square_root", args: { x: 467 } }],
    });
    const line = formatMessage(message);
    expect(line).toContain("square_root");
    expect(line).toContain("467");
  });

  it("marks an AI message that has no text content", () => {
    const message = new AIMessage({
      content: "",
      tool_calls: [{ id: "call_1", name: "square_root", args: { x: 1 } }],
    });
    expect(formatMessage(message)).toContain("(no text content)");
  });
});
