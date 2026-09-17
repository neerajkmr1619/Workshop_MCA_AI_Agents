import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";
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
export type Flight = Trip["flights"][number];

const KIWI_URL = "https://mcp.kiwi.com";
const DAYS_AHEAD = 60;

/**
 * Kiwi rejects dates in the past, so the date is computed at runtime rather
 * than hardcoded. A lesson with a hardcoded date stops working the day it
 * passes — which is exactly what happens to courses that ship "31st March".
 */
export function futureDate(daysAhead: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + daysAhead);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/**
 * Kiwi returns its payload as an MCP content block. Depending on the client
 * version that arrives as a JSON string, a single block, or an array of them,
 * so normalise all three shapes into the object we want.
 */
export function parseKiwiResult(raw: unknown): { itineraries?: unknown[]; error?: string } {
  let value: unknown = raw;

  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return { error: "Kiwi returned text that was not JSON." };
    }
  }
  if (Array.isArray(value)) value = value[0];

  const block = value as Record<string, unknown> | null;
  if (!block) return { error: "Kiwi returned an empty response." };

  if (block.structuredContent) return block.structuredContent as { itineraries?: unknown[] };

  if (typeof block.text === "string") {
    try {
      return JSON.parse(block.text) as { itineraries?: unknown[] };
    } catch {
      return { error: "Kiwi's text payload was not JSON." };
    }
  }

  return block as { itineraries?: unknown[]; error?: string };
}

/** Pull the handful of fields the lesson cares about out of Kiwi's rich itinerary. */
export function toFlights(itineraries: unknown[]): Flight[] {
  return itineraries.flatMap((raw) => {
    const it = raw as Record<string, any>;
    const leg = it.outbound ?? {};
    const flight = {
      priceEur: Number(it.price ?? 0),
      from: String(leg.from ?? "?"),
      to: String(leg.to ?? "?"),
      durationHours: Math.round(((leg.durationSeconds ?? 0) / 3600) * 10) / 10,
      stops: Array.isArray(leg.stops) ? leg.stops.length : Number(leg.stops ?? 0),
      bookingUrl: String(it.bookingUrl ?? ""),
    };
    return flight.priceEur > 0 ? [flight] : [];
  });
}

/** Connect to Kiwi, run one search, and always close the client. */
async function searchKiwi(origin: string, destination: string, date: string) {
  const client = new MultiServerMCPClient({
    // Python's "streamable_http" is spelled "http" in the JavaScript adapter.
    kiwi: { transport: "http", url: KIWI_URL },
  });

  try {
    const tools = await client.getTools();
    const search = tools.find((t) => t.name === "search-flight");
    if (!search) throw new Error("Kiwi did not offer a search-flight tool.");

    return parseKiwiResult(
      await search.invoke({ flyFrom: origin, flyTo: destination, departureDate: date }),
    );
  } finally {
    // An MCP client left open keeps a connection alive after the lesson ends.
    await client.close();
  }
}

function explainKiwiDown(error: unknown): void {
  console.log(`Could not reach Kiwi's flight search at ${KIWI_URL}.`);
  console.log(`\n  ${(error as Error).message}`);
  console.log(`\nThis is a third-party service, so it is occasionally unavailable.`);
  console.log(`Nothing else in the course depends on it — try again in a few minutes.\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// The three nodes. Each takes the whole state and returns a partial update.
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
