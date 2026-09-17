import { describe, expect, it } from "vitest";
import {
  LUXURY_THRESHOLD_EUR,
  chooseTier,
} from "../../lessons/module-2/2.2-trip-routing";

const flight = (priceEur: number) => ({
  priceEur,
  from: "STN",
  to: "DEL",
  durationHours: 14,
  stops: 1,
  bookingUrl: "",
});

describe("chooseTier — the conditional edge's router", () => {
  it("picks luxury when plenty is left after the flight", () => {
    expect(chooseTier({ flights: [flight(300)], budgetEur: 1500 })).toBe("luxuryStay");
  });

  it("picks budget when the flight eats most of the budget", () => {
    expect(chooseTier({ flights: [flight(300)], budgetEur: 500 })).toBe("budgetStay");
  });

  it("routes on the CHEAPEST flight, not the first one listed", () => {
    // Expensive first: routing on flights[0] would wrongly choose budget.
    const flights = [flight(1400), flight(300)];
    expect(chooseTier({ flights, budgetEur: 1500 })).toBe("luxuryStay");
  });

  it("treats exactly the threshold as affordable", () => {
    const budgetEur = 300 + LUXURY_THRESHOLD_EUR;
    expect(chooseTier({ flights: [flight(300)], budgetEur })).toBe("luxuryStay");
  });

  it("falls to budget one euro under the threshold", () => {
    const budgetEur = 300 + LUXURY_THRESHOLD_EUR - 1;
    expect(chooseTier({ flights: [flight(300)], budgetEur })).toBe("budgetStay");
  });

  it("fails safe to budget when no flights were found", () => {
    // cheapestFare is Infinity here, so leftOver is -Infinity. A router that
    // crashed or defaulted to luxury on empty results would be worse.
    expect(chooseTier({ flights: [], budgetEur: 100_000 })).toBe("budgetStay");
  });

  it("only ever returns a real node name", () => {
    for (const budgetEur of [0, 500, 1500, 99_999]) {
      expect(["luxuryStay", "budgetStay"]).toContain(
        chooseTier({ flights: [flight(300)], budgetEur }),
      );
    }
  });
});
