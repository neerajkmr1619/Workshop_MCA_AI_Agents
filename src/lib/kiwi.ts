import { MultiServerMCPClient } from "@langchain/mcp-adapters";

/**
 * Talking to Kiwi's MCP flight-search server.
 *
 * This is plumbing, not teaching material. It lives here rather than in a
 * lesson so the Module 2 lessons can stay about LangGraph — and because a
 * lesson must never import another lesson: registering steps is a module-scope
 * side effect, so importing one lesson from another collides their step
 * numbers at import time.
 */

export const KIWI_URL = "https://mcp.kiwi.com";

export interface Flight {
  priceEur: number;
  from: string;
  to: string;
  durationHours: number;
  stops: number;
  bookingUrl: string;
}

/**
 * Kiwi rejects dates in the past, so callers compute one at runtime rather
 * than hardcoding it. A hardcoded date stops working the day it passes.
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
 * so normalise all three into the object we want.
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

/** Pull the handful of fields the lessons care about out of Kiwi's rich itinerary. */
export function toFlights(itineraries: unknown[]): Flight[] {
  return itineraries.flatMap((raw) => {
    const it = raw as Record<string, any>;
    const leg = it.outbound ?? {};
    const flight: Flight = {
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

/** The cheapest fare in a list, or Infinity when there are none. */
export function cheapestFare(flights: Flight[]): number {
  if (flights.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...flights.map((f) => f.priceEur));
}

/**
 * Connect to Kiwi, run one search, and always close the client — an MCP client
 * left open keeps a connection alive after the lesson ends.
 */
export async function searchKiwi(
  origin: string,
  destination: string,
  date: string,
): Promise<{ itineraries?: unknown[]; error?: string }> {
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
    await client.close();
  }
}

/** Shared message for when Kiwi is unreachable — it is a third-party service. */
export function explainKiwiDown(error: unknown): void {
  console.log(`Could not reach Kiwi's flight search at ${KIWI_URL}.`);
  console.log(`\n  ${(error as Error).message}`);
  console.log(`\nThis is a third-party service, so it is occasionally unavailable.`);
  console.log(`Nothing else in the course depends on it — try again in a few minutes.\n`);
}
