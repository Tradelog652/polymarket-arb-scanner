const PROXY = "https://polymarket-arb-hivj.onrender.com/proxy?url=";

async function fetchMarkets() {
  const url = "https://api.polymarket.com/markets";

  const response = await fetch(
    PROXY + encodeURIComponent(url)
  );

  const data = await response.json();
  console.log("Markets:", data);

  // TODO: Add your arbitrage logic here
}

fetchMarkets();

