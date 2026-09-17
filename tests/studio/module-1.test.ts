import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { projectRoot } from "@/lib/paths";

describe("module-1 studio config", () => {
  it("exports a compiled agent graph", async () => {
    const { agent } = await import("../../studio/module-1/agent");
    expect(agent).toBeDefined();
    expect(typeof agent.invoke).toBe("function");
  });

  it("points langgraph.json at that exported graph", async () => {
    const raw = await readFile(join(projectRoot, "studio/module-1/langgraph.json"), "utf8");
    const config = JSON.parse(raw) as { graphs: Record<string, string> };
    expect(config.graphs.agent).toBe("./agent.ts:agent");
  });
});
