// server.js (ESM, hardened, Railway-ready)
import express from "express";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pino from "pino";
import { OpenAI } from "openai";
import { z } from "zod";

/* ---------- setup ---------- */
const log = pino({ level: process.env.LOG_LEVEL || "info" });
const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true }));
app.use(compression());
app.use(express.json({ limit: "4mb" }));

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false
  })
);

if (!process.env.OPENAI_API_KEY) {
  log.warn("OPENAI_API_KEY not set; OpenAI endpoints will fail until you set it.");
}

// lazy-init OpenAI client (avoids boot error if key missing at build)
let openai = null;
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    const err = new Error("OPENAI_API_KEY not set");
    err.status = 500;
    throw err;
  }
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/* ---------- schemas ---------- */
const CharacterReq = z.object({
  prompt: z.string().min(1).default("Create a kid-friendly STEM character."),
  audience: z.string().default("ages 6–10"),
  style: z.string().default("bright 2D cartoon"),
  constraints: z.string().default("original; no resemblance to existing IP")
});
const CharacterRes = z.object({
  name: z.string(),
  species_or_type: z.string(),
  visual_description: z.string(),
  personality: z.string(),
  catchphrases: z.array(z.string()).optional().default([]),
  strengths: z.array(z.string()).optional().default([]),
  quirks: z.array(z.string()).optional().default([]),
  stem_domain: z.string(),
  color_palette: z.array(z.string()).optional().default([]),
  do_not_copy: z.string()
});

const StoryReq = z.object({
  title: z.string().default("Adventure in Volcano Valley"),
  topic: z.string().default("volcano science"),
  target_age: z.string().default("6–10"),
  minutes: z.number().int().min(1).max(15).default(3),
  characters: z.array(z.any()).default([]),
  moral: z.string().default("Curiosity + safety"),
  educational_goals: z.array(z.string()).default([
    "Basic volcano formation",
    "Safety around natural phenomena",
    "Scientific observation skills"
  ])
});
const StoryRes = z.object({
  title: z.string(),
  opening: z.string(),
  scenes: z.array(
    z.object({
      setting: z.string(),
      action: z.string(),
      dialogue: z.string(),
      duration: z.number()
    })
  ),
  closing: z.string(),
  moral: z.string(),
  educational_goals: z._
