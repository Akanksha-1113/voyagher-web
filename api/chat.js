// POST /api/chat  { message: string, history: [{role, content}] }
// Streams the assistant's reply back as plain text.
import fs from "node:fs";
import path from "node:path";
import { buildIndex, topChunks } from "../lib/retrieve.js";

const KB = fs.readFileSync(path.join(process.cwd(), "knowledgebase.txt"), "utf8");
const INDEX = buildIndex(KB);
const EMERGENCY = INDEX.chunks.find((c) => c.startsWith("Emergency Numbers")) || "";

const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const MAX_MSG = 1000;      // characters per user message
const MAX_TURNS = 10;      // past messages sent back to the model

// Best-effort per-visitor limit so one person can't burn your free quota.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now(), windowMs = 60_000, max = 12;
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  return list.length > max;
}

function systemPrompt(context) {
  return `You are VoyagHER, a warm, cultured travel companion for women travelling solo in Southeast Asia. Your job is their safety, comfort and joy, in that order.

How you answer:
- English, plain words, short paragraphs or bullet points. Under 200 words unless the user asks for more.
- A little warmth and local colour is welcome, but clarity always comes first.
- If the user describes danger (being followed, threatened, drink spiking, a medical emergency): start with the immediate steps and the local emergency number. No small talk.
- For safety questions, label the risk level (Green, Yellow or Red) and give: what the concern is, what to do now, and how to prevent it.
- Never invent specific businesses, guides, hotels, phone numbers or addresses. Instead, explain how to find and verify trustworthy options.
- For health issues, never diagnose. Recommend professional medical care for severe symptoms.
- If something is outside what you know, say so and suggest checking official sources (embassy, tourism board, local police).

Trusted knowledge for this question:
${context || "(nothing specific found; rely on general safety principles)"}

Emergency numbers (verify locally):
${EMERGENCY}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "Server is missing GROQ_API_KEY" });

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0] || "unknown";
  if (rateLimited(ip)) return res.status(429).json({ error: "Too many messages. Please wait a minute." });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const message = String(body.message || "").trim().slice(0, MAX_MSG);
  if (!message) return res.status(400).json({ error: "Empty message" });
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  const context = topChunks(INDEX, message).join("\n\n");

  const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.5,
      max_tokens: 600,
      stream: true,
      messages: [{ role: "system", content: systemPrompt(context) }, ...history, { role: "user", content: message }],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("Groq error", upstream.status, detail);
    const msg = upstream.status === 429 ? "VoyagHER is very busy right now. Please try again in a minute." : "The AI service had a problem. Please try again.";
    return res.status(502).json({ error: msg });
  }

  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" });
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const part of upstream.body) {
    buffer += decoder.decode(part, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      const data = line.replace(/^data:\s*/, "").trim();
      if (!data || data === "[DONE]" || !line.startsWith("data:")) continue;
      try {
        const token = JSON.parse(data).choices?.[0]?.delta?.content;
        if (token) res.write(token);
      } catch { /* ignore partial lines */ }
    }
  }
  res.end();
}
