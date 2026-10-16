// Lightweight retrieval (BM25) over the knowledge base.
// No ML libraries needed, so it runs free on any serverless host.
// Each chunk is one blank-line-separated section, so headings stay with their tips.

const STOP = new Set(("a an and are as at be but by can do for from how i if in into is it its me my " +
  "of on or so that the their them there these they this to was we what when where which who why " +
  "will with you your am im should would could get").split(" "));

// Popular places -> the country names used in the knowledge base.
const PLACES = {
  thailand: "bangkok|phuket|chiang mai|krabi|pattaya|koh samui|pai",
  vietnam: "hanoi|saigon|ho chi minh|hoi an|da nang|ha long|halong|sapa",
  cambodia: "phnom penh|siem reap|angkor|sihanoukville",
  laos: "vientiane|luang prabang|vang vieng",
  malaysia: "kuala lumpur|penang|langkawi|malacca|melaka",
  indonesia: "bali|jakarta|ubud|lombok|yogyakarta|komodo",
  philippines: "manila|cebu|palawan|boracay|siargao",
  myanmar: "yangon|bagan|mandalay",
};

// Tiny stemmer so "scams", "followed" and "following" match "scam" and "follow".
const stem = (w) => w.replace(/ies$/, "y").replace(/(ing|ed)$/, "").replace(/s$/, "");

const tokenize = (text) => {
  let t = text.toLowerCase();
  for (const [country, places] of Object.entries(PLACES))
    if (new RegExp(`\\b(${places})\\b`).test(t)) t += " " + country;
  return t.replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);
};

export function buildIndex(text) {
  const chunks = text.split(/\n\s*\n/).map((c) => c.trim()).filter(Boolean);
  const docs = chunks.map((c) => tokenize(c));
  const df = new Map();
  docs.forEach((d) => new Set(d).forEach((t) => df.set(t, (df.get(t) || 0) + 1)));
  const avgLen = docs.reduce((s, d) => s + d.length, 0) / docs.length;
  return { chunks, docs, df, avgLen, N: docs.length };
}

export function topChunks(index, query, k = 4) {
  const q = [...new Set(tokenize(query))];
  const k1 = 1.4, b = 0.75;
  const scored = index.docs.map((d, i) => {
    let score = 0;
    for (const t of q) {
      const tf = d.filter((w) => w === t).length;
      if (!tf) continue;
      const n = index.df.get(t);
      const idf = Math.log(1 + (index.N - n + 0.5) / (n + 0.5));
      score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * d.length / index.avgLen));
    }
    return { i, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score)
    .slice(0, k).map((s) => index.chunks[s.i]);
}
