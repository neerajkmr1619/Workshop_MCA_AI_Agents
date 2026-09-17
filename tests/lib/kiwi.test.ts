import { describe, expect, it } from "vitest";
import { cheapestFare, futureDate, parseKiwiResult, toFlights } from "@/lib/kiwi";

describe("futureDate", () => {
  it("formats as dd/mm/yyyy, which is what Kiwi expects", () => {
    expect(futureDate(0, new Date("2026-03-05T12:00:00"))).toBe("05/03/2026");
  });

  it("zero-pads single-digit days and months", () => {
    expect(futureDate(0, new Date("2026-01-01T12:00:00"))).toBe("01/01/2026");
  });

  it("rolls over month and year boundaries", () => {
    expect(futureDate(1, new Date("2026-12-31T12:00:00"))).toBe("01/01/2027");
  });

  it("is always in the future, which is why the date is not hardcoded", () => {
    const [dd, mm, yyyy] = futureDate(60).split("/").map(Number);
    const resolved = new Date(yyyy!, mm! - 1, dd!);
    expect(resolved.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("parseKiwiResult", () => {
  const payload = { itineraries: [{ price: 100 }] };

  it("reads a structuredContent block", () => {
    expect(parseKiwiResult({ type: "text", structuredContent: payload })).toEqual(payload);
  });

  it("reads a text block holding JSON", () => {
    expect(parseKiwiResult({ type: "text", text: JSON.stringify(payload) })).toEqual(payload);
  });

  it("reads a bare JSON string", () => {
    expect(parseKiwiResult(JSON.stringify(payload))).toEqual(payload);
  });

  it("unwraps a single-element array of blocks", () => {
    expect(parseKiwiResult([{ type: "text", structuredContent: payload }])).toEqual(payload);
  });

  it("surfaces Kiwi's own error rather than throwing", () => {
    const result = parseKiwiResult({
      structuredContent: { itineraries: [], error: "These dates are in the past" },
    });
    expect(result.error).toMatch(/past/);
  });

  it("returns an error instead of throwing on unparseable text", () => {
    expect(parseKiwiResult("not json at all").error).toBeTruthy();
  });

  it("returns an error instead of throwing on null", () => {
    expect(parseKiwiResult(null).error).toBeTruthy();
  });
});

describe("toFlights", () => {
  const itinerary = {
    price: 288,
    bookingUrl: "https://kiwi.com/u/abc",
    outbound: { from: "STN", to: "DEL", durationSeconds: 53400, stops: [{}, {}] },
  };

  it("maps Kiwi's itinerary onto the lesson's flight shape", () => {
    expect(toFlights([itinerary])).toEqual([
      {
        priceEur: 288,
        from: "STN",
        to: "DEL",
        durationHours: 14.8,
        stops: 2,
        bookingUrl: "https://kiwi.com/u/abc",
      },
    ]);
  });

  it("counts a direct flight as zero stops", () => {
    const direct = { ...itinerary, outbound: { ...itinerary.outbound, stops: [] } };
    expect(toFlights([direct])[0]?.stops).toBe(0);
  });

  it("drops itineraries with no usable price", () => {
    expect(toFlights([{ ...itinerary, price: 0 }])).toEqual([]);
  });

  it("survives a malformed itinerary rather than throwing", () => {
    expect(() => toFlights([{}])).not.toThrow();
    expect(toFlights([{}])).toEqual([]);
  });

  it("returns nothing for an empty search", () => {
    expect(toFlights([])).toEqual([]);
  });
});

describe("cheapestFare", () => {
  const f = (priceEur: number) => ({
    priceEur,
    from: "STN",
    to: "DEL",
    durationHours: 14,
    stops: 1,
    bookingUrl: "",
  });

  it("finds the lowest price", () => {
    expect(cheapestFare([f(400), f(288), f(350)])).toBe(288);
  });

  it("returns Infinity for no flights, so budget comparisons fail safe", () => {
    expect(cheapestFare([])).toBe(Number.POSITIVE_INFINITY);
  });
});
