import { describe, expect, it } from "vitest";
import {
  PRODUCTS,
  aiPlan,
  createGame,
  estimateAppeal,
  forecastFor,
  getOutcome,
  netWorth,
  resolveNight,
} from "./game.js";

const basicPlan = {
  quantity: 8,
  price: 10,
  promotion: 0,
  rainCover: false,
};

describe("night market rules", () => {
  it("creates a twelve-night season with a deterministic forecast", () => {
    const game = createGame({ seed: 42, product: "snack" });

    expect(game.night).toBe(1);
    expect(game.phase).toBe("planning");
    expect(game.stalls).toHaveLength(3);
    expect(game.forecast).toEqual(forecastFor(42, 1));
    expect(forecastFor(42, 1)).toEqual(forecastFor(42, 1));
  });

  it("rejects illegal and unaffordable plans without advancing", () => {
    const game = createGame({ seed: 5 });

    expect(() => resolveNight(game, { ...basicPlan, quantity: 21 })).toThrow(
      /進貨/,
    );
    expect(() =>
      resolveNight(game, {
        quantity: 20,
        price: 10,
        promotion: 2,
        rainCover: true,
      }),
    ).toThrow(/現金/);
    expect(game.night).toBe(1);
  });

  it("makes drinks more attractive than snacks in hot weather", () => {
    const event = { weather: "hot", special: "none", title: "熱浪" };
    const shared = {
      price: 10,
      promotion: 0,
      popularity: 2,
      neighbors: ["different"],
    };

    expect(
      estimateAppeal({ ...shared, product: "drink" }, event),
    ).toBeGreaterThan(estimateAppeal({ ...shared, product: "snack" }, event));
  });

  it("lets rain cover protect stock from a rainy-night loss", () => {
    const uncovered = createGame({ seed: 8, product: "snack" });
    const covered = createGame({ seed: 8, product: "snack" });
    const rain = { weather: "rain", special: "none", title: "午後雷雨" };
    uncovered.forecast = rain;
    covered.forecast = rain;

    const a = resolveNight(uncovered, {
      ...basicPlan,
      quantity: 12,
      rainCover: false,
    });
    const b = resolveNight(covered, {
      ...basicPlan,
      quantity: 12,
      rainCover: true,
    });

    expect(a.lastReport.player.spoiled).toBeGreaterThan(0);
    expect(b.lastReport.player.spoiled).toBe(0);
  });

  it("advances exactly twelve nights and produces a final ranking", () => {
    let game = createGame({ seed: 19, product: "game" });

    for (let i = 0; i < 12; i += 1) {
      game = resolveNight(game, {
        quantity: Math.min(8, Math.floor(game.stalls[0].cash / PRODUCTS.game.cost)),
        price: 12,
        promotion: 0,
        rainCover: false,
      });
    }

    expect(game.night).toBe(12);
    expect(game.phase).toBe("ended");
    expect(game.ranking).toHaveLength(3);
    expect(getOutcome(game).status).toMatch(/won|lost/);
    expect(game.ranking[0].worth).toBeGreaterThanOrEqual(
      game.ranking[1].worth,
    );
  });

  it("keeps AI plans legal and within budget", () => {
    const game = createGame({ seed: 77 });

    for (const stall of game.stalls.slice(1)) {
      const plan = aiPlan(stall, game.forecast, game.rng);
      const cost =
        plan.quantity * PRODUCTS[stall.product].cost +
        plan.promotion * 5 +
        (plan.rainCover ? 4 : 0);

      expect(plan.quantity).toBeGreaterThanOrEqual(0);
      expect(plan.quantity).toBeLessThanOrEqual(20);
      expect(plan.price).toBeGreaterThanOrEqual(5);
      expect(plan.price).toBeLessThanOrEqual(18);
      expect(cost).toBeLessThanOrEqual(stall.cash);
    }
  });

  it("values remaining stock conservatively in net worth", () => {
    const game = createGame({ seed: 1 });
    const stall = { ...game.stalls[0], cash: 100, stock: 4, popularity: 3 };

    expect(netWorth(stall)).toBe(
      100 + 4 * PRODUCTS[stall.product].cost * 0.5 + 6,
    );
  });
});
