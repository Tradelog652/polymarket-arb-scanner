const PROXY_URL = "https://polymarket-arb-scanner-2.onrender.com";

const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

/* -----------------------------
   FETCH MARKETS
------------------------------*/
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

/* -----------------------------
   NORMALISE OUTCOMES
   Converts ANY market format into:
   [{ name: "...", price: 0.52 }, ...]
------------------------------*/
function extractOutcomes(market) {
  // Case 1: Polymarket "tokens" format
  if (market.tokens && market.tokens.length > 0) {
    return market.tokens.map(t => ({
      name: t.outcome,
      price: t.price
    }));
  }

  // Case 2: Polymarket "outcomes" format (rare)
  if (market.outcomes && market.outcomes.length > 0) {
    return market.outcomes.map(o => ({
      name: o.name,
      price: o.price / 100
    }));
  }

  return [];
}

/* -----------------------------
   FIND ARBITRAGE
   Works for:
   - Yes/No markets
   - Sports markets (2 outcomes)
   - Multi-outcome markets (3+)
------------------------------*/
function findArbitrage(markets) {
  const opportunities = [];

  markets.forEach(market => {
    const outcomes = extractOutcomes(market);
    if (outcomes.length < 2) return;

    const sum = outcomes.reduce((acc, o) => acc + o.price, 0);

    if (sum < 1) {
      opportunities.push({
        question: market.question,
        outcomes,
        edge: (1 - sum).toFixed(4)
      });
    }
  });

  // Sort by best edge
  return opportunities.sort((a, b) => b.edge - a.edge);
}

/* -----------------------------
   RENDER RESULTS
------------------------------*/
function renderResults(opps) {
  if (!opps || opps.length === 0) {
    resultsEl.innerHTML = "<p>No arbitrage found.</p>";
    return;
  }

  resultsEl.innerHTML = opps
    .map(o => {
      const color =
        o.edge > 0.10 ? "green" :
        o.edge > 0.03 ? "orange" :
        "red";

      const outcomesHTML = o.outcomes
        .map(out => `<p>${out.name}: ${out.price}</p>`)
        .join("");

      return `
        <div class="opp" style="border-left: 6px solid ${color}; padding-left: 10px;">
          <h3>${o.question}</h3>
          ${outcomesHTML}
          <p><strong>Edge: ${o.edge}</strong></p>
        </div>
      `;
    })
    .join("");
}

/* -----------------------------
   MAIN SCANNER LOOP
------------------------------*/
async function runScanner() {
  const markets = await fetchMarkets();
  if (!markets) return;

  const opps = findArbitrage(markets);
  renderResults(opps);

  statusEl.textContent = "Scan complete.";
}

/* -----------------------------
   AUTO-REFRESH EVERY 10 SECONDS
------------------------------*/
runScanner();
setInterval(runScanner, 10000);
