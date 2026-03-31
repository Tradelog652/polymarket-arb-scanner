const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Cache to avoid rate limits
let cache = null;
let cacheTime = 0;
const CACHE_DURATION = 60 * 1000; // 60 seconds

// Helper: fetch with retries + fallback
async function fetchPolymarket() {
  const endpoints = [
    "https://clob.polymarket.com/markets?limit=1000",
    "https://api.polymarket.com/markets?limit=1000"
  ];

  const headers = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0",
    "Origin": "https://polymarket.com",
    "Referer": "https://polymarket.com/"
  };

  for (const url of endpoints) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const res = await fetch(url, { headers });
        const text = await res.text();

        // HTML = Cloudflare / rate limit / error
        if (text.trim().startsWith("<")) {
          console.log(`HTML received from ${url} (attempt ${attempt})`);
          await new Promise(r => setTimeout(r, 300 * attempt));
          continue;
        }

        const json = JSON.parse(text);

        // Normalize structure
        const markets = Array.isArray(json)
          ? json
          : Array.isArray(json.markets)
          ? json.markets
          : null;

        if (!markets) {
          console.log(`Unexpected JSON shape from ${url}`);
          continue;
        }

        return markets;
      } catch (err) {
        console.log(`Error on ${url} attempt ${attempt}:`, err.message);
        await new Promise(r => setTimeout(r, 300 * attempt));
      }
    }
  }

  throw new Error("All Polymarket endpoints failed");
}

// Health check
app.get("/health", (req, res) => {
  res.json({
    backend: "online",
    cacheAgeMs: Date.now() - cacheTime,
    cacheAvailable: cache !== null
  });
});

// Main markets endpoint
app.get("/markets", async (req, res) => {
  try {
    // Serve cached data if fresh
    if (cache && Date.now() - cacheTime < CACHE_DURATION) {
      return res.json(cache);
    }

    const markets = await fetchPolymarket();

    // Cache result
    cache = markets;
    cacheTime = Date.now();

    res.json(markets);
  } catch (err) {
    console.error("Final error:", err.message);

    if (cache) {
      return res.json(cache); // fallback to last known good data
    }

    res.status(502).json({ error: "Polymarket unreachable" });
  }
});

app.listen(PORT, () => {
  console.log(`Next‑level backend running on port ${PORT}`);
});
