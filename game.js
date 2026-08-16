export const PRODUCTS = Object.freeze({
  snack: {
    name: "炙燒小吃",
    icon: "🍢",
    cost: 4,
    fairPrice: 10,
  },
  drink: {
    name: "沁涼飲品",
    icon: "🥤",
    cost: 3,
    fairPrice: 8,
  },
  game: {
    name: "套圈遊戲",
    icon: "⭕",
    cost: 5,
    fairPrice: 12,
  },
});

const WEATHER = [
  { weather: "clear", title: "晚風舒爽" },
  { weather: "clear", title: "晴朗夜市" },
  { weather: "hot", title: "熱浪來襲" },
  { weather: "rain", title: "午後雷雨" },
];

const SPECIALS = [
  { special: "none", label: "平常夜" },
  { special: "concert", label: "舞台開唱" },
  { special: "tour", label: "遊覽車團客" },
  { special: "inspection", label: "消保巡查" },
];

function hash(seed, value) {
  let n = (seed ^ Math.imul(value + 1, 0x9e3779b1)) >>> 0;
  n ^= n >>> 16;
  n = Math.imul(n, 0x21f0aaad);
  n ^= n >>> 15;
  n = Math.imul(n, 0x735a2d97);
  return (n ^ (n >>> 15)) >>> 0;
}

function random01(seed, value) {
  return hash(seed, value) / 0x100000000;
}

export function forecastFor(seed, night) {
  const weather = WEATHER[Math.floor(random01(seed, night * 2) * WEATHER.length)];
  const special =
    SPECIALS[Math.floor(random01(seed, night * 2 + 1) * SPECIALS.length)];
  return {
    weather: weather.weather,
    special: special.special,
    title: `${weather.title} · ${special.label}`,
  };
}

function makeStall(id, name, product, color) {
  return {
    id,
    name,
    product,
    color,
    cash: 80,
    stock: 0,
    popularity: 2,
    totalSold: 0,
    totalRevenue: 0,
  };
}

export function createGame({ seed = Date.now(), product = "snack" } = {}) {
  if (!PRODUCTS[product]) throw new Error("未知的攤位類型");
  const aiProducts = Object.keys(PRODUCTS).filter((key) => key !== product);
  const safeSeed = Number(seed) >>> 0;
  return {
    seed: safeSeed,
    rng: hash(safeSeed, 999),
    night: 1,
    maxNights: 12,
    phase: "planning",
    forecast: forecastFor(safeSeed, 1),
    stalls: [
      makeStall("player", "你的旺來攤", product, "coral"),
      makeStall("ai-low", "阿珠姨", aiProducts[0], "aqua"),
      makeStall("ai-bold", "夜市小王", aiProducts[1], "violet"),
    ],
    history: [],
    lastReport: null,
    ranking: null,
  };
}

function weatherMultiplier(product, weather) {
  if (weather === "hot") {
    if (product === "drink") return 1.55;
    if (product === "snack") return 0.92;
  }
  if (weather === "rain") {
    if (product === "drink") return 0.75;
    if (product === "snack") return 0.88;
    return 0.82;
  }
  return 1;
}

function specialMultiplier(product, special) {
  if (special === "concert") return product === "drink" ? 1.35 : 1.18;
  if (special === "tour") return product === "game" ? 1.35 : 1.18;
  return 1;
}

export function estimateAppeal(stall, event) {
  const product = PRODUCTS[stall.product];
  const fairPrice = product.fairPrice;
  const priceRatio = stall.price / fairPrice;
  const priceFactor = Math.max(0.28, 1.45 - priceRatio * 0.45);
  const promoFactor = 1 + stall.promotion * 0.24;
  const popularityFactor = 0.82 + stall.popularity * 0.09;
  const neighborFactor = (stall.neighbors ?? []).reduce(
    (factor, neighbor) =>
      factor + (neighbor === "same" ? -0.1 : neighbor === "different" ? 0.08 : 0),
    1,
  );
  const inspectionPenalty =
    event.special === "inspection" && stall.price > fairPrice * 1.5 ? 0.62 : 1;

  return Math.max(
    0.05,
    priceFactor *
      promoFactor *
      popularityFactor *
      neighborFactor *
      weatherMultiplier(stall.product, event.weather) *
      specialMultiplier(stall.product, event.special) *
      inspectionPenalty,
  );
}

function planCost(stall, plan) {
  return (
    plan.quantity * PRODUCTS[stall.product].cost +
    plan.promotion * 5 +
    (plan.rainCover ? 4 : 0)
  );
}

function validatePlan(stall, plan) {
  if (
    !Number.isInteger(plan.quantity) ||
    plan.quantity < 0 ||
    plan.quantity > 20
  ) {
    throw new Error("進貨量必須是 0～20 的整數");
  }
  if (!Number.isInteger(plan.price) || plan.price < 5 || plan.price > 18) {
    throw new Error("售價必須是 5～18 的整數");
  }
  if (![0, 1, 2].includes(plan.promotion)) {
    throw new Error("宣傳必須是 0～2 級");
  }
  if (typeof plan.rainCover !== "boolean") {
    throw new Error("雨棚設定無效");
  }
  if (planCost(stall, plan) > stall.cash) {
    throw new Error("現金不足，請降低進貨或宣傳");
  }
}

export function aiPlan(stall, event, rng = 1) {
  const product = PRODUCTS[stall.product];
  const hotDrink = event.weather === "hot" && stall.product === "drink";
  const eventBoost =
    event.special === "concert" || event.special === "tour" || hotDrink;
  let promotion = eventBoost ? 1 : stall.id === "ai-bold" ? 1 : 0;
  let rainCover = event.weather === "rain";
  let price =
    product.fairPrice +
    (stall.id === "ai-bold" ? 2 : 0) +
    (random01(rng, stall.totalSold + 1) > 0.72 ? 1 : 0);
  let quantity = Math.min(20, Math.max(4, 8 + (eventBoost ? 3 : 0) - stall.stock));

  price = Math.max(5, Math.min(18, price));
  while (
    quantity > 0 &&
    quantity * product.cost + promotion * 5 + (rainCover ? 4 : 0) > stall.cash
  ) {
    quantity -= 1;
  }
  if (planCost(stall, { quantity, price, promotion, rainCover }) > stall.cash) {
    promotion = 0;
  }
  if (planCost(stall, { quantity, price, promotion, rainCover }) > stall.cash) {
    rainCover = false;
  }

  return { quantity, price, promotion, rainCover };
}

function customerCount(game) {
  const event = game.forecast;
  const base =
    34 +
    Math.floor(random01(game.rng, game.night) * 13) +
    (event.special === "concert" ? 12 : 0) +
    (event.special === "tour" ? 8 : 0);
  return event.weather === "rain" ? Math.floor(base * 0.68) : base;
}

function resolveStall(stall, plan, event, demand) {
  const next = { ...stall };
  const cost = planCost(stall, plan);
  next.cash -= cost;
  next.stock += plan.quantity;

  const spoiled =
    event.weather === "rain" && !plan.rainCover
      ? Math.min(next.stock, Math.max(1, Math.floor(next.stock * 0.25)))
      : 0;
  next.stock -= spoiled;
  const sold = Math.min(next.stock, Math.max(0, Math.round(demand)));
  const revenue = sold * plan.price;
  next.stock -= sold;
  next.cash += revenue;
  next.totalSold += sold;
  next.totalRevenue += revenue;

  const fairPrice = PRODUCTS[next.product].fairPrice;
  const soldRatio = sold / Math.max(1, plan.quantity + stall.stock);
  const popularityDelta =
    (soldRatio >= 0.8 ? 1 : soldRatio < 0.35 ? -1 : 0) +
    (plan.price <= fairPrice ? 0.5 : 0) +
    (event.special === "inspection" && plan.price > fairPrice * 1.5 ? -1 : 0);
  next.popularity = Math.max(0, Math.min(10, next.popularity + popularityDelta));

  return {
    stall: next,
    report: {
      id: stall.id,
      name: stall.name,
      product: stall.product,
      plan,
      cost,
      customers: Math.max(0, Math.round(demand)),
      sold,
      spoiled,
      revenue,
      profit: revenue - cost,
      cash: next.cash,
      popularity: next.popularity,
    },
  };
}

export function netWorth(stall) {
  return (
    stall.cash +
    stall.stock * PRODUCTS[stall.product].cost * 0.5 +
    stall.popularity * 2
  );
}

function makeRanking(stalls) {
  return stalls
    .map((stall) => ({
      id: stall.id,
      name: stall.name,
      product: stall.product,
      worth: Math.round(netWorth(stall)),
      sold: stall.totalSold,
    }))
    .sort(
      (a, b) =>
        b.worth - a.worth ||
        b.sold - a.sold ||
        (a.id === "player" ? -1 : b.id === "player" ? 1 : 0),
    );
}

export function resolveNight(game, playerPlan) {
  if (game.phase !== "planning") throw new Error("本季已經結束");
  validatePlan(game.stalls[0], playerPlan);

  const plans = [
    playerPlan,
    ...game.stalls
      .slice(1)
      .map((stall, index) => aiPlan(stall, game.forecast, game.rng + index)),
  ];
  game.stalls.forEach((stall, index) => validatePlan(stall, plans[index]));

  const planned = game.stalls.map((stall, index, stalls) => ({
    ...stall,
    ...plans[index],
    neighbors: stalls
      .filter((other) => other.id !== stall.id)
      .map((other) => (other.product === stall.product ? "same" : "different")),
  }));
  const appeals = planned.map((stall) => estimateAppeal(stall, game.forecast));
  const totalAppeal = appeals.reduce((sum, value) => sum + value, 0);
  const customers = customerCount(game);
  const resolved = game.stalls.map((stall, index) =>
    resolveStall(
      stall,
      plans[index],
      game.forecast,
      customers * (appeals[index] / totalAppeal),
    ),
  );
  const reports = Object.fromEntries(
    resolved.map(({ report }) => [report.id, report]),
  );
  const lastReport = {
    night: game.night,
    event: game.forecast,
    customers,
    reports,
    player: reports.player,
  };
  const stalls = resolved.map(({ stall }) => stall);
  const history = [...game.history, lastReport];
  const ended = game.night >= game.maxNights;

  return {
    ...game,
    rng: hash(game.rng, game.night),
    night: ended ? game.night : game.night + 1,
    phase: ended ? "ended" : "planning",
    forecast: ended ? game.forecast : forecastFor(game.seed, game.night + 1),
    stalls,
    history,
    lastReport,
    ranking: ended ? makeRanking(stalls) : null,
  };
}

export function getOutcome(game) {
  if (game.phase !== "ended") return { status: "playing" };
  const rank = game.ranking.findIndex((entry) => entry.id === "player") + 1;
  return {
    status: rank === 1 ? "won" : "lost",
    rank,
    worth: game.ranking[rank - 1].worth,
  };
}
