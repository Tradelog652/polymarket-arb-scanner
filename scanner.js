const PROXY = "https://polymarket-arb-hivj.onrender.com/proxy?url=";
const PM_URL = "https://api.polymarket.com/markets";
const KALSHI_URL = "https://api.kalshi.com/trade-api/v2/markets";

const REFRESH_MS = 10000;
const MIN_LIQUIDITY = 50;

// --- Utility: normalize text for loose matching ---
function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// --- Fetch Polymarket ---
async function fetchPolymarket() {
  const res = await fetch(PROXY + encodeURIComponent(PM_URL));
  return res.json();
}

// --- Fetch Kalshi ---
async function fetchKalshi() {
  const res = await fetch(PROXY + encodeURIComponent(KALSHI_URL));
  const data = await res.json();
  return data.markets || [];
}

// --- Multi-outcome arbitrage ---
function detectPolymarketArb(market) {
  if (!market.outcomes || market.outcomes.length < 2) return null;

  const outcomes = market.outcomes
    .map(o => ({
      name: o.name,
      price: o.price,
      liquidity: o.liquidity || 0
    }))
    .filter(o => o.price > 0 && o.liquidity >= MIN_LIQUIDITY);

  if (outcomes.length < 2) return null;

  const sumInv = outcomes.reduce((acc, o) => acc + 1 / o.price, 0);

  if (sumInv < 1) {
    const totalStake = sumInv;
    const profitPct = ((1 - totalStake) / totalStake) * 100;

    return {
      question: market.question,
      outcomes,
      profitPct,
      totalStake
    };
  }

  return null;
}

// --- Cross-exchange matching ---
function matchMarkets(pmMarkets, kalshiMarkets) {
  const matches = [];

  pmMarkets.forEach(pm => {
    const pmNorm = normalize(pm.question);

    let bestMatch = null;
    let bestScore = 0;

    kalshiMarkets.forEach(k => {
      const kNorm = normalize(k.title || k.ticker || "");

      let score = 0;
      pmNorm.split(" ").forEach(word => {
        if (kNorm.includes(word)) score++;
      });

      if (score > bestScore) {
        bestScore = score;
        bestMatch = k;
      }
    });

    if (bestScore >= 2 && bestMatch) {
      matches.push({ pm, kalshi: bestMatch });
    }
  });

  return matches;
}

// --- Compare Polymarket vs Kalshi ---
function compareExchanges(pairs) {
  const results = [];

  pairs.forEach(pair => {
    const pm = pair.pm;
    const k = pair.kalshi;

    if (!pm.outcomes || pm.outcomes.length < 2) return;

    const pmYes = pm.outcomes.find(o => o.name.toLowerCase().includes("yes"));
    const pmNo = pm.outcomes.find(o => o.name.toLowerCase().includes("no"));

    if (!pmYes || !pmNo) return;

    const kYes = k.yes_price;
    const kNo = k.no_price;

    if (kYes == null || kNo == null) return;

    const spreadYes = pmYes.price - kYes;
    const spreadNo = pmNo.price - kNo;

    results.push({
      question: pm.question,
      pmYes: pmYes.price,
      pmNo: pmNo.price,
      kYes,
      kNo,
      spreadYes,
      spreadNo
    });
  });

  return results;
}

// --- Render UI ---
function render(arbs, cross) {
  const container = document.getElementById("results");

  let html = `<h2>Last updated: ${new Date().toLocaleTimeString()}</h2>`;

  html += `<h3>Polymarket Arbitrage</h3>`;
  if (arbs.length === 0) {
    html += `<p>No Polymarket arbitrage found.</p>`;
  } else {
    html += `<table border="1" cellpadding="6">
      <tr><th>Market</th><th>Outcomes</th><th>Profit %</th></tr>`;
    arbs.forEach(a => {
      const outs = a.outcomes
        .map(o => `${o.name}: ${(o.price * 100).toFixed(2)}%`)
        .join("<br>");
      html += `<tr>
        <td>${a.question}</td>
        <td>${outs}</td>
        <td style="color:green;font-weight:bold;">${a.profitPct.toFixed(2)}%</td>
      </tr>`;
    });
    html += `</table>`;
  }

  html += `<h3>Polymarket ↔ Kalshi Price Comparison</h3>`;
  if (cross.length === 0) {
    html += `<p>No matched markets.</p>`;
  } else {
    html += `<table border="1" cellpadding="6">
      <tr>
        <th>Market</th>
        <th>PM Yes</th><th>Kalshi Yes</th><th>Spread</th>
        <th>PM No</th><th>Kalshi No</th><th>Spread</th>
      </tr>`;
    cross.forEach(c => {
      html += `<tr>
        <td>${c.question}</td>
        <td>${(c.pmYes * 100).toFixed(2)}%</td>
        <td>${(c.kYes * 100).toFixed(2)}%</td>
        <td>${c.spreadYes.toFixed(4)}</td>
        <td>${(c.pmNo * 100).toFixed(2)}%</td>
        <td>${(c.kNo * 100).toFixed(2)}%</td>
        <td>${c.spreadNo.toFixed(4)}</td>
      </tr>`;
    });
    html += `</table>`;
  }

  container.innerHTML = html;
}

// --- Main loop ---
async function run() {
  try {
    const [pm, kalshi] = await Promise.all([
      fetchPolymarket(),
      fetchKalshi()
    ]);

    const pmArbs = pm
      .map(detectPolymarketArb)
      .filter(x => x)
      .sort((a, b) => b.profitPct - a.profitPct);

    const matched = matchMarkets(pm, kalshi);
    const cross = compareExchanges(matched);

    render(pmArbs, cross);
  } catch (err) {
    document.getElementById("results").innerHTML =
      "<p style='color:red;'>Error loading data.</p>";
  }
}

run();
setInterval(run, REFRESH_MS);
