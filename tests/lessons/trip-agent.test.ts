import { END } from "@langchain/langgraph";
import { describe, expect, it } from "vitest";
import { DONE_MARKER, shouldContinue } from "../../lessons/module-2/2.3-trip-agent";

describe("shouldContinue — the cycle's loop guard", () => {
  it("stops when the reviewer is satisfied", () => {
    expect(shouldContinue({ critique: DONE_MARKER, revisions: 1, maxRevisions: 5 })).toBe(END);
  });

  it("keeps going while there is feedback and budget left", () => {
    expect(
      shouldContinue({ critique: "missing a market", revisions: 1, maxRevisions: 5 }),
    ).toBe("refine");
  });

  it("stops at the revision cap even when the reviewer is still unhappy", () => {
    // This is the assertion that matters: without it a model that always finds
    // something to improve would loop forever.
    expect(
      shouldContinue({ critique: "still missing a market", revisions: 5, maxRevisions: 5 }),
    ).toBe(END);
  });

  it("stops past the cap as well as exactly at it", () => {
    expect(shouldContinue({ critique: "more work", revisions: 9, maxRevisions: 5 })).toBe(END);
  });

  it("keeps going on the first pass, when no critique exists yet", () => {
    expect(shouldContinue({ critique: "", revisions: 0, maxRevisions: 3 })).toBe("refine");
  });

  it("recognises the marker regardless of case or surrounding whitespace", () => {
    expect(
      shouldContinue({ critique: "  complete  ", revisions: 1, maxRevisions: 5 }),
    ).toBe(END);
  });

  it("recognises the marker when the model adds a trailing sentence", () => {
    expect(
      shouldContinue({
        critique: "COMPLETE — everything is covered.",
        revisions: 1,
        maxRevisions: 5,
      }),
    ).toBe(END);
  });

  it("does not mistake a mention of the word mid-sentence for approval", () => {
    // "not complete" must not end the loop just because it contains the marker.
    expect(
      shouldContinue({ critique: "This is not complete yet", revisions: 1, maxRevisions: 5 }),
    ).toBe("refine");
  });

  it("with a cap of zero, never refines at all", () => {
    expect(shouldContinue({ critique: "needs work", revisions: 0, maxRevisions: 0 })).toBe(END);
  });
});
