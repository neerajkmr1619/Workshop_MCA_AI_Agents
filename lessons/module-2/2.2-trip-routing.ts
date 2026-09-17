import { TavilySearch } from "@langchain/tavily";
import { END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { isPlaceholder } from "@/lib/env";
import { cheapestFare as cheapestOf, futureDate, searchKiwi, toFlights } from "@/lib/kiwi";
import { step, type LessonMeta } from "@/runner/step";

export const meta: LessonMeta = {
  title: "LangGraph: conditional edges — branching on what the graph found",
  // Steps 1-2 need nothing. The hotel-search steps degrade with a message if
  // TAVILY_API_KEY is absent, so the whole lesson stays runnable either way.
  requires: [],
  optional: ["TAVILY_API_KEY"],
};

/**
 * Same trip state as lesson 2.1, plus the three fields this lesson introduces:
 * a budget to decide against, the tier the router picked, and the stays found.
 */
export const RoutedTripState = z.object({
  origin: z.string(),
  destination: z.string(),
  departureDate: z.string(),
  budgetEur: z.number(),
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
  tier: z.enum(["unset", "luxury", "budget"]),
  stays: z.array(z.string()),
  notes: z.array(z.string()),
});

export type RoutedTrip = z.infer<typeof RoutedTripState>;

const DAYS_AHEAD = 60;

/** Below this much left over after flights, we look for cheaper places to stay. */
export const LUXURY_THRESHOLD_EUR = 600;

/** The cheapest fare found, or Infinity when the search returned nothing. */
export function cheapestFare(trip: Pick<RoutedTrip, "flights">): number {
  return cheapestOf(trip.flights);
}

/**
 * The router. This is the whole idea of a conditional edge: an ordinary
 * function that looks at state and returns the NAME of the next node.
 *
 * It is pure — no network, no model — which is why it can be unit-tested,
 * and why a branch that misbehaves is always a logic bug you can reason about.
 */
export function chooseTier(state: Pick<RoutedTrip, "flights" | "budgetEur">): "luxuryStay" | "budgetStay" {
  const leftOver = state.budgetEur - cheapestFare(state);
  return leftOver >= LUXURY_THRESHOLD_EUR ? "luxuryStay" : "budgetStay";
}

/** Shared by both stay nodes — only the query differs. */
async function findStays(query: string): Promise<string[]> {
  if (isPlaceholder(process.env.TAVILY_API_KEY)) {
    return ["(set TAVILY_API_KEY in .env to search for real places to stay)"];
  }
  const search = new TavilySearch({ maxResults: 3 });
  const raw = (await search.invoke({ query })) as unknown;
  const results = (raw as { results?: { title?: string; url?: string }[] }).results ?? [];
  return results.map((r) => `${r.title ?? "untitled"} — ${r.url ?? ""}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Nodes
// ─────────────────────────────────────────────────────────────────────────────

function resolveDates(state: RoutedTrip): Partial<RoutedTrip> {
  const departureDate = futureDate(DAYS_AHEAD);
  return { departureDate, notes: [...state.notes, `resolveDates: ${departureDate}`] };
}

async function searchFlights(state: RoutedTrip): Promise<Partial<RoutedTrip>> {
  const result = await searchKiwi(state.origin, state.destination, state.departureDate);
  if (result.error) {
    return { notes: [...state.notes, `searchFlights: Kiwi said "${result.error}"`] };
  }
  const flights = toFlights(result.itineraries ?? []);
  return { flights, notes: [...state.notes, `searchFlights: ${flights.length} itineraries`] };
}

async function luxuryStay(state: RoutedTrip): Promise<Partial<RoutedTrip>> {
  const stays = await findStays(`best luxury hotels in ${state.destination} India`);
  return {
    tier: "luxury",
    stays,
    notes: [...state.notes, "luxuryStay: budget left room for a nicer hotel"],
  };
}

async function budgetStay(state: RoutedTrip): Promise<Partial<RoutedTrip>> {
  const stays = await findStays(`best budget guesthouses and hostels in ${state.destination} India`);
  return {
    tier: "budget",
    stays,
    notes: [...state.notes, "budgetStay: flights ate most of the budget"],
  };
}

function summarise(state: RoutedTrip): Partial<RoutedTrip> {
  const fare = cheapestFare(state);
  const fareText = Number.isFinite(fare) ? `${fare} EUR` : "no flights found";
  return {
    notes: [...state.notes, `summarise: ${fareText}, staying ${state.tier}`],
  };
}

/**
 * The same three nodes as lesson 2.1, plus a fork. `addConditionalEdges` takes
 * the node to branch from, the router, and the list of nodes it may return.
 */
export function buildRoutedGraph() {
  return new StateGraph(RoutedTripState)
    .addNode("resolveDates", resolveDates)
    .addNode("searchFlights", searchFlights)
    .addNode("luxuryStay", luxuryStay)
    .addNode("budgetStay", budgetStay)
    .addNode("summarise", summarise)
    .addEdge(START, "resolveDates")
    .addEdge("resolveDates", "searchFlights")
    .addConditionalEdges("searchFlights", chooseTier, ["luxuryStay", "budgetStay"])
    .addEdge("luxuryStay", "summarise")
    .addEdge("budgetStay", "summarise")
    .addEdge("summarise", END)
    .compile();
}

function startingTrip(budgetEur: number, origin = "London"): RoutedTrip {
  return {
    origin,
    destination: "Delhi",
    departureDate: "",
    budgetEur,
    flights: [],
    tier: "unset",
    stays: [],
    notes: [],
  };
}

function report(result: RoutedTrip): void {
  const fare = cheapestFare(result);
  console.log(`Budget: ${result.budgetEur} EUR`);
  console.log(`Cheapest flight: ${Number.isFinite(fare) ? `${fare} EUR` : "none found"}`);
  console.log(`Router chose: ${result.tier.toUpperCase()}\n`);
  for (const stay of result.stays) console.log(`  • ${stay}`);
}

// ─────────────────────────────────────────────────────────────────────────────

step(1, "A router is just a function returning a node name", async () => {
  // No graph, no network — routers are ordinary functions, so you can call
  // them directly with made-up state and see exactly why they chose a branch.
  const flights = [{ priceEur: 300, from: "STN", to: "DEL", durationHours: 14, stops: 1, bookingUrl: "" }];

  const generous = { flights, budgetEur: 1500 };
  const tight = { flights, budgetEur: 500 };
  const nothingFound = { flights: [], budgetEur: 5000 };

  console.log(`threshold: ${LUXURY_THRESHOLD_EUR} EUR left over after flights\n`);
  console.log(`budget 1500, flight 300 → left ${1500 - 300} → ${chooseTier(generous)}`);
  console.log(`budget  500, flight 300 → left ${500 - 300} → ${chooseTier(tight)}`);
  console.log(`no flights at all       → left -Infinity → ${chooseTier(nothingFound)}`);
});

step(2, "Wire the conditional edge, and look at the fork", async () => {
  const graph = buildRoutedGraph();
  const drawn = await graph.getGraphAsync();

  console.log("Dotted lines are the conditional branch:\n");
  console.log(drawn.drawMermaid());
});

step(3, "Generous budget — the graph takes the luxury branch", async () => {
  const graph = buildRoutedGraph();
  try {
    console.log("Searching live flights and stays...\n");
    report(await graph.invoke(startingTrip(1500)));
  } catch (error) {
    console.log(`Could not reach a service: ${(error as Error).message}`);
  }
});

step(4, "Same graph, tighter budget — a different path", async () => {
  const graph = buildRoutedGraph();
  try {
    console.log("Identical graph, only the budget changed.\n");
    report(await graph.invoke(startingTrip(500)));
    console.log(`\nNothing about the graph changed between steps 3 and 4.`);
    console.log(`The router read the state and sent the run down another edge.`);
  } catch (error) {
    console.log(`Could not reach a service: ${(error as Error).message}`);
  }
});

step(5, "The trail shows which branch actually ran", async () => {
  const graph = buildRoutedGraph();
  try {
    const result = await graph.invoke(startingTrip(1500));
    result.notes.forEach((note, i) => console.log(`  ${i + 1}. ${note}`));
    console.log(`\nOnly one of luxuryStay / budgetStay appears — the other never ran.`);
  } catch (error) {
    console.log(`Could not reach a service: ${(error as Error).message}`);
  }
});
