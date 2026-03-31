const PROXY = "https://polymarket-arb-hivj.onrender.com/proxy?url=";
const PROXY_URL = 'https://polymarket-arb-hivj.onrender.com/polymarket';

const refreshBtn = document.getElementById('refreshBtn');
const autoRefreshToggle = document.getElementById('autoRefreshToggle');
const minLiquidityInput = document.getElementById('minLiquidity');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const resultsBody = document.getElementById('resultsBody');

let autoRefreshInterval = null;

function setLoading(isLoading) {
  loadingEl.classList.toggle('hidden', !isLoading);
}

function setError(message) {
  if (!message) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  } else {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }
}

async function fetchMarkets() {
  const res = await fetch(PROXY_URL);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.markets || data;
}

function detectArbitrage(markets, minLiquidity) {
  const opportunities = [];

  for (const market of markets) {
    if (!market.outcomes || market.outcomes.length < 2) continue;

    const yes = market.outcomes.find(o => o.name === 'Yes');
    const no = market.outcomes.find(o => o.name === 'No');

    if (!yes || !no) continue;

    const yesPrice = Number(yes.price);
    const noPrice = Number(no.price);
    if (Number.isNaN(yesPrice) || Number.isNaN(noPrice)) continue;

    const total = yesPrice + noPrice;
    const edge = 1 - total;
    const liquidity = Number(market.liquidity || market.liquidityNum || 0);

    if (total < 0.98 && liquidity >= minLiquidity) {
      opportunities.push({
        question: market.title || market.question || 'Unknown',
        yes: yesPrice,
        no: noPrice,
        total,
        edge,
        liquidity,
        url: `https://polymarket.com/market/${market.slug || market.id || ''}`
      });
    }
  }

  opportunities.sort((a, b) => {
    if (b.edge !== a.edge) return b.edge - a.edge;
    return b.liquidity - a.liquidity;
  });

  return opportunities;
}

function renderTable(opportunities) {
  resultsBody.innerHTML = '';

  if (!opportunities.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.textContent = 'No arbitrage opportunities found with current filters.';
    resultsBody.appendChild(row);
    row.appendChild(cell);
    return;
  }

  for (const op of opportunities) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${op.question}</td>
      <td>${op.yes.toFixed(3)}</td>
      <td>${op.no.toFixed(3)}</td>
      <td>${op.total.toFixed(3)}</td>
      <td>${(op.edge * 100).toFixed(2)}%</td>
      <td>$${op.liquidity.toLocaleString()}</td>
      <td><a href="${op.url}" target="_blank">View</a></td>
    `;
    resultsBody.appendChild(row);
  }
}

async function runScanner() {
  const minLiquidity = Number(minLiquidityInput.value) || 0;
  setError('');
  setLoading(true);

  try {
    const markets = await fetchMarkets();
    const opportunities = detectArbitrage(markets, minLiquidity);
    renderTable(opportunities);
  } catch (err) {
    console.error(err);
    setError('Failed to fetch markets: ' + err.message);
  } finally {
    setLoading(false);
  }
}

function startAutoRefresh() {
  if (autoRefreshInterval) return;
  autoRefreshInterval = setInterval(runScanner, 30000);
}

function stopAutoRefresh() {
  if (!autoRefreshInterval) return;
  clearInterval(autoRefreshInterval);
  autoRefreshInterval = null;
}

refreshBtn.addEventListener('click', runScanner);

autoRefreshToggle.addEventListener('change', (e) => {
  if (e.target.checked) {
    startAutoRefresh();
    runScanner();
  } else {
    stopAutoRefresh();
  }
});

minLiquidityInput.addEventListener('change', () => {
  runScanner();
});

runScanner();
