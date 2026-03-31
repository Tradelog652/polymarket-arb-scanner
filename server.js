const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS so GitHub Pages can call this backend
app.use(cors());
app.use(express.json());

// Root route — fixes "Cannot GET /"
app.get("/", (req, res) => {
  res.send("Polymarket proxy is running");
});

// Proxy route your scanner.js calls
app.get("/markets", async (req, res) => {
  try {
    const response = await fetch("https://clob.polymarket.com/markets?limit=1000");
    const data = await response.json();
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
