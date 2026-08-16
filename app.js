import { NightMarketAudio } from "./audio.js";
import {
  PRODUCTS,
  createGame,
  getOutcome,
  netWorth,
  resolveNight,
} from "./game.js";
import { loadBest, saveBest } from "./persist.js";

const $ = (selector) => document.querySelector(selector);
const audio = new NightMarketAudio();
const images = {
  snack: "./assets/images/corn-dog.png",
  drink: "./assets/images/soda.png",
  game: "./assets/images/prize.png",
};
const weatherIcons = { clear: "🌙", hot: "🔥", rain: "🌧️" };
const crowdFaces = ["🧑🏻", "👩🏻", "👨🏻", "🧒🏻", "👵🏻", "🧑🏻‍🦱", "👩🏻‍🦰"];

let selectedProduct = "snack";
let promotion = 0;
let game = null;
let best = 0;

const lobby = $("#lobby");
const gameView = $("#game");
const resultSheet = $("#result-sheet");
const aboutSheet = $("#about-sheet");
const quantity = $("#quantity");
const price = $("#price");
const rainCover = $("#rain-cover");

function currentPlan() {
  return {
    quantity: Number(quantity.value),
    price: Number(price.value),
    promotion,
    rainCover: rainCover.checked,
  };
}

function planCost(plan = currentPlan()) {
  if (!game) return 0;
  return (
    plan.quantity * PRODUCTS[game.stalls[0].product].cost +
    plan.promotion * 5 +
    (plan.rainCover ? 4 : 0)
  );
}

function eventTip(event, product) {
  if (event.weather === "rain") return "雨會趕走人潮；沒雨棚還會損失四分之一庫存。";
  if (event.weather === "hot" && product === "drink") return "飲料攤乘著熱浪，今晚特別吸客！";
  if (event.weather === "hot") return "天氣炎熱，飲料競爭會變強。";
  if (event.special === "concert") return "舞台開唱會帶來大批人潮，飲料尤其吃香。";
  if (event.special === "tour") return "團客來了，套圈遊戲最容易留住他們。";
  if (event.special === "inspection") return "消保巡查中，售價超過行情五成會傷人氣。";
  return "平穩的一夜，價格與人氣就是勝負關鍵。";
}

function renderForecast() {
  const event = game.forecast;
  $("#forecast").innerHTML = `
    <span class="forecast-icon" aria-hidden="true">${weatherIcons[event.weather]}</span>
    <div>
      <p>第 ${game.night} 夜預報</p>
      <strong>${event.title}</strong>
      <p>${eventTip(event, game.stalls[0].product)}</p>
    </div>
  `;
}

function renderMarket() {
  const report = game.lastReport?.reports;
  $("#stall-row").innerHTML = game.stalls
    .map((stall) => {
      const last = report?.[stall.id];
      const detail = last
        ? `昨售 ${last.sold} · $${last.plan.price}`
        : `${PRODUCTS[stall.product].name} · $${Math.round(netWorth(stall))}`;
      return `
        <article class="stall ${stall.id === "player" ? "player" : ""}" style="--stall-color:var(--${stall.color})">
          <img class="stall-icon" src="${images[stall.product]}" alt="" />
          <strong class="stall-name">${stall.name}</strong>
          <span class="stall-meta">${detail}</span>
        </article>
      `;
    })
    .join("");
}

function renderCrowd(sold = 0) {
  const count = Math.min(14, Math.max(0, sold));
  $("#crowd").innerHTML = Array.from({ length: count }, (_, index) => {
    const left = 3 + ((index * 37) % 91);
    const delay = -((index * 0.31) % 2.4);
    const face = crowdFaces[index % crowdFaces.length];
    return `<span class="person" style="left:${left}%;animation-delay:${delay}s">${face}</span>`;
  }).join("");
}

function popularityStars(value) {
  const rounded = Math.max(0, Math.min(10, Math.round(value)));
  return `${"★".repeat(rounded)}${"☆".repeat(10 - rounded)}`;
}

function renderHud() {
  const player = game.stalls[0];
  $("#night-value").textContent = `${game.night} / ${game.maxNights}`;
  $("#cash-value").textContent = `$${player.cash}`;
  $("#popularity-value").textContent = popularityStars(player.popularity);
  $("#stock-value").textContent = String(player.stock);
}

function updatePlanner() {
  if (!game) return;
  const plan = currentPlan();
  const cost = planCost(plan);
  const cash = game.stalls[0].cash;
  const remaining = cash - cost;
  $("#quantity-output").textContent = `${plan.quantity} 份`;
  $("#price-output").textContent = `$${plan.price}`;
  $("#cost-value").textContent = `$${cost}`;
  $("#budget-left").textContent = `$${remaining} 剩餘`;
  $("#budget-left").classList.toggle("danger", remaining < 0);
  $("#plan-message").textContent =
    remaining < 0 ? `還差 $${Math.abs(remaining)}，請少進貨或降低宣傳。` : "";
  $("#open-button").disabled = remaining < 0;
}

function resetPlanner() {
  const player = game.stalls[0];
  const product = PRODUCTS[player.product];
  quantity.value = String(Math.min(8, Math.floor(player.cash / product.cost)));
  price.value = String(product.fairPrice);
  rainCover.checked = false;
  promotion = 0;
  document.querySelectorAll("[data-promotion]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.promotion === "0");
  });
  updatePlanner();
}

function renderGame() {
  renderHud();
  renderForecast();
  renderMarket();
  updatePlanner();
}

function showNightResult(report) {
  const player = report.player;
  const profitable = player.profit >= 0;
  $("#result-kicker").textContent = `第 ${report.night} 夜打烊`;
  $("#result-title").textContent =
    player.sold === 0 ? "今晚有點冷清…" : player.sold >= 10 ? "排隊人潮來了！" : "順利收攤！";
  $("#result-content").innerHTML = `
    <p>${report.event.title}，整條夜市共有 <strong>${report.customers}</strong> 位客人。</p>
    <div class="report-grid">
      <div><span>來客</span><strong>${player.customers}</strong></div>
      <div><span>售出</span><strong>${player.sold}</strong></div>
      <div><span>營收</span><strong>$${player.revenue}</strong></div>
    </div>
    ${player.spoiled ? `<p class="profit loss">雨淋損失 ${player.spoiled} 份庫存；下次記得評估雨棚。</p>` : ""}
    <p class="profit ${profitable ? "" : "loss"}">本夜損益 ${profitable ? "+" : ""}$${player.profit}</p>
  `;
  $("#continue-button").textContent = "看明晚預報";
  resultSheet.hidden = false;
  $("#continue-button").focus();
}

async function showFinalResult() {
  const outcome = getOutcome(game);
  best = await saveBest(outcome.worth, best);
  $("#lobby-best").textContent = `$${best}`;
  $("#result-kicker").textContent = "十二夜總決算";
  $("#result-title").textContent =
    outcome.status === "won" ? "你是今季夜市王！" : `本季第 ${outcome.rank} 名`;
  $("#result-content").innerHTML = `
    <p>淨資產包含現金、半價庫存與人氣獎勵。</p>
    <ol class="ranking">
      ${game.ranking
        .map(
          (entry, index) => `
            <li class="${entry.id === "player" ? "player" : ""}">
              <span>${["🥇", "🥈", "🥉"][index]}</span>
              <span>${entry.name}<small> · 售出 ${entry.sold}</small></span>
              <strong>$${entry.worth}</strong>
            </li>
          `,
        )
        .join("")}
    </ol>
  `;
  $("#continue-button").textContent = "換個攤再來";
  resultSheet.hidden = false;
  $("#continue-button").focus();
  audio.play(outcome.status === "won" ? "cash" : "pop");
}

function selectProduct(product) {
  selectedProduct = product;
  document.querySelectorAll("[data-product]").forEach((button) => {
    const selected = button.dataset.product === product;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-checked", selected ? "true" : "false");
  });
}

document.querySelectorAll("[data-product]").forEach((button) => {
  button.addEventListener("click", () => {
    selectProduct(button.dataset.product);
    audio.play("click");
  });
});

document.querySelectorAll("[data-promotion]").forEach((button) => {
  button.addEventListener("click", () => {
    promotion = Number(button.dataset.promotion);
    document.querySelectorAll("[data-promotion]").forEach((item) => {
      item.classList.toggle("selected", item === button);
    });
    audio.play("click");
    updatePlanner();
  });
});

for (const input of [quantity, price, rainCover]) {
  input.addEventListener("input", updatePlanner);
  input.addEventListener("change", () => audio.play("click"));
}

$("#start-button").addEventListener("click", async () => {
  await audio.start();
  audio.play("cash");
  game = createGame({ seed: Date.now(), product: selectedProduct });
  globalThis.__nightstall = { getGame: () => game };
  lobby.hidden = true;
  gameView.hidden = false;
  resetPlanner();
  renderCrowd(5);
  renderGame();
  $("#open-button").focus();
});

$("#open-button").addEventListener("click", () => {
  try {
    const previousNight = game.night;
    game = resolveNight(game, currentPlan());
    renderGame();
    renderCrowd(game.lastReport.player.sold);
    audio.play(game.lastReport.player.profit >= 0 ? "cash" : "pop");
    if (game.phase === "ended") {
      void showFinalResult();
    } else {
      showNightResult({ ...game.lastReport, night: previousNight });
    }
  } catch (error) {
    $("#plan-message").textContent = error.message;
    audio.play("pop");
  }
});

$("#continue-button").addEventListener("click", () => {
  audio.play("click");
  resultSheet.hidden = true;
  if (game.phase === "ended") {
    game = null;
    gameView.hidden = true;
    lobby.hidden = false;
    renderCrowd(0);
    $("#start-button").focus();
    return;
  }
  resetPlanner();
  renderCrowd(4);
  renderGame();
  $("#open-button").focus();
});

$("#sound-toggle").addEventListener("click", () => {
  audio.setEnabled(!audio.enabled);
  $("#sound-toggle").textContent = audio.enabled ? "♪ 音樂開" : "♩ 音樂關";
  $("#sound-toggle").setAttribute("aria-pressed", String(audio.enabled));
  if (audio.enabled) audio.play("click");
});

$("#how-button").addEventListener("click", () => {
  aboutSheet.hidden = false;
  $("#about-close").focus();
  audio.play("click");
});

$("#about-close").addEventListener("click", () => {
  aboutSheet.hidden = true;
  $("#how-button").focus();
  audio.play("click");
});

best = await loadBest();
$("#lobby-best").textContent = `$${best}`;
