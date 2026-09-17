import { END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { explainKiwiDown, futureDate, searchKiwi, toFlights } from "@/lib/kiwi";
import { printJson } from "@/lib/print";
import { step, type LessonMeta } from "@/runner/step";

export const meta: LessonMeta = {
  title: "LangGraph: state, nodes and edges — planning a trip to Delhi",
  // Kiwi's MCP server is open, so this whole lesson runs without any API key.
  requires: [],
};

/**
 * The graph's state. Every node receives the whole thing and returns a PARTIAL
 * update, which LangGraph merges back in.
 *
 * This is the central idea of LangGraph and the thing to understand before
 * anything else: nodes do not call each other, they only read and write state.
 */
export const TripState = z.object({
  origin: z.string(),
  destination: z.string(),
  /** Kiwi wants dd/mm/yyyy. Filled in by the resolveDates node, not by the caller. */
  departureDate: z.string(),
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
  /** A running log, so you can see which nodes ran and in what order. */
  notes: z.array(z.string()),
});

export type Trip = z.infer<typeof TripState>;

const DAYS_AHEAD = 60;

// ─────────────────────────────────────────────────────────────────────────────
// The three nodes. Each takes the whole state and returns a partial update.
// The Kiwi plumbing lives in src/lib/kiwi.ts so these stay about the graph.
// ─────────────────────────────────────────────────────────────────────────────

/** Works out a real, future departure date. */
function resolveDates(state: Trip): Partial<Trip> {
  const departureDate = futureDate(DAYS_AHEAD);
  return {
    departureDate,
    notes: [...state.notes, `resolveDates: departing ${departureDate}`],
  };
}

/** Calls Kiwi and writes the results into state. */
async function searchFlights(state: Trip): Promise<Partial<Trip>> {
  const result = await searchKiwi(state.origin, state.destination, state.departureDate);

  if (result.error) {
    return { notes: [...state.notes, `searchFlights: Kiwi said "${result.error}"`] };
  }

  const flights = toFlights(result.itineraries ?? []);
  return {
    flights,
    notes: [...state.notes, `searchFlights: found ${flights.length} itineraries`],
  };
}

/** Reads what the previous nodes wrote and draws a conclusion. */
function summarise(state: Trip): Partial<Trip> {
  if (state.flights.length === 0) {
    return { notes: [...state.notes, "summarise: nothing to summarise"] };
  }
  const cheapest = [...state.flights].sort((a, b) => a.priceEur - b.priceEur)[0]!;
  return {
    notes: [
      ...state.notes,
      `summarise: cheapest is ${cheapest.priceEur} EUR, ${cheapest.from}→${cheapest.to}`,
    ],
  };
}

/**
 * Built per step rather than once at module scope, so every step stands alone
 * and nothing runs at import time.
 */
export function buildTripGraph() {
  return new StateGraph(TripState)
    .addNode("resolveDates", resolveDates)
    .addNode("searchFlights", searchFlights)
    .addNode("summarise", summarise)
    .addEdge(START, "resolveDates")
    .addEdge("resolveDates", "searchFlights")
    .addEdge("searchFlights", "summarise")
    .addEdge("summarise", END)
    .compile();
}

function startingTrip(origin = "London"): Trip {
  return { origin, destination: "Delhi", departureDate: "", flights: [], notes: [] };
}

// ─────────────────────────────────────────────────────────────────────────────

step(1, "The state schema — what flows through the graph", async () => {
  console.log("Every node reads this shape and returns a partial update:\n");
  for (const [key, value] of Object.entries(TripState.shape)) {
    console.log(`  ${key.padEnd(15)} ${value.constructor.name}`);
  }
  console.log(`\nA starting state, before any node has run:`);
  printJson(startingTrip());
});

step(2, "One node in isolation — nodes return PARTIAL state", async () => {
  const before = startingTrip();
  const update = resolveDates(before);

  console.log("resolveDates returned only the keys it changed:");
  printJson(update);

  console.log(`\nNote it did not return origin, destination or flights.`);
  console.log(`LangGraph merges this update into the state for you.`);
});

step(3, "Wire the nodes into a graph, and look at it", async () => {
  const graph = buildTripGraph();
  const drawn = await graph.getGraphAsync();

  console.log("The graph you just built, as Mermaid:\n");
  console.log(drawn.drawMermaid());
  console.log(`Paste that into https://mermaid.live to see it drawn.`);
});

step(4, "Run the graph against live flight data", async () => {
  const graph = buildTripGraph();

  try {
    console.log("Searching Kiwi for real flights — this takes a few seconds...\n");
    const result = await graph.invoke(startingTrip());

    console.log(`${result.origin} → ${result.destination} on ${result.departureDate}`);
    console.log(`${result.flights.length} itineraries found.\n`);

    for (const f of [...result.flights].sort((a, b) => a.priceEur - b.priceEur).slice(0, 5)) {
      const stops = f.stops === 0 ? "direct" : `${f.stops} stop(s)`;
      console.log(
        `  ${String(f.priceEur).padStart(6)} EUR  ${f.from}→${f.to}  ${f.durationHours}h  ${stops}`,
      );
    }
  } catch (error) {
    explainKiwiDown(error);
  }
});

step(5, "Follow the state as it moved through the graph", async () => {
  const graph = buildTripGraph();

  try {
    const result = await graph.invoke(startingTrip());

    console.log("Each node appended to `notes`, so the trail shows the order they ran:\n");
    result.notes.forEach((note, i) => console.log(`  ${i + 1}. ${note}`));

    console.log(`\nThe nodes never called each other — they only read and wrote state.`);
  } catch (error) {
    explainKiwiDown(error);
  }
});
