const PROXY_URL = "https://polymarket-arb-scanner-2.onrender.com"; 
// Replace with your actual Render URL if different

const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

async function fetchMarkets() {
  try {
    statusEl.textContent = "Fetching markets…";

    const response = await fetch(`${PROXY_URL}/markets`);
    if (!response.ok) throw new Error(`Proxy error: ${response.status}`);

    const data = await response.json();
    statusEl.textContent = "Processing markets…";

    return data;
  } catch (err) {
    console.error("Fetch error:", err);
    statusEl.textContent = "Failed to load markets (check proxy).";
    return null;
  }
}

function findArbitrage(markets) {
  const opportunities = [];

  markets.forEach(market => {
    if (!market.outcomes || market.outcomes.length < 2) return;

    const yes = market.outcomes.find(o => o.name === "Yes");
    const no = market.outcomes.find(o => o.name === "No");

    if (!yes || !no) return;

    const yesPrice = yes.price / 100;
    const noPrice = no.price / 100;

    const sum = yesPrice + noPrice;

    if (sum < 1) {
      opportunities.push({
        question: market.question,
        yesPrice,
        noPrice,
        edge: (1 - sum).toFixed(4)
      });
    }
  });

  return opportunities;
}

function renderResults(opps) {
  if (!opps || opps.length === 0) {
    resultsEl.innerHTML = "<p>No arbitrage found.</p>";
    return;
  }

  resultsEl.innerHTML = opps
    .map(o => `
      <div class="opp">
        <h3>${o.question}</h3>
        <p>Yes: ${o.yesPrice}</p>
        <p>No: ${o.noPrice}</p>
        <p><strong>Edge: ${o.edge}</strong></p>
      </div>
    `)
    .join("");
}

async function runScanner() {
  const markets = await fetchMarkets();
  if (!markets) return;

  const opps = findArbitrage(markets);
  renderResults(opps);

  statusEl.textContent = "Scan complete.";
}

runScanner();

