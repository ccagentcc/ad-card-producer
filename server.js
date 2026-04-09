import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Load .env (production fallback — hosting services set env vars directly)
try {
  const envContent = readFileSync(resolve(__dirname, ".env"), "utf-8");
  for (const line of envContent.split("\n")) {
    const idx = line.indexOf("=");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch {}

const API_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

// ─── Security ───────────────────────────────────
// Helmet: secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://apis.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://*.googleusercontent.com"],
      connectSrc: ["'self'", "https://accounts.google.com"],
      frameSrc: ["https://accounts.google.com"],
    },
  },
}));

// Rate limiting: max 20 API calls per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { type: "error", error: { message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." } },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Middleware ──────────────────────────────────
app.use(express.static(resolve(__dirname, "dist")));
app.use(express.json({ limit: "1mb" }));

// ─── API Proxy ──────────────────────────────────
app.post("/api/anthropic/v1/messages", apiLimiter, async (req, res) => {
  // Validate request body
  const { model, max_tokens, system, messages } = req.body;
  if (!model || !messages || !Array.isArray(messages)) {
    return res.status(400).json({ type: "error", error: { message: "잘못된 요청입니다." } });
  }

  // Block excessive token requests
  if (max_tokens > 8000) {
    return res.status(400).json({ type: "error", error: { message: "max_tokens 제한 초과 (최대 8000)" } });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens, system, messages }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ type: "error", error: { message: "서버 오류가 발생했습니다." } });
  }
});

// ─── SPA fallback ───────────────────────────────
app.get("*", (req, res) => {
  let html = readFileSync(resolve(__dirname, "dist", "index.html"), "utf-8");
  html = html.replace(
    "</head>",
    `<script>window.__GOOGLE_CLIENT_ID__="${GOOGLE_CLIENT_ID}";</script></head>`
  );
  res.send(html);
});

app.listen(PORT, () => {
  console.log(`AD PRODUCER running on http://localhost:${PORT}`);
});
