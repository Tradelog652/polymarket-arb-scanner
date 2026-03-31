const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Simple in‑memory cache to reduce rate limits
let cachedMarkets = null;
let cachedAt = 0;
const CACHE_MS = 10 * 1000; // 10 seconds

app.get("/", (req, res) => {
  res.send("Polymarket proxy is running");
});

app.get("/markets", async (req, res) => {
  try {
    const now = Date.now();

    // Serve from cache if fresh
    if (cachedMarkets && now - cachedAt < CACHE_MS) {
      return res.json(cachedMarkets);
    }

    const response = await fetch(
      "https://clob.polymarket.com/markets?limit=1000",
      {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0",
          "Origin": "https://polymarket.com",
          "Referer": "https://polymarket.com/"
        }
      }
    );

    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();

    // If it's clearly HTML, bail
    if (contentType.includes("text/html") || raw.trim().startsWith("<")) {
      console.error("Polymarket returned HTML instead of JSON");
      return res.status(502).json({ error: "Upstream returned HTML" });
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error("Failed to parse Polymarket JSON:", e);
      return res.status(502).json({ error: "Invalid JSON from upstream" });
    }

    // Normalize: CLOB API often returns { markets: [...] }
    const markets = Array.isArray(data)
      ? data
      : Array.isArray(data.markets)
      ? data.markets
      : null;

    if (!markets) {
      console.error("Unexpected Polymarket shape:", Object.keys(data));
      return res.status(502).json({ error: "Unexpected upstream format" });
    }

    // Cache and return
    cachedMarkets = markets;
    cachedAt = now;

    res.json(markets);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Failed to fetch markets" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
