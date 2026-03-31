const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Root route
app.get("/", (req, res) => {
  res.send("Polymarket proxy is running");
});

// Correct Polymarket endpoint + required headers
app.get("/markets", async (req, res) => {
  try {
    const response = await fetch(
      "https://api.polymarket.com/markets?limit=1000",
      {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0"
        }
      }
    );

    // If Polymarket returns HTML, catch it early
    const text = await response.text();
    if (text.trim().startsWith("<")) {
      throw new Error("Polymarket returned HTML instead of JSON");
    }

    const data = JSON.parse(text);
    res.json(data);

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Failed to fetch markets" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
