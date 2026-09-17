import { END, START, StateGraph } from "@langchain/langgraph";
import { initChatModel } from "langchain";
import { z } from "zod";
import { isPlaceholder } from "@/lib/env";
import { cheapestFare, explainKiwiDown, futureDate, searchKiwi, toFlights } from "@/lib/kiwi";
import { step, type LessonMeta } from "@/runner/step";

export const meta: LessonMeta = {
  title: "LangGraph: cycles — an itinerary that refines itself until it is good",
  // Steps 1-2 are pure structure and need nothing. The steps that call a model
  // check for the key themselves, so the lesson stays runnable without one.
  requires: [],
  optional: ["OPENAI_API_KEY"],
};

/**
 * Everything the loop needs to carry between passes.
 *
 * `revisions` and `maxRevisions` are the important additions. A graph with a
 * cycle can run forever; the counter is what guarantees it stops.
 */
export const AgentTripState = z.object({
  origin: z.string(),
  destination: z.string(),
  departureDate: z.string(),
  days: z.number(),
  flights: z.array(
    z.object({
      priceEur: z.number(),
      from: z.string(),
      to: z.string(),
      durationHours: z.number(),
      stops: z.number(),
      bookingUrl: z.string(),
    }),
  ),
  /** The current draft. Rewritten on every pass through the loop. */
  itinerary: z.string(),
  /** What the reviewer said last time, fed back into the next draft. */
  critique: z.string(),
  revisions: z.number(),
  maxRevisions: z.number(),
  notes: z.array(z.string()),
});

export type AgentTrip = z.infer<typeof AgentTripState>;

const DAYS_AHEAD = 60;
const MODEL = "gpt-5-nano";

/** The reviewer is told to open with this exact word when it is satisfied. */
export const DONE_MARKER = "COMPLETE";

/**
 * The loop guard. Two independent reasons to stop:
 *
 *  1. the reviewer said the itinerary is finished, or
 *  2. we have revised as many times as we said we would.
 *
 * The second is not a formality. A model asked "is this good enough?" can keep
 * finding improvements forever, so a cycle that trusts only the model's opinion
 * is a cycle that may never terminate. The counter is the real guarantee.
 */
export function shouldContinue(
  state: Pick<AgentTrip, "critique" | "revisions" | "maxRevisions">,
): "refine" | typeof END {
  if (state.critique.trim().toUpperCase().startsWith(DONE_MARKER)) return END;
  if (state.revisions >= state.maxRevisions) return END;
  return "refine";
}

function haveModel(): boolean {
  return !isPlaceholder(process.env.OPENAI_API_KEY);
}

function needKey(): void {
  console.log("This step calls a model. Set OPENAI_API_KEY in .env to run it.\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Nodes
// ─────────────────────────────────────────────────────────────────────────────

/** Fetches real flights so the model plans against facts, not guesses. */
async function gatherFacts(state: AgentTrip): Promise<Partial<AgentTrip>> {
  const departureDate = futureDate(DAYS_AHEAD);
  const result = await searchKiwi(state.origin, state.destination, departureDate);

  if (result.error) {
    return {
      departureDate,
      notes: [...state.notes, `gatherFacts: Kiwi said "${result.error}"`],
    };
  }

  const flights = toFlights(result.itineraries ?? []);
  return {
    departureDate,
    flights,
    notes: [...state.notes, `gatherFacts: ${flights.length} itineraries`],
  };
}

/** Writes the first draft from the facts. Runs once. */
async function draft(state: AgentTrip): Promise<Partial<AgentTrip>> {
  const model = await initChatModel(MODEL);
  const fare = cheapestFare(state.flights);
  const fareLine = Number.isFinite(fare)
    ? `The cheapest flight found is ${fare} EUR.`
    : `No live flight data was available.`;

  const response = await model.invoke(
    `Write a ${state.days}-day itinerary for a trip to ${state.destination}, India,
flying from ${state.origin} on ${state.departureDate}. ${fareLine}
Give one short paragraph per day. Be specific about neighbourhoods and sights.`,
  );

  return {
    itinerary: response.text,
    revisions: state.revisions + 1,
    notes: [...state.notes, `draft: wrote revision ${state.revisions + 1}`],
  };
}

/** Reviews the draft and writes feedback into state for the router to read. */
async function review(state: AgentTrip): Promise<Partial<AgentTrip>> {
  const model = await initChatModel(MODEL);

  const response = await model.invoke(
    `You are reviewing a ${state.days}-day ${state.destination} itinerary.

Check it covers: a named area to stay, at least one UNESCO site, one market,
one street-food area, and realistic travel time between places.

If every item is covered, reply with exactly the single word ${DONE_MARKER}.
Otherwise reply with a short list of only what is missing.

ITINERARY:
${state.itinerary}`,
  );

  const critique = response.text.trim();
  const verdict = critique.toUpperCase().startsWith(DONE_MARKER) ? "complete" : "needs work";

  return {
    critique,
    notes: [...state.notes, `review: ${verdict}`],
  };
}

/** Rewrites the draft, addressing the critique. This is the node the loop returns to. */
async function refine(state: AgentTrip): Promise<Partial<AgentTrip>> {
  const model = await initChatModel(MODEL);

  const response = await model.invoke(
    `Revise this ${state.destination} itinerary so it addresses the feedback.
Keep what already works; change only what the feedback asks for.

FEEDBACK:
${state.critique}

ITINERARY:
${state.itinerary}`,
  );

  return {
    itinerary: response.text,
    revisions: state.revisions + 1,
    notes: [...state.notes, `refine: wrote revision ${state.revisions + 1}`],
  };
}

/**
 * The cycle:
 *
 *   gatherFacts → draft → review → ⟨shouldContinue⟩ ─ refine ─┐
 *                                        │                    │
 *                                        └─ END               │
 *                                            ▲                │
 *                                            └── review ◄─────┘
 *
 * `refine` edges back to `review`, which is what makes this a loop rather than
 * a line. Everything else is the same machinery as lessons 2.1 and 2.2.
 */
export function buildAgentGraph() {
  return new StateGraph(AgentTripState)
    .addNode("gatherFacts", gatherFacts)
    .addNode("draft", draft)
    .addNode("review", review)
    .addNode("refine", refine)
    .addEdge(START, "gatherFacts")
    .addEdge("gatherFacts", "draft")
    .addEdge("draft", "review")
    .addConditionalEdges("review", shouldContinue, ["refine", END])
    .addEdge("refine", "review")
    .compile();
}

function startingTrip(maxRevisions: number, days = 3, origin = "London"): AgentTrip {
  return {
    origin,
    destination: "Delhi",
    departureDate: "",
    days,
    flights: [],
    itinerary: "",
    critique: "",
    revisions: 0,
    maxRevisions,
    notes: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────

step(1, "Look at the cycle", async () => {
  const graph = buildAgentGraph();
  const drawn = await graph.getGraphAsync();

  console.log("Note the edge going BACK from refine to review — that is the loop:\n");
  console.log(drawn.drawMermaid());
});

step(2, "The loop guard, in isolation", async () => {
  // Pure function, no model, no network — so you can see exactly when the
  // cycle stops and why.
  const cases = [
    { label: "reviewer satisfied", critique: "COMPLETE", revisions: 1, maxRevisions: 3 },
    { label: "more to do, budget left", critique: "missing a market", revisions: 1, maxRevisions: 3 },
    { label: "more to do, out of budget", critique: "missing a market", revisions: 3, maxRevisions: 3 },
    { label: "no critique yet", critique: "", revisions: 0, maxRevisions: 3 },
  ];

  for (const c of cases) {
    const next = shouldContinue(c);
    console.log(
      `  ${c.label.padEnd(26)} rev ${c.revisions}/${c.maxRevisions} → ${next === END ? "END" : next}`,
    );
  }

  console.log(`\nThe revision count is what guarantees the loop terminates,`);
  console.log(`even if the reviewer never says ${DONE_MARKER}.`);
});

step(3, "One pass only — draft, review, stop", async () => {
  if (!haveModel()) return needKey();

  const graph = buildAgentGraph();
  try {
    // maxRevisions 1 means: draft once, review once, then stop regardless.
    const result = await graph.invoke(startingTrip(1));

    console.log(`Revisions: ${result.revisions}\n`);
    console.log(result.itinerary.slice(0, 700));
    console.log(`\n--- reviewer said ---\n${result.critique.slice(0, 400)}`);
  } catch (error) {
    explainKiwiDown(error);
  }
});

step(4, "Let it loop until the reviewer is satisfied", async () => {
  if (!haveModel()) return needKey();

  const graph = buildAgentGraph();
  try {
    console.log("Up to 4 revisions. This makes several model calls.\n");
    const result = await graph.invoke(startingTrip(4));

    console.log(`Stopped after ${result.revisions} revision(s).`);
    console.log(
      result.critique.toUpperCase().startsWith(DONE_MARKER)
        ? `The reviewer was satisfied.\n`
        : `Hit the revision cap with the reviewer still unsatisfied.\n`,
    );
    console.log(result.itinerary);
  } catch (error) {
    explainKiwiDown(error);
  }
});

step(5, "Watch the loop go round", async () => {
  if (!haveModel()) return needKey();

  const graph = buildAgentGraph();
  try {
    const result = await graph.invoke(startingTrip(4));

    console.log("Every node that ran, in order:\n");
    result.notes.forEach((note, i) => console.log(`  ${i + 1}. ${note}`));

    console.log(`\n"review" appears more than once — that is the cycle running.`);
  } catch (error) {
    explainKiwiDown(error);
  }
});
